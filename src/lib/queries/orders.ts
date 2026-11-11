import "server-only";
import type { Tx } from "../db";
import type { OrderRow } from "@/components/order-card";

/** OS abertas visíveis ao usuário, com contagem de alertas */
export async function listOpenOrders(sql: Tx, opts: { mechanicId?: string | null; includeDeliveredToday?: boolean } = {}) {
  const rows = await sql`
    select o.*, (select count(*) from v_alerts a where a.service_order_id = o.id)::int as alert_count
      from v_orders o
     where (o.status not in ('entregue', 'cancelada')
            ${opts.includeDeliveredToday ? sql`or (o.status = 'entregue' and o.delivered_at > date_trunc('day', now() at time zone 'America/Belem') at time zone 'America/Belem')` : sql``})
       ${opts.mechanicId ? sql`and o.assigned_mechanic_id = ${opts.mechanicId}` : sql``}
     order by o.status_changed_at asc`;
  return rows as unknown as (OrderRow & { assigned_mechanic_id: string | null })[];
}
