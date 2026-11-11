import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, READ_ALL } from "@/lib/roles";
import { addDays, belemDay, dayMonth, formatPhone, osNumber, time, weekdayName } from "@/lib/format";
import { APPT_STATUS } from "@/lib/status";
import { Alert, Badge, Empty, LinkButton, PageHeader, Plate, cx } from "@/components/ui";
import { AppointmentActions } from "./appointment-actions";

export const metadata = { title: "Agenda" };

const MSG_LABEL: Record<string, string> = {
  agendamento_confirmacao: "Confirmação",
  agendamento_lembrete_1d: "Lembrete 1 dia",
  agendamento_lembrete_2h: "Lembrete 2 h",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ dia?: string; ok?: string }> }) {
  const user = await requireUser(READ_ALL);
  const sp = await searchParams;
  const today = belemDay();
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : today;
  // semana de segunda a domingo contendo o dia escolhido
  const dow = new Date(`${day}T12:00:00-03:00`).getUTCDay();
  const monday = addDays(day, dow === 0 ? -6 : 1 - dow);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const { items, counts, mechanics, messages } = await asUser(user.id, async (sql) => {
    const items = await sql`
      select a.*, c.name as customer_name, c.whatsapp, c.whatsapp_opt_in, v.plate, v.brand, v.model, v.year,
             so.number as order_number, p.full_name as created_by_name
        from appointments a
        join customers c on c.id = a.customer_id
        left join vehicles v on v.id = a.vehicle_id
        left join service_orders so on so.id = a.service_order_id
        left join profiles p on p.id = a.created_by
       where a.scheduled_at >= (${day}::date::timestamp at time zone 'America/Belem')
         and a.scheduled_at < ((${day}::date + 1)::timestamp at time zone 'America/Belem')
       order by a.scheduled_at`;
    const counts = await sql`
      select to_char(a.scheduled_at at time zone 'America/Belem', 'YYYY-MM-DD') as d, count(*)::int as n
        from appointments a
       where a.status in ('agendado', 'confirmado', 'compareceu')
         and a.scheduled_at >= (${monday}::date::timestamp at time zone 'America/Belem')
         and a.scheduled_at < ((${monday}::date + 7)::timestamp at time zone 'America/Belem')
       group by 1`;
    const ids = items.map((i) => i.id as string);
    const messages = ids.length
      ? await sql`select appointment_id, trigger_event, status, send_after from outbound_messages
                   where appointment_id = any(${ids}) and status <> 'cancelada' order by send_after`
      : [];
    const mechanics = await sql`select id, full_name from profiles where role = 'mecanico' and active order by full_name`;
    return { items, counts, mechanics, messages };
  });
  const countOf = (d: string) => counts.find((c) => c.d === d)?.n ?? 0;
  const staff = can.staff(user.role);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Agenda" action={staff ? <LinkButton href={`/agenda/novo?dia=${day}`}>+ Agendar</LinkButton> : undefined} />
      {sp.ok && (
        <div className="mb-3">
          <Alert kind="success">
            {sp.ok === "reagendado" ? "Horário alterado." : "Horário agendado."} A confirmação foi para a fila do WhatsApp e os lembretes
            (1 dia e 2 horas antes) foram programados.
          </Alert>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Link href={`/agenda?dia=${addDays(day, -7)}`} aria-label="Semana anterior" className="flex size-11 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {week.map((d) => (
            <Link
              key={d}
              href={`/agenda?dia=${d}`}
              className={cx(
                "flex flex-col items-center rounded-xl border-2 py-1.5 text-xs font-semibold",
                d === day ? "border-ink bg-ink text-white" : d === today ? "border-brand bg-white" : "border-zinc-200 bg-white",
              )}
            >
              <span className="uppercase opacity-70">{weekdayName(d, true).slice(0, 3)}</span>
              <span className="text-base leading-tight">{d.slice(8)}</span>
              <span className={cx("mt-0.5 h-1.5 w-1.5 rounded-full", countOf(d) ? (d === day ? "bg-white" : "bg-brand") : "bg-transparent")} />
            </Link>
          ))}
        </div>
        <Link href={`/agenda?dia=${addDays(day, 7)}`} aria-label="Próxima semana" className="flex size-11 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">
          {weekdayName(day)}, {dayMonth(day)}
        </h2>
        {day !== today && (
          <Link href="/agenda" className="text-sm font-semibold text-brand">
            Ir para hoje
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <Empty title="Nenhum horário neste dia">{staff && <LinkButton href={`/agenda/novo?dia=${day}`} className="mt-3">Agendar um cliente</LinkButton>}</Empty>
      ) : (
        <ol className="space-y-3">
          {items.map((a) => {
            const st = APPT_STATUS[a.status as keyof typeof APPT_STATUS];
            const ms = messages.filter((m) => m.appointment_id === a.id);
            const open = a.status === "agendado" || a.status === "confirmado";
            return (
              <li key={a.id} className={cx("rounded-2xl border-2 bg-white p-4 shadow-sm", open ? "border-zinc-200" : "border-zinc-100 opacity-80")}>
                <div className="flex items-start gap-4">
                  <div className="w-16 shrink-0 text-center">
                    <div className="text-2xl font-bold tabular-nums">{time(a.scheduled_at)}</div>
                    <div className="text-xs text-zinc-500">{a.duration_minutes} min</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={st.cls}>{st.label}</Badge>
                      {a.plate && <Plate plate={a.plate} size="sm" />}
                    </div>
                    <div className="mt-1 text-lg font-bold leading-tight">{a.service}</div>
                    <div className="text-sm text-zinc-700">
                      {a.customer_name}
                      {a.model && ` · ${a.brand} ${a.model}`}
                    </div>
                    <div className="text-sm text-zinc-500">{formatPhone(a.whatsapp)}</div>
                    {a.notes && <p className="mt-1 text-sm text-zinc-600">{a.notes}</p>}
                    {a.cancelled_reason && <p className="mt-1 text-sm text-zinc-600">Motivo: {a.cancelled_reason}</p>}
                    {a.service_order_id && (
                      <Link href={`/os/${a.service_order_id}`} className="mt-1 inline-block text-sm font-semibold text-brand underline">
                        Abrir {osNumber(a.order_number)}
                      </Link>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {!a.whatsapp_opt_in ? (
                        <span className="text-amber-800">Sem autorização de WhatsApp: lembretes não serão enviados</span>
                      ) : (
                        ms.map((m, i) => (
                          <span
                            key={i}
                            className={cx(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                              ["enviada", "entregue", "lida"].includes(m.status) ? "bg-green-50 text-green-800" : "bg-zinc-100 text-zinc-600",
                            )}
                          >
                            <MessageCircle className="size-3" aria-hidden />
                            {MSG_LABEL[m.trigger_event] ?? "Mensagem"}:{" "}
                            {["enviada", "entregue", "lida"].includes(m.status)
                              ? "enviada"
                              : new Date(m.send_after) > new Date()
                                ? `${dayMonth(belemDay(new Date(m.send_after)))} ${time(m.send_after)}`
                                : "pendente"}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                {staff && open && (
                  <AppointmentActions
                    appointment={{ id: a.id, status: a.status, service: a.service, hasVehicle: Boolean(a.vehicle_id), customerId: a.customer_id }}
                    mechanics={mechanics.map((m) => ({ id: m.id, name: m.full_name }))}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
