import postgres from "postgres";
import { migrate } from "../../scripts/migrate";

export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/injecar_test";
export const APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://injecar_app:dev-app-password-123@localhost:5432/injecar_test";

export type Role = "mecanico" | "atendimento" | "admin" | "gestao";
export type TestUser = { id: string; username: string; role: Role };

export async function setupDb() {
  await migrate({ reset: true, adminUrl: ADMIN_URL, appUrl: APP_URL, quiet: true });
  const owner = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  const app = postgres(APP_URL, { max: 4, onnotice: () => {} });

  async function createUser(username: string, role: Role): Promise<TestUser> {
    const [u] = await owner`insert into profiles (username, full_name, role) values (${username}, ${"Usuário " + username}, ${role}) returning id`;
    await owner`insert into app.user_credentials (user_id, password_hash) values (${u.id}, 'x')`;
    return { id: u.id, username, role };
  }

  /** Executa como um usuário: conexão injecar_app + app.user_id na transação. */
  async function as<T>(user: TestUser | null, fn: (sql: postgres.TransactionSql) => Promise<T>): Promise<T> {
    return (await app.begin(async (tx) => {
      if (user) await tx`select set_config('app.user_id', ${user.id}, true)`;
      return fn(tx);
    })) as T;
  }

  async function close() {
    await owner.end();
    await app.end();
  }
  return { owner, app, createUser, as, close };
}
