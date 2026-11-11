# 9. WhatsApp — integração oficial

O sistema usa **somente** recursos oficiais da Meta:

| Modo | Como funciona | Quando usar |
|------|---------------|-------------|
| **Manual oficial** (padrão) | A mudança de etapa coloca a mensagem na fila. Em **Mensagens**, o atendente toca em **Abrir no WhatsApp** (link oficial `wa.me`, com o texto pronto), envia pelo aparelho da oficina e toca em **Marcar como enviada**. Fica registrado quem enviou e quando. | Desde o primeiro dia, sem depender de aprovação. |
| **Automático — Cloud API** | O servidor envia sozinho pela WhatsApp Business Platform, usando modelos aprovados. Status de entrega e leitura voltam pelo webhook. | Depois de configurar a conta na Meta. |

Nenhuma automação de WhatsApp Web é usada.

## Mensagens automáticas por etapa

Configure em **Administração → Mensagens do WhatsApp**. Já vêm prontas:

| Etapa | Texto |
|-------|-------|
| Veículo recebido | “Olá, {nome}. Seu {modelo} foi recebido pela equipe da Injecar…” |
| Em diagnóstico | “Seu veículo já está com nossa equipe técnica…” |
| Aguardando aprovação | “Concluímos a avaliação do seu veículo…” |
| Em manutenção (serviço iniciado) | “Os serviços aprovados no seu veículo já foram iniciados.” |
| Pronto para retirada | “Seu veículo está pronto…” |
| Entregue (desativada) | Agradecimento |

Variáveis: `{nome}` (primeiro nome), `{nome_completo}`, `{modelo}`, `{marca}`, `{placa}`, `{numero_os}`, `{oficina}`.

**Só recebe mensagem quem autorizou** (campo “Cliente aceita receber atualizações pelo WhatsApp”, com data e responsável registrados).

## Ativando a Cloud API (passo a passo)

1. **Meta Business Manager** (business.facebook.com): crie/verifique a empresa Injecar.
2. Em **developers.facebook.com**, crie um app do tipo *Business* e adicione o produto **WhatsApp**.
3. Adicione o **número** da oficina (pode ser o atual, com coexistência com o app WhatsApp Business, ou um número novo).
4. Gere um **token permanente** (usuário do sistema com permissão `whatsapp_business_messaging`).
5. No **WhatsApp Manager → Modelos de mensagem**, crie um modelo para cada texto (categoria **Utilidade**, idioma Português (BR)). Onde houver variável, use `{{1}}`, `{{2}}`… Exemplo:
   - Nome: `veiculo_recebido`
   - Texto: `Olá, {{1}}. Seu {{2}} foi recebido pela equipe da Injecar e já entrou em nosso fluxo de atendimento. Vamos mantendo você atualizado por aqui.`
6. No sistema, em **Administração → Mensagens**, informe em cada modelo:
   - **Nome do modelo aprovado na Meta**: `veiculo_recebido`
   - **Variáveis em ordem**: `nome, modelo`
7. No servidor, preencha no `.env` e reinicie (`docker compose up -d`):
   ```
   WHATSAPP_PHONE_NUMBER_ID=...      # ID do número (não é o telefone)
   WHATSAPP_ACCESS_TOKEN=...         # token permanente
   WHATSAPP_APP_SECRET=...           # "Chave secreta do app" (valida o webhook)
   WHATSAPP_VERIFY_TOKEN=...         # texto qualquer, igual ao cadastrado na Meta
   ```
8. Na Meta, configure o **Webhook**: URL `https://SEU-DOMINIO/api/whatsapp/webhook`, token de verificação = `WHATSAPP_VERIFY_TOKEN`, assine o campo **messages**.
9. Em **Administração → Empresa e integração**, mude o envio para **Automático — Cloud API**.

Modelos sem nome da Meta continuam saindo pelo modo manual — dá para migrar aos poucos.

## Custos

A Meta cobra por mensagem de modelo entregue (categoria Utilidade é a mais barata). Consulte a tabela vigente para o Brasil em developers.facebook.com/docs/whatsapp/pricing.

## Preparado para a versão 2

- **Aprovação por link**: o método `link` já existe no registro de aprovações.
- **Respostas do cliente**: todos os eventos do webhook já ficam guardados (`app.whatsapp_webhook_events`).
