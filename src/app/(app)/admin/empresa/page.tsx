import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { env } from "@/lib/env";
import { ADMIN } from "@/lib/roles";
import { pushConfig } from "@/lib/push";
import { Alert, Card, DefinitionList, PageHeader, SectionTitle } from "@/components/ui";
import { CompanyForm, ProviderForm } from "../forms";

export const metadata = { title: "Empresa e integração" };

export default async function CompanyPage() {
  const user = await requireUser(ADMIN);
  const rows = await asUser(user.id, (sql) => sql`select key, value from settings where key in ('company', 'messaging.provider')`);
  const company = (rows.find((r) => r.key === "company")?.value ?? {}) as Record<string, string>;
  const provider = (rows.find((r) => r.key === "messaging.provider")?.value as string) ?? "manual";
  const wa = env.whatsapp;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Empresa e integração" back="/admin/config" />
      <SectionTitle>Dados que aparecem no relatório</SectionTitle>
      <Card>
        <CompanyForm v={company} />
      </Card>

      <SectionTitle>WhatsApp Business Platform</SectionTitle>
      <Card className="space-y-4">
        <DefinitionList
          items={[
            ["Credenciais da Cloud API", wa.configured ? "Configuradas no servidor" : "Não configuradas"],
            ["Verificação de assinatura do webhook", wa.appSecret ? "Ativa" : "Defina WHATSAPP_APP_SECRET"],
            ["Endereço do webhook (cadastrar na Meta)", `${env.appUrl}/api/whatsapp/webhook`],
            ["Versão da API", wa.apiVersion],
          ]}
        />
        {!wa.configured && (
          <Alert kind="info">
            As chaves da Meta ficam em variáveis de ambiente do servidor (nunca no banco ou no navegador). Veja o passo a passo em
            docs/09-whatsapp.md.
          </Alert>
        )}
        <ProviderForm current={provider} configured={wa.configured} />
      </Card>

      <SectionTitle>Avisos no celular da equipe</SectionTitle>
      <Card>
        <DefinitionList
          items={[
            ["Situação", pushConfig().configured ? "Configurado — cada pessoa ativa no próprio celular em Perfil" : "Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no servidor (npm run push:keys)"],
            ["O que é avisado", "Carro novo para o mecânico, serviço aprovado, diagnóstico concluído, aguardando peça, serviço concluído e alertas de carro parado"],
          ]}
        />
      </Card>
    </div>
  );
}
