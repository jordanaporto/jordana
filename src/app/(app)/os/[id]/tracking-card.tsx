"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { Alert, cx } from "@/components/ui";
import { regenerateTrackingLink, sendTrackingLink } from "../actions";

/** Link de acompanhamento do cliente (atendimento): copiar, enviar pelo WhatsApp, gerar novo. */
export function TrackingCard({
  orderId,
  url,
  views,
  lastViewed,
  subscribers,
  canSendWhatsapp,
}: {
  orderId: string;
  url: string;
  views: number;
  lastViewed: string | null;
  subscribers: number;
  canSendWhatsapp: boolean;
}) {
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirmNew, setConfirmNew] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMsg({ kind: "success", text: "Link copiado." });
    } catch {
      setMsg({ kind: "error", text: "Não foi possível copiar. Selecione o link e copie manualmente." });
    }
  };

  if (!url) return <Alert kind="warning">Endereço público do sistema não configurado (APP_URL).</Alert>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        O cliente acompanha cada etapa, vê fotos e orçamento, aprova pelo próprio celular e pode ativar avisos gratuitos.
      </p>
      <input readOnly value={url} onFocus={(e) => e.target.select()} className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={copy} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-zinc-300 text-sm font-semibold">
          <Copy className="size-4" /> Copiar
        </button>
        <a href={url} target="_blank" rel="noopener" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-zinc-300 text-sm font-semibold">
          <ExternalLink className="size-4" /> Ver como cliente
        </a>
        <button
          type="button"
          disabled={pending || !canSendWhatsapp}
          onClick={() =>
            start(async () => {
              const r = await sendTrackingLink(orderId);
              setMsg(r.ok ? { kind: "success", text: "Mensagem com o link preparada. Envie em Mensagens → “Abrir no WhatsApp”." } : { kind: "error", text: r.error ?? "Erro" });
            })
          }
          className={cx("flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#1f8f4e] text-sm font-bold text-white disabled:opacity-50")}
          title={canSendWhatsapp ? undefined : "Cliente não autorizou WhatsApp"}
        >
          <MessageCircle className="size-4" /> Enviar no WhatsApp
        </button>
        <button type="button" onClick={() => setConfirmNew((v) => !v)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-zinc-300 text-sm font-semibold">
          <RefreshCw className="size-4" /> Novo link
        </button>
      </div>
      {confirmNew && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm">
          O link atual deixará de funcionar.{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await regenerateTrackingLink(orderId);
                setConfirmNew(false);
                setMsg(r.ok ? { kind: "success", text: "Novo link gerado." } : { kind: "error", text: r.error ?? "Erro" });
              })
            }
            className="font-bold text-brand underline"
          >
            Gerar novo link
          </button>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Aberto {views} vez(es){lastViewed ? ` · último acesso ${new Date(lastViewed).toLocaleString("pt-BR", { timeZone: "America/Belem" })}` : ""} ·{" "}
        {subscribers > 0 ? `avisos ativados em ${subscribers} celular(es)` : "cliente ainda não ativou avisos"}
      </p>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
