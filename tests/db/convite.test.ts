import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupDb, type TestUser } from "./helpers";

let db: Awaited<ReturnType<typeof setupDb>>;
let admin: TestUser, atend: TestUser, mec: TestUser;
const h = (t: string) => createHash("sha256").update(t).digest("hex");

beforeAll(async () => {
  db = await setupDb();
  admin = await db.createUser("admin", "admin");
  atend = await db.createUser("ana", "atendimento");
  mec = await db.createUser("joao", "mecanico");
});
afterAll(async () => db?.close());

describe("convite de acesso", () => {
  it("só o administrador gera convite; o banco guarda só o hash", async () => {
    await expect(db.as(atend, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("a")})`)).rejects.toThrow();
    await expect(db.as(mec, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("a")})`)).rejects.toThrow();
    await db.as(admin, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("convite-1")})`);
    const [i] = await db.owner`select token_hash, expires_at - created_at as dur from app.user_invites where user_id = ${mec.id}`;
    expect(i.token_hash).toBe(h("convite-1"));
    // a aplicação não lê a tabela de convites diretamente
    await expect(db.as(admin, (sql) => sql`select * from app.user_invites`)).rejects.toThrow(/permission denied/);
  });

  it("aceitar troca a senha, encerra sessões antigas, registra na auditoria e não serve de novo", async () => {
    await db.owner`insert into app.sessions (token_hash, user_id, expires_at) values (${h("sessao-velha")}, ${mec.id}, now() + interval '1 day')`;
    const [look] = await db.as(null, (sql) => sql`select * from app.invite_lookup(${h("convite-1")})`);
    expect(look.username).toBe("joao");
    const [r] = await db.as(null, (sql) => sql`select app.invite_accept(${h("convite-1")}, 'scrypt$hash-novo') as id`);
    expect(r.id).toBe(mec.id);
    const [c] = await db.owner`select password_hash, must_change_password from app.user_credentials where user_id = ${mec.id}`;
    expect(c).toMatchObject({ password_hash: "scrypt$hash-novo", must_change_password: false });
    expect(await db.owner`select 1 from app.sessions where user_id = ${mec.id}`).toHaveLength(0);
    expect(await db.owner`select 1 from audit_log where table_name = 'user_credentials' and record_id = ${mec.id}::text and 'convite_usado' = any(changed_fields)`).toHaveLength(1);
    await expect(db.as(null, (sql) => sql`select app.invite_accept(${h("convite-1")}, 'x')`)).rejects.toThrow(/expirou ou já foi usado/);
    expect(await db.as(null, (sql) => sql`select * from app.invite_lookup(${h("convite-1")})`)).toHaveLength(0);
  });

  it("novo convite cancela o anterior; vencido ou de usuário desativado não funciona", async () => {
    await db.as(admin, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("c2")})`);
    await db.as(admin, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("c3")})`);
    await expect(db.as(null, (sql) => sql`select app.invite_accept(${h("c2")}, 'x')`)).rejects.toThrow(/expirou/);
    await db.owner`update app.user_invites set expires_at = now() - interval '1 minute' where token_hash = ${h("c3")}`;
    await expect(db.as(null, (sql) => sql`select app.invite_accept(${h("c3")}, 'x')`)).rejects.toThrow(/expirou/);
    await db.as(admin, (sql) => sql`select app.admin_create_invite(${mec.id}, ${h("c4")})`);
    await db.owner`update profiles set active = false where id = ${mec.id}`;
    await expect(db.as(null, (sql) => sql`select app.invite_accept(${h("c4")}, 'x')`)).rejects.toThrow(/expirou/);
    await db.owner`update profiles set active = true where id = ${mec.id}`;
    const [a] = await db.as(admin, (sql) => sql`select * from app.admin_users_access() where user_id = ${mec.id}`);
    expect(a.invite_expires_at).not.toBeNull();
    await db.as(admin, (sql) => sql`select app.admin_revoke_invite(${mec.id})`);
    await expect(db.as(null, (sql) => sql`select app.invite_accept(${h("c4")}, 'x')`)).rejects.toThrow(/expirou/);
  });
});
