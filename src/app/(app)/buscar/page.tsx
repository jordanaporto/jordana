import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { normalizePlate } from "@/lib/format";
import { Card, Empty, PageHeader, Plate } from "@/components/ui";

export const metadata = { title: "Buscar veículo" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = normalizePlate((await searchParams).q ?? "").slice(0, 7);
  const rows = q.length >= 2
    ? await asUser(user.id, (sql) => sql`
        select id, plate, brand, model, year from vehicles where plate like ${"%" + q + "%"} order by plate limit 30`)
    : [];
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Buscar veículo" subtitle="Digite a placa (ou parte dela)" />
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          autoCapitalize="characters"
          placeholder="ABC1D23"
          className="plate tap w-full rounded-xl border-2 border-zinc-300 bg-white px-4 text-2xl font-bold uppercase outline-none focus:border-ink"
        />
      </form>
      {q.length >= 2 && rows.length === 0 && <Empty title="Nenhum veículo encontrado" />}
      <div className="space-y-2">
        {rows.map((v) => (
          <Link key={v.id} href={`/veiculos/${v.id}`}>
            <Card className="flex items-center gap-3 hover:border-zinc-400">
              <Plate plate={v.plate} />
              <div className="font-semibold">
                {v.brand} {v.model} {v.year ?? ""}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
