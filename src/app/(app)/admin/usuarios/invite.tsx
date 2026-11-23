"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, MessageCircle } from "lucide-react";
import { Alert } from "@/components/ui";
import { brand } from "@/lib/brand";
import { inviteLinkAction, revokeInviteAction } from "./actions";

function waNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d;
  return d;
}

function expires(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Link pronto: copiar ou mandar pelo WhatsApp (pelo celular de quem está usando). */
export function InviteLinkBox({ url, expiresAt, name, username, phone }: { url: string; expiresAt: string; name: string; username: string; phone: string }) {
  const [copied, setCopied] = useState(false);
  const first = name.trim().split(/\s+/)[0] ?? "";
  const text =
    `Olá, ${first}! Este é seu acesso ao sistema da ${brand.name}.\n` +
    `Seu usuário: ${username}\n` +
    `Toque no link para criar sua senha (vale até ${expires(expiresAt)} e só pode ser usado uma vez):\n${url}`;
  const n = waNumber(phone);
  const wa = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  return (
    <div className="space-y-2 rounded-xl border-2 border-green-200 bg-green-50 p-3">
      <p className="text-sm font-semibold">Link de convite (vale até {expires(expiresAt)}, uso único)</p>
      <input readOnly value={url} onFocus={(e) => e.target.select()} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-zinc-300 bg-white text-sm font-semibold"
        >
          <Copy className="size-4" /> {copied ? "Copiado!" : "Copiar mensagem"}
        </button>
        <a href={wa} target="_blank" rel="noopener" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#1f8f4e] text-sm font-bold text-white">
          <MessageCircle className="size-4" /> Enviar no WhatsApp
        </a>
      </div>
      {!n && <p className="text-xs text-zinc-600">Sem telefone cadastrado: o WhatsApp vai pedir para escolher o contato.</p>}
    </div>
  );
}

/** Na ficha do usuário: gerar/trocar/cancelar o convite. */
export function InviteControls({ user, pendingUntil }: { user: { id: string; full_name: string; username: string; phone: string }; pendingUntil: string | null }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const open = !revoked && (link || pendingUntil);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-3">
      <p className="text-sm font-semibold">Acesso por link</p>
      <p className="text-sm text-zinc-600">
        A pessoa abre o link e cria a própria senha — ninguém mais fica sabendo. Serve também para quem esqueceu a senha.
      </p>
      {open && !link && <p className="text-sm text-amber-700">Há um convite aberto até {expires(pendingUntil!)}. Gerar outro cancela o anterior.</p>}
      {link && <InviteLinkBox url={link.url} expiresAt={link.expiresAt} name={user.full_name} username={user.username} phone={user.phone} />}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await inviteLinkAction(user.id);
              if (r.ok && r.url && r.expiresAt) {
                setLink({ url: r.url, expiresAt: r.expiresAt });
                setRevoked(false);
              } else setError(r.error ?? "Não foi possível gerar o link");
            })
          }
          className="flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-brand px-4 text-sm font-bold text-brand disabled:opacity-60"
        >
          <Link2 className="size-4" /> {open ? "Gerar novo link" : "Gerar link de convite"}
        </button>
        {open && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await revokeInviteAction(user.id);
                if (r.ok) {
                  setLink(null);
                  setRevoked(true);
                } else setError(r.error ?? "Erro");
              })
            }
            className="min-h-11 rounded-xl border-2 border-zinc-300 px-4 text-sm font-semibold"
          >
            Cancelar convite
          </button>
        )}
      </div>
      {revoked && <Alert kind="success">Convite cancelado. O link não funciona mais.</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
