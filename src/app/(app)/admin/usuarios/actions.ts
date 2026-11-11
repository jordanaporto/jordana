"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireUser(ADMIN);
  return runForm(userCreateSchema, fd, async (d) => {
    const weak = validatePasswordStrength(d.password);
    if (weak) return { ok: false, fieldErrors: { password: [weak] } };
    const hash = await hashPassword(d.password);
    await asUser(admin.id, (sql) => sql`select app.admin_create_user(${d.username}, ${d.full_name}, ${d.role}, ${d.phone}, ${hash})`);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: `Usuário ${d.username} criado. Ele deverá trocar a senha no primeiro acesso.` };
  });
}

export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireUser(ADMIN);
  return runForm(userUpdateSchema, fd, async (d) => {
    await asUser(admin.id, (sql) => sql`select app.admin_update_user(${d.user_id}, ${d.full_name}, ${d.role}, ${d.phone}, ${d.active})`);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuário atualizado" };
  });
}

const resetSchema = z.object({ user_id: z.uuid(), password: z.string() });

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireUser(ADMIN);
  return runForm(resetSchema, fd, async (d) => {
    const weak = validatePasswordStrength(d.password);
    if (weak) return { ok: false, fieldErrors: { password: [weak] } };
    const hash = await hashPassword(d.password);
    await asUser(admin.id, (sql) => sql`select app.admin_set_password(${d.user_id}, ${hash})`);
    return { ok: true, message: "Senha provisória definida. O usuário foi desconectado de todos os aparelhos." };
  });
}
