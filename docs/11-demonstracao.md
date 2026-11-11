# 11. Demonstração online (gratuita)

Endereço: **https://injecar-demo.netlify.app**

Usuários de demonstração (senha `Injecar2026`): `admin`, `ana` (atendimento), `joao` e `carlos` (mecânicos), `dono` (gestão).
Os dados são fictícios. Não cadastre clientes reais na demonstração.

## Como está montada

| Parte | Serviço (plano grátis) |
|-------|------------------------|
| Telas e servidor | Netlify, projeto `injecar-demo` |
| Banco de dados | Supabase, projeto `injecar-demo` (São Paulo) |
| Fotos e PDFs | Netlify Blobs (armazenamento privado do Netlify) |
| Lembretes e avisos | Função agendada `tarefas` do Netlify (a cada minuto) |

- O banco usa dois usuários: `injecar_admin` (aplica as migrações na publicação) e `injecar_app` (usado pelo site, sujeito às regras de permissão). As senhas ficam como variáveis secretas no Netlify.
- A cada publicação, `scripts/netlify-build.ts` aplica migrações novas, garante o usuário `admin` e completa os dados de demonstração (sem duplicar).

## Limitações da versão grátis

- Envios de até 5 MB (fotos normais; vídeos só bem curtos).
- O Supabase pausa o banco após 7 dias sem acesso: no painel do Supabase, clique em **Restore project**.
- O primeiro acesso depois de um tempo parado pode levar alguns segundos.
- WhatsApp no modo manual (botão que abre o WhatsApp). Avisos no celular funcionam.

## Publicar uma nova versão

A partir de uma cópia limpa do repositório (sem `.env.local` nem pastas de compilação), rode o comando de
publicação que a ferramenta do Netlify fornece (`deploy-site`), ou conecte o repositório ao projeto no painel do
Netlify para publicar a cada `git push`.

A versão definitiva da oficina usa o servidor próprio descrito em [08-implantacao.md](08-implantacao.md).
