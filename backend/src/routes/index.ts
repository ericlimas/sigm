import { Router } from "express";
import authRoutes from "@/modules/auth/auth.routes";
import credoresRoutes from "@/modules/cadastros/credores.routes";
import orgaosRoutes from "@/modules/cadastros/orgaos.routes";
import fontesRecursoRoutes from "@/modules/cadastros/fontesRecurso.routes";
import planoContasRoutes from "@/modules/cadastros/planoContas.routes";
import naturezasServicoRoutes from "@/modules/cadastros/naturezasServico.routes";
import orcamentoRoutes from "@/modules/orcamento/orcamento.routes";
import empenhosRoutes from "@/modules/empenhos/empenhos.routes";
import liquidacoesRoutes from "@/modules/liquidacoes/liquidacoes.routes";
import pagamentosRoutes from "@/modules/pagamentos/pagamentos.routes";
import retencoesRoutes from "@/modules/retencoes/retencoes.routes";
import tesourariaRoutes from "@/modules/tesouraria/tesouraria.routes";
import receitasRoutes from "@/modules/receitas/receitas.routes";
import contabilRoutes from "@/modules/contabil/contabil.routes";
import dashboardRoutes from "@/modules/dashboard/dashboard.routes";
import licitacoesRoutes from "@/modules/licitacoes/licitacoes.routes";
import contratosRoutes from "@/modules/contratos/contratos.routes";
import conveniosRoutes from "@/modules/convenios/convenios.routes";
import almoxarifadoRoutes from "@/modules/almoxarifado/almoxarifado.routes";
import patrimonioRoutes from "@/modules/patrimonio/patrimonio.routes";
import transparenciaRoutes from "@/modules/transparencia/transparencia.routes";
import auditoriaRoutes from "@/modules/auditoria/auditoria.routes";
import iaRoutes from "@/modules/ia/ia.routes";
import usuariosRoutes from "@/modules/usuarios/usuarios.routes";
import entidadeRoutes from "@/modules/entidade/entidade.routes";
import { authenticate } from "@/middleware/auth";

const router = Router();

// Rotas publicas
router.use("/auth", authRoutes);
router.use("/transparencia", transparenciaRoutes);

// A partir daqui, autenticacao obrigatoria (JWT)
router.use(authenticate);

router.use("/credores", credoresRoutes);
router.use("/orgaos", orgaosRoutes);
router.use("/fontes-recurso", fontesRecursoRoutes);
router.use("/plano-contas", planoContasRoutes);
router.use("/naturezas-servico", naturezasServicoRoutes);
router.use("/orcamento", orcamentoRoutes);
router.use("/empenhos", empenhosRoutes);
router.use("/liquidacoes", liquidacoesRoutes);
router.use("/pagamentos", pagamentosRoutes);
router.use("/retencoes", retencoesRoutes);
router.use("/tesouraria", tesourariaRoutes);
router.use("/receitas", receitasRoutes);
router.use("/contabil", contabilRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/licitacoes", licitacoesRoutes);
router.use("/contratos", contratosRoutes);
router.use("/convenios", conveniosRoutes);
router.use("/almoxarifado", almoxarifadoRoutes);
router.use("/patrimonio", patrimonioRoutes);
router.use("/auditoria", auditoriaRoutes);
router.use("/ia", iaRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/entidade", entidadeRoutes);

export default router;
