import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN, ROLE_LABEL, type Role } from "@/lib/roles";
import { dateTime } from "@/lib/format";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { CreateUserForm, EditUserForm } from "./forms";

export const metadata = { title: "Usuários" };

export default async function UsersPage() {
  const admin = await requireUser(ADMIN);
  const { users, access } = await asUser(admin.id, async (sql) => ({
    users: await sql`
      select id, username, full_name, role, phone, active, created_at
        from profiles order by active desc, role, full_name`,
    access: await sql`select * from app.admin_users_access()`,
  }));
  const acc = new Map(access.map((a) => [a.user_id as string, a]));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Usuários" subtitle="Cada pessoa tem seu próprio login. Usuários desativados perdem o acesso na hora." back="/admin/config" />
      <SectionTitle>Novo usuário</SectionTitle>
      <Card>
        <CreateUserForm />
      </Card>
      <SectionTitle>Equipe ({users.length})</SectionTitle>
      <div className="space-y-2">
        {users.map((u) => (
          <details key={u.id} className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-semibold">
                  {u.full_name} {!u.active && <Badge className="ml-1 bg-zinc-200 text-zinc-700">inativo</Badge>}
                </div>
                <div className="text-sm text-zinc-600">
                  {u.username} · {ROLE_LABEL[u.role as Role]} · desde {dateTime(u.created_at)}
                </div>
                {u.active && acc.get(u.id)?.invite_expires_at ? (
                  <div className="text-sm font-semibold text-amber-700">Convite enviado · aguardando criar a senha</div>
                ) : u.active && acc.get(u.id)?.must_change_password ? (
                  <div className="text-sm font-semibold text-amber-700">Ainda não fez o primeiro acesso</div>
                ) : null}
              </div>
              <span className="text-sm font-semibold text-brand group-open:hidden">Editar</span>
            </summary>
            <div className="border-t border-zinc-100 p-4">
              <EditUserForm
                user={{ id: u.id, full_name: u.full_name, username: u.username, role: u.role, phone: u.phone ?? "", active: u.active }}
                isSelf={u.id === admin.id}
                inviteUntil={acc.get(u.id)?.invite_expires_at ? new Date(acc.get(u.id)!.invite_expires_at).toISOString() : null}
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
