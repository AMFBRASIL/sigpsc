import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, type PipeTransform } from "@nestjs/common";
import type { Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "./app-error";

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      throw new AppError(400, message, "VALIDACAO");
    }
    return parsed.data;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === "string" ? body : (body as { message?: string }).message ?? "Erro";
      const code = typeof body === "object" && body && "code" in body ? String((body as { code: unknown }).code) : "ERRO";
      response.status(status).json({ statusCode: status, message, code });
      return;
    }
    if (process.env.NODE_ENV !== "test") console.error(request.method, request.path);
    response.status(500).json({
      statusCode: 500,
      message: "Erro interno.",
      code: "INTERNO",
      ...(process.env.NODE_ENV === "production" ? {} : { detail: exception instanceof Error ? exception.message : "erro" }),
    });
  }
}
