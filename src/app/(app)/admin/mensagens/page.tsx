import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { STATUS_META, type OsStatus } from "@/lib/status";
import { Alert, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { TemplateForm } from "../forms";

export const metadata = { title: "Mensagens automáticas" };

export default async function TemplatesPage() {
  const user = await requireUser(ADMIN);
  const templates = await asUser(user.id, (sql) => sql`select * from message_templates order by active desc, trigger_status nulls last, name`);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mensagens automáticas" subtitle="Textos enviados ao cliente quando a OS muda de etapa" back="/admin/config" />
      <Alert kind="info">
        Para envio automático pela API oficial, cada texto precisa estar cadastrado e aprovado como “modelo” (template) no WhatsApp
        Manager da Meta, com o mesmo conteúdo. Informe aqui o nome do modelo e a ordem das variáveis.
      </Alert>
      {templates.map((t) => (
        <section key={t.id}>
          <SectionTitle>
            {t.name}{" "}
            {t.trigger_status ? (
              <Badge className="ml-2 bg-ink text-white">ao entrar em: {STATUS_META[t.trigger_status as OsStatus].label}</Badge>
            ) : (
              <Badge className="ml-2 bg-zinc-200">manual</Badge>
            )}
            {!t.active && <Badge className="ml-2 bg-zinc-200 text-zinc-600">inativo</Badge>}
          </SectionTitle>
          <Card>
            <TemplateForm
              t={{
                id: t.id,
                name: t.name,
                trigger_status: t.trigger_status,
                body: t.body,
                meta_template_name: t.meta_template_name,
                meta_variables: t.meta_variables ?? [],
                active: t.active,
              }}
            />
          </Card>
        </section>
      ))}
      <SectionTitle>Novo modelo</SectionTitle>
      <Card>
        <TemplateForm />
      </Card>
    </div>
  );
}
