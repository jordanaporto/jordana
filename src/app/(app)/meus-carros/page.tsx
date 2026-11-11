import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { listOpenOrders } from "@/lib/queries/orders";
import type { OsStatus } from "@/lib/status";
import { OrderCard } from "@/components/order-card";
import { Empty, PageHeader, cx } from "@/components/ui";

export const metadata = { title: "Meus carros" };

const TODO: OsStatus[] = ["recebido", "em_inspecao", "em_diagnostico", "servico_aprovado", "em_manutencao", "em_teste"];
const WAITING: OsStatus[] = ["diagnostico_concluido", "orcamento_em_preparacao", "aguardando_aprovacao", "aguardando_peca"];

export default async function MyCarsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireUser(["mecanico", "admin"]);
  const tab = (await searchParams).aba ?? "fazer";
  const orders = await asUser(user.id, (sql) => listOpenOrders(sql, { mechanicId: user.id, includeDeliveredToday: true }));

  const sets = {
    fazer: orders.filter((o) => TODO.includes(o.status)),
    aguardando: orders.filter((o) => WAITING.includes(o.status)),
    concluidos: orders.filter((o) => !TODO.includes(o.status) && !WAITING.includes(o.status)),
  };
  const tabs = [
    { key: "fazer", label: "Para fazer", n: sets.fazer.length },
    { key: "aguardando", label: "Aguardando", n: sets.aguardando.length },
    { key: "concluidos", label: "Concluídos", n: sets.concluidos.length },
  ] as const;
  const list = sets[tab as keyof typeof sets] ?? sets.fazer;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Meus carros" subtitle={`Olá, ${user.fullName.split(" ")[0]}`} />
      <div className="mb-4 grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/meus-carros?aba=${t.key}`}
            className={cx(
              "tap flex flex-col items-center justify-center rounded-xl border-2 text-sm font-semibold",
              tab === t.key ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white",
            )}
          >
            <span className="text-2xl font-bold leading-none">{t.n}</span>
            {t.label}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title={tab === "fazer" ? "Nenhum carro para você agora" : "Nada por aqui"} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((o) => (
            <OrderCard key={o.id} o={o} showMechanic={false} />
          ))}
        </div>
      )}
    </div>
  );
}
