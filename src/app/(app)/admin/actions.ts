"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { alertSettingsSchema, companySchema, templateSchema } from "@/lib/validation";

// ------------------------------------------------------------------ checklist
const categorySchema = z.object({
  category_id: z.string().optional().transform((v) => v || null).pipe(z.uuid().nullable()),
  name: z.string().trim().min(2, "Informe o nome").max(80),
  position: z.string().optional().transform((v) => Number(v || 0)).pipe(z.number().int().min(0).max(999)),
  active: z.string().optional().transform((v) => v === "on"),
});

export async function saveCategoryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(categorySchema, fd, async (d) => {
    await asUser(user.id, (sql) =>
      d.category_id
        ? sql`update checklist_categories set name = ${d.name}, position = ${d.position}, active = ${d.active} where id = ${d.category_id}`
        : sql`insert into checklist_categories (name, position, active) values (${d.name}, ${d.position}, true)`,
    );
    revalidatePath("/admin/checklist");
    return { ok: true, message: d.category_id ? "Categoria salva" : "Categoria criada" };
  });
}

const itemSchema = z.object({
  item_id: z.string().optional().transform((v) => v || null).pipe(z.uuid().nullable()),
  category_id: z.uuid(),
  name: z.string().trim().min(2, "Informe o nome").max(120),
  position: z.string().optional().transform((v) => Number(v || 0)).pipe(z.number().int().min(0).max(999)),
  active: z.string().optional().transform((v) => v === "on"),
});

export async function saveItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(itemSchema, fd, async (d) => {
    await asUser(user.id, (sql) =>
      d.item_id
        ? sql`update checklist_items set name = ${d.name}, position = ${d.position}, active = ${d.active}, category_id = ${d.category_id} where id = ${d.item_id}`
        : sql`insert into checklist_items (category_id, name, position, active) values (${d.category_id}, ${d.name}, ${d.position}, true)`,
    );
    revalidatePath("/admin/checklist");
    return { ok: true, message: d.item_id ? "Item salvo" : "Item criado — aparece nas próximas OS" };
  });
}

// ------------------------------------------------------------------ modelos de mensagem
export async function saveTemplateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(templateSchema, fd, async (d) => {
    await asUser(user.id, (sql) =>
      d.template_id
        ? sql`update message_templates set name = ${d.name}, trigger_status = ${d.trigger_status}, body = ${d.body},
                     meta_template_name = ${d.meta_template_name}, meta_variables = ${d.meta_variables}, active = ${d.active}
               where id = ${d.template_id}`
        : sql`insert into message_templates (name, trigger_status, body, meta_template_name, meta_variables, active)
              values (${d.name}, ${d.trigger_status}, ${d.body}, ${d.meta_template_name}, ${d.meta_variables}, ${d.active})`,
    );
    revalidatePath("/admin/mensagens");
    return { ok: true, message: "Modelo salvo" };
  });
}

// ------------------------------------------------------------------ configurações
export async function saveAlertSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(alertSettingsSchema, fd, async (d) => {
    await asUser(user.id, async (sql) => {
      for (const [k, v] of Object.entries(d)) {
        await sql`insert into settings (key, value) values (${"alert." + k}, ${sql.json(v)})
                  on conflict (key) do update set value = excluded.value`;
      }
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Limites dos alertas salvos" };
  });
}

export async function saveCompanyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(companySchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`
      insert into settings (key, value) values ('company', ${sql.json(d)})
      on conflict (key) do update set value = excluded.value`);
    revalidatePath("/admin/empresa");
    return { ok: true, message: "Dados da empresa salvos" };
  });
}

const providerSchema = z.object({ provider: z.enum(["manual", "cloud_api"]) });

export async function saveProviderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  return runForm(providerSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`
      insert into settings (key, value) values ('messaging.provider', ${sql.json(d.provider)})
      on conflict (key) do update set value = excluded.value`);
    revalidatePath("/", "layout");
    return { ok: true, message: d.provider === "cloud_api" ? "Envio automático pela API oficial ativado" : "Envio manual ativado" };
  });
}

// ------------------------------------------------------------------ LGPD
export async function anonymizeCustomerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  const schema = z.object({ customer_id: z.uuid(), confirm: z.literal("ANONIMIZAR", { error: "Digite ANONIMIZAR para confirmar" }) });
  return runForm(schema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.anonymize_customer(${d.customer_id})`);
    revalidatePath("/admin/lgpd");
    return { ok: true, message: "Dados pessoais removidos. O histórico técnico do veículo foi mantido." };
  });
}
