"use client";

import { useActionState } from "react";
import { ExternalLink } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { whatsappLink } from "@/lib/format";
import { MESSAGE_STATUS } from "@/lib/status";
import { cancelMessageAction, markSentAction } from "@/app/(app)/mensagens/actions";
import { Badge, cx } from "./ui";

export type Msg = {
  id: string;
  to_phone: string;
  rendered_body: string;
  status: keyof typeof MESSAGE_STATUS;
  provider: "manual" | "cloud_api";
  created_at: string;
  sent_at: string | null;
  sent_by_name: string | null;
  last_error: string | null;
  order_number?: number;
  order_id?: string | null;
  plate?: string;
  customer_name?: string;
  send_after?: string;
  appointment_id?: string | null;
  appointment_at?: string | null;
};

function Action({ action, id, label, variant }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; id: string; label: string; variant: "primary" | "ghost" }) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  return (
    <form action={formAction}>
      <input type="hidden" name="message_id" value={id} />
      <button
        disabled={pending}
        className={cx(
          "min-h-11 rounded-xl px-3 text-sm font-semibold",
          variant === "primary" ? "bg-ink text-white" : "border-2 border-zinc-300 bg-white",
        )}
      >
        {pending ? "…" : label}
      </button>
      {state.error && <p className="text-xs text-brand">{state.error}</p>}
    </form>
  );
}

/** Lista de mensagens com envio manual oficial (wa.me) e confirmação de envio. */
export function MessageList({ messages, canAct, showOrder }: { messages: Msg[]; canAct: boolean; showOrder?: boolean }) {
  if (!messages.length) return <p className="text-zinc-600">Nenhuma mensagem.</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const st = MESSAGE_STATUS[m.status];
        const scheduled = m.status === "na_fila" && m.send_after && new Date(m.send_after) > new Date();
        const pendingManual = !scheduled && m.provider === "manual" && (m.status === "na_fila" || m.status === "falhou");
        return (
          <li key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              {scheduled ? (
                <Badge className="bg-blue-100 text-blue-900">
                  Programada: {new Date(m.send_after!).toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </Badge>
              ) : (
                <Badge className={st.cls}>{st.label}</Badge>
              )}
              <span className="text-zinc-500">{m.provider === "manual" ? "Envio manual" : "API oficial"}</span>
              {showOrder && m.appointment_id && m.appointment_at && (
                <a href={`/agenda?dia=${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(new Date(m.appointment_at))}`} className="font-semibold underline">
                  Agenda · {m.plate ?? ""} · {m.customer_name}
                </a>
              )}
              {showOrder && m.order_id && (
                <a href={`/os/${m.order_id}/mensagens`} className="font-semibold underline">
                  OS {String(m.order_number).padStart(4, "0")} · {m.plate} · {m.customer_name}
                </a>
              )}
              <span className="ml-auto text-xs text-zinc-500">{new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Belem" })}</span>
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-green-50 p-3 text-[15px]">{m.rendered_body}</p>
            {m.sent_at && (
              <p className="mt-1 text-xs text-zinc-500">
                Enviada {new Date(m.sent_at).toLocaleString("pt-BR", { timeZone: "America/Belem" })} {m.sent_by_name && `por ${m.sent_by_name}`}
              </p>
            )}
            {m.last_error && <p className="mt-1 text-xs text-brand">Erro: {m.last_error}</p>}
            {canAct && scheduled && (
              <div className="mt-3">
                <Action action={cancelMessageAction} id={m.id} label="Não enviar" variant="ghost" />
              </div>
            )}
            {canAct && pendingManual && (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={whatsappLink(m.to_phone, m.rendered_body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1f8f4e] px-4 text-sm font-bold text-white"
                >
                  <ExternalLink className="size-4" /> Abrir no WhatsApp
                </a>
                <Action action={markSentAction} id={m.id} label="Marcar como enviada" variant="primary" />
                <Action action={cancelMessageAction} id={m.id} label="Não enviar" variant="ghost" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
