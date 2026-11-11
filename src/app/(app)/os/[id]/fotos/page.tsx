import Link from "next/link";
import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { can } from "@/lib/roles";
import { Card, Empty, cx } from "@/components/ui";
import { MediaUploader } from "@/components/media-uploader";
import { GalleryTile } from "./gallery-tile";

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "checklist", label: "Checklist" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "servico", label: "Serviços" },
  { key: "geral", label: "Gerais" },
  { key: "videos", label: "Vídeos" },
];

export default async function PhotosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const { id } = await params;
  const f = (await searchParams).f ?? "";
  const { user, canEdit } = await getOrderContext(id);

  const media = await asUser(user.id, (sql) => sql`
    select m.id, m.kind, m.caption, m.include_in_report, m.created_at, m.checklist_entry_id, m.diagnosis_id, m.service_item_id,
           p.full_name as uploaded_by_name, e.item_name, e.category_name, si.title as service_title
      from media m
      left join profiles p on p.id = m.uploaded_by
      left join service_order_checklist e on e.id = m.checklist_entry_id
      left join service_items si on si.id = m.service_item_id
     where m.service_order_id = ${id} and m.deleted_at is null
     order by m.created_at desc`);

  const filtered = media.filter((m) => {
    if (f === "checklist") return m.checklist_entry_id;
    if (f === "diagnostico") return m.diagnosis_id;
    if (f === "servico") return m.service_item_id;
    if (f === "geral") return !m.checklist_entry_id && !m.diagnosis_id && !m.service_item_id;
    if (f === "videos") return m.kind === "video";
    return true;
  });

  return (
    <div>
      {canEdit && (
        <Card className="mb-4">
          <p className="mb-2 font-semibold">Adicionar fotos ou vídeos gerais do atendimento</p>
          <MediaUploader orderId={id} />
          <p className="mt-2 text-xs text-zinc-500">Vídeos de até 60 segundos. Fotos são reduzidas no celular antes do envio.</p>
        </Card>
      )}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/os/${id}/fotos${x.key ? `?f=${x.key}` : ""}`}
            className={cx("whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-sm font-semibold", f === x.key ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white")}
          >
            {x.label}
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty title="Nenhuma foto ou vídeo">Use o botão da câmera para registrar.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m) => (
            <GalleryTile
              key={m.id}
              media={{
                id: m.id,
                kind: m.kind,
                caption: m.caption,
                includeInReport: m.include_in_report,
                createdAt: new Date(m.created_at).toISOString(),
                uploadedBy: m.uploaded_by_name,
                context: m.item_name ? `${m.category_name} · ${m.item_name}` : m.diagnosis_id ? "Diagnóstico" : m.service_title ? `Serviço: ${m.service_title}` : null,
              }}
              canEdit={canEdit}
              canMarkReport={can.staff(user.role) || canEdit}
              canDelete={can.deleteMedia(user.role)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
