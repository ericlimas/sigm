export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(message = "Registro nao encontrado") {
    return new AppError(message, 404);
  }

  static forbidden(message = "Acesso nao autorizado") {
    return new AppError(message, 403);
  }

  static unauthorized(message = "Nao autenticado") {
    return new AppError(message, 401);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(message, 409, details);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, details);
  }
}
