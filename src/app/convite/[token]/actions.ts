"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, runForm, type ActionState } from "@/lib/actions";
import { INVITE_TOKEN_RE } from "@/lib/auth/invite";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { getSessionUser, hashToken, startSession } from "@/lib/auth/session";
import { asSystem } from "@/lib/db";
import { homeFor } from "@/lib/roles";

const schema = z.object({
  token: z.string().regex(INVITE_TOKEN_RE, "Link inválido"),
  password: z.string().max(128),
  confirm: z.string().max(128),
});

export async function acceptInviteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const res = await runForm(schema, fd, async (d) => {
    const weak = validatePasswordStrength(d.password);
    if (weak) return { ok: false, fieldErrors: { password: [weak] } };
    if (d.password !== d.confirm) return { ok: false, fieldErrors: { confirm: ["As senhas não são iguais"] } };
    const hash = await hashPassword(d.password);
    let userId: string;
    try {
      const [r] = await asSystem((sql) => sql`select app.invite_accept(${hashToken(d.token)}, ${hash}) as id`);
      userId = r.id;
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
    await startSession(userId);
    done = true;
  });
  if (!done) return res;
  const user = await getSessionUser();
  redirect(user ? homeFor(user.role) : "/login");
}
