import { Router } from "express";
import ppaRoutes from "./ppa.routes";
import ldoRoutes from "./ldo.routes";
import loaRoutes from "./loa.routes";
import dotacoesRoutes from "./dotacoes.routes";
import creditosAdicionaisRoutes from "./creditosAdicionais.routes";

const router = Router();

router.use("/ppa", ppaRoutes);
router.use("/ldo", ldoRoutes);
router.use("/loa", loaRoutes);
router.use("/dotacoes", dotacoesRoutes);
router.use("/creditos-adicionais", creditosAdicionaisRoutes);

export default router;
