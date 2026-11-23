import type { OsStatus } from "./status";

/** Etapas resumidas que o cliente vê na página de acompanhamento. */
export const CUSTOMER_STEPS = ["Recebido", "Avaliação", "Orçamento", "Serviço", "Pronto", "Entregue"] as const;

const STEP_OF: Record<OsStatus, number> = {
  recebido: 0,
  em_inspecao: 1,
  em_diagnostico: 1,
  diagnostico_concluido: 1,
  orcamento_em_preparacao: 1,
  aguardando_aprovacao: 2,
  servico_aprovado: 2,
  em_manutencao: 3,
  aguardando_peca: 3,
  em_teste: 3,
  servico_concluido: 3,
  pronto_retirada: 4,
  entregue: 5,
  cancelada: 0,
};

/** Frase da situação atual, em linguagem de cliente. */
export const CUSTOMER_STATUS_TEXT: Record<OsStatus, string> = {
  recebido: "Seu veículo foi recebido e já está na fila de atendimento.",
  em_inspecao: "Estamos fazendo a inspeção do seu veículo.",
  em_diagnostico: "Estamos fazendo os testes para identificar o problema.",
  diagnostico_concluido: "Diagnóstico concluído. Estamos preparando o orçamento.",
  orcamento_em_preparacao: "Estamos preparando o orçamento.",
  aguardando_aprovacao: "O orçamento está pronto e aguarda a sua aprovação.",
  servico_aprovado: "Orçamento aprovado. O serviço vai começar em breve.",
  em_manutencao: "Os serviços aprovados estão sendo feitos.",
  aguardando_peca: "Estamos aguardando uma peça para continuar.",
  em_teste: "Serviço feito. Agora estamos testando o veículo.",
  servico_concluido: "Serviço concluído. Estamos fazendo a verificação final.",
  pronto_retirada: "Seu veículo está pronto para retirada!",
  entregue: "Veículo entregue. Obrigado pela confiança!",
  cancelada: "Este atendimento foi encerrado. Fale com a oficina se tiver dúvidas.",
};

/** Nome curto de cada etapa na linha do tempo do cliente. */
export const CUSTOMER_STATUS_LABEL: Record<OsStatus, string> = {
  recebido: "Veículo recebido",
  em_inspecao: "Inspeção",
  em_diagnostico: "Diagnóstico",
  diagnostico_concluido: "Diagnóstico concluído",
  orcamento_em_preparacao: "Preparando orçamento",
  aguardando_aprovacao: "Orçamento enviado",
  servico_aprovado: "Orçamento aprovado",
  em_manutencao: "Serviço em andamento",
  aguardando_peca: "Aguardando peça",
  em_teste: "Teste do veículo",
  servico_concluido: "Serviço concluído",
  pronto_retirada: "Pronto para retirada",
  entregue: "Entregue",
  cancelada: "Encerrado",
};

export function customerStep(status: OsStatus) {
  return STEP_OF[status] ?? 0;
}
