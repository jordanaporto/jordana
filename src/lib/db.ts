import "server-only";
import postgres from "postgres";
import { env } from "./env";

export type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __injecarSql?: postgres.Sql };

/** Pool de conexões com o usuário injecar_app (sujeito a RLS). */
export function pool(): postgres.Sql {
  if (!globalForDb.__injecarSql) {
    globalForDb.__injecarSql = postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
      transform: { undefined: null },
    });
  }
  return globalForDb.__injecarSql;
}

/**
 * Executa consultas em nome de um usuário: permissões, autoria e auditoria
 * do banco usam este app.user_id (válido só dentro da transação).
 */
export async function asUser<T>(userId: string, fn: (sql: Tx) => Promise<T>): Promise<T> {
  return (await pool().begin(async (tx) => {
    await tx`select set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  })) as T;
}

/** Operações sem usuário (login, fila de mensagens, webhook): só funções app.* liberadas. */
export async function asSystem<T>(fn: (sql: Tx) => Promise<T>): Promise<T> {
  return (await pool().begin(async (tx) => fn(tx))) as T;
}
