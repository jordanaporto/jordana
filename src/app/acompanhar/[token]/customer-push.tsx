"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { PushGuide, PushUnblockHelp } from "@/components/push-guide";

function keyToBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "carregando" | "disponivel" | "ativo" | "iphone" | "bloqueado" | "sem-suporte";

/** Cliente ativa avisos gratuitos no celular a cada etapa do serviço. */
export function CustomerPush({ token, publicKey, active }: { token: string; publicKey: string; active: boolean }) {
  const [state, setState] = useState<State>("carregando");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "iphone" : "sem-suporte");
      }
      if (Notification.permission === "denied") return setState("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && active ? "ativo" : "disponivel");
    })().catch(() => setState("sem-suporte"));
  }, [active]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "bloqueado" : "disponivel");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      const res = await fetch(`/api/acompanhar/${token}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Não foi possível ativar");
      setState("ativo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey) return <p className="text-sm text-zinc-500">Avisos no celular indisponíveis no momento.</p>;
  if (state === "carregando") return <p className="text-sm text-zinc-500">…</p>;
  if (state === "ativo")
    return (
      <p className="flex items-center gap-2 font-semibold text-green-700">
        <CheckCircle2 className="size-5" /> Avisos ativados neste celular. Você será avisado a cada etapa.
      </p>
    );
  if (state === "iphone")
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-700">
          No iPhone, primeiro coloque o acompanhamento na <b>Tela de Início</b> e abra por lá. Siga os passos:
        </p>
        <PushGuide initial="iphone" />
      </div>
    );
  if (state === "bloqueado") return <PushUnblockHelp />;
  if (state === "sem-suporte")
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-700">Este navegador não aceita avisos. Abra o link pelo <b>Chrome</b> (Android) ou pelo <b>Safari</b> (iPhone):</p>
        <PushGuide />
      </div>
    );
  return (
    <div>
      <p className="mb-3 text-sm text-zinc-700">Receba um aviso no celular a cada etapa do serviço, sem precisar abrir o link.</p>
      <button type="button" disabled={busy} onClick={enable} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand font-bold text-white disabled:opacity-60">
        <Bell className="size-5" /> {busy ? "Ativando…" : "Ativar avisos"}
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-brand">{error}</p>}
      <button type="button" onClick={() => setGuide((v) => !v)} className="mt-3 w-full text-center text-sm font-semibold text-brand underline">
        {guide ? "Fechar passo a passo" : "Ficou com dúvida? Veja o passo a passo"}
      </button>
      {guide && (
        <div className="mt-3">
          <PushGuide />
        </div>
      )}
    </div>
  );
}
