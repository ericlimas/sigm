import { Router } from "express";
import { z } from "zod";
import { authenticate } from "@/middleware/auth";
import * as authService from "./auth.service";

const router = Router();

const loginSchema = z.object({
  login: z.string().min(1),
  senha: z.string().min(1),
  entidadeId: z.string().uuid().optional(),
});

router.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.login({
    ...body,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  res.json(result);
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post("/refresh", async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refreshTokens(refreshToken, req.ip, req.headers["user-agent"]);
  res.json(result);
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
});

const forgotSchema = z.object({ email: z.string().email() });

router.post("/forgot-password", async (req, res) => {
  const { email } = forgotSchema.parse(req.body);
  const result = await authService.forgotPassword(email);
  res.json(result);
});

const resetSchema = z.object({
  token: z.string().min(1),
  novaSenha: z.string().min(6),
});

router.post("/reset-password", async (req, res) => {
  const { token, novaSenha } = resetSchema.parse(req.body);
  const result = await authService.resetPassword(token, novaSenha);
  res.json(result);
});

router.get("/me", authenticate, async (req, res) => {
  res.json(req.authContext);
});

export default router;
