import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processNotifications } from "@/lib/push";
import { processOutbox } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = env.cronSecret;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Endpoint para agendador externo (cron): fila de WhatsApp/lembretes e avisos no celular. */
export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse("não autorizado", { status: 401 });
  const whatsapp = await processOutbox(50);
  const push = await processNotifications();
  return NextResponse.json({ whatsapp, push });
}
