"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError, runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { STAFF } from "@/lib/roles";
import {
  checklistUpdateSchema,
  decisionSchema,
  diagnosisSchema,
  executionSchema,
  noteSchema,
  openOrderSchema,
  serviceItemSchema,
  statusChangeSchema,
  updateOrderSchema,
} from "@/lib/validation";

const refresh = (orderId: string) => revalidatePath(`/os/${orderId}`, "layout");

// ------------------------------------------------------------------ abertura
export async function openOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(openOrderSchema, fd, async (d) => {
    const [r] = await asUser(user.id, (sql) => sql`
      select app.open_service_order(${d.customer_id}, ${d.vehicle_id}, ${d.entry_km}, ${d.mechanic_id},
                                    ${d.complaint}, ${d.intake_notes}) as id`);
    redirect(`/os/${r.id}`);
  });
}

export async function updateOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const orderId = z.uuid().parse(fd.get("order_id"));
  return runForm(updateOrderSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`
      select app.update_service_order(${orderId}, ${d.entry_km}, ${d.complaint}, ${d.intake_notes}, ${d.final_notes})`);
    refresh(orderId);
    return { ok: true, message: "Dados da OS atualizados" };
  });
}

const assignSchema = z.object({
  order_id: z.uuid(),
  mechanic_id: z.string().optional().transform((v) => v || null).pipe(z.uuid().nullable()),
});

export async function assignMechanicAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(assignSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.assign_mechanic(${d.order_id}, ${d.mechanic_id})`);
    refresh(d.order_id);
    return { ok: true, message: "Mecânico atualizado" };
  });
}

// ------------------------------------------------------------------ status
export async function changeStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return runForm(statusChangeSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`select app.change_status(${d.order_id}, ${d.to_status}::os_status, ${d.note})`);
    refresh(d.order_id);
    revalidatePath("/patio");
    revalidatePath("/meus-carros");
    return { ok: true, message: "Etapa atualizada" };
  });
}

// ------------------------------------------------------------------ observações
export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return runForm(noteSchema, fd, async (d) => {
    await asUser(user.id, (sql) => sql`insert into service_order_notes (service_order_id, body) values (${d.order_id}, ${d.body})`);
    refresh(d.order_id);
    return { ok: true, message: "Observação registrada" };
  });
}

// ------------------------------------------------------------------ checklist
/** Chamado direto pelos botões do checklist (sem formulário). */
export async function updateChecklistEntry(input: { entry_id: string; result?: string; note?: string }): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = checklistUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { entry_id, result, note } = parsed.data;
  try {
    const rows = await asUser(user.id, (sql) => sql`
      update service_order_checklist
         set result = coalesce(${result ?? null}::checklist_result, result),
             note = case when ${note === undefined} then note else nullif(trim(${note ?? ""}), '') end
       where id = ${entry_id}
       returning service_order_id`);
    if (!rows.length) return { ok: false, error: "Sem permissão para alterar esta OS" };
    refresh(rows[0].service_order_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

// ------------------------------------------------------------------ diagnóstico
export async function saveDiagnosisAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return runForm(diagnosisSchema, fd, async (d) => {
    await asUser(user.id, async (sql) => {
      const rows = await sql`
        update diagnoses set reported_symptom = ${d.reported_symptom}, tests_performed = ${d.tests_performed},
               results = ${d.results}, root_cause = ${d.root_cause}, components = ${d.components},
               recommendation = ${d.recommendation}, technical_notes = ${d.technical_notes}
         where service_order_id = ${d.order_id} returning id`;
      if (!rows.length) {
        await sql`
          insert into diagnoses (service_order_id, reported_symptom, tests_performed, results, root_cause, components,
                                 recommendation, technical_notes)
          values (${d.order_id}, ${d.reported_symptom}, ${d.tests_performed}, ${d.results}, ${d.root_cause},
                  ${d.components}, ${d.recommendation}, ${d.technical_notes})`;
      }
    });
    refresh(d.order_id);
    return { ok: true, message: "Diagnóstico salvo" };
  });
}

// ------------------------------------------------------------------ serviços
export async function saveServiceItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["mecanico", "atendimento", "admin"]);
  return runForm(serviceItemSchema, fd, async (d) => {
    await asUser(user.id, async (sql) => {
      if (d.item_id) {
        const rows = await sql`
          update service_items set title = ${d.title}, description = ${d.description}, part_name = ${d.part_name},
                 quantity = ${d.quantity}, priority = ${d.priority}
                 ${user.role === "mecanico" ? sql`` : sql`, part_unit_price_cents = ${d.part_unit_price}, labor_price_cents = ${d.labor_price}`}
           where id = ${d.item_id} and service_order_id = ${d.order_id} returning id`;
        if (!rows.length) throw Object.assign(new Error("Sem permissão"), { code: "42501" });
      } else {
        await sql`
          insert into service_items (service_order_id, title, description, part_name, quantity, part_unit_price_cents,
                                     labor_price_cents, priority)
          values (${d.order_id}, ${d.title}, ${d.description}, ${d.part_name}, ${d.quantity}, ${d.part_unit_price},
                  ${d.labor_price}, ${d.priority})`;
      }
    });
    refresh(d.order_id);
    return { ok: true, message: d.item_id ? "Serviço atualizado" : "Serviço adicionado" };
  });
}

export async function recordDecisionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(decisionSchema, fd, async (d) => {
    const [r] = await asUser(user.id, async (sql) => {
      await sql`select app.record_decision(${d.item_id}, ${d.decision}::approval_status, ${d.method}::approval_method, ${d.note})`;
      return sql`select service_order_id from service_items where id = ${d.item_id}`;
    });
    refresh(r.service_order_id);
    return { ok: true, message: d.decision === "aprovado" ? "Aprovação registrada" : "Recusa registrada" };
  });
}

export async function setExecutionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["mecanico", "atendimento", "admin"]);
  return runForm(executionSchema, fd, async (d) => {
    const [r] = await asUser(user.id, async (sql) => {
      await sql`select app.set_execution(${d.item_id}, ${d.status}::execution_status, ${d.notes})`;
      return sql`select service_order_id from service_items where id = ${d.item_id}`;
    });
    refresh(r.service_order_id);
    return { ok: true, message: "Execução registrada" };
  });
}

const removeSchema = z.object({ item_id: z.uuid(), reason: z.string().trim().min(2, "Informe o motivo").max(500) });

export async function removeServiceItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(removeSchema, fd, async (d) => {
    const [r] = await asUser(user.id, async (sql) => {
      await sql`select app.remove_service_item(${d.item_id}, ${d.reason})`;
      return sql`select service_order_id from service_items where id = ${d.item_id}`;
    });
    refresh(r.service_order_id);
    return { ok: true, message: "Serviço removido do orçamento" };
  });
}

// ------------------------------------------------------------------ mídia
const mediaUpdateSchema = z.object({
  media_id: z.uuid(),
  caption: z.string().max(500).optional(),
  include_in_report: z.boolean().optional(),
});

export async function updateMedia(input: z.input<typeof mediaUpdateSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const p = mediaUpdateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Dados inválidos" };
  try {
    const rows = await asUser(user.id, (sql) => sql`
      update media set caption = coalesce(${p.data.caption ?? null}, caption),
                       include_in_report = coalesce(${p.data.include_in_report ?? null}, include_in_report)
       where id = ${p.data.media_id} returning service_order_id`);
    if (!rows.length) return { ok: false, error: "Sem permissão" };
    refresh(rows[0].service_order_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

const deleteMediaSchema = z.object({ media_id: z.uuid(), reason: z.string().trim().min(2, "Informe o motivo").max(500) });

export async function deleteMediaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["admin"]);
  return runForm(deleteMediaSchema, fd, async (d) => {
    const [r] = await asUser(user.id, async (sql) => {
      await sql`select app.soft_delete_media(${d.media_id}, ${d.reason})`;
      return sql`select service_order_id from media where id = ${d.media_id}`;
    });
    refresh(r.service_order_id);
    return { ok: true, message: "Arquivo removido da galeria (mantido no histórico de auditoria)" };
  });
}
