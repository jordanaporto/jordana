/**
 * Etapa de publicação no Netlify (demonstração): descobre o pooler do Supabase,
 * aplica as migrações, cria o administrador e, se DEMO_SEED=true, carrega os dados
 * de demonstração.
 */
import postgres from "postgres";
import { adminDatabaseUrl, appDatabaseUrl } from "../src/lib/db-url";
import { createAdmin } from "./create-admin";
import { seedDemo } from "./demo-data";
import { migrate } from "./migrate";

async function findPoolerHost(): Promise<string | null> {
  const ref = process.env.SUPABASE_REF;
  const pw = process.env.DB_ADMIN_PASSWORD;
  const candidates = (process.env.DB_POOLER_CANDIDATES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ref || !pw || candidates.length === 0) return null;
  for (const host of candidates) {
    const sql = postgres(`postgres://injecar_admin.${ref}:${encodeURIComponent(pw)}@${host}:5432/postgres?sslmode=require`, {
      max: 1,
      connect_timeout: 10,
      onnotice: () => {},
    });
    try {
      await sql`select 1`;
      console.log(`✓ pooler do Supabase: ${host}`);
      return host;
    } catch (e) {
      console.log(`· pooler ${host} recusou: ${(e as Error).message}`);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  }
  return null;
}

async function main() {
  if (!process.env.DB_POOLER_HOST) {
    const host = await findPoolerHost();
    if (host) process.env.DB_POOLER_HOST = host;
  }
  const admin = adminDatabaseUrl();
  const app = appDatabaseUrl();
  if (!admin || !app) {
    console.warn("⚠ Banco não configurado nesta publicação — migrações puladas.");
    return;
  }
  await migrate({ adminUrl: admin, appUrl: app });
  const pw = process.env.DEMO_ADMIN_PASSWORD;
  if (pw) await createAdmin("admin", "Administrador", pw);
  if (process.env.DEMO_SEED === "true") await seedDemo();
  console.log(`✓ banco pronto (DB_POOLER_HOST=${process.env.DB_POOLER_HOST ?? "-"})`);
}

main().catch((e) => {
  console.error("✗ falha ao preparar o banco:", e.message ?? e);
  process.exit(1);
});
