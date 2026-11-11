"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { belemDay } from "@/lib/format";
import { processNotifications } from "@/lib/push";
import { STAFF } from "@/lib/roles";
import { appointmentSchema } from "@/lib/validation";

export async function saveAppointmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(appointmentSchema, fd, async (d) => {
    if (d.appointment_id) {
      await asUser(user.id, (sql) => sql`
        select app.update_appointment(${d.appointment_id}, ${d.vehicle_id}, ${d.at}, ${d.duration}, ${d.service}, ${d.notes})`);
    } else {
      if (!d.customer_id) return { ok: false, error: "Escolha o cliente" };
      await asUser(user.id, (sql) => sql`
        select app.create_appointment(${d.customer_id}, ${d.vehicle_id}, ${d.at}, ${d.duration}, ${d.service}, ${d.notes})`);
    }
    revalidatePath("/agenda");
    redirect(`/agenda?dia=${belemDay(d.at)}&ok=${d.appointment_id ? "reagendado" : "agendado"}`);
  });
}

const statusSchema = z.object({
  appointment_id: z.uuid(),
  status: z.enum(["confirmado", "faltou", "cancelado"]),
  reason: z.string().trim().max(500).optional(),
});

export async function setAppointmentStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(statusSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.set_appointment_status(${d.appointment_id}, ${d.status}::appointment_status, ${d.reason ?? null})`);
    revalidatePath("/agenda");
    return { ok: true };
  });
}

const convertSchema = z.object({
  appointment_id: z.uuid(),
  entry_km: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v !== "", "Informe a quilometragem")
    .transform(Number)
    .pipe(z.number().int().min(0).max(3_000_000)),
  mechanic_id: z.string().optional().transform((v) => v || null).pipe(z.uuid().nullable()),
  complaint: z.string().trim().max(4000).optional(),
});

export async function convertAppointmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(convertSchema, fd, async (d) => {
    const [r] = await asUser(user.id, (sql) => sql`
      select app.convert_appointment(${d.appointment_id}, ${d.entry_km}, ${d.mechanic_id}, ${d.complaint ?? null}) as id`);
    after(() => processNotifications().catch(() => {}));
    redirect(`/os/${r.id}`);
  });
}
