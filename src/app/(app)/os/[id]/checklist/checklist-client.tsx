"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, CircleAlert, MessageSquareText, Wrench } from "lucide-react";
import { CHECKLIST_RESULT, type ChecklistResult } from "@/lib/status";
import { MediaUploader } from "@/components/media-uploader";
import { cx } from "@/components/ui";
import { updateChecklistEntry } from "../../actions";

export type ChecklistEntry = {
  id: string;
  name: string;
  result: ChecklistResult;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  media: { id: string; kind: string }[];
};

const BUTTONS: { value: ChecklistResult; icon: typeof Check }[] = [
  { value: "ok", icon: Check },
  { value: "atencao", icon: CircleAlert },
  { value: "necessita_reparo", icon: Wrench },
];

export function ChecklistCategory({
  orderId,
  name,
  items,
  canEdit,
  defaultOpen,
}: {
  orderId: string;
  name: string;
  items: ChecklistEntry[];
  canEdit: boolean;
  defaultOpen: boolean;
}) {
  const done = items.filter((i) => i.result !== "nao_avaliado").length;
  const repair = items.filter((i) => i.result === "necessita_reparo").length;
  const attention = items.filter((i) => i.result === "atencao").length;
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer items-center gap-3 p-4">
        <span className="flex-1 text-lg font-bold">{name}</span>
        {repair > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{repair}</span>}
        {attention > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">{attention}</span>}
        <span className={cx("text-sm font-semibold", done === items.length ? "text-green-700" : "text-zinc-500")}>
          {done}/{items.length}
        </span>
        <ChevronDown className="size-5 transition group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        {items.map((it) => (
          <ChecklistItem key={it.id} orderId={orderId} item={it} canEdit={canEdit} />
        ))}
      </ul>
    </details>
  );
}

function ChecklistItem({ orderId, item, canEdit }: { orderId: string; item: ChecklistEntry; canEdit: boolean }) {
  const [result, setOptimistic] = useOptimistic(item.result);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note));
  const [note, setNote] = useState(item.note ?? "");
  const [savedNote, setSavedNote] = useState(item.note ?? "");

  const choose = (value: ChecklistResult) => {
    if (!canEdit) return;
    const next = result === value ? "nao_avaliado" : value; // tocar de novo desmarca
    setError(null);
    start(async () => {
      setOptimistic(next);
      const r = await updateChecklistEntry({ entry_id: item.id, result: next });
      if (!r.ok) setError(r.error ?? "Erro ao salvar");
    });
  };

  const saveNote = () => {
    if (note === savedNote) return;
    start(async () => {
      const r = await updateChecklistEntry({ entry_id: item.id, note });
      if (r.ok) setSavedNote(note);
      else setError(r.error ?? "Erro ao salvar");
    });
  };

  return (
    <li className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold">{item.name}</span>
        {result !== "nao_avaliado" && (
          <span className={cx("rounded-full border px-2 py-0.5 text-xs font-semibold", CHECKLIST_RESULT[result].soft)}>
            {CHECKLIST_RESULT[result].label}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={item.name}>
        {BUTTONS.map(({ value, icon: Icon }) => {
          const active = result === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!canEdit}
              onClick={() => choose(value)}
              className={cx(
                "tap flex flex-col items-center justify-center rounded-xl border-2 text-sm font-bold transition disabled:opacity-60",
                active ? CHECKLIST_RESULT[value].cls : "border-zinc-200 bg-white text-zinc-700",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {CHECKLIST_RESULT[value].short}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <MediaUploader orderId={orderId} link={{ checklist_entry_id: item.id }} variant="compact" />
            <button
              type="button"
              onClick={() => setNoteOpen((o) => !o)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white px-3 text-sm font-semibold"
            >
              <MessageSquareText className="size-5" /> Nota
            </button>
          </>
        )}
        {item.media.map((m) => (
          <a key={m.id} href={`/api/media/${m.id}`} target="_blank" rel="noopener" className="block size-11 overflow-hidden rounded-lg bg-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${m.id}?thumb=1`} alt="" className="size-full object-cover" />
          </a>
        ))}
      </div>

      {noteOpen && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          disabled={!canEdit}
          rows={2}
          maxLength={2000}
          placeholder="Ex.: pastilha com 3 mm, trocar em breve"
          className="mt-2 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2 outline-none focus:border-ink"
        />
      )}
      {(pending || error || (item.updatedBy && result !== "nao_avaliado")) && (
        <p className={cx("mt-1 text-xs", error ? "font-semibold text-brand" : "text-zinc-500")}>
          {error ?? (pending ? "Salvando…" : `${item.updatedBy} · ${item.updatedAt ? new Date(item.updatedAt).toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}`)}
        </p>
      )}
    </li>
  );
}
