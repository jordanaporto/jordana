"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Alert, cx } from "@/components/ui";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./push-actions";

function keyToBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "carregando" | "sem-suporte" | "iphone-instalar" | "bloqueado" | "desativado" | "ativado";

/** Liga/desliga os avisos (Web Push) neste aparelho. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("carregando");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos && !standalone ? "iphone-instalar" : "sem-suporte");
        return;
      }
      if (Notification.permission === "denied") return setState("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "ativado" : "desativado");
    })().catch(() => setState("sem-suporte"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "bloqueado" : "desativado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
      if (!r.ok) throw new Error(r.error);
      setState("ativado");
      setMsg({ kind: "success", text: "Avisos ativados. Enviamos um aviso de teste para este aparelho." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message || "Não foi possível ativar os avisos." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("desativado");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const r = await sendTestPush();
    setMsg(r.ok ? { kind: "success", text: "Aviso de teste enviado." } : { kind: "error", text: r.error ?? "Falha no envio" });
    setBusy(false);
  }

  if (!publicKey) return <Alert kind="info">Os avisos no celular ainda não foram configurados no servidor.</Alert>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Receba no celular: carro novo atribuído a você, serviço aprovado pelo cliente, diagnóstico concluído, serviço pronto e alertas
        de carro parado.
      </p>
      {state === "iphone-instalar" && (
        <Alert kind="info">
          No iPhone, primeiro instale o app: no Safari toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>. Depois abra
          pelo ícone e ative os avisos aqui.
        </Alert>
      )}
      {state === "sem-suporte" && <Alert kind="warning">Este navegador não aceita avisos. Use o Chrome (Android) ou o app instalado (iPhone).</Alert>}
      {state === "bloqueado" && (
        <Alert kind="warning">Os avisos estão bloqueados para este site. Libere em Configurações do navegador → Notificações.</Alert>
      )}
      {(state === "desativado" || state === "ativado") && (
        <button
          type="button"
          disabled={busy}
          onClick={state === "ativado" ? disable : enable}
          className={cx(
            "tap flex w-full items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-60",
            state === "ativado" ? "border-2 border-zinc-300 bg-white" : "bg-brand text-white",
          )}
        >
          {state === "ativado" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
          {busy ? "Aguarde…" : state === "ativado" ? "Desativar avisos neste aparelho" : "Ativar avisos neste aparelho"}
        </button>
      )}
      {state === "ativado" && (
        <button type="button" disabled={busy} onClick={test} className="text-sm font-semibold text-brand underline">
          Enviar aviso de teste
        </button>
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
