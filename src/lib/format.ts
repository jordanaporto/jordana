export const TZ = "America/Belem";

export function money(cents: number | string | bigint | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1.234,56" | "1234.56" | "R$ 10" → centavos */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).replace(/[R$\s]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | string | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  return v.toFixed(2).replace(".", ",");
}

const dtf = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dttf = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const tf = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function date(d: Date | string | null | undefined) {
  return d ? dtf.format(new Date(d)) : "—";
}
export function dateTime(d: Date | string | null | undefined) {
  return d ? dttf.format(new Date(d)).replace(",", " às") : "—";
}
export function time(d: Date | string | null | undefined) {
  return d ? tf.format(new Date(d)) : "—";
}

/** Duração em horas → "35 min", "3 h 20 min", "2 d 4 h" */
export function duration(hours: number | string | null | undefined): string {
  const h = Number(hours ?? 0);
  if (!Number.isFinite(h) || h < 0) return "—";
  const mins = Math.round(h * 60);
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return mm ? `${hh} h ${mm} min` : `${hh} h`;
  }
  const d = Math.floor(mins / (24 * 60));
  const hh = Math.floor((mins % (24 * 60)) / 60);
  return hh ? `${d} d ${hh} h` : `${d} d`;
}

export function km(v: number | string | null | undefined) {
  if (v == null || v === "") return "—";
  return `${Number(v).toLocaleString("pt-BR")} km`;
}

export function osNumber(n: number | string) {
  return `OS ${String(n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------- placa
/** Normaliza placa: maiúsculas, sem hífen/espaço. Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23). */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function isValidPlate(p: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(p));
}
export function formatPlate(p: string): string {
  const n = normalizePlate(p);
  return /^[A-Z]{3}[0-9]{4}$/.test(n) ? `${n.slice(0, 3)}-${n.slice(3)}` : n;
}

// ---------------------------------------------------------------- telefone
/** Converte telefone brasileiro para E.164 (+55DDDNÚMERO). Retorna null se inválido. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return "+" + d;
}
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return rest.length === 9
      ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
      : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return e164;
}
/** Link oficial click-to-chat do WhatsApp (wa.me) com mensagem preenchida. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------- CPF
export function normalizeCpf(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = input.replace(/\D/g, "");
  return d || null;
}
export function isValidCpf(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
export function formatCpf(d: string | null | undefined): string {
  if (!d) return "—";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
/** Mostra só o final do CPF (proteção de dados em telas de lista) */
export function maskCpf(d: string | null | undefined): string {
  if (!d) return "—";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "2026-11-13" no fuso de Belém */
export function belemDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return belemDay(d);
}
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" });
const shortWeekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });
export function weekdayName(day: string, short = false): string {
  const d = new Date(`${day}T12:00:00-03:00`);
  const s = (short ? shortWeekdayFmt : weekdayFmt).format(d).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function dayMonth(day: string): string {
  const [, m, dd] = day.split("-");
  return `${dd}/${m}`;
}
