import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { dateTime, duration, time } from "@/lib/format";
import { APPROVAL_METHOD, EXECUTION, GROUP_STYLE, MESSAGE_STATUS, STATUS_META, type OsStatus } from "@/lib/status";
import { Card, SectionTitle, cx } from "@/components/ui";

type Ev = { at: Date; kind: string; title: string | null; body: string | null; extra: string | null; actor: string | null };

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getOrderContext(id);
  const { events, durations } = await asUser(user.id, async (sql) => ({
    events: (await sql`select * from v_order_timeline where service_order_id = ${id} order by at desc`) as unknown as Ev[],
    durations: await sql`
      select d.status, d.entered_at, d.hours, d.is_current, p.full_name
        from v_status_durations d left join profiles p on p.id = d.changed_by
       where d.service_order_id = ${id} order by d.entered_at`,
  }));
  const total = durations.reduce((a, d) => a + Number(d.hours), 0);

  return (
    <div>
      <SectionTitle>Tempo em cada etapa</SectionTitle>
      <Card>
        <ol className="space-y-2">
          {durations.map((d, i) => {
            const meta = STATUS_META[d.status as OsStatus];
            const pct = total ? Math.max(2, (Number(d.hours) / total) * 100) : 0;
            return (
              <li key={i}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={cx("font-semibold", d.is_current && "text-brand")}>
                    {meta.label} {d.is_current && "(agora)"}
                  </span>
                  <span className="tabular-nums text-zinc-600">{duration(d.hours)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100">
                  <div className={cx("h-2 rounded-full", GROUP_STYLE[meta.group].bar)} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {dateTime(d.entered_at)} · {d.full_name ?? "—"}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <SectionTitle>Tudo o que aconteceu</SectionTitle>
      <ol className="relative space-y-3 border-l-2 border-zinc-200 pl-5">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span className={cx("absolute -left-[27px] top-1.5 size-3 rounded-full", dot(e))} />
            <div className="text-xs text-zinc-500">
              {dateTime(e.at)} {e.actor && `· ${e.actor}`}
            </div>
            <div className="text-sm">{describe(e)}</div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-zinc-500">Horário de Belém. Registro gerado automaticamente — não pode ser apagado. Consulta às {time(new Date())}.</p>
    </div>
  );
}

function dot(e: Ev) {
  if (e.kind === "status") return GROUP_STYLE[STATUS_META[e.title as OsStatus]?.group ?? "entrada"].dot;
  if (e.kind === "decisao") return e.title === "aprovado" ? "bg-green-700" : "bg-brand";
  if (e.kind === "mensagem") return "bg-green-500";
  return "bg-zinc-400";
}

function describe(e: Ev) {
  switch (e.kind) {
    case "status":
      return (
        <>
          <b>Etapa: {STATUS_META[e.title as OsStatus]?.label}</b>
          {e.extra && <span className="text-zinc-500"> (antes: {STATUS_META[e.extra as OsStatus]?.label})</span>}
          {e.body && <div className="text-zinc-700">“{e.body}”</div>}
        </>
      );
    case "nota":
      return <span className="whitespace-pre-wrap">📝 {e.body}</span>;
    case "sistema":
      return <span className="text-zinc-600">{e.body}</span>;
    case "decisao":
      return (
        <>
          <b>{e.title === "aprovado" ? "Cliente aprovou" : "Cliente recusou"}</b>: {e.body}{" "}
          <span className="text-zinc-500">({APPROVAL_METHOD[e.extra as keyof typeof APPROVAL_METHOD] ?? e.extra})</span>
        </>
      );
    case "execucao":
      return (
        <>
          <b>{EXECUTION[e.title as keyof typeof EXECUTION]}</b>: {e.body}
          {e.extra && <span className="text-zinc-600"> — {e.extra}</span>}
        </>
      );
    case "midia":
      return (
        <a href={`/api/media/${e.extra}`} target="_blank" rel="noopener" className="underline">
          {e.title === "video" ? "🎥 Vídeo" : "📷 Foto"} adicionada{e.body ? `: ${e.body}` : ""}
        </a>
      );
    case "mensagem":
      return (
        <>
          💬 Mensagem ao cliente ({MESSAGE_STATUS[e.title as keyof typeof MESSAGE_STATUS]?.label}): <span className="text-zinc-600">{e.body}</span>
        </>
      );
    default:
      return e.body;
  }
}
