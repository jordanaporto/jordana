export const STATUSES = [
  "recebido",
  "em_inspecao",
  "em_diagnostico",
  "diagnostico_concluido",
  "orcamento_em_preparacao",
  "aguardando_aprovacao",
  "servico_aprovado",
  "em_manutencao",
  "aguardando_peca",
  "em_teste",
  "servico_concluido",
  "pronto_retirada",
  "entregue",
  "cancelada",
] as const;
export type OsStatus = (typeof STATUSES)[number];

export type StatusGroup = "entrada" | "avaliacao" | "comercial" | "execucao" | "finalizacao" | "cancelada";

type Meta = { n: number; label: string; group: StatusGroup; action: string };

export const STATUS_META: Record<OsStatus, Meta> = {
  recebido: { n: 1, label: "Veículo recebido", group: "entrada", action: "Marcar como recebido" },
  em_inspecao: { n: 2, label: "Em inspeção", group: "avaliacao", action: "Iniciar inspeção" },
  em_diagnostico: { n: 3, label: "Em diagnóstico", group: "avaliacao", action: "Iniciar diagnóstico" },
  diagnostico_concluido: { n: 4, label: "Diagnóstico concluído", group: "avaliacao", action: "Concluir diagnóstico" },
  orcamento_em_preparacao: { n: 5, label: "Orçamento em preparação", group: "comercial", action: "Preparar orçamento" },
  aguardando_aprovacao: { n: 6, label: "Aguardando aprovação", group: "comercial", action: "Enviar ao cliente" },
  servico_aprovado: { n: 7, label: "Serviço aprovado", group: "comercial", action: "Confirmar aprovação" },
  em_manutencao: { n: 8, label: "Em manutenção", group: "execucao", action: "Iniciar serviços" },
  aguardando_peca: { n: 9, label: "Aguardando peça", group: "execucao", action: "Aguardando peça" },
  em_teste: { n: 10, label: "Em teste", group: "execucao", action: "Iniciar teste" },
  servico_concluido: { n: 11, label: "Serviço concluído", group: "finalizacao", action: "Concluir serviço" },
  pronto_retirada: { n: 12, label: "Pronto para retirada", group: "finalizacao", action: "Liberar para retirada" },
  entregue: { n: 13, label: "Entregue", group: "finalizacao", action: "Registrar entrega" },
  cancelada: { n: 0, label: "Cancelada", group: "cancelada", action: "Cancelar OS" },
};

export const GROUP_STYLE: Record<StatusGroup, { chip: string; dot: string; bar: string; label: string }> = {
  entrada: { chip: "bg-zinc-800 text-white", dot: "bg-zinc-800", bar: "bg-zinc-700", label: "Entrada" },
  avaliacao: { chip: "bg-blue-700 text-white", dot: "bg-blue-700", bar: "bg-blue-600", label: "Avaliação técnica" },
  comercial: { chip: "bg-amber-500 text-black", dot: "bg-amber-500", bar: "bg-amber-500", label: "Comercial" },
  execucao: { chip: "bg-brand text-white", dot: "bg-brand", bar: "bg-brand", label: "Execução" },
  finalizacao: { chip: "bg-green-700 text-white", dot: "bg-green-700", bar: "bg-green-600", label: "Finalização" },
  cancelada: { chip: "bg-zinc-300 text-zinc-800", dot: "bg-zinc-400", bar: "bg-zinc-400", label: "Cancelada" },
};

export const OPEN_STATUSES = STATUSES.filter((s) => s !== "entregue" && s !== "cancelada");

export function statusLabel(s: OsStatus) {
  return STATUS_META[s]?.label ?? s;
}

/** Texto do botão para uma transição, considerando a etapa atual. */
export function transitionLabel(from: OsStatus, to: OsStatus, kind: "avancar" | "voltar" | "cancelar"): string {
  if (kind === "cancelar") return "Cancelar OS";
  if (kind === "voltar") return `Voltar para: ${statusLabel(to)}`;
  if (from === "aguardando_peca" && to === "em_manutencao") return "Peça chegou — retomar serviço";
  if (from === "em_teste" && to === "em_manutencao") return "Falhou no teste — voltar à manutenção";
  if (from === "recebido" && to === "em_diagnostico") return "Pular inspeção e iniciar diagnóstico";
  if (from === "aguardando_aprovacao" && to === "pronto_retirada") return "Cliente recusou tudo — liberar carro";
  if (from === "em_manutencao" && to === "servico_concluido") return "Concluir sem teste";
  if (from === "cancelada" && to === "entregue") return "Devolver veículo ao cliente";
  return STATUS_META[to].action;
}

export const CHECKLIST_RESULT = {
  ok: { label: "OK", short: "OK", cls: "bg-green-700 text-white border-green-700", soft: "bg-green-50 text-green-800 border-green-300" },
  atencao: { label: "Atenção", short: "Atenção", cls: "bg-amber-500 text-black border-amber-500", soft: "bg-amber-50 text-amber-900 border-amber-300" },
  necessita_reparo: { label: "Necessita reparo", short: "Reparo", cls: "bg-brand text-white border-brand", soft: "bg-red-50 text-red-800 border-red-300" },
  nao_avaliado: { label: "Não avaliado", short: "N/A", cls: "bg-zinc-600 text-white border-zinc-600", soft: "bg-zinc-50 text-zinc-600 border-zinc-300" },
} as const;
export type ChecklistResult = keyof typeof CHECKLIST_RESULT;

export const PRIORITY = {
  urgente: { label: "Urgente", cls: "bg-brand text-white" },
  recomendado: { label: "Recomendado", cls: "bg-amber-500 text-black" },
  pode_acompanhar: { label: "Pode acompanhar", cls: "bg-zinc-200 text-zinc-800" },
} as const;
export type Priority = keyof typeof PRIORITY;

export const APPROVAL = {
  pendente: { label: "Aguardando decisão", cls: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  aprovado: { label: "Aprovado", cls: "bg-green-50 text-green-800 border-green-300" },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-800 border-red-300" },
} as const;

export const APPROVAL_METHOD = {
  presencial: "Presencial",
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  link: "Link de aprovação",
} as const;

export const EXECUTION = {
  nao_iniciado: "Não iniciado",
  em_execucao: "Em execução",
  executado: "Executado",
  nao_executado: "Não executado",
} as const;

export const MESSAGE_STATUS = {
  na_fila: { label: "Pendente", cls: "bg-amber-100 text-amber-900" },
  enviando: { label: "Enviando", cls: "bg-blue-100 text-blue-900" },
  enviada: { label: "Enviada", cls: "bg-green-100 text-green-900" },
  entregue: { label: "Entregue", cls: "bg-green-100 text-green-900" },
  lida: { label: "Lida", cls: "bg-green-200 text-green-900" },
  falhou: { label: "Falhou", cls: "bg-red-100 text-red-900" },
  cancelada: { label: "Cancelada", cls: "bg-zinc-100 text-zinc-600" },
} as const;

export const FUEL = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  diesel: "Diesel",
  gnv: "GNV",
  hibrido: "Híbrido",
  eletrico: "Elétrico",
  outro: "Outro",
} as const;
