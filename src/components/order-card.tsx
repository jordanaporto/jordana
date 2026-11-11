import Link from "next/link";
import { Camera, ClipboardCheck, Clock, User } from "lucide-react";
import { date, duration, km, osNumber } from "@/lib/format";
import type { OsStatus } from "@/lib/status";
import { Badge, Plate, StatusChip, cx } from "./ui";

export type OrderRow = {
  id: string;
  number: number;
  status: OsStatus;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  customer_name: string;
  mechanic_name: string | null;
  entry_at: string | Date;
  entry_km: number;
  complaint: string;
  hours_in_status: number;
  hours_since_activity: number;
  checklist_total: number;
  checklist_done: number;
  checklist_repair: number;
  media_count: number;
  alert_count?: number;
};

/** Cartão grande de OS (pátio e "meus carros") */
export function OrderCard({ o, showMechanic = true }: { o: OrderRow; showMechanic?: boolean }) {
  const stale = Number(o.alert_count ?? 0) > 0;
  return (
    <Link
      href={`/os/${o.id}`}
      className={cx(
        "block rounded-2xl border-2 bg-white p-4 shadow-sm transition active:scale-[0.99]",
        stale ? "border-amber-400" : "border-zinc-200 hover:border-zinc-400",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Plate plate={o.plate} />
        <span className="text-sm font-semibold text-zinc-500">{osNumber(o.number)}</span>
      </div>
      <div className="mt-2 text-lg font-bold leading-tight">
        {o.brand} {o.model} {o.year ?? ""}
      </div>
      <div className="truncate text-sm text-zinc-600">{o.customer_name}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusChip status={o.status} size="sm" />
        <span className={cx("inline-flex items-center gap-1 text-xs font-semibold", stale ? "text-amber-700" : "text-zinc-500")}>
          <Clock className="size-3.5" aria-hidden /> há {duration(o.hours_in_status)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
        {showMechanic && (
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" aria-hidden /> {o.mechanic_name ?? "Sem mecânico"}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <ClipboardCheck className="size-3.5" aria-hidden /> {o.checklist_done}/{o.checklist_total}
          {o.checklist_repair > 0 && <Badge className="ml-1 bg-brand text-white">{o.checklist_repair} reparo</Badge>}
        </span>
        <span className="inline-flex items-center gap-1">
          <Camera className="size-3.5" aria-hidden /> {o.media_count}
        </span>
      </div>
    </Link>
  );
}

/** Linha compacta de OS (históricos) */
export function OrderLine({ o }: { o: Pick<OrderRow, "id" | "number" | "status" | "entry_at" | "entry_km" | "complaint" | "plate" | "model"> }) {
  return (
    <Link href={`/os/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-400">
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {osNumber(o.number)} · {date(o.entry_at)} · {km(o.entry_km)}
        </div>
        <div className="truncate text-sm text-zinc-600">{o.complaint}</div>
      </div>
      <StatusChip status={o.status} size="sm" />
    </Link>
  );
}
