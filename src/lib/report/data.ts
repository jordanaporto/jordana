import "server-only";
import type { Tx } from "../db";
import { storage } from "../storage";

export type ReportData = Awaited<ReturnType<typeof loadReportData>>;

/** Reúne tudo o que vai no relatório final (respeitando as permissões do usuário). */
export async function loadReportData(sql: Tx, orderId: string) {
  const [order] = await sql`select * from v_orders where id = ${orderId}`;
  if (!order) return null;
  const [customer] = await sql`select name, phone, whatsapp, cpf from customers where id = ${order.customer_id}`;
  const [vehicle] = await sql`select * from vehicles where id = ${order.vehicle_id}`;
  const [company] = await sql`select value from settings where key = 'company'`;
  const checklist = await sql`
    select category_name, item_name, result, note from service_order_checklist
     where service_order_id = ${orderId} order by category_position, position, item_name`;
  const [diagnosis] = await sql`select * from diagnoses where service_order_id = ${orderId}`;
  const items = await sql`
    select si.*, app.item_total_cents(si) as total_cents, p.full_name as executed_by_name,
           (select json_build_object('method', d.method, 'decided_at', d.decided_at)
              from service_item_decisions d where d.service_item_id = si.id order by d.decided_at desc limit 1) as last_decision
      from service_items si left join profiles p on p.id = si.executed_by
     where si.service_order_id = ${orderId} and si.deleted_at is null
     order by case si.priority when 'urgente' then 0 when 'recomendado' then 1 else 2 end, si.created_at`;
  const history = await sql`
    select h.to_status, h.changed_at, h.note, p.full_name from service_order_status_history h
      left join profiles p on p.id = h.changed_by where h.service_order_id = ${orderId} order by h.changed_at, h.id`;
  const notes = await sql`
    select n.body, n.created_at, p.full_name from service_order_notes n left join profiles p on p.id = n.author_id
     where n.service_order_id = ${orderId} and not n.is_system order by n.created_at`;
  let photos = await sql`
    select m.id, m.storage_path, m.mime_type, m.caption, e.item_name from media m
      left join service_order_checklist e on e.id = m.checklist_entry_id
     where m.service_order_id = ${orderId} and m.deleted_at is null and m.kind = 'foto' and m.include_in_report
     order by m.created_at limit 12`;
  if (photos.length === 0) {
    photos = await sql`
      select m.id, m.storage_path, m.mime_type, m.caption, e.item_name from media m
        left join service_order_checklist e on e.id = m.checklist_entry_id
       where m.service_order_id = ${orderId} and m.deleted_at is null and m.kind = 'foto'
       order by m.created_at desc limit 6`;
  }
  const technicians = await sql`
    select distinct p.full_name from profiles p
     where p.id = ${order.assigned_mechanic_id}
        or p.id in (select executed_by from service_items where service_order_id = ${orderId} and executed_by is not null)`;
  return { order, customer, vehicle, company: (company?.value ?? {}) as Record<string, string>, checklist, diagnosis, items, history, notes, photos, technicians };
}

/** Carrega as imagens (JPEG/PNG — formatos aceitos pelo gerador de PDF). */
export async function loadReportImages(photos: { id: string; storage_path: string; mime_type: string; caption: string | null; item_name: string | null }[]) {
  const out: { data: Buffer; format: "jpg" | "png"; caption: string }[] = [];
  for (const p of photos) {
    if (p.mime_type !== "image/jpeg" && p.mime_type !== "image/png") continue;
    const buf = await storage().getBuffer(p.storage_path);
    if (!buf) continue;
    out.push({ data: buf, format: p.mime_type === "image/png" ? "png" : "jpg", caption: [p.item_name, p.caption].filter(Boolean).join(" — ") });
  }
  return out;
}
