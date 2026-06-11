# Modelo de Dados - SIGM

Fonte da verdade: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

O banco e **multi-tenant via schema unico**: quase todas as tabelas abaixo possuem uma coluna
`entidadeId` (FK para `entidades`), omitida nos diagramas para legibilidade. Todas as entidades de
negocio possuem tambem `createdAt`, `updatedAt` e `deletedAt` (exclusao logica), igualmente omitidos.

Os diagramas estao agrupados por dominio funcional para facilitar a leitura. Renderizam automaticamente
em ferramentas com suporte a Mermaid (GitHub, GitLab, VS Code, etc.).

## 1. Core / Multi-tenant / Autenticacao / RBAC / Auditoria

```mermaid
erDiagram
    ENTIDADE ||--o{ USUARIO_ENTIDADE : possui
    ENTIDADE ||--o{ EXERCICIO_FINANCEIRO : possui
    USUARIO ||--o{ USUARIO_ENTIDADE : vincula
    USUARIO ||--o{ REFRESH_TOKEN : possui
    USUARIO ||--o{ AUDIT_LOG : gera
    PERFIL ||--o{ USUARIO_ENTIDADE : define
    PERFIL ||--o{ PERFIL_PERMISSAO : agrega
    PERMISSAO ||--o{ PERFIL_PERMISSAO : compoe
    ENTIDADE ||--o{ AUDIT_LOG : escopo

    ENTIDADE {
        string id PK
        enum tipo "PREFEITURA, CAMARA_MUNICIPAL, FUNDO_MUNICIPAL, AUTARQUIA, CONSORCIO_PUBLICO"
        string nome
        string cnpj UK
        string municipio
        string uf
        boolean ativo
    }
    EXERCICIO_FINANCEIRO {
        string id PK
        int ano
        boolean ativo
        boolean encerrado
    }
    USUARIO {
        string id PK
        string nome
        string email UK
        string login UK
        string senhaHash
        boolean precisaTrocarSenha
    }
    USUARIO_ENTIDADE {
        string id PK
        string usuarioId FK
        string entidadeId FK
        string perfilId FK
        boolean padrao
    }
    PERFIL {
        string id PK
        string chave UK "ADMINISTRADOR, CONTABILIDADE, TESOURARIA, COMPRAS, LICITACAO, CONTROLE_INTERNO, RH, CONSULTA"
        string nome
    }
    PERMISSAO {
        string id PK
        string modulo
        string acao
    }
    PERFIL_PERMISSAO {
        string perfilId FK
        string permissaoId FK
    }
    REFRESH_TOKEN {
        string id PK
        string usuarioId FK
        string token UK
        datetime expiresAt
        boolean revoked
    }
    AUDIT_LOG {
        string id PK
        string entidadeId FK
        string usuarioId FK
        string acao "CREATE, UPDATE, DELETE, LOGIN, ..."
        string modulo
        string entidadeAfetada
        string registroId
        json dadosAnteriores
        json dadosNovos
    }
```

## 2. Cadastros (Credores, Estrutura Organizacional, PCASP)

```mermaid
erDiagram
    ENTIDADE ||--o{ CREDOR : possui
    ENTIDADE ||--o{ ORGAO : possui
    ORGAO ||--o{ ORGAO : "orgao superior"
    ORGAO ||--o{ UNIDADE_ORCAMENTARIA : possui
    ENTIDADE ||--o{ FONTE_RECURSO : possui
    ENTIDADE ||--o{ CONTA_CONTABIL : possui
    CONTA_CONTABIL ||--o{ CONTA_CONTABIL : "conta pai"
    CONTA_CONTABIL ||--o{ NATUREZA_SERVICO : classifica
    ENTIDADE ||--o{ NATUREZA_SERVICO : possui
    ENTIDADE ||--o{ TABELA_INSS_FAIXA : parametriza
    ENTIDADE ||--o{ TABELA_IRRF_FAIXA : parametriza
    ENTIDADE ||--o{ TABELA_IRRF_DEDUCAO : parametriza

    CREDOR {
        string id PK
        enum tipoPessoa "FISICA, JURIDICA"
        string cpfCnpj
        string nome
        enum classificacao "SERVIDOR, AUTONOMO, FORNECEDOR, PRESTADOR_SERVICO, OUTROS"
        int numeroDependentes
    }
    ORGAO {
        string id PK
        string codigo
        string nome
        enum tipo "ORGAO, SECRETARIA, FUNDO, AUTARQUIA, FUNDACAO, PODER_LEGISLATIVO"
        string orgaoSuperiorId FK
    }
    UNIDADE_ORCAMENTARIA {
        string id PK
        string orgaoId FK
        string codigo
        string nome
    }
    FONTE_RECURSO {
        string id PK
        string codigo
        string descricao
        int exercicio
    }
    CONTA_CONTABIL {
        string id PK
        string codigo "ex: 1.1.1.1.01.01"
        string descricao
        enum natureza "ATIVO, PASSIVO, PATRIMONIO_LIQUIDO, VPA, VPD, ..."
        int classe "1-8 (PCASP)"
        int nivel
        string contaPaiId FK
        boolean aceitaLancamento
    }
    NATUREZA_SERVICO {
        string id PK
        string codigo
        string descricao
        string codigoReceita "DARF"
        decimal percentualInss
        boolean sujeitoInss
        boolean sujeitoIrrf
        string contaContabilId FK
    }
    TABELA_INSS_FAIXA {
        string id PK
        decimal faixaInicial
        decimal faixaFinal
        decimal aliquota
        decimal tetoPrevidenciario
    }
    TABELA_IRRF_FAIXA {
        string id PK
        decimal baseInicial
        decimal baseFinal
        decimal aliquota
        decimal parcelaDeduzir
    }
    TABELA_IRRF_DEDUCAO {
        string id PK
        decimal valorPorDependente
    }
```

## 3. Orcamento (PPA / LDO / LOA / Dotacoes / Creditos Adicionais)

```mermaid
erDiagram
    PPA ||--o{ PPA_PROGRAMA : possui
    PPA_PROGRAMA ||--o{ PPA_ACAO : possui
    PPA_PROGRAMA ||--o{ DOTACAO : classifica
    PPA_ACAO ||--o{ DOTACAO : classifica
    LDO ||--o{ LDO_META_FISCAL : possui
    LDO ||--o{ LDO_PRIORIDADE : possui
    LOA ||--o{ RECEITA_PREVISTA : possui
    LOA ||--o{ DOTACAO : possui
    ORGAO ||--o{ DOTACAO : executa
    UNIDADE_ORCAMENTARIA ||--o{ DOTACAO : executa
    FONTE_RECURSO ||--o{ DOTACAO : financia
    DOTACAO ||--o{ CREDITO_ADICIONAL : "destino/origem"

    PPA {
        string id PK
        int anoInicio
        int anoFim
        string lei
    }
    PPA_PROGRAMA {
        string id PK
        string ppaId FK
        string codigo
        string nome
    }
    PPA_ACAO {
        string id PK
        string programaId FK
        string codigo
        string tipo "PROJETO, ATIVIDADE, OPERACAO_ESPECIAL"
    }
    LDO {
        string id PK
        int exercicio
        string lei
    }
    LDO_META_FISCAL {
        string id PK
        string ldoId FK
        int ano
        string descricao
        decimal valorPrevisto
    }
    LDO_PRIORIDADE {
        string id PK
        string ldoId FK
        int ordem
        string descricao
    }
    LOA {
        string id PK
        int exercicio
        decimal valorTotalReceita
        decimal valorTotalDespesa
    }
    RECEITA_PREVISTA {
        string id PK
        string loaId FK
        string codigoReceita
        enum categoria "IPTU, ISS, ITBI, TAXAS, CONVENIO, TRANSFERENCIA, OUTRAS"
        decimal valorPrevisto
        decimal valorAtualizado
    }
    DOTACAO {
        string id PK
        string loaId FK
        int exercicio
        int ficha
        string orgaoId FK
        string unidadeOrcamentariaId FK
        string funcao
        string subfuncao
        string programaId FK
        string acaoId FK
        string categoriaEconomica
        string grupoDespesa
        string elementoDespesa
        string fonteRecursoId FK
        decimal valorInicial
        decimal valorAdicionado
        decimal valorReduzido
        decimal valorEmpenhado
        decimal valorLiquidado
        decimal valorPago
    }
    CREDITO_ADICIONAL {
        string id PK
        enum tipo "SUPLEMENTAR, ESPECIAL, EXTRAORDINARIO"
        string dotacaoDestinoId FK
        string dotacaoOrigemId FK
        decimal valor
    }
```

## 4. Execucao Orcamentaria (Empenho / Liquidacao / Pagamento / Retencoes)

```mermaid
erDiagram
    DOTACAO ||--o{ EMPENHO : consome
    CREDOR ||--o{ EMPENHO : recebe
    EMPENHO ||--o{ EMPENHO_MOVIMENTO : historico
    EMPENHO ||--o{ LIQUIDACAO : gera
    CONTRATO ||--o{ LIQUIDACAO : referencia
    LIQUIDACAO ||--o{ PAGAMENTO : gera
    LIQUIDACAO ||--o| RETENCAO_CALCULO : possui
    RETENCAO_CALCULO ||--o{ RETENCAO_HISTORICO : registra
    CREDOR ||--o{ RETENCAO_CALCULO : sofre
    NATUREZA_SERVICO ||--o{ RETENCAO_CALCULO : classifica
    CONTA_BANCARIA ||--o{ PAGAMENTO : credita

    EMPENHO {
        string id PK
        int exercicio
        int numero
        enum tipo "ORDINARIO, GLOBAL, ESTIMATIVO"
        string credorId FK
        string dotacaoId FK
        string historico
        decimal valor
        decimal valorAnulado
        decimal valorLiquidado
        decimal valorPago
        enum status "NORMAL, ANULADO, ESTORNADO"
        boolean restoAPagar
    }
    EMPENHO_MOVIMENTO {
        string id PK
        string empenhoId FK
        enum tipo "REFORCO, ANULACAO, ESTORNO"
        decimal valor
        string justificativa
    }
    LIQUIDACAO {
        string id PK
        string empenhoId FK
        int numero
        string documento
        string contratoId FK
        decimal valor
        enum status "PENDENTE, LIQUIDADA, ANULADA"
    }
    PAGAMENTO {
        string id PK
        string liquidacaoId FK
        int numero
        decimal valor
        enum formaPagamento "PIX, TED, DOC, CHEQUE, DINHEIRO, CNAB"
        string contaBancariaId FK
        enum status "PENDENTE, PAGO, CANCELADO"
    }
    RETENCAO_CALCULO {
        string id PK
        string liquidacaoId FK
        string credorId FK
        string naturezaServicoId FK
        decimal valorBruto
        decimal baseInss
        decimal inssRetido
        decimal baseIrrf
        decimal irrfRetido
        decimal valorLiquido
        boolean calculoManual
    }
    RETENCAO_HISTORICO {
        string id PK
        string retencaoId FK
        string campoAlterado
        string valorAnterior
        string valorNovo
    }
```

## 5. Tesouraria e Receitas

```mermaid
erDiagram
    FONTE_RECURSO ||--o{ CONTA_BANCARIA : vincula
    CONTA_BANCARIA ||--o{ MOVIMENTO_BANCARIO : registra
    CONTA_BANCARIA ||--o{ RECEITA_LANCAMENTO : recebe
    CONTA_BANCARIA ||--o{ IMPORTACAO_ARQUIVO : recebe
    PAGAMENTO ||--o| MOVIMENTO_BANCARIO : origina
    RECEITA_LANCAMENTO ||--o| MOVIMENTO_BANCARIO : origina
    IMPORTACAO_ARQUIVO ||--o{ MOVIMENTO_BANCARIO : importa
    MOVIMENTO_BANCARIO ||--o| CONCILIACAO_BANCARIA : possui
    FONTE_RECURSO ||--o{ RECEITA_LANCAMENTO : classifica

    CONTA_BANCARIA {
        string id PK
        enum tipo "CAIXA, BANCO, APLICACAO"
        string descricao
        string banco
        string agencia
        string conta
        string fonteRecursoId FK
        decimal saldoInicial
    }
    MOVIMENTO_BANCARIO {
        string id PK
        string contaBancariaId FK
        enum tipo "CREDITO, DEBITO"
        decimal valor
        enum origem "PAGAMENTO, RECEITA, TRANSFERENCIA, AJUSTE, MANUAL, ARQUIVO"
        string pagamentoId FK
        string receitaId FK
        string importacaoId FK
        boolean conciliado
    }
    CONCILIACAO_BANCARIA {
        string id PK
        string movimentoBancarioId FK
        datetime dataConciliacao
        string observacao
    }
    IMPORTACAO_ARQUIVO {
        string id PK
        string contaBancariaId FK
        enum tipo "OFX, CNAB240, CNAB400"
        string nomeArquivo
        int totalRegistros
        int totalConciliados
    }
    RECEITA_LANCAMENTO {
        string id PK
        int exercicio
        enum tipo "ORCAMENTARIA, EXTRAORCAMENTARIA"
        enum categoria "IPTU, ISS, ITBI, TAXAS, CONVENIO, TRANSFERENCIA, OUTRAS"
        string codigoReceita
        string fonteRecursoId FK
        string contaBancariaId FK
        decimal valor
    }
```

## 6. Contabil (PCASP - Partidas Dobradas)

```mermaid
erDiagram
    LANCAMENTO_CONTABIL ||--o{ LANCAMENTO_CONTABIL_PARTIDA : possui
    CONTA_CONTABIL ||--o{ LANCAMENTO_CONTABIL_PARTIDA : classifica

    LANCAMENTO_CONTABIL {
        string id PK
        int exercicio
        int numero
        datetime data
        string historico
        enum tipo "AUTOMATICO, MANUAL"
        string origemModulo "EMPENHO, LIQUIDACAO, PAGAMENTO, RECEITA, MANUAL, ENCERRAMENTO"
        string origemId
    }
    LANCAMENTO_CONTABIL_PARTIDA {
        string id PK
        string lancamentoId FK
        string contaContabilId FK
        enum tipo "DEBITO, CREDITO"
        decimal valor
    }
    PERIODO_CONTABIL {
        string id PK
        int exercicio
        int mes "1-12"
        enum status "ABERTO, ENCERRADO"
        datetime dataEncerramento
    }
```

## 7. Licitacoes, Contratos e Convenios

```mermaid
erDiagram
    LICITACAO ||--o{ LICITACAO_ITEM : possui
    LICITACAO ||--o{ CONTRATO : origina
    CREDOR ||--o{ LICITACAO_ITEM : vence
    CREDOR ||--o{ CONTRATO : fornece
    CONTRATO ||--o{ CONTRATO_ADITIVO : possui
    CONTRATO ||--o{ LIQUIDACAO : referencia

    LICITACAO {
        string id PK
        int exercicio
        string numero
        enum modalidade "DISPENSA, INEXIGIBILIDADE, PREGAO, CONCORRENCIA, CREDENCIAMENTO, CONCURSO, LEILAO"
        string objeto
        string processo
        datetime dataAbertura
        decimal valorEstimado
        decimal valorHomologado
        enum status "EM_ANDAMENTO, HOMOLOGADA, FRACASSADA, DESERTA, REVOGADA, ANULADA"
    }
    LICITACAO_ITEM {
        string id PK
        string licitacaoId FK
        int item
        string descricao
        string unidade
        decimal quantidade
        decimal valorEstimado
        string vencedorCredorId FK
        decimal valorVencedor
    }
    CONTRATO {
        string id PK
        string numero
        int exercicio
        string licitacaoId FK
        string credorId FK
        string objeto
        datetime dataInicio
        datetime dataFim
        decimal valor
        decimal valorAditivado
        enum status "VIGENTE, ENCERRADO, RESCINDIDO, SUSPENSO"
    }
    CONTRATO_ADITIVO {
        string id PK
        string contratoId FK
        int numero
        enum tipo "PRAZO, VALOR, PRAZO_VALOR, QUALITATIVO"
        datetime data
        decimal valor
        datetime novaDataFim
    }
    CONVENIO {
        string id PK
        string numero
        int exercicio
        string concedente
        string convenente
        string objeto
        decimal valorTotal
        decimal valorContrapartida
        datetime vigenciaInicio
        datetime vigenciaFim
        enum status "EM_EXECUCAO, CONCLUIDO, CANCELADO, EM_PRESTACAO_CONTAS"
    }
```

## 8. Almoxarifado e Patrimonio

```mermaid
erDiagram
    MATERIAL ||--o{ MOVIMENTO_ESTOQUE : registra
    BEM ||--o{ BEM_MOVIMENTACAO : registra
    CREDOR ||--o{ BEM : "responsavel por"

    MATERIAL {
        string id PK
        string codigo UK
        string descricao
        string unidade
        string categoria
        decimal estoqueAtual
        decimal estoqueMinimo
        decimal valorMedio
        boolean ativo
    }
    MOVIMENTO_ESTOQUE {
        string id PK
        string materialId FK
        enum tipo "ENTRADA, SAIDA, TRANSFERENCIA, AJUSTE"
        datetime data
        decimal quantidade
        decimal valorUnitario
        string documento
        string origemModulo
    }
    BEM {
        string id PK
        string numeroTombamento UK
        string descricao
        enum categoria "MOVEL, IMOVEL, VEICULO, EQUIPAMENTO_TI, OUTROS"
        datetime dataAquisicao
        decimal valorAquisicao
        decimal valorAtual
        int vidaUtilAnos
        decimal taxaDepreciacaoAnual
        string localizacao
        string responsavelCredorId FK
        enum status "ATIVO, TRANSFERIDO, BAIXADO, EM_MANUTENCAO"
    }
    BEM_MOVIMENTACAO {
        string id PK
        string bemId FK
        enum tipo "AQUISICAO, TRANSFERENCIA, BAIXA, DEPRECIACAO, REAVALIACAO"
        datetime data
        decimal valor
        string localOrigem
        string localDestino
    }
```

## 9. Inteligencia Artificial (Sugestoes)

```mermaid
erDiagram
    IA_SUGESTAO {
        string id PK
        string modulo
        string registroId
        enum tipo "CLASSIFICACAO_CONTABIL, FONTE_RECURSO, NATUREZA_DESPESA, INCONSISTENCIA, RETENCAO_TRIBUTARIA, PARECER_CONTROLE_INTERNO"
        string titulo
        string conteudo
        json dadosContexto
        enum status "PENDENTE, ACEITA, REJEITADA"
        string usuarioId
    }
```

`IA_SUGESTAO` referencia livremente registros de outros modulos via `modulo` + `registroId`
(sem FK fisica), permitindo sugestoes sobre qualquer entidade do sistema (ex.: uma `Liquidacao`,
uma `Dotacao`, um `Pagamento`).

## Convencoes Gerais

- **Chaves primarias**: `String @id @default(uuid())` em todas as tabelas.
- **Soft delete**: `deletedAt DateTime?` - registros "excluidos" permanecem no banco com `deletedAt` preenchido.
- **Auditoria**: campos `createdAt`/`updatedAt` automaticos via Prisma (`@default(now())` / `@updatedAt`).
- **Valores monetarios**: `Decimal` com precisao `(18, 2)` (ou `(5, 2)` para aliquotas/percentuais).
- **Unicidade por tenant**: chaves de negocio (ex.: `numero` de empenho, `codigo` de material) sao unicas
  por `entidadeId` (e, quando aplicavel, por `exercicio`), via `@@unique([entidadeId, ...])`.
