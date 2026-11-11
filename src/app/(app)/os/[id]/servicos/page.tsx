import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { dateTime, money } from "@/lib/format";
import { APPROVAL, APPROVAL_METHOD, EXECUTION, PRIORITY, type Priority } from "@/lib/status";
import { Badge, Card, Empty, SectionTitle, cx } from "@/components/ui";
import { MediaThumb } from "@/components/media-thumb";
import { MediaUploader } from "@/components/media-uploader";
import { DecisionForm, ExecutionForm, RemoveItemForm, ServiceItemForm } from "./service-forms";

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order, canEdit } = await getOrderContext(id);
  const seePrices = can.seePrices(user.role);
  const editPrices = can.editPrices(user.role);
  const staff = can.staff(user.role);

  const { items, decisions, media } = await asUser(user.id, async (sql) => {
    const items = await sql`
      select si.*, app.item_total_cents(si) as total_cents, cb.full_name as created_by_name, eb.full_name as executed_by_name
        from service_items si
        left join profiles cb on cb.id = si.created_by
        left join profiles eb on eb.id = si.executed_by
       where si.service_order_id = ${id} and si.deleted_at is null
       order by case si.priority when 'urgente' then 0 when 'recomendado' then 1 else 2 end, si.created_at`;
    const ids = items.map((i) => i.id as string);
    const decisions = ids.length
      ? await sql`
          select d.*, p.full_name from service_item_decisions d left join profiles p on p.id = d.recorded_by
           where d.service_item_id = any(${ids}) order by d.decided_at`
      : [];
    const media = ids.length
      ? await sql`select id, kind, caption, service_item_id from media where service_item_id = any(${ids}) and deleted_at is null`
      : [];
    return { items, decisions, media };
  });

  const sum = (f: (i: (typeof items)[number]) => boolean) => items.filter(f).reduce((a, i) => a + Number(i.total_cents), 0);

  return (
    <div>
      {seePrices && items.length > 0 && (
        <Card className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Total label="Orçamento total" value={money(sum(() => true))} />
          <Total label="Aprovado" value={money(sum((i) => i.approval_status === "aprovado"))} cls="text-green-700" />
          <Total label="Recusado" value={money(sum((i) => i.approval_status === "recusado"))} cls="text-brand" />
          <Total label="Executado" value={money(sum((i) => i.execution_status === "executado"))} />
        </Card>
      )}

      {items.length === 0 && <Empty title="Nenhum serviço recomendado ainda">Cadastre abaixo o que o carro precisa.</Empty>}

      <div className="space-y-3">
        {items.map((it) => {
          const decs = decisions.filter((d) => d.service_item_id === it.id);
          const md = media.filter((m) => m.service_item_id === it.id);
          const pending = it.approval_status === "pendente";
          const approved = it.approval_status === "aprovado";
          return (
            <Card key={it.id} className={cx(approved && "border-green-300", it.approval_status === "recusado" && "opacity-80")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={PRIORITY[it.priority as Priority].cls}>{PRIORITY[it.priority as Priority].label}</Badge>
                    <span className={cx("rounded-full border px-2 py-0.5 text-xs font-semibold", APPROVAL[it.approval_status as keyof typeof APPROVAL].cls)}>
                      {APPROVAL[it.approval_status as keyof typeof APPROVAL].label}
                    </span>
                    {approved && (
                      <Badge className={it.execution_status === "executado" ? "bg-green-700 text-white" : "bg-zinc-200 text-zinc-800"}>
                        {EXECUTION[it.execution_status as keyof typeof EXECUTION]}
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-bold">{it.title}</h3>
                  {it.description && <p className="text-zinc-700">{it.description}</p>}
                  {it.part_name && (
                    <p className="text-sm text-zinc-600">
                      Peça: {it.part_name} · Qtd {Number(it.quantity).toLocaleString("pt-BR")}
                      {seePrices && ` · ${money(it.part_unit_price_cents)} cada`}
                    </p>
                  )}
                  {seePrices && <p className="text-sm text-zinc-600">Mão de obra: {money(it.labor_price_cents)}</p>}
                  <p className="mt-1 text-xs text-zinc-500">
                    Cadastrado por {it.created_by_name} em {dateTime(it.created_at)}
                  </p>
                </div>
                {seePrices && <div className="text-2xl font-bold tabular-nums">{money(it.total_cents)}</div>}
              </div>

              {decs.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-xl bg-zinc-50 p-3 text-sm">
                  {decs.map((d) => (
                    <li key={d.id}>
                      <span className={d.decision === "aprovado" ? "font-semibold text-green-800" : "font-semibold text-brand"}>
                        {d.decision === "aprovado" ? "Aprovado" : "Recusado"}
                      </span>{" "}
                      via {APPROVAL_METHOD[d.method as keyof typeof APPROVAL_METHOD]} · {dateTime(d.decided_at)} · registrado por {d.full_name}
                      {seePrices && ` · valor ${money(d.approved_total_cents)}`}
                      {d.customer_note && <div className="text-zinc-600">“{d.customer_note}”</div>}
                    </li>
                  ))}
                </ul>
              )}

              {it.executed_at && (
                <p className="mt-2 text-sm text-zinc-700">
                  {EXECUTION[it.execution_status as keyof typeof EXECUTION]} por {it.executed_by_name} em {dateTime(it.executed_at)}
                  {it.execution_notes && ` — ${it.execution_notes}`}
                </p>
              )}

              {md.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {md.map((m) => (
                    <MediaThumb key={m.id} id={m.id} kind={m.kind} caption={m.caption} />
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
                  {staff && it.execution_status !== "executado" && <DecisionForm itemId={it.id} current={it.approval_status} />}
                  {approved && <ExecutionForm itemId={it.id} current={it.execution_status} />}
                  <div className="flex flex-wrap gap-2">
                    <MediaUploader orderId={id} link={{ service_item_id: it.id }} variant="compact" />
                  </div>
                  {(pending || user.role === "admin") && (
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-brand">Editar serviço</summary>
                      <div className="mt-3">
                        <ServiceItemForm
                          orderId={id}
                          editPrices={editPrices}
                          values={{
                            item_id: it.id,
                            title: it.title,
                            description: it.description,
                            part_name: it.part_name,
                            quantity: String(it.quantity),
                            part_unit_price_cents: Number(it.part_unit_price_cents),
                            labor_price_cents: Number(it.labor_price_cents),
                            priority: it.priority,
                          }}
                        />
                        {staff && pending && <RemoveItemForm itemId={it.id} />}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {canEdit && (
        <>
          <SectionTitle>Adicionar serviço recomendado</SectionTitle>
          <Card>
            <ServiceItemForm orderId={id} editPrices={editPrices} />
            {!editPrices && <p className="mt-2 text-xs text-zinc-500">Os valores são preenchidos pelo atendimento.</p>}
          </Card>
        </>
      )}
      {order.status === "aguardando_aprovacao" && staff && order.pending_count === 0 && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
          Todas as decisões foram registradas. Use o botão abaixo para avançar a etapa.
        </p>
      )}
    </div>
  );
}

function Total({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className={cx("text-xl font-bold tabular-nums", cls)}>{value}</div>
      <div className="text-xs font-semibold uppercase text-zinc-500">{label}</div>
    </div>
  );
}
