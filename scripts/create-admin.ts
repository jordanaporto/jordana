/**
 * Cria (ou redefine a senha de) um administrador.
 * Uso: npm run db:create-admin -- <usuario> "<Nome Completo>" <senha>
 */
import postgres from "postgres";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { loadEnv } from "./env";

loadEnv();

async function main() {
  const [username, fullName, password] = process.argv.slice(2);
  if (!username || !fullName || !password) {
    console.error('Uso: npm run db:create-admin -- <usuario> "<Nome Completo>" <senha>');
    process.exit(1);
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Usuário inválido (3-30 letras minúsculas, números, . _ -)");
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(weak);

  const sql = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1, onnotice: () => {} });
  try {
    const hash = await hashPassword(password);
    await sql.begin(async (tx) => {
      const [existing] = await tx`select id from profiles where username = ${username}`;
      let id = existing?.id as string | undefined;
      if (id) {
        await tx`update profiles set role = 'admin', active = true, full_name = ${fullName} where id = ${id}`;
        await tx`update app.user_credentials set password_hash = ${hash}, must_change_password = false, updated_at = now() where user_id = ${id}`;
      } else {
        [{ id }] = await tx`insert into profiles (username, full_name, role) values (${username}, ${fullName}, 'admin') returning id`;
        await tx`insert into app.user_credentials (user_id, password_hash) values (${id!}, ${hash})`;
      }
    });
    console.log(`✓ administrador "${username}" pronto`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
