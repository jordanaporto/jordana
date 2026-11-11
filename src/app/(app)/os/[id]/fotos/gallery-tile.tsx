"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FileText, Play, Trash2 } from "lucide-react";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { cx } from "@/components/ui";
import { deleteMediaAction, updateMedia } from "../../actions";

type M = {
  id: string;
  kind: string;
  caption: string | null;
  includeInReport: boolean;
  createdAt: string;
  uploadedBy: string | null;
  context: string | null;
};

export function GalleryTile({ media, canEdit, canMarkReport, canDelete }: { media: M; canEdit: boolean; canMarkReport: boolean; canDelete: boolean }) {
  const [inReport, setInReport] = useOptimistic(media.includeInReport);
  const [, start] = useTransition();
  const [caption, setCaption] = useState(media.caption ?? "");
  const [showDelete, setShowDelete] = useState(false);

  const toggleReport = () =>
    start(async () => {
      setInReport(!inReport);
      await updateMedia({ media_id: media.id, include_in_report: !inReport });
    });

  return (
    <figure className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <a href={`/api/media/${media.id}`} target="_blank" rel="noopener" className="relative block aspect-square bg-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${media.id}?thumb=1`} alt={media.caption ?? "Foto do atendimento"} loading="lazy" className="size-full object-cover" />
        {media.kind === "video" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="size-10 fill-white text-white" aria-hidden />
          </span>
        )}
        {inReport && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">No relatório</span>}
      </a>
      <figcaption className="space-y-2 p-2 text-xs">
        {media.context && <div className="font-semibold">{media.context}</div>}
        <div className="text-zinc-500">
          {media.uploadedBy} · {new Date(media.createdAt).toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </div>
        {canEdit ? (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== (media.caption ?? "") && start(() => updateMedia({ media_id: media.id, caption }).then(() => {}))}
            placeholder="Legenda"
            maxLength={500}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        ) : (
          media.caption && <div>{media.caption}</div>
        )}
        <div className="flex gap-1">
          {canMarkReport && media.kind === "foto" && (
            <button
              onClick={toggleReport}
              className={cx("inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-semibold", inReport ? "border-ink bg-ink text-white" : "border-zinc-300")}
            >
              <FileText className="size-3.5" /> {inReport ? "No relatório" : "Usar no relatório"}
            </button>
          )}
          {canDelete && (
            <button onClick={() => setShowDelete((s) => !s)} aria-label="Remover" className="rounded-lg border border-zinc-300 px-2 text-brand">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        {showDelete && (
          <ActionForm action={deleteMediaAction} className="space-y-2">
            <input type="hidden" name="media_id" value={media.id} />
            <Field label="Motivo da remoção" name="reason">
              <Input name="reason" className="py-2 text-sm" />
            </Field>
            <SubmitButton size="sm" variant="danger" className="w-full">
              Remover da galeria
            </SubmitButton>
          </ActionForm>
        )}
      </figcaption>
    </figure>
  );
}
