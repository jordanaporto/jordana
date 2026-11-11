# 6. Escopo: MVP × Versão 2

## 6.1 MVP (versão 1) — tudo funcional, ligado ao banco

**Acesso e segurança**
- Login por usuário e senha; 4 perfis; admin cria/desativa usuários e redefine senhas.
- RLS em todas as tabelas, auditoria automática, exclusão lógica, mídia privada com URL assinada.

**Cadastros**
- Clientes (com consentimento de WhatsApp) e veículos; vários veículos por cliente; busca por placa/nome/telefone/CPF.

**Ordem de serviço**
- Abertura em assistente de 4 passos; atribuição de mecânico.
- 13 status + cancelamento, com regras por perfil, histórico completo e linha do tempo.
- Observações livres (só inserção).

**Checklist**
- Checklist inicial do briefing já cadastrado (7 categorias, 34 itens).
- Preenchimento com OK / Atenção / Necessita reparo / Não avaliado + observação + fotos/vídeos por item.
- Admin cria, renomeia, ordena e desativa categorias e itens pela tela.

**Fotos e vídeos**
- Câmera do celular direto pelo sistema; compressão e miniatura no aparelho; nova tentativa automática em caso de falha.
- Vínculo com veículo, OS, item do checklist / diagnóstico / serviço, usuário e data/hora.
- Galeria por atendimento, com filtros.

**Diagnóstico** — área própria com todos os campos do briefing + mídia.

**Serviços, orçamento e aprovação**
- Itens com serviço, descrição, peça, quantidade, valores, prioridade; totais automáticos.
- Aprovação/recusa por item com forma (presencial, telefone, WhatsApp), data/hora e valor congelado.
- Execução por item (quem executou, quando).

**Histórico do veículo** — todos os atendimentos com o que foi encontrado, fotos, serviços executados e recomendações antigas.

**Relatório final em PDF** — todos os blocos do briefing, com fotos marcadas como relevantes; guardado em versões.

**WhatsApp (estrutura oficial)**
- Modelos de mensagem por status editáveis pelo admin (com prévia).
- Fila automática disparada pelas mudanças de status (respeitando consentimento).
- Modo **manual oficial** (link `wa.me` + "marcar como enviada") funcionando desde o primeiro dia.
- Adaptador **Cloud API** + webhook de status com verificação de assinatura, testados com simulação; ativação assim que a conta Meta e os modelos forem aprovados.

**Dashboard do admin** — na oficina, por status, por mecânico, tempo em cada etapa, aguardando aprovação, sem atualização, finalizados, alertas, tela de auditoria.

**Alertas internos** — os 5 alertas do briefing, com limites configuráveis, exibidos no dashboard e no pátio.

**Gestão (básico)** — perfil de leitura com carros atendidos, faturamento aprovado, ticket médio e aprovados × recusados no período.

**PWA e LGPD** — instalável no celular; anonimização e exportação de dados do cliente; dados no Brasil.

## 6.2 Versão 2

| Item | Observação |
|------|------------|
| Aprovação pelo cliente via link no WhatsApp | Tabela e método `link` já previstos |
| Indicadores gerenciais completos | Tempo médio de diagnóstico/aprovação, produtividade por mecânico, faturamento por período, gráficos de tendência — dados já coletados desde o MVP |
| Caixa de entrada do WhatsApp (respostas do cliente) | Eventos do webhook já armazenados |
| Notificações push dos alertas para atendimento/admin | |
| Modo offline completo | Sincronização posterior |
| Vários mecânicos por OS e apontamento de horas | |
| Catálogo de serviços e peças, estoque | |
| Lembretes de revisão / pós-venda pelo WhatsApp | Ex.: "Já faz 6 meses da sua troca de óleo" |
| Checklist de entrega com assinatura do cliente na tela | |
| Transferência de veículo entre clientes (venda do carro) | Histórico já é do veículo |
| Agendamento de serviços | |
| Emissão de NF-e / integração financeira | |
| Política de retenção e arquivamento de mídia antiga | |
