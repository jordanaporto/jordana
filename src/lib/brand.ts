/**
 * Marca da instalação. O produto se chama "Sistema de Serviço para Oficina";
 * cada oficina configura nome, logo, ícones e cor nas variáveis de ambiente
 * NEXT_PUBLIC_OFICINA_* (veja docs/12-nova-oficina.md). Sem configuração, usa
 * uma identidade neutra.
 *
 * Os dados do relatório (CNPJ, endereço, telefone) ficam em Administração → Empresa.
 */
export const PRODUCT_NAME = "Sistema de Serviço para Oficina";

const name = process.env.NEXT_PUBLIC_OFICINA_NOME || "Minha Oficina";
const assets = (process.env.NEXT_PUBLIC_OFICINA_PASTA || "/brand/padrao").replace(/\/$/, "");
// aceita "#c80000", "c80000" ou entre aspas (em arquivos .env o "#" pode virar comentário)
const corInformada = (process.env.NEXT_PUBLIC_OFICINA_COR ?? "").replace(/["'#\s]/g, "");
const primary = /^[0-9a-f]{6}$/i.test(corInformada) ? `#${corInformada}` : "#2563eb";

/** Escurece uma cor hexadecimal (para estados de toque/hover). */
function darken(hex: string, amount = 0.2) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f(n >> 16), g = f((n >> 8) & 0xff), b = f(n & 0xff);
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

export const brand = {
  /** Nome da oficina (ex.: "Injecar Auto Center") */
  name,
  /** Nome curto, para o ícone do app no celular */
  shortName: process.env.NEXT_PUBLIC_OFICINA_NOME_CURTO || name,
  /** Pasta pública com logo-sm.png (opcional) e icon-192/512.png, apple-touch-icon.png */
  assets,
  /** Logotipo da oficina; vazio = mostra ícone + nome em texto */
  logo: process.env.NEXT_PUBLIC_OFICINA_PASTA ? `${assets}/logo-sm.png` : "",
  icon192: `${assets}/icon-192.png`,
  icon512: `${assets}/icon-512.png`,
  appleIcon: `${assets}/apple-touch-icon.png`,
  primary,
  primaryDark: darken(primary),
};
