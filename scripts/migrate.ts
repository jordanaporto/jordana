/**
 * Aplica as migrações SQL de db/migrations em ordem.
 *   DATABASE_ADMIN_URL  conexão do dono do banco (cria tabelas, funções, políticas)
 *   DATABASE_URL        conexão usada pela aplicação (usuário injecar_app — criado aqui se não existir)
 * Uso: npm run db:migrate            aplica pendentes
 *      npm run db:reset              APAGA tudo e recria (somente desenvolvimento/testes)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "./env";

loadEnv();

export async function migrate(opts: { reset?: boolean; adminUrl?: string; appUrl?: string; quiet?: boolean } = {}) {
  const adminUrl = opts.adminUrl ?? process.env.DATABASE_ADMIN_URL;
  const appUrl = opts.appUrl ?? process.env.DATABASE_URL;
  if (!adminUrl || !appUrl) throw new Error("Defina DATABASE_ADMIN_URL e DATABASE_URL");
  const log = (...a: unknown[]) => !opts.quiet && console.log(...a);

  const app = new URL(appUrl);
  if (decodeURIComponent(app.username) !== "injecar_app") {
    throw new Error("DATABASE_URL deve usar o usuário injecar_app");
  }
  const appPassword = decodeURIComponent(app.password);
  if (appPassword.length < 12) throw new Error("A senha do usuário injecar_app precisa ter ao menos 12 caracteres");

  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    if (opts.reset) {
      if (process.env.NODE_ENV === "production") throw new Error("reset proibido em produção");
      log("• apagando schemas public e app");
      await sql.unsafe(`drop schema if exists app cascade; drop schema if exists public cascade; create schema public;`);
      await sql.unsafe(`drop table if exists schema_migrations`);
    }

    await sql.unsafe(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'injecar_app') then
          create role injecar_app login noinherit nobypassrls;
        end if;
      end $$;`);
    await sql.unsafe(`alter role injecar_app with login password ${quoteLiteral(appPassword)}`);
    await sql.unsafe(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    await sql.unsafe(`revoke all on public.schema_migrations from injecar_app`);

    const dir = path.resolve(process.cwd(), "db/migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const applied = new Set((await sql`select name from public.schema_migrations`).map((r) => r.name as string));

    for (const file of files) {
      if (applied.has(file)) continue;
      const body = await readFile(path.join(dir, file), "utf8");
      log(`• aplicando ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public.schema_migrations (name) values (${file})`;
      });
    }
    log("✓ banco atualizado");
  } finally {
    await sql.end();
  }
}

function quoteLiteral(v: string) {
  return "'" + v.replace(/'/g, "''") + "'";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith("migrate.ts");
if (isMain) {
  migrate({ reset: process.argv.includes("--reset") }).catch((e) => {
    console.error("✗", e.message ?? e);
    process.exit(1);
  });
}
