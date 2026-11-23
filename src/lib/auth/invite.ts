import "server-only";
import { randomBytes } from "node:crypto";
import { asSystem, asUser } from "../db";
import { hashToken } from "./session";

export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

/** Gera o link de convite (o banco guarda só o hash). Só administrador. */
export async function createInvite(adminId: string, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const [{ exp }] = await asUser(adminId, (sql) => sql`select app.admin_create_invite(${userId}, ${hashToken(token)}) as exp`);
  const [{ base }] = await asSystem((sql) => sql`select app.public_url() as base`);
  const origin = (base as string) || process.env.APP_URL || "";
  return { url: `${origin}/convite/${token}`, expiresAt: new Date(exp).toISOString() };
}
