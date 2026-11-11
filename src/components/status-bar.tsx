"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { ActionForm, Field, SubmitButton, Textarea } from "./form";
import { changeStatusAction } from "@/app/(app)/os/actions";
import type { Transition } from "@/lib/queries/order-context";
import { GROUP_STYLE, STATUS_META, transitionLabel, type OsStatus } from "@/lib/status";
import { cx } from "./ui";

/**
 * Barra fixa com a próxima etapa em destaque.
 * Ao tocar, abre uma folha com todas as etapas permitidas + observação.
 */
export function StatusBar({
  orderId,
  current,
  transitions,
  isStaff,
}: {
  orderId: string;
  current: OsStatus;
  transitions: Transition[];
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Transition | null>(null);
  const forward = transitions.filter((t) => t.kind === "avancar");
  const others = transitions.filter((t) => t.kind !== "avancar");
  if (transitions.length === 0) return null;

  const primary = forward[0];
  const openWith = (t: Transition | null) => {
    setSelected(t);
    setOpen(true);
  };
  const needsNote = selected && selected.kind !== "avancar";

  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-4xl gap-2">
          {primary ? (
            <button
              onClick={() => openWith(primary)}
              className={cx("tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-lg font-bold text-white active:bg-brand-dark")}
            >
              {transitionLabel(current, primary.to_status, "avancar")}
              <ArrowRight className="size-6" aria-hidden />
            </button>
          ) : (
            <div className="flex flex-1 items-center text-sm text-zinc-600">
              {isStaff ? "Próxima etapa depende do mecânico." : "Aguardando o atendimento."}
            </div>
          )}
          {(forward.length > 1 || others.length > 0) && (
            <button onClick={() => openWith(null)} className="tap rounded-xl border-2 border-zinc-300 px-4 font-semibold">
              Mais
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mudar etapa"
            className="safe-bottom max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 lg:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Mudar etapa</h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-2 hover:bg-zinc-100">
                <X className="size-6" />
              </button>
            </div>

            <div className="space-y-2">
              {forward.map((t) => (
                <Option key={t.to_status} t={t} current={current} selected={selected} onSelect={setSelected} />
              ))}
              {others.length > 0 && <div className="pt-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Outras opções</div>}
              {others.map((t) => (
                <Option key={t.kind + t.to_status} t={t} current={current} selected={selected} onSelect={setSelected} />
              ))}
            </div>

            {selected && (
              <ActionForm action={changeStatusAction} onSuccess={() => setOpen(false)} showSuccess={false} className="mt-5">
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="to_status" value={selected.to_status} />
                <Field label={needsNote ? "Motivo (obrigatório)" : "Observação (opcional)"} name="note">
                  <Textarea name="note" rows={2} required={Boolean(needsNote)} />
                </Field>
                <SubmitButton className="w-full" variant={selected.kind === "cancelar" ? "danger" : "primary"} pendingText="Atualizando…">
                  Confirmar: {STATUS_META[selected.to_status].label}
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Option({
  t,
  current,
  selected,
  onSelect,
}: {
  t: Transition;
  current: OsStatus;
  selected: Transition | null;
  onSelect: (t: Transition) => void;
}) {
  const meta = STATUS_META[t.to_status];
  const active = selected?.to_status === t.to_status && selected.kind === t.kind;
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      className={cx(
        "tap flex w-full items-center gap-3 rounded-xl border-2 px-4 text-left font-semibold",
        active ? "border-ink bg-zinc-50" : "border-zinc-200",
        t.kind === "cancelar" && "text-brand",
      )}
    >
      <span className={cx("size-4 shrink-0 rounded-full", GROUP_STYLE[meta.group].dot)} />
      <span className="flex-1">{transitionLabel(current, t.to_status, t.kind)}</span>
      {active && <span aria-hidden>✓</span>}
    </button>
  );
}
