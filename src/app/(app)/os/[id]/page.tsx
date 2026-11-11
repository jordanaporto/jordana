import Link from "next/link";
import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { dateTime, money } from "@/lib/format";
import { Card, DefinitionList, SectionTitle, Stat } from "@/components/ui";
import { AssignMechanicForm, EditOrderForm, NoteForm } from "./summary-forms";

export default async function OrderSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order, canEdit } = await getOrderContext(id);
  const staff = can.staff(user.role);

  const { notes, mechanics, previous } = await asUser(user.id, async (sql) => ({
    notes: await sql`
      select n.body, n.created_at, n.is_system, p.full_name from service_order_notes n
        left join profiles p on p.id = n.author_id where n.service_order_id = ${id} order by n.created_at desc`,
    mechanics: staff ? await sql`select id, full_name from profiles where role = 'mecanico' and active order by full_name` : [],
    previous: await sql`select count(*)::int as n from service_orders where vehicle_id = ${order.vehicle_id} and id <> ${id}`,
  }));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Itens com reparo" value={order.checklist_repair} tone={order.checklist_repair ? "brand" : "default"} href={`/os/${id}/checklist`} />
        <Stat label="Itens de atenção" value={order.checklist_attention} tone={order.checklist_attention ? "warn" : "default"} href={`/os/${id}/checklist`} />
        <Stat label="Serviços aguardando decisão" value={order.pending_count} href={`/os/${id}/servicos`} />
        {can.seePrices(user.role) ? (
          <Stat label="Total aprovado" value={money(order.approved_cents)} href={`/os/${id}/servicos`} tone="ok" />
        ) : (
          <Stat label="Serviços aprovados" value={order.approved_count} href={`/os/${id}/servicos`} tone="ok" />
        )}
      </div>

      <SectionTitle>Entrada</SectionTitle>
      <Card>
        <DefinitionList
          items={[
            ["Reclamação do cliente", <span key="c" className="text-lg font-semibold">{order.complaint}</span>],
            ["Observações do atendimento", order.intake_notes],
            ["Entrada", dateTime(order.entry_at)],
            ["Observações finais", order.final_notes],
            ...(order.status === "cancelada" ? ([["Motivo do cancelamento", order.cancelled_reason]] as [string, string][]) : []),
          ]}
        />
        {previous[0].n > 0 && (
          <Link href={`/veiculos/${order.vehicle_id}`} className="mt-4 inline-block font-semibold text-brand underline">
            Ver {previous[0].n} atendimento(s) anterior(es) deste veículo →
          </Link>
        )}
      </Card>

      {staff && canEdit && (
        <>
          <SectionTitle>Mecânico responsável</SectionTitle>
          <Card>
            <AssignMechanicForm orderId={id} current={order.assigned_mechanic_id} mechanics={mechanics.map((m) => ({ id: m.id, name: m.full_name }))} />
          </Card>
          <details className="mt-3 rounded-2xl border border-zinc-200 bg-white">
            <summary className="cursor-pointer p-4 font-semibold text-brand">Editar dados de entrada</summary>
            <div className="border-t border-zinc-100 p-4">
              <EditOrderForm
                orderId={id}
                values={{ entry_km: order.entry_km, complaint: order.complaint, intake_notes: order.intake_notes, final_notes: order.final_notes }}
              />
            </div>
          </details>
        </>
      )}

      <SectionTitle>Observações ({notes.length})</SectionTitle>
      {canEdit && (
        <Card className="mb-3">
          <NoteForm orderId={id} />
        </Card>
      )}
      <ul className="space-y-2">
        {notes.map((n, i) => (
          <li key={i} className={n.is_system ? "px-2 text-sm text-zinc-500" : "rounded-xl border border-zinc-200 bg-white p-3"}>
            <div className={n.is_system ? "" : "whitespace-pre-wrap"}>{n.body}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {n.full_name ?? "Sistema"} · {dateTime(n.created_at)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
