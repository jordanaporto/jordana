# 12. Instalar para uma nova oficina

O produto é o **Sistema de Serviço para Oficina**. Cada oficina recebe uma instalação própria
(site + banco de dados separados), com o nome, o logotipo e a cor dela. O código é o mesmo.

## 1. Marca (imagens)

Crie a pasta `public/brand/<nome-da-oficina>/` com:

| Arquivo | Tamanho sugerido | Uso |
|---------|------------------|-----|
| `logo-sm.png` | ~520 × 190 px, fundo transparente | Topo das telas, login e relatório PDF |
| `icon-192.png` | 192 × 192 px | Ícone do app no celular |
| `icon-512.png` | 512 × 512 px | Ícone do app (alta resolução) |
| `apple-touch-icon.png` | 180 × 180 px | Ícone no iPhone |

Exemplo pronto: `public/brand/injecar/`. Sem pasta configurada, o sistema usa um ícone neutro
com o nome da oficina em texto (`public/brand/padrao/`).

## 2. Configuração

No `.env` do servidor (ou nas variáveis do Netlify):

```env
NEXT_PUBLIC_OFICINA_NOME=Auto Mecânica Exemplo
NEXT_PUBLIC_OFICINA_NOME_CURTO=Exemplo        # nome embaixo do ícone no celular
NEXT_PUBLIC_OFICINA_PASTA=/brand/exemplo      # pasta do passo 1 (vazio = identidade neutra)
NEXT_PUBLIC_OFICINA_COR=1d4ed8                # cor principal, sem o #
```

Essas variáveis são lidas na compilação: depois de mudar, publique de novo.

## 3. Dados da empresa

Depois de instalar, entre como administrador em **Administração → Empresa e integração** e preencha
razão social, CNPJ, endereço, telefone e WhatsApp (aparecem no PDF e nas mensagens: `{oficina}`, `{endereco}`).

## 4. O resto é igual

Banco, usuários, checklist, mensagens e agenda seguem o mesmo passo a passo de
[08-implantacao.md](08-implantacao.md) (servidor próprio) ou [11-demonstracao.md](11-demonstracao.md) (Netlify + Supabase).

## Pedindo ao Claude

Abra uma sessão do Claude Code com este repositório e peça, por exemplo:

> “Crie a instalação do Sistema de Serviço para Oficina para a **Auto Mecânica Exemplo**: logo em anexo,
> cor azul, CNPJ …, endereço …, telefone …”
