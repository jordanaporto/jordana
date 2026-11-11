import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exporta todos os dados de um cliente (direito de acesso — LGPD art. 18). Somente admin; fica na auditoria. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return new NextResponse("sem permissão", { status: 403 });
  const id = new URL(req.url).searchParams.get("customer") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("inválido", { status: 400 });

  const data = await asUser(user.id, async (sql) => {
    const [customer] = await sql`
      select name, phone, whatsapp, cpf, notes, whatsapp_opt_in, whatsapp_opt_in_at, created_at, anonymized_at
        from customers where id = ${id}`;
    if (!customer) return null;
    const vehicles = await sql`select plate, brand, model, version, year, color, current_km from vehicles where customer_id = ${id}`;
    const orders = await sql`
      select so.number, so.entry_at, so.entry_km, so.complaint, so.status, so.delivered_at, v.plate,
             (select json_agg(json_build_object('servico', si.title, 'peca', si.part_name, 'decisao', si.approval_status,
                                                'execucao', si.execution_status, 'valor_centavos', app.item_total_cents(si)))
                from service_items si where si.service_order_id = so.id and si.deleted_at is null) as servicos
        from service_orders so join vehicles v on v.id = so.vehicle_id
       where so.customer_id = ${id} order by so.entry_at`;
    const messages = await sql`select created_at, status, rendered_body from outbound_messages where customer_id = ${id} order by created_at`;
    await sql`
      insert into settings (key, value) values ('lgpd.last_export', ${sql.json({ customer: id, at: new Date().toISOString() })})
      on conflict (key) do update set value = excluded.value`;
    return { gerado_em: new Date().toISOString(), cliente: customer, veiculos: vehicles, atendimentos: orders, mensagens: messages };
  });
  if (!data) return new NextResponse("não encontrado", { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-cliente-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
