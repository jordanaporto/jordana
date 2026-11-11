import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processOutbox } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = env.cronSecret;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Endpoint para agendador externo (cron) processar a fila de WhatsApp. */
export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse("não autorizado", { status: 401 });
  const r = await processOutbox(50);
  return NextResponse.json(r);
}
