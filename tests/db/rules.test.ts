import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDb, type TestUser } from "./helpers";

let db: Awaited<ReturnType<typeof setupDb>>;
let admin: TestUser, atend: TestUser, mec: TestUser, mec2: TestUser, gestao: TestUser;

beforeAll(async () => {
  db = await setupDb();
  admin = await db.createUser("admin", "admin");
  atend = await db.createUser("ana", "atendimento");
  mec = await db.createUser("joao", "mecanico");
  mec2 = await db.createUser("pedro", "mecanico");
  gestao = await db.createUser("dono", "gestao");
});
afterAll(async () => db?.close());

async function newOrder(opts: { optIn?: boolean; plate?: string; mechanic?: TestUser | null } = {}) {
  return db.as(atend, async (sql) => {
    const [c] = await sql`insert into customers (name, phone, whatsapp, whatsapp_opt_in)
      values ('Maria Souza', '+5591988887777', '+5591988887777', ${opts.optIn ?? true}) returning id`;
    const [v] = await sql`insert into vehicles (customer_id, plate, brand, model, year, current_km)
      values (${c.id}, ${opts.plate ?? "QZX1A23"}, 'Chevrolet', 'Onix', 2021, 70000) returning id`;
    const mechId = opts.mechanic === null ? null : (opts.mechanic ?? mec).id;
    const [o] = await sql`select app.open_service_order(${c.id}, ${v.id}, 72450, ${mechId}, 'Barulho na suspensão', 'Cliente aguarda ligação') as id`;
    return { customerId: c.id as string, vehicleId: v.id as string, orderId: o.id as string };
  });
}

const status = (orderId: string, to: string, user: TestUser, note: string | null = null) =>
  db.as(user, (sql) => sql`select app.change_status(${orderId}, ${to}::os_status, ${note})`);

describe("dados iniciais", () => {
  it("checklist do briefing e modelos de mensagem", async () => {
    const [{ cats, items }] = await db.owner`select (select count(*) from checklist_categories)::int cats, (select count(*) from checklist_items)::int items`;
    expect(cats).toBe(7);
    expect(items).toBe(34);
    const tpl = await db.owner`select trigger_status from message_templates where active and trigger_status is not null order by trigger_status`;
    expect(tpl.map((t) => t.trigger_status)).toEqual(["recebido", "em_diagnostico", "aguardando_aprovacao", "em_manutencao", "pronto_retirada"]);
  });
});

describe("visibilidade e permissões", () => {
  it("sem sessão nada é visível", async () => {
    await newOrder({ plate: "AAA0A00" });
    const rows = await db.as(null, (sql) => sql`select * from service_orders`);
    expect(rows.length).toBe(0);
    const cust = await db.as(null, (sql) => sql`select * from customers`);
    expect(cust.length).toBe(0);
  });

  it("mecânico não lê dados pessoais dos clientes", async () => {
    const rows = await db.as(mec, (sql) => sql`select * from customers`);
    expect(rows.length).toBe(0);
    const [o] = await db.as(mec, (sql) => sql`select customer_name, customer_whatsapp, total_cents from v_orders limit 1`);
    expect(o.customer_name).toBe("Maria Souza");
    expect(o.customer_whatsapp).toBeNull();
    expect(o.total_cents).toBeNull();
  });

  it("mecânico só vê OS atribuídas a ele", async () => {
    await newOrder({ plate: "BBB1B11", mechanic: mec2 });
    const mine = await db.as(mec, (sql) => sql`select plate from v_orders`);
    expect(mine.map((r) => r.plate)).not.toContain("BBB1B11");
    const other = await db.as(mec2, (sql) => sql`select plate from v_orders`);
    expect(other.map((r) => r.plate)).toEqual(["BBB1B11"]);
    const all = await db.as(gestao, (sql) => sql`select plate from v_orders`);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("mecânico e gestão não cadastram clientes", async () => {
    await expect(db.as(mec, (sql) => sql`insert into customers (name) values ('X Y')`)).rejects.toThrow(/row-level security/);
    await expect(db.as(gestao, (sql) => sql`insert into customers (name) values ('X Y')`)).rejects.toThrow(/row-level security/);
  });

  it("ninguém apaga registros pela aplicação", async () => {
    for (const u of [mec, atend, admin]) {
      await expect(db.as(u, (sql) => sql`delete from service_orders`)).rejects.toThrow(/permission denied/);
      await expect(db.as(u, (sql) => sql`delete from media`)).rejects.toThrow(/permission denied/);
      await expect(db.as(u, (sql) => sql`delete from customers`)).rejects.toThrow(/permission denied/);
    }
  });

  it("histórico de status e auditoria são imutáveis", async () => {
    await expect(db.as(admin, (sql) => sql`update service_order_status_history set note = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(db.as(admin, (sql) => sql`update audit_log set actor_id = null`)).rejects.toThrow(/permission denied/);
    await expect(db.as(admin, (sql) => sql`insert into audit_log (table_name, action) values ('x','INSERT')`)).rejects.toThrow(/permission denied/);
  });

  it("autoria não pode ser falsificada", async () => {
    await expect(db.as(atend, (sql) => sql`insert into customers (name, created_by) values ('Fulano', ${admin.id})`)).rejects.toThrow(/permission denied/);
    const [c] = await db.as(atend, (sql) => sql`insert into customers (name) values ('Fulano de Tal') returning created_by`);
    expect(c.created_by).toBe(atend.id);
  });

  it("status não pode ser alterado diretamente", async () => {
    await expect(db.as(admin, (sql) => sql`update service_orders set status = 'entregue'`)).rejects.toThrow(/permission denied/);
  });

  it("auditoria somente para admin", async () => {
    const forAtend = await db.as(atend, (sql) => sql`select * from audit_log`);
    expect(forAtend.length).toBe(0);
    const forAdmin = await db.as(admin, (sql) => sql`select * from audit_log where table_name = 'customers'`);
    expect(forAdmin.length).toBeGreaterThan(0);
    expect(forAdmin[0].actor_id).toBe(atend.id);
    expect(forAdmin[0].actor_role).toBe("atendimento");
  });
});

describe("abertura de OS", () => {
  it("copia checklist, grava histórico e enfileira mensagem com consentimento", async () => {
    const { orderId, vehicleId } = await newOrder({ plate: "CCC2C22" });
    const [{ n }] = await db.owner`select count(*)::int n from service_order_checklist where service_order_id = ${orderId}`;
    expect(n).toBe(34);
    const hist = await db.owner`select from_status, to_status, changed_by from service_order_status_history where service_order_id = ${orderId}`;
    expect(hist).toHaveLength(1);
    expect(hist[0].to_status).toBe("recebido");
    expect(hist[0].changed_by).toBe(atend.id);
    const msgs = await db.owner`select rendered_body, provider, status from outbound_messages where service_order_id = ${orderId}`;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].rendered_body).toContain("Olá, Maria. Seu Onix foi recebido");
    expect(msgs[0].provider).toBe("manual");
    const [v] = await db.owner`select current_km from vehicles where id = ${vehicleId}`;
    expect(v.current_km).toBe(72450);
  });

  it("sem consentimento não enfileira", async () => {
    const { orderId } = await newOrder({ plate: "DDD3D33", optIn: false });
    const msgs = await db.owner`select 1 from outbound_messages where service_order_id = ${orderId}`;
    expect(msgs).toHaveLength(0);
  });

  it("não permite duas OS abertas para o mesmo veículo", async () => {
    const { customerId, vehicleId } = await newOrder({ plate: "EEE4E44" });
    await expect(
      db.as(atend, (sql) => sql`select app.open_service_order(${customerId}, ${vehicleId}, 1, null, 'outra', null)`),
    ).rejects.toThrow(/já possui uma OS aberta/);
  });

  it("mecânico não abre OS", async () => {
    const { customerId, vehicleId } = await newOrder({ plate: "FFF5F55" });
    await expect(
      db.as(mec, (sql) => sql`select app.open_service_order(${customerId}, ${vehicleId}, 1, null, 'x', null)`),
    ).rejects.toThrow(/permissão/);
  });
});

describe("fluxo completo de status", () => {
  it("percorre da recepção à entrega respeitando perfis e regras", async () => {
    const { orderId } = await newOrder({ plate: "GGG6G66" });

    await expect(status(orderId, "orcamento_em_preparacao", mec)).rejects.toThrow(/não permitida/);
    await expect(status(orderId, "em_inspecao", atend)).rejects.toThrow(/perfil não pode/);
    await expect(status(orderId, "em_inspecao", mec2)).rejects.toThrow(/não encontrada|não está atribuída/);

    await status(orderId, "em_inspecao", mec);
    await db.as(mec, (sql) => sql`update service_order_checklist set result = 'necessita_reparo', note = 'Bucha rachada' where service_order_id = ${orderId} and item_name = 'Buchas'`);
    await status(orderId, "em_diagnostico", mec);
    await db.as(mec, (sql) => sql`insert into diagnoses (service_order_id, root_cause) values (${orderId}, 'Bucha da bandeja')`);
    await status(orderId, "diagnostico_concluido", mec);
    const [d] = await db.owner`select completed_at from diagnoses where service_order_id = ${orderId}`;
    expect(d.completed_at).not.toBeNull();

    // mecânico cadastra serviço sem preço
    const [item] = await db.as(mec, (sql) => sql`insert into service_items (service_order_id, title, part_name, quantity, part_unit_price_cents, labor_price_cents, priority)
      values (${orderId}, 'Troca de buchas', 'Bucha bandeja', 2, 99999, 99999, 'urgente') returning *`);
    expect(Number(item.part_unit_price_cents)).toBe(0);
    await expect(db.as(mec, (sql) => sql`update service_items set labor_price_cents = 5000 where id = ${item.id}`)).rejects.toThrow(/não altera valores/);
    await expect(db.as(mec, (sql) => sql`update service_items set approval_status = 'aprovado' where id = ${item.id}`)).rejects.toThrow(/permission denied/);

    await status(orderId, "orcamento_em_preparacao", atend);
    await db.as(atend, (sql) => sql`update service_items set part_unit_price_cents = 8500, labor_price_cents = 12000 where id = ${item.id}`);
    const [item2] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title, labor_price_cents, priority) values (${orderId}, 'Alinhamento', 8000, 'pode_acompanhar') returning id`);

    await status(orderId, "aguardando_aprovacao", atend);
    await expect(status(orderId, "servico_aprovado", atend)).rejects.toThrow(/sem decisão/);

    await db.as(atend, (sql) => sql`select app.record_decision(${item.id}, 'aprovado', 'whatsapp', 'Cliente aprovou por mensagem')`);
    await db.as(atend, (sql) => sql`select app.record_decision(${item2.id}, 'recusado', 'whatsapp', null)`);
    const [dec] = await db.owner`select approved_total_cents, recorded_by from service_item_decisions where service_item_id = ${item.id}`;
    expect(Number(dec.approved_total_cents)).toBe(2 * 8500 + 12000);
    expect(dec.recorded_by).toBe(atend.id);
    await expect(db.as(atend, (sql) => sql`update service_items set labor_price_cents = 1 where id = ${item.id}`)).rejects.toThrow(/já foi decidido/);

    await status(orderId, "servico_aprovado", atend);
    await status(orderId, "em_manutencao", mec);
    await status(orderId, "aguardando_peca", mec);
    await status(orderId, "em_manutencao", atend);
    await status(orderId, "em_teste", mec);
    await expect(status(orderId, "servico_concluido", mec)).rejects.toThrow(/não finalizados/);
    await expect(db.as(mec, (sql) => sql`select app.set_execution(${item2.id}, 'executado', null)`)).rejects.toThrow(/aprovados/);
    await db.as(mec, (sql) => sql`select app.set_execution(${item.id}, 'executado', 'Buchas trocadas')`);
    await status(orderId, "servico_concluido", mec);
    await expect(status(orderId, "pronto_retirada", mec)).rejects.toThrow(/perfil não pode/);
    await status(orderId, "pronto_retirada", atend);

    // mecânico não edita mais a OS
    await expect(db.as(mec, (sql) => sql`insert into service_order_notes (service_order_id, body) values (${orderId}, 'x')`)).rejects.toThrow(/row-level security/);

    await status(orderId, "entregue", atend);
    await expect(status(orderId, "em_manutencao", admin, "reabrir")).rejects.toThrow(/entregue/);

    const hist = await db.owner`select to_status from service_order_status_history where service_order_id = ${orderId} order by changed_at, id`;
    expect(hist.map((h) => h.to_status)).toEqual([
      "recebido", "em_inspecao", "em_diagnostico", "diagnostico_concluido", "orcamento_em_preparacao",
      "aguardando_aprovacao", "servico_aprovado", "em_manutencao", "aguardando_peca", "em_manutencao",
      "em_teste", "servico_concluido", "pronto_retirada", "entregue",
    ]);
    const [so] = await db.owner`select completed_at, delivered_at from service_orders where id = ${orderId}`;
    expect(so.completed_at).not.toBeNull();
    expect(so.delivered_at).not.toBeNull();

    const msgs = await db.owner`select trigger_status from outbound_messages where service_order_id = ${orderId} order by created_at`;
    expect(msgs.map((m) => m.trigger_status)).toEqual(["recebido", "em_diagnostico", "aguardando_aprovacao", "em_manutencao", "em_manutencao", "pronto_retirada"]);

    const durations = await db.as(admin, (sql) => sql`select status, hours, is_current from v_status_durations where service_order_id = ${orderId}`);
    expect(durations).toHaveLength(14);
    expect(durations.filter((d) => d.is_current)).toHaveLength(1);
  });

  it("voltar etapa e cancelar exigem motivo e perfil de atendimento", async () => {
    const { orderId } = await newOrder({ plate: "HHH7H77" });
    await status(orderId, "em_diagnostico", mec);
    await expect(status(orderId, "recebido", mec, "voltar")).rejects.toThrow(/voltar etapas/);
    await expect(status(orderId, "recebido", atend)).rejects.toThrow(/motivo/);
    await status(orderId, "recebido", atend, "Cliente pediu reavaliação");
    await expect(status(orderId, "cancelada", atend)).rejects.toThrow(/motivo/);
    await status(orderId, "cancelada", atend, "Cliente desistiu");
    await status(orderId, "entregue", atend);
  });

  it("todos os itens recusados liberam o carro sem serviço", async () => {
    const { orderId } = await newOrder({ plate: "III8I88" });
    for (const s of ["em_diagnostico", "diagnostico_concluido"]) await status(orderId, s, mec);
    await status(orderId, "orcamento_em_preparacao", atend);
    await expect(status(orderId, "aguardando_aprovacao", atend)).rejects.toThrow(/ao menos um serviço/);
    const [it] = await db.as(atend, (sql) => sql`insert into service_items (service_order_id, title, labor_price_cents) values (${orderId}, 'Revisão', 30000) returning id`);
    await status(orderId, "aguardando_aprovacao", atend);
    await db.as(atend, (sql) => sql`select app.record_decision(${it.id}, 'recusado', 'presencial', null)`);
    await expect(status(orderId, "servico_aprovado", atend)).rejects.toThrow(/Nenhum serviço/);
    await status(orderId, "pronto_retirada", atend);
  });

  it("transições disponíveis por perfil", async () => {
    const { orderId } = await newOrder({ plate: "JJJ9J99" });
    const forMec = await db.as(mec, (sql) => sql`select to_status, kind from app.available_transitions(${orderId})`);
    expect(forMec.map((r) => r.to_status)).toEqual(["em_inspecao", "em_diagnostico"]);
    const forAtend = await db.as(atend, (sql) => sql`select to_status, kind from app.available_transitions(${orderId})`);
    expect(forAtend.map((r) => r.kind)).toEqual(["cancelar"]);
    const forGestao = await db.as(gestao, (sql) => sql`select * from app.available_transitions(${orderId})`);
    expect(forGestao).toHaveLength(0);
  });
});

describe("mídia", () => {
  it("vincula ao veículo e ao usuário; só admin exclui (logicamente)", async () => {
    const { orderId, vehicleId } = await newOrder({ plate: "KKK1K11" });
    const [entry] = await db.owner`select id from service_order_checklist where service_order_id = ${orderId} limit 1`;
    const [m] = await db.as(mec, (sql) => sql`insert into media (service_order_id, checklist_entry_id, kind, storage_path, mime_type, size_bytes)
      values (${orderId}, ${entry.id}, 'foto', ${"x/" + orderId + "/1.jpg"}, 'image/jpeg', 1000) returning *`);
    expect(m.vehicle_id).toBe(vehicleId);
    expect(m.uploaded_by).toBe(mec.id);
    await expect(db.as(mec, (sql) => sql`select app.soft_delete_media(${m.id}, 'erro')`)).rejects.toThrow(/permissão/);
    await db.as(admin, (sql) => sql`select app.soft_delete_media(${m.id}, 'foto errada')`);
    const [after] = await db.owner`select deleted_at, deleted_by from media where id = ${m.id}`;
    expect(after.deleted_by).toBe(admin.id);
  });

  it("não aceita vínculo com item de outra OS", async () => {
    const a = await newOrder({ plate: "LLL2L22" });
    const b = await newOrder({ plate: "MMM3M33" });
    const [entry] = await db.owner`select id from service_order_checklist where service_order_id = ${b.orderId} limit 1`;
    await expect(db.as(mec, (sql) => sql`insert into media (service_order_id, checklist_entry_id, kind, storage_path, mime_type, size_bytes)
      values (${a.orderId}, ${entry.id}, 'foto', 'y/1.jpg', 'image/jpeg', 10)`)).rejects.toThrow(/não pertence/);
  });
});

describe("alertas", () => {
  it("OS parada aparece como sem atualização", async () => {
    const { orderId } = await newOrder({ plate: "NNN4N44" });
    await status(orderId, "em_inspecao", mec);
    await db.owner`update service_orders set last_activity_at = now() - interval '6 hours' where id = ${orderId}`;
    const alerts = await db.as(admin, (sql) => sql`select kind from v_alerts where service_order_id = ${orderId}`);
    expect(alerts.map((a) => a.kind)).toContain("sem_atualizacao");
  });

  it("pronto sem aviso ao cliente", async () => {
    const { orderId } = await newOrder({ plate: "OOO5O55", optIn: false });
    await db.owner`update service_orders set status = 'pronto_retirada', status_changed_at = now() - interval '2 hours' where id = ${orderId}`;
    const alerts = await db.as(atend, (sql) => sql`select kind from v_alerts where service_order_id = ${orderId}`);
    expect(alerts.map((a) => a.kind)).toContain("pronto_sem_aviso");
  });
});

describe("mensagens", () => {
  it("modo manual: marcar enviada registra usuário", async () => {
    const { orderId } = await newOrder({ plate: "PPP6P66" });
    const [m] = await db.owner`select id from outbound_messages where service_order_id = ${orderId}`;
    await expect(db.as(mec, (sql) => sql`select app.message_mark_sent(${m.id})`)).rejects.toThrow(/permissão/);
    await db.as(atend, (sql) => sql`select app.message_mark_sent(${m.id})`);
    const [after] = await db.owner`select status, sent_by from outbound_messages where id = ${m.id}`;
    expect(after.status).toBe("enviada");
    expect(after.sent_by).toBe(atend.id);
  });

  it("Cloud API: fila, retorno e webhook de status", async () => {
    await db.owner`update settings set value = '"cloud_api"' where key = 'messaging.provider'`;
    await db.owner`update message_templates set meta_template_name = 'veiculo_recebido' where trigger_status = 'recebido'`;
    const { orderId } = await newOrder({ plate: "QQQ7Q77" });
    const claimed = await db.as(null, (sql) => sql`select * from app.outbox_claim(10)`);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].meta_template_name).toBe("veiculo_recebido");
    expect(claimed[0].variables.nome).toBe("Maria");
    await db.as(null, (sql) => sql`select app.outbox_complete(${claimed[0].id}, true, 'wamid.TEST1', null)`);
    const payload = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.TEST1", status: "read", timestamp: "1700000000" }] } }] }] };
    const [{ n }] = await db.as(null, (sql) => sql`select app.whatsapp_ingest(${sql.json(payload)}) as n`);
    expect(n).toBe(1);
    const [msg] = await db.owner`select status, read_at from outbound_messages where service_order_id = ${orderId}`;
    expect(msg.status).toBe("lida");
    await db.owner`update settings set value = '"manual"' where key = 'messaging.provider'`;
  });
});

describe("LGPD", () => {
  it("anonimiza cliente e remove dados pessoais da auditoria", async () => {
    const { customerId, orderId } = await newOrder({ plate: "RRR8R88" });
    await expect(db.as(admin, (sql) => sql`select app.anonymize_customer(${customerId})`)).rejects.toThrow(/OS aberta/);
    await status(orderId, "cancelada", atend, "teste");
    await status(orderId, "entregue", atend);
    await expect(db.as(atend, (sql) => sql`select app.anonymize_customer(${customerId})`)).rejects.toThrow(/permissão/);
    await db.as(admin, (sql) => sql`select app.anonymize_customer(${customerId})`);
    const [c] = await db.owner`select name, phone, whatsapp from customers where id = ${customerId}`;
    expect(c).toEqual({ name: "Cliente anonimizado", phone: null, whatsapp: null });
    const audits = await db.owner`select old_data, new_data from audit_log where table_name = 'customers' and record_id = ${customerId}`;
    expect(JSON.stringify(audits)).not.toContain("988887777");
    expect(JSON.stringify(audits)).not.toContain("Maria Souza");
    const [msg] = await db.owner`select to_phone from outbound_messages where customer_id = ${customerId} limit 1`;
    expect(msg.to_phone).toBe("anonimizado");
  });
});
