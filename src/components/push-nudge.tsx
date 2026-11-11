"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

/** Faixa discreta convidando a ativar os avisos, até a pessoa ativar ou dispensar. */
export function PushNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem("injecar-push-nudge") === "dispensado") return;
      } catch {}
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      if (Notification.permission !== "default") return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (await reg?.pushManager.getSubscription()) return;
      setShow(true);
    })().catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 bg-ink px-4 py-2 text-sm text-white lg:rounded-b-xl">
      <Bell className="size-4 shrink-0 text-brand" aria-hidden />
      <Link href="/perfil#avisos" className="flex-1 font-semibold underline-offset-2 hover:underline">
        Ative os avisos no celular para saber na hora quando algo mudar
      </Link>
      <button
        aria-label="Dispensar"
        onClick={() => {
          try {
            localStorage.setItem("injecar-push-nudge", "dispensado");
          } catch {}
          setShow(false);
        }}
        className="rounded p-1 hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
