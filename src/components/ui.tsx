import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatPlate } from "@/lib/format";
import { GROUP_STYLE, STATUS_META, type OsStatus } from "@/lib/status";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "dark" | "outline" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  dark: "bg-ink text-white hover:bg-zinc-800",
  outline: "border-2 border-zinc-300 bg-white text-ink hover:border-zinc-500",
  ghost: "text-ink hover:bg-zinc-100",
  danger: "border-2 border-brand bg-white text-brand hover:bg-brand-50",
};

export function buttonClass(variant: BtnVariant = "primary", size: "md" | "lg" | "sm" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    size === "lg" && "tap px-5 text-lg",
    size === "md" && "min-h-12 px-4 text-base",
    size === "sm" && "min-h-9 px-3 text-sm",
    BTN[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: "md" | "lg" | "sm" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "md" | "lg" | "sm" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center text-sm font-medium text-zinc-500 hover:text-ink">
            ← Voltar
          </Link>
        )}
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-zinc-600">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Plate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cx(
        "plate inline-flex flex-col overflow-hidden rounded-md border-2 border-ink bg-white text-center font-bold leading-none",
        size === "sm" && "min-w-[82px] text-sm",
        size === "md" && "min-w-[104px] text-lg",
        size === "lg" && "min-w-[132px] text-2xl",
      )}
    >
      <span className={cx("bg-blue-800 font-sans font-semibold tracking-normal text-white", size === "lg" ? "text-[9px] py-0.5" : "text-[7px] py-px")}>
        BRASIL
      </span>
      <span className={cx(size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1")}>{formatPlate(plate)}</span>
    </span>
  );
}

export function StatusChip({ status, size = "md" }: { status: OsStatus; size?: "sm" | "md" | "lg" }) {
  const meta = STATUS_META[status];
  const style = GROUP_STYLE[meta.group];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        style.chip,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
      )}
    >
      {meta.n > 0 && <span className="opacity-80">{meta.n}</span>}
      {meta.label}
    </span>
  );
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", className)} {...props} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-zinc-600">{children}</div>}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "rounded-xl border px-4 py-3 text-sm font-medium",
        kind === "error" && "border-red-300 bg-red-50 text-red-900",
        kind === "success" && "border-green-300 bg-green-50 text-green-900",
        kind === "info" && "border-blue-200 bg-blue-50 text-blue-900",
        kind === "warning" && "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value, href, tone = "default" }: { label: string; value: ReactNode; href?: string; tone?: "default" | "brand" | "warn" | "ok" }) {
  const body = (
    <div
      className={cx(
        "rounded-2xl border bg-white p-4 shadow-sm",
        tone === "brand" && "border-brand/40",
        tone === "warn" && "border-amber-400",
        tone === "ok" && "border-green-400",
        tone === "default" && "border-zinc-200",
      )}
    >
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-medium text-zinc-600">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{k}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
