import "server-only";
import { asSystem } from "./db";
import type { OsStatus } from "./status";

export type TrackingView = {
  oficina: { nome: string; telefone: string; whatsapp: string; endereco: string };
  os: { numero: string; status: OsStatus; status_desde: string; entrada: string; km: number; reclamacao: string; entregue_em: string | null };
  cliente: string;
  veiculo: { placa: string; marca: string; modelo: string; ano: number | null };
  historico: { status: OsStatus; em: string }[];
  diagnostico: { causa: string | null; recomendacao: string | null } | null;
  servicos: {
    id: string;
    titulo: string;
    descricao: string | null;
    peca: string | null;
    quantidade: number;
    prioridade: "urgente" | "recomendado" | "pode_acompanhar";
    total: number;
    decisao: "pendente" | "aprovado" | "recusado";
    execucao: string;
  }[];
  pode_aprovar: boolean;
  midias: { id: string; tipo: "foto" | "video"; legenda: string | null }[];
  notificacoes: number;
};

export const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;

/** Dados da página de acompanhamento (null se o link for inválido ou tiver expirado). */
export async function loadTracking(token: string): Promise<TrackingView | null> {
  if (!TOKEN_RE.test(token)) return null;
  const [r] = await asSystem((sql) => sql`select app.tracking_view(${token}) as v`);
  return (r?.v as TrackingView) ?? null;
}
