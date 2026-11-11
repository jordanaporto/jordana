import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import type { ChecklistResult } from "@/lib/status";
import { Empty } from "@/components/ui";
import { ChecklistCategory, type ChecklistEntry } from "./checklist-client";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, canEdit } = await getOrderContext(id);
  const entries = await asUser(user.id, (sql) => sql`
    select e.id, e.category_name, e.category_position, e.item_name, e.position, e.result, e.note, e.updated_at,
           p.full_name as updated_by_name,
           coalesce(json_agg(json_build_object('id', m.id, 'kind', m.kind) order by m.created_at)
                    filter (where m.id is not null), '[]') as media
      from service_order_checklist e
      left join profiles p on p.id = e.updated_by
      left join media m on m.checklist_entry_id = e.id and m.deleted_at is null
     where e.service_order_id = ${id}
     group by e.id, p.full_name
     order by e.category_position, e.position, e.item_name`);

  if (entries.length === 0) return <Empty title="Checklist vazio" />;

  const cats: { name: string; items: ChecklistEntry[] }[] = [];
  for (const e of entries) {
    let c = cats.find((x) => x.name === e.category_name);
    if (!c) cats.push((c = { name: e.category_name, items: [] }));
    c.items.push({
      id: e.id,
      name: e.item_name,
      result: e.result as ChecklistResult,
      note: e.note,
      updatedBy: e.updated_by_name,
      updatedAt: e.updated_at ? new Date(e.updated_at).toISOString() : null,
      media: e.media as { id: string; kind: string }[],
    });
  }

  const firstPending = cats.findIndex((c) => c.items.some((x) => x.result === "nao_avaliado"));
  const openIdx = firstPending === -1 ? 0 : firstPending;

  return (
    <div className="space-y-3">
      {cats.map((c, i) => (
        <ChecklistCategory key={c.name} orderId={id} name={c.name} items={c.items} canEdit={canEdit} defaultOpen={i === openIdx} />
      ))}
    </div>
  );
}
