import { rm } from "node:fs/promises";
import postgres from "postgres";
import { migrate } from "../../scripts/migrate";
import { hashPassword } from "../../src/lib/auth/password";
import { E2E_ENV } from "../../playwright.config";
import { USERS } from "./users";

/** Banco limpo + usuários de teste para cada execução. */
export default async function globalSetup() {
  await migrate({ reset: true, adminUrl: E2E_ENV.DATABASE_ADMIN_URL, appUrl: E2E_ENV.DATABASE_URL, quiet: true });
  await rm(E2E_ENV.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  const sql = postgres(E2E_ENV.DATABASE_ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    for (const u of Object.values(USERS)) {
      const hash = await hashPassword(u.password);
      const [p] = await sql`insert into profiles (username, full_name, role) values (${u.username}, ${u.name}, ${u.role}) returning id`;
      await sql`insert into app.user_credentials (user_id, password_hash) values (${p.id}, ${hash})`;
    }
  } finally {
    await sql.end();
  }
}
