import type { Prisma } from "@prisma/client";
import { maskCpf } from "./domain/cpf";
import type { PrismaService } from "./prisma.service";

type Db = PrismaService | Prisma.TransactionClient;

const hidden = /senha|password|token|hash|segredo|authorization|cookie/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (hidden.test(key)) output[key] = "[oculto]";
    else if (/cpf/i.test(key) && typeof item === "string") output[key] = maskCpf(item);
    else output[key] = redact(item);
  }
  return output;
}

export async function audit(
  db: Db,
  event: {
    usuarioId?: number | null;
    prestadorId?: number | null;
    acao: string;
    entidade: string;
    entidadeId?: string | number | null;
    descricao?: string | null;
    antes?: unknown;
    depois?: unknown;
    ip?: string | null;
  },
): Promise<void> {
  await db.auditoria.create({
    data: {
      usuario_id: event.usuarioId ?? null,
      prestador_id: event.prestadorId ?? null,
      acao: event.acao.slice(0, 60),
      entidade: event.entidade.slice(0, 60),
      entidade_id: event.entidadeId == null ? null : String(event.entidadeId).slice(0, 40),
      descricao: event.descricao?.slice(0, 500) ?? null,
      dados_antes: event.antes == null ? null : JSON.stringify(redact(event.antes)),
      dados_depois: event.depois == null ? null : JSON.stringify(redact(event.depois)),
      ip: event.ip?.slice(0, 45) ?? null,
    },
  });
}
