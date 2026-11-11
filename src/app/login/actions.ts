"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { getSessionUser, login, logout } from "@/lib/auth/session";
import { homeFor } from "@/lib/roles";

const schema = z.object({
  username: z.string().trim().min(1, "Informe o usuário").max(30),
  password: z.string().min(1, "Informe a senha").max(128),
});

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let ok = false;
  const res = await runForm(schema, fd, async ({ username, password }) => {
    const r = await login(username, password);
    if (!r.ok) return { ok: false, error: r.error, values: { username } };
    ok = true;
  });
  if (!ok) return { ...res, values: { username: String(fd.get("username") ?? "") } };
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(user.mustChangePassword ? "/perfil?trocar-senha=1" : homeFor(user.role));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
