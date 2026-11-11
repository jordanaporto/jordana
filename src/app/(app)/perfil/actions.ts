"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

const schema = z
  .object({ current: z.string().min(1, "Informe a senha atual"), password: z.string(), confirm: z.string() })
  .superRefine((v, ctx) => {
    const weak = validatePasswordStrength(v.password);
    if (weak) ctx.addIssue({ code: "custom", path: ["password"], message: weak });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "As senhas não conferem" });
    if (v.password === v.current) ctx.addIssue({ code: "custom", path: ["password"], message: "Use uma senha diferente da atual" });
  });

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return runForm(schema, fd, async ({ current, password }) => {
    const stored = await asUser(user.id, async (sql) => {
      const [r] = await sql`select app.auth_password_hash(${user.id}) as h`;
      return r.h as string | null;
    });
    if (!stored || !(await verifyPassword(current, stored))) {
      return { ok: false, fieldErrors: { current: ["Senha atual incorreta"] } };
    }
    const hash = await hashPassword(password);
    await asUser(user.id, (sql) => sql`select app.change_own_password(${hash}, ${user.tokenHash})`);
    revalidatePath("/", "layout");
    return { ok: true, message: "Senha alterada. Outros aparelhos foram desconectados.", redirectTo: user.mustChangePassword ? "/" : undefined };
  });
}
