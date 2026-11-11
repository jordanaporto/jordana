import { cx } from "./ui";

/** Marca textual Injecar (substituível pelo logotipo oficial em /public/brand/logo.svg) */
export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 220 48" className={cx("w-auto", className)} role="img" aria-label="Injecar Auto Center">
      <rect x="0" y="4" width="40" height="40" rx="8" fill="#c80000" />
      <path d="M13 14h6v20h-6zM22 14h6l0 14 0 6h-6z" fill="#fff" opacity=".95" />
      <text x="50" y="30" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="26" fill={inverted ? "#fff" : "#0d0d0d"}>
        INJECAR
      </text>
      <text x="51" y="44" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="10" letterSpacing="3.2" fill="#c80000">
        AUTO CENTER
      </text>
    </svg>
  );
}
