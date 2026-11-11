import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { dateTime, formatPhone } from "@/lib/format";
import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AnonymizeForm } from "../forms";

export const metadata = { title: "Privacidade (LGPD)" };

export default async function LgpdPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const user = await requireUser(ADMIN);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const { results, selected } = await asUser(user.id, async (sql) => {
    const digits = q.replace(/\D/g, "");
    const results = q
      ? await sql`
          select id, name, whatsapp, anonymized_at from customers
           where lower(name) like ${"%" + q.toLowerCase() + "%"} ${digits.length >= 6 ? sql`or whatsapp like ${"%" + digits + "%"} or cpf = ${digits}` : sql``}
           order by name limit 20`
      : [];
    const selected = sp.id && /^[0-9a-f-]{36}$/.test(sp.id)
      ? (await sql`
          select c.*, (select count(*) from service_orders where customer_id = c.id)::int as orders,
                 (select count(*) from service_orders where customer_id = c.id and status not in ('entregue','cancelada'))::int as open_orders
            from customers c where c.id = ${sp.id}`)[0]
      : null;
    return { results, selected };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Privacidade (LGPD)" subtitle="Atendimento a pedidos do titular: acesso aos dados e eliminação" back="/admin/config" />
      <Alert kind="info">
        Exportar gera um arquivo com todos os dados pessoais e atendimentos do cliente (direito de acesso). Anonimizar remove nome,
        telefones, CPF e observações — inclusive do histórico de auditoria — mantendo o histórico técnico do veículo sem identificação.
      </Alert>
      <form className="my-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nome, WhatsApp ou CPF" className="tap min-w-0 flex-1 rounded-xl border-2 border-zinc-300 bg-white px-4" />
        <button className="tap rounded-xl bg-ink px-5 font-semibold text-white">Buscar</button>
      </form>
      <ul className="space-y-2">
        {results.map((c) => (
          <li key={c.id}>
            <a href={`/admin/lgpd?q=${encodeURIComponent(q)}&id=${c.id}`} className="block rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-400">
              <b>{c.name}</b> · {formatPhone(c.whatsapp)} {c.anonymized_at && <span className="text-zinc-500">(anonimizado)</span>}
            </a>
          </li>
        ))}
      </ul>
      {selected && (
        <>
          <SectionTitle>{selected.name}</SectionTitle>
          <Card className="space-y-4">
            <p className="text-sm text-zinc-600">
              {selected.orders} atendimento(s). Cadastro em {dateTime(selected.created_at)}.
              {selected.anonymized_at && ` Anonimizado em ${dateTime(selected.anonymized_at)}.`}
            </p>
            <a href={`/api/admin/lgpd/export?customer=${selected.id}`} className="inline-flex min-h-12 items-center rounded-xl border-2 border-zinc-300 px-4 font-semibold">
              Exportar dados (JSON)
            </a>
            {!selected.anonymized_at &&
              (selected.open_orders > 0 ? (
                <Alert kind="warning">O cliente tem OS aberta. Finalize-a antes de anonimizar.</Alert>
              ) : (
                <AnonymizeForm customerId={selected.id} />
              ))}
          </Card>
        </>
      )}
    </div>
  );
}
