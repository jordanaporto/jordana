import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDb, type TestUser } from "./helpers";

let db: Awaited<ReturnType<typeof setupDb>>;
let atend: TestUser, mec: TestUser, admin: TestUser;
let n = 0;

beforeAll(async () => {
  db = await setupDb();
  admin = await db.createUser("admin", "admin");
  atend = await db.createUser("ana", "atendimento");
  mec = await db.createUser("joao", "mecanico");
});
afterAll(async () => db?.close());

async function customerWithCar(optIn = true) {
  n++;
  return db.as(atend, async (sql) => {
    const [c] = await sql`insert into customers (name, whatsapp, whatsapp_opt_in) values ('Maria Souza', '+5591988887777', ${optIn}) returning id`;
    const [v] = await sql`insert into vehicles (customer_id, plate, brand, model) values (${c.id}, ${"AGD" + (1000 + n)}, 'Chevrolet', 'Onix') returning id`;
    return { customerId: c.id as string, vehicleId: v.id as string };
  });
}

const msgs = (apptId: string) =>
  db.owner`select trigger_event, status, send_after, rendered_body from outbound_messages where appointment_id = ${apptId} order by send_after`;

describe("agenda", () => {
  it("agendar envia confirmação agora e programa lembretes 1 dia e 2 horas antes", async () => {
    const { customerId, vehicleId } = await customerWithCar();
    const at = new Date(Date.now() + 3 * 86400_000);
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${at}, 60, 'Revisão', null) as id`);
    const m = await msgs(id);
    expect(m.map((x) => x.trigger_event)).toEqual(["agendamento_confirmacao", "agendamento_lembrete_1d", "agendamento_lembrete_2h"]);
    expect(Math.abs(new Date(m[1].send_after).getTime() - (at.getTime() - 86400_000))).toBeLessThan(1000);
    expect(Math.abs(new Date(m[2].send_after).getTime() - (at.getTime() - 2 * 3600_000))).toBeLessThan(1000);
    expect(m[0].rendered_body).toMatch(/^Olá, Maria! Seu horário na .+ está marcado para .+, \d\d\/\d\d às \d\d:\d\d: Revisão no seu Onix/);
  });

  it("agendamento para daqui a 5 horas não programa o lembrete da véspera", async () => {
    const { customerId, vehicleId } = await customerWithCar();
    const at = new Date(Date.now() + 5 * 3600_000);
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${at}, 60, 'Troca de óleo', null) as id`);
    expect((await msgs(id)).map((x) => x.trigger_event)).toEqual(["agendamento_confirmacao", "agendamento_lembrete_2h"]);
  });

  it("sem autorização de WhatsApp nenhuma mensagem é criada", async () => {
    const { customerId, vehicleId } = await customerWithCar(false);
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() + 86400_000 * 2)}, 60, 'Revisão', null) as id`);
    expect(await msgs(id)).toHaveLength(0);
  });

  it("reagendar cancela os lembretes antigos e cria novos; cancelar para tudo", async () => {
    const { customerId, vehicleId } = await customerWithCar();
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() + 2 * 86400_000)}, 60, 'Freios', null) as id`);
    await db.as(atend, (sql) => sql`select app.update_appointment(${id}, ${vehicleId}, ${new Date(Date.now() + 4 * 86400_000)}, 90, 'Freios', 'traz a nota')`);
    const after = await msgs(id);
    expect(after.filter((x) => x.status === "cancelada")).toHaveLength(3);
    expect(after.filter((x) => x.status === "na_fila")).toHaveLength(3);
    await expect(db.as(atend, (sql) => sql`select app.set_appointment_status(${id}, 'cancelado', null)`)).rejects.toThrow(/motivo/);
    await db.as(atend, (sql) => sql`select app.set_appointment_status(${id}, 'cancelado', 'Cliente viajou')`);
    expect((await msgs(id)).filter((x) => x.status === "na_fila")).toHaveLength(0);
  });

  it("cliente chegou: vira OS com cliente e veículo, e lembretes pendentes são cancelados", async () => {
    const { customerId, vehicleId } = await customerWithCar();
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() + 2 * 86400_000)}, 60, 'Revisão 60 mil', 'cliente pediu orçamento de pneus') as id`);
    const [{ order_id }] = await db.as(atend, (sql) => sql`select app.convert_appointment(${id}, 60100, ${mec.id}, null) as order_id`);
    const [so] = await db.owner`select vehicle_id, customer_id, complaint, intake_notes, assigned_mechanic_id from service_orders where id = ${order_id}`;
    expect(so).toMatchObject({ vehicle_id: vehicleId, customer_id: customerId, complaint: "Revisão 60 mil", intake_notes: "cliente pediu orçamento de pneus", assigned_mechanic_id: mec.id });
    const [a] = await db.owner`select status, service_order_id from appointments where id = ${id}`;
    expect(a).toEqual({ status: "compareceu", service_order_id: order_id });
    expect((await msgs(id)).filter((x) => x.trigger_event !== "agendamento_confirmacao" && x.status === "na_fila")).toHaveLength(0);
  });

  it("mecânico não agenda e não vê a agenda", async () => {
    const { customerId, vehicleId } = await customerWithCar();
    await expect(db.as(mec, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() + 86400_000)}, 60, 'Revisão', null)`)).rejects.toThrow(/permissão/);
    expect(await db.as(mec, (sql) => sql`select * from appointments`)).toHaveLength(0);
    await expect(db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() - 86400_000)}, 60, 'Revisão', null)`)).rejects.toThrow(/futuros/);
  });

  it("a fila da API só entrega lembretes quando chega a hora", async () => {
    await db.owner`update settings set value = '"cloud_api"' where key = 'messaging.provider'`;
    await db.owner`update message_templates set meta_template_name = 'agenda_' || replace(trigger_event, 'agendamento_', '') where trigger_event is not null`;
    const { customerId, vehicleId } = await customerWithCar();
    const [{ id }] = await db.as(atend, (sql) => sql`select app.create_appointment(${customerId}, ${vehicleId}, ${new Date(Date.now() + 3 * 86400_000)}, 60, 'Revisão', null) as id`);
    const claimed = await db.as(null, (sql) => sql`select * from app.outbox_claim(50)`);
    const mine = claimed.filter((c) => c.meta_template_name?.startsWith("agenda_"));
    expect(mine.map((c) => c.meta_template_name)).toEqual(["agenda_confirmacao"]);
    await db.owner`update outbound_messages set send_after = now() - interval '1 minute' where appointment_id = ${id} and trigger_event = 'agendamento_lembrete_1d'`;
    const later = await db.as(null, (sql) => sql`select * from app.outbox_claim(50)`);
    expect(later.map((c) => c.meta_template_name)).toEqual(["agenda_lembrete_1d"]);
    await db.owner`update settings set value = '"manual"' where key = 'messaging.provider'`;
  });
});

describe("avisos no celular (push)", () => {
  async function subscribe(u: TestUser, tag: string) {
    await db.as(u, (sql) => sql`select app.push_subscribe(${"https://fcm.googleapis.com/fcm/send/" + tag}, 'BKey', 'auth', 'teste')`);
  }

  it("mecânico recebe aviso de carro atribuído e de serviço aprovado; atendimento, de diagnóstico concluído", async () => {
    await subscribe(mec, "mec1");
    await subscribe(atend, "atend1");
    await db.owner`delete from app.notifications`;
    const { customerId, vehicleId } = await customerWithCar();
    const [{ id }] = await db.as(atend, (sql) => sql`select app.open_service_order(${customerId}, ${vehicleId}, 1000, ${mec.id}, 'Barulho no motor', null) as id`);
    for (const s of ["em_diagnostico", "diagnostico_concluido"]) await db.as(mec, (sql) => sql`select app.change_status(${id}, ${s}::os_status, null)`);
    await db.as(atend, (sql) => sql`select app.change_status(${id}, 'orcamento_em_preparacao', null)`);
    const [it] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title, labor_price_cents) values (${id}, 'Troca de correia', 20000) returning id`);
    await db.as(atend, (sql) => sql`select app.change_status(${id}, 'aguardando_aprovacao', null)`);
    await db.as(atend, (sql) => sql`select app.record_decision(${it.id}, 'aprovado', 'telefone', null)`);
    await db.as(atend, (sql) => sql`select app.change_status(${id}, 'servico_aprovado', null)`);

    const rows = await db.owner`select n.user_id, n.title from app.notifications n order by n.id`;
    expect(rows.map((r) => [r.user_id === mec.id ? "mec" : "atend", r.title.split(":")[0]])).toEqual([
      ["mec", "Novo carro para você"],
      ["atend", "Diagnóstico concluído"],
      ["mec", "Serviço aprovado"],
    ]);
    const claimed = await db.as(null, (sql) => sql`select * from app.notifications_claim(50)`);
    expect(claimed).toHaveLength(3);
    expect(await db.as(null, (sql) => sql`select * from app.notifications_claim(50)`)).toHaveLength(0);
  });

  it("quem não ativou avisos não acumula notificações; quem age não avisa a si mesmo", async () => {
    await db.owner`delete from app.notifications`;
    const { customerId, vehicleId } = await customerWithCar();
    // admin sem aparelho cadastrado + atendimento abre a OS sem mecânico
    await db.as(admin, (sql) => sql`select app.open_service_order(${customerId}, ${vehicleId}, 1, null, 'x x', null)`);
    expect(await db.owner`select * from app.notifications`).toHaveLength(0);
  });

  it("alertas novos geram um aviso só uma vez por OS e tipo", async () => {
    await db.owner`delete from app.notifications`;
    await db.owner`delete from app.alert_notified`;
    const { customerId, vehicleId } = await customerWithCar();
    const [{ id }] = await db.as(atend, (sql) => sql`select app.open_service_order(${customerId}, ${vehicleId}, 1, ${mec.id}, 'Revisão', null) as id`);
    await db.owner`update service_orders set last_activity_at = now() - interval '10 hours' where id = ${id}`;
    await db.owner`delete from app.notifications`;
    const [{ c1 }] = await db.as(null, (sql) => sql`select app.collect_alert_notifications() as c1`);
    const [{ c2 }] = await db.as(null, (sql) => sql`select app.collect_alert_notifications() as c2`);
    expect(c1).toBeGreaterThanOrEqual(1);
    expect(c2).toBe(0);
    const titles = (await db.owner`select title, user_id from app.notifications`).map((r) => [r.user_id === mec.id ? "mec" : "atend", r.title.split(":")[0]]);
    expect(titles).toContainEqual(["atend", "Alerta"]);
    expect(titles).toContainEqual(["mec", "Atenção"]);
  });

  it("aparelho inválido é removido; usuário só remove o próprio aparelho", async () => {
    const [s] = await db.owner`select id from app.push_subscriptions where endpoint like '%mec1'`;
    await db.as(atend, (sql) => sql`select app.push_unsubscribe('https://fcm.googleapis.com/fcm/send/mec1')`);
    expect(await db.owner`select 1 from app.push_subscriptions where id = ${s.id}`).toHaveLength(1);
    await db.as(null, (sql) => sql`select app.push_result(${s.id}, false, true)`);
    expect(await db.owner`select 1 from app.push_subscriptions where id = ${s.id}`).toHaveLength(0);
    await expect(db.as(null, (sql) => sql`select app.push_subscribe('https://x', 'a', 'b', 'c')`)).rejects.toThrow(/Sessão/);
  });
});
