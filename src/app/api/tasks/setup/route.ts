import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { adminDatabaseUrl, appDatabaseUrl } from "@/lib/db-url";
import { createAdmin } from "../../../../../scripts/create-admin";
import { seedDemo } from "../../../../../scripts/demo-data";
import { migrate } from "../../../../../scripts/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Prepara o banco depois da publicação (usado na demonstração do Netlify quando
 * o banco só fica disponível em tempo de execução). Protegido por CRON_SECRET.
 * Aplica migrações pendentes; cria o admin e dados de demonstração se configurado.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return new NextResponse("não autorizado", { status: 401 });
  }
  const admin = adminDatabaseUrl();
  const app = appDatabaseUrl();
  if (!admin || !app) return NextResponse.json({ ok: false, error: "banco não configurado" }, { status: 500 });
  try {
    await migrate({ adminUrl: admin, appUrl: app, quiet: true, dir: path.join(process.cwd(), "db/migrations") });
    if (process.env.DEMO_ADMIN_PASSWORD) await createAdmin("admin", "Administrador", process.env.DEMO_ADMIN_PASSWORD);
    if (process.env.DEMO_SEED === "true") await seedDemo();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
