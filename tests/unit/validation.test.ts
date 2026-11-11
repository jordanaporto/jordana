import { describe, expect, it } from "vitest";
import { customerSchema, openOrderSchema, serviceItemSchema, vehicleSchema } from "@/lib/validation";
import { mobileNavFor, homeFor, can } from "@/lib/roles";
import { STATUS_META, STATUSES, transitionLabel } from "@/lib/status";

describe("validação de formulários", () => {
  it("cliente: exige nome e algum telefone; normaliza dados", () => {
    const ok = customerSchema.safeParse({ name: " Maria ", whatsapp: "(91) 98888-7777", cpf: "529.982.247-25", whatsapp_opt_in: "on" });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ name: "Maria", whatsapp: "+5591988887777", cpf: "52998224725", whatsapp_opt_in: true });
    const bad = customerSchema.safeParse({ name: "M", cpf: "111" });
    expect(bad.success).toBe(false);
  });

  it("veículo: placa normalizada e ano válido", () => {
    const r = vehicleSchema.safeParse({ customer_id: crypto.randomUUID(), plate: "qzx-1a23", brand: "Fiat", model: "Uno", year: "2012" });
    expect(r.success).toBe(true);
    expect(r.data?.plate).toBe("QZX1A23");
    expect(vehicleSchema.safeParse({ customer_id: crypto.randomUUID(), plate: "X", brand: "a", model: "b" }).success).toBe(false);
  });

  it("OS: km com pontos é aceito e reclamação é obrigatória", () => {
    const base = { customer_id: crypto.randomUUID(), vehicle_id: crypto.randomUUID(), complaint: "Barulho" };
    const r = openOrderSchema.safeParse({ ...base, entry_km: "72.450", mechanic_id: "" });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ entry_km: 72450, mechanic_id: null });
    expect(openOrderSchema.safeParse({ ...base, entry_km: "" }).success).toBe(false);
  });

  it("serviço: valores em centavos e prioridade válida", () => {
    const r = serviceItemSchema.safeParse({
      order_id: crypto.randomUUID(),
      title: "Troca de óleo",
      quantity: "4,5",
      part_unit_price: "42,90",
      labor_price: "60",
      priority: "recomendado",
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ quantity: 4.5, part_unit_price: 4290, labor_price: 6000 });
    expect(serviceItemSchema.safeParse({ order_id: crypto.randomUUID(), title: "X troca", priority: "talvez" }).success).toBe(false);
  });
});

describe("perfis e etapas", () => {
  it("cada perfil cai na sua tela inicial", () => {
    expect(homeFor("mecanico")).toBe("/meus-carros");
    expect(homeFor("atendimento")).toBe("/patio");
    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor("gestao")).toBe("/gestao");
  });
  it("mecânico não vê preços; barra inferior tem no máximo 5 itens", () => {
    expect(can.seePrices("mecanico")).toBe(false);
    expect(can.editPrices("gestao")).toBe(false);
    for (const r of ["mecanico", "atendimento", "admin", "gestao"] as const) expect(mobileNavFor(r).length).toBeLessThanOrEqual(5);
  });
  it("13 etapas numeradas + cancelada", () => {
    expect(STATUSES.filter((s) => STATUS_META[s].n > 0).map((s) => STATUS_META[s].n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(transitionLabel("aguardando_peca", "em_manutencao", "avancar")).toMatch(/Peça chegou/);
    expect(transitionLabel("em_teste", "recebido", "voltar")).toBe("Voltar para: Veículo recebido");
  });
});
