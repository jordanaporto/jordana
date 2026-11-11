/**
 * Endereços do banco.
 *  - Servidor próprio: DATABASE_URL / DATABASE_ADMIN_URL.
 *  - Supabase (demonstração): SUPABASE_REF + DB_POOLER_HOST + senhas; a aplicação usa o
 *    pooler em modo transação (porta 6543) e a manutenção, o modo sessão (porta 5432).
 *  - Netlify Database: NETLIFY_DB_URL (dono) + APP_DB_PASSWORD.
 */
import { POOLER_HOST } from "./pooler-host.generated";

type Env = Record<string, string | undefined>;

const poolerHost = (env: Env) => env.DB_POOLER_HOST || POOLER_HOST || undefined;

function supabaseUrl(user: string, password: string, host: string, port: number, ref: string) {
  return `postgres://${user}.${ref}:${encodeURIComponent(password)}@${host}:${port}/postgres?sslmode=require`;
}

export function adminDatabaseUrl(env: Env = process.env): string | undefined {
  if (env.DATABASE_ADMIN_URL) return env.DATABASE_ADMIN_URL;
  if (env.SUPABASE_REF && poolerHost(env) && env.DB_ADMIN_PASSWORD) {
    return supabaseUrl("injecar_admin", env.DB_ADMIN_PASSWORD, poolerHost(env)!, 5432, env.SUPABASE_REF);
  }
  return env.NETLIFY_DB_URL || undefined;
}

export function appDatabaseUrl(env: Env = process.env): string | undefined {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.SUPABASE_REF && poolerHost(env) && env.APP_DB_PASSWORD) {
    return supabaseUrl("injecar_app", env.APP_DB_PASSWORD, poolerHost(env)!, 6543, env.SUPABASE_REF);
  }
  const base = env.NETLIFY_DB_URL;
  const pw = env.APP_DB_PASSWORD;
  if (!base || !pw) return undefined;
  const u = new URL(base);
  u.username = "injecar_app";
  u.password = encodeURIComponent(pw);
  return u.toString();
}
