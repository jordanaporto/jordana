# 7. Plano de implementação por etapas

> **Situação:** etapas 0 a 13 implementadas e testadas (57 testes de unidade/banco + 13 cenários de ponta a ponta). Falta apenas a parte que depende da oficina: publicar no servidor, cadastrar a equipe real e fazer o piloto.

Cada etapa termina com: **código + migração + testes passando + revisão**, e só então a próxima começa.
Nenhuma tela é entregue sem estar ligada ao banco de verdade.

| Etapa | Entrega | Como será testado |
|-------|---------|-------------------|
| **0. Fundação** | Projeto Next.js + TypeScript + Tailwind com os tokens Injecar; ESLint/Prettier; Vitest; Playwright; estrutura de pastas; CI no GitHub Actions; variáveis de ambiente documentadas | CI verde (lint, typecheck, teste de fumaça) |
| **1. Banco e segurança** | Migrações SQL de todas as tabelas, enums, triggers (`created_by`, `updated_at`, auditoria, `last_activity_at`), RLS de todas as tabelas, funções de status e aprovação, views; seed do checklist e dos modelos de mensagem | Testes SQL em Postgres local: cada perfil tenta ler/alterar/apagar o que não pode (deve falhar) e o que pode (deve funcionar); transições válidas e inválidas; auditoria gravada |
| **2. Autenticação e usuários** | Login usuário+senha, sessão, middleware de rotas por perfil, layout mobile (barra inferior) e desktop (barra lateral), tela de usuários do admin | Unidade: mapa de permissões. E2E: login de cada perfil cai na home certa; mecânico não abre rota de admin; usuário desativado não entra |
| **3. Clientes e veículos** | Cadastro, edição, busca, consentimento, validação de placa/telefone/CPF | Unidade: validações. E2E: cadastrar cliente com 2 veículos, buscar por placa |
| **4. Ordem de serviço e status** | Assistente de abertura, pátio (lista/quadro), "Meus carros", ficha da OS (Resumo e Linha do tempo), folha "Avançar etapa", observações | SQL + E2E: abrir OS, mecânico vê só a dele, percorrer as 13 etapas, voltar etapa com observação, histórico correto |
| **5. Checklist** | Preenchimento por item na OS; telas de configuração de categorias/itens | E2E: preencher itens; admin cria item novo e ele aparece só nas OS novas; renomear não altera OS antiga |
| **6. Fotos e vídeos** | Câmera, compressão, miniatura, upload com URL assinada e nova tentativa, galeria, vínculo com item/diagnóstico/serviço | Unidade: compressão e regras de tipo/tamanho. E2E: enviar foto; usuário sem acesso não obtém URL; arquivo não abre sem assinatura |
| **7. Diagnóstico** | Aba de diagnóstico com mídia e conclusão | E2E: registrar diagnóstico; edição aparece na auditoria |
| **8. Serviços, orçamento, aprovação e execução** | Itens, preços (só atendimento/admin), totais, aprovação por item, execução | SQL: mecânico não altera preço; decisão congela valor. E2E: orçamento com 3 itens, aprova 2, recusa 1, executa os 2 |
| **9. Histórico do veículo** | Ficha do veículo com todos os atendimentos e detalhes | E2E: veículo com 3 OS mostra os 3 atendimentos em ordem |
| **10. Relatório PDF** | Geração no servidor, armazenamento em versões, download | Teste do gerador com OS completa; conferência visual do PDF |
| **11. WhatsApp** | Modelos editáveis, fila automática, modo manual, adaptador Cloud API, webhook com assinatura, tarefa agendada | Unidade: renderização de variáveis, adaptador com API simulada, verificação de assinatura. E2E: mudar status gera mensagem na fila; sem consentimento não gera |
| **12. Dashboard, alertas e auditoria** | Dashboard do admin, configuração de limites, tela de auditoria | SQL: views de duração e alertas com dados de teste. E2E: carro parado aparece no alerta |
| **13. Gestão, PWA, LGPD e publicação** | Indicadores básicos, manifesto/ícones, anonimização/exportação, cabeçalhos de segurança, deploy Netlify + Supabase produção, usuários reais | Checklist de segurança; teste em celular real; **piloto de 1 semana com 1–2 mecânicos** antes de liberar para todos |

## Ordem das conversas

1. **Agora:** você revisa este plano e responde os pontos de decisão (`01-analise-e-decisoes.md`, seção 1.2). O que não for respondido segue com a minha recomendação.
2. Eu começo pelas etapas **0 e 1** (fundação + banco + segurança), que podem ser desenvolvidas e testadas aqui mesmo com um Postgres local, sem depender de contas externas.
3. Para a etapa 2 em diante, vou precisar de um **projeto Supabase** (posso orientar a criação: leva ~5 minutos; região São Paulo).
4. Ao final de cada etapa eu reporto o que foi feito, como foi testado e o que vem a seguir.
