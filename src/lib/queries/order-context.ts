import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser } from "../auth/session";
import { asUser } from "../db";
import type { OsStatus } from "../status";

export type Transition = { to_status: OsStatus; kind: "avancar" | "voltar" | "cancelar" };

/** Carrega a OS uma vez por requisição (layout + aba usam o mesmo resultado). */
export const getOrderContext = cache(async (id: string) => {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await asUser(user.id, async (sql) => {
    const [order] = await sql`select * from v_orders where id = ${id}`;
    if (!order) return null;
    const transitions = (await sql`select to_status, kind from app.available_transitions(${id})`) as unknown as Transition[];
    const [{ can_edit }] = await sql`select app.can_edit_order(${id}) as can_edit`;
    return { order, transitions, canEdit: can_edit as boolean };
  });
  if (!data) notFound();
  return { user, ...data };
});
