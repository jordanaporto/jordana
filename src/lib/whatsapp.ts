import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { asSystem } from "./db";
import { env } from "./env";

/**
 * Integração OFICIAL com a WhatsApp Business Platform (Cloud API da Meta).
 * Mensagens iniciadas pela empresa usam modelos aprovados na Meta
 * (message_templates.meta_template_name). Nenhuma automação de WhatsApp Web.
 */

export type OutboxRow = {
  id: string;
  to_phone: string;
  rendered_body: string;
  variables: Record<string, string>;
  meta_template_name: string | null;
  meta_language: string | null;
  meta_variables: string[] | null;
  attempts: number;
};

/** Monta o corpo da requisição de envio de modelo (variáveis → {{1}}, {{2}}…). */
export function buildTemplatePayload(row: OutboxRow) {
  if (!row.meta_template_name) throw new Error("Mensagem sem modelo aprovado na Meta");
  const params = (row.meta_variables ?? []).map((name) => ({ type: "text", text: String(row.variables?.[name] ?? "") }));
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: row.to_phone.replace(/\D/g, ""),
    type: "template",
    template: {
      name: row.meta_template_name,
      language: { code: row.meta_language ?? "pt_BR" },
      ...(params.length ? { components: [{ type: "body", parameters: params }] } : {}),
    },
  };
}

export async function sendTemplate(row: OutboxRow, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsapp.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildTemplatePayload(row)),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (res.ok && body.messages?.[0]?.id) return { ok: true, id: body.messages[0].id };
    return { ok: false, error: `HTTP ${res.status}: ${body.error?.message ?? "erro desconhecido"}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Processa a fila de mensagens da Cloud API. Retorna quantas foram tentadas. */
export async function processOutbox(limit = 20, fetchImpl: typeof fetch = fetch) {
  if (!env.whatsapp.configured) return { attempted: 0, sent: 0, skipped: "WhatsApp Cloud API não configurada" };
  const rows = (await asSystem((sql) => sql`select * from app.outbox_claim(${limit})`)) as unknown as OutboxRow[];
  let sent = 0;
  for (const row of rows) {
    const r = await sendTemplate(row, fetchImpl);
    await asSystem((sql) => sql`select app.outbox_complete(${row.id}, ${r.ok}, ${r.ok ? r.id : null}, ${r.ok ? null : r.error})`);
    if (r.ok) sent++;
  }
  return { attempted: rows.length, sent };
}

/** Confere o cabeçalho X-Hub-Signature-256 enviado pela Meta. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}
