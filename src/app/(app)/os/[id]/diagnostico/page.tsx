import { asUser } from "@/lib/db";
import { getOrderContext } from "@/lib/queries/order-context";
import { dateTime } from "@/lib/format";
import { Card, DefinitionList, Empty, SectionTitle } from "@/components/ui";
import { MediaThumb } from "@/components/media-thumb";
import { MediaUploader } from "@/components/media-uploader";
import { DiagnosisForm } from "./diagnosis-form";
import { DIAG_FIELDS } from "@/lib/diagnosis";


export default async function DiagnosisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, order, canEdit } = await getOrderContext(id);
  const { d, media } = await asUser(user.id, async (sql) => {
    const [d] = await sql`
      select d.*, cb.full_name as created_by_name, ub.full_name as updated_by_name from diagnoses d
        left join profiles cb on cb.id = d.created_by left join profiles ub on ub.id = d.updated_by
       where d.service_order_id = ${id}`;
    const media = d
      ? await sql`select id, kind, caption from media where diagnosis_id = ${d.id} and deleted_at is null order by created_at`
      : [];
    return { d, media };
  });

  return (
    <div>
      {d && (
        <p className="mb-3 text-sm text-zinc-600">
          Registrado por {d.created_by_name} em {dateTime(d.created_at)}
          {d.updated_by_name && d.updated_at > d.created_at && ` · atualizado por ${d.updated_by_name} em ${dateTime(d.updated_at)}`}
          {d.completed_at && ` · concluído em ${dateTime(d.completed_at)}`}
        </p>
      )}
      {canEdit ? (
        <Card>
          <DiagnosisForm
            orderId={id}
            values={Object.fromEntries(DIAG_FIELDS.map(([k]) => [k, (d?.[k] as string) ?? (k === "reported_symptom" && !d ? order.complaint : "")]))}
            fields={DIAG_FIELDS.map(([k, l]) => ({ name: k, label: l }))}
          />
        </Card>
      ) : d ? (
        <Card>
          <DefinitionList items={DIAG_FIELDS.map(([k, l]) => [l, d[k]])} />
        </Card>
      ) : (
        <Empty title="Diagnóstico ainda não registrado" />
      )}

      <SectionTitle>Fotos e vídeos do diagnóstico</SectionTitle>
      {d ? (
        <Card>
          {canEdit && <MediaUploader orderId={id} link={{ diagnosis_id: d.id }} />}
          {media.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {media.map((m) => (
                <MediaThumb key={m.id} id={m.id} kind={m.kind} caption={m.caption} />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <p className="text-sm text-zinc-600">Salve o diagnóstico para anexar fotos e vídeos a ele.</p>
      )}
    </div>
  );
}
