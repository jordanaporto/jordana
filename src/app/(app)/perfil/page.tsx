import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/roles";
import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { logoutAction } from "@/app/login/actions";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={user.fullName} subtitle={`${ROLE_LABEL[user.role]} · usuário ${user.username}`} />
      {user.mustChangePassword && (
        <div className="mb-4">
          <Alert kind="warning">Sua senha é provisória. Crie uma senha pessoal para continuar usando o sistema.</Alert>
        </div>
      )}
      <SectionTitle>Trocar senha</SectionTitle>
      <Card>
        <PasswordForm />
      </Card>
      <SectionTitle>Sessão</SectionTitle>
      <Card>
        <form action={logoutAction}>
          <button className="tap w-full rounded-xl border-2 border-zinc-300 font-semibold">Sair deste aparelho</button>
        </form>
      </Card>
    </div>
  );
}
