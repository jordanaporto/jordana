# 1. Análise do briefing e pontos de decisão

## 1.1 Leitura do briefing

O sistema é, no fundo, um **fluxo de trabalho em torno da Ordem de Serviço (OS)**. Tudo gira em torno dela:

```
Cliente ──< Veículo ──< Ordem de Serviço ──┬── Linha do tempo (status)
                                           ├── Checklist (itens + resultado)
                                           ├── Mídias (fotos/vídeos)
                                           ├── Diagnóstico
                                           ├── Serviços recomendados ── Aprovações
                                           ├── Observações
                                           ├── Mensagens ao cliente (WhatsApp)
                                           └── Relatório final (PDF)
```

Três características definem a arquitetura:

1. **Uso principal no celular, em ambiente de oficina** (mãos sujas, pouca familiaridade com tecnologia, Wi-Fi instável). Isso pede interface com poucos toques, botões grandes e upload de mídia resiliente.
2. **Histórico permanente e auditável.** Nada importante pode ser apagado; toda alteração precisa de autor + data/hora. Isso pede exclusão lógica, tabelas "só inserção" e auditoria no próprio banco (não só na aplicação).
3. **Dados pessoais de clientes (LGPD) e fotos privadas.** Isso pede controle de acesso no nível do banco (RLS), armazenamento privado e URLs assinadas de curta duração.

## 1.2 Pontos que precisam da sua decisão

Para cada ponto deixo a **minha recomendação** (que vou adotar como padrão se você não se opuser).

| # | Decisão | Opções | Recomendação |
|---|---------|--------|--------------|
| D1 | **Login dos mecânicos** | (a) e-mail + senha; (b) usuário + senha (ex.: `joao`) | **(b) usuário + senha.** Mecânico nem sempre tem e-mail. O admin cria o usuário; internamente o sistema usa um e-mail técnico (`joao@usuarios.injecar.local`). |
| D2 | **Um ou vários mecânicos por OS** | (a) um responsável; (b) vários | **(a) um responsável por OS no MVP**, mas cada serviço executado registra quem executou. Permite "concluir sua parte". Equipe por OS fica para a V2. |
| D3 | **Mecânico vê valores do orçamento?** | (a) vê e edita; (b) cadastra serviço/peça sem preço, atendimento coloca preço; (c) vê tudo | **(b).** Mecânico cadastra o serviço, a peça e a prioridade; o atendimento precifica. Evita conflito com o cliente e erros de preço. Configurável depois. |
| D4 | **Envio de WhatsApp no MVP** | (a) só API oficial; (b) modo manual oficial (botão "Enviar no WhatsApp" via link `wa.me`, recurso oficial da Meta) enquanto a API não é aprovada + API oficial quando pronta | **(b).** A conta Meta Business + aprovação de modelos leva dias/semanas. O modo manual usa o *click-to-chat* oficial: o atendente toca no botão, o WhatsApp abre com a mensagem pronta e ele envia. Nada de WhatsApp Web automatizado. A troca para a API é só configuração. |
| D5 | **Número do WhatsApp Business** | número atual da oficina ou número novo | Decisão sua. A Meta hoje permite usar o mesmo número no app WhatsApp Business e na API ("coexistência"), mas **é preciso verificar a empresa no Meta Business Manager**. |
| D6 | **Mensagens configuráveis × modelos da Meta** | — | Pela regra da Meta, mensagens iniciadas pela empresa (fora da janela de 24h) precisam ser **modelos aprovados**. No sistema, o admin edita o texto; ao usar a API, cada texto precisa estar cadastrado e aprovado na Meta com o mesmo conteúdo. O sistema guarda os dois (texto + nome do modelo na Meta). |
| D7 | **Consentimento do cliente para WhatsApp** | — | **Obrigatório registrar** (LGPD e política da Meta): campo "aceita receber atualizações pelo WhatsApp" + data/hora + quem registrou. Sem consentimento, nenhuma mensagem é enfileirada. |
| D8 | **Vídeos: duração e tamanho** | — | **Até 60 s e 100 MB** por vídeo no MVP. Fotos comprimidas no próprio celular (~1600 px, ~300 KB) antes do envio, com miniatura. Exige plano Supabase Pro (o gratuito limita arquivos a 50 MB). |
| D9 | **Retenção de mídia** | guardar para sempre × expurgar após N anos | **Guardar indefinidamente no MVP** (histórico do veículo é o valor do produto) e definir política na V2 conforme custo. |
| D10 | **Funcionamento sem internet** | (a) exige conexão; (b) offline completo | **(a) no MVP, com fila de upload com nova tentativa automática** para fotos/vídeos (se o sinal cair, a foto não se perde enquanto a tela estiver aberta). Offline completo é V2. |
| D11 | **Regras de mudança de status** | livre × controlado | **Controlado:** cada perfil só move para as etapas que lhe cabem; voltar etapa é permitido a atendimento/admin com observação obrigatória. "Aguardando peça" ⇄ "Em manutenção" é livre. Detalhes em [05-fluxo-atendimento.md](05-fluxo-atendimento.md). |
| D12 | **Serviço novo descoberto durante a manutenção** | — | Pode ser adicionado a qualquer momento; entra como "pendente de aprovação" e o atendimento registra a nova aprovação sem precisar voltar a OS inteira de etapa. |
| D13 | **Hospedagem** | Vercel × Netlify | **Netlify** (você já usa e o plano gratuito permite uso comercial; o gratuito da Vercel não). Banco/arquivos no **Supabase, região São Paulo (sa-east-1)**. |
| D14 | **Custos mensais estimados** | — | Supabase Pro ≈ US$ 25/mês (banco, autenticação, 100 GB de arquivos, backups diários). Netlify: gratuito no início. WhatsApp API: cobrança por mensagem de modelo (categoria "utilidade" é a mais barata; conferir tabela vigente da Meta para o Brasil). Domínio (ex.: `sistema.injecar.com.br`): opcional. |
| D15 | **Faturamento / nota fiscal** | — | **Fora do escopo.** O sistema registra valores de peças e mão de obra por OS (base para faturamento e ticket médio), mas não emite NF-e nem controla pagamentos. |
| D16 | **Catálogo de peças e serviços** | texto livre × catálogo | **Texto livre no MVP**, com autocompletar a partir do que já foi digitado em outras OS. Catálogo/estoque na V2. |
| D17 | **Migração de dados existentes** | — | Vocês têm clientes/veículos em planilha ou outro sistema? Se sim, faço um importador CSV na etapa de clientes. |
| D18 | **Logotipo e dados da empresa** | — | Preciso do logo em alta (SVG ou PNG), CNPJ, endereço e telefone para o relatório PDF. |
| D19 | **Uma unidade ou várias** | — | Projetado para **uma oficina** (sem multiempresa). Se houver plano de abrir filiais, me avise agora — é barato preparar, caro adaptar depois. |

## 1.3 Riscos identificados

- **Aprovação da Meta** é o item com prazo menos previsível → mitigado pelo modo manual (D4).
- **Sinal ruim no pátio** → compressão de imagem no celular + fila de reenvio (D10).
- **Adoção pelos mecânicos** → telas com uma ação principal por vez, piloto com 1–2 mecânicos antes de liberar para todos.
- **Custo de armazenamento de vídeo** → limite de duração/tamanho (D8) e acompanhamento no painel do Supabase.
