import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDb, type TestUser } from "./helpers";

let db: Awaited<ReturnType<typeof setupDb>>;
let atend: TestUser, mec: TestUser;
let n = 0;

beforeAll(async () => {
  db = await setupDb();
  atend = await db.createUser("ana", "atendimento");
  mec = await db.createUser("joao", "mecanico");
  await db.owner`insert into settings (key, value) values ('app.public_url', '"https://oficina.exemplo"')
                 on conflict (key) do update set value = excluded.value`;
});
afterAll(async () => db?.close());

async function order(optIn = true) {
  n++;
  return db.as(atend, async (sql) => {
    const [c] = await sql`insert into customers (name, whatsapp, whatsapp_opt_in) values ('Maria Souza', '+5591988887777', ${optIn}) returning id`;
    const [v] = await sql`insert into vehicles (customer_id, plate, brand, model) values (${c.id}, ${"TRK" + (1000 + n)}, 'Chevrolet', 'Onix') returning id`;
    const [o] = await sql`select app.open_service_order(${c.id}, ${v.id}, 1000, ${mec.id}, 'Barulho no freio', null) as id`;
    return o.id as string;
  });
}
const tokenOf = async (orderId: string) =>
  (await db.owner`select token from tracking_links where service_order_id = ${orderId} and revoked_at is null`)[0]?.token as string;
const view = (token: string) => db.as(null, async (sql) => (await sql`select app.tracking_view(${token}) as v`)[0].v);
const status = (id: string, s: string, u: TestUser) => db.as(u, (sql) => sql`select app.change_status(${id}, ${s}::os_status, null)`);

describe("link de acompanhamento", () => {
  it("é criado ao abrir a OS e vai na mensagem de veículo recebido", async () => {
    const id = await order();
    const token = await tokenOf(id);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const [m] = await db.owner`select rendered_body from outbound_messages where service_order_id = ${id} and trigger_status = 'recebido'`;
    expect(m.rendered_body).toContain(`https://oficina.exemplo/acompanhar/${token}`);
  });

  it("mostra só o necessário ao cliente; token errado não mostra nada", async () => {
    const id = await order();
    const v = await view(await tokenOf(id));
    expect(v.cliente).toBe("Maria");
    expect(v.veiculo.modelo).toBe("Onix");
    expect(v.os.status).toBe("recebido");
    expect(JSON.stringify(v)).not.toContain("988887777");
    expect(JSON.stringify(v)).not.toContain("Usuário");
    expect(v.servicos).toEqual([]); // orçamento só aparece quando pronto
    expect(await view("x".repeat(64))).toBeNull();
  });

  it("cliente aprova e recusa pelo link somente quando o orçamento está aguardando", async () => {
    const id = await order();
    const token = await tokenOf(id);
    for (const s of ["em_diagnostico", "diagnostico_concluido"]) await status(id, s, mec);
    await status(id, "orcamento_em_preparacao", atend);
    const [a] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title, labor_price_cents) values (${id}, 'Pastilhas', 30000) returning id`);
    const [b] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title, labor_price_cents) values (${id}, 'Alinhamento', 9000) returning id`);
    await expect(db.as(null, (sql) => sql`select app.tracking_decide(${token}, ${a.id}, 'aprovado', null)`)).rejects.toThrow(/não está aguardando/);
    await status(id, "aguardando_aprovacao", atend);
    const v = await view(token);
    expect(v.pode_aprovar).toBe(true);
    expect(v.servicos.map((s: { titulo: string }) => s.titulo)).toEqual(["Pastilhas", "Alinhamento"]);
    await db.as(null, (sql) => sql`select app.tracking_decide(${token}, ${a.id}, 'aprovado', 'pode fazer')`);
    const [{ r }] = await db.as(null, (sql) => sql`select app.tracking_decide(${token}, ${b.id}, 'recusado', null) as r`);
    expect(r.pendentes).toBe(0);
    const decs = await db.owner`select method, decision, recorded_by from service_item_decisions d join service_items si on si.id = d.service_item_id where si.service_order_id = ${id} order by d.decided_at`;
    expect(decs.map((d) => [d.method, d.decision])).toEqual([["link", "aprovado"], ["link", "recusado"]]);
    expect(decs[0].recorded_by).toBeNull();
    // item de outra OS com o mesmo link: recusado
    const outra = await order();
    const [c] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title) values (${outra}, 'Outro') returning id`);
    await expect(db.as(null, (sql) => sql`select app.tracking_decide(${token}, ${c.id}, 'aprovado', null)`)).rejects.toThrow(/não encontrado/);
    // equipe consegue seguir o fluxo normal
    await status(id, "servico_aprovado", atend);
  });

  it("cliente com notificações ativadas é avisado a cada etapa", async () => {
    const id = await order();
    const token = await tokenOf(id);
    await db.as(null, (sql) => sql`select app.tracking_subscribe(${token}, 'https://fcm.googleapis.com/fcm/send/cliente1', 'BKey', 'auth', 'teste')`);
    await status(id, "em_inspecao", mec);
    await status(id, "em_diagnostico", mec);
    const rows = await db.as(null, (sql) => sql`select * from app.tracking_notifications_claim(50)`);
    expect(rows.map((r) => r.body)).toEqual([
      "Você será avisado a cada etapa do serviço no seu veículo.",
      "Começamos a inspeção do seu veículo.",
      "Estamos fazendo os testes para identificar o problema.",
    ]);
    expect(rows[1].title).toBe("Seu Onix");
    expect(rows[1].token).toBe(token);
  });

  it("gerar novo link invalida o anterior; mecânico não gera", async () => {
    const id = await order();
    const old = await tokenOf(id);
    await expect(db.as(mec, (sql) => sql`select app.tracking_regenerate(${id})`)).rejects.toThrow(/permissão/);
    const [{ t }] = await db.as(atend, (sql) => sql`select app.tracking_regenerate(${id}) as t`);
    expect(t).not.toBe(old);
    expect(await view(old)).toBeNull();
    expect(await view(t)).not.toBeNull();
  });

  it("expira 30 dias após a entrega", async () => {
    const id = await order();
    const token = await tokenOf(id);
    await db.as(atend, (sql) => sql`select app.change_status(${id}, 'cancelada', 'teste')`);
    const [l] = await db.owner`select expires_at from tracking_links where token = ${token}`;
    expect(new Date(l.expires_at).getTime() - Date.now()).toBeGreaterThan(29 * 86400_000);
    await db.owner`update tracking_links set expires_at = now() - interval '1 minute' where token = ${token}`;
    expect(await view(token)).toBeNull();
  });
  it("OS antiga sem link ganha um ao abrir a ficha; mecânico não vê o resumo do link", async () => {
    const id = await order();
    await db.owner`delete from tracking_links where service_order_id = ${id}`;
    const [info] = await db.as(atend, (sql) => sql`select * from app.tracking_info(${id})`);
    expect(info.url).toMatch(/^https:\/\/oficina\.exemplo\/acompanhar\/[a-f0-9]{64}$/);
    expect(info.views).toBe(0);
    expect(info.subscribers).toBe(0);
    await expect(db.as(mec, (sql) => sql`select * from app.tracking_info(${id})`)).rejects.toThrow();
  });
});
