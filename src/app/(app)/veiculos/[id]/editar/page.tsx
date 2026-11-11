import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { VehicleForm } from "@/components/entity-forms";
import { Card, PageHeader } from "@/components/ui";
import { updateVehicleAction } from "../../../clientes/actions";

export const metadata = { title: "Editar veículo" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await asUser(user.id, async (sql) => {
    const [v] = await sql`select * from vehicles where id = ${id}`;
    if (!v) return null;
    const customers = await sql`
      select id, name from customers where anonymized_at is null or id = ${v.customer_id} order by name limit 2000`;
    return { v, customers };
  });
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Editar veículo" back={`/veiculos/${id}`} />
      <Card>
        <VehicleForm
          action={updateVehicleAction}
          values={data.v as never}
          customers={data.customers as never}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  );
}
