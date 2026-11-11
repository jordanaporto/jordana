# 4. Mapa de telas e diretrizes de interface

## 4.1 Identidade e princípios visuais

| Token | Valor | Uso |
|-------|-------|-----|
| `--brand` | `#c80000` | Botão de ação principal, destaques, marca |
| `--ink` | `#0d0d0d` | Texto, cabeçalho, barra de navegação |
| `--paper` | `#ffffff` | Fundo |
| Cinzas neutros | `#f4f4f5` → `#52525b` | Cartões, bordas, textos secundários |
| Semânticas | verde `#15803d` · âmbar `#b45309` · vermelho `#c80000` · cinza `#71717a` | OK · Atenção · Necessita reparo · Não avaliado |

Regras para uso na oficina:

- **Alvo de toque mínimo de 56 px** nos botões do mecânico (mais que os 44 px padrão — mão suja, luva, pressa).
- **Uma ação principal por tela**, fixa no rodapé, em vermelho: "Avançar para: Em diagnóstico →".
- **Botão de câmera sempre visível** na ficha da OS (botão flutuante).
- **Status por cor + ícone + texto**, nunca só cor (acessibilidade).
- Fonte base 16 px no celular, títulos grandes, pouco texto, números grandes (placa, km).
- **Placa como identidade visual do carro** (estilo placa Mercosul) em todos os cartões — é como a oficina reconhece o veículo.
- Confirmação em bottom sheet (folha que sobe do rodapé) em vez de pop-up pequeno.
- Desktop: barra lateral + tabelas; celular: barra inferior de navegação + cartões.

Grupos de cor dos 13 status (a linha do tempo fica legível à distância):

| Grupo | Status | Cor |
|-------|--------|-----|
| Entrada | 1 Recebido | cinza escuro |
| Avaliação técnica | 2 Inspeção · 3 Diagnóstico · 4 Diagnóstico concluído | azul |
| Comercial | 5 Orçamento · 6 Aguardando aprovação · 7 Aprovado | âmbar |
| Execução | 8 Manutenção · 9 Aguardando peça · 10 Em teste | vermelho Injecar |
| Finalização | 11 Concluído · 12 Pronto p/ retirada · 13 Entregue | verde |

## 4.2 Navegação por perfil

| Perfil | Barra inferior (celular) / lateral (desktop) |
|--------|-----------------------------------------------|
| Mecânico | **Meus carros** · Buscar placa · Perfil |
| Atendimento | **Pátio** · **+ Nova OS** · Clientes · Mensagens (com contador) · Perfil |
| Admin | **Dashboard** · Pátio · + Nova OS · Clientes · Mensagens · Administração |
| Gestão | **Indicadores** · Dashboard · Pátio (leitura) |

## 4.3 Mapa de telas

```
LOGIN
 └─ /login ............................ usuário + senha, "manter conectado"

MECÂNICO
 ├─ /meus-carros ...................... cartões grandes: placa, modelo, status, há quanto tempo
 │                                      filtro rápido: "Para fazer" / "Aguardando" / "Concluídos hoje"
 └─ /os/[id] (ficha da OS) — abas fixas no topo, ação principal no rodapé, câmera flutuante
     ├─ Resumo ........................ reclamação do cliente, km, observações do atendimento, status
     ├─ Checklist ..................... categorias em acordeão; cada item com 3 botões grandes
     │                                  [✔ OK] [! Atenção] [✖ Reparo] + 📷 + nota; contador "18/32 avaliados"
     ├─ Fotos ......................... galeria da OS (filtro: checklist / diagnóstico / serviço / geral)
     ├─ Diagnóstico ................... campos em sequência, cada um com 📷; "Concluir diagnóstico"
     ├─ Serviços ...................... adicionar serviço/peça/prioridade; marcar "Executado"
     └─ Linha do tempo ................ status + observações + fotos em ordem cronológica
         └─ [folha] Avançar etapa ...... próxima etapa sugerida em destaque, outras permitidas abaixo,
                                         observação opcional, "Confirmar"

ATENDIMENTO
 ├─ /patio ............................ todos os carros na oficina
 │                                      celular: lista agrupada por status; desktop: quadro (kanban) por status
 │                                      filtros: mecânico, status, alertas
 ├─ /os/nova (assistente em 4 passos)
 │   1. Buscar por placa ou telefone → encontrou? usa : cadastra
 │   2. Cliente (nome, telefone, WhatsApp, CPF opcional, consentimento WhatsApp)
 │   3. Veículo (placa, marca, modelo, versão, ano, motor, combustível, cor)
 │   4. Entrada (km, reclamação, observações, mecânico) → "Abrir OS"
 ├─ /os/[id] .......................... mesma ficha do mecânico + abas:
 │   ├─ Orçamento ..................... preços por item, totais, prioridades, "Enviar ao cliente"
 │   ├─ Aprovação ..................... por item: [Aprovar] [Recusar] + forma (presencial/telefone/WhatsApp)
 │   ├─ Mensagens ..................... mensagens desta OS e seus estados
 │   └─ Entrega ....................... conferência final, gerar relatório PDF, "Registrar entrega"
 ├─ /clientes ......................... busca por nome/telefone/CPF/placa
 │   └─ /clientes/[id] ................ dados, consentimento, veículos, OS
 ├─ /veiculos/[id] .................... dados do veículo + HISTÓRICO (linha do tempo de atendimentos)
 │   └─ cada atendimento expande: km, reclamação, checklist, diagnóstico, fotos,
 │      serviços executados, recomendações recusadas/pendentes ("pode acompanhar")
 └─ /mensagens ........................ fila de WhatsApp: pendentes (modo manual → botão "Enviar no WhatsApp"
                                        + "Marcar como enviada"), enviadas, falhas

ADMIN
 ├─ /admin (dashboard)
 │   ├─ números do topo: na oficina · aguardando aprovação · sem atualização · prontos · entregues hoje
 │   ├─ veículos por status (barras) · veículos por mecânico
 │   ├─ tabela "tempo na etapa atual" (ordenada do mais parado)
 │   ├─ alertas ativos
 │   └─ tempo médio por etapa (últimos 30 dias)
 ├─ /admin/auditoria .................. histórico completo de alterações (filtros: usuário, OS, tabela, período)
 ├─ /admin/usuarios ................... criar, editar perfil, redefinir senha, desativar
 ├─ /admin/checklist .................. categorias e itens: criar, renomear, ordenar, ativar/desativar
 ├─ /admin/mensagens .................. modelos por status: texto, variáveis, prévia, nome do modelo Meta, ativo
 ├─ /admin/alertas .................... limites (horas) de cada alerta
 └─ /admin/configuracoes .............. dados da empresa (PDF), provedor de WhatsApp, LGPD (anonimizar/exportar cliente)

GESTÃO
 └─ /gestao ........................... MVP: carros atendidos no período, ticket médio, faturamento aprovado,
                                        aprovados × recusados. V2: demais indicadores.

PÚBLICO (V2)
 └─ /aprovar/[token] .................. orçamento da OS para o cliente aprovar/recusar por item
```

## 4.4 Esboço da tela principal do mecânico (ficha da OS)

```
┌──────────────────────────────┐
│ ←  OS 0142        ⋮          │  barra preta
│ ┌──────────┐ Onix 1.0 2021   │
│ │ QZX-1A23 │ João Silva      │  placa em destaque
│ └──────────┘ 72.450 km       │
│ ● EM DIAGNÓSTICO · há 1h20   │  chip azul
├──────────────────────────────┤
│ Resumo Checklist Fotos Diag… │  abas roláveis
├──────────────────────────────┤
│ FREIOS              3/4  ▾   │
│  Pastilhas                   │
│  [✔ OK][! Atenção][✖ Reparo] │  botões 56px
│  📷 2 fotos   ✎ "50% gasta"  │
│  Discos                      │
│  [✔ OK][! Atenção][✖ Reparo] │
│                         (📷) │  câmera flutuante
├──────────────────────────────┤
│ [ Avançar: Diagnóstico concluído → ] │  vermelho, fixo
└──────────────────────────────┘
```
