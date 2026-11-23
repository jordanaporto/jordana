import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDb, type TestUser } from "./helpers";

/** Ninguém consegue mudar o que foi orçado/aprovado para enganar o dono ou o cliente. */
let db: Awaited<ReturnType<typeof setupDb>>;
let admin: TestUser, atend: TestUser, mec: TestUser, gestao: TestUser;
let orderId = "";
let itemId = "";

beforeAll(async () => {
  db = await setupDb();
  admin = await db.createUser("admin", "admin");
  atend = await db.createUser("ana", "atendimento");
  mec = await db.createUser("joao", "mecanico");
  gestao = await db.createUser("dono", "gestao");
  orderId = await db.as(atend, async (sql) => {
    const [c] = await sql`insert into customers (name, whatsapp, whatsapp_opt_in) values ('Maria Souza', '+5591988887777', false) returning id`;
    const [v] = await sql`insert into vehicles (customer_id, plate, brand, model) values (${c.id}, 'TRV1A23', 'Chevrolet', 'Onix') returning id`;
    const [o] = await sql`select app.open_service_order(${c.id}, ${v.id}, 1000, ${mec.id}, 'Barulho', null) as id`;
    return o.id as string;
  });
});
afterAll(async () => db?.close());

const status = (to: string, u: TestUser) => db.as(u, (sql) => sql`select app.change_status(${orderId}, ${to}::os_status, null)`);
const upd = (u: TestUser, set: string, value: unknown) =>
  db.as(u, (sql) => sql`update service_items set ${sql({ [set]: value })} where id = ${itemId}`);

describe("trava do orçamento", () => {
  it("mecânico cadastra serviço sem valor e não consegue colocar preço", async () => {
    await status("em_inspecao", mec);
    await status("em_diagnostico", mec);
    const [it] = await db.as(mec, (sql) => sql`
      insert into service_items (service_order_id, title, part_name, quantity, part_unit_price_cents, labor_price_cents, priority)
      values (${orderId}, 'Troca de pastilhas', 'Pastilha original', 1, 50000, 50000, 'urgente') returning *`);
    itemId = it.id;
    expect(Number(it.part_unit_price_cents)).toBe(0);
    expect(Number(it.labor_price_cents)).toBe(0);
    await expect(upd(mec, "labor_price_cents", 1)).rejects.toThrow(/não altera valores/);
    await expect(upd(mec, "part_unit_price_cents", 1)).rejects.toThrow(/não altera valores/);
    // antes do orçamento ele ainda pode corrigir a descrição técnica
    await upd(mec, "quantity", 2);
    await status("diagnostico_concluido", mec);
  });

  it("mecânico não aprova, não remove, nem executa serviço sem aprovação", async () => {
    await expect(upd(mec, "approval_status", "aprovado")).rejects.toThrow(/permission denied/);
    await expect(db.as(mec, (sql) => sql`select app.record_decision(${itemId}, 'aprovado', 'presencial', null)`)).rejects.toThrow();
    await expect(db.as(mec, (sql) => sql`select app.remove_service_item(${itemId}, 'tirar')`)).rejects.toThrow();
    await expect(db.as(mec, (sql) => sql`select app.set_execution(${itemId}, 'executado', null)`)).rejects.toThrow(/aprovados/);
  });

  it("depois que o orçamento é preparado o mecânico não muda mais o serviço (quantidade, peça, nome)", async () => {
    await status("orcamento_em_preparacao", atend);
    await db.as(atend, (sql) => sql`update service_items set part_unit_price_cents = 15000, labor_price_cents = 8000 where id = ${itemId}`);
    await expect(upd(mec, "quantity", 4)).rejects.toThrow(/orçamento já foi preparado/);
    await expect(upd(mec, "part_name", "Pastilha paralela")).rejects.toThrow(/orçamento já foi preparado/);
    await expect(upd(mec, "title", "Outra coisa")).rejects.toThrow(/orçamento já foi preparado/);
    // pode sugerir um serviço novo, mas ele entra sem valor e depende do cliente
    const [novo] = await db.as(mec, (sql) => sql`
      insert into service_items (service_order_id, title, labor_price_cents) values (${orderId}, 'Fluido de freio', 99999) returning *`);
    expect(Number(novo.labor_price_cents)).toBe(0);
    expect(novo.approval_status).toBe("pendente");
    await db.as(atend, (sql) => sql`select app.remove_service_item(${novo.id}, 'não necessário')`);
  });

  it("valor aprovado fica congelado no registro da decisão; ninguém além do admin muda o serviço decidido", async () => {
    await status("aguardando_aprovacao", atend);
    await db.as(atend, (sql) => sql`select app.record_decision(${itemId}, 'aprovado', 'whatsapp', null)`);
    const [d] = await db.owner`select approved_total_cents from service_item_decisions where service_item_id = ${itemId}`;
    expect(Number(d.approved_total_cents)).toBe(2 * 15000 + 8000);
    for (const [col, val] of [["labor_price_cents", 99999], ["part_unit_price_cents", 1], ["quantity", 3], ["title", "x"], ["description", "paralela"], ["part_name", "paralela"], ["priority", "pode_acompanhar"]] as const) {
      await expect(upd(atend, col, val)).rejects.toThrow(/já foi decidido/);
    }
    await expect(db.as(atend, (sql) => sql`select app.remove_service_item(${itemId}, 'sumir')`)).rejects.toThrow(/já decidido/);
    // gestão só consulta: a alteração não pega em nenhuma linha
    await upd(gestao, "labor_price_cents", 1).catch(() => null);
    const [still] = await db.owner`select labor_price_cents from service_items where id = ${itemId}`;
    expect(Number(still.labor_price_cents)).toBe(8000);
    // decisões não podem ser editadas nem apagadas
    await expect(db.as(admin, (sql) => sql`update service_item_decisions set approved_total_cents = 1 where service_item_id = ${itemId}`)).rejects.toThrow();
    await expect(db.as(admin, (sql) => sql`delete from service_item_decisions where service_item_id = ${itemId}`)).rejects.toThrow();
  });

  it("mecânico continua conseguindo registrar a execução do serviço aprovado", async () => {
    await status("servico_aprovado", atend);
    await status("em_manutencao", mec);
    await db.as(mec, (sql) => sql`select app.set_execution(${itemId}, 'executado', 'Pastilhas trocadas')`);
    const [it] = await db.owner`select execution_status, executed_by from service_items where id = ${itemId}`;
    expect(it.execution_status).toBe("executado");
    expect(it.executed_by).toBe(mec.id);
  });

  it("alteração do admin em serviço aprovado fica visível na OS e na auditoria, com o valor antigo", async () => {
    await upd(admin, "labor_price_cents", 10000);
    const [n] = await db.owner`select body, is_system, author_id from service_order_notes where service_order_id = ${orderId} order by created_at desc limit 1`;
    expect(n.is_system).toBe(true);
    expect(n.body).toContain("alterado pelo administrador");
    expect(n.body).toMatch(/R\$ 380,00 → R\$ 400,00/);
    expect(n.author_id).toBe(admin.id);
    const audit = await db.owner`select 1 from audit_log where table_name = 'service_items' and record_id = ${itemId}::text and action = 'UPDATE' and actor_id = ${admin.id}
                                  and old_data ->> 'labor_price_cents' = '8000' and new_data ->> 'labor_price_cents' = '10000'`;
    expect(audit).toHaveLength(1);
    const [d] = await db.owner`select approved_total_cents from service_item_decisions where service_item_id = ${itemId}`;
    expect(Number(d.approved_total_cents)).toBe(38000);
  });
});
