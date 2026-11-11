import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { MANAGEMENT } from "@/lib/roles";
import { duration, money } from "@/lib/format";
import { Card, PageHeader, SectionTitle, Stat, cx } from "@/components/ui";

export const metadata = { title: "Indicadores" };

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "365", label: "12 meses" },
];

export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const user = await requireUser(MANAGEMENT);
  const sp = await searchParams;
  const dias = PERIODS.some((p) => p.key === sp.dias) ? Number(sp.dias) : 30;

  const k = await asUser(user.id, async (sql) => {
    const since = sql`now() - make_interval(days => ${dias})`;
    const [t] = await sql`
      select count(*)::int as entered,
             count(*) filter (where status = 'entregue')::int as delivered,
             coalesce(sum(executed_cents) filter (where status = 'entregue'), 0)::bigint as revenue,
             coalesce(avg(executed_cents) filter (where status = 'entregue' and executed_cents > 0), 0)::bigint as ticket,
             coalesce(sum(approved_count), 0)::int as approved_items,
             coalesce(sum(refused_count), 0)::int as refused_items,
             coalesce(sum(approved_cents), 0)::bigint as approved_cents,
             coalesce(sum(refused_cents), 0)::bigint as refused_cents,
             avg(diagnosis_hours) as avg_diag,
             avg(approval_hours) as avg_approval,
             avg(total_hours) filter (where status = 'entregue') as avg_total
        from v_kpi_orders where entry_at >= ${since}`;
    const mechanics = await sql`
      select coalesce(mechanic_name, 'Sem mecânico') as name,
             count(*)::int as orders,
             count(*) filter (where status = 'entregue')::int as delivered,
             coalesce(sum(executed_count), 0)::int as executed_items,
             coalesce(sum(executed_cents), 0)::bigint as executed_cents,
             avg(diagnosis_hours) as avg_diag
        from v_kpi_orders where entry_at >= ${since}
       group by 1 order by executed_cents desc`;
    const orders = await sql`
      select id, number, delivered_at, executed_cents, approved_cents from v_kpi_orders
       where status = 'entregue' and delivered_at >= ${since} order by delivered_at desc limit 20`;
    return { t, mechanics, orders };
  });
  const totalDecided = k.t.approved_items + k.t.refused_items;
  const approvalRate = totalDecided ? Math.round((k.t.approved_items / totalDecided) * 100) : null;

  return (
    <div>
      <PageHeader title="Indicadores" subtitle="Visão gerencial (OS abertas no período)" />
      <div className="mb-4 flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/gestao?dias=${p.key}`}
            className={cx("rounded-full border-2 px-3 py-1.5 text-sm font-semibold", String(dias) === p.key ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white")}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Carros atendidos (entradas)" value={k.t.entered} />
        <Stat label="Entregues" value={k.t.delivered} tone="ok" />
        <Stat label="Faturamento executado" value={money(k.t.revenue)} />
        <Stat label="Ticket médio" value={money(k.t.ticket)} />
        <Stat label="Tempo médio de diagnóstico" value={k.t.avg_diag ? duration(k.t.avg_diag) : "—"} />
        <Stat label="Tempo médio de aprovação" value={k.t.avg_approval ? duration(k.t.avg_approval) : "—"} />
        <Stat label="Tempo total médio (entrada → entrega)" value={k.t.avg_total ? duration(k.t.avg_total) : "—"} />
        <Stat label="Taxa de aprovação de serviços" value={approvalRate == null ? "—" : `${approvalRate}%`} />
      </div>

      <SectionTitle>Serviços aprovados × recusados</SectionTitle>
      <Card>
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold text-green-800">
            {k.t.approved_items} aprovados · {money(k.t.approved_cents)}
          </span>
          <span className="font-semibold text-brand">
            {k.t.refused_items} recusados · {money(k.t.refused_cents)}
          </span>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-zinc-100">
          <div className="bg-green-600" style={{ width: `${approvalRate ?? 0}%` }} />
          <div className="bg-brand" style={{ width: `${approvalRate == null ? 0 : 100 - approvalRate}%` }} />
        </div>
      </Card>

      <SectionTitle>Produtividade por mecânico</SectionTitle>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="p-3">Mecânico</th>
              <th className="p-3 text-right">OS</th>
              <th className="p-3 text-right">Entregues</th>
              <th className="p-3 text-right">Serviços executados</th>
              <th className="p-3 text-right">Valor executado</th>
              <th className="p-3 text-right">Diagnóstico médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {k.mechanics.map((m) => (
              <tr key={m.name}>
                <td className="p-3 font-semibold">{m.name}</td>
                <td className="p-3 text-right tabular-nums">{m.orders}</td>
                <td className="p-3 text-right tabular-nums">{m.delivered}</td>
                <td className="p-3 text-right tabular-nums">{m.executed_items}</td>
                <td className="p-3 text-right tabular-nums">{money(m.executed_cents)}</td>
                <td className="p-3 text-right tabular-nums">{m.avg_diag ? duration(m.avg_diag) : "—"}</td>
              </tr>
            ))}
            {k.mechanics.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-zinc-600">Sem dados no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SectionTitle>Faturamento por OS entregue</SectionTitle>
      <Card className="p-0">
        <ul className="divide-y divide-zinc-100 text-sm">
          {k.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/os/${o.id}`} className="flex justify-between p-3 hover:bg-zinc-50">
                <span>
                  OS {String(o.number).padStart(4, "0")} · {new Date(o.delivered_at).toLocaleDateString("pt-BR")}
                </span>
                <b className="tabular-nums">{money(o.executed_cents)}</b>
              </Link>
            </li>
          ))}
          {k.orders.length === 0 && <li className="p-4 text-zinc-600">Nenhuma OS entregue no período.</li>}
        </ul>
      </Card>
    </div>
  );
}
