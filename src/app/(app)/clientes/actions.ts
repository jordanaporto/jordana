"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import { customerSchema, vehicleSchema } from "@/lib/validation";

export async function createCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const next = String(fd.get("next") ?? "");
  return runForm(customerSchema, fd, async (d) => {
    const [c] = await asUser(user.id, (sql) => sql`
      insert into customers (name, phone, whatsapp, cpf, notes, whatsapp_opt_in)
      values (${d.name}, ${d.phone}, ${d.whatsapp ?? d.phone}, ${d.cpf}, ${d.notes}, ${d.whatsapp_opt_in})
      returning id`);
    redirect(next === "os" || next === "agenda" ? `/veiculos/novo?cliente=${c.id}&next=${next}` : `/clientes/${c.id}`);
  });
}

export async function updateCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const id = z.uuid().parse(fd.get("customer_id"));
  return runForm(customerSchema, fd, async (d) => {
    const rows = await asUser(user.id, (sql) => sql`
      update customers set name = ${d.name}, phone = ${d.phone}, whatsapp = ${d.whatsapp ?? d.phone}, cpf = ${d.cpf},
             notes = ${d.notes}, whatsapp_opt_in = ${d.whatsapp_opt_in}
       where id = ${id} returning id`);
    if (!rows.length) return { ok: false, error: "Cliente não encontrado ou anonimizado" };
    revalidatePath(`/clientes/${id}`);
    return { ok: true, message: "Dados do cliente salvos" };
  });
}

export async function createVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const next = String(fd.get("next") ?? "");
  return runForm(vehicleSchema, fd, async (d) => {
    const [v] = await asUser(user.id, (sql) => sql`
      insert into vehicles (customer_id, plate, brand, model, version, year, engine, fuel, current_km, color, notes)
      values (${d.customer_id}, ${d.plate}, ${d.brand}, ${d.model}, ${d.version}, ${d.year}, ${d.engine}, ${d.fuel},
              ${d.current_km}, ${d.color}, ${d.notes})
      returning id`);
    redirect(next === "os" ? `/os/nova?veiculo=${v.id}` : next === "agenda" ? `/agenda/novo?veiculo=${v.id}` : `/veiculos/${v.id}`);
  });
}

export async function updateVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const id = z.uuid().parse(fd.get("vehicle_id"));
  return runForm(vehicleSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`
      update vehicles set customer_id = ${d.customer_id}, plate = ${d.plate}, brand = ${d.brand}, model = ${d.model},
             version = ${d.version}, year = ${d.year}, engine = ${d.engine}, fuel = ${d.fuel},
             current_km = ${d.current_km}, color = ${d.color}, notes = ${d.notes}
       where id = ${id}`);
    redirect(`/veiculos/${id}`);
  });
}
