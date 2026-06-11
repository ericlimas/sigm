# Arquitetura - SIGM (Sistema Integrado de Gestao Municipal)

## Visao Geral

```
┌─────────────────────┐        HTTPS / JSON         ┌──────────────────────────┐
│   Frontend (SPA)     │ ───────────────────────────▶│   Backend (API REST)     │
│  React + Vite + TS   │ ◀─────────────────────────── │  Express + TS + Prisma   │
│  Tailwind + shadcn/ui│      JWT (Bearer) + RT       │                          │
└─────────────────────┘                              └────────────┬─────────────┘
                                                                    │ Prisma Client
                                                                    ▼
                                                          ┌──────────────────────┐
                                                          │   PostgreSQL 16      │
                                                          │  schema unico        │
                                                          │  (multi-tenant via   │
                                                          │   coluna entidadeId) │
                                                          └──────────────────────┘
```

Os tres servicos (Postgres, backend, frontend) sobem via `docker-compose.yml` para desenvolvimento local.
Em producao, cada camada pode ser implantada separadamente (ex: SPA atras de um CDN, API em containers
escalaveis horizontalmente, Postgres gerenciado).

## Multi-tenancy (schema unico + `entidadeId`)

Cada **Entidade** (`entidades`) representa um tenant: uma Prefeitura, Camara Municipal, Fundo Municipal,
Consorcio Publico ou Autarquia. Em vez de um schema/banco por tenant, o sistema usa um **schema unico**
do PostgreSQL onde:

- Praticamente toda tabela de negocio possui a coluna `entidadeId` (FK para `entidades`).
- Todas as queries de listagem/detalhe filtram obrigatoriamente por `entidadeId` no backend
  (`req.authContext.entidadeId`), nunca confiando em valores vindos do cliente.
- Indices compostos (`@@index([entidadeId, ...])`) garantem performance no filtro por tenant.
- Um mesmo `Usuario` pode estar vinculado a multiplas entidades via `UsuarioEntidade`, cada vinculo
  com seu proprio `Perfil` (ex: um contador que atende varias prefeituras).

Vantagens dessa abordagem: simplicidade operacional (uma unica migration/deploy de banco), facilidade de
relatorios cross-tenant para o time de suporte, e custo de infraestrutura menor — ao preco de exigir
disciplina rigorosa no filtro por `entidadeId` em **todas** as queries.

## Autenticacao e Sessao

1. **Login** (`POST /api/auth/login`): valida `login`/`senha`, retorna `accessToken` (JWT, 15 min),
   `refreshToken` (persistido em `refresh_tokens`, 7 dias), dados do `usuario`, `entidade` ativa,
   `perfil` e a lista de `permissoes` (`modulo:acao`) resolvida a partir do perfil.
2. **Access Token**: enviado em `Authorization: Bearer <token>` em toda requisicao protegida. O middleware
   de autenticacao decodifica o JWT e popula `req.authContext` com `usuarioId`, `entidadeId`, `perfilId`
   e `permissoes`.
3. **Refresh Token**: rotativo - a cada uso, o token antigo e marcado como `revoked` e um novo e emitido.
   O frontend intercepta respostas `401` e tenta renovar a sessao automaticamente via
   `POST /api/auth/refresh` antes de redirecionar para o login.
4. **Troca de senha obrigatoria**: usuarios criados com `precisaTrocarSenha = true` sao redirecionados
   para a tela de troca de senha no primeiro acesso.

## RBAC (Controle de Acesso Baseado em Papeis)

- `Permissao` e um par granular `(modulo, acao)`, ex.: `("EMPENHOS", "CRIAR")`, `("CONTRATOS", "EXCLUIR")`,
  `("RETENCOES", "AJUSTAR")`.
- `Perfil` agrega um conjunto de `Permissao` via `PerfilPermissao` (ex.: perfis `ADMINISTRADOR`,
  `CONTABILIDADE`, `TESOURARIA`, `COMPRAS`, `LICITACAO`, `CONTROLE_INTERNO`, `RH`, `CONSULTA`).
- `UsuarioEntidade` vincula um usuario a uma entidade com um perfil especifico - o mesmo usuario pode ter
  perfis diferentes em entidades diferentes.
- **Backend**: o middleware `requirePermissao(modulo, acao)` bloqueia a rota com `403` caso a permissao
  nao esteja presente no `authContext` (o perfil `ADMINISTRADOR` tem bypass total).
- **Frontend**: o hook `useAuthStore().hasPermissao(modulo, acao)` controla a exibicao condicional de
  botoes/acoes (criar, editar, excluir) e o acesso as rotas/menus, espelhando a regra do backend.

## Auditoria e Exclusao Logica

- Toda operacao de criacao/alteracao/exclusao relevante chama `registrarAuditoria(...)`, gravando em
  `audit_logs`: `usuarioId`, `entidadeId`, `acao` (CREATE/UPDATE/DELETE/...), `modulo`,
  `entidadeAfetada` (tabela), `registroId`, `dadosAnteriores` e `dadosNovos` (JSON), `ip` e `userAgent`.
- **Nenhum registro de negocio e excluido fisicamente**: todas as entidades possuem `deletedAt DateTime?`
  e as operacoes de "exclusao" apenas preenchem esse campo, mantendo o historico integro para auditoria,
  TCE/SICOM e Portal da Transparencia.
- A tela de **Auditoria** (`/auditoria`) permite consultar a trilha completa com filtros por modulo, acao,
  usuario, periodo e busca textual, alem do detalhamento "antes vs depois" de cada alteracao.

## Estrutura do Backend (`backend/src`)

```
config/        # cliente Prisma, variaveis de ambiente
middleware/     # autenticacao (JWT/refresh), RBAC (requirePermissao), auditoria, tratamento de erros (AppError)
modules/        # um diretorio por dominio de negocio:
  auth/ cadastros/ orcamento/ empenhos/ liquidacoes/ pagamentos/ retencoes/
  tesouraria/ receitas/ contabil/ dashboard/
  licitacoes/ contratos/ convenios/ almoxarifado/ patrimonio/
  transparencia/ auditoria/ ia/
routes/         # agrega os routers de cada modulo sob /api/*
utils/          # paginacao (getPagination/buildPaginatedResponse), AppError, registrarAuditoria
```

Cada modulo expoe um `*.routes.ts` com:

- Validacao de entrada via **Zod** (schemas de criacao/edicao).
- Filtro por `entidadeId` (`req.authContext.entidadeId`) em todas as queries Prisma.
- `requirePermissao(modulo, acao)` em cada rota sensivel.
- Paginacao padronizada (`{ data, meta: { total, page, pageSize, totalPages } }`).
- Chamada a `registrarAuditoria` apos operacoes de escrita.

## Estrutura do Frontend (`frontend/src`)

```
components/
  layout/        # AppLayout: menu horizontal superior, barra de atalhos, multi-aba (estilo Memory)
  ui/             # componentes shadcn/ui (Button, Dialog, Select, Table, Tabs, Badge, ...)
  shared/         # PageHeader, DataTable, PaginationBar, SearchInput, ConfirmDialog, Field
  auth/           # ProtectedRoute (guarda de rotas autenticadas)
config/menu.ts    # estrutura do menu (grupos, itens, modulo de permissao, icones)
pages/            # uma pasta por dominio, espelhando os modulos do backend
stores/           # Zustand: authStore (sessao, permissoes, hasPermissao)
lib/api.ts        # instancia axios (baseURL, interceptors de refresh token, PaginatedResponse<T>)
types/            # tipos TS compartilhados por dominio (cadastros, execucao, financeiro, scaffold, ...)
```

### Padroes de UI (estilo Memory/Sankhya/Protheus Web)

- **Menu horizontal** com grupos de modulos e atalhos rapidos.
- **Grids de consulta** (`DataTable`) com paginacao server-side (`PaginationBar`), busca (`SearchInput`)
  e filtros avancados (Selects com sentinelas `__todos__`/`__none__` para "todos"/"nao definido").
- **Formularios rapidos em Dialog** (criar/editar) validados com `react-hook-form` + `zod`.
- **Sub-recursos em dialogs aninhados** (ex.: itens de uma licitacao, aditivos de um contrato,
  movimentos de estoque de um material, movimentacoes de um bem patrimonial) - cada um com sua
  propria query de detalhe e formulario inline.
- **Dashboard executivo** com indicadores (limites LRF, execucao orcamentaria) e graficos
  (receita x despesa mensal, despesa por funcao).

## Fluxo de Dados Tipico (exemplo: Empenho)

1. Usuario abre `/empenhos` → `EmpenhosPage` dispara `GET /api/empenhos?...` (React Query, paginado).
2. Usuario cria um empenho → `POST /api/empenhos` valida com Zod, verifica `requirePermissao("EMPENHOS","CRIAR")`,
   garante saldo disponivel na `Dotacao`, persiste o `Empenho`, atualiza `valorEmpenhado` da dotacao
   (transacao Prisma) e grava `audit_logs`.
3. Liquidacao (`POST /api/empenhos/:id/liquidacoes`) e Pagamento (`POST /api/liquidacoes/:id/pagamentos`)
   seguem o mesmo padrao, atualizando `valorLiquidado`/`valorPago` na dotacao e gerando lancamentos
   contabeis (PCASP) e movimentos bancarios quando aplicavel.
4. Para credores Pessoa Fisica, a liquidacao exige `RetencaoCalculo` (INSS/IRRF) antes do pagamento.

## Documentacao Relacionada

- [README.md](../README.md) - visao geral, stack e como executar (Docker)
- [MODELO_DADOS.md](MODELO_DADOS.md) - diagramas ER por dominio (Mermaid)
