import { z } from "zod";
import { isValidCpf, isValidPlate, normalizeCpf, normalizePhone, normalizePlate, parseMoney } from "./format";
import { ROLES } from "./roles";
import { STATUSES } from "./status";

export const APPOINTMENT_EVENTS = ["agendamento_confirmacao", "agendamento_lembrete_1d", "agendamento_lembrete_2h"] as const;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const reqText = (min: number, max: number, msg: string) =>
  z.string({ error: msg }).trim().min(min, msg).max(max, `Máximo de ${max} caracteres`);

const phone = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Telefone inválido. Use DDD + número" });
      return z.NEVER;
    }
    return n;
  });

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

const uuid = z.uuid("Identificador inválido");
const optUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

const intField = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v !== "", msg)
    .transform(Number)
    .pipe(z.number().int().min(min, msg).max(max, msg));

const optInt = (min: number, max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : ""))
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min, msg).max(max, msg).nullable());

const moneyField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const c = parseMoney(v ?? "");
    if (c == null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return c;
  });

export const customerSchema = z
  .object({
    name: reqText(2, 160, "Informe o nome do cliente"),
    phone,
    whatsapp: phone,
    cpf: z
      .string()
      .optional()
      .transform((v, ctx) => {
        const d = normalizeCpf(v);
        if (!d) return null;
        if (!isValidCpf(d)) {
          ctx.addIssue({ code: "custom", message: "CPF inválido" });
          return z.NEVER;
        }
        return d;
      }),
    notes: optText(4000),
    whatsapp_opt_in: checkbox,
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.whatsapp) ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Informe telefone ou WhatsApp" });
    if (v.whatsapp_opt_in && !v.whatsapp && !v.phone)
      ctx.addIssue({ code: "custom", path: ["whatsapp_opt_in"], message: "Sem número de WhatsApp" });
  });

export const vehicleSchema = z.object({
  customer_id: uuid,
  plate: z
    .string({ error: "Informe a placa" })
    .transform(normalizePlate)
    .refine(isValidPlate, "Placa inválida (ex.: ABC1D23 ou ABC1234)"),
  brand: reqText(1, 60, "Informe a marca"),
  model: reqText(1, 80, "Informe o modelo"),
  version: optText(80),
  year: optInt(1950, 2100, "Ano inválido"),
  engine: optText(60),
  fuel: z
    .enum(["gasolina", "etanol", "flex", "diesel", "gnv", "hibrido", "eletrico", "outro", ""])
    .optional()
    .transform((v) => (v ? v : null)),
  current_km: optInt(0, 3_000_000, "Quilometragem inválida"),
  color: optText(40),
  notes: optText(4000),
});

export const openOrderSchema = z.object({
  customer_id: uuid,
  vehicle_id: uuid,
  entry_km: intField(0, 3_000_000, "Informe a quilometragem de entrada"),
  mechanic_id: optUuid,
  complaint: reqText(2, 4000, "Descreva a reclamação do cliente"),
  intake_notes: optText(4000),
});

export const updateOrderSchema = z.object({
  entry_km: intField(0, 3_000_000, "Quilometragem inválida"),
  complaint: reqText(2, 4000, "Descreva a reclamação do cliente"),
  intake_notes: optText(4000),
  final_notes: optText(4000),
});

export const statusChangeSchema = z.object({
  order_id: uuid,
  to_status: z.enum(STATUSES),
  note: optText(2000),
});

export const noteSchema = z.object({ order_id: uuid, body: reqText(1, 4000, "Escreva a observação") });

export const diagnosisSchema = z.object({
  order_id: uuid,
  reported_symptom: optText(4000),
  tests_performed: optText(4000),
  results: optText(4000),
  root_cause: optText(4000),
  components: optText(4000),
  recommendation: optText(4000),
  technical_notes: optText(4000),
});

export const serviceItemSchema = z.object({
  order_id: uuid,
  item_id: optUuid,
  title: reqText(2, 160, "Informe o serviço"),
  description: optText(2000),
  part_name: optText(160),
  quantity: z
    .string()
    .optional()
    .transform((v) => Number((v || "1").replace(",", ".")))
    .pipe(z.number({ error: "Quantidade inválida" }).positive("Quantidade inválida").max(9999)),
  part_unit_price: moneyField,
  labor_price: moneyField,
  priority: z.enum(["urgente", "recomendado", "pode_acompanhar"]),
});

export const decisionSchema = z.object({
  item_id: uuid,
  decision: z.enum(["aprovado", "recusado"]),
  method: z.enum(["presencial", "telefone", "whatsapp"]),
  note: optText(2000),
});

export const executionSchema = z.object({
  item_id: uuid,
  status: z.enum(["nao_iniciado", "em_execucao", "executado", "nao_executado"]),
  notes: optText(2000),
});

export const checklistUpdateSchema = z.object({
  entry_id: uuid,
  result: z.enum(["ok", "atencao", "necessita_reparo", "nao_avaliado"]).optional(),
  note: z.string().max(2000).optional(),
});

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Usuário: 3 a 30 letras minúsculas, números, ponto, hífen"),
  full_name: reqText(2, 120, "Informe o nome"),
  role: z.enum(ROLES),
  phone: optText(30),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(128),
});

export const userUpdateSchema = z.object({
  user_id: uuid,
  full_name: reqText(2, 120, "Informe o nome"),
  role: z.enum(ROLES),
  phone: optText(30),
  active: checkbox,
});

export const templateSchema = z.object({
  template_id: optUuid,
  name: reqText(2, 80, "Informe o nome"),
  trigger: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return { trigger_status: null, trigger_event: null };
      const [kind, value] = v.split(":");
      if (kind === "status" && (STATUSES as readonly string[]).includes(value)) return { trigger_status: value, trigger_event: null };
      if (kind === "evento" && (APPOINTMENT_EVENTS as readonly string[]).includes(value)) return { trigger_status: null, trigger_event: value };
      ctx.addIssue({ code: "custom", message: "Escolha quando enviar" });
      return z.NEVER;
    }),
  body: reqText(2, 1024, "Escreva a mensagem"),
  meta_template_name: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^[a-z0-9_]{1,250}$/, "Nome do modelo Meta: letras minúsculas, números e _").nullable()),
  meta_variables: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  active: checkbox,
});

export const alertSettingsSchema = z.object({
  no_update_hours: intField(1, 720, "Valor inválido"),
  approval_max_hours: intField(1, 720, "Valor inválido"),
  waiting_part_max_hours: intField(1, 2160, "Valor inválido"),
  diagnosis_max_hours: intField(1, 720, "Valor inválido"),
  ready_not_notified_minutes: intField(1, 1440, "Valor inválido"),
});

export const companySchema = z.object({
  name: reqText(2, 120, "Informe o nome"),
  legal_name: optText(160),
  cnpj: optText(20),
  address: optText(200),
  phone: optText(30),
  whatsapp: optText(30),
});

export type FieldErrors = Record<string, string[] | undefined>;

export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export function fieldErrors(err: z.ZodError): FieldErrors {
  return z.flattenError(err).fieldErrors as FieldErrors;
}

// ------------------------------------------------------------------ agenda
/** Data/hora digitadas no horário de Belém (UTC−3, sem horário de verão). */
export function belemDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const appointmentSchema = z
  .object({
    appointment_id: optUuid,
    customer_id: z.string().optional().transform((v) => v || null).pipe(z.uuid().nullable()),
    vehicle_id: optUuid,
    date: z.string({ error: "Escolha a data" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data"),
    time: z.string({ error: "Escolha o horário" }).regex(/^\d{2}:\d{2}$/, "Escolha o horário"),
    duration: z.string().optional().transform((v) => Number(v || 60)).pipe(z.number().int().min(15).max(600)),
    service: reqText(2, 200, "Informe o serviço"),
    notes: optText(2000),
  })
  .transform((v, ctx) => {
    const at = belemDateTime(v.date, v.time);
    if (!at) {
      ctx.addIssue({ code: "custom", path: ["time"], message: "Data ou horário inválido" });
      return z.NEVER;
    }
    return { ...v, at };
  });
