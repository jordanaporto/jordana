import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { can, mobileNavFor, navFor, ROLE_LABEL } from "@/lib/roles";
import { Logo } from "@/components/logo";
import { BottomNav, SideNav } from "@/components/shell";
import { logoutAction } from "@/app/login/actions";
import { PwaRegister } from "@/components/pwa-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = can.readAll(user.role)
    ? await asUser(user.id, async (sql) => {
        const [r] = await sql`
          select (select count(*) from outbound_messages where status in ('na_fila', 'falhou') and provider = 'manual')::int as mensagens,
                 (select count(distinct service_order_id) from v_alerts)::int as alertas`;
        return { mensagens: r.mensagens as number, alertas: r.alertas as number };
      })
    : { mensagens: 0, alertas: 0 };

  return (
    <div className="lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-ink p-4 text-white lg:flex">
        <Link href="/" className="mb-8 px-2 pt-2">
          <Logo className="h-9" inverted />
        </Link>
        <SideNav items={navFor(user.role)} counts={counts} />
        <div className="mt-auto rounded-xl bg-white/5 p-3 text-sm">
          <div className="font-semibold">{user.fullName}</div>
          <div className="text-zinc-400">{ROLE_LABEL[user.role]}</div>
          <form action={logoutAction} className="mt-2">
            <button className="text-zinc-300 underline-offset-2 hover:text-white hover:underline">Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-ink px-4 text-white lg:hidden">
          <Link href="/" aria-label="Início">
            <Logo className="h-7" inverted />
          </Link>
          <Link href="/perfil" className="text-right text-xs leading-tight">
            <div className="font-semibold">{user.fullName.split(" ")[0]}</div>
            <div className="text-zinc-400">{ROLE_LABEL[user.role]}</div>
          </Link>
        </header>

        {user.mustChangePassword && (
          <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black">
            Por segurança, <Link href="/perfil" className="underline">troque sua senha provisória</Link>.
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      <BottomNav items={mobileNavFor(user.role)} counts={counts} />
      <PwaRegister />
    </div>
  );
}
