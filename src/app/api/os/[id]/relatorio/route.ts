import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Baixa uma versão já gerada do relatório (somente perfis com acesso à OS e a relatórios). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("não autenticado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("inválido", { status: 400 });
  const v = Number(new URL(req.url).searchParams.get("versao") ?? 0);

  const [r] = await asUser(user.id, (sql) => sql`
    select r.storage_path, r.version, so.number, v.plate
      from reports r join service_orders so on so.id = r.service_order_id join vehicles v on v.id = so.vehicle_id
     where r.service_order_id = ${id} ${v > 0 ? sql`and r.version = ${v}` : sql``}
     order by r.version desc limit 1`);
  if (!r) return new NextResponse("relatório não encontrado", { status: 404 });

  const obj = await storage().get(r.storage_path);
  if (!obj) return new NextResponse("arquivo ausente", { status: 404 });
  const name = `OS${String(r.number).padStart(4, "0")}-${r.plate}-v${r.version}.pdf`;
  return new NextResponse(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(obj.contentLength),
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
