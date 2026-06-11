import { PrismaClient, NaturezaContaContabil, TipoOrgao, TipoPessoa, ClassificacaoCredor, TipoContaBancaria } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ANO_EXERCICIO = 2026;

// =============================================================================
// MATRIZ DE PERMISSOES (modulo, acao)
// =============================================================================

const PERMISSOES: [string, string][] = [
  ["CREDORES", "VISUALIZAR"], ["CREDORES", "CRIAR"], ["CREDORES", "EDITAR"], ["CREDORES", "EXCLUIR"],
  ["ORGAOS", "VISUALIZAR"], ["ORGAOS", "CRIAR"], ["ORGAOS", "EDITAR"], ["ORGAOS", "EXCLUIR"],
  ["FONTES_RECURSO", "VISUALIZAR"], ["FONTES_RECURSO", "CRIAR"], ["FONTES_RECURSO", "EDITAR"], ["FONTES_RECURSO", "EXCLUIR"],
  ["PLANO_CONTAS", "VISUALIZAR"], ["PLANO_CONTAS", "CRIAR"], ["PLANO_CONTAS", "EDITAR"], ["PLANO_CONTAS", "EXCLUIR"],
  ["ORCAMENTO", "VISUALIZAR"], ["ORCAMENTO", "CRIAR"], ["ORCAMENTO", "EDITAR"], ["ORCAMENTO", "EXCLUIR"],
  ["EMPENHOS", "VISUALIZAR"], ["EMPENHOS", "CRIAR"], ["EMPENHOS", "REFORCAR"], ["EMPENHOS", "ANULAR"], ["EMPENHOS", "ESTORNAR"],
  ["LIQUIDACOES", "VISUALIZAR"], ["LIQUIDACOES", "CRIAR"], ["LIQUIDACOES", "ANULAR"],
  ["RETENCOES", "VISUALIZAR"], ["RETENCOES", "CRIAR"], ["RETENCOES", "EDITAR"], ["RETENCOES", "EXCLUIR"], ["RETENCOES", "CALCULAR"], ["RETENCOES", "AJUSTAR"],
  ["PAGAMENTOS", "VISUALIZAR"], ["PAGAMENTOS", "CRIAR"], ["PAGAMENTOS", "CANCELAR"],
  ["TESOURARIA", "VISUALIZAR"], ["TESOURARIA", "CRIAR"], ["TESOURARIA", "EDITAR"], ["TESOURARIA", "EXCLUIR"], ["TESOURARIA", "CONCILIAR"],
  ["RECEITAS", "VISUALIZAR"], ["RECEITAS", "CRIAR"], ["RECEITAS", "EXCLUIR"],
  ["CONTABIL", "VISUALIZAR"], ["CONTABIL", "CRIAR"], ["CONTABIL", "ESTORNAR"], ["CONTABIL", "ENCERRAR"],
  ["DASHBOARD", "VISUALIZAR"],
  ["LICITACOES", "VISUALIZAR"], ["LICITACOES", "CRIAR"], ["LICITACOES", "EDITAR"], ["LICITACOES", "EXCLUIR"],
  ["CONTRATOS", "VISUALIZAR"], ["CONTRATOS", "CRIAR"], ["CONTRATOS", "EDITAR"], ["CONTRATOS", "EXCLUIR"],
  ["CONVENIOS", "VISUALIZAR"], ["CONVENIOS", "CRIAR"], ["CONVENIOS", "EDITAR"], ["CONVENIOS", "EXCLUIR"],
  ["ALMOXARIFADO", "VISUALIZAR"], ["ALMOXARIFADO", "CRIAR"], ["ALMOXARIFADO", "EDITAR"], ["ALMOXARIFADO", "EXCLUIR"],
  ["PATRIMONIO", "VISUALIZAR"], ["PATRIMONIO", "CRIAR"], ["PATRIMONIO", "EDITAR"], ["PATRIMONIO", "EXCLUIR"],
  ["AUDITORIA", "VISUALIZAR"],
  ["IA", "VISUALIZAR"], ["IA", "GERAR"], ["IA", "AVALIAR"],
];

function modAll(modulo: string): [string, string][] {
  return PERMISSOES.filter(([m]) => m === modulo);
}

function mod(modulo: string, ...acoes: string[]): [string, string][] {
  return acoes.map((acao) => [modulo, acao] as [string, string]);
}

const PERFIS: { chave: string; nome: string; descricao: string; permissoes: [string, string][] }[] = [
  {
    chave: "ADMINISTRADOR",
    nome: "Administrador",
    descricao: "Acesso irrestrito a todos os modulos do sistema",
    permissoes: PERMISSOES,
  },
  {
    chave: "CONTABILIDADE",
    nome: "Contabilidade",
    descricao: "Plano de contas, lancamentos contabeis, retencoes e relatorios",
    permissoes: [
      ...modAll("CONTABIL"),
      ...modAll("PLANO_CONTAS"),
      ...modAll("RETENCOES"),
      ...mod("ORCAMENTO", "VISUALIZAR"),
      ...mod("EMPENHOS", "VISUALIZAR"),
      ...mod("LIQUIDACOES", "VISUALIZAR", "CRIAR", "ANULAR"),
      ...mod("PAGAMENTOS", "VISUALIZAR"),
      ...mod("RECEITAS", "VISUALIZAR"),
      ...mod("TESOURARIA", "VISUALIZAR"),
      ...mod("DASHBOARD", "VISUALIZAR"),
      ...mod("AUDITORIA", "VISUALIZAR"),
      ...mod("CREDORES", "VISUALIZAR"),
      ...mod("FONTES_RECURSO", "VISUALIZAR"),
      ...mod("ORGAOS", "VISUALIZAR"),
      ...modAll("IA"),
    ],
  },
  {
    chave: "TESOURARIA",
    nome: "Tesouraria",
    descricao: "Pagamentos, receitas, contas bancarias e conciliacao",
    permissoes: [
      ...modAll("TESOURARIA"),
      ...mod("PAGAMENTOS", "VISUALIZAR", "CRIAR", "CANCELAR"),
      ...mod("RECEITAS", "VISUALIZAR", "CRIAR", "EXCLUIR"),
      ...mod("RETENCOES", "VISUALIZAR", "CALCULAR"),
      ...mod("LIQUIDACOES", "VISUALIZAR"),
      ...mod("EMPENHOS", "VISUALIZAR"),
      ...mod("CONTABIL", "VISUALIZAR"),
      ...mod("DASHBOARD", "VISUALIZAR"),
      ...mod("CREDORES", "VISUALIZAR"),
      ...mod("FONTES_RECURSO", "VISUALIZAR"),
      ...mod("AUDITORIA", "VISUALIZAR"),
    ],
  },
  {
    chave: "COMPRAS",
    nome: "Compras / Empenho",
    descricao: "Empenhos, liquidacoes, almoxarifado e cadastro de credores",
    permissoes: [
      ...modAll("EMPENHOS"),
      ...mod("LIQUIDACOES", "VISUALIZAR", "CRIAR", "ANULAR"),
      ...modAll("CREDORES"),
      ...mod("ORCAMENTO", "VISUALIZAR"),
      ...modAll("ALMOXARIFADO"),
      ...mod("PATRIMONIO", "VISUALIZAR"),
      ...mod("CONTRATOS", "VISUALIZAR"),
      ...mod("LICITACOES", "VISUALIZAR"),
      ...mod("DASHBOARD", "VISUALIZAR"),
      ...mod("FONTES_RECURSO", "VISUALIZAR"),
      ...mod("ORGAOS", "VISUALIZAR"),
    ],
  },
  {
    chave: "LICITACAO",
    nome: "Licitacoes e Contratos",
    descricao: "Licitacoes, contratos, aditivos e convenios",
    permissoes: [
      ...modAll("LICITACOES"),
      ...modAll("CONTRATOS"),
      ...modAll("CONVENIOS"),
      ...mod("CREDORES", "VISUALIZAR", "CRIAR", "EDITAR"),
      ...mod("ORCAMENTO", "VISUALIZAR"),
      ...mod("DASHBOARD", "VISUALIZAR"),
      ...mod("AUDITORIA", "VISUALIZAR"),
    ],
  },
  {
    chave: "CONTROLE_INTERNO",
    nome: "Controle Interno",
    descricao: "Auditoria, inteligencia artificial e visualizacao geral",
    permissoes: [
      ...mod("AUDITORIA", "VISUALIZAR"),
      ...modAll("IA"),
      ...mod("DASHBOARD", "VISUALIZAR"),
      ...mod("CONTABIL", "VISUALIZAR"),
      ...mod("ORCAMENTO", "VISUALIZAR"),
      ...mod("EMPENHOS", "VISUALIZAR"),
      ...mod("LIQUIDACOES", "VISUALIZAR"),
      ...mod("PAGAMENTOS", "VISUALIZAR"),
      ...mod("RETENCOES", "VISUALIZAR"),
      ...mod("TESOURARIA", "VISUALIZAR"),
      ...mod("RECEITAS", "VISUALIZAR"),
      ...mod("LICITACOES", "VISUALIZAR"),
      ...mod("CONTRATOS", "VISUALIZAR"),
      ...mod("CONVENIOS", "VISUALIZAR"),
      ...mod("ALMOXARIFADO", "VISUALIZAR"),
      ...mod("PATRIMONIO", "VISUALIZAR"),
      ...mod("CREDORES", "VISUALIZAR"),
      ...mod("ORGAOS", "VISUALIZAR"),
      ...mod("FONTES_RECURSO", "VISUALIZAR"),
      ...mod("PLANO_CONTAS", "VISUALIZAR"),
    ],
  },
  {
    chave: "RH",
    nome: "Recursos Humanos",
    descricao: "Cadastro de servidores e calculo de retencoes (INSS/IRRF)",
    permissoes: [
      ...mod("CREDORES", "VISUALIZAR", "CRIAR", "EDITAR"),
      ...mod("RETENCOES", "VISUALIZAR", "CALCULAR", "AJUSTAR"),
      ...mod("DASHBOARD", "VISUALIZAR"),
    ],
  },
  {
    chave: "CONSULTA",
    nome: "Consulta",
    descricao: "Acesso de leitura a todos os modulos",
    permissoes: PERMISSOES.filter(([, acao]) => acao === "VISUALIZAR"),
  },
];

// =============================================================================
// PCASP BASICO
// =============================================================================

interface ContaSeed {
  codigo: string;
  descricao: string;
  natureza: NaturezaContaContabil;
  classe: number;
  nivel: number;
  pai: string | null;
  aceitaLancamento: boolean;
}

const CONTAS_PCASP: ContaSeed[] = [
  { codigo: "1", descricao: "ATIVO", natureza: "ATIVO", classe: 1, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "1.1", descricao: "ATIVO CIRCULANTE", natureza: "ATIVO", classe: 1, nivel: 2, pai: "1", aceitaLancamento: false },
  { codigo: "1.1.1", descricao: "CAIXA E EQUIVALENTES DE CAIXA", natureza: "ATIVO", classe: 1, nivel: 3, pai: "1.1", aceitaLancamento: false },
  { codigo: "1.1.1.1.01.01", descricao: "Caixa", natureza: "ATIVO", classe: 1, nivel: 6, pai: "1.1.1", aceitaLancamento: true },
  { codigo: "1.1.1.1.01.02", descricao: "Bancos Conta Movimento", natureza: "ATIVO", classe: 1, nivel: 6, pai: "1.1.1", aceitaLancamento: true },
  { codigo: "1.1.3", descricao: "CREDITOS DE CURTO PRAZO", natureza: "ATIVO", classe: 1, nivel: 3, pai: "1.1", aceitaLancamento: false },
  { codigo: "1.1.3.8.01.01", descricao: "Creditos Tributarios a Receber", natureza: "ATIVO", classe: 1, nivel: 6, pai: "1.1.3", aceitaLancamento: true },

  { codigo: "2", descricao: "PASSIVO", natureza: "PASSIVO", classe: 2, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "2.1", descricao: "PASSIVO CIRCULANTE", natureza: "PASSIVO", classe: 2, nivel: 2, pai: "2", aceitaLancamento: false },
  { codigo: "2.1.1", descricao: "OBRIGACOES TRABALHISTAS, PREVIDENCIARIAS E ASSISTENCIAIS A PAGAR", natureza: "PASSIVO", classe: 2, nivel: 3, pai: "2.1", aceitaLancamento: false },
  { codigo: "2.1.1.1.01.01", descricao: "INSS a Recolher", natureza: "PASSIVO", classe: 2, nivel: 6, pai: "2.1.1", aceitaLancamento: true },
  { codigo: "2.1.1.1.01.02", descricao: "IRRF a Recolher", natureza: "PASSIVO", classe: 2, nivel: 6, pai: "2.1.1", aceitaLancamento: true },
  { codigo: "2.1.2", descricao: "FORNECEDORES E CONTAS A PAGAR A CURTO PRAZO", natureza: "PASSIVO", classe: 2, nivel: 3, pai: "2.1", aceitaLancamento: false },
  { codigo: "2.1.2.1.01.01", descricao: "Fornecedores Nacionais", natureza: "PASSIVO", classe: 2, nivel: 6, pai: "2.1.2", aceitaLancamento: true },
  { codigo: "2.3", descricao: "PATRIMONIO LIQUIDO", natureza: "PATRIMONIO_LIQUIDO", classe: 2, nivel: 2, pai: "2", aceitaLancamento: false },
  { codigo: "2.3.1", descricao: "PATRIMONIO SOCIAL E CAPITAL", natureza: "PATRIMONIO_LIQUIDO", classe: 2, nivel: 3, pai: "2.3", aceitaLancamento: false },
  { codigo: "2.3.1.1.01.01", descricao: "Resultado do Exercicio", natureza: "PATRIMONIO_LIQUIDO", classe: 2, nivel: 6, pai: "2.3.1", aceitaLancamento: true },

  { codigo: "3", descricao: "VARIACOES PATRIMONIAIS DIMINUTIVAS", natureza: "VPD", classe: 3, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "3.1", descricao: "VPD - PESSOAL E ENCARGOS", natureza: "VPD", classe: 3, nivel: 2, pai: "3", aceitaLancamento: false },
  { codigo: "3.1.1.1.01.01", descricao: "Remuneracao a Pessoal", natureza: "VPD", classe: 3, nivel: 6, pai: "3.1", aceitaLancamento: true },
  { codigo: "3.1.1.2.01.01", descricao: "Encargos Patronais - INSS", natureza: "VPD", classe: 3, nivel: 6, pai: "3.1", aceitaLancamento: true },
  { codigo: "3.3", descricao: "VPD - USO DE BENS, SERVICOS E CONSUMO DE CAPITAL FIXO", natureza: "VPD", classe: 3, nivel: 2, pai: "3", aceitaLancamento: false },
  { codigo: "3.3.3.1.01.01", descricao: "Servicos de Terceiros - Pessoa Fisica", natureza: "VPD", classe: 3, nivel: 6, pai: "3.3", aceitaLancamento: true },
  { codigo: "3.3.3.1.01.02", descricao: "Servicos de Terceiros - Pessoa Juridica", natureza: "VPD", classe: 3, nivel: 6, pai: "3.3", aceitaLancamento: true },
  { codigo: "3.3.3.1.01.03", descricao: "Material de Consumo", natureza: "VPD", classe: 3, nivel: 6, pai: "3.3", aceitaLancamento: true },

  { codigo: "4", descricao: "VARIACOES PATRIMONIAIS AUMENTATIVAS", natureza: "VPA", classe: 4, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "4.1", descricao: "VPA - IMPOSTOS, TAXAS E CONTRIBUICOES DE MELHORIA", natureza: "VPA", classe: 4, nivel: 2, pai: "4", aceitaLancamento: false },
  { codigo: "4.1.1.1.01.01", descricao: "Impostos - IPTU", natureza: "VPA", classe: 4, nivel: 6, pai: "4.1", aceitaLancamento: true },
  { codigo: "4.1.1.1.01.02", descricao: "Impostos - ISS", natureza: "VPA", classe: 4, nivel: 6, pai: "4.1", aceitaLancamento: true },
  { codigo: "4.5", descricao: "VPA - TRANSFERENCIAS E DELEGACOES RECEBIDAS", natureza: "VPA", classe: 4, nivel: 2, pai: "4", aceitaLancamento: false },
  { codigo: "4.5.1.1.01.01", descricao: "Transferencias da Uniao - FPM", natureza: "VPA", classe: 4, nivel: 6, pai: "4.5", aceitaLancamento: true },
  { codigo: "4.5.1.1.01.02", descricao: "Transferencias do Estado - ICMS", natureza: "VPA", classe: 4, nivel: 6, pai: "4.5", aceitaLancamento: true },

  { codigo: "5", descricao: "CONTROLE DA APROVACAO DO PLANEJAMENTO E ORCAMENTO", natureza: "ORCAMENTARIA_DESPESA", classe: 5, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "5.1.1.1.01.01", descricao: "Dotacao Inicial - Despesas Correntes", natureza: "ORCAMENTARIA_DESPESA", classe: 5, nivel: 6, pai: "5", aceitaLancamento: true },

  { codigo: "6", descricao: "CONTROLE DA EXECUCAO DO PLANEJAMENTO E ORCAMENTO", natureza: "ORCAMENTARIA_RECEITA", classe: 6, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "6.1.1.1.01.01", descricao: "Previsao Inicial da Receita", natureza: "ORCAMENTARIA_RECEITA", classe: 6, nivel: 6, pai: "6", aceitaLancamento: true },

  { codigo: "7", descricao: "CONTROLE DE ATOS POTENCIAIS - ATIVOS", natureza: "CONTROLE_DEVEDOR", classe: 7, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "7.1.1.1.01.01", descricao: "Garantias e Contragarantias Recebidas", natureza: "CONTROLE_DEVEDOR", classe: 7, nivel: 6, pai: "7", aceitaLancamento: true },

  { codigo: "8", descricao: "CONTROLE DE ATOS POTENCIAIS - PASSIVOS", natureza: "CONTROLE_CREDOR", classe: 8, nivel: 1, pai: null, aceitaLancamento: false },
  { codigo: "8.1.1.1.01.01", descricao: "Garantias e Contragarantias Concedidas", natureza: "CONTROLE_CREDOR", classe: 8, nivel: 6, pai: "8", aceitaLancamento: true },
];

async function main() {
  // ---------------------------------------------------------------------
  // Entidade demo + exercicio financeiro
  // ---------------------------------------------------------------------
  const entidade = await prisma.entidade.upsert({
    where: { cnpj: "12.345.678/0001-90" },
    update: {},
    create: {
      tipo: "PREFEITURA",
      nome: "Prefeitura Municipal Modelo",
      cnpj: "12.345.678/0001-90",
      codigoIbge: "3100100",
      municipio: "Modelo",
      uf: "MG",
      ativo: true,
    },
  });
  console.log(`Entidade: ${entidade.nome} (${entidade.id})`);

  await prisma.exercicioFinanceiro.upsert({
    where: { entidadeId_ano: { entidadeId: entidade.id, ano: ANO_EXERCICIO } },
    update: {},
    create: { entidadeId: entidade.id, ano: ANO_EXERCICIO, ativo: true, encerrado: false },
  });

  // ---------------------------------------------------------------------
  // Permissoes
  // ---------------------------------------------------------------------
  const permissaoIds = new Map<string, string>();
  for (const [modulo, acao] of PERMISSOES) {
    const permissao = await prisma.permissao.upsert({
      where: { modulo_acao: { modulo, acao } },
      update: {},
      create: { modulo, acao },
    });
    permissaoIds.set(`${modulo}:${acao}`, permissao.id);
  }
  console.log(`Permissoes: ${permissaoIds.size}`);

  // ---------------------------------------------------------------------
  // Perfis + vinculo de permissoes
  // ---------------------------------------------------------------------
  const perfilIds = new Map<string, string>();
  for (const p of PERFIS) {
    const perfil = await prisma.perfil.upsert({
      where: { chave: p.chave },
      update: { nome: p.nome, descricao: p.descricao },
      create: { chave: p.chave, nome: p.nome, descricao: p.descricao, sistemico: true },
    });
    perfilIds.set(p.chave, perfil.id);

    for (const [modulo, acao] of p.permissoes) {
      const permissaoId = permissaoIds.get(`${modulo}:${acao}`);
      if (!permissaoId) continue;
      await prisma.perfilPermissao.upsert({
        where: { perfilId_permissaoId: { perfilId: perfil.id, permissaoId } },
        update: {},
        create: { perfilId: perfil.id, permissaoId },
      });
    }
  }
  console.log(`Perfis: ${perfilIds.size}`);

  // ---------------------------------------------------------------------
  // Usuario administrador
  // ---------------------------------------------------------------------
  const senhaHash = await bcrypt.hash("Admin@123", 10);
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@sigm.local" },
    update: {},
    create: {
      nome: "Administrador do Sistema",
      email: "admin@sigm.local",
      login: "admin",
      senhaHash,
      ativo: true,
      precisaTrocarSenha: true,
    },
  });

  await prisma.usuarioEntidade.upsert({
    where: { usuarioId_entidadeId: { usuarioId: admin.id, entidadeId: entidade.id } },
    update: {},
    create: {
      usuarioId: admin.id,
      entidadeId: entidade.id,
      perfilId: perfilIds.get("ADMINISTRADOR")!,
      padrao: true,
      ativo: true,
    },
  });
  console.log(`Usuario admin: admin@sigm.local / Admin@123 (login: admin)`);

  // ---------------------------------------------------------------------
  // Tabela INSS (vigencia 2024 - segurado contribuinte individual/empregado)
  // ---------------------------------------------------------------------
  const tetoInss = 7786.02;
  const existeInss = await prisma.tabelaInssFaixa.findFirst({ where: { entidadeId: entidade.id } });
  if (!existeInss) {
    await prisma.tabelaInssFaixa.createMany({
      data: [
        { entidadeId: entidade.id, vigenciaInicio: new Date("2024-01-01"), faixaInicial: 0, faixaFinal: 1412.00, aliquota: 7.5, parcelaDeduzir: 0, tetoPrevidenciario: tetoInss },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2024-01-01"), faixaInicial: 1412.01, faixaFinal: 2666.68, aliquota: 9, parcelaDeduzir: 21.18, tetoPrevidenciario: tetoInss },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2024-01-01"), faixaInicial: 2666.69, faixaFinal: 4000.03, aliquota: 12, parcelaDeduzir: 101.18, tetoPrevidenciario: tetoInss },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2024-01-01"), faixaInicial: 4000.04, faixaFinal: null, aliquota: 14, parcelaDeduzir: 181.18, tetoPrevidenciario: tetoInss },
      ],
    });
  }

  // ---------------------------------------------------------------------
  // Tabela IRRF progressiva (vigencia maio/2023) + deducao por dependente
  // ---------------------------------------------------------------------
  const existeIrrf = await prisma.tabelaIrrfFaixa.findFirst({ where: { entidadeId: entidade.id } });
  if (!existeIrrf) {
    await prisma.tabelaIrrfFaixa.createMany({
      data: [
        { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), baseInicial: 0, baseFinal: 2112.00, aliquota: 0, parcelaDeduzir: 0 },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), baseInicial: 2112.01, baseFinal: 2826.65, aliquota: 7.5, parcelaDeduzir: 158.40 },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), baseInicial: 2826.66, baseFinal: 3751.05, aliquota: 15, parcelaDeduzir: 370.40 },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), baseInicial: 3751.06, baseFinal: 4664.68, aliquota: 22.5, parcelaDeduzir: 651.73 },
        { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), baseInicial: 4664.69, baseFinal: null, aliquota: 27.5, parcelaDeduzir: 884.96 },
      ],
    });
  }

  const existeDeducao = await prisma.tabelaIrrfDeducao.findFirst({ where: { entidadeId: entidade.id } });
  if (!existeDeducao) {
    await prisma.tabelaIrrfDeducao.create({
      data: { entidadeId: entidade.id, vigenciaInicio: new Date("2023-05-01"), valorPorDependente: 189.59 },
    });
  }
  console.log("Tabelas INSS/IRRF criadas");

  // ---------------------------------------------------------------------
  // PCASP basico
  // ---------------------------------------------------------------------
  const contaIds = new Map<string, string>();
  for (const c of CONTAS_PCASP) {
    const conta = await prisma.contaContabil.upsert({
      where: { entidadeId_codigo: { entidadeId: entidade.id, codigo: c.codigo } },
      update: {},
      create: {
        entidadeId: entidade.id,
        codigo: c.codigo,
        descricao: c.descricao,
        natureza: c.natureza,
        classe: c.classe,
        nivel: c.nivel,
        contaPaiId: c.pai ? contaIds.get(c.pai) ?? null : null,
        aceitaLancamento: c.aceitaLancamento,
      },
    });
    contaIds.set(c.codigo, conta.id);
  }
  console.log(`PCASP: ${contaIds.size} contas`);

  // ---------------------------------------------------------------------
  // Fontes de recurso
  // ---------------------------------------------------------------------
  const fontesData = [
    { codigo: "1500", descricao: "Recursos Nao Vinculados de Impostos" },
    { codigo: "1501", descricao: "Receita de Impostos e Transferencias - Educacao (MDE)" },
    { codigo: "1502", descricao: "Receita de Impostos e Transferencias - Saude (ASPS)" },
    { codigo: "1600", descricao: "Transferencias e Convenios - Uniao/Estado" },
  ];
  const fonteIds = new Map<string, string>();
  for (const f of fontesData) {
    const fonte = await prisma.fonteRecurso.upsert({
      where: { entidadeId_codigo: { entidadeId: entidade.id, codigo: f.codigo } },
      update: {},
      create: { entidadeId: entidade.id, codigo: f.codigo, descricao: f.descricao, ativo: true },
    });
    fonteIds.set(f.codigo, fonte.id);
  }
  console.log(`Fontes de recurso: ${fonteIds.size}`);

  // ---------------------------------------------------------------------
  // Orgaos e Unidades Orcamentarias
  // ---------------------------------------------------------------------
  const orgaosData: { codigo: string; nome: string; tipo: TipoOrgao; pai: string | null }[] = [
    { codigo: "01", nome: "Camara Municipal", tipo: "PODER_LEGISLATIVO", pai: null },
    { codigo: "02", nome: "Prefeitura Municipal Modelo", tipo: "ORGAO", pai: null },
    { codigo: "02.01", nome: "Secretaria Municipal de Administracao e Financas", tipo: "SECRETARIA", pai: "02" },
    { codigo: "02.02", nome: "Secretaria Municipal de Educacao", tipo: "SECRETARIA", pai: "02" },
    { codigo: "02.03", nome: "Secretaria Municipal de Saude", tipo: "SECRETARIA", pai: "02" },
    { codigo: "03", nome: "Fundo Municipal de Saude", tipo: "FUNDO", pai: null },
  ];
  const orgaoIds = new Map<string, string>();
  for (const o of orgaosData) {
    const orgao = await prisma.orgao.upsert({
      where: { entidadeId_codigo: { entidadeId: entidade.id, codigo: o.codigo } },
      update: {},
      create: {
        entidadeId: entidade.id,
        codigo: o.codigo,
        nome: o.nome,
        tipo: o.tipo,
        orgaoSuperiorId: o.pai ? orgaoIds.get(o.pai) ?? null : null,
        ativo: true,
      },
    });
    orgaoIds.set(o.codigo, orgao.id);
  }
  console.log(`Orgaos: ${orgaoIds.size}`);

  const unidadesData = [
    { orgao: "01", codigo: "0001", nome: "Camara Municipal" },
    { orgao: "02.01", codigo: "0001", nome: "Secretaria Municipal de Administracao e Financas" },
    { orgao: "02.02", codigo: "0001", nome: "Secretaria Municipal de Educacao" },
    { orgao: "02.03", codigo: "0001", nome: "Secretaria Municipal de Saude" },
  ];
  const unidadeIds = new Map<string, string>();
  for (const u of unidadesData) {
    const orgaoId = orgaoIds.get(u.orgao)!;
    const unidade = await prisma.unidadeOrcamentaria.upsert({
      where: { entidadeId_orgaoId_codigo: { entidadeId: entidade.id, orgaoId, codigo: u.codigo } },
      update: {},
      create: { entidadeId: entidade.id, orgaoId, codigo: u.codigo, nome: u.nome, ativo: true },
    });
    unidadeIds.set(u.orgao, unidade.id);
  }
  console.log(`Unidades orcamentarias: ${unidadeIds.size}`);

  // ---------------------------------------------------------------------
  // Natureza de servico (retencao tributaria PF)
  // ---------------------------------------------------------------------
  await prisma.naturezaServico.upsert({
    where: { entidadeId_codigo: { entidadeId: entidade.id, codigo: "01" } },
    update: {},
    create: {
      entidadeId: entidade.id,
      codigo: "01",
      descricao: "Servicos de Consultoria e Assessoria Tecnica (Pessoa Fisica)",
      codigoReceita: "0588",
      contaContabilId: contaIds.get("3.3.3.1.01.01"),
      percentualInss: 11,
      sujeitoInss: true,
      sujeitoIrrf: true,
      ativo: true,
    },
  });
  console.log("Natureza de servico criada");

  // ---------------------------------------------------------------------
  // PPA / LDO / LOA
  // ---------------------------------------------------------------------
  const ppa = await prisma.ppa.upsert({
    where: { entidadeId_anoInicio_anoFim: { entidadeId: entidade.id, anoInicio: ANO_EXERCICIO, anoFim: ANO_EXERCICIO + 3 } },
    update: {},
    create: {
      entidadeId: entidade.id,
      anoInicio: ANO_EXERCICIO,
      anoFim: ANO_EXERCICIO + 3,
      lei: "Lei Municipal nº 1.234/2025",
      dataAprovacao: new Date(`${ANO_EXERCICIO - 1}-12-10`),
      ativo: true,
    },
  });

  const programasData = [
    { codigo: "0001", nome: "Gestao Administrativa", acao: { codigo: "2001", nome: "Manutencao das Atividades Administrativas" } },
    { codigo: "0002", nome: "Educacao para Todos", acao: { codigo: "2002", nome: "Manutencao do Ensino Fundamental" } },
    { codigo: "0003", nome: "Saude para Todos", acao: { codigo: "2003", nome: "Manutencao das Acoes e Servicos Publicos de Saude" } },
  ];
  const programaIds = new Map<string, string>();
  const acaoIds = new Map<string, string>();
  for (const p of programasData) {
    const programa = await prisma.ppaPrograma.upsert({
      where: { ppaId_codigo: { ppaId: ppa.id, codigo: p.codigo } },
      update: {},
      create: { ppaId: ppa.id, codigo: p.codigo, nome: p.nome, ativo: true },
    });
    programaIds.set(p.codigo, programa.id);

    const acao = await prisma.ppaAcao.upsert({
      where: { programaId_codigo: { programaId: programa.id, codigo: p.acao.codigo } },
      update: {},
      create: { programaId: programa.id, codigo: p.acao.codigo, nome: p.acao.nome, tipo: "ATIVIDADE", ativo: true },
    });
    acaoIds.set(p.codigo, acao.id);
  }
  console.log(`PPA: ${programaIds.size} programas`);

  const ldo = await prisma.ldo.upsert({
    where: { entidadeId_exercicio: { entidadeId: entidade.id, exercicio: ANO_EXERCICIO } },
    update: {},
    create: {
      entidadeId: entidade.id,
      exercicio: ANO_EXERCICIO,
      lei: "Lei Municipal nº 1.250/2025",
      dataAprovacao: new Date(`${ANO_EXERCICIO - 1}-07-15`),
      ativo: true,
    },
  });

  const existeMetas = await prisma.ldoMetaFiscal.findFirst({ where: { ldoId: ldo.id } });
  if (!existeMetas) {
    await prisma.ldoMetaFiscal.createMany({
      data: [
        { ldoId: ldo.id, ano: ANO_EXERCICIO, descricao: "Receita Total", valorPrevisto: 45000000 },
        { ldoId: ldo.id, ano: ANO_EXERCICIO, descricao: "Despesa Total", valorPrevisto: 45000000 },
        { ldoId: ldo.id, ano: ANO_EXERCICIO, descricao: "Resultado Primario", valorPrevisto: 0 },
        { ldoId: ldo.id, ano: ANO_EXERCICIO, descricao: "Resultado Nominal", valorPrevisto: 0 },
        { ldoId: ldo.id, ano: ANO_EXERCICIO, descricao: "Divida Publica Consolidada", valorPrevisto: 5000000 },
      ],
    });
  }

  const existePrioridades = await prisma.ldoPrioridade.findFirst({ where: { ldoId: ldo.id } });
  if (!existePrioridades) {
    await prisma.ldoPrioridade.createMany({
      data: [
        { ldoId: ldo.id, ordem: 1, descricao: "Garantir a manutencao e o desenvolvimento do ensino fundamental" },
        { ldoId: ldo.id, ordem: 2, descricao: "Ampliar e qualificar as acoes e servicos publicos de saude" },
        { ldoId: ldo.id, ordem: 3, descricao: "Modernizar a gestao administrativa e fiscal do municipio" },
      ],
    });
  }
  console.log("LDO criada");

  const loa = await prisma.loa.upsert({
    where: { entidadeId_exercicio: { entidadeId: entidade.id, exercicio: ANO_EXERCICIO } },
    update: {},
    create: {
      entidadeId: entidade.id,
      exercicio: ANO_EXERCICIO,
      lei: "Lei Municipal nº 1.260/2025",
      dataAprovacao: new Date(`${ANO_EXERCICIO - 1}-12-20`),
      valorTotalReceita: 45000000,
      valorTotalDespesa: 10500000,
      ativo: true,
    },
  });

  const receitasPrevistasData = [
    { codigoReceita: "1.1.1.2.01", descricao: "IPTU", categoria: "IPTU" as const, valor: 5000000 },
    { codigoReceita: "1.1.1.2.04", descricao: "ISS", categoria: "ISS" as const, valor: 8000000 },
    { codigoReceita: "1.7.2.1.01", descricao: "Cota-Parte do FPM", categoria: "TRANSFERENCIA" as const, valor: 20000000 },
    { codigoReceita: "1.7.2.1.02", descricao: "Cota-Parte do ICMS", categoria: "TRANSFERENCIA" as const, valor: 12000000 },
  ];
  for (const r of receitasPrevistasData) {
    await prisma.receitaPrevista.upsert({
      where: { loaId_codigoReceita: { loaId: loa.id, codigoReceita: r.codigoReceita } },
      update: {},
      create: {
        loaId: loa.id,
        codigoReceita: r.codigoReceita,
        descricao: r.descricao,
        categoria: r.categoria,
        valorPrevisto: r.valor,
        valorAtualizado: r.valor,
      },
    });
  }
  console.log(`LOA criada com ${receitasPrevistasData.length} receitas previstas`);

  // ---------------------------------------------------------------------
  // Dotacoes orcamentarias de exemplo
  // ---------------------------------------------------------------------
  const dotacoesData = [
    {
      ficha: 1, orgao: "02.01", funcao: "04", subfuncao: "122", programa: "0001",
      categoriaEconomica: "3", grupoDespesa: "3", modalidadeAplicacao: "90",
      elementoDespesa: "3.3.90.39", fonte: "1500", valorInicial: 500000,
    },
    {
      ficha: 2, orgao: "02.02", funcao: "12", subfuncao: "361", programa: "0002",
      categoriaEconomica: "3", grupoDespesa: "1", modalidadeAplicacao: "90",
      elementoDespesa: "3.1.90.11", fonte: "1501", valorInicial: 8000000,
    },
    {
      ficha: 3, orgao: "02.03", funcao: "10", subfuncao: "301", programa: "0003",
      categoriaEconomica: "3", grupoDespesa: "3", modalidadeAplicacao: "90",
      elementoDespesa: "3.3.90.30", fonte: "1502", valorInicial: 2000000,
    },
  ];
  for (const d of dotacoesData) {
    await prisma.dotacao.upsert({
      where: { entidadeId_exercicio_ficha: { entidadeId: entidade.id, exercicio: ANO_EXERCICIO, ficha: d.ficha } },
      update: {},
      create: {
        entidadeId: entidade.id,
        loaId: loa.id,
        exercicio: ANO_EXERCICIO,
        ficha: d.ficha,
        orgaoId: orgaoIds.get(d.orgao)!,
        unidadeOrcamentariaId: unidadeIds.get(d.orgao)!,
        funcao: d.funcao,
        subfuncao: d.subfuncao,
        programaId: programaIds.get(d.programa),
        acaoId: acaoIds.get(d.programa),
        categoriaEconomica: d.categoriaEconomica,
        grupoDespesa: d.grupoDespesa,
        modalidadeAplicacao: d.modalidadeAplicacao,
        elementoDespesa: d.elementoDespesa,
        fonteRecursoId: fonteIds.get(d.fonte)!,
        valorInicial: d.valorInicial,
        ativo: true,
      },
    });
  }
  console.log(`Dotacoes: ${dotacoesData.length}`);

  // ---------------------------------------------------------------------
  // Conta bancaria
  // ---------------------------------------------------------------------
  const contaExistente = await prisma.contaBancaria.findFirst({ where: { entidadeId: entidade.id, descricao: "Banco do Brasil - C/C 12345-6" } });
  if (!contaExistente) {
    await prisma.contaBancaria.create({
      data: {
        entidadeId: entidade.id,
        tipo: "BANCO" as TipoContaBancaria,
        descricao: "Banco do Brasil - C/C 12345-6",
        banco: "001 - Banco do Brasil",
        agencia: "1234-5",
        conta: "12345-6",
        fonteRecursoId: fonteIds.get("1500"),
        saldoInicial: 1500000,
        ativo: true,
      },
    });
  }
  console.log("Conta bancaria criada");

  // ---------------------------------------------------------------------
  // Credores de exemplo
  // ---------------------------------------------------------------------
  const credoresData = [
    {
      cpfCnpj: "12.345.678/0001-99",
      nome: "Construtora Modelo Ltda",
      nomeFantasia: "Construtora Modelo",
      tipoPessoa: "JURIDICA" as TipoPessoa,
      classificacao: "FORNECEDOR" as ClassificacaoCredor,
      regimeTributario: "Lucro Presumido",
      banco: "001 - Banco do Brasil", agencia: "1234-5", conta: "98765-4",
    },
    {
      cpfCnpj: "123.456.789-00",
      nome: "Joao da Silva Santos",
      nomeFantasia: null,
      tipoPessoa: "FISICA" as TipoPessoa,
      classificacao: "AUTONOMO" as ClassificacaoCredor,
      regimeTributario: null,
      banco: "104 - Caixa Economica Federal", agencia: "0001", conta: "00012345-6",
      dataNascimento: new Date("1985-05-10"),
      numeroDependentes: 2,
      chavePix: "123.456.789-00",
    },
  ];
  for (const c of credoresData) {
    await prisma.credor.upsert({
      where: { entidadeId_cpfCnpj: { entidadeId: entidade.id, cpfCnpj: c.cpfCnpj } },
      update: {},
      create: {
        entidadeId: entidade.id,
        tipoPessoa: c.tipoPessoa,
        cpfCnpj: c.cpfCnpj,
        nome: c.nome,
        nomeFantasia: c.nomeFantasia ?? undefined,
        classificacao: c.classificacao,
        regimeTributario: c.regimeTributario ?? undefined,
        banco: c.banco,
        agencia: c.agencia,
        conta: c.conta,
        chavePix: "chavePix" in c ? c.chavePix : undefined,
        dataNascimento: "dataNascimento" in c ? c.dataNascimento : undefined,
        numeroDependentes: "numeroDependentes" in c ? c.numeroDependentes : 0,
        ativo: true,
      },
    });
  }
  console.log(`Credores: ${credoresData.length}`);

  console.log("\nSeed concluido com sucesso.");
  console.log("Login: admin | Senha: Admin@123 (troca obrigatoria no primeiro acesso)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
