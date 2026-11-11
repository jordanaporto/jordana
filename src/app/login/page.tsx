import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/roles";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return (
    <main className="flex min-h-dvh flex-col bg-ink px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-sm flex-1">
        <div className="mb-10 mt-6 flex flex-col items-center gap-3">
          <Logo className="h-24" />
          <p className="text-sm text-zinc-400">Sistema de ordens de serviço</p>
        </div>
        <div className="rounded-2xl bg-white p-6 text-ink shadow-xl">
          <h1 className="mb-5 text-2xl font-bold">Entrar</h1>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Acesso restrito à equipe Injecar. Esqueceu a senha? Fale com o administrador.
        </p>
      </div>
    </main>
  );
}
