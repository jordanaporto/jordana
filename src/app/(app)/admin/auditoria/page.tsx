import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN, ROLE_LABEL, type Role } from "@/lib/roles";
import { ACTION, AUDIT_LABEL } from "@/lib/audit";
import { dateTime, osNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Auditoria" };

const HIDDEN = new Set(["updated_at", "updated_by", "created_at", "created_by", "last_activity_at"]);
const PAGE = 50;

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "∅";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; os?: string; tabela?: string; de?: string; ate?: string; p?: string }>;
}) {
  const user = await requireUser(ADMIN);
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const osNum = Number(sp.os ?? "") || null;
  const userId = sp.usuario && /^[0-9a-f-]{36}$/.test(sp.usuario) ? sp.usuario : null;
  const table = sp.tabela && /^[a-z_]+$/.test(sp.tabela) ? sp.tabela : null;
  const from = sp.de && /^\d{4}-\d{2}-\d{2}$/.test(sp.de) ? sp.de : null;
  const to = sp.ate && /^\d{4}-\d{2}-\d{2}$/.test(sp.ate) ? sp.ate : null;

  const { rows, users } = await asUser(user.id, async (sql) => ({
    rows: await sql`
      select a.*, p.full_name, so.number
        from audit_log a
        left join profiles p on p.id = a.actor_id
        left join service_orders so on so.id = a.service_order_id
       where true
         ${userId ? sql`and a.actor_id = ${userId}` : sql``}
         ${osNum ? sql`and so.number = ${osNum}` : sql``}
         ${table ? sql`and a.table_name = ${table}` : sql``}
         ${from ? sql`and a.occurred_at >= (${from}::date at time zone 'America/Belem')` : sql``}
         ${to ? sql`and a.occurred_at < ((${to}::date + 1) at time zone 'America/Belem')` : sql``}
       order by a.id desc
       limit ${PAGE + 1} offset ${page * PAGE}`,
    users: await sql`select id, full_name, role from profiles order by full_name`,
  }));
  const hasMore = rows.length > PAGE;
  const q = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "p") as [string, string][]);
    if (p) u.set("p", String(p));
    return `/admin/auditoria?${u}`;
  };
  const sel = "min-h-11 rounded-xl border-2 border-zinc-300 bg-white px-3";

  return (
    <div>
      <PageHeader title="Auditoria" subtitle="Toda alteração no sistema: quem, quando, o que mudou (antes → depois)" back="/admin/config" />
      <form className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <select name="usuario" defaultValue={sp.usuario ?? ""} className={sel}>
          <option value="">Todos os usuários</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <input name="os" defaultValue={sp.os} placeholder="Nº da OS" inputMode="numeric" className={sel} />
        <select name="tabela" defaultValue={sp.tabela ?? ""} className={sel}>
          <option value="">Tudo</option>
          {Object.entries(AUDIT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={sp.de} className={sel} aria-label="De" />
        <input type="date" name="ate" defaultValue={sp.ate} className={sel} aria-label="Até" />
        <button className="min-h-11 rounded-xl bg-ink font-semibold text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="p-3">Quando</th>
              <th className="p-3">Quem</th>
              <th className="p-3">O quê</th>
              <th className="p-3">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 align-top">
            {rows.slice(0, PAGE).map((a) => {
              const fields: string[] = (a.changed_fields ?? []).filter((f: string) => !HIDDEN.has(f));
              return (
                <tr key={a.id}>
                  <td className="whitespace-nowrap p-3">{dateTime(a.occurred_at)}</td>
                  <td className="p-3">
                    {a.full_name ?? "Sistema"}
                    {a.actor_role && <div className="text-xs text-zinc-500">{ROLE_LABEL[a.actor_role as Role]}</div>}
                  </td>
                  <td className="p-3">
                    <b>{ACTION[a.action]}</b> {AUDIT_LABEL[a.table_name] ?? a.table_name}
                    {a.number && (
                      <div>
                        <Link href={`/os/${a.service_order_id}/historico`} className="text-brand underline">
                          {osNumber(a.number)}
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {a.action === "UPDATE" ? (
                      <ul className="space-y-0.5">
                        {fields.map((f) => (
                          <li key={f}>
                            <span className="font-semibold">{f}</span>: <span className="text-zinc-500 line-through">{show(a.old_data?.[f])}</span> →{" "}
                            {show(a.new_data?.[f])}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-600">
                        {show(
                          Object.fromEntries(
                            Object.entries((a.new_data ?? a.old_data ?? {}) as Record<string, unknown>).filter(([k, v]) => !HIDDEN.has(k) && k !== "id" && v !== null),
                          ),
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        {page > 0 ? <Link href={q(page - 1)} className="font-semibold text-brand">← Mais recentes</Link> : <span />}
        {hasMore && <Link href={q(page + 1)} className="font-semibold text-brand">Mais antigos →</Link>}
      </div>
    </div>
  );
}
