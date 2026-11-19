import { Inject, Injectable } from "@nestjs/common";
import { Prisma, registros_horas_periodo, registros_horas_status, validacoes_lote_acao } from "@prisma/client";
import { audit } from "./audit";
import { AppError } from "./common/app-error";
import { PrismaService } from "./prisma.service";
import type { Actor } from "./auth/actor";
import {
  addDays,
  balance,
  dateForDb,
  durationMinutes,
  formatBrDate,
  formatHm,
  formatIsoDate,
  hoursFromMinutes,
  timeForDb,
  todayIso,
  weekRange,
  TimeRuleError,
} from "./domain/time";

type Tx = Prisma.TransactionClient;

export type HourInput = {
  prestadorId?: number | undefined;
  processoId?: number | undefined;
  data: string;
  entrada: string;
  saida: string;
  intervaloMinutos?: number | undefined;
  atividade: string;
  localId?: number | undefined;
  observacoes?: string | undefined;
};

@Injectable()
export class RecordsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(actor: Actor, input: HourInput) {
    try {
      const minutos = durationMinutes(input.entrada, input.saida, input.intervaloMinutos ?? 0);
      return await this.prisma.$transaction(async (tx) => {
        const processo = await this.lockProcess(tx, actor, input);
        this.assertOpenForEntry(String(processo.situacao));
        this.assertUnit(actor, processo.local_id);
        const localId = input.localId ?? processo.local_id;
        if (!localId) throw new AppError(400, "Informe o local da prestação.", "LOCAL");
        this.assertUnit(actor, localId);
        this.assertCalendar(input.data, input.observacoes);
        await this.assertNoOverlap(tx, processo.id, input.data, input.entrada, input.saida, 0);
        await this.assertLimits(tx, processo, input.data, minutos, 0);
        const activity = await tx.atividades.findFirst({
          where: { nome: input.atividade.trim(), ativo: true, OR: [{ local_id: localId }, { local_id: null }] },
        });
        const created = await tx.registros_horas.create({
          data: {
            processo_id: processo.id,
            local_id: localId,
            atividade_id: activity?.id ?? null,
            atividade_texto: input.atividade.trim().slice(0, 200),
            data: dateForDb(input.data),
            periodo: periodOf(input.entrada),
            entrada: timeForDb(input.entrada),
            saida: timeForDb(input.saida),
            intervalo_min: input.intervaloMinutos ?? 0,
            minutos,
            observacoes: input.observacoes?.slice(0, 2000) ?? null,
            origem: "Equipe",
            registrado_por_usuario: actor.id,
            status: registros_horas_status.Pendente,
          },
        });
        if (processo.supervisor_id && processo.supervisor_id !== actor.id) {
          await tx.notificacoes.create({
            data: {
              usuario_id: processo.supervisor_id,
              prestador_id: processo.prestador_id,
              tipo: "info",
              titulo: "Registro aguardando aprovação",
              texto: "Há um novo registro de horas para validar.",
              link: "/validacao",
            },
          });
        }
        await audit(tx, {
          usuarioId: actor.id,
          prestadorId: processo.prestador_id,
          acao: "HORAS_REGISTRO",
          entidade: "registros_horas",
          entidadeId: created.id,
          descricao: `${minutos} minutos em ${input.data}.`,
          depois: { minutos, data: input.data, status: "Pendente" },
          ip: actor.ip,
        });
        return { id: created.id, minutos, horas: hoursFromMinutes(minutos), status: "Pendente" as const };
      });
    } catch (error) {
      if (error instanceof TimeRuleError) throw new AppError(400, error.message, "HORARIO");
      throw error;
    }
  }

  async update(actor: Actor, id: number, input: HourInput) {
    try {
      const minutos = durationMinutes(input.entrada, input.saida, input.intervaloMinutos ?? 0);
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.lockRecord(tx, id);
        const label = statusLabel(current.status);
        if (label !== "Pendente" && label !== "Correção") {
          throw new AppError(409, "Horas aprovadas não podem ser editadas. Solicite correção.", "ESTADO");
        }
        const processo = await this.lockProcess(tx, actor, { processoId: current.processo_id });
        this.assertUnit(actor, current.local_id);
        const localId = input.localId ?? current.local_id;
        this.assertUnit(actor, localId);
        this.assertCalendar(input.data, input.observacoes);
        await this.assertNoOverlap(tx, processo.id, input.data, input.entrada, input.saida, id);
        await this.assertLimits(tx, processo, input.data, minutos, id);
        const activity = await tx.atividades.findFirst({
          where: { nome: input.atividade.trim(), ativo: true, OR: [{ local_id: localId }, { local_id: null }] },
        });
        await tx.registros_horas.update({
          where: { id },
          data: {
            local_id: localId,
            atividade_id: activity?.id ?? null,
            atividade_texto: input.atividade.trim().slice(0, 200),
            data: dateForDb(input.data),
            periodo: periodOf(input.entrada),
            entrada: timeForDb(input.entrada),
            saida: timeForDb(input.saida),
            intervalo_min: input.intervaloMinutos ?? 0,
            minutos,
            observacoes: input.observacoes?.slice(0, 2000) ?? null,
            status: registros_horas_status.Pendente,
            motivo: null,
          },
        });
        await audit(tx, {
          usuarioId: actor.id,
          prestadorId: processo.prestador_id,
          acao: "HORAS_CORRECAO",
          entidade: "registros_horas",
          entidadeId: id,
          antes: { status: label, minutos: current.minutos },
          depois: { status: "Pendente", minutos, data: input.data },
          ip: actor.ip,
        });
        return { id, minutos, horas: hoursFromMinutes(minutos), status: "Pendente" as const };
      });
    } catch (error) {
      if (error instanceof TimeRuleError) throw new AppError(400, error.message, "HORARIO");
      throw error;
    }
  }

  async review(actor: Actor, ids: number[], status: "Autorizado" | "Aprovado" | "Correção" | "Recusado", motivo?: string) {
    if ((status === "Correção" || status === "Recusado") && !motivo?.trim()) throw new AppError(400, "Informe o motivo.", "MOTIVO");
    const unique = [...new Set(ids)];
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const id of unique) results.push(await this.reviewOne(tx, actor, id, status, motivo?.trim()));
      if (status === "Aprovado") await attachDailyPackage(tx, actor.id, results.map((row) => row.id), motivo?.trim());
      else if (status === "Correção" || status === "Recusado") {
        await tx.validacoes_lote.create({
          data: {
            usuario_id: actor.id,
            acao: loteAction(status),
            quantidade: results.length,
            validacoes_lote_itens: { create: results.map((row) => ({ registro_id: row.id, motivo: motivo?.trim() ?? null })) },
          },
        });
      }
      return { registros: results };
    });
  }

  async balanceOf(processoId: number) {
    const processo = await this.prisma.processos.findUnique({ where: { id: processoId } });
    if (!processo) throw new AppError(404, "Processo não encontrado.", "NAO_ENCONTRADO");
    const sums = await this.sums(this.prisma, processoId, 0);
    const determined = Math.round(Number(processo.horas_totais) * 60);
    const result = balance(determined, sums.aprovados);
    return {
      processoId,
      minutosDeterminados: result.determined,
      minutosValidados: result.validated,
      minutosPendentes: sums.pendentes,
      minutosRestantes: result.remaining,
      percentual: Math.round(result.percent * 1000) / 1000,
      determinado: formatClockSafe(result.determined),
      validado: formatClockSafe(result.validated),
      restante: formatClockSafe(result.remaining),
    };
  }

  private async reviewOne(tx: Tx, actor: Actor, id: number, status: "Autorizado" | "Aprovado" | "Correção" | "Recusado", motivo?: string) {
    const current = await this.lockRecord(tx, id);
    const label = statusLabel(current.status);
    this.assertUnit(actor, current.local_id);
    if (label === status || (label === "Liberar para juiz" && status === "Autorizado")) return { id, status: label === "Liberar para juiz" ? "Autorizado" : status, idempotente: true };
    const reopened = label === "Aprovado" && (status === "Correção" || status === "Recusado");
    const fromPending = label === "Pendente" && (status === "Autorizado" || status === "Correção" || status === "Recusado");
    const fromAuthorized = label === "Liberar para juiz" && (status === "Aprovado" || status === "Correção" || status === "Recusado");
    if (!reopened && !fromPending && !fromAuthorized) {
      throw new AppError(409, status === "Aprovado" ? "Autorize as horas antes de liberar para o juiz." : "O registro não está na etapa correta.", "ESTADO");
    }
    if (status === "Autorizado" || status === "Aprovado") {
      if (current.registrado_por_usuario === actor.id && !actor.administrador) {
        throw new AppError(403, "Quem lançou o registro não pode validá-lo.", "SEPARACAO");
      }
    }
    const processo = await this.lockProcess(tx, actor, { processoId: current.processo_id });
    if (status === "Aprovado") {
      if (String(processo.situacao) === "Cancelado") throw new AppError(409, "Processo cancelado.", "PROCESSO");
      const sums = await this.sums(tx, processo.id, id);
      const determined = Math.round(Number(processo.horas_totais) * 60);
      if (sums.aprovados + current.minutos > determined) {
        throw new AppError(409, "A liberação ultrapassa as horas determinadas.", "LIMITE");
      }
    }
    const next = toStatus(status);
    const expected = reopened
      ? registros_horas_status.Aprovado
      : fromAuthorized
        ? registros_horas_status.Autorizado
        : registros_horas_status.Pendente;
    const updated = await tx.registros_horas.updateMany({
      where: { id, status: expected },
      data: {
        status: next,
        motivo: status === "Aprovado" || status === "Autorizado" ? null : motivo?.slice(0, 255) ?? null,
        validado_por: actor.id,
        validado_em: new Date(),
      },
    });
    if (updated.count !== 1) throw new AppError(409, "O registro foi atualizado por outra operação.", "CONCORRENCIA");
    const action = status === "Aprovado"
      ? "HORAS_APROVACAO"
      : status === "Autorizado"
        ? "HORAS_AUTORIZACAO"
        : status === "Recusado"
          ? "HORAS_REJEICAO"
          : "HORAS_CORRECAO_SOLICITADA";
    await audit(tx, {
      usuarioId: actor.id,
      prestadorId: processo.prestador_id,
      acao: action,
      entidade: "registros_horas",
      entidadeId: id,
      descricao: motivo?.slice(0, 255) ?? null,
      antes: { status: label },
      depois: { status },
      ip: actor.ip,
    });
    if ((status === "Correção" || status === "Recusado") && current.registrado_por_usuario) {
      await tx.notificacoes.create({
        data: {
          usuario_id: current.registrado_por_usuario,
          prestador_id: processo.prestador_id,
          tipo: status === "Recusado" ? "erro" : "alerta",
          titulo: status === "Recusado" ? "Registro recusado" : "Correção solicitada",
          texto: "Um registro de horas precisa de atenção.",
          link: "/registro",
        },
      });
    }
    return { id, status, idempotente: false };
  }

  private async lockRecord(tx: Tx, id: number) {
    const rows = await tx.$queryRaw<Array<{
      id: number;
      status: string;
      processo_id: number;
      local_id: number;
      minutos: number;
      registrado_por_usuario: number | null;
    }>>`SELECT id, status, processo_id, local_id, minutos, registrado_por_usuario FROM registros_horas WHERE id = ${id} FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new AppError(404, "Registro não encontrado.", "NAO_ENCONTRADO");
    return { ...row, id: Number(row.id), processo_id: Number(row.processo_id), local_id: Number(row.local_id), minutos: Number(row.minutos), registrado_por_usuario: row.registrado_por_usuario == null ? null : Number(row.registrado_por_usuario) };
  }

  private async lockProcess(tx: Tx, actor: Actor, input: { prestadorId?: number | undefined; processoId?: number | undefined }) {
    const rows = input.processoId
      ? await tx.$queryRaw<ProcessRow[]>`SELECT id, prestador_id, horas_totais, horas_semanais_max, situacao, local_id, supervisor_id FROM processos WHERE id = ${input.processoId} FOR UPDATE`
      : await tx.$queryRaw<ProcessRow[]>`SELECT id, prestador_id, horas_totais, horas_semanais_max, situacao, local_id, supervisor_id FROM processos WHERE prestador_id = ${input.prestadorId ?? 0} ORDER BY FIELD(situacao, 'Ativo', 'Pendente', 'Suspenso', 'Concluído', 'Cancelado'), id DESC LIMIT 1 FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new AppError(404, "Processo não encontrado.", "NAO_ENCONTRADO");
    const normalized = {
      ...row,
      id: Number(row.id),
      prestador_id: Number(row.prestador_id),
      local_id: row.local_id == null ? null : Number(row.local_id),
      supervisor_id: row.supervisor_id == null ? null : Number(row.supervisor_id),
    };
    if (input.prestadorId && normalized.prestador_id !== input.prestadorId) {
      throw new AppError(403, "O processo não pertence ao prestador informado.", "VINCULO");
    }
    return normalized;
  }

  private assertUnit(actor: Actor, localId: number | null) {
    if (actor.localId != null && localId !== actor.localId) throw new AppError(403, "Registro fora da sua unidade.", "FORA_DA_UNIDADE");
  }

  private assertOpenForEntry(situacao: string) {
    const label = situacao === "Concluído" || situacao === "Conclu_do" ? "Concluído" : situacao;
    if (label !== "Ativo") throw new AppError(409, "O processo não está ativo para lançamento de horas.", "PROCESSO");
  }

  private assertCalendar(isoDate: string, note?: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new AppError(400, "Data inválida.", "DATA");
    const today = todayIso();
    if (isoDate > today) throw new AppError(400, "Não é permitido lançar data futura.", "DATA");
    if (isoDate < addDays(today, -30)) throw new AppError(400, "Lançamento retroativo acima do prazo permitido.", "RETROATIVO");
    if (isoDate < addDays(today, -7) && (note?.trim().length ?? 0) < 10) {
      throw new AppError(400, "Lançamento retroativo exige justificativa.", "RETROATIVO");
    }
  }

  private async assertNoOverlap(tx: Tx, processoId: number, isoDate: string, entrada: string, saida: string, excludeId: number) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM registros_horas
      WHERE processo_id = ${processoId}
        AND data = ${isoDate}
        AND status <> 'Recusado'
        AND id <> ${excludeId}
        AND entrada < ${`${saida}:00`}
        AND saida > ${`${entrada}:00`}
      LIMIT 1`;
    if (rows.length) throw new AppError(409, "Já existe registro neste horário para o processo.", "SOBREPOSICAO");
  }

  private async assertLimits(tx: Tx, processo: ProcessRow, isoDate: string, minutos: number, excludeId: number) {
    const sums = await this.sums(tx, processo.id, excludeId);
    const determined = Math.round(Number(processo.horas_totais) * 60);
    if (sums.aprovados + sums.pendentes + minutos > determined) {
      throw new AppError(409, "O lançamento não foi adicionado: ultrapassa as horas determinadas do processo.", "LIMITE");
    }
    const weekly = processo.horas_semanais_max == null ? null : Math.round(Number(processo.horas_semanais_max) * 60);
    if (weekly != null) {
      const range = weekRange(isoDate);
      const rows = await tx.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COALESCE(SUM(minutos), 0) AS total FROM registros_horas
        WHERE processo_id = ${processo.id}
          AND status IN ('Pendente', 'Autorizado', 'Aprovado')
          AND data BETWEEN ${range.start} AND ${range.end}
          AND id <> ${excludeId}`;
      const used = Number(rows[0]?.total ?? 0);
      if (used + minutos > weekly) {
        const limitHours = hoursFromMinutes(weekly);
        throw new AppError(409, `O lançamento não foi adicionado: este prestador já atingiu o limite semanal de ${limitHours}h.`, "LIMITE_SEMANAL");
      }
    }
  }

  private async sums(db: Tx | PrismaService, processoId: number, excludeId: number) {
    const rows = await db.$queryRaw<Array<{ aprovados: bigint | number; pendentes: bigint | number }>>`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'Aprovado' THEN minutos ELSE 0 END), 0) AS aprovados,
        COALESCE(SUM(CASE WHEN status IN ('Pendente', 'Autorizado') THEN minutos ELSE 0 END), 0) AS pendentes
      FROM registros_horas
      WHERE processo_id = ${processoId} AND id <> ${excludeId}`;
    return { aprovados: Number(rows[0]?.aprovados ?? 0), pendentes: Number(rows[0]?.pendentes ?? 0) };
  }
}

type ProcessRow = {
  id: number;
  prestador_id: number;
  horas_totais: Prisma.Decimal | number | string;
  horas_semanais_max: Prisma.Decimal | number | string | null;
  situacao: string;
  local_id: number | null;
  supervisor_id: number | null;
};

function periodOf(entry: string): registros_horas_periodo {
  const hour = Number(entry.slice(0, 2));
  if (hour < 12) return registros_horas_periodo.Manh_;
  if (hour < 18) return registros_horas_periodo.Tarde;
  return registros_horas_periodo.Noite;
}

export function statusLabel(value: string): "Pendente" | "Liberar para juiz" | "Aprovado" | "Correção" | "Recusado" {
  if (value === "Corre__o" || value === "Correção") return "Correção";
  if (value === "Autorizado" || value === "Liberar para juiz") return "Liberar para juiz";
  if (value === "Aprovado" || value === "Recusado" || value === "Pendente") return value;
  return "Pendente";
}

export function situacaoLabel(value: string): "Pendente" | "Ativo" | "Suspenso" | "Concluído" | "Cancelado" {
  if (value === "Conclu_do" || value === "Concluído") return "Concluído";
  if (value === "Ativo" || value === "Suspenso" || value === "Pendente" || value === "Cancelado") return value;
  return "Pendente";
}

function toStatus(label: "Autorizado" | "Aprovado" | "Correção" | "Recusado"): registros_horas_status {
  if (label === "Autorizado") return registros_horas_status.Autorizado;
  if (label === "Correção") return registros_horas_status.Corre__o;
  if (label === "Aprovado") return registros_horas_status.Aprovado;
  return registros_horas_status.Recusado;
}

type PackageDb = Prisma.TransactionClient;
function saoPauloDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function saoPauloRange(day: string) {
  const start = new Date(`${day}T03:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
type PackageLote = {
  id: number;
  criado_em: Date;
  validacoes_lote_itens: Array<{
    registro_id: number;
    registros_horas: { processos: { prestador_id: number } };
  }>;
};

function packagePrestadorIds(lote: PackageLote) {
  return [...new Set(lote.validacoes_lote_itens.map((item) => item.registros_horas.processos.prestador_id))];
}

export async function unifyApprovalPackages(db: PackageDb) {
  const lotes = await db.validacoes_lote.findMany({
    where: { acao: "Aprovar" },
    include: {
      validacoes_lote_itens: {
        include: { registros_horas: { select: { processos: { select: { prestador_id: true } } } } },
      },
    },
    orderBy: { id: "asc" },
  });
  const groups = new Map<string, PackageLote[]>();
  for (const lote of lotes) {
    const prestadores = packagePrestadorIds(lote);
    if (prestadores.length !== 1) continue;
    const key = `${saoPauloDay(lote.criado_em)}:${prestadores[0]}`;
    groups.set(key, [...(groups.get(key) ?? []), lote]);
  }
  for (const group of groups.values()) {
    const target = group[0];
    if (!target || group.length < 2) continue;
    const extras = group.slice(1);
    const present = new Set(target.validacoes_lote_itens.map((item) => item.registro_id));
    for (const extra of extras) {
      for (const item of extra.validacoes_lote_itens) {
        if (present.has(item.registro_id)) continue;
        await db.validacoes_lote_itens.update({
          where: { lote_id_registro_id: { lote_id: extra.id, registro_id: item.registro_id } },
          data: { lote_id: target.id },
        });
        present.add(item.registro_id);
      }
      await db.validacoes_lote.delete({ where: { id: extra.id } });
    }
    await db.validacoes_lote.update({ where: { id: target.id }, data: { quantidade: present.size } });
  }
}

async function attachDailyPackage(db: PackageDb, usuarioId: number, ids: number[], motivo?: string) {
  await unifyApprovalPackages(db);
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return;
  const rows = await db.registros_horas.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, processos: { select: { prestador_id: true } } },
  });
  const byPrestador = new Map<number, number[]>();
  for (const row of rows) {
    const list = byPrestador.get(row.processos.prestador_id) ?? [];
    list.push(row.id);
    byPrestador.set(row.processos.prestador_id, list);
  }
  const range = saoPauloRange(saoPauloDay(new Date()));
  const today = await db.validacoes_lote.findMany({
    where: { acao: "Aprovar", criado_em: { gte: range.start, lt: range.end } },
    include: {
      validacoes_lote_itens: {
        include: { registros_horas: { select: { processos: { select: { prestador_id: true } } } } },
      },
    },
    orderBy: { id: "asc" },
  });
  for (const [prestadorId, registroIds] of byPrestador) {
    const existing = today.find((lote) => {
      const prestadores = packagePrestadorIds(lote);
      return prestadores.length === 1 && prestadores[0] === prestadorId;
    });
    if (!existing) {
      const created = await db.validacoes_lote.create({
        data: {
          usuario_id: usuarioId,
          acao: "Aprovar",
          quantidade: registroIds.length,
          validacoes_lote_itens: { create: registroIds.map((registro_id) => ({ registro_id, motivo: motivo ?? null })) },
        },
        include: {
          validacoes_lote_itens: {
            include: { registros_horas: { select: { processos: { select: { prestador_id: true } } } } },
          },
        },
      });
      today.push(created);
      continue;
    }
    for (const registroId of registroIds) {
      await db.validacoes_lote_itens.upsert({
        where: { lote_id_registro_id: { lote_id: existing.id, registro_id: registroId } },
        create: { lote_id: existing.id, registro_id: registroId, motivo: motivo ?? null },
        update: {},
      });
    }
    const quantidade = await db.validacoes_lote_itens.count({ where: { lote_id: existing.id } });
    await db.validacoes_lote.update({ where: { id: existing.id }, data: { quantidade } });
  }
}
function loteAction(label: "Aprovado" | "Correção" | "Recusado"): validacoes_lote_acao {
  if (label === "Aprovado") return validacoes_lote_acao.Aprovar;
  if (label === "Correção") return validacoes_lote_acao.Corre__o;
  return validacoes_lote_acao.Recusar;
}

function formatClockSafe(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}min`;
}

export function presentRecord(row: {
  id: number;
  data: Date;
  entrada: Date;
  saida: Date;
  minutos: number;
  atividade_texto: string;
  status: string;
  motivo: string | null;
  criado_em: Date;
  locais: { nome: string };
  processos: { prestador_id: number; prestadores: { nome: string }; usuarios_processos_supervisor_idTousuarios: { nome: string } | null };
  usuarios_registros_horas_registrado_por_usuarioTousuarios?: { nome: string } | null;
  prestadores?: { nome: string } | null;
}) {
  const lancadoPor =
    row.usuarios_registros_horas_registrado_por_usuarioTousuarios?.nome
    ?? row.prestadores?.nome
    ?? "—";
  return {
    id: String(row.id),
    prestadorId: String(row.processos.prestador_id),
    prestador: row.processos.prestadores.nome,
    data: formatBrDate(row.data),
    iso: formatIsoDate(row.data),
    entrada: formatHm(row.entrada),
    saida: formatHm(row.saida),
    horas: hoursFromMinutes(row.minutos),
    minutos: row.minutos,
    atividade: row.atividade_texto,
    local: row.locais.nome,
    supervisor: row.processos.usuarios_processos_supervisor_idTousuarios?.nome ?? "—",
    lancadoPor,
    lancadoEm: formatBrDateTime(row.criado_em),
    status: statusLabel(row.status),
    motivo: row.motivo ?? undefined,
  };
}

function formatBrDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
