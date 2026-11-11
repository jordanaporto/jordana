import { Wrench } from "lucide-react";
import { brand } from "@/lib/brand";
import { cx } from "./ui";

/** Logotipo da oficina configurada; sem logotipo, mostra ícone + nome. */
export function Logo({ className, inverted = true }: { className?: string; inverted?: boolean }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo} alt={brand.name} width={520} height={192} className={cx("w-auto", className)} />;
  }
  return (
    <span className={cx("inline-flex items-center gap-2 font-bold leading-none", inverted ? "text-white" : "text-ink", className)} aria-label={brand.name}>
      <span className="flex aspect-square h-full items-center justify-center rounded-lg bg-brand text-white">
        <Wrench className="size-[60%]" aria-hidden />
      </span>
      <span className="text-[min(1.1em,1.25rem)]">{brand.name}</span>
    </span>
  );
}
