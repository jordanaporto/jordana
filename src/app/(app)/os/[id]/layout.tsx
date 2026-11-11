import Link from "next/link";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { duration, km, osNumber } from "@/lib/format";
import type { OsStatus } from "@/lib/status";
import { Plate, StatusChip } from "@/components/ui";
import { OrderTabs } from "@/components/order-tabs";
import { StatusBar } from "@/components/status-bar";
import { MediaUploader } from "@/components/media-uploader";

export default async function OrderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order, transitions, canEdit } = await getOrderContext(id);
  const staff = can.staff(user.role);

  const tabs = [
    { href: `/os/${id}`, label: "Resumo" },
    { href: `/os/${id}/checklist`, label: `Checklist ${order.checklist_done}/${order.checklist_total}` },
    { href: `/os/${id}/fotos`, label: `Fotos (${order.media_count})` },
    { href: `/os/${id}/diagnostico`, label: "Diagnóstico" },
    { href: `/os/${id}/servicos`, label: `Serviços (${order.items_count})` },
    { href: `/os/${id}/historico`, label: "Linha do tempo" },
    ...(can.readAll(user.role) ? [{ href: `/os/${id}/mensagens`, label: "Mensagens" }] : []),
    ...(can.readAll(user.role) ? [{ href: `/os/${id}/relatorio`, label: "Relatório" }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="-mx-4 -mt-4 mb-3 bg-white px-4 pb-3 pt-4 shadow-sm lg:mx-0 lg:mt-0 lg:rounded-2xl">
        <div className="flex items-center justify-between gap-2 text-sm">
          <Link href={user.role === "mecanico" ? "/meus-carros" : "/patio"} className="font-medium text-zinc-500">
            ← Voltar
          </Link>
          <span className="font-semibold text-zinc-500">{osNumber(order.number)}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Link href={`/veiculos/${order.vehicle_id}`} aria-label="Ficha do veículo">
            <Plate plate={order.plate} size="lg" />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight">
              {order.brand} {order.model} {order.year ?? ""}
            </div>
            <div className="truncate text-sm text-zinc-600">{order.customer_name}</div>
            <div className="text-sm text-zinc-500">{km(order.entry_km)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip status={order.status as OsStatus} size="lg" />
          <span className="text-sm text-zinc-600">há {duration(order.hours_in_status)}</span>
          <span className="text-sm text-zinc-600">· {order.mechanic_name ?? "sem mecânico"}</span>
        </div>
      </div>

      <OrderTabs tabs={tabs} />
      <div className="mt-4">{children}</div>

      <StatusBar
        orderId={id}
        current={order.status as OsStatus}
        transitions={transitions}
        isStaff={staff}
      />
      {canEdit && <MediaUploader orderId={id} variant="fab" />}
    </div>
  );
}
