"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cx } from "./ui";

export function OrderTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Seções da OS">
      <ul className="flex gap-2">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                ref={active ? activeRef : undefined}
                href={t.href}
                className={cx(
                  "flex h-11 items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold transition",
                  active ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white text-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
