# SIGM - Sistema Integrado de Gestao Municipal

Sistema de Gestao Publica Municipal (estilo Memory Informatica / Sankhya / Protheus Web) para uso por
**Prefeituras, Camaras Municipais, Fundos Municipais, Consorcios Publicos e Autarquias**, em conformidade
com a legislacao do setor publico brasileiro:

- Lei 4.320/1964 (normas gerais de direito financeiro)
- LC 101/2000 (Lei de Responsabilidade Fiscal - LRF)
- PCASP / MCASP (Plano e Manual de Contabilidade Aplicada ao Setor Publico)
- Lei 14.133/2021 (Nova Lei de Licitacoes e Contratos)
- Lei 12.527/2011 (Lei de Acesso a Informacao - Portal da Transparencia)
- EFD-Reinf, SICOM/TCE-MG e demais normas da STN

## Stack Tecnologica

| Camada      | Tecnologias |
|-------------|-------------|
| Frontend    | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + React Query + React Hook Form + Zod |
| Backend     | Node.js + Express + TypeScript + Prisma ORM |
| Banco       | PostgreSQL 16 |
| Autenticacao| JWT (access token 15min) + Refresh Token rotativo (7 dias) + RBAC granular |
| Auditoria   | Log completo de todas as operacoes (`audit_logs`), exclusao sempre logica (`deletedAt`) |
| Execucao    | Docker / docker-compose (Postgres + API + SPA) |

## Estrutura do Repositorio

```
.
├── backend/                # API REST (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma   # Modelo de dados completo (multi-tenant)
│   │   └── seed/seed.ts    # Massa inicial: perfis, permissoes, PCASP, INSS/IRRF, entidade demo
│   └── src/
│       ├── config/         # Configuracao (prisma client, env)
│       ├── middleware/      # auth (JWT/refresh), RBAC, auditoria, tratamento de erros
│       ├── modules/         # Um modulo por dominio de negocio (rotas + regras)
│       ├── routes/          # Agregador de rotas (/api/*)
│       └── utils/           # Paginacao, auditoria, AppError, etc.
├── frontend/                # SPA (Vite + React + TS)
│   └── src/
│       ├── components/      # Layout (menu/topbar), UI (shadcn) e componentes compartilhados
│       ├── config/menu.ts   # Estrutura do menu horizontal/atalhos (estilo Memory)
│       ├── pages/            # Telas, organizadas por modulo
│       ├── stores/           # Zustand (auth, sessao)
│       └── types/            # Tipos compartilhados por dominio
├── docs/                     # Documentacao complementar (arquitetura, modelo de dados)
├── docker-compose.yml
└── README.md
```

Veja tambem:

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) - visao geral da arquitetura, multi-tenancy, autenticacao/RBAC e auditoria
- [docs/MODELO_DADOS.md](docs/MODELO_DADOS.md) - diagramas entidade-relacionamento (ER) por dominio
- [docs/DEPLOY.md](docs/DEPLOY.md) - colocar o sistema online com Supabase + Render + Vercel (sem Docker)

## Modulos Implementados

| Modulo | Status | Descricao |
|--------|--------|-----------|
| Autenticacao / Usuarios / Perfis | Completo | Login, refresh token, RBAC por modulo/acao |
| Dashboard | Completo | Indicadores executivos, limites LRF, graficos receita x despesa |
| Cadastros | Completo | Credores, Orgaos/Unidades, Fontes de Recurso, Plano de Contas (PCASP), Naturezas de Servico |
| Orcamento | Completo | PPA, LDO, LOA, Dotacoes, Creditos Adicionais |
| Execucao Orcamentaria | Completo | Empenho (reforco/anulacao/estorno), Liquidacao, Pagamento |
| Retencoes (INSS/IRRF) | Completo | Calculo automatico/manual de retencoes para credores PF |
| Tesouraria | Completo | Contas bancarias, movimentos, conciliacao, relatorios (boletim diario, fluxo de caixa, disponibilidade) |
| Receitas | Completo | Lancamento de receitas orcamentarias e extraorcamentarias |
| Contabil (PCASP) | Completo | Lancamentos contabeis (partidas dobradas), encerramento de periodos, balancetes |
| Licitacoes | Scaffold navegavel | CRUD de licitacoes + itens/vencedores |
| Contratos / Convenios | Scaffold navegavel | CRUD de contratos + termos aditivos; CRUD de convenios |
| Almoxarifado | Scaffold navegavel | Materiais, movimentos de estoque (entrada/saida/transferencia/ajuste), estoque minimo |
| Patrimonio | Scaffold navegavel | Bens patrimoniais, movimentacoes (aquisicao/transferencia/baixa/depreciacao/reavaliacao) |
| Transparencia | Scaffold navegavel | Pre-visualizacao do Portal da Transparencia (receitas/despesas/licitacoes/contratos publicos) |
| Auditoria | Scaffold navegavel | Trilha de auditoria com filtros e detalhamento de alteracoes |
| IA | Scaffold navegavel | Sugestao de classificacao contabil (PCASP) e deteccao de inconsistencias |

> "Scaffold navegavel" = rotas, modelos de dados e CRUD/listagem basicos ja funcionais; regras de negocio
> avancadas adicionais podem ser evoluidas incrementalmente sobre essa base.

## Como Executar (Docker)

Pre-requisitos: Docker e Docker Compose instalados.

```bash
# 1. Copie os arquivos de variaveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Suba os servicos (Postgres + API + SPA)
docker compose up --build
```

Isso ira:

1. Subir o Postgres 16 (porta `5432`, banco `sigm_db`).
2. Rodar `prisma migrate deploy` e `prisma db seed` no backend automaticamente.
3. Iniciar a API em modo desenvolvimento na porta `3333`.
4. Iniciar o frontend (Vite dev server) na porta `5173`.

Acesse:

- Frontend: http://localhost:5173
- API: http://localhost:3333/api

### Usuario padrao (gerado pelo seed)

| Campo | Valor |
|-------|-------|
| Login | `admin` |
| E-mail | `admin@sigm.local` |
| Senha | `Admin@123` |
| Perfil | Administrador (acesso irrestrito) |
| Entidade demo | Prefeitura Municipal Modelo - CNPJ 12.345.678/0001-90 (MG) |

> O usuario e criado com `precisaTrocarSenha = true`, forcando a troca de senha no primeiro acesso.

## Como Executar Sem Docker (desenvolvimento)

### Backend

```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL para seu Postgres local
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev             # API em http://localhost:3333
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev              # SPA em http://localhost:5173
```

## Scripts Uteis (backend)

| Script | Descricao |
|--------|-----------|
| `npm run dev` | Inicia a API com hot-reload (tsx watch) |
| `npm run build` / `npm start` | Compila e executa a versao de producao |
| `npm run prisma:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run prisma:deploy` | Aplica migrations em producao |
| `npm run prisma:studio` | Abre o Prisma Studio (inspecao do banco) |
| `npm run seed` | Executa a massa de dados inicial (perfis, permissoes, PCASP, INSS/IRRF, entidade demo) |

## Multi-tenancy

O sistema utiliza **schema unico** do PostgreSQL com a coluna `entidadeId` em praticamente todas as tabelas
de negocio, isolando os dados de cada Prefeitura/Camara/Fundo/Autarquia/Consorcio (tenant) que utiliza o
sistema. Veja detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Seguranca

- Autenticacao via **JWT** (access token de 15 minutos) + **refresh token** rotativo (7 dias, revogavel).
- **RBAC** granular por `modulo` + `acao` (ex: `EMPENHOS:CRIAR`, `CONTRATOS:EXCLUIR`), avaliado por perfil.
- **Exclusao logica** (`deletedAt`) em todas as entidades de negocio - nenhum registro e removido fisicamente.
- **Auditoria completa**: toda criacao/alteracao/exclusao gera um registro em `audit_logs` com usuario, IP,
  user agent e o "antes/depois" (JSON) da operacao.
