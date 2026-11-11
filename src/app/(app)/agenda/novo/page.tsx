import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { belemDay, formatPhone, normalizePlate } from "@/lib/format";
import { Card, Empty, LinkButton, PageHeader, Plate } from "@/components/ui";
import { AppointmentForm } from "../appointment-form";

export const metadata = { title: "Agendar" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ q?: string; veiculo?: string; cliente?: string; dia?: string }> }) {
  const user = await requireUser(STAFF);
  const sp = await searchParams;
  const day = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia >= belemDay() ? sp.dia : belemDay();

  // ---------------------------------------------------------------- formulário (veículo ou cliente escolhido)
  if (sp.veiculo || sp.cliente) {
    const id = (sp.veiculo ?? sp.cliente)!;
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const data = await asUser(user.id, async (sql) => {
      const [c] = sp.veiculo
        ? await sql`select c.id, c.name, c.whatsapp, c.whatsapp_opt_in from vehicles v join customers c on c.id = v.customer_id where v.id = ${id}`
        : await sql`select id, name, whatsapp, whatsapp_opt_in from customers where id = ${id}`;
      if (!c) return null;
      const vehicles = await sql`select id, plate, brand, model, year from vehicles where customer_id = ${c.id} order by created_at`;
      return { c, vehicles };
    });
    if (!data) notFound();
    const { c, vehicles } = data;
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Agendar horário" subtitle={`${c.name} · ${formatPhone(c.whatsapp)}`} back="/agenda/novo" />
        <Card>
          <AppointmentForm
            values={{ customer_id: c.id, vehicle_id: sp.veiculo ?? vehicles[0]?.id ?? null, date: day, time: "08:00", duration: 60 }}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.brand} ${v.model} ${v.year ?? ""}` }))}
            optIn={c.whatsapp_opt_in}
            submitLabel="Agendar e avisar o cliente"
          />
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------- buscar cliente/veículo
  const q = (sp.q ?? "").trim().slice(0, 80);
  const plate = normalizePlate(q);
  const digits = q.replace(/\D/g, "");
  const results = q
    ? await asUser(user.id, (sql) => sql`
        select v.id, v.plate, v.brand, v.model, v.year, c.name, c.whatsapp
          from vehicles v join customers c on c.id = v.customer_id
         where c.anonymized_at is null
           and ((${plate.length >= 3} and v.plate like ${plate + "%"})
                or (${digits.length >= 8} and (c.whatsapp like ${"%" + digits} or c.phone like ${"%" + digits}))
                or lower(c.name) like ${"%" + q.toLowerCase() + "%"})
         order by v.updated_at desc limit 20`)
    : [];

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Agendar horário" subtitle="Encontre o veículo pela placa ou o cliente pelo telefone/nome" back="/agenda" />
      <form className="mb-4 flex gap-2">
        <input type="hidden" name="dia" value={day} />
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
              <LinkButton href={`/agenda/novo?veiculo=${r.id}&dia=${day}`} size="sm">
                Agendar →
              </LinkButton>
            </Card>
          ))}
          {results.length === 0 && <Empty title="Nada encontrado">Cadastre o cliente e o veículo.</Empty>}
          <LinkButton href={`/clientes/novo?next=agenda${digits.length >= 8 ? `&tel=${digits}` : ""}`} variant="dark" className="w-full">
            + Cliente novo
          </LinkButton>
        </div>
      )}
    </div>
  );
}
