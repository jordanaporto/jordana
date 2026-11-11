"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Car,
  ChartColumn,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  Settings,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/roles";
import { cx } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  car: Car,
  search: Search,
  user: User,
  layout: LayoutGrid,
  plus: Plus,
  users: Users,
  message: MessageCircle,
  chart: ChartColumn,
  trending: TrendingUp,
  settings: Settings,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

type Counts = { mensagens: number; alertas: number };

function Count({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cx("min-w-5 rounded-full bg-brand px-1.5 text-center text-xs font-bold leading-5 text-white", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function SideNav({ items, counts }: { items: NavItem[]; counts: Counts }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const Icon = ICONS[it.icon] ?? Car;
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition",
              active ? "bg-brand text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="flex-1">{it.label}</span>
            {it.badge && <Count n={counts[it.badge]} className={active ? "bg-white text-brand" : ""} />}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items, counts }: { items: NavItem[]; counts: Counts }) {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-ink lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {items.map((it) => {
          const Icon = ICONS[it.icon] ?? Car;
          const active = isActive(pathname, it.href);
          const isPlus = it.icon === "plus";
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={cx(
                  "relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  active ? "text-white" : "text-zinc-400",
                )}
              >
                <span
                  className={cx(
                    "flex items-center justify-center rounded-full",
                    isPlus ? "size-10 bg-brand text-white" : "size-7",
                    active && !isPlus && "text-brand",
                  )}
                >
                  <Icon className={isPlus ? "size-6" : "size-6"} aria-hidden />
                </span>
                {!isPlus && <span>{it.label}</span>}
                {isPlus && <span className="sr-only">{it.label}</span>}
                {it.badge && counts[it.badge] > 0 && (
                  <span className="absolute right-[22%] top-1.5">
                    <Count n={counts[it.badge]} />
                  </span>
                )}
                {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
