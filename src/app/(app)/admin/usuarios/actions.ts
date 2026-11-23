"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError, runForm, type ActionState } from "@/lib/actions";
import { createInvite } from "@/lib/auth/invite";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireUser(ADMIN);
  return runForm(userCreateSchema, fd, async (d) => {
    if (d.password) {
      const weak = validatePasswordStrength(d.password);
      if (weak) return { ok: false, fieldErrors: { password: [weak] } };
    }
    // sem senha provisória: senha aleatória que ninguém conhece, até a pessoa usar o convite
    const hash = await hashPassword(d.password || randomBytes(32).toString("base64url"));
    const [{ id }] = await asUser(admin.id, (sql) => sql`select app.admin_create_user(${d.username}, ${d.full_name}, ${d.role}, ${d.phone}, ${hash}) as id`);
    revalidatePath("/admin/usuarios");
    if (d.password) return { ok: true, message: `Usuário ${d.username} criado. Ele deverá trocar a senha no primeiro acesso.` };
    const inv = await createInvite(admin.id, id);
    return {
      ok: true,
      message: `Usuário ${d.username} criado. Envie o link abaixo para ele criar a própria senha.`,
      data: { inviteUrl: inv.url, expiresAt: inv.expiresAt, name: d.full_name, username: d.username, phone: d.phone ?? "" },
    };
  });
}

/** Link para a pessoa criar (ou recriar) a própria senha. */
export async function inviteLinkAction(userId: string): Promise<{ ok: boolean; error?: string; url?: string; expiresAt?: string }> {
  const admin = await requireUser(ADMIN);
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Usuário inválido" };
  try {
    const inv = await createInvite(admin.id, userId);
    revalidatePath("/admin/usuarios");
    return { ok: true, ...inv };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function revokeInviteAction(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireUser(ADMIN);
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: "Usuário inválido" };
  try {
    await asUser(admin.id, (sql) => sql`select app.admin_revoke_invite(${userId})`);
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
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
