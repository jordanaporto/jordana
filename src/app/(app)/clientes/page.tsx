import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, READ_ALL } from "@/lib/roles";
import { formatPhone, normalizePlate } from "@/lib/format";
import { Card, Empty, LinkButton, PageHeader, Plate } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(READ_ALL);
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const digits = q.replace(/\D/g, "");
  const plate = normalizePlate(q);

  const rows = await asUser(user.id, (sql) => sql`
    select c.id, c.name, c.whatsapp, c.phone, c.anonymized_at,
           coalesce(json_agg(json_build_object('id', v.id, 'plate', v.plate, 'model', v.model) order by v.created_at)
                    filter (where v.id is not null), '[]') as vehicles
      from customers c
      left join vehicles v on v.customer_id = c.id
     where ${q
       ? sql`(lower(c.name) like ${"%" + q.toLowerCase() + "%"}
              ${digits.length >= 4 ? sql`or c.whatsapp like ${"%" + digits + "%"} or c.phone like ${"%" + digits + "%"} or c.cpf = ${digits}` : sql``}
              ${plate.length >= 3 ? sql`or exists (select 1 from vehicles v2 where v2.customer_id = c.id and v2.plate like ${plate + "%"})` : sql``})`
       : sql`true`}
     group by c.id
     order by c.updated_at desc
     limit 50`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Clientes"
        action={can.staff(user.role) ? <LinkButton href="/clientes/novo">+ Novo</LinkButton> : undefined}
      />
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, telefone, CPF ou placa"
          className="tap w-full rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg outline-none focus:border-ink"
        />
      </form>
      {rows.length === 0 ? (
        <Empty title={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"} />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="block">
              <Card className="flex items-center justify-between gap-3 transition hover:border-zinc-400">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-sm text-zinc-600">{formatPhone(c.whatsapp ?? c.phone)}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {(c.vehicles as { id: string; plate: string }[]).slice(0, 3).map((v) => (
                    <Plate key={v.id} plate={v.plate} size="sm" />
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
