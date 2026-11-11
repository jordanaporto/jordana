import { NextResponse } from "next/server";
import { asSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verificação do webhook pela Meta (hub.challenge). */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && env.whatsapp.verifyToken && p.get("hub.verify_token") === env.whatsapp.verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Status de entrega/leitura das mensagens. Só aceita requisições assinadas pela Meta. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse("payload grande", { status: 413 });
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env.whatsapp.appSecret)) {
    return new NextResponse("assinatura inválida", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("json inválido", { status: 400 });
  }
  await asSystem((sql) => sql`select app.whatsapp_ingest(${sql.json(payload as never)})`);
  return NextResponse.json({ ok: true });
}
