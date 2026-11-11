import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { belemDay, formatPhone, time } from "@/lib/format";
import { Alert, Card, PageHeader } from "@/components/ui";
import { AppointmentForm } from "../../appointment-form";

export const metadata = { title: "Reagendar" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await asUser(user.id, async (sql) => {
    const [a] = await sql`
      select a.*, c.name, c.whatsapp, c.whatsapp_opt_in from appointments a join customers c on c.id = a.customer_id where a.id = ${id}`;
    if (!a) return null;
    const vehicles = await sql`select id, plate, brand, model, year from vehicles where customer_id = ${a.customer_id} order by created_at`;
    return { a, vehicles };
  });
  if (!data) notFound();
  const { a, vehicles } = data;
  const editable = a.status === "agendado" || a.status === "confirmado";
  const day = belemDay(new Date(a.scheduled_at));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Reagendar" subtitle={`${a.name} · ${formatPhone(a.whatsapp)}`} back={`/agenda?dia=${day}`} />
      {!editable ? (
        <Alert>Este agendamento já foi encerrado e não pode ser alterado.</Alert>
      ) : (
        <Card>
          <AppointmentForm
            values={{
              appointment_id: a.id,
              customer_id: a.customer_id,
              vehicle_id: a.vehicle_id,
              date: day,
              time: time(a.scheduled_at),
              duration: a.duration_minutes,
              service: a.service,
              notes: a.notes,
            }}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${v.brand} ${v.model} ${v.year ?? ""}` }))}
            optIn={a.whatsapp_opt_in}
            submitLabel="Salvar novo horário"
          />
          <p className="mt-3 text-sm text-zinc-600">Se mudar a data ou o serviço, o cliente recebe uma nova confirmação e os lembretes são refeitos.</p>
        </Card>
      )}
    </div>
  );
}
