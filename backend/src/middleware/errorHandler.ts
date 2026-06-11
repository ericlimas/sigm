import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "@/utils/AppError";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Rota nao encontrada: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Registro duplicado", details: err.meta });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Registro nao encontrado" });
    }
    return res.status(400).json({ message: "Erro de banco de dados", code: err.code });
  }

  if (err instanceof Error && err.name === "ZodError") {
    return res.status(422).json({ message: "Dados invalidos", details: JSON.parse(err.message) });
  }

  console.error(err);
  return res.status(500).json({ message: "Erro interno do servidor" });
}
