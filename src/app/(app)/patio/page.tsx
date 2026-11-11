import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, READ_ALL } from "@/lib/roles";
import { listOpenOrders } from "@/lib/queries/orders";
import { GROUP_STYLE, OPEN_STATUSES, STATUS_META, type OsStatus } from "@/lib/status";
import { OrderCard } from "@/components/order-card";
import { Empty, LinkButton, PageHeader, cx } from "@/components/ui";

export const metadata = { title: "Pátio" };

export default async function YardPage({ searchParams }: { searchParams: Promise<{ mecanico?: string; status?: string; alerta?: string }> }) {
  const user = await requireUser(READ_ALL);
  const sp = await searchParams;
  const { orders, mechanics } = await asUser(user.id, async (sql) => ({
    orders: await listOpenOrders(sql, { mechanicId: sp.mecanico && /^[0-9a-f-]{36}$/.test(sp.mecanico) ? sp.mecanico : null }),
    mechanics: await sql`select id, full_name from profiles where role = 'mecanico' and active order by full_name`,
  }));

  let filtered = orders;
  if (sp.status) filtered = filtered.filter((o) => o.status === sp.status);
  if (sp.alerta) filtered = filtered.filter((o) => (o.alert_count ?? 0) > 0);

  const groups = OPEN_STATUSES.map((s) => ({ status: s as OsStatus, items: filtered.filter((o) => o.status === s) })).filter(
    (g) => g.items.length > 0,
  );
  const alerts = orders.filter((o) => (o.alert_count ?? 0) > 0).length;

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      className={cx(
        "whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-sm font-semibold",
        active ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Pátio"
        subtitle={`${orders.length} veículo${orders.length === 1 ? "" : "s"} na oficina`}
        action={can.staff(user.role) ? <LinkButton href="/os/nova">+ Nova OS</LinkButton> : undefined}
      />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chip("Todos", "/patio", !sp.mecanico && !sp.alerta && !sp.status)}
        {chip(`⚠ Com alerta (${alerts})`, "/patio?alerta=1", Boolean(sp.alerta))}
        {mechanics.map((m) => chip(m.full_name.split(" ")[0], `/patio?mecanico=${m.id}`, sp.mecanico === m.id))}
      </div>

      {groups.length === 0 ? (
        <Empty title="Nenhum veículo aqui">Abra uma nova OS quando um carro chegar.</Empty>
      ) : (
        <div className="space-y-6 lg:flex lg:gap-4 lg:space-y-0 lg:overflow-x-auto lg:pb-4">
          {groups.map((g) => (
            <section key={g.status} className="lg:w-72 lg:shrink-0">
              <h2 className="mb-2 flex items-center gap-2 font-bold">
                <span className={cx("size-3 rounded-full", GROUP_STYLE[STATUS_META[g.status].group].dot)} />
                {STATUS_META[g.status].n}. {STATUS_META[g.status].label}
                <span className="text-zinc-500">({g.items.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {g.items.map((o) => (
                  <OrderCard key={o.id} o={o} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
