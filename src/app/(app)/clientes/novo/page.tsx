import { requireUser } from "@/lib/auth/session";
import { STAFF } from "@/lib/roles";
import { CustomerForm } from "@/components/entity-forms";
import { Card, PageHeader } from "@/components/ui";
import { createCustomerAction } from "../actions";

export const metadata = { title: "Novo cliente" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ next?: string; nome?: string; tel?: string }> }) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const isOs = sp.next === "os" || sp.next === "agenda";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Novo cliente"
        subtitle={isOs ? "Depois cadastramos o veículo" : undefined}
        back={sp.next === "os" ? "/os/nova" : sp.next === "agenda" ? "/agenda/novo" : "/clientes"}
      />
      <Card>
        <CustomerForm
          action={createCustomerAction}
          next={sp.next}
          values={{ name: sp.nome, whatsapp: sp.tel, whatsapp_opt_in: false }}
          submitLabel={isOs ? "Salvar e cadastrar veículo →" : "Salvar cliente"}
        />
      </Card>
    </div>
  );
}
