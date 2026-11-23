import type { Metadata } from "next";
import { MessageCircle, Phone, Play } from "lucide-react";
import { Logo } from "@/components/logo";
import { Plate, cx } from "@/components/ui";
import { brand, PRODUCT_NAME } from "@/lib/brand";
import { CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TEXT, CUSTOMER_STEPS, customerStep } from "@/lib/customer-status";
import { dateTime, formatPhone, km, money, normalizePhone, whatsappLink } from "@/lib/format";
import { pushConfig } from "@/lib/push";
import { PRIORITY } from "@/lib/status";
import { loadTracking } from "@/lib/tracking";
import { CustomerPush } from "./customer-push";
import { DecisionButtons } from "./decision-buttons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Acompanhe seu veículo",
    manifest: `/api/acompanhar/${token}/manifest`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await loadTracking(token);

  if (!t) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold">Link expirado ou inválido</h1>
          <p className="mt-2 text-zinc-600">Peça um novo link para a {brand.name}.</p>
        </div>
      </Shell>
    );
  }

  const step = customerStep(t.os.status);
  const cancelled = t.os.status === "cancelada";
  const pendentes = t.servicos.filter((s) => s.decisao === "pendente").length;
  const aprovado = t.servicos.filter((s) => s.decisao === "aprovado").reduce((a, s) => a + Number(s.total), 0);
  const wa = normalizePhone(t.oficina.whatsapp || t.oficina.telefone);
  const oficina = t.oficina.nome || brand.name;

  return (
    <Shell>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-500">Olá, {t.cliente}! Este é o acompanhamento do seu veículo.</p>
        <div className="mt-3 flex items-center gap-3">
          <Plate plate={t.veiculo.placa} size="lg" />
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight">
              {t.veiculo.marca} {t.veiculo.modelo} {t.veiculo.ano ?? ""}
            </div>
            <div className="text-sm text-zinc-500">
              OS {t.os.numero} · entrada {dateTime(t.os.entrada)} · {km(t.os.km)}
            </div>
          </div>
        </div>

        <p className={cx("mt-5 text-xl font-bold leading-snug", t.os.status === "pronto_retirada" && "text-green-700")}>
          {CUSTOMER_STATUS_TEXT[t.os.status]}
        </p>
        <p className="text-sm text-zinc-500">Atualizado em {dateTime(t.os.status_desde)}</p>

        {!cancelled && (
          <ol className="mt-5 grid grid-cols-6 gap-1" aria-label="Etapas do serviço">
            {CUSTOMER_STEPS.map((label, i) => (
              <li key={label} className="text-center">
                <div className={cx("h-2 rounded-full", i <= step ? "bg-brand" : "bg-zinc-200")} />
                <div className={cx("mt-1 text-[10px] font-semibold leading-tight sm:text-xs", i === step ? "text-ink" : "text-zinc-400")}>{label}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {t.pode_aprovar && pendentes > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 font-semibold text-amber-900">
          Seu orçamento está pronto. Veja abaixo e toque em <b>Aprovar</b> ou <b>Recusar</b> em cada serviço.
        </div>
      )}

      {t.diagnostico && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">O que encontramos</h2>
          {t.diagnostico.causa && <p className="text-[17px]">{t.diagnostico.causa}</p>}
          {t.diagnostico.recomendacao && <p className="mt-2 text-zinc-700">Recomendação: {t.diagnostico.recomendacao}</p>}
        </section>
      )}

      {t.servicos.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">Orçamento</h2>
          <ul className="space-y-3">
            {t.servicos.map((s) => (
              <li key={s.id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY[s.prioridade].cls)}>
                      {PRIORITY[s.prioridade].label}
                    </span>
                    <div className="mt-1 font-bold">{s.titulo}</div>
                    {s.peca && (
                      <div className="text-sm text-zinc-600">
                        {s.peca}
                        {Number(s.quantidade) !== 1 && ` × ${Number(s.quantidade).toLocaleString("pt-BR")}`}
                      </div>
                    )}
                    {s.descricao && <div className="text-sm text-zinc-600">{s.descricao}</div>}
                  </div>
                  <div className="shrink-0 text-lg font-bold tabular-nums">{money(s.total)}</div>
                </div>
                <DecisionButtons token={token} itemId={s.id} decisao={s.decisao} execucao={s.execucao} canDecide={t.pode_aprovar} />
              </li>
            ))}
          </ul>
          {aprovado > 0 && (
            <div className="mt-3 flex justify-between border-t border-zinc-100 pt-3 font-bold">
              <span>Total aprovado</span>
              <span className="tabular-nums">{money(aprovado)}</span>
            </div>
          )}
        </section>
      )}

      {t.midias.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">Fotos e vídeos ({t.midias.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {t.midias.map((m) => (
              <a key={m.id} href={`/api/acompanhar/${token}/media/${m.id}`} target="_blank" rel="noopener" className="relative block aspect-square overflow-hidden rounded-lg bg-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/acompanhar/${token}/media/${m.id}?thumb=1`} alt={m.legenda ?? "Foto do veículo"} loading="lazy" className="size-full object-cover" />
                {m.tipo === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="size-8 fill-white text-white" aria-hidden />
                  </span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">Avisos no celular</h2>
        <CustomerPush token={token} publicKey={pushConfig().publicKey} active={t.notificacoes > 0} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">Linha do tempo</h2>
        <ol className="relative space-y-3 border-l-2 border-zinc-200 pl-5">
          {[...t.historico].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className={cx("absolute -left-[27px] top-1.5 size-3 rounded-full", i === 0 ? "bg-brand" : "bg-zinc-300")} />
              <div className="font-semibold">{CUSTOMER_STATUS_LABEL[h.status]}</div>
              <div className="text-sm text-zinc-500">{dateTime(h.em)}</div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-zinc-500">Você relatou: “{t.os.reclamacao}”</p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">{oficina}</h2>
        {t.oficina.endereco && <p className="text-zinc-700">{t.oficina.endereco}</p>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {wa && (
            <a
              href={whatsappLink(wa, `Olá! Sou ${t.cliente}, do ${t.veiculo.modelo} placa ${t.veiculo.placa} (OS ${t.os.numero}).`)}
              target="_blank"
              rel="noopener noreferrer"
              className="tap flex items-center justify-center gap-2 rounded-xl bg-[#1f8f4e] font-bold text-white"
            >
              <MessageCircle className="size-5" /> Falar com a oficina
            </a>
          )}
          {t.oficina.telefone && (
            <span className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-300 font-semibold">
              <Phone className="size-5" /> {formatPhone(normalizePhone(t.oficina.telefone)) !== "—" ? formatPhone(normalizePhone(t.oficina.telefone)) : t.oficina.telefone}
            </span>
          )}
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-100">
      <header className="bg-ink px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Logo className="h-10" />
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">{children}</main>
      <footer className="pb-8 text-center text-xs text-zinc-400">{PRODUCT_NAME}</footer>
    </div>
  );
}
