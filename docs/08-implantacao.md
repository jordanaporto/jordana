# 8. Implantação (colocar no ar)

Duas formas. A **opção A** é a mais simples e barata para uma oficina.

## Opção A — um servidor (VPS) com Docker

**Custo típico:** VPS com 2 vCPU / 4 GB de RAM / 80 GB de disco, no Brasil (ex.: São Paulo) — algo entre R$ 40 e R$ 100/mês. Domínio próprio opcional (ex.: `sistema.injecar.com.br`).

1. Aponte o domínio (registro **A**) para o IP do servidor.
2. No servidor (Ubuntu), instale o Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Baixe o projeto e configure:
   ```bash
   git clone https://github.com/jordanaporto/jordana.git injecar && cd injecar
   cp deploy/.env.production.example .env
   nano .env      # preencha DOMAIN, APP_URL, POSTGRES_PASSWORD, APP_DB_PASSWORD, CRON_SECRET
   ```
   Para gerar senhas fortes: `openssl rand -base64 24`.
   Para os **avisos no celular**, gere as chaves uma vez e cole `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no `.env`:
   ```bash
   docker run --rm node:22-alpine npx -y web-push generate-vapid-keys
   ```
4. Suba tudo:
   ```bash
   docker compose up -d --build
   ```
   Isso cria: banco PostgreSQL, aplica as migrações, inicia o sistema, configura **HTTPS automático** (Let's Encrypt) e liga o **backup diário** em `./backups` (guarda 14 dias).
5. Crie o primeiro administrador:
   ```bash
   docker compose run --rm migrate npx tsx scripts/create-admin.ts admin "Seu Nome" "UmaSenhaForte1"
   ```
6. Acesse `https://seu-dominio` e entre como `admin`. Em **Administração → Usuários**, crie os logins da equipe.

### Atualizar para uma nova versão
```bash
git pull && docker compose up -d --build
```
As migrações novas são aplicadas automaticamente antes do sistema reiniciar.

### Backups
- Banco: arquivos `.dump` diários em `./backups`. Restaurar: `docker compose exec -T db pg_restore -U postgres -d injecar --clean < backups/ARQUIVO.dump`.
- Fotos/vídeos: volume Docker `media`. Copie periodicamente para fora do servidor, **ou** use `STORAGE_DRIVER=s3` (R2/S3), que já tem redundância.
- Recomendado: copiar `./backups` para outro local (ex.: Google Drive, outro servidor) toda semana.

## Opção B — serviços gerenciados

| Parte | Exemplo |
|-------|---------|
| Banco | Supabase (região São Paulo) — use a *connection string* do Postgres. Rode as migrações com `DATABASE_ADMIN_URL` = usuário `postgres` do Supabase. |
| Fotos | Supabase Storage (protocolo S3), Cloudflare R2 ou AWS S3 — `STORAGE_DRIVER=s3` + chaves. Bucket **privado**. |
| Aplicação | Qualquer serviço que rode Docker/Node 22 (Render, Railway, Fly.io, um VPS). Use o `Dockerfile` do projeto. |

Variáveis de ambiente: veja `.env.example` (comentado).

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local        # ajuste as URLs do Postgres local
npm run db:migrate
npm run db:create-admin -- admin "Administrador" "Injecar2026"
npm run db:demo                   # opcional: equipe e carros de exemplo (senha Injecar2026)
npm run dev                       # http://localhost:3000
```

Testes:
```bash
npm test            # unidade + regras do banco (precisa do banco injecar_test)
npm run build && npm run test:e2e   # ponta a ponta no celular emulado (banco injecar_e2e)
```

## Checklist antes de liberar para a equipe

- [ ] HTTPS funcionando (cadeado no navegador)
- [ ] Senhas fortes no `.env` e `.env` fora do Git
- [ ] Administrador criado e senha guardada em local seguro
- [ ] Logins individuais para cada mecânico e atendente
- [ ] Dados da empresa preenchidos (Administração → Empresa) — aparecem no PDF
- [ ] Backup testado (restaurar um `.dump` num banco de teste)
- [ ] Chaves dos avisos (VAPID) no `.env` e avisos ativados no celular de cada pessoa (Perfil)
- [ ] Piloto de 1 semana com 1–2 mecânicos
