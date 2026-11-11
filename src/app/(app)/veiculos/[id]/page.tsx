import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can } from "@/lib/roles";
import { date, km, money, osNumber } from "@/lib/format";
import { CHECKLIST_RESULT, FUEL, PRIORITY, type ChecklistResult, type OsStatus, type Priority } from "@/lib/status";
import { Badge, Card, DefinitionList, LinkButton, PageHeader, Plate, SectionTitle, StatusChip } from "@/components/ui";
import { MediaThumb } from "@/components/media-thumb";

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const seePrices = can.seePrices(user.role);

  const data = await asUser(user.id, async (sql) => {
    const [v] = await sql`select * from vehicles where id = ${id}`;
    if (!v) return null;
    const orders = await sql`select * from v_orders where vehicle_id = ${id} order by entry_at desc`;
    const ids = orders.map((o) => o.id as string);
    if (!ids.length) return { v, orders, findings: [], diags: [], items: [], media: [] };
    const findings = await sql`
      select service_order_id, category_name, item_name, result, note from service_order_checklist
       where service_order_id = any(${ids}) and result in ('atencao', 'necessita_reparo')
       order by category_position, position`;
    const diags = await sql`select * from diagnoses where service_order_id = any(${ids})`;
    const items = await sql`
      select service_order_id, title, part_name, priority, approval_status, execution_status,
             app.item_total_cents(si) as total_cents
        from service_items si where service_order_id = any(${ids}) and deleted_at is null order by created_at`;
    const media = await sql`
      select id, service_order_id, kind, caption from media
       where service_order_id = any(${ids}) and deleted_at is null order by created_at desc`;
    return { v, orders, findings, diags, items, media };
  });
  if (!data) notFound();
  const { v, orders, findings, diags, items, media } = data;
  const customerName = orders[0]?.customer_name;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Plate plate={v.plate} size="lg" />
            <span>
              {v.brand} {v.model} {v.year ?? ""}
            </span>
          </span>
        }
        subtitle={can.readAll(user.role) ? <Link href={`/clientes/${v.customer_id}`} className="underline">{customerName ?? "Ver cliente"}</Link> : customerName}
        action={can.staff(user.role) ? <LinkButton href={`/veiculos/${v.id}/editar`} variant="outline" size="sm">Editar</LinkButton> : undefined}
      />

      <Card>
        <DefinitionList
          items={[
            ["Versão", v.version],
            ["Motor", v.engine],
            ["Combustível", v.fuel ? FUEL[v.fuel as keyof typeof FUEL] : null],
            ["Cor", v.color],
            ["Quilometragem atual", km(v.current_km)],
            ["Observações", v.notes],
          ]}
        />
      </Card>

      {can.staff(user.role) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {!orders.some((o) => !["entregue", "cancelada"].includes(o.status)) && (
            <LinkButton href={`/os/nova?veiculo=${v.id}`} size="lg">
              Abrir nova OS
            </LinkButton>
          )}
          <LinkButton href={`/agenda/novo?veiculo=${v.id}`} size="lg" variant="outline">
            Agendar horário
          </LinkButton>
        </div>
      )}

      <SectionTitle>Histórico de atendimentos ({orders.length})</SectionTitle>
      <ol className="relative space-y-4 border-l-2 border-zinc-300 pl-5">
        {orders.map((o, idx) => {
          const f = findings.filter((x) => x.service_order_id === o.id);
          const d = diags.find((x) => x.service_order_id === o.id);
          const its = items.filter((x) => x.service_order_id === o.id);
          const md = media.filter((x) => x.service_order_id === o.id);
          const executed = its.filter((x) => x.execution_status === "executado");
          const pendingRecs = its.filter((x) => x.approval_status !== "aprovado");
          return (
            <li key={o.id} className="relative">
              <span className="absolute -left-[29px] top-5 size-4 rounded-full border-4 border-zinc-100 bg-brand" />
              <details open={idx === 0} className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <summary className="cursor-pointer p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-lg font-bold">{date(o.entry_at)}</div>
                    <StatusChip status={o.status as OsStatus} size="sm" />
                  </div>
                  <div className="text-sm text-zinc-600">
                    {km(o.entry_km)} · {osNumber(o.number)}
                  </div>
                  <div className="mt-1 font-medium">{o.complaint}</div>
                </summary>
                <div className="space-y-4 border-t border-zinc-100 p-4 text-sm">
                  {f.length > 0 && (
                    <div>
                      <div className="mb-1 font-semibold">O que foi encontrado</div>
                      <ul className="space-y-1">
                        {f.map((x, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-2">
                            <Badge className={CHECKLIST_RESULT[x.result as ChecklistResult].cls}>{CHECKLIST_RESULT[x.result as ChecklistResult].short}</Badge>
                            <span>
                              {x.category_name} · {x.item_name}
                              {x.note && <span className="text-zinc-600"> — {x.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d && (d.root_cause || d.recommendation) && (
                    <div>
                      <div className="mb-1 font-semibold">Diagnóstico</div>
                      {d.root_cause && <p>Causa: {d.root_cause}</p>}
                      {d.recommendation && <p className="text-zinc-700">Recomendação: {d.recommendation}</p>}
                    </div>
                  )}
                  {executed.length > 0 && (
                    <div>
                      <div className="mb-1 font-semibold">Serviços executados</div>
                      <ul className="list-inside list-disc">
                        {executed.map((x, i) => (
                          <li key={i}>
                            {x.title}
                            {x.part_name ? ` (${x.part_name})` : ""}
                            {seePrices && <span className="text-zinc-600"> — {money(x.total_cents)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pendingRecs.length > 0 && (
                    <div>
                      <div className="mb-1 font-semibold">Recomendações não realizadas</div>
                      <ul className="space-y-1">
                        {pendingRecs.map((x, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-2">
                            <Badge className={PRIORITY[x.priority as Priority].cls}>{PRIORITY[x.priority as Priority].label}</Badge>
                            {x.title}
                            <span className="text-zinc-500">({x.approval_status === "recusado" ? "recusado" : "sem decisão"})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {md.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {md.slice(0, 12).map((m) => (
                        <MediaThumb key={m.id} id={m.id} kind={m.kind} caption={m.caption} />
                      ))}
                    </div>
                  )}
                  <LinkButton href={`/os/${o.id}`} variant="outline" size="sm">
                    Abrir OS completa
                  </LinkButton>
                </div>
              </details>
            </li>
          );
        })}
        {orders.length === 0 && <p className="text-zinc-600">Nenhum atendimento registrado.</p>}
      </ol>
    </div>
  );
}
