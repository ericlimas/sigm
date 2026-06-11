-- CreateEnum
CREATE TYPE "TipoEntidade" AS ENUM ('PREFEITURA', 'CAMARA_MUNICIPAL', 'FUNDO_MUNICIPAL', 'AUTARQUIA', 'CONSORCIO_PUBLICO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "ClassificacaoCredor" AS ENUM ('SERVIDOR', 'AUTONOMO', 'FORNECEDOR', 'PRESTADOR_SERVICO', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('CORRENTE', 'POUPANCA', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "NaturezaContaContabil" AS ENUM ('ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'VPA', 'VPD', 'CONTROLE_DEVEDOR', 'CONTROLE_CREDOR', 'ORCAMENTARIA_RECEITA', 'ORCAMENTARIA_DESPESA');

-- CreateEnum
CREATE TYPE "TipoOrgao" AS ENUM ('ORGAO', 'SECRETARIA', 'FUNDO', 'AUTARQUIA', 'FUNDACAO', 'PODER_LEGISLATIVO');

-- CreateEnum
CREATE TYPE "TipoCreditoAdicional" AS ENUM ('SUPLEMENTAR', 'ESPECIAL', 'EXTRAORDINARIO');

-- CreateEnum
CREATE TYPE "TipoEmpenho" AS ENUM ('ORDINARIO', 'GLOBAL', 'ESTIMATIVO');

-- CreateEnum
CREATE TYPE "StatusEmpenho" AS ENUM ('NORMAL', 'ANULADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "TipoMovimentoEmpenho" AS ENUM ('REFORCO', 'ANULACAO', 'ESTORNO');

-- CreateEnum
CREATE TYPE "StatusLiquidacao" AS ENUM ('PENDENTE', 'LIQUIDADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'TED', 'DOC', 'CHEQUE', 'DINHEIRO', 'CNAB');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoContaBancaria" AS ENUM ('CAIXA', 'BANCO', 'APLICACAO');

-- CreateEnum
CREATE TYPE "TipoMovimentoBancario" AS ENUM ('CREDITO', 'DEBITO');

-- CreateEnum
CREATE TYPE "OrigemMovimentoBancario" AS ENUM ('PAGAMENTO', 'RECEITA', 'TRANSFERENCIA', 'AJUSTE', 'MANUAL', 'ARQUIVO');

-- CreateEnum
CREATE TYPE "TipoArquivoImportacao" AS ENUM ('OFX', 'CNAB240', 'CNAB400');

-- CreateEnum
CREATE TYPE "TipoReceita" AS ENUM ('ORCAMENTARIA', 'EXTRAORCAMENTARIA');

-- CreateEnum
CREATE TYPE "CategoriaReceita" AS ENUM ('IPTU', 'ISS', 'ITBI', 'TAXAS', 'CONVENIO', 'TRANSFERENCIA', 'OUTRAS');

-- CreateEnum
CREATE TYPE "TipoLancamentoContabil" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoPartidaContabil" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "StatusPeriodoContabil" AS ENUM ('ABERTO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ModalidadeLicitacao" AS ENUM ('DISPENSA', 'INEXIGIBILIDADE', 'PREGAO', 'CONCORRENCIA', 'CREDENCIAMENTO', 'CONCURSO', 'LEILAO');

-- CreateEnum
CREATE TYPE "StatusLicitacao" AS ENUM ('EM_ANDAMENTO', 'HOMOLOGADA', 'FRACASSADA', 'DESERTA', 'REVOGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('VIGENTE', 'ENCERRADO', 'RESCINDIDO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "TipoAditivo" AS ENUM ('PRAZO', 'VALOR', 'PRAZO_VALOR', 'QUALITATIVO');

-- CreateEnum
CREATE TYPE "StatusConvenio" AS ENUM ('EM_EXECUCAO', 'CONCLUIDO', 'CANCELADO', 'EM_PRESTACAO_CONTAS');

-- CreateEnum
CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "CategoriaBem" AS ENUM ('MOVEL', 'IMOVEL', 'VEICULO', 'EQUIPAMENTO_TI', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusBem" AS ENUM ('ATIVO', 'TRANSFERIDO', 'BAIXADO', 'EM_MANUTENCAO');

-- CreateEnum
CREATE TYPE "TipoMovimentoBem" AS ENUM ('AQUISICAO', 'TRANSFERENCIA', 'BAIXA', 'DEPRECIACAO', 'REAVALIACAO');

-- CreateEnum
CREATE TYPE "TipoSugestaoIA" AS ENUM ('CLASSIFICACAO_CONTABIL', 'FONTE_RECURSO', 'NATUREZA_DESPESA', 'INCONSISTENCIA', 'RETENCAO_TRIBUTARIA', 'PARECER_CONTROLE_INTERNO');

-- CreateEnum
CREATE TYPE "StatusSugestaoIA" AS ENUM ('PENDENTE', 'ACEITA', 'REJEITADA');

-- CreateTable
CREATE TABLE "entidades" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEntidade" NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "codigoIbge" TEXT,
    "municipio" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "brasao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicios_financeiros" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "encerrado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercicios_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistemico" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permissoes" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "permissaoId" TEXT NOT NULL,

    CONSTRAINT "perfil_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_entidades" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "entidadeAfetada" TEXT,
    "registroId" TEXT,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credores" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "classificacao" "ClassificacaoCredor" NOT NULL,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "municipio" TEXT,
    "uf" CHAR(2),
    "telefone" TEXT,
    "email" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "tipoConta" "TipoConta",
    "chavePix" TEXT,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "regimeTributario" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "numeroDependentes" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "credores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orgaos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoOrgao" NOT NULL,
    "orgaoSuperiorId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "orgaos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_orcamentarias" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "orgaoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "unidades_orcamentarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fontes_recurso" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "especificacao" TEXT,
    "exercicio" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fontes_recurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_contas" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "natureza" "NaturezaContaContabil" NOT NULL,
    "classe" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,
    "contaPaiId" TEXT,
    "aceitaLancamento" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naturezas_servico" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoReceita" TEXT,
    "contaContabilId" TEXT,
    "percentualInss" DECIMAL(5,2) NOT NULL DEFAULT 11.00,
    "sujeitoInss" BOOLEAN NOT NULL DEFAULT true,
    "sujeitoIrrf" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naturezas_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabela_inss_faixas" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "faixaInicial" DECIMAL(15,2) NOT NULL,
    "faixaFinal" DECIMAL(15,2),
    "aliquota" DECIMAL(5,2) NOT NULL,
    "parcelaDeduzir" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tetoPrevidenciario" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabela_inss_faixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabela_irrf_faixas" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "baseInicial" DECIMAL(15,2) NOT NULL,
    "baseFinal" DECIMAL(15,2),
    "aliquota" DECIMAL(5,2) NOT NULL,
    "parcelaDeduzir" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabela_irrf_faixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabela_irrf_deducoes" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "valorPorDependente" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tabela_irrf_deducoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppas" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "anoInicio" INTEGER NOT NULL,
    "anoFim" INTEGER NOT NULL,
    "lei" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ppas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppa_programas" (
    "id" TEXT NOT NULL,
    "ppaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "objetivo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ppa_programas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppa_acoes" (
    "id" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "metaFisica" TEXT,
    "unidadeMedida" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ppa_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "lei" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldo_metas_fiscais" (
    "id" TEXT NOT NULL,
    "ldoId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorPrevisto" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldo_metas_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldo_prioridades" (
    "id" TEXT NOT NULL,
    "ldoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ldo_prioridades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loas" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "lei" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "valorTotalReceita" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorTotalDespesa" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas_previstas" (
    "id" TEXT NOT NULL,
    "loaId" TEXT NOT NULL,
    "codigoReceita" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "CategoriaReceita" NOT NULL DEFAULT 'OUTRAS',
    "valorPrevisto" DECIMAL(18,2) NOT NULL,
    "valorAtualizado" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "receitas_previstas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dotacoes" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "loaId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "ficha" INTEGER NOT NULL,
    "orgaoId" TEXT NOT NULL,
    "unidadeOrcamentariaId" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "subfuncao" TEXT NOT NULL,
    "programaId" TEXT,
    "acaoId" TEXT,
    "categoriaEconomica" TEXT NOT NULL,
    "grupoDespesa" TEXT NOT NULL,
    "modalidadeAplicacao" TEXT NOT NULL,
    "elementoDespesa" TEXT NOT NULL,
    "fonteRecursoId" TEXT NOT NULL,
    "valorInicial" DECIMAL(18,2) NOT NULL,
    "valorAdicionado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorReduzido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorEmpenhado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorLiquidado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorPago" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "dotacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_adicionais" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "tipo" "TipoCreditoAdicional" NOT NULL,
    "numero" TEXT NOT NULL,
    "decreto" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "dotacaoDestinoId" TEXT NOT NULL,
    "dotacaoOrigemId" TEXT,
    "fonteRecursoDescricao" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,
    "justificativa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "creditos_adicionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empenhos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoEmpenho" NOT NULL DEFAULT 'ORDINARIO',
    "data" TIMESTAMP(3) NOT NULL,
    "credorId" TEXT NOT NULL,
    "dotacaoId" TEXT NOT NULL,
    "processo" TEXT,
    "historico" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "valorAnulado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorLiquidado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorPago" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "StatusEmpenho" NOT NULL DEFAULT 'NORMAL',
    "restoAPagar" BOOLEAN NOT NULL DEFAULT false,
    "exercicioRestoAPagar" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "empenhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empenho_movimentos" (
    "id" TEXT NOT NULL,
    "empenhoId" TEXT NOT NULL,
    "tipo" "TipoMovimentoEmpenho" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justificativa" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empenho_movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacoes" (
    "id" TEXT NOT NULL,
    "empenhoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "documento" TEXT,
    "tipoDocumento" TEXT,
    "contratoId" TEXT,
    "historico" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "status" "StatusLiquidacao" NOT NULL DEFAULT 'LIQUIDADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "liquidacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "liquidacaoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "numeroOrdemPagamento" TEXT,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PAGO',
    "comprovanteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retencao_calculos" (
    "id" TEXT NOT NULL,
    "liquidacaoId" TEXT NOT NULL,
    "credorId" TEXT NOT NULL,
    "naturezaServicoId" TEXT,
    "valorBruto" DECIMAL(18,2) NOT NULL,
    "baseInss" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inssRetido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aliquotaInss" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "numeroDependentes" INTEGER NOT NULL DEFAULT 0,
    "deducaoDependentes" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseIrrf" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "irrfRetido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "aliquotaIrrf" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(18,2) NOT NULL,
    "calculoManual" BOOLEAN NOT NULL DEFAULT false,
    "justificativaAjuste" TEXT,
    "ajustadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retencao_calculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retencao_historico" (
    "id" TEXT NOT NULL,
    "retencaoId" TEXT NOT NULL,
    "campoAlterado" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "justificativa" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retencao_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipo" "TipoContaBancaria" NOT NULL,
    "descricao" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "fonteRecursoId" TEXT,
    "saldoInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_bancarios" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoMovimentoBancario" NOT NULL,
    "historico" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "origem" "OrigemMovimentoBancario" NOT NULL DEFAULT 'MANUAL',
    "pagamentoId" TEXT,
    "receitaId" TEXT,
    "importacaoId" TEXT,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "movimentos_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliacoes_bancarias" (
    "id" TEXT NOT NULL,
    "movimentoBancarioId" TEXT NOT NULL,
    "dataConciliacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "conciliacoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes_arquivos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "tipo" "TipoArquivoImportacao" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "totalConciliados" INTEGER NOT NULL DEFAULT 0,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receita_lancamentos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoReceita" NOT NULL DEFAULT 'ORCAMENTARIA',
    "categoria" "CategoriaReceita" NOT NULL DEFAULT 'OUTRAS',
    "codigoReceita" TEXT,
    "descricao" TEXT NOT NULL,
    "documento" TEXT,
    "fonteRecursoId" TEXT,
    "contaBancariaId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "receita_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_contabeis" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "historico" TEXT NOT NULL,
    "tipo" "TipoLancamentoContabil" NOT NULL DEFAULT 'MANUAL',
    "origemModulo" TEXT,
    "origemId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lancamentos_contabeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_contabil_partidas" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "contaContabilId" TEXT NOT NULL,
    "tipo" "TipoPartidaContabil" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "historico" TEXT,

    CONSTRAINT "lancamento_contabil_partidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_contabeis" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" "StatusPeriodoContabil" NOT NULL DEFAULT 'ABERTO',
    "dataEncerramento" TIMESTAMP(3),
    "usuarioEncerramentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_contabeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitacoes" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "modalidade" "ModalidadeLicitacao" NOT NULL,
    "objeto" TEXT NOT NULL,
    "processo" TEXT,
    "dataAbertura" TIMESTAMP(3) NOT NULL,
    "valorEstimado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorHomologado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "StatusLicitacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "licitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitacao_itens" (
    "id" TEXT NOT NULL,
    "licitacaoId" TEXT NOT NULL,
    "item" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "valorEstimado" DECIMAL(18,2) NOT NULL,
    "vencedorCredorId" TEXT,
    "valorVencedor" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacao_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "licitacaoId" TEXT,
    "credorId" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "valorAditivado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "StatusContrato" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_aditivos" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoAditivo" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2),
    "novaDataFim" TIMESTAMP(3),
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_aditivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenios" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "concedente" TEXT,
    "convenente" TEXT,
    "objeto" TEXT NOT NULL,
    "valorTotal" DECIMAL(18,2) NOT NULL,
    "valorContrapartida" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3) NOT NULL,
    "status" "StatusConvenio" NOT NULL DEFAULT 'EM_EXECUCAO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "categoria" TEXT,
    "estoqueAtual" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estoqueMinimo" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valorMedio" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_estoque" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "valorUnitario" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "documento" TEXT,
    "origemModulo" TEXT,
    "origemId" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bens" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "numeroTombamento" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "CategoriaBem" NOT NULL,
    "dataAquisicao" TIMESTAMP(3) NOT NULL,
    "valorAquisicao" DECIMAL(18,2) NOT NULL,
    "valorAtual" DECIMAL(18,2) NOT NULL,
    "vidaUtilAnos" INTEGER,
    "taxaDepreciacaoAnual" DECIMAL(5,2),
    "localizacao" TEXT,
    "responsavelCredorId" TEXT,
    "status" "StatusBem" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bem_movimentacoes" (
    "id" TEXT NOT NULL,
    "bemId" TEXT NOT NULL,
    "tipo" "TipoMovimentoBem" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2),
    "localOrigem" TEXT,
    "localDestino" TEXT,
    "descricao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bem_movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_sugestoes" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "registroId" TEXT,
    "tipo" "TipoSugestaoIA" NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "dadosContexto" JSONB,
    "status" "StatusSugestaoIA" NOT NULL DEFAULT 'PENDENTE',
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_sugestoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entidades_cnpj_key" ON "entidades"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "exercicios_financeiros_entidadeId_ano_key" ON "exercicios_financeiros"("entidadeId", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_chave_key" ON "perfis"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_modulo_acao_key" ON "permissoes"("modulo", "acao");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_permissoes_perfilId_permissaoId_key" ON "perfil_permissoes"("perfilId", "permissaoId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_login_key" ON "usuarios"("login");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_entidades_usuarioId_entidadeId_key" ON "usuario_entidades"("usuarioId", "entidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "audit_logs_entidadeId_modulo_idx" ON "audit_logs"("entidadeId", "modulo");

-- CreateIndex
CREATE INDEX "audit_logs_registroId_idx" ON "audit_logs"("registroId");

-- CreateIndex
CREATE INDEX "credores_entidadeId_nome_idx" ON "credores"("entidadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "credores_entidadeId_cpfCnpj_key" ON "credores"("entidadeId", "cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "orgaos_entidadeId_codigo_key" ON "orgaos"("entidadeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_orcamentarias_entidadeId_orgaoId_codigo_key" ON "unidades_orcamentarias"("entidadeId", "orgaoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "fontes_recurso_entidadeId_codigo_key" ON "fontes_recurso"("entidadeId", "codigo");

-- CreateIndex
CREATE INDEX "plano_contas_entidadeId_classe_idx" ON "plano_contas"("entidadeId", "classe");

-- CreateIndex
CREATE UNIQUE INDEX "plano_contas_entidadeId_codigo_key" ON "plano_contas"("entidadeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "naturezas_servico_entidadeId_codigo_key" ON "naturezas_servico"("entidadeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ppas_entidadeId_anoInicio_anoFim_key" ON "ppas"("entidadeId", "anoInicio", "anoFim");

-- CreateIndex
CREATE UNIQUE INDEX "ppa_programas_ppaId_codigo_key" ON "ppa_programas"("ppaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ppa_acoes_programaId_codigo_key" ON "ppa_acoes"("programaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ldos_entidadeId_exercicio_key" ON "ldos"("entidadeId", "exercicio");

-- CreateIndex
CREATE UNIQUE INDEX "loas_entidadeId_exercicio_key" ON "loas"("entidadeId", "exercicio");

-- CreateIndex
CREATE UNIQUE INDEX "receitas_previstas_loaId_codigoReceita_key" ON "receitas_previstas"("loaId", "codigoReceita");

-- CreateIndex
CREATE INDEX "dotacoes_entidadeId_exercicio_idx" ON "dotacoes"("entidadeId", "exercicio");

-- CreateIndex
CREATE UNIQUE INDEX "dotacoes_entidadeId_exercicio_ficha_key" ON "dotacoes"("entidadeId", "exercicio", "ficha");

-- CreateIndex
CREATE INDEX "creditos_adicionais_entidadeId_exercicio_idx" ON "creditos_adicionais"("entidadeId", "exercicio");

-- CreateIndex
CREATE INDEX "empenhos_entidadeId_exercicio_credorId_idx" ON "empenhos"("entidadeId", "exercicio", "credorId");

-- CreateIndex
CREATE UNIQUE INDEX "empenhos_entidadeId_exercicio_numero_key" ON "empenhos"("entidadeId", "exercicio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacoes_empenhoId_numero_key" ON "liquidacoes"("empenhoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "retencao_calculos_liquidacaoId_key" ON "retencao_calculos"("liquidacaoId");

-- CreateIndex
CREATE INDEX "movimentos_bancarios_contaBancariaId_data_idx" ON "movimentos_bancarios"("contaBancariaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "conciliacoes_bancarias_movimentoBancarioId_key" ON "conciliacoes_bancarias"("movimentoBancarioId");

-- CreateIndex
CREATE INDEX "receita_lancamentos_entidadeId_exercicio_categoria_idx" ON "receita_lancamentos"("entidadeId", "exercicio", "categoria");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_entidadeId_exercicio_data_idx" ON "lancamentos_contabeis"("entidadeId", "exercicio", "data");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_contabeis_entidadeId_exercicio_numero_key" ON "lancamentos_contabeis"("entidadeId", "exercicio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contabeis_entidadeId_exercicio_mes_key" ON "periodos_contabeis"("entidadeId", "exercicio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_entidadeId_exercicio_numero_key" ON "licitacoes"("entidadeId", "exercicio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "licitacao_itens_licitacaoId_item_key" ON "licitacao_itens"("licitacaoId", "item");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_entidadeId_exercicio_numero_key" ON "contratos"("entidadeId", "exercicio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_aditivos_contratoId_numero_key" ON "contrato_aditivos"("contratoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "convenios_entidadeId_exercicio_numero_key" ON "convenios"("entidadeId", "exercicio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "materiais_entidadeId_codigo_key" ON "materiais"("entidadeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "bens_entidadeId_numeroTombamento_key" ON "bens"("entidadeId", "numeroTombamento");

-- CreateIndex
CREATE INDEX "ia_sugestoes_entidadeId_modulo_status_idx" ON "ia_sugestoes"("entidadeId", "modulo", "status");

-- AddForeignKey
ALTER TABLE "exercicios_financeiros" ADD CONSTRAINT "exercicios_financeiros_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_permissoes" ADD CONSTRAINT "perfil_permissoes_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_permissoes" ADD CONSTRAINT "perfil_permissoes_permissaoId_fkey" FOREIGN KEY ("permissaoId") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_entidades" ADD CONSTRAINT "usuario_entidades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_entidades" ADD CONSTRAINT "usuario_entidades_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_entidades" ADD CONSTRAINT "usuario_entidades_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credores" ADD CONSTRAINT "credores_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orgaos" ADD CONSTRAINT "orgaos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orgaos" ADD CONSTRAINT "orgaos_orgaoSuperiorId_fkey" FOREIGN KEY ("orgaoSuperiorId") REFERENCES "orgaos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_orcamentarias" ADD CONSTRAINT "unidades_orcamentarias_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_orcamentarias" ADD CONSTRAINT "unidades_orcamentarias_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "orgaos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fontes_recurso" ADD CONSTRAINT "fontes_recurso_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_contas" ADD CONSTRAINT "plano_contas_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_contas" ADD CONSTRAINT "plano_contas_contaPaiId_fkey" FOREIGN KEY ("contaPaiId") REFERENCES "plano_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naturezas_servico" ADD CONSTRAINT "naturezas_servico_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naturezas_servico" ADD CONSTRAINT "naturezas_servico_contaContabilId_fkey" FOREIGN KEY ("contaContabilId") REFERENCES "plano_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_inss_faixas" ADD CONSTRAINT "tabela_inss_faixas_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_irrf_faixas" ADD CONSTRAINT "tabela_irrf_faixas_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabela_irrf_deducoes" ADD CONSTRAINT "tabela_irrf_deducoes_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppas" ADD CONSTRAINT "ppas_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppa_programas" ADD CONSTRAINT "ppa_programas_ppaId_fkey" FOREIGN KEY ("ppaId") REFERENCES "ppas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppa_acoes" ADD CONSTRAINT "ppa_acoes_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ppa_programas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldos" ADD CONSTRAINT "ldos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldo_metas_fiscais" ADD CONSTRAINT "ldo_metas_fiscais_ldoId_fkey" FOREIGN KEY ("ldoId") REFERENCES "ldos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ldo_prioridades" ADD CONSTRAINT "ldo_prioridades_ldoId_fkey" FOREIGN KEY ("ldoId") REFERENCES "ldos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loas" ADD CONSTRAINT "loas_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receitas_previstas" ADD CONSTRAINT "receitas_previstas_loaId_fkey" FOREIGN KEY ("loaId") REFERENCES "loas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_loaId_fkey" FOREIGN KEY ("loaId") REFERENCES "loas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "orgaos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_unidadeOrcamentariaId_fkey" FOREIGN KEY ("unidadeOrcamentariaId") REFERENCES "unidades_orcamentarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ppa_programas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "ppa_acoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dotacoes" ADD CONSTRAINT "dotacoes_fonteRecursoId_fkey" FOREIGN KEY ("fonteRecursoId") REFERENCES "fontes_recurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_adicionais" ADD CONSTRAINT "creditos_adicionais_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_adicionais" ADD CONSTRAINT "creditos_adicionais_dotacaoDestinoId_fkey" FOREIGN KEY ("dotacaoDestinoId") REFERENCES "dotacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_adicionais" ADD CONSTRAINT "creditos_adicionais_dotacaoOrigemId_fkey" FOREIGN KEY ("dotacaoOrigemId") REFERENCES "dotacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empenhos" ADD CONSTRAINT "empenhos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empenhos" ADD CONSTRAINT "empenhos_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "credores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empenhos" ADD CONSTRAINT "empenhos_dotacaoId_fkey" FOREIGN KEY ("dotacaoId") REFERENCES "dotacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empenho_movimentos" ADD CONSTRAINT "empenho_movimentos_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "empenhos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacoes" ADD CONSTRAINT "liquidacoes_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "empenhos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacoes" ADD CONSTRAINT "liquidacoes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_liquidacaoId_fkey" FOREIGN KEY ("liquidacaoId") REFERENCES "liquidacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencao_calculos" ADD CONSTRAINT "retencao_calculos_liquidacaoId_fkey" FOREIGN KEY ("liquidacaoId") REFERENCES "liquidacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencao_calculos" ADD CONSTRAINT "retencao_calculos_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "credores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencao_calculos" ADD CONSTRAINT "retencao_calculos_naturezaServicoId_fkey" FOREIGN KEY ("naturezaServicoId") REFERENCES "naturezas_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencao_calculos" ADD CONSTRAINT "retencao_calculos_ajustadoPorId_fkey" FOREIGN KEY ("ajustadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retencao_historico" ADD CONSTRAINT "retencao_historico_retencaoId_fkey" FOREIGN KEY ("retencaoId") REFERENCES "retencao_calculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_fonteRecursoId_fkey" FOREIGN KEY ("fonteRecursoId") REFERENCES "fontes_recurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_bancarios" ADD CONSTRAINT "movimentos_bancarios_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_bancarios" ADD CONSTRAINT "movimentos_bancarios_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_bancarios" ADD CONSTRAINT "movimentos_bancarios_receitaId_fkey" FOREIGN KEY ("receitaId") REFERENCES "receita_lancamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_bancarios" ADD CONSTRAINT "movimentos_bancarios_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacoes_arquivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliacoes_bancarias" ADD CONSTRAINT "conciliacoes_bancarias_movimentoBancarioId_fkey" FOREIGN KEY ("movimentoBancarioId") REFERENCES "movimentos_bancarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_arquivos" ADD CONSTRAINT "importacoes_arquivos_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_lancamentos" ADD CONSTRAINT "receita_lancamentos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_lancamentos" ADD CONSTRAINT "receita_lancamentos_fonteRecursoId_fkey" FOREIGN KEY ("fonteRecursoId") REFERENCES "fontes_recurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receita_lancamentos" ADD CONSTRAINT "receita_lancamentos_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_contabeis" ADD CONSTRAINT "lancamentos_contabeis_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_contabil_partidas" ADD CONSTRAINT "lancamento_contabil_partidas_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_contabeis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_contabil_partidas" ADD CONSTRAINT "lancamento_contabil_partidas_contaContabilId_fkey" FOREIGN KEY ("contaContabilId") REFERENCES "plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_contabeis" ADD CONSTRAINT "periodos_contabeis_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacoes" ADD CONSTRAINT "licitacoes_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_itens" ADD CONSTRAINT "licitacao_itens_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_itens" ADD CONSTRAINT "licitacao_itens_vencedorCredorId_fkey" FOREIGN KEY ("vencedorCredorId") REFERENCES "credores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_credorId_fkey" FOREIGN KEY ("credorId") REFERENCES "credores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bens" ADD CONSTRAINT "bens_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bens" ADD CONSTRAINT "bens_responsavelCredorId_fkey" FOREIGN KEY ("responsavelCredorId") REFERENCES "credores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bem_movimentacoes" ADD CONSTRAINT "bem_movimentacoes_bemId_fkey" FOREIGN KEY ("bemId") REFERENCES "bens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_sugestoes" ADD CONSTRAINT "ia_sugestoes_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

