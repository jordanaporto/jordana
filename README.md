# Injecar Auto Center — Sistema de Ordens de Serviço

Sistema interno da oficina Injecar Auto Center para acompanhar cada veículo da entrada à entrega:
ordem de serviço digital, checklist com fotos e vídeos, diagnóstico, orçamento com aprovação por item,
relatório final em PDF, histórico permanente do veículo e atualizações ao cliente pelo WhatsApp (API oficial).

> **Estado atual:** fase de planejamento. Nenhum código de aplicação ainda — veja o plano abaixo.

## Planejamento

| Documento | Conteúdo |
|-----------|----------|
| [1. Análise e decisões](docs/01-analise-e-decisoes.md) | Leitura do briefing, pontos que precisam de decisão, riscos |
| [2. Arquitetura](docs/02-arquitetura.md) | Stack, diagrama, princípios, pastas, segurança/LGPD, WhatsApp |
| [3. Banco de dados](docs/03-banco-de-dados.md) | Tabelas, enums, funções, views, permissões (RLS) |
| [4. Mapa de telas](docs/04-mapa-de-telas.md) | Identidade visual, navegação por perfil, todas as telas |
| [5. Fluxo de atendimento](docs/05-fluxo-atendimento.md) | Da chegada à entrega, máquina de estados, alertas |
| [6. MVP × V2](docs/06-escopo-mvp-v2.md) | O que entra agora e o que fica para depois |
| [7. Plano de implementação](docs/07-plano-implementacao.md) | Etapas, entregas e como cada uma será testada |

## Stack

Next.js 15 · React · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · Zod ·
@react-pdf/renderer · WhatsApp Business Platform (Cloud API) · Vitest · Playwright · Netlify
