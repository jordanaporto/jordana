import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { dateTime } from "@/lib/format";
import { Alert, Card, SectionTitle, cx } from "@/components/ui";
import { GenerateReportButton } from "./generate-button";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order } = await getOrderContext(id);
  if (!can.readAll(user.role)) return <Alert>Sem acesso aos relatórios.</Alert>;

  const { reports, check } = await asUser(user.id, async (sql) => ({
    reports: await sql`
      select r.version, r.generated_at, p.full_name from reports r left join profiles p on p.id = r.generated_by
       where r.service_order_id = ${id} order by r.version desc`,
    check: (
      await sql`
        select (select count(*) from media where service_order_id = ${id} and include_in_report and deleted_at is null)::int as photos,
               (select count(*) from diagnoses where service_order_id = ${id})::int as diag,
               (select count(*) from outbound_messages where service_order_id = ${id} and trigger_status = 'pronto_retirada'
                  and status in ('enviada','entregue','lida'))::int as ready_msg`
    )[0],
  }));

  const items: [boolean, string][] = [
    [order.checklist_done > 0, `Checklist: ${order.checklist_done} de ${order.checklist_total} itens avaliados`],
    [check.diag > 0, "Diagnóstico registrado"],
    [order.pending_count === 0 && order.items_count > 0, `Serviços: ${order.approved_count} aprovado(s), ${order.refused_count} recusado(s), ${order.pending_count} sem decisão`],
    [order.approved_count === 0 || order.executed_count >= order.approved_count, `Executados: ${order.executed_count} de ${order.approved_count} aprovado(s)`],
    [check.photos > 0, check.photos > 0 ? `${check.photos} foto(s) marcada(s) para o relatório` : "Nenhuma foto marcada (serão usadas as 6 mais recentes)"],
    [check.ready_msg > 0 || order.status !== "pronto_retirada", "Cliente avisado que o carro está pronto"],
  ];

  return (
    <div>
      <SectionTitle>Conferência antes da entrega</SectionTitle>
      <Card>
        <ul className="space-y-2">
          {items.map(([ok, text]) => (
            <li key={text} className="flex items-start gap-2">
              <span className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", ok ? "bg-green-700" : "bg-amber-500")}>
                {ok ? "✓" : "!"}
              </span>
              {text}
            </li>
          ))}
        </ul>
      </Card>

      {can.staff(user.role) && (
        <Card className="mt-4">
          <GenerateReportButton orderId={id} />
          <p className="mt-2 text-sm text-zinc-600">
            Cada geração cria uma nova versão; as anteriores ficam guardadas.
          </p>
        </Card>
      )}

      <SectionTitle>Versões geradas</SectionTitle>
      {reports.length === 0 ? (
        <p className="text-zinc-600">Nenhum relatório gerado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.version}>
              <a
                href={`/api/os/${id}/relatorio?versao=${r.version}`}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-400"
              >
                <span>
                  <b>Versão {r.version}</b> · {dateTime(r.generated_at)} · {r.full_name}
                </span>
                <span className="font-semibold text-brand">Abrir PDF</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
