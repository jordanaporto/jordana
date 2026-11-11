import "server-only";
import type { z } from "zod";
import { fieldErrors, formToObject, type FieldErrors } from "./validation";

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
  redirectTo?: string;
};

export const initialState: ActionState = { ok: false };

const CONSTRAINT_MESSAGES: Record<string, string> = {
  vehicles_plate_key: "Esta placa já está cadastrada",
  customers_cpf_key: "Este CPF já está cadastrado para outro cliente",
  profiles_username_key: "Este nome de usuário já existe",
  service_orders_one_open_per_vehicle: "Este veículo já possui uma OS aberta",
  checklist_categories_name_key: "Já existe uma categoria com este nome",
  checklist_items_category_id_name_key: "Já existe um item com este nome nesta categoria",
  message_templates_trigger_status_key: "Já existe um modelo para esta etapa",
};

/** Converte erros do banco em mensagens claras para quem está usando. */
export function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string; constraint_name?: string };
  if (err?.code === "23505") {
    return CONSTRAINT_MESSAGES[err.constraint_name ?? ""] ?? "Registro duplicado";
  }
  if (err?.code === "42501" || /row-level security|permission denied/.test(err?.message ?? "")) {
    if (err?.code === "42501" && err.message && !/row-level|permission denied/.test(err.message)) return err.message;
    return "Você não tem permissão para esta ação";
  }
  if (err?.code === "23514") return "Algum dado está fora do formato permitido";
  if (err?.code === "P0001" && err.message) return err.message; // raise exception das regras de negócio
  if (err?.code === "22P02") return "Dado inválido";
  console.error("[erro]", err?.code, err?.message);
  return "Não foi possível concluir. Tente novamente.";
}

/** Valida o formulário com Zod e executa; devolve ActionState para o useActionState. */
export async function runForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  fn: (data: z.output<S>) => Promise<ActionState | void>,
): Promise<ActionState> {
  const raw = formToObject(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos destacados", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  try {
    return (await fn(parsed.data)) ?? { ok: true };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { ok: false, error: friendlyError(e), values: raw };
  }
}

export function isRedirect(e: unknown) {
  const d = (e as { digest?: string })?.digest;
  return typeof d === "string" && (d.startsWith("NEXT_REDIRECT") || d === "NEXT_NOT_FOUND");
}
