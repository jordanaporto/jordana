import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { INVITE_TOKEN_RE } from "@/lib/auth/invite";
import { hashToken } from "@/lib/auth/session";
import { brand, PRODUCT_NAME } from "@/lib/brand";
import { asSystem } from "@/lib/db";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Criar senha",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = INVITE_TOKEN_RE.test(token) ? await asSystem((sql) => sql`select * from app.invite_lookup(${hashToken(token)})`) : [];
  const invite = rows[0] as { full_name: string; username: string } | undefined;

  return (
    <main className="flex min-h-dvh flex-col bg-ink px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-sm flex-1">
        <div className="mb-8 mt-4 flex flex-col items-center gap-3">
          <Logo className="h-20" />
          <p className="text-sm text-zinc-400">{PRODUCT_NAME}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 text-ink shadow-xl">
          {invite ? (
            <>
              <h1 className="text-2xl font-bold">Olá, {invite.full_name.split(/\s+/)[0]}!</h1>
              <p className="mb-4 mt-1 text-zinc-600">Crie sua senha para acessar o sistema da {brand.name}.</p>
              <div className="mb-5 rounded-xl bg-zinc-100 p-3">
                <div className="text-xs font-semibold uppercase text-zinc-500">Seu usuário</div>
                <div className="text-xl font-bold">{invite.username}</div>
              </div>
              <InviteForm token={token} />
              <p className="mt-4 text-xs text-zinc-500">Guarde seu usuário e senha. Não passe sua senha para ninguém — tudo o que você faz no sistema fica registrado no seu nome.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">Link expirado ou já usado</h1>
              <p className="mt-2 text-zinc-600">Peça um novo link ao administrador da oficina. Se você já criou sua senha, é só entrar.</p>
              <Link href="/login" className="tap mt-5 flex items-center justify-center rounded-xl bg-brand font-bold text-white">
                Ir para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
