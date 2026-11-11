import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, READ_ALL } from "@/lib/roles";
import { env } from "@/lib/env";
import { Alert, PageHeader, cx } from "@/components/ui";
import { MessageList, type Msg } from "@/components/message-list";

export const metadata = { title: "Mensagens" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireUser(READ_ALL);
  const aba = (await searchParams).aba;
  const tab = aba === "todas" || aba === "programadas" ? aba : "pendentes";
  const { messages, provider } = await asUser(user.id, async (sql) => ({
    messages: (await sql`
      select m.*, p.full_name as sent_by_name, so.number as order_number, so.id as order_id, coalesce(v.plate, av.plate) as plate,
             c.name as customer_name, a.scheduled_at as appointment_at
        from outbound_messages m
        left join profiles p on p.id = m.sent_by
        left join service_orders so on so.id = m.service_order_id
        left join vehicles v on v.id = so.vehicle_id
        left join appointments a on a.id = m.appointment_id
        left join vehicles av on av.id = a.vehicle_id
        left join customers c on c.id = m.customer_id
       where ${
         tab === "pendentes"
           ? sql`m.status in ('na_fila', 'falhou', 'enviando') and m.send_after <= now()`
           : tab === "programadas"
             ? sql`m.status = 'na_fila' and m.send_after > now()`
             : sql`true`
       }
       order by ${tab === "programadas" ? sql`m.send_after asc` : sql`m.created_at desc`} limit 100`) as unknown as Msg[],
    provider: (await sql`select value #>> '{}' as v from settings where key = 'messaging.provider'`)[0]?.v as string,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mensagens ao cliente" subtitle="WhatsApp: avisos de etapa, confirmações e lembretes da agenda" />
      {provider === "cloud_api" && !env.whatsapp.configured && (
        <div className="mb-4">
          <Alert kind="warning">A API oficial está selecionada, mas as credenciais da Meta ainda não foram configuradas no servidor.</Alert>
        </div>
      )}
      {provider !== "cloud_api" && (
        <div className="mb-4">
          <Alert kind="info">
            Modo manual oficial: toque em “Abrir no WhatsApp” (link oficial wa.me), envie e depois marque como enviada. Quando a API da
            Meta for aprovada, o envio passa a ser automático.
          </Alert>
        </div>
      )}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ["pendentes", "Enviar agora"],
          ["programadas", "Programadas"],
          ["todas", "Todas"],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/mensagens${k === "pendentes" ? "" : `?aba=${k}`}`}
            className={cx("tap flex items-center justify-center rounded-xl border-2 font-semibold", tab === k ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white")}
          >
            {l}
          </Link>
        ))}
      </div>
      <MessageList messages={messages} canAct={can.staff(user.role)} showOrder />
    </div>
  );
}
