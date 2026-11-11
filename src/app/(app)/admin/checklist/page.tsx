import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { CategoryForm, ItemForm } from "../forms";

export const metadata = { title: "Checklist" };

export default async function ChecklistAdminPage() {
  const user = await requireUser(ADMIN);
  const { cats, items } = await asUser(user.id, async (sql) => ({
    cats: await sql`select * from checklist_categories order by active desc, position, name`,
    items: await sql`select * from checklist_items order by active desc, position, name`,
  }));
  const catList = cats.map((c) => ({ id: c.id as string, name: c.name as string }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Checklist de inspeção"
        subtitle="Mudanças valem para as próximas OS. OS já abertas mantêm o checklist com que foram criadas."
        back="/admin/config"
      />
      <Card>
        <CategoryForm />
      </Card>
      {cats.map((c) => {
        const its = items.filter((i) => i.category_id === c.id);
        return (
          <section key={c.id}>
            <SectionTitle>
              {c.position}. {c.name} {!c.active && <Badge className="ml-2 bg-zinc-200 text-zinc-700">inativa</Badge>}
            </SectionTitle>
            <Card className="space-y-4">
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-brand">Editar categoria</summary>
                <div className="mt-3">
                  <CategoryForm c={{ id: c.id, name: c.name, position: c.position, active: c.active }} />
                </div>
              </details>
              <ul className="divide-y divide-zinc-100">
                {its.map((i) => (
                  <li key={i.id} className="py-2">
                    <details>
                      <summary className="flex cursor-pointer items-center justify-between">
                        <span className={i.active ? "" : "text-zinc-400 line-through"}>
                          {i.position}. {i.name}
                        </span>
                        <span className="text-sm text-brand">editar</span>
                      </summary>
                      <div className="mt-2">
                        <ItemForm categoryId={c.id} item={{ id: i.id, name: i.name, position: i.position, active: i.active }} categories={catList} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <ItemForm categoryId={c.id} />
            </Card>
          </section>
        );
      })}
    </div>
  );
}
