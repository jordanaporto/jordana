import Link from "next/link";
import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { formatPhone } from "@/lib/format";
import { Alert, Card, SectionTitle } from "@/components/ui";
import { MessageList, type Msg } from "@/components/message-list";
import { MessageComposer } from "./composer";

export default async function OrderMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order } = await getOrderContext(id);
  if (!can.readAll(user.role)) return <Alert>Sem acesso às mensagens.</Alert>;
  const { messages, templates } = await asUser(user.id, async (sql) => ({
    messages: (await sql`
      select m.*, p.full_name as sent_by_name from outbound_messages m left join profiles p on p.id = m.sent_by
       where m.service_order_id = ${id} order by m.created_at desc`) as unknown as Msg[],
    templates: await sql`select id, name from message_templates where active order by name`,
  }));

  return (
    <div>
      <Card className="mb-4">
        <div className="text-sm text-zinc-600">WhatsApp do cliente</div>
        <div className="text-lg font-bold">{formatPhone(order.customer_whatsapp ?? order.customer_phone)}</div>
        {!order.customer_whatsapp_opt_in && (
          <div className="mt-2">
            <Alert kind="warning">
              Cliente não autorizou mensagens. <Link href={`/clientes/${order.customer_id}`} className="underline">Registrar autorização</Link>
            </Alert>
          </div>
        )}
      </Card>
      {can.staff(user.role) && order.customer_whatsapp_opt_in && (
        <>
          <SectionTitle>Enviar mensagem</SectionTitle>
          <Card className="mb-4">
            <MessageComposer orderId={id} templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
          </Card>
        </>
      )}
      <SectionTitle>Mensagens desta OS</SectionTitle>
      <MessageList messages={messages} canAct={can.staff(user.role)} />
    </div>
  );
}
