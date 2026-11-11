"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";

const idSchema = z.object({ message_id: z.uuid() });

export async function markSentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(idSchema, fd, async ({ message_id }) => {
    await asUser(user.id, (sql) => sql`select app.message_mark_sent(${message_id})`);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function cancelMessageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(idSchema, fd, async ({ message_id }) => {
    await asUser(user.id, (sql) => sql`select app.message_cancel(${message_id})`);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

const customSchema = z.object({
  order_id: z.uuid(),
  body: z.string().trim().min(2, "Escreva a mensagem").max(1024),
});

export async function customMessageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(customSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.enqueue_custom_message(${d.order_id}, ${d.body})`);
    revalidatePath(`/os/${d.order_id}`, "layout");
    return { ok: true, message: "Mensagem preparada. Toque em “Abrir no WhatsApp” para enviar." };
  });
}

const templateSchema = z.object({ order_id: z.uuid(), template_id: z.uuid("Escolha um modelo") });

export async function templateMessageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(templateSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.enqueue_template_for_order(${d.order_id}, ${d.template_id})`);
    revalidatePath(`/os/${d.order_id}`, "layout");
    return { ok: true, message: "Mensagem adicionada à fila" };
  });
}
