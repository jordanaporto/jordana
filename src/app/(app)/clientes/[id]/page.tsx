import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, READ_ALL } from "@/lib/roles";
import { dateTime, formatCpf, formatPhone, km } from "@/lib/format";
import { Alert, Badge, Card, DefinitionList, LinkButton, PageHeader, Plate, SectionTitle } from "@/components/ui";
import { CustomerForm } from "@/components/entity-forms";
import { OrderLine } from "@/components/order-card";
import { updateCustomerAction } from "../actions";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(READ_ALL);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const data = await asUser(user.id, async (sql) => {
    const [c] = await sql`
      select c.*, p.full_name as opt_in_by_name from customers c
        left join profiles p on p.id = c.whatsapp_opt_in_by where c.id = ${id}`;
    if (!c) return null;
    const vehicles = await sql`select * from vehicles where customer_id = ${id} order by created_at`;
    const orders = await sql`select id, number, status, entry_at, entry_km, complaint, plate, model from v_orders where customer_id = ${id} order by entry_at desc`;
    return { c, vehicles, orders };
  });
  if (!data) notFound();
  const { c, vehicles, orders } = data;
  const staff = can.staff(user.role);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={c.name} back="/clientes" />
      {c.anonymized_at && <Alert kind="info">Cliente anonimizado em {dateTime(c.anonymized_at)} (LGPD).</Alert>}

      <Card>
        <DefinitionList
          items={[
            ["WhatsApp", formatPhone(c.whatsapp)],
            ["Telefone", formatPhone(c.phone)],
            ["CPF", formatCpf(c.cpf)],
            [
              "Atualizações pelo WhatsApp",
              c.whatsapp_opt_in ? (
                <span>
                  <Badge className="bg-green-100 text-green-900">Autorizado</Badge>{" "}
                  <span className="text-sm text-zinc-600">
                    {dateTime(c.whatsapp_opt_in_at)} por {c.opt_in_by_name ?? "—"}
                  </span>
                </span>
              ) : (
                <Badge className="bg-zinc-200 text-zinc-700">Não autorizado</Badge>
              ),
            ],
            ["Observações", c.notes],
          ]}
        />
      </Card>

      {staff && !c.anonymized_at && (
        <details className="mt-3 rounded-2xl border border-zinc-200 bg-white">
          <summary className="cursor-pointer p-4 font-semibold text-brand">Editar dados do cliente</summary>
          <div className="border-t border-zinc-100 p-4">
            <CustomerForm action={updateCustomerAction} values={c as never} />
          </div>
        </details>
      )}

      {staff && !c.anonymized_at && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <LinkButton href={`/agenda/novo?cliente=${c.id}`} variant="outline">Agendar horário</LinkButton>
          <LinkButton href={`/veiculos/novo?cliente=${c.id}`} variant="outline">+ Veículo</LinkButton>
        </div>
      )}

      <SectionTitle>
        Veículos
      </SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {vehicles.map((v) => (
          <Link key={v.id} href={`/veiculos/${v.id}`}>
            <Card className="flex items-center gap-3 hover:border-zinc-400">
              <Plate plate={v.plate} />
              <div className="min-w-0">
                <div className="font-semibold">
                  {v.brand} {v.model} {v.year ?? ""}
                </div>
                <div className="text-sm text-zinc-600">{km(v.current_km)}</div>
              </div>
            </Card>
          </Link>
        ))}
        {vehicles.length === 0 && <p className="text-zinc-600">Nenhum veículo cadastrado.</p>}
      </div>

      <SectionTitle>Atendimentos</SectionTitle>
      <div className="space-y-2">
        {orders.map((o) => (
          <OrderLine key={o.id} o={o as never} />
        ))}
        {orders.length === 0 && <p className="text-zinc-600">Nenhum atendimento ainda.</p>}
      </div>
    </div>
  );
}
