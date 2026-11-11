import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { asSystem } from "../db";
import { env } from "../env";
import type { Role } from "../roles";
import { DUMMY_HASH, verifyPassword } from "./password";

export const SESSION_COOKIE = "injecar_session";
const SESSION_DAYS = 30;
const MAX_FAILURES = 5;

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  tokenHash: string;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(username: string, password: string): Promise<LoginResult> {
  const { ip, userAgent } = await clientInfo();
  const uname = username.trim().toLowerCase();

  const [{ n: failures }] = await asSystem((sql) => sql`select app.auth_recent_failures(${uname}, ${ip}) as n`);
  if (failures >= MAX_FAILURES) {
    return {
      ok: false,
      error: "Muitas tentativas. Aguarde 15 minutos ou peça ao administrador para redefinir a senha.",
    };
  }

  const [row] = await asSystem((sql) => sql`select * from app.auth_lookup(${uname})`);
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  const success = Boolean(row && valid && row.active);
  await asSystem((sql) => sql`select app.auth_log_attempt(${uname}, ${ip}, ${success})`);
  if (!success) return { ok: false, error: "Usuário ou senha incorretos" };

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await asSystem(
    (sql) => sql`select app.auth_create_session(${row.user_id}, ${hashToken(token)}, ${expires}, ${ip}, ${userAgent})`,
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await asSystem((sql) => sql`select app.auth_delete_session(${hashToken(token)})`);
  jar.delete(SESSION_COOKIE);
}

/** Usuário da requisição atual (cacheado por requisição). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const [row] = await asSystem((sql) => sql`select * from app.auth_session(${tokenHash})`);
  if (!row) return null;
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    tokenHash,
  };
});

/** Exige login (e, opcionalmente, um dos perfis). Redireciona quando não atende. */
export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) {
    const path = (await headers()).get("x-pathname") ?? "";
    // "/login": renderização dentro da própria ação de login — não redirecionar de novo
    if (path && path !== "/perfil" && path !== "/login") redirect("/perfil?trocar-senha=1");
  }
  if (roles && !roles.includes(user.role)) redirect("/?sem-permissao=1");
  return user;
}
