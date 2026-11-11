# Sistema de Serviço para Oficina

Sistema de ordens de serviço para oficinas mecânicas: acompanha cada veículo da entrada à entrega,
com ordem de serviço digital, checklist com fotos e vídeos, diagnóstico, orçamento com aprovação por item,
agenda com lembretes, relatório final em PDF, histórico permanente do veículo e atualizações ao cliente
pelo WhatsApp (somente recursos oficiais).

Feito para o **celular** (mecânicos e atendimento) e com painel para **computador** (administração e gestão).
Cada oficina recebe uma instalação própria com seu nome, logo e cor — veja [docs/12-nova-oficina.md](docs/12-nova-oficina.md).
Primeira oficina atendida: **Injecar Auto Center** (Castanhal-PA).

## O que já funciona

| Módulo | Destaques |
|--------|-----------|
| Acesso | Login individual (usuário + senha), 4 perfis (mecânico, atendimento, administrador, gestão), troca de senha obrigatória no 1º acesso, bloqueio por tentativas |
| Clientes e veículos | Cadastro, busca por placa/telefone/nome/CPF, vários veículos por cliente, consentimento de WhatsApp (LGPD) |
| Ordem de serviço | Assistente de abertura, 13 etapas + cancelamento, regras por perfil, motivo obrigatório para voltar/cancelar, data/hora/usuário em tudo |
| Pátio e “Meus carros” | Cartões grandes por etapa, tempo na etapa, alertas, filtro por mecânico |
| Checklist | 7 categorias / 34 itens do briefing, OK / Atenção / Reparo / Não avaliado, nota, foto e vídeo por item; administrador cria e edita itens sem mexer no código |
| Fotos e vídeos | Câmera do celular direto no sistema, compressão no aparelho, reenvio automático, galeria por atendimento, armazenamento privado com acesso protegido |
| Diagnóstico | Sintoma, testes, resultados, causa, componentes, recomendação, observações + mídia |
| Serviços e orçamento | Peça, quantidade, valores, prioridade (urgente / recomendado / pode acompanhar), totais, aprovação/recusa por item com forma e valor congelado, execução por item |
| Histórico do veículo | Todos os atendimentos: o que foi encontrado, diagnóstico, serviços executados, recomendações não realizadas, fotos |
| Relatório final | PDF profissional versionado (cliente, veículo, km, reclamação, checklist, diagnóstico, fotos, serviços aprovados/recusados/executados, técnico, histórico) |
| WhatsApp | Mensagens automáticas por etapa editáveis; envio manual oficial (`wa.me`) ou automático pela Cloud API da Meta; webhook com verificação de assinatura |
| Dashboard | Na oficina, por etapa, por mecânico, tempo em cada etapa, aguardando aprovação, sem atualização, finalizados, últimas alterações |
| Alertas | Sem atualização, orçamento parado, pronto sem aviso ao cliente, aguardando peça, diagnóstico demorado — limites configuráveis |
| Auditoria | Toda alteração (antes → depois), usuário, perfil, data/hora, filtrável por OS/usuário/período |
| Gestão | Carros atendidos, tempo médio de diagnóstico e aprovação, produtividade por mecânico, aprovados × recusados, faturamento por OS, ticket médio |
| LGPD | Exportar dados do cliente, anonimizar (inclusive na auditoria), coleta mínima |
| Agenda | Agendamento com confirmação no WhatsApp na hora, lembrete 1 dia antes e 2 horas antes; reagendar, falta, cancelamento e “chegou → abrir OS” |
| Avisos no celular | Notificações para a equipe: carro atribuído, serviço aprovado, diagnóstico/serviço concluído, aguardando peça, alertas |
| PWA | Instala na tela inicial do celular |

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [1. Análise e decisões](docs/01-analise-e-decisoes.md) | Leitura do briefing, decisões, riscos |
| [2. Arquitetura](docs/02-arquitetura.md) | Stack, segurança, LGPD, fluxo do WhatsApp |
| [3. Banco de dados](docs/03-banco-de-dados.md) | Tabelas, funções, views, permissões |
| [4. Mapa de telas](docs/04-mapa-de-telas.md) | Identidade visual e telas por perfil |
| [5. Fluxo de atendimento](docs/05-fluxo-atendimento.md) | Da chegada à entrega, máquina de estados, alertas |
| [6. MVP × V2](docs/06-escopo-mvp-v2.md) | Escopo |
| [7. Plano de implementação](docs/07-plano-implementacao.md) | Etapas e testes |
| [8. Implantação](docs/08-implantacao.md) | Colocar no ar (Docker), backups, desenvolvimento local |
| [9. WhatsApp](docs/09-whatsapp.md) | Modo manual e ativação da Cloud API |
| [10. Manual de uso](docs/10-manual-de-uso.md) | Passo a passo por perfil |
| [11. Demonstração online](docs/11-demonstracao.md) | https://injecar-demo.netlify.app (Netlify + Supabase, grátis) |
| [12. Nova oficina](docs/12-nova-oficina.md) | Como instalar para outra oficina (nome, logo, cor) |

## Rodar localmente

```bash
npm install
cp .env.example .env.local          # ajuste as conexões do PostgreSQL
npm run db:migrate
npm run db:create-admin -- admin "Administrador" "Injecar2026"
npm run db:demo                     # opcional: equipe e carros de exemplo
npm run dev                         # http://localhost:3000
```

## Testes

```bash
npm test                            # 57 testes: unidade + regras/permissões no PostgreSQL
npm run build && npm run test:e2e   # 13 cenários ponta a ponta no celular emulado
```

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (RLS) · Zod · @react-pdf/renderer ·
WhatsApp Business Platform (Cloud API) · Vitest · Playwright · Docker + Caddy
