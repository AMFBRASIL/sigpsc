import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { AppModule } from "./app.module";
import { MailService } from "./mail/mail.service";
import { OperationsService, verificationHtml } from "./operations.service";

const hits = new Map<string, { count: number; reset: number }>();

function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > max;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((item) => item.trim());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const local = process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      callback(null, local || origins.includes(origin));
    },
    credentials: true,
  });
  if (process.env.NODE_ENV !== "test") {
    app.use(pinoHttp({
      logger: pino({ redact: ["req.headers.cookie", "req.headers.authorization", "req.body.senha", "req.body.password", "req.body.cpf"] }),
    }));
  }
  app.use((request: Request, response: Response, next: NextFunction) => {
    const ip = request.ip ?? "local";
    if (limited(`all:${ip}`, 600, 60_000) || (request.path.endsWith("/auth/login") && limited(`login:${ip}`, 10, 15 * 60_000))) {
      response.status(429).json({ statusCode: 429, message: "Muitas requisições.", code: "LIMITE" });
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.path.startsWith("/api/") && request.get("x-sigpsc-request") !== "1") {
      response.status(403).json({ statusCode: 403, message: "Requisição recusada.", code: "CSRF" });
      return;
    }
    next();
  });
  const server = app.getHttpAdapter().getInstance() as { get: (path: string, handler: (req: Request, res: Response) => Promise<void>) => void };
  const operations = app.get(OperationsService);
  server.get("/verificar/:codigo", async (request, response) => {
    const data = await operations.verify(String(request.params.codigo ?? ""));
    response.status(data ? 200 : 404).type("html").send(verificationHtml(data));
  });
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("SIGPSC").setDescription("API institucional da prestação de serviços à comunidade.").setVersion("1.0").addCookieAuth("sigpsc_session").build());
  SwaggerModule.setup("api/docs", app, document);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  const timer = setInterval(() => void app.get(MailService).flush().catch(() => undefined), 60_000);
  timer.unref();
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { bootstrap };
