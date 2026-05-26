# Deploy em Produção — ArtPlim ERP

Guia completo para subir, atualizar e operar a stack de produção via Docker
Compose. Esta documentação reflete o setup atual do repositório.

> **Nota sobre os dois ambientes**: o projeto roda em **dev** e **prod**
> simultaneamente sem conflito. Cada um tem seu próprio compose, seus
> próprios volumes e suas próprias portas. Você nunca precisa parar um
> para subir o outro.

---

## Sumário

- [Arquitetura da stack de produção](#arquitetura-da-stack-de-produção)
- [Pré-requisitos](#pré-requisitos)
- [Setup inicial (primeira vez)](#setup-inicial-primeira-vez)
- [Comandos do dia a dia](#comandos-do-dia-a-dia)
- [Como os dados são preservados](#como-os-dados-são-preservados)
- [Cloudflare Tunnel](#cloudflare-tunnel)
- [Coexistência dev × prod](#coexistência-dev--prod)
- [Troubleshooting](#troubleshooting)

---

## Arquitetura da stack de produção

Arquivo: `docker-compose.prod.yml` — nome do projeto: `artplim-prod`.

| Serviço       | Imagem                                  | Porta no host | Função                                        |
|---------------|-----------------------------------------|---------------|-----------------------------------------------|
| `frontend`    | build de `frontend/Dockerfile.prod`     | **80**        | React buildado, servido por nginx             |
| `backend`     | build de `backend/Dockerfile.prod`      | — (interno)   | Fastify + Prisma na porta 3001 da rede docker |
| `postgres`    | `postgres:15-alpine`                    | — (interno)   | Banco de dados                                |
| `redis`       | `redis:7-alpine`                        | — (interno)   | Cache / pubsub / filas                        |
| `cloudflared` | `cloudflare/cloudflared:latest`         | — (outbound)  | Túnel Cloudflare → frontend                   |
| `db_backup`   | `prodrigestivill/postgres-backup-local` | — (interno)   | Dump diário do postgres                       |

### Fluxo de requisição

```
Navegador
    │
    ▼
http://localhost  (rede LAN)              https://erp.artplim.com.br  (internet)
    │                                                │
    │                                                ▼
    │                                         Cloudflare Tunnel
    │                                                │
    └─────────────► nginx (frontend) ◄───────────────┘
                         │
                         │ proxy /api, /auth, /socket.io
                         ▼
                    Fastify (backend)
                         │
                  ┌──────┴──────┐
                  ▼             ▼
              postgres        redis
```

O nginx do frontend é o único ponto de entrada — ele serve a SPA estática
e proxia as rotas de API para o backend internamente.

---

## Pré-requisitos

- **Docker Desktop** rodando no Windows (ou Docker Engine no Linux)
- **Cloudflare Tunnel** configurado (veja seção
  [Cloudflare Tunnel](#cloudflare-tunnel))
- Arquivo **`.env.prod`** na raiz, com senhas reais
  (cópia de `.env.prod.example`)

---

## Setup inicial (primeira vez)

### 1. Criar o `.env.prod`

```powershell
copy .env.prod.example .env.prod
```

Abra `.env.prod` e preencha **todas** as variáveis com valores reais:

| Variável                  | O que é                                  | Como gerar                              |
|---------------------------|------------------------------------------|-----------------------------------------|
| `POSTGRES_PASSWORD`       | Senha do banco                           | `openssl rand -base64 32` (Git Bash)    |
| `REDIS_PASSWORD`          | Senha do Redis                           | `openssl rand -base64 32`               |
| `JWT_SECRET`              | Segredo para assinar tokens JWT          | `openssl rand -base64 48`               |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token do túnel (modo remote-managed)     | Painel Cloudflare (Zero Trust → Tunnels)|
| `FRONTEND_HOST_PORT`      | Porta do host onde nginx vai responder   | `80` (padrão) ou outro se 80 ocupada    |

> O arquivo `.env.prod` está no `.gitignore` — nunca vai pro git. ✅

### 2. Primeiro build

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

O primeiro build demora **~5-10 minutos** (baixa imagens base, builda
backend e frontend, configura tudo). Builds seguintes usam cache e ficam
muito mais rápidos.

### 3. Verificar

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Todos os serviços devem estar `Up` (`cloudflared` só fica saudável
depois do túnel estar configurado).

Testes rápidos:

```powershell
curl http://localhost            # frontend (HTTP 200 = ok)
curl http://localhost/api        # proxy para backend
```

---

## Comandos do dia a dia

> **Dica**: como o comando é longo, considere criar um script `prod.ps1`
> na raiz (veja a seção [Atalho recomendado](#atalho-recomendado) abaixo).

### Atualizar depois de mudar código (mais comum)

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

- Rebuilda só as imagens cujo contexto mudou
- Recria só os containers afetados
- Postgres/Redis ficam intocados
- **Dados preservados** ✅

### Atualizar depois de mudar `.env.prod`

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate
```

`--force-recreate` força todos os containers a reiniciarem para
relerem as variáveis. **Dados preservados** ✅

### Reiniciar UM serviço específico

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend
```

Útil quando o backend travou ou você só quer reiniciá-lo sem rebuild.

### Ver status

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

### Ver logs

```powershell
# Todos os serviços
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# Um serviço só
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f cloudflared

# Últimas 100 linhas, sem follow
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 backend
```

### Parar tudo (dados preservados)

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod down
```

### Rebuild ignorando cache do Docker

Use quando suspeitar que o cache está usando algo antigo (raro):

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Reset completo (⚠️ APAGA TODOS OS DADOS)

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

A flag `-v` apaga todos os volumes (banco, uploads, backups, redis).
Só use quando quiser começar do zero.

### Atalho recomendado

Crie um arquivo `prod.ps1` na raiz do projeto:

```powershell
param([Parameter(ValueFromRemainingArguments=$true)]$args)
docker compose -f docker-compose.prod.yml --env-file .env.prod @args
```

E use:

```powershell
.\prod.ps1 up -d --build       # build + up
.\prod.ps1 logs -f backend     # logs
.\prod.ps1 ps                  # status
.\prod.ps1 down                # parar
.\prod.ps1 restart cloudflared # reiniciar 1 serviço
```

---

## Como os dados são preservados

Os dados ficam em **volumes Docker nomeados**, totalmente
independentes dos containers:

| Volume                          | Contém                                            |
|---------------------------------|---------------------------------------------------|
| `artplim-prod_postgres_data`    | Todos os dados do banco PostgreSQL                |
| `artplim-prod_redis_data`       | Snapshots do Redis (AOF + RDB)                    |
| `artplim-prod_backend_uploads`  | PDFs NFe, anexos, arquivos `.bdb` de backup       |
| `artplim-prod_db_backups`       | Dumps automáticos do banco (7d/4w/6m)             |

### Comandos que NÃO apagam dados ✅

- `up`, `up --build`, `up --force-recreate`, `up --no-deps`
- `build`, `build --no-cache`
- `restart`, `stop`, `start`
- `down` (sem `-v`)
- `restart` de qualquer serviço

Quando um container é destruído e recriado, o volume continua
existindo no Docker host e é remontado automaticamente no
container novo.

### Comandos que APAGAM dados ⚠️

- `docker compose ... down -v` (a flag `-v` apaga os volumes)
- `docker volume rm <nome-do-volume>` (manual e explícito)

Fora esses dois, **nada apaga dados**.

### Verificar volumes existentes

```powershell
docker volume ls | findstr artplim-prod
```

### Backup automático do banco

O serviço `db_backup` faz dump diário do postgres no volume `db_backups`,
com retenção:
- 7 backups diários
- 4 backups semanais
- 6 backups mensais

Para listar os backups:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod exec db_backup ls -la /backups
```

Para restaurar um backup, pare o backend, restaure via `pg_restore` no
postgres, suba o backend de novo. (Documentação detalhada pode ser
adicionada se necessário.)

---

## Cloudflare Tunnel

O acesso pelo domínio `erp.artplim.com.br` (e qualquer outro
externo) passa por um túnel Cloudflare. O `cloudflared` roda como
container e faz conexão **outbound** para a Cloudflare — não precisa
abrir porta no roteador.

### Dois modos do cloudflared

| Modo                | Como funciona                              | Onde está configurado         |
|---------------------|--------------------------------------------|-------------------------------|
| **Remote-managed**  | Uma variável `CLOUDFLARE_TUNNEL_TOKEN`     | Painel Cloudflare (Zero Trust)|
| **Locally-managed** | `config.yml` + `credentials.json` no disco | Arquivos no repo / servidor   |

O `docker-compose.prod.yml` atual está configurado para o **modo
remote-managed**. Documentação detalhada de criação e configuração:
`docs/cloudflare-tunnel-token.md`.

### Public Hostname (no painel do túnel)

Depois de criar o túnel, configure no painel:

| Subdomain | Domain          | Service Type | URL              |
|-----------|-----------------|--------------|------------------|
| `erp`     | `artplim.com.br`| HTTP         | `frontend:80`    |
| `api`     | `artplim.com.br`| HTTP         | `backend:3001`   |

> **Atenção**: o Service URL é `frontend:80` (nome do container na rede
> docker), **não** `localhost:80`. O cloudflared está dentro da rede
> docker `artplim_prod`, então resolve nomes de container.

> O segundo hostname (`api.artplim.com.br`) é **opcional** — o nginx
> do frontend já proxia `/api`, `/auth` e `/socket.io` para o backend.
> Só configure se usar `api.artplim.com.br` em integrações externas
> (webhooks de NFe, etc).

---

## Coexistência dev × prod

| Porta | Dev (`docker-compose.yml`) | Prod (`docker-compose.prod.yml`) |
|-------|----------------------------|----------------------------------|
| 80    | —                          | **frontend** (nginx)             |
| 3000  | **frontend** (Vite dev)    | —                                |
| 3001  | **backend** (tsx watch)    | (interno, não exposto)           |
| 5433  | **postgres** dev           | (interno, não exposto)           |
| 6380  | **redis** dev              | (interno, não exposto)           |

Os volumes e networks também são separados:

| Recurso            | Dev                    | Prod                                  |
|--------------------|------------------------|---------------------------------------|
| Project name       | `nartplim` (do dir)    | `artplim-prod` (definido no compose)  |
| Volume do postgres | `nartplim_postgres_data` | `artplim-prod_postgres_data`        |
| Network            | `nartplim_default`     | `artplim-prod_artplim_prod`           |

Ou seja: **rodar prod não afeta dev, e vice-versa**.

### Acesso

- **Dev**: http://localhost:3000 (frontend) + http://localhost:3001 (backend)
- **Prod local**: http://localhost
- **Prod via Cloudflare**: https://erp.artplim.com.br

### Se a porta 80 do host estiver ocupada

Algum outro serviço (IIS, Skype antigo) pode estar usando a 80. Para
verificar:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 80 -ErrorAction SilentlyContinue
```

Se ocupada, edite o `.env.prod`:

```
FRONTEND_HOST_PORT=8080
```

Aí o prod fica em http://localhost:8080. O Cloudflare Tunnel continua
funcionando porque fala com `frontend:80` na rede docker, não pelo host.

---

## Troubleshooting

### `Error: Cannot find module '.prisma/client/default'` no backend dev

O Prisma Client gerado sumiu do `node_modules` da máquina (algo
limpou). **Não é problema da prod.**

**Fix:**
```powershell
cd backend
pnpm exec prisma generate
cd ..
```

Depois reinicie o `pnpm dev`.

### `ECONNREFUSED` no Vite proxy do dev

O backend dev não está respondendo na porta 3001. Causas comuns:
- Docker Desktop parado
- Backend crashou (ver Prisma acima)
- Algum outro processo derrubou a porta

**Fix:** garantir que `pnpm dev:backend` (ou container `artplim_backend`)
está rodando e ouvindo em 3001.

### `cloudflared` em restart loop com "Provided Tunnel token is not valid"

O `CLOUDFLARE_TUNNEL_TOKEN` no `.env.prod` está vazio, errado ou
incompleto.

**Fix:** pegar o token novamente no painel Cloudflare (Zero Trust →
Networks → Tunnels → seu túnel → Configure → aba Docker → copiar a
string longa após `--token`).

Depois:
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d cloudflared
```

### Acesso a `https://erp.artplim.com.br` retorna 502 ou 504

O tunnel está conectado, mas não consegue alcançar o serviço destino.

**Causas comuns:**
- Container `frontend` não está rodando (`docker compose ... ps`)
- No painel do túnel, o Service URL está como `localhost:80` em vez
  de `frontend:80`

### Build do backend falha em `prisma generate` com "Cannot resolve environment variable: DATABASE_URL"

O `prisma.config.js` exige `DATABASE_URL` durante o `generate`. O
`backend/Dockerfile.prod` já passa uma URL placeholder no build —
se você modificou o Dockerfile, garanta que essa env var continua
sendo passada.

### Build do frontend falha com "Could not load `@/components/ui/Algo`"

Problema de **case-sensitivity** Windows → Linux. O Windows é
case-insensitive, então `'./button'` resolve `Button.tsx`. Linux
(container) é case-sensitive — se o arquivo é `Button.tsx`, o import
precisa ser `'./Button'`.

Lista de arquivos de UI e a capitalização correta:

```powershell
ls frontend/src/components/ui/
```

Corrija o import com a capitalização que bate com o nome real do arquivo.

### Backend prod inicia mas mostra "Redis unavailable. Falling back to Memory mode"

Não-bloqueante — o backend tem fallback funcional para cache em
memória. Pode ignorar por enquanto. Para investigar, ver logs do redis
e confirmar que `REDIS_URL` no compose está no formato
`redis://:<senha>@redis:6379`.

### Frontend prod abre mas requisições retornam 500

Ver logs do backend:
```powershell
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
```

O 500 é gerado pelo Fastify — o stack trace mostra a causa real
(erro de schema, erro de validação, conexão de banco, etc).

---

## Checklist de deploy

Use sempre que for subir prod numa máquina nova:

- [ ] Docker Desktop instalado e rodando
- [ ] Repo clonado em local sem espaços/caracteres especiais no caminho
- [ ] `.env.prod` criado a partir do `.env.prod.example`
- [ ] Todas as variáveis do `.env.prod` preenchidas com valores reais
- [ ] Túnel Cloudflare criado no painel (e token copiado para `.env.prod`)
- [ ] Public Hostname configurado no painel do túnel
  (`frontend:80` e/ou `backend:3001`)
- [ ] Porta 80 do host livre (ou `FRONTEND_HOST_PORT` configurado)
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.prod ps`
  → todos `Up`
- [ ] `curl http://localhost` → 200
- [ ] `https://erp.artplim.com.br` carrega no navegador (acesso externo)

---

## Arquivos relacionados

| Arquivo                              | Função                                          |
|--------------------------------------|-------------------------------------------------|
| `docker-compose.prod.yml`            | Definição da stack de produção                  |
| `backend/Dockerfile.prod`            | Build da imagem do backend (multi-stage)        |
| `backend/start.prod.sh`              | Entrypoint do container backend                 |
| `frontend/Dockerfile.prod`           | Build da imagem do frontend (multi-stage)       |
| `frontend/nginx.prod.conf`           | Config do nginx (SPA + proxy reverso)           |
| `.env.prod.example`                  | Template de variáveis de ambiente (versionado)  |
| `.env.prod`                          | Variáveis reais (gitignored)                    |
| `.dockerignore`                      | Lista de arquivos excluídos do build context    |
| `docs/cloudflare-tunnel-token.md`    | Guia detalhado do Cloudflare Tunnel             |
