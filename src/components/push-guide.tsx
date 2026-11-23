"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { brand } from "@/lib/brand";
import { cx } from "@/components/ui";

/**
 * Passo a passo animado (como um GIF) para ativar os avisos no celular,
 * separado para Android e iPhone. Ilustrações simplificadas em SVG — nítidas
 * em qualquer tela e sem depender de prints de um modelo específico.
 */

type Platform = "android" | "iphone";
type Step = { title: string; text: ReactNode; art: ReactNode };

const RED = "var(--color-brand, #c80000)";

/* ---------------------------------------------------------------- moldura */
function Phone({ children, light = true }: { children: ReactNode; light?: boolean }) {
  return (
    <svg viewBox="0 0 180 330" className="mx-auto h-64 w-auto drop-shadow-md" role="img" aria-hidden="true">
      <rect x="2" y="2" width="176" height="326" rx="26" fill="#18181b" />
      <rect x="9" y="9" width="162" height="312" rx="20" fill={light ? "#ffffff" : "#e4e4e7"} />
      <rect x="66" y="14" width="48" height="10" rx="5" fill="#18181b" />
      {children}
    </svg>
  );
}

/** moldura piscando em volta de onde tocar (não cobre o texto) */
function Tap({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(8, h / 2)} fill={RED} fillOpacity="0.1" stroke={RED} strokeWidth="2.5" className="push-guide-pulse" />
      {/* dedo indicando o toque, ao lado do alvo */}
      <text x={x + w - 2} y={y + h + 13} fontSize="13">
        👆
      </text>
    </g>
  );
}

/** conteúdo genérico da página de acompanhamento */
function PageBody({ y = 44, button = true, label = "Ativar avisos" }: { y?: number; button?: boolean; label?: string }) {
  return (
    <g>
      <rect x="9" y={y} width="162" height="22" fill="#0d0d0d" />
      <rect x="18" y={y + 7} width="44" height="8" rx="2" fill={RED} />
      <rect x="20" y={y + 34} width="120" height="7" rx="3" fill="#d4d4d8" />
      <rect x="20" y={y + 47} width="90" height="7" rx="3" fill="#e4e4e7" />
      <rect x="20" y={y + 64} width="140" height="6" rx="3" fill={RED} />
      <rect x="20" y={y + 84} width="140" height="34" rx="6" fill="#f4f4f5" />
      {button && (
        <g>
          <rect x="20" y={y + 130} width="140" height="26" rx="7" fill={RED} />
          <text x="90" y={y + 147} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            🔔 {label}
          </text>
        </g>
      )}
    </g>
  );
}

function Dialog({ title, deny, allow, y = 120 }: { title: string; deny: string; allow: string; y?: number }) {
  return (
    <g>
      <rect x="9" y="30" width="162" height="291" fill="#000" opacity="0.35" />
      <rect x="22" y={y} width="136" height="86" rx="12" fill="#fff" />
      <text x="90" y={y + 22} textAnchor="middle" fontSize="9" fontWeight="700" fill="#18181b">
        {title}
      </text>
      <text x="90" y={y + 35} textAnchor="middle" fontSize="7.5" fill="#52525b">
        enviar notificações?
      </text>
      <line x1="22" y1={y + 50} x2="158" y2={y + 50} stroke="#e4e4e7" />
      <text x="56" y={y + 72} textAnchor="middle" fontSize="8.5" fill="#71717a">
        {deny}
      </text>
      <text x="124" y={y + 72} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#2563eb">
        {allow}
      </text>
    </g>
  );
}

function AppIcon({ x, y, size = 30, label }: { x: number; y: number; size?: number; label?: string }) {
  return (
    <g>
      <clipPath id={`ic-${x}-${y}`}>
        <rect x={x} y={y} width={size} height={size} rx={size * 0.23} />
      </clipPath>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.23} fill="#0d0d0d" />
      <image href={brand.icon192} x={x} y={y} width={size} height={size} clipPath={`url(#ic-${x}-${y})`} />
      {label && (
        <text x={x + size / 2} y={y + size + 10} textAnchor="middle" fontSize="7" fill="#18181b">
          {label}
        </text>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- iPhone */
const SafariBottom = ({ highlight }: { highlight?: boolean }) => (
  <g>
    <rect x="9" y="282" width="162" height="39" fill="#f4f4f5" />
    <rect x="20" y="262" width="140" height="16" rx="8" fill="#e4e4e7" />
    <text x="90" y="273" textAnchor="middle" fontSize="7" fill="#52525b">
      🔒 {brand.shortName.toLowerCase()}…/acompanhar
    </text>
    {/* voltar, avançar, compartilhar, favoritos, abas */}
    <path d="M26 300 l-5 -5 l5 -5" stroke="#2563eb" strokeWidth="2" fill="none" />
    <path d="M52 300 l5 -5 l-5 -5" stroke="#a1a1aa" strokeWidth="2" fill="none" />
    <g stroke="#2563eb" strokeWidth="2" fill="none">
      <rect x="83" y="293" width="14" height="13" rx="2" />
      <path d="M90 299 v-12 M85.5 291 l4.5 -4.5 l4.5 4.5" />
    </g>
    <path d="M118 292 h10 v14 l-5 -4 l-5 4 z" stroke="#2563eb" strokeWidth="2" fill="none" />
    <rect x="146" y="291" width="12" height="12" rx="2" stroke="#2563eb" strokeWidth="2" fill="none" />
    {highlight && <Tap x={76} y={285} w={28} h={26} />}
  </g>
);

const iphoneSteps = (name: string): Step[] => [
  {
    title: "Abra o link no Safari",
    text: (
      <>
        Toque no link que você recebeu. Se ele abrir dentro de outro app, toque em <b>⋯</b> e escolha <b>Abrir no Safari</b>.
      </>
    ),
    art: (
      <Phone>
        <PageBody y={32} button={false} />
        <SafariBottom />
      </Phone>
    ),
  },
  {
    title: "Toque em Compartilhar",
    text: (
      <>
        Na barra de baixo do Safari, toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).
      </>
    ),
    art: (
      <Phone>
        <PageBody y={32} button={false} />
        <SafariBottom highlight />
      </Phone>
    ),
  },
  {
    title: "“Adicionar à Tela de Início”",
    text: (
      <>
        Role a lista para baixo e toque em <b>Adicionar à Tela de Início</b>.
      </>
    ),
    art: (
      <Phone>
        <PageBody y={32} button={false} />
        <rect x="9" y="30" width="162" height="291" fill="#000" opacity="0.3" />
        <rect x="9" y="150" width="162" height="171" rx="14" fill="#f4f4f5" />
        {["Copiar", "Adicionar aos Favoritos", "Adicionar à Tela de Início", "Imprimir"].map((t, i) => (
          <g key={t}>
            <rect x="18" y={166 + i * 34} width="144" height="28" rx="7" fill="#fff" />
            <text x="28" y={184 + i * 34} fontSize="8" fill="#18181b" fontWeight={i === 2 ? 700 : 400}>
              {t}
            </text>
            {i === 2 && (
              <g stroke="#18181b" strokeWidth="1.4" fill="none">
                <rect x="140" y={172 + i * 34} width="14" height="14" rx="3" />
                <path d={`M147 ${175 + i * 34} v8 M143 ${179 + i * 34} h8`} />
              </g>
            )}
          </g>
        ))}
        <Tap x={15} y={231} w={150} h={34} />
      </Phone>
    ),
  },
  {
    title: "Toque em “Adicionar”",
    text: (
      <>
        Confira o nome <b>{name}</b> e toque em <b>Adicionar</b>, no canto de cima.
      </>
    ),
    art: (
      <Phone>
        <rect x="9" y="30" width="162" height="291" fill="#f4f4f5" />
        <text x="24" y="50" fontSize="8.5" fill="#2563eb">
          Cancelar
        </text>
        <text x="156" y="50" textAnchor="end" fontSize="8.5" fontWeight="700" fill="#2563eb">
          Adicionar
        </text>
        <rect x="18" y="66" width="144" height="54" rx="9" fill="#fff" />
        <AppIcon x={28} y={77} size={32} />
        <text x="70" y="91" fontSize="9" fontWeight="700" fill="#18181b">
          {name}
        </text>
        <rect x="70" y="99" width="70" height="5" rx="2" fill="#d4d4d8" />
        <Tap x={114} y={38} w={48} h={17} />
      </Phone>
    ),
  },
  {
    title: "Abra pelo novo ícone",
    text: (
      <>
        Volte para a tela de início do iPhone e abra o ícone <b>{name}</b> que apareceu.
      </>
    ),
    art: (
      <Phone light={false}>
        <rect x="9" y="9" width="162" height="312" rx="20" fill="url(#wall)" />
        <defs>
          <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3f3f46" />
            <stop offset="1" stopColor="#18181b" />
          </linearGradient>
        </defs>
        {Array.from({ length: 11 }).map((_, i) => (
          <rect key={i} x={22 + (i % 4) * 36} y={44 + Math.floor(i / 4) * 46} width="28" height="28" rx="7" fill="#71717a" opacity="0.7" />
        ))}
        <AppIcon x={130} y={136} size={28} />
        <text x="144" y="175" textAnchor="middle" fontSize="7" fill="#fff">
          {name}
        </text>
        <Tap x={124} y={131} w={40} h={50} />
      </Phone>
    ),
  },
  {
    title: "Ative e toque em “Permitir”",
    text: (
      <>
        Na página que abrir, toque em <b>Ativar avisos</b> e depois em <b>Permitir</b>. Pronto!
      </>
    ),
    art: (
      <Phone>
        <PageBody y={32} />
        <Dialog title={`“${name}” deseja`} deny="Não Permitir" allow="Permitir" />
        <Tap x={96} y={178} w={56} h={20} />
      </Phone>
    ),
  },
];

/* ---------------------------------------------------------------- Android */
const ChromeTop = ({ menu }: { menu?: boolean }) => (
  <g>
    <rect x="9" y="30" width="162" height="24" fill="#f4f4f5" />
    <rect x="18" y="35" width="122" height="14" rx="7" fill="#e4e4e7" />
    <text x="26" y="45" fontSize="7" fill="#52525b">
      🔒 {brand.shortName.toLowerCase()}…/acompanhar
    </text>
    <g fill="#52525b">
      <circle cx="157" cy="37" r="1.6" />
      <circle cx="157" cy="42" r="1.6" />
      <circle cx="157" cy="47" r="1.6" />
    </g>
    {menu && <Tap x={149} y={31} w={16} h={22} />}
  </g>
);

const androidSteps = (name: string, label: string): Step[] => [
  {
    title: `Toque em “${label}”`,
    text: (
      <>
        Abra o link pelo <b>Chrome</b> e toque no botão <b>{label}</b>. Se ele abrir dentro do WhatsApp, toque em <b>⋮</b> → <b>Abrir no Chrome</b>.
      </>
    ),
    art: (
      <Phone>
        <ChromeTop />
        <PageBody y={54} label={label} />
        <Tap x={16} y={180} w={148} h={34} />
      </Phone>
    ),
  },
  {
    title: "Toque em “Permitir”",
    text: (
      <>
        O celular pergunta se pode mandar notificações. Toque em <b>Permitir</b>.
      </>
    ),
    art: (
      <Phone>
        <ChromeTop />
        <PageBody y={54} label={label} />
        <Dialog title={name + " quer"} deny="Não permitir" allow="Permitir" y={130} />
        <Tap x={96} y={188} w={56} h={20} />
      </Phone>
    ),
  },
  {
    title: "Pronto! Os avisos chegam assim",
    text: <>A cada etapa do serviço aparece um aviso no topo do celular, mesmo com o navegador fechado. Toque nele para abrir o acompanhamento.</>,
    art: (
      <Phone light={false}>
        <rect x="9" y="9" width="162" height="312" rx="20" fill="#3f3f46" />
        <rect x="16" y="36" width="148" height="50" rx="12" fill="#fff" />
        <AppIcon x={24} y={46} size={20} />
        <text x="50" y="54" fontSize="7" fill="#71717a">
          {name} · agora
        </text>
        <text x="50" y="66" fontSize="8.5" fontWeight="700" fill="#18181b">
          Orçamento pronto
        </text>
        <text x="50" y="77" fontSize="7.5" fill="#52525b">
          Seu Onix · toque para ver
        </text>
        <Tap x={13} y={33} w={154} h={56} />
      </Phone>
    ),
  },
  {
    title: "Opcional: atalho na tela inicial",
    text: (
      <>
        Para abrir mais fácil: toque em <b>⋮</b> (canto de cima) → <b>Adicionar à tela inicial</b> → <b>Adicionar</b>.
      </>
    ),
    art: (
      <Phone>
        <ChromeTop menu />
        <PageBody y={54} button={false} />
        <rect x="80" y="54" width="88" height="118" rx="6" fill="#fff" stroke="#e4e4e7" />
        {["Nova guia", "Favoritos", "Compartilhar…", "Adicionar à tela inicial", "Configurações"].map((t, i) => (
          <text key={t} x="88" y={72 + i * 22} fontSize="7" fill="#18181b" fontWeight={i === 3 ? 700 : 400}>
            {t}
          </text>
        ))}
        <Tap x={83} y={128} w={82} h={15} />
      </Phone>
    ),
  },
];

/* ---------------------------------------------------------------- guia */
export function PushGuide({
  name = brand.shortName,
  buttonLabel = "Ativar avisos",
  initial,
}: {
  name?: string;
  buttonLabel?: string;
  initial?: Platform;
}) {
  const [platform, setPlatform] = useState<Platform>(initial ?? "android");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const touched = useRef(false);

  useEffect(() => {
    if (initial) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) setPlatform("iphone");
  }, [initial]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  const steps = platform === "iphone" ? iphoneSteps(name) : androidSteps(name, buttonLabel);
  const step = steps[Math.min(i, steps.length - 1)];

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), 3800);
    return () => clearTimeout(t);
  }, [i, playing, steps.length]);

  const go = (n: number) => {
    touched.current = true;
    setPlaying(false);
    setI((n + steps.length) % steps.length);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <div role="tablist" aria-label="Tipo de celular" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-zinc-200 p-1">
        {(["android", "iphone"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={platform === p}
            onClick={() => {
              setPlatform(p);
              setI(0);
            }}
            className={cx("min-h-10 rounded-lg text-sm font-bold", platform === p ? "bg-white text-ink shadow" : "text-zinc-600")}
          >
            {p === "android" ? "Android" : "iPhone"}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        <div key={platform + i} className="push-guide-fade">
          {step.art}
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
            Passo {i + 1} de {steps.length}
          </p>
          <h3 className="text-lg font-bold leading-tight">{step.title}</h3>
          <p className="mt-1 min-h-[3.75rem] text-[15px] text-zinc-700">{step.text}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(i - 1)} aria-label="Passo anterior" className="flex size-11 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {steps.map((_, n) => (
            <button key={n} type="button" onClick={() => go(n)} aria-label={`Passo ${n + 1}`} className={cx("h-2.5 rounded-full transition-all", n === i ? "w-6 bg-brand" : "w-2.5 bg-zinc-300")} />
          ))}
          <button type="button" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pausar" : "Reproduzir"} className="ml-1 flex size-8 items-center justify-center rounded-full text-zinc-500">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
        <button type="button" onClick={() => go(i + 1)} aria-label="Próximo passo" className="flex size-11 items-center justify-center rounded-xl border-2 border-zinc-300 bg-white">
          <ChevronRight className="size-5" />
        </button>
      </div>
      {platform === "iphone" && <p className="mt-3 text-xs text-zinc-500">Funciona no iPhone com iOS 16.4 ou mais novo (Ajustes → Geral → Sobre).</p>}
    </div>
  );
}

/** Quando o cliente tocou em "Não permitir" antes. */
export function PushUnblockHelp() {
  return (
    <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-zinc-800">
      <p className="font-semibold">Os avisos foram bloqueados neste celular. Para liberar:</p>
      <p>
        <b>Android:</b> toque no <b>cadeado 🔒</b> ao lado do endereço → <b>Permissões</b> (ou Configurações do site) → <b>Notificações</b> → <b>Permitir</b>. Depois recarregue a página.
      </p>
      <p>
        <b>iPhone:</b> <b>Ajustes</b> → <b>Notificações</b> → toque em <b>{brand.shortName}</b> → ative <b>Permitir Notificações</b>.
      </p>
    </div>
  );
}
