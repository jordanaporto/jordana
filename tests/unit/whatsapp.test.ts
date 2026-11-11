import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ asSystem: vi.fn() }));

const { buildTemplatePayload, sendTemplate, verifyMetaSignature } = await import("@/lib/whatsapp");
const { hashPassword, verifyPassword } = await import("@/lib/auth/password");

const row = {
  id: "1",
  to_phone: "+5591988887777",
  rendered_body: "Olá, Maria. Seu Onix foi recebido…",
  variables: { nome: "Maria", modelo: "Onix" },
  meta_template_name: "veiculo_recebido",
  meta_language: "pt_BR",
  meta_variables: ["nome", "modelo"],
  attempts: 1,
};

describe("WhatsApp Cloud API (oficial)", () => {
  it("monta mensagem de modelo com variáveis na ordem {{1}}, {{2}}", () => {
    expect(buildTemplatePayload(row)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5591988887777",
      type: "template",
      template: {
        name: "veiculo_recebido",
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Maria" }, { type: "text", text: "Onix" }] }],
      },
    });
  });

  it("recusa enviar sem modelo aprovado", () => {
    expect(() => buildTemplatePayload({ ...row, meta_template_name: null })).toThrow(/modelo aprovado/);
  });

  it("envia para a Graph API e lê o id da mensagem", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_ACCESS_TOKEN = "tok";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 }));
    const r = await sendTemplate(row, fetchMock as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, id: "wamid.X" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");

    const fail = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Template not found" } }), { status: 400 }));
    expect(await sendTemplate(row, fail as unknown as typeof fetch)).toEqual({ ok: false, error: "HTTP 400: Template not found" });
  });

  it("verifica a assinatura X-Hub-Signature-256 do webhook", () => {
    const body = JSON.stringify({ entry: [] });
    const sig = "sha256=" + createHmac("sha256", "segredo").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "segredo")).toBe(true);
    expect(verifyMetaSignature(body + " ", sig, "segredo")).toBe(false);
    expect(verifyMetaSignature(body, sig, "outro")).toBe(false);
    expect(verifyMetaSignature(body, null, "segredo")).toBe(false);
  });
});

describe("senhas", () => {
  it("hash scrypt com sal aleatório e verificação", async () => {
    const h1 = await hashPassword("Oficina2026");
    const h2 = await hashPassword("Oficina2026");
    expect(h1).not.toBe(h2);
    expect(h1.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Oficina2026", h1)).toBe(true);
    expect(await verifyPassword("oficina2026", h1)).toBe(false);
    expect(await verifyPassword("x", "lixo")).toBe(false);
  });
});
