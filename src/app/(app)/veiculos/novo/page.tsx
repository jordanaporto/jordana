import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { VehicleForm } from "@/components/entity-forms";
import { Card, PageHeader } from "@/components/ui";
import { createVehicleAction } from "../../clientes/actions";

export const metadata = { title: "Novo veículo" };

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ cliente?: string; next?: string; placa?: string }> }) {
  const user = await requireUser(STAFF);
  const sp = await searchParams;
  if (!sp.cliente || !/^[0-9a-f-]{36}$/.test(sp.cliente)) notFound();
  const [c] = await asUser(user.id, (sql) => sql`select id, name from customers where id = ${sp.cliente!}`);
  if (!c) notFound();
  const isOs = sp.next === "os";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Novo veículo"
        subtitle={c.name}
        back={`/clientes/${c.id}`}
      />
      <Card>
        <VehicleForm
          action={createVehicleAction}
          values={{ customer_id: c.id, plate: sp.placa }}
          next={sp.next}
          submitLabel={isOs ? "Salvar e abrir OS →" : sp.next === "agenda" ? "Salvar e agendar →" : "Salvar veículo"}
        />
      </Card>
    </div>
  );
}
