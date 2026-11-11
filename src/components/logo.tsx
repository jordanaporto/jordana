import { cx } from "./ui";

/** Logotipo oficial da Injecar (public/brand). Funciona sobre fundo claro e escuro. */
export function Logo({ className }: { className?: string; inverted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-sm.png" alt="Injecar Auto Center" width={520} height={192} className={cx("w-auto", className)} />
  );
}
