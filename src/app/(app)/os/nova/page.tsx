import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { formatPhone, km, normalizePlate, osNumber } from "@/lib/format";
import { Alert, Card, Empty, LinkButton, PageHeader, Plate } from "@/components/ui";
import { OpenOrderForm } from "./open-order-form";

export const metadata = { title: "Nova OS" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ q?: string; veiculo?: string }> }) {
  const user = await requireUser(STAFF);
  const sp = await searchParams;

  // ---------------------------------------------------------------- passo 4: dados de entrada
  if (sp.veiculo) {
    if (!/^[0-9a-f-]{36}$/.test(sp.veiculo)) notFound();
    const data = await asUser(user.id, async (sql) => {
      const [v] = await sql`
        select v.*, c.name as customer_name, c.whatsapp, c.whatsapp_opt_in, c.anonymized_at
          from vehicles v join customers c on c.id = v.customer_id where v.id = ${sp.veiculo!}`;
      if (!v) return null;
      const [open] = await sql`select id, number from service_orders where vehicle_id = ${v.id} and status not in ('entregue', 'cancelada')`;
      const mechanics = await sql`select id, full_name from profiles where role = 'mecanico' and active order by full_name`;
      const [last] = await sql`select entry_at, entry_km, complaint from service_orders where vehicle_id = ${v.id} order by entry_at desc limit 1`;
      return { v, open, mechanics, last };
    });
    if (!data) notFound();
    const { v, open, mechanics, last } = data;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Nova OS" subtitle="Passo 4 de 4 — dados de entrada" back="/os/nova" />
        <Card className="mb-4 flex items-center gap-4">
          <Plate plate={v.plate} size="lg" />
          <div className="min-w-0">
            <div className="text-lg font-bold">
              {v.brand} {v.model} {v.year ?? ""}
            </div>
            <div className="text-zinc-600">{v.customer_name}</div>
            <div className="text-sm text-zinc-500">Última km registrada: {km(v.current_km)}</div>
          </div>
        </Card>
        {open ? (
          <Alert kind="warning">
            Este veículo já tem a <Link href={`/os/${open.id}`} className="underline">{osNumber(open.number)}</Link> aberta.
          </Alert>
        ) : v.anonymized_at ? (
          <Alert>Cliente anonimizado — cadastre um novo proprietário para este veículo.</Alert>
        ) : (
          <>
            {!v.whatsapp_opt_in && (
              <div className="mb-4">
                <Alert kind="info">
                  O cliente ainda não autorizou mensagens pelo WhatsApp.{" "}
                  <Link href={`/clientes/${v.customer_id}`} className="underline">Registrar autorização</Link>
                </Alert>
              </div>
            )}
            {last && (
              <p className="mb-3 text-sm text-zinc-600">
                Último atendimento: {new Date(last.entry_at).toLocaleDateString("pt-BR")} · {km(last.entry_km)} · {last.complaint}
              </p>
            )}
            <Card>
              <OpenOrderForm
                customerId={v.customer_id}
                vehicleId={v.id}
                currentKm={v.current_km}
                mechanics={mechanics.map((m) => ({ id: m.id, name: m.full_name }))}
              />
            </Card>
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- passo 1: buscar
  const q = (sp.q ?? "").trim().slice(0, 80);
  const plate = normalizePlate(q);
  const digits = q.replace(/\D/g, "");
  const results = q
    ? await asUser(user.id, (sql) => sql`
        select v.id, v.plate, v.brand, v.model, v.year, c.id as customer_id, c.name, c.whatsapp,
               (select so.id from service_orders so where so.vehicle_id = v.id and so.status not in ('entregue','cancelada')) as open_order
          from vehicles v join customers c on c.id = v.customer_id
         where (${plate.length >= 3} and v.plate like ${plate + "%"})
            or (${digits.length >= 8} and (c.whatsapp like ${"%" + digits} or c.phone like ${"%" + digits}))
            or lower(c.name) like ${"%" + q.toLowerCase() + "%"}
         order by v.updated_at desc limit 20`)
    : [];
  const customersNoMatch = q && digits.length >= 8
    ? await asUser(user.id, (sql) => sql`
        select id, name from customers c where (c.whatsapp like ${"%" + digits} or c.phone like ${"%" + digits}) and anonymized_at is null limit 5`)
    : [];

  const newCustomerHref = `/clientes/novo?next=os${digits.length >= 8 ? `&tel=${digits}` : !plate || plate.length < 7 ? `&nome=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova OS" subtitle="Passo 1 — encontre o veículo pela placa ou o cliente pelo telefone" />
      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Placa, telefone ou nome"
          className="tap min-w-0 flex-1 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg outline-none focus:border-ink"
        />
        <button className="tap rounded-xl bg-ink px-5 font-semibold text-white">Buscar</button>
      </form>

      {q && (
        <div className="space-y-2">
          {results.map((r) => (
            <Card key={r.id} className="flex items-center gap-3">
              <Plate plate={r.plate} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {r.brand} {r.model} {r.year ?? ""}
                </div>
                <div className="truncate text-sm text-zinc-600">
                  {r.name} · {formatPhone(r.whatsapp)}
                </div>
              </div>
              {r.open_order ? (
                <LinkButton href={`/os/${r.open_order}`} variant="outline" size="sm">
                  OS aberta
                </LinkButton>
              ) : (
                <LinkButton href={`/os/nova?veiculo=${r.id}`} size="sm">
                  Usar →
                </LinkButton>
              )}
            </Card>
          ))}
          {results.length === 0 && <Empty title="Nada encontrado">Cadastre o cliente e o veículo abaixo.</Empty>}

          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            {customersNoMatch.map((c) => (
              <LinkButton key={c.id} href={`/veiculos/novo?cliente=${c.id}&next=os${plate.length === 7 ? `&placa=${plate}` : ""}`} variant="outline">
                + Veículo para {c.name.split(" ")[0]}
              </LinkButton>
            ))}
            <LinkButton href={newCustomerHref} variant="dark">
              + Cliente novo
            </LinkButton>
          </div>
          {results.length > 0 && (
            <p className="pt-2 text-sm text-zinc-600">
              Cliente já cadastrado com outro carro? Abra o cliente em{" "}
              <Link href="/clientes" className="underline">Clientes</Link> e use “+ Veículo”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
