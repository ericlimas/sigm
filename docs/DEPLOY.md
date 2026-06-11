# Deploy Online (Supabase + Render + Vercel)

Este guia coloca o SIGM no ar usando apenas planos gratuitos, sem precisar de Docker ou
PostgreSQL local:

- **Supabase** -> banco PostgreSQL gerenciado
- **Render** -> API (backend Express)
- **Vercel** -> SPA (frontend React/Vite)

## 1. Banco de dados (Supabase)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Escolha um nome (ex.: `sigm`), uma **senha do banco** (anote, vai precisar dela) e a
   regiao mais proxima (ex.: South America - Sao Paulo ou US East).
3. Aguarde o projeto ficar pronto (1-2 minutos).
4. Clique no botao **Connect** (topo da pagina) -> aba **ORM** -> selecione **Prisma**.
5. Sera exibido um bloco `.env.local` com duas variaveis - copie as duas e
   substitua `[YOUR-PASSWORD]` pela senha definida no passo 2 nas duas:
   - `DATABASE_URL` (pooler modo *transaction*, porta `6543`, com `?pgbouncer=true`)
     -> usado pela aplicacao em runtime.
   - `DIRECT_URL` (pooler modo *session*, porta `5432`)
     -> usado pelo Prisma para rodar `migrate deploy`.

> Guarde as duas strings completas - serao usadas na configuracao do Render.

## 2. Backend (Render)

1. Suba este repositorio para o GitHub (se ainda nao estiver la).
2. Em https://render.com, clique em **New -> Blueprint** e selecione o repositorio.
   O Render vai detectar o arquivo [`render.yaml`](../render.yaml) na raiz, que ja
   configura o servico `sigm-backend` (Node, plano free, build/start commands,
   `prisma migrate deploy` + seed automaticos).
3. Quando solicitado, preencha as variaveis marcadas como `sync: false`:
   - `DATABASE_URL`: a connection string do pooler *transaction* (porta 6543) do
     Supabase (passo 1.5).
   - `DIRECT_URL`: a connection string do pooler *session* (porta 5432) do
     Supabase (passo 1.5).
   - `CORS_ORIGIN`: por enquanto deixe `http://localhost:5173` - voce vai atualizar
     depois com a URL do Vercel (passo 3).
4. Clique em **Apply**. O Render vai instalar dependencias, gerar o Prisma Client,
   compilar o TypeScript, rodar as migrations no Supabase, popular o banco (seed) e
   subir a API.
5. Ao final, voce tera uma URL parecida com `https://sigm-backend.onrender.com`.
   Teste em `https://sigm-backend.onrender.com/health` - deve responder
   `{"status":"ok",...}`.

> O plano free do Render "dorme" apos alguns minutos sem uso; a primeira requisicao
> depois disso demora ~30-60s para acordar o servico.

## 3. Frontend (Vercel)

1. Em https://vercel.com, clique em **Add New -> Project** e importe o mesmo
   repositorio.
2. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (detectado automaticamente)
   - **Build Command**: `npm run build` (padrao)
   - **Output Directory**: `dist` (padrao)
3. Em **Environment Variables**, adicione:
   - `VITE_API_URL` = `https://sigm-backend.onrender.com/api` (URL do Render + `/api`)
4. Clique em **Deploy**. Ao final voce tera uma URL como
   `https://sigm.vercel.app`.

O arquivo [`frontend/vercel.json`](../frontend/vercel.json) ja garante que rotas do
React Router (ex.: `/empenhos`, `/orcamento/loa`) funcionem corretamente em
recarregamentos de pagina.

## 4. Atualizar o CORS do backend

1. Volte ao painel do Render -> servico `sigm-backend` -> **Environment**.
2. Edite `CORS_ORIGIN` para a URL do Vercel, ex.:
   `https://sigm.vercel.app`
   (pode colocar varias origens separadas por virgula, ex.:
   `https://sigm.vercel.app,http://localhost:5173`)
3. Salve - o Render reinicia o servico automaticamente.

## 5. Acessar o sistema

- Frontend: `https://sigm.vercel.app`
- Login padrao (criado pelo seed):
  - **Login**: `admin`
  - **Senha**: `Admin@123`
  - Sera solicitada a troca de senha no primeiro acesso.

## 6. Dominio proprio (registro.br)

Apos registrar o dominio (ex.: `sigm.com.br`) no https://registro.br:

- **Frontend**: na Vercel, va em **Settings -> Domains**, adicione `sigm.com.br` (ou
  `app.sigm.com.br`) e siga as instrucoes para criar os registros DNS (CNAME/A) no
  painel do registro.br.
- **Backend** (opcional): na Render, va em **Settings -> Custom Domains**, adicione
  algo como `api.sigm.com.br` e crie o CNAME correspondente no registro.br.
- Lembre-se de atualizar `VITE_API_URL` (Vercel) e `CORS_ORIGIN` (Render) caso troque
  os dominios.

## Atualizacoes futuras

Qualquer `git push` para a branch principal dispara automaticamente um novo deploy no
Render e na Vercel. Migrations novas do Prisma sao aplicadas automaticamente no
`startCommand` do backend (`prisma migrate deploy`).
