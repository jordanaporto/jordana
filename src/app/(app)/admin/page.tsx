import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { MANAGEMENT } from "@/lib/roles";
import { dateTime, duration, osNumber } from "@/lib/format";
import { GROUP_STYLE, OPEN_STATUSES, STATUS_META, type OsStatus } from "@/lib/status";
import { ACTION, AUDIT_LABEL } from "@/lib/audit";
import { Card, PageHeader, Plate, SectionTitle, Stat, StatusChip, cx } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const ALERT_ICON: Record<string, string> = {
  sem_atualizacao: "⏱",
  aguardando_aprovacao: "💬",
  pronto_sem_aviso: "📣",
  aguardando_peca: "📦",
  diagnostico_demorado: "🔧",
};

export default async function DashboardPage() {
  const user = await requireUser(MANAGEMENT);
  const d = await asUser(user.id, async (sql) => {
    const open = await sql`
      select id, number, plate, brand, model, status, mechanic_name, hours_in_status, hours_since_activity
        from v_orders where status not in ('entregue', 'cancelada') order by hours_in_status desc`;
    const [totals] = await sql`
      select count(*) filter (where status = 'entregue' and delivered_at >= date_trunc('day', now() at time zone 'America/Belem') at time zone 'America/Belem')::int as delivered_today,
             count(*) filter (where status = 'entregue' and delivered_at >= now() - interval '7 days')::int as delivered_week,
             count(*) filter (where status in ('servico_concluido', 'pronto_retirada'))::int as finished
        from v_orders`;
    const alerts = await sql`select * from v_alerts order by severity desc, hours desc`;
    const byMechanic = await sql`
      select coalesce(mechanic_name, 'Sem mecânico') as name, count(*)::int as n,
             count(*) filter (where status in ('em_inspecao','em_diagnostico','em_manutencao','em_teste'))::int as active
        from v_orders where status not in ('entregue', 'cancelada') group by 1 order by n desc`;
    const avgStage = await sql`
      select status, avg(hours) as avg_hours, count(*)::int as n
        from v_status_durations where not is_current and entered_at > now() - interval '30 days'
       group by status`;
    const audit = await sql`
      select a.table_name, a.action, a.occurred_at, a.service_order_id, p.full_name
        from audit_log a left join profiles p on p.id = a.actor_id
       order by a.id desc limit 8`;
    return { open, totals, alerts, byMechanic, avgStage, audit };
  });

  const counts = OPEN_STATUSES.map((s) => ({ s: s as OsStatus, n: d.open.filter((o) => o.status === s).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const awaiting = d.open.filter((o) => o.status === "aguardando_aprovacao").length;
  const stale = new Set(d.alerts.filter((a) => a.kind === "sem_atualizacao").map((a) => a.service_order_id)).size;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Atualizado em ${dateTime(new Date())}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Na oficina agora" value={d.open.length} href="/patio" />
        <Stat label="Aguardando aprovação" value={awaiting} href="/patio?status=aguardando_aprovacao" tone={awaiting ? "warn" : "default"} />
        <Stat label="Sem atualização" value={stale} href="/patio?alerta=1" tone={stale ? "brand" : "default"} />
        <Stat label="Finalizados (prontos)" value={d.totals.finished} tone="ok" />
        <Stat label="Entregues hoje / 7 dias" value={`${d.totals.delivered_today} / ${d.totals.delivered_week}`} />
      </div>

      <div className="mt-2 grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Alertas ({d.alerts.length})</SectionTitle>
          <Card className="p-0">
            {d.alerts.length === 0 ? (
              <p className="p-4 text-zinc-600">Nenhum alerta. Tudo em dia. ✅</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {d.alerts.map((a, i) => (
                  <li key={i}>
                    <Link href={`/os/${a.service_order_id}`} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                      <span className="text-xl" aria-hidden>{ALERT_ICON[a.kind] ?? "⚠"}</span>
                      <Plate plate={a.plate} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{a.message}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {osNumber(a.number)} · {a.model} · {a.mechanic_name ?? "sem mecânico"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <SectionTitle>Veículos por etapa</SectionTitle>
          <Card>
            <ul className="space-y-1.5">
              {counts.map(({ s, n }) => (
                <li key={s}>
                  <Link href={`/patio?status=${s}`} className="flex items-center gap-2 text-sm">
                    <span className="w-44 shrink-0 truncate">
                      {STATUS_META[s].n}. {STATUS_META[s].label}
                    </span>
                    <span className="h-5 flex-1 rounded bg-zinc-100">
                      <span className={cx("block h-5 rounded", GROUP_STYLE[STATUS_META[s].group].bar)} style={{ width: `${(n / max) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right font-bold tabular-nums">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <SectionTitle>Veículos por mecânico</SectionTitle>
          <Card>
            <ul className="space-y-2">
              {d.byMechanic.map((m) => (
                <li key={m.name} className="flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-sm text-zinc-600">
                    <b className="text-ink">{m.n}</b> carro(s) · {m.active} em execução
                  </span>
                </li>
              ))}
              {d.byMechanic.length === 0 && <li className="text-zinc-600">Nenhum carro na oficina.</li>}
            </ul>
          </Card>
        </div>

        <div>
          <SectionTitle>Tempo na etapa atual</SectionTitle>
          <Card className="p-0">
            <ul className="divide-y divide-zinc-100">
              {d.open.slice(0, 15).map((o) => (
                <li key={o.id}>
                  <Link href={`/os/${o.id}`} className="flex items-center gap-3 p-3 hover:bg-zinc-50">
                    <Plate plate={o.plate} size="sm" />
                    <span className="min-w-0 flex-1">
                      <StatusChip status={o.status} size="sm" />
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {o.model} · {o.mechanic_name ?? "sem mecânico"} · última atualização há {duration(o.hours_since_activity)}
                      </span>
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums">{duration(o.hours_in_status)}</span>
                  </Link>
                </li>
              ))}
              {d.open.length === 0 && <li className="p-4 text-zinc-600">Nenhum carro na oficina.</li>}
            </ul>
          </Card>

          <SectionTitle>Tempo médio por etapa (30 dias)</SectionTitle>
          <Card>
            <ul className="space-y-1 text-sm">
              {d.avgStage
                .sort((a, b) => STATUS_META[a.status as OsStatus].n - STATUS_META[b.status as OsStatus].n)
                .map((r) => (
                  <li key={r.status} className="flex justify-between">
                    <span>{STATUS_META[r.status as OsStatus].label}</span>
                    <span className="tabular-nums">
                      <b>{duration(r.avg_hours)}</b> <span className="text-zinc-500">({r.n})</span>
                    </span>
                  </li>
                ))}
              {d.avgStage.length === 0 && <li className="text-zinc-600">Ainda sem dados suficientes.</li>}
            </ul>
          </Card>

          {user.role === "admin" && (
            <>
              <SectionTitle action={<Link href="/admin/auditoria" className="text-sm font-semibold text-brand">Ver tudo →</Link>}>
                Últimas alterações
              </SectionTitle>
              <Card className="p-0">
                <ul className="divide-y divide-zinc-100 text-sm">
                  {d.audit.map((a, i) => (
                    <li key={i} className="flex justify-between gap-2 p-3">
                      <span>
                        <b>{a.full_name ?? "Sistema"}</b> · {AUDIT_LABEL[a.table_name] ?? a.table_name} ({ACTION[a.action]})
                      </span>
                      <span className="shrink-0 text-zinc-500">{dateTime(a.occurred_at)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
