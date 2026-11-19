import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { audit } from "./audit";
import type { Actor } from "./auth/actor";
import { allows } from "./auth/actor";
import { hashPassword, randomToken, verificationCode } from "./auth/password";
import { AppError } from "./common/app-error";
import { formatCpf, isValidCpf, maskCpf, onlyDigits } from "./domain/cpf";
import { csvLine, escapeHtml, safeSpreadsheet } from "./domain/text";
import { addDays, balance, dateForDb, formatBrDate, formatIsoDate, hoursFromMinutes, timeForDb, todayIso } from "./domain/time";
import { PrismaService } from "./prisma.service";
import { MailService } from "./mail/mail.service";
import { renderOficio } from "./oficio-pdf";
import { presentRecord, situacaoLabel, statusLabel, unifyApprovalPackages } from "./records.service";

const cnj = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

@Injectable()
export class OperationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(MailService) private readonly mail: MailService) {}

  async cards(actor: Actor, fullCpf = false) {
    const hide = (await this.setting("privacidade.ocultar_cpf")) !== "false";
    const people = await this.prisma.prestadores.findMany({
      include: {
        processos: {
          include: { locais: true, varas: { include: { comarcas: true } }, usuarios_processos_supervisor_idTousuarios: true },
          orderBy: { id: "desc" },
        },
      },
      orderBy: { nome: "asc" },
    });
    const sums = await this.prisma.$queryRaw<Array<{ processo_id: number; aprovados: bigint; pendentes: bigint; ultimo: Date | null }>>`
      SELECT processo_id,
        COALESCE(SUM(CASE WHEN status = 'Aprovado' THEN minutos ELSE 0 END), 0) AS aprovados,
        COALESCE(SUM(CASE WHEN status IN ('Pendente', 'Autorizado') THEN minutos ELSE 0 END), 0) AS pendentes,
        MAX(data) AS ultimo
      FROM registros_horas GROUP BY processo_id`;
    const byProcess = new Map(sums.map((row) => [Number(row.processo_id), row]));
    return people.flatMap((person) => {
      const processo = person.processos.find((item) => actor.localId == null || item.local_id === actor.localId) ?? null;
      if (!processo) return [];
      const sum = byProcess.get(processo.id);
      const approved = Number(sum?.aprovados ?? 0);
      const pending = Number(sum?.pendentes ?? 0);
      const determined = Math.round(Number(processo.horas_totais) * 60);
      const result = balance(determined, approved);
      return [{
        id: String(person.id),
        nome: person.nome,
        cpf: hide && !fullCpf ? maskCpf(person.cpf) : formatCpf(person.cpf),
        processo: processo.numero,
        processoId: String(processo.id),
        vara: processo.varas?.nome ?? "—",
        comarca: processo.varas?.comarcas.nome ?? "—",
        tribunal: processo.tribunal ?? "—",
        local: processo.locais?.nome ?? "—",
        localId: String(processo.local_id ?? ""),
        supervisor: processo.usuarios_processos_supervisor_idTousuarios?.nome ?? "—",
        supervisorId: String(processo.supervisor_id ?? ""),
        horasTotais: hoursFromMinutes(determined),
        horasCumpridas: hoursFromMinutes(approved),
        horasPendentes: hoursFromMinutes(pending),
        minutosDeterminados: result.determined,
        minutosValidados: result.validated,
        minutosPendentes: pending,
        minutosRestantes: result.remaining,
        percentual: Math.round(result.percent * 1000) / 1000,
        situacao: situacaoLabel(processo.situacao),
        inicio: formatBrDate(processo.data_inicio),
        prazo: formatBrDate(processo.prazo_final),
        prazoIso: processo.prazo_final ? formatIsoDate(processo.prazo_final) : null,
        telefone: person.telefone ?? "—",
        email: person.email ?? "",
        endereco: person.endereco ?? "",
        rg: person.rg ?? "",
        ultimoRegistro: formatBrDate(sum?.ultimo),
        limiteSemanal: processo.horas_semanais_max == null ? null : Number(processo.horas_semanais_max),
        restricoes: processo.restricoes ?? "",
        observacoes: processo.observacoes ?? "",
      }];
    });
  }

  async createPrestador(actor: Actor, input: PrestadorInput) {
    if (!isValidCpf(input.cpf)) throw new AppError(400, "CPF inválido.", "CPF");
    if (!cnj.test(input.numeroProcesso)) throw new AppError(400, "Número de processo fora do padrão CNJ.", "PROCESSO");
    this.assertUnit(actor, input.localId);
    const cpf = formatCpf(input.cpf);
    const duplicate = await this.prisma.prestadores.findFirst({ where: { OR: [{ cpf }, { cpf: onlyDigits(input.cpf) }] } });
    if (duplicate) throw new AppError(409, "Já existe cadastro com este CPF.", "DUPLICADO");
    const local = await this.prisma.locais.findUnique({ where: { id: input.localId } });
    const supervisor = await this.prisma.usuarios.findUnique({ where: { id: input.supervisorId } });
    if (!local || !supervisor) throw new AppError(400, "Local ou supervisor inválido.", "VINCULO");
    const today = todayIso();
    const situacao = input.dataInicio && input.dataInicio > today ? "Pendente" : "Ativo";
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const person = await tx.prestadores.create({
          data: {
            nome: input.nome.trim(),
            cpf,
            rg: input.rg ?? null,
            data_nascimento: input.dataNascimento ? dateForDb(input.dataNascimento) : null,
            telefone: input.telefone ?? null,
            email: input.email ?? null,
            endereco: input.endereco ?? null,
            criado_por: actor.id,
          },
        });
        const processo = await tx.processos.create({
          data: {
            prestador_id: person.id,
            numero: input.numeroProcesso,
            vara_id: await this.ensureVara(tx, input.vara, input.comarca),
            tribunal: input.tribunal ?? null,
            horas_totais: input.horasTotais,
            horas_semanais_max: input.limiteSemanal ?? null,
            data_decisao: input.dataDecisao ? dateForDb(input.dataDecisao) : null,
            data_inicio: input.dataInicio ? dateForDb(input.dataInicio) : null,
            prazo_final: input.prazo ? dateForDb(input.prazo) : null,
            local_id: input.localId,
            supervisor_id: input.supervisorId,
            situacao,
            restricoes: input.restricoes ?? null,
            observacoes: input.observacoes ?? null,
          },
        });
        await tx.processo_historico_situacao.create({
          data: { processo_id: processo.id, para_situacao: situacao, motivo: "Cadastro inicial", usuario_id: actor.id },
        });
        await audit(tx, { usuarioId: actor.id, prestadorId: person.id, acao: "PRESTADOR_CRIADO", entidade: "prestadores", entidadeId: person.id, ip: actor.ip, depois: { nome: person.nome, cpf } });
        return person.id;
      });
      return { id: created };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "Já existe cadastro com este CPF ou processo.", "DUPLICADO");
      }
      throw error;
    }
  }

  async updatePrestador(actor: Actor, id: number, input: Partial<PrestadorInput> & { situacao?: string; motivo?: string }) {
    const current = await this.prisma.prestadores.findUnique({ include: { processos: { orderBy: { id: "desc" }, take: 1 } }, where: { id } });
    const processo = current?.processos[0];
    if (!current || !processo) throw new AppError(404, "Prestador não encontrado.", "NAO_ENCONTRADO");
    this.assertUnit(actor, processo.local_id);
    if (input.localId) this.assertUnit(actor, input.localId);
    await this.prisma.$transaction(async (tx) => {
      await tx.prestadores.update({
        where: { id },
        data: {
          nome: input.nome?.trim(),
          rg: input.rg,
          telefone: input.telefone,
          email: input.email,
          endereco: input.endereco,
          data_nascimento: input.dataNascimento ? dateForDb(input.dataNascimento) : undefined,
        },
      });
      if (input.localId && input.localId !== processo.local_id) {
        await tx.processo_transferencias_local.create({
          data: { processo_id: processo.id, local_origem: processo.local_id, local_destino: input.localId, motivo: input.motivo ?? "Transferência de local", usuario_id: actor.id },
        });
      }
      if (input.situacao && input.situacao !== situacaoLabel(processo.situacao)) {
        if (!input.motivo?.trim()) throw new AppError(400, "Informe o motivo da mudança de situação.", "MOTIVO");
        const next = input.situacao === "Concluído" ? "Conclu_do" : input.situacao;
        await tx.processo_historico_situacao.create({
          data: { processo_id: processo.id, de_situacao: processo.situacao, para_situacao: next, motivo: input.motivo.trim(), usuario_id: actor.id },
        });
        await tx.processos.update({ where: { id: processo.id }, data: { situacao: next as "Ativo", motivo_situacao: input.motivo.trim() } });
      }
      await tx.processos.update({
        where: { id: processo.id },
        data: {
          local_id: input.localId,
          supervisor_id: input.supervisorId,
          restricoes: input.restricoes,
          observacoes: input.observacoes,
          horas_semanais_max: input.limiteSemanal,
          tribunal: input.tribunal,
        },
      });
      await audit(tx, { usuarioId: actor.id, prestadorId: id, acao: "PRESTADOR_ALTERADO", entidade: "prestadores", entidadeId: id, ip: actor.ip, antes: { nome: current.nome }, depois: { nome: input.nome ?? current.nome } });
    });
    return { id };
  }

  async records(actor: Actor) {
    const rows = await this.prisma.registros_horas.findMany({
      where: actor.localId == null ? {} : { local_id: actor.localId },
      include: {
        locais: true,
        processos: { include: { prestadores: true, usuarios_processos_supervisor_idTousuarios: true } },
        usuarios_registros_horas_registrado_por_usuarioTousuarios: true,
        prestadores: true,
      },
      orderBy: [{ data: "desc" }, { id: "desc" }],
      take: 300,
    });
    return rows.map((row) => presentRecord(row));
  }

  async createSchedule(actor: Actor, input: { processoId: number; data: string; entrada: string; saida: string; localId?: number; atividade?: string }) {
    const processo = await this.prisma.processos.findUnique({ where: { id: input.processoId }, include: { locais: true } });
    if (!processo) throw new AppError(404, "Processo não encontrado.", "NAO_ENCONTRADO");
    const localId = input.localId ?? processo.local_id;
    if (!localId) throw new AppError(400, "Informe o local.", "LOCAL");
    this.assertUnit(actor, localId);
    const local = await this.prisma.locais.findUnique({ where: { id: localId } });
    if (!local) throw new AppError(400, "Local inválido.", "LOCAL");
    if (local.vagas > 0) {
      const used = await this.prisma.escalas.count({ where: { local_id: localId, data: dateForDb(input.data), status: { not: "Cancelada" } } });
      if (used >= local.vagas) throw new AppError(409, "O local não tem vaga nessa data.", "CAPACIDADE");
    }
    const clash = await this.prisma.escalas.findFirst({
      where: { processo_id: processo.id, data: dateForDb(input.data), status: { not: "Cancelada" }, hora_inicio: { lt: timeForDb(input.saida) }, hora_fim: { gt: timeForDb(input.entrada) } },
    });
    if (clash) throw new AppError(409, "Já existe escala neste horário.", "CONFLITO");
    const activity = input.atividade ? await this.prisma.atividades.findFirst({ where: { nome: input.atividade } }) : null;
    const created = await this.prisma.escalas.create({
      data: {
        processo_id: processo.id,
        local_id: localId,
        atividade_id: activity?.id ?? null,
        data: dateForDb(input.data),
        hora_inicio: timeForDb(input.entrada),
        hora_fim: timeForDb(input.saida),
        criado_por: actor.id,
      },
    });
    await audit(this.prisma, { usuarioId: actor.id, prestadorId: processo.prestador_id, acao: "ESCALA_CRIADA", entidade: "escalas", entidadeId: created.id, ip: actor.ip });
    return { id: created.id };
  }

  async cancelSchedule(actor: Actor, id: number, motivo: string) {
    const row = await this.prisma.escalas.findUnique({ where: { id } });
    if (!row) throw new AppError(404, "Escala não encontrada.", "NAO_ENCONTRADO");
    this.assertUnit(actor, row.local_id);
    await this.prisma.escalas.update({ where: { id }, data: { status: "Cancelada", justificativa: motivo.slice(0, 255) } });
    return { id };
  }

  async upload(actor: Actor, file: { buffer: Buffer; originalname: string; size: number }, meta: { prestadorId?: number; processoId?: number; tipo?: string }) {
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new AppError(400, "Arquivo acima do limite de 10 MB.", "ARQUIVO");
    const mime = sniff(file.buffer);
    if (!mime) throw new AppError(400, "Envie apenas PDF, JPG ou PNG.", "ARQUIVO");
    const quarantine = mime === "application/pdf" && /\/JavaScript|\/JS[\s(<]/i.test(file.buffer.toString("latin1"));
    const id = randomUUID();
    const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
    const relative = path.join("private", `${id}.${extension}`);
    await mkdir(path.dirname(this.absolute(relative)), { recursive: true });
    await writeFile(this.absolute(relative), file.buffer);
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const document = await this.prisma.documentos.create({
      data: {
        prestador_id: meta.prestadorId ?? null,
        processo_id: meta.processoId ?? null,
        nome: file.originalname.replace(/[^\w.\- ]+/g, "").slice(0, 180) || "arquivo",
        tipo: "Comprovante",
        status: quarantine ? "Rascunho" : "Arquivado",
        arquivo_url: relative.replace(/\\/g, "/"),
        mime,
        tamanho_bytes: file.size,
        hash_sha256: hash,
        em_quarentena: quarantine,
        codigo_verificacao: verificationCode(),
        criado_por: actor.id,
      },
    });
    await audit(this.prisma, { usuarioId: actor.id, prestadorId: meta.prestadorId ?? null, acao: "DOCUMENTO_UPLOAD", entidade: "documentos", entidadeId: document.id, descricao: quarantine ? "Quarentena" : "Recebido", ip: actor.ip });
    if (quarantine) throw new AppError(400, "Arquivo retido na quarentena.", "QUARENTENA");
    return { id: document.id };
  }

  async download(actor: Actor, id: number) {
    const document = await this.prisma.documentos.findUnique({ where: { id } });
    if (!document?.arquivo_url) throw new AppError(404, "Documento não encontrado.", "NAO_ENCONTRADO");
    if (document.em_quarentena) throw new AppError(423, "Arquivo em quarentena.", "QUARENTENA");
    if (document.prestador_id) {
      const processo = await this.prisma.processos.findFirst({ where: { prestador_id: document.prestador_id }, orderBy: { id: "desc" } });
      if (processo) this.assertUnit(actor, processo.local_id);
    }
    const buffer = await readFile(this.absolute(document.arquivo_url));
    await audit(this.prisma, { usuarioId: actor.id, prestadorId: document.prestador_id, acao: "DOCUMENTO_DOWNLOAD", entidade: "documentos", entidadeId: id, ip: actor.ip });
    return { buffer, mime: document.mime ?? "application/octet-stream", nome: document.nome };
  }

  async verify(codigo: string) {
    const document = await this.prisma.documentos.findUnique({ where: { codigo_verificacao: codigo.toUpperCase() } });
    if (!document || document.em_quarentena) return null;
    return { autentico: true, numero: `PSC-${document.criado_em.getUTCFullYear()}-${String(document.id).padStart(6, "0")}`, tipo: labelTipo(document.tipo), emitidoEm: formatBrDate(document.criado_em) };
  }

  async hourPackages(actor: Actor, prestadorId: number) {
    const person = (await this.cards(actor, true)).find((item) => item.id === String(prestadorId));
    if (!person) throw new AppError(404, "Prestador não encontrado.", "NAO_ENCONTRADO");
    await this.prisma.$transaction((tx) => unifyApprovalPackages(tx));
    const lotes = await this.prisma.validacoes_lote.findMany({
      where: { acao: "Aprovar", validacoes_lote_itens: { some: { registros_horas: { processos: { prestador_id: prestadorId } } } } },
      include: {
        usuarios: { select: { nome: true } },
        validacoes_lote_itens: { include: { registros_horas: { include: { processos: true } } } },
      },
      orderBy: { id: "desc" },
    });
    const byDay = new Map<string, { id: number; closedAt: Date; fechadoPor: string; rows: ReturnType<typeof approvedRows> }>();
    for (const lote of lotes) {
      const rows = approvedRows(lote.validacoes_lote_itens, prestadorId);
      if (!rows.length) continue;
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(lote.criado_em);
      const fechadoPor = lote.usuarios.nome || "—";
      const current = byDay.get(day);
      if (!current) {
        byDay.set(day, { id: lote.id, closedAt: lote.criado_em, fechadoPor, rows: [...rows] });
        continue;
      }
      const seen = new Set(current.rows.map((row) => row.id));
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        current.rows.push(row);
        seen.add(row.id);
      }
      if (lote.criado_em.getTime() >= current.closedAt.getTime()) {
        current.fechadoPor = fechadoPor;
        current.closedAt = lote.criado_em;
      }
      if (lote.id < current.id) current.id = lote.id;
    }
    return [...byDay.values()]
      .map((item) => {
        const summary = packageSummary(item.closedAt, item.rows);
        return summary ? { id: item.id, fechadoPor: item.fechadoPor, fechadoEmHora: formatPackageDateTime(item.closedAt), ...summary } : null;
      })
      .filter((item): item is { id: number; fechadoPor: string; fechadoEmHora: string } & NonNullable<ReturnType<typeof packageSummary>> => !!item)
      .sort((a, b) => b.id - a.id);
  }

  async generatePdf(actor: Actor, input: { prestadorId: number; tipo: string; inicio?: string; fim?: string; loteId?: number }) {
    const cards = await this.cards(actor, true);
    const person = cards.find((item) => item.id === String(input.prestadorId));
    if (!person) throw new AppError(404, "Prestador não encontrado.", "NAO_ENCONTRADO");
    let pacote: { fechadoEm: string; horas: string; periodo: string; dias: number; registros: number } | undefined;
    let filtered: { data: string; entrada: string; saida: string; horas: number; atividade: string }[];
    if (input.loteId) {
      const lote = await this.prisma.validacoes_lote.findFirst({
        where: { id: input.loteId, acao: "Aprovar" },
        include: { validacoes_lote_itens: { include: { registros_horas: { include: { processos: true } } } } },
      });
      if (!lote) throw new AppError(404, "Pacote não encontrado.", "NAO_ENCONTRADO");
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(lote.criado_em);
      const start = new Date(`${day}T03:00:00.000Z`);
      const end = new Date(start.getTime() + 86_400_000);
      const sameDay = await this.prisma.validacoes_lote.findMany({
        where: {
          acao: "Aprovar",
          criado_em: { gte: start, lt: end },
          validacoes_lote_itens: { some: { registros_horas: { processos: { prestador_id: Number(person.id) } } } },
        },
        include: { validacoes_lote_itens: { include: { registros_horas: { include: { processos: true } } } } },
      });
      const seen = new Set<number>();
      const rows = sameDay.flatMap((item) => approvedRows(item.validacoes_lote_itens, Number(person.id))).filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
      const summary = packageSummary(lote.criado_em, rows);
      if (!summary) throw new AppError(404, "Este pacote não tem horas validadas deste prestador.", "NAO_ENCONTRADO");
      pacote = { fechadoEm: summary.fechadoEm, horas: summary.horasTexto, periodo: summary.periodo, dias: summary.dias, registros: summary.registros };
      filtered = rows.map(pdfRow);
    } else {
      const records = (await this.records(actor)).filter((row) => row.prestadorId === person.id && row.status === "Aprovado");
      filtered = records.filter((row) => (!input.inicio || row.iso >= input.inicio) && (!input.fim || row.iso <= input.fim));
    }
    const code = verificationCode();
    const numero = `PSC-${new Date().getUTCFullYear()}-${code.slice(0, 6)}`;
    const verifyUrl = `${process.env.PUBLIC_APP_URL ?? ""}/verificar/${code}`;
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 140 });
    const signer = await this.prisma.usuarios.findUnique({ where: { id: actor.id }, select: { nome: true, cargo: true } });
    const court = await this.prisma.processos.findUnique({ where: { id: Number(person.processoId) }, include: { varas: { include: { comarcas: true } } } });
    const buffer = pacote
      ? await renderOficio({
          nome: person.nome,
          processo: person.processo,
          comarca: person.comarca,
          uf: court?.varas?.comarcas.uf ?? "SP",
          supervisor: person.supervisor,
          assinante: signer?.nome || actor.nome,
          cargo: signer?.cargo?.trim() || "Servidor público municipal",
          records: filtered,
          pacote,
          numero,
          code,
          qr,
        })
      : await renderPdf({ person, records: filtered, tipo: input.tipo, numero, code, qr, emissor: actor.nome, pacote });
    const hash = createHash("sha256").update(buffer).digest("hex");
    const relative = path.join("private", `${randomUUID()}.pdf`).replace(/\\/g, "/");
    await mkdir(path.dirname(this.absolute(relative)), { recursive: true });
    await writeFile(this.absolute(relative), buffer);
    const document = await this.prisma.documentos.create({
      data: {
        prestador_id: Number(person.id),
        processo_id: Number(person.processoId),
        nome: `${input.loteId ? `Pacote ${pacote?.fechadoEm ?? ""} — ` : ""}${input.tipo} — ${person.nome}`.replace(/\s+/g, " ").trim().slice(0, 200),
        tipo: "Relat_rio_judicial",
        status: "Assinado",
        arquivo_url: relative,
        mime: "application/pdf",
        tamanho_bytes: buffer.length,
        hash_sha256: hash,
        codigo_verificacao: code,
        criado_por: actor.id,
      },
    });
    await this.prisma.relatorios_emitidos.create({
      data: {
        tipo: "Cumprimento_individual",
        formato: "PDF",
        documento_id: document.id,
        arquivo_url: relative,
        gerado_por: actor.id,
        filtros_json: JSON.stringify({ prestadorId: person.id, processo: person.processo, inicio: input.inicio, fim: input.fim, loteId: input.loteId, minutos: pacote ? undefined : person.minutosValidados, numero }),
      },
    });
    await audit(this.prisma, { usuarioId: actor.id, prestadorId: Number(person.id), acao: "DOCUMENTO_EMITIDO", entidade: "documentos", entidadeId: document.id, descricao: numero, ip: actor.ip });
    return { id: document.id, buffer, nome: `${numero}.pdf` };
  }

  async exportTable(actor: Actor, formato: "csv" | "xlsx", inicio?: string, fim?: string) {
    const rows = (await this.records(actor)).filter((row) => (!inicio || row.iso >= inicio) && (!fim || row.iso <= fim));
    const header = ["Prestador", "Data", "Entrada", "Saída", "Minutos", "Atividade", "Local", "Situação"];
    const body = rows.map((row) => [row.prestador, row.data, row.entrada, row.saida, row.minutos, row.atividade, row.local, row.status]);
    const buffer = formato === "csv"
      ? Buffer.from(`\uFEFF${[header, ...body].map((line) => csvLine(line)).join("\n")}`, "utf8")
      : await xlsx(header, body);
    await this.prisma.exportacoes.create({
      data: { conteudo: "Frequ_ncia", formato: formato === "csv" ? "CSV" : "Excel", usuario_id: actor.id },
    });
    await audit(this.prisma, { usuarioId: actor.id, acao: "EXPORTACAO", entidade: "exportacoes", descricao: formato, ip: actor.ip });
    return { buffer, mime: formato === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nome: formato === "csv" ? "frequencia.csv" : "frequencia.xlsx" };
  }

  async workspace(actor: Actor) {
    const [prestadores, records, locais, usuarios, perfis, atividades, documentos, escalas, stored, formato] = await Promise.all([
      this.cards(actor, allows(actor, "prestadores", "edit")),
      this.records(actor),
      this.prisma.locais.findMany({ where: actor.localId == null ? { ativo: true } : { id: actor.localId, ativo: true }, orderBy: { nome: "asc" } }),
      allows(actor, "usuarios", "view") ? this.prisma.usuarios.findMany({ include: { perfis: true, locais: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
      this.prisma.perfis.findMany({ include: { perfil_telas: true, usuarios: true }, orderBy: { nome: "asc" } }),
      this.prisma.atividades.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      this.prisma.documentos.findMany({ where: { em_quarentena: false }, orderBy: { id: "desc" }, take: 30 }),
      this.prisma.escalas.findMany({
        where: { data: { gte: dateForDb(addDays(todayIso(), -3)), lte: dateForDb(addDays(todayIso(), 10)) }, ...(actor.localId == null ? {} : { local_id: actor.localId }) },
        include: { locais: true, processos: { include: { prestadores: true } } },
        orderBy: { data: "asc" },
      }),
      this.prisma.notificacoes.findMany({ where: { lida_em: null, OR: [{ usuario_id: actor.id }, { usuario_id: null }] }, orderBy: { id: "desc" }, take: 30 }),
      this.prisma.config_geral.findUnique({ where: { chave: "sistema.formato_data" } }),
    ]);
    const today = todayIso();
    const month = `${today.slice(0, 8)}01`;
    const absences = await this.prisma.escalas.count({ where: { status: "Falta", data: { gte: dateForDb(month) }, ...(actor.localId == null ? {} : { local_id: actor.localId }) } });
    const deadlines = prestadores.filter((item) => item.situacao === "Ativo" && item.prazoIso && item.prazoIso >= today && item.prazoIso <= addDays(today, 7));
    const approvedMinutes = prestadores.reduce((total, item) => total + item.minutosValidados, 0);
    const determinedMinutes = prestadores.reduce((total, item) => total + item.minutosDeterminados, 0);
    const pending = records.filter((row) => row.status === "Pendente" || row.status === "Liberar para juiz");
    const stale = prestadores.filter((item) => item.situacao === "Ativo" && (item.ultimoRegistro === "—" || item.ultimoRegistro.split("/").reverse().join("-") < addDays(today, -30))).length;
    const byMonth = new Map<string, number>();
    for (const row of records.filter((item) => item.status === "Aprovado")) {
      const key = row.iso.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.horas);
    }
    const horasPorMes = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, horas]) => ({ mes: monthName(key), horas: Math.round(horas) }));
    const byLocal = new Map<string, number>();
    for (const row of records.filter((item) => item.status === "Aprovado")) byLocal.set(row.local, (byLocal.get(row.local) ?? 0) + row.horas);
    const situacao = ["Ativo", "Concluído", "Suspenso", "Pendente"].map((name) => ({ name, value: prestadores.filter((item) => item.situacao === name).length }));
    const week = weekBuckets(escalas);
    return {
      user: { id: actor.id, nome: actor.nome, email: actor.email, perfil: actor.perfilNome, local: actor.localNome, telas: Object.keys(actor.screens).filter((id) => actor.screens[id]?.view) },
      prestadores,
      records,
      locais: locais.map((item) => ({ id: item.id, nome: item.nome, vagas: item.vagas })),
      supervisores: (await this.prisma.usuarios.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } })).map((item) => ({ id: item.id, nome: item.nome })),
      atividades: atividades.map((item) => ({ id: item.id, nome: item.nome, localId: item.local_id })),
      documentos: documentos.map((item) => ({ id: String(item.id), nome: item.nome, tipo: labelTipo(item.tipo), data: formatBrDate(item.criado_em), status: labelDoc(item.status), tamanho: item.tamanho_bytes ? `${Math.max(1, Math.round(item.tamanho_bytes / 1024))} KB` : "—" })),
      escalas: week,
      notificacoes: [
        ...deadlines.map((item) => ({ id: `prazo-${item.id}`, titulo: "Prazo judicial próximo", texto: `${item.nome} tem prazo em ${item.prazo}.`, tempo: item.prazo, tipo: "alerta", link: `/prestadores/${item.id}` })),
        ...(pending.length ? [{ id: "pendentes", titulo: `${pending.length} registros aguardando validação`, texto: "Há horas lançadas que ainda não foram validadas.", tempo: "agora", tipo: "info", link: "/validacao" }] : []),
        ...(stale ? [{ id: "sem-registro", titulo: "Prestador sem registro recente", texto: `${stale} prestador(es) ativo(s) sem registro há mais de 30 dias.`, tempo: "hoje", tipo: "erro", link: "/prestadores" }] : []),
        ...stored.map((item) => ({
          id: String(item.id),
          titulo: item.titulo,
          texto: item.texto,
          tempo: formatBrDate(item.criado_em),
          tipo: item.tipo,
          link: item.link || (item.prestador_id ? `/prestadores/${item.prestador_id}` : undefined),
        })),
      ],
      dashboard: {
        kpis: [
          { label: "Prestadores cadastrados", value: String(prestadores.length), hint: "no seu escopo" },
          { label: "Prestadores ativos", value: String(situacao[0]?.value ?? 0), hint: "situação atual" },
          { label: "Horas validadas", value: String(Math.round(approvedMinutes / 60)), hint: `de ${Math.round(determinedMinutes / 60)} determinadas` },
          { label: "Pendentes de validação", value: `${Math.round(pending.reduce((total, row) => total + row.horas, 0))}h`, hint: `${pending.length} registros` },
          { label: "Ausências no mês", value: String(absences), hint: "faltas registradas" },
          { label: "Relatórios com prazo", value: String(deadlines.length), hint: "próximos 7 dias" },
        ],
        horasPorMes,
        horasPorLocal: [...byLocal.entries()].map(([local, horas]) => ({ local, horas: Math.round(horas) })),
        situacao,
        semRegistro: stale,
      },
      usuarios: usuarios.map((item) => ({ id: String(item.id), name: item.nome, email: item.email, profile: String(item.perfil_id), local: item.locais?.nome ?? "Todos os locais", color: item.cor_avatar, active: item.ativo })),
      perfis: perfis.map((item) => ({ id: String(item.id), name: item.nome, description: item.descricao ?? "", color: item.cor, screens: item.perfil_telas.filter((screen) => screen.pode_ver).map((screen) => screen.tela_id), members: item.usuarios.length })),
      agenda: escalas.filter((item) => item.status === "Agendada").slice(0, 8).map((item) => ({ prestadorId: String(item.processos.prestador_id), date: formatBrDate(item.data), time: `${formatHmSafe(item.hora_inicio)}–${formatHmSafe(item.hora_fim)}`, activity: "Comparecimento agendado" })),
      formatoData: formato?.valor === "MM/DD/AAAA" || formato?.valor === "AAAA-MM-DD" ? formato.valor : "DD/MM/AAAA",
      dia: [
        ...pending.map((row) => ({ id: row.id, personId: row.prestadorId, name: row.prestador, category: "Validação", title: `${row.horas}h para validar`, detail: `${row.atividade} · ${row.local}`, date: row.data })),
        ...escalas.filter((item) => item.status === "Falta").map((item) => ({ id: `falta-${item.id}`, personId: String(item.processos.prestador_id), name: item.processos.prestadores.nome, category: "Ausências", title: "Ausência sem justificativa", detail: item.locais.nome, date: formatBrDate(item.data) })),
        ...deadlines.map((item) => ({ id: `prazo-${item.id}`, personId: item.id, name: item.nome, category: "Prazos", title: `Prazo judicial em ${item.prazo}`, detail: `${item.vara} · ${item.supervisor}`, date: item.prazo })),
      ],
    };
  }

  async createUser(actor: Actor, input: { nome: string; email: string; perfilId: number; localId?: number | null; cor: number }) {
    const senha = randomToken(18);
    const created = await this.prisma.usuarios.create({
      data: { nome: input.nome.trim(), email: input.email.trim().toLowerCase(), senha_hash: await hashPassword(senha), perfil_id: input.perfilId, local_id: input.localId ?? null, cor_avatar: input.cor, cargo: "Equipe" },
    });
    await this.prisma.usuario_preferencias.create({ data: { usuario_id: created.id } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "USUARIO_CRIADO", entidade: "usuarios", entidadeId: created.id, ip: actor.ip });
    await this.mail.send({
      to: created.email,
      subject: "Acesso ao SIGPSC",
      template: "convite",
      text: `Olá, ${created.nome}.\n\nSua senha temporária de acesso é: ${senha}\nEntre no sistema e troque a senha.`,
    });
    return { id: created.id, senhaTemporaria: senha };
  }

  async setUserActive(actor: Actor, id: number, ativo: boolean) {
    return this.updateUser(actor, id, { ativo });
  }

  async updateUser(actor: Actor, id: number, input: { ativo?: boolean; nome?: string; email?: string; perfilId?: number; localId?: number | null; cor?: number; senha?: string }) {
    const current = await this.prisma.usuarios.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Usuário não encontrado.", "NAO_ENCONTRADO");
    if (id === actor.id && input.ativo === false) throw new AppError(400, "Você não pode desativar a própria conta.", "USUARIO");
    if (input.perfilId != null) {
      const perfil = await this.prisma.perfis.findUnique({ where: { id: input.perfilId } });
      if (!perfil) throw new AppError(400, "Perfil inválido.", "PERFIL");
    }
    if (input.localId != null) {
      const local = await this.prisma.locais.findUnique({ where: { id: input.localId } });
      if (!local) throw new AppError(400, "Local inválido.", "LOCAL");
    }
    const data: Prisma.usuariosUpdateInput = {};
    if (input.ativo != null) data.ativo = input.ativo;
    if (input.nome != null) data.nome = input.nome.trim();
    if (input.email != null) data.email = input.email.trim().toLowerCase();
    if (input.perfilId != null) data.perfis = { connect: { id: input.perfilId } };
    if (input.localId !== undefined) data.locais = input.localId == null ? { disconnect: true } : { connect: { id: input.localId } };
    if (input.cor != null) data.cor_avatar = input.cor;
    if (input.senha) data.senha_hash = await hashPassword(input.senha);
    try {
      await this.prisma.usuarios.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "Já existe uma conta com este e-mail.", "DUPLICADO");
      throw error;
    }
    await audit(this.prisma, {
      usuarioId: actor.id,
      acao: input.ativo != null && Object.keys(input).length === 1 ? "USUARIO_STATUS" : "USUARIO_ALTERADO",
      entidade: "usuarios",
      entidadeId: id,
      depois: { ativo: input.ativo, nome: input.nome, email: input.email, perfilId: input.perfilId, localId: input.localId, cor: input.cor, senha: input.senha ? "alterada" : undefined },
      ip: actor.ip,
    });
    return { id };
  }

  async setProfileScreens(actor: Actor, id: number, telas: string[]) {
    const perfil = await this.prisma.perfis.findUnique({ where: { id } });
    if (!perfil) throw new AppError(404, "Perfil não encontrado.", "NAO_ENCONTRADO");
    if (perfil.nome === "Administrador") throw new AppError(400, "O perfil administrador permanece com acesso total.", "PERFIL");
    const catalog = await this.prisma.telas.findMany();
    await this.prisma.$transaction(catalog.map((screen) => this.prisma.perfil_telas.upsert({
      where: { perfil_id_tela_id: { perfil_id: id, tela_id: screen.id } },
      create: { perfil_id: id, tela_id: screen.id, pode_ver: telas.includes(screen.id), pode_editar: telas.includes(screen.id) },
      update: { pode_ver: telas.includes(screen.id), pode_editar: telas.includes(screen.id) },
    })));
    await audit(this.prisma, { usuarioId: actor.id, acao: "PERFIL_ALTERADO", entidade: "perfis", entidadeId: id, depois: { telas }, ip: actor.ip });
    return { id };
  }

  async createProfile(actor: Actor, input: { nome: string; descricao?: string; cor: number; telas: string[] }) {
    try {
      const created = await this.prisma.perfis.create({ data: { nome: input.nome.trim(), descricao: input.descricao ?? null, cor: input.cor } });
      const catalog = await this.prisma.telas.findMany();
      if (catalog.length) {
        await this.prisma.perfil_telas.createMany({
          data: catalog.map((screen) => ({ perfil_id: created.id, tela_id: screen.id, pode_ver: input.telas.includes(screen.id), pode_editar: input.telas.includes(screen.id) })),
        });
      }
      await audit(this.prisma, { usuarioId: actor.id, acao: "PERFIL_CRIADO", entidade: "perfis", entidadeId: created.id, ip: actor.ip });
      return { id: created.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "Já existe um perfil com esse nome.", "DUPLICADO");
      throw error;
    }
  }

  async markNotifications(actor: Actor, ids: number[]) {
    await this.prisma.notificacoes.updateMany({
      where: {
        lida_em: null,
        OR: [{ usuario_id: actor.id }, { usuario_id: null }],
        ...(ids.length ? { id: { in: ids.map((id) => BigInt(id)) } } : {}),
      },
      data: { lida_em: new Date() },
    });
    return { ok: true };
  }

  async exportPeople(actor: Actor) {
    const rows = await this.cards(actor, false);
    const header = ["Nome", "CPF", "Processo", "Local", "Supervisor", "Situação", "Horas cumpridas", "Horas totais"];
    const body = rows.map((row) => [row.nome, row.cpf, row.processo, row.local, row.supervisor, row.situacao, row.horasCumpridas, row.horasTotais]);
    const buffer = Buffer.from(`\uFEFF${[header, ...body].map((line) => csvLine(line)).join("\n")}`, "utf8");
    await this.prisma.exportacoes.create({ data: { conteudo: "Prestadores", formato: "CSV", usuario_id: actor.id } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "EXPORTACAO", entidade: "exportacoes", descricao: "prestadores", ip: actor.ip });
    return { buffer, mime: "text/csv; charset=utf-8", nome: "prestadores.csv" };
  }

  async reportPreview(actor: Actor, input: ReportQuery) {
    return this.buildReport(actor, input);
  }

  async exportReport(actor: Actor, input: ReportQuery & { formato: "csv" | "xlsx" }) {
    const report = await this.buildReport(actor, input);
    const body = report.rows.map((row) => report.columns.map((column) => (row as Record<string, string>)[column.key] ?? ""));
    const buffer = input.formato === "csv"
      ? Buffer.from(`\uFEFF${[report.columns.map((column) => column.label), ...body].map((line) => csvLine(line)).join("\n")}`, "utf8")
      : await xlsx(report.columns.map((column) => column.label), body);
    await this.prisma.exportacoes.create({
      data: { conteudo: "Frequ_ncia", formato: input.formato === "csv" ? "CSV" : "Excel", usuario_id: actor.id },
    });
    await audit(this.prisma, { usuarioId: actor.id, acao: "EXPORTACAO", entidade: "exportacoes", descricao: `${input.tipo}:${input.formato}`, ip: actor.ip });
    const ext = input.formato === "csv" ? "csv" : "xlsx";
    return {
      buffer,
      mime: input.formato === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      nome: `${report.slug}.${ext}`,
    };
  }

  async pdfReport(actor: Actor, input: ReportQuery) {
    if (input.tipo === "cumprimento") {
      const prestadorId = input.prestadorId ?? Number((await this.cards(actor, false)).find((row) => row.situacao === "Ativo")?.id ?? 0);
      if (!prestadorId) throw new AppError(400, "Selecione o prestador para o cumprimento judicial.", "PRESTADOR");
      return this.generatePdf(actor, {
        prestadorId,
        tipo: "Relatório de cumprimento",
        inicio: input.inicio,
        fim: input.fim,
      });
    }
    const report = await this.buildReport(actor, input);
    const buffer = await renderTablePdf({
      title: report.title,
      subtitle: report.subtitle,
      kpis: report.kpis,
      columns: report.columns.map((column) => column.label),
      rows: report.rows.map((row) => report.columns.map((column) => String((row as Record<string, string>)[column.key] ?? ""))),
      emissor: actor.nome,
    });
    await audit(this.prisma, { usuarioId: actor.id, acao: "EXPORTACAO", entidade: "relatorios", descricao: `pdf:${input.tipo}`, ip: actor.ip });
    return { id: 0, buffer, nome: `${report.slug}.pdf` };
  }

  private async buildReport(actor: Actor, input: ReportQuery) {
    const people = await this.cards(actor, false);
    const records = await this.records(actor);
    const inicio = input.inicio;
    const fim = input.fim;
    const local = input.local?.trim();
    const inPeriod = (iso: string) => (!inicio || iso >= inicio) && (!fim || iso <= fim);
    const matchLocal = (name: string) => !local || name === local;
    const periodLabel = inicio || fim ? `${inicio ? brFromIso(inicio) : "…"} a ${fim ? brFromIso(fim) : "…"}` : "Todo o período";
    const scopedRecords = records.filter((row) => inPeriod(row.iso) && matchLocal(row.local) && (!input.prestadorId || row.prestadorId === String(input.prestadorId)));

    if (input.tipo === "frequencia" || input.tipo === "horas-periodo") {
      const rows = scopedRecords.map((row) => ({
        prestador: row.prestador,
        data: row.data,
        horario: `${row.entrada}–${row.saida}`,
        horas: `${row.horas}h`,
        atividade: row.atividade,
        local: row.local,
        status: row.status,
      }));
      const minutos = scopedRecords.reduce((total, row) => total + row.minutos, 0);
      return {
        tipo: input.tipo,
        slug: input.tipo === "frequencia" ? "frequencia-individual" : "horas-por-periodo",
        title: input.tipo === "frequencia" ? "Frequência individual" : "Horas por período",
        subtitle: periodLabel,
        kpis: [
          { label: "Registros", value: String(rows.length) },
          { label: "Total de horas", value: clockFromMinutes(minutos) },
          { label: "Validados", value: String(scopedRecords.filter((row) => row.status === "Aprovado").length) },
        ],
        columns: [
          { key: "prestador", label: "Prestador" },
          { key: "data", label: "Data" },
          { key: "horario", label: "Horário" },
          { key: "horas", label: "Horas" },
          { key: "atividade", label: "Atividade" },
          { key: "local", label: "Local" },
          { key: "status", label: "Status" },
        ],
        rows,
      };
    }

    if (input.tipo === "prestadores-ativos") {
      const ativos = people.filter((row) => row.situacao === "Ativo" && matchLocal(row.local));
      return {
        tipo: input.tipo,
        slug: "prestadores-ativos",
        title: "Prestadores ativos",
        subtitle: local || "Todas as unidades",
        kpis: [
          { label: "Ativos", value: String(ativos.length) },
          { label: "Horas validadas", value: `${Math.round(ativos.reduce((total, row) => total + row.horasCumpridas, 0))}h` },
          { label: "Saldo restante", value: `${Math.round(ativos.reduce((total, row) => total + Math.max(0, row.horasTotais - row.horasCumpridas), 0))}h` },
        ],
        columns: [
          { key: "nome", label: "Nome" },
          { key: "processo", label: "Processo" },
          { key: "local", label: "Local" },
          { key: "supervisor", label: "Supervisor" },
          { key: "cumpridas", label: "Horas validadas" },
          { key: "totais", label: "Horas totais" },
          { key: "saldo", label: "Saldo" },
        ],
        rows: ativos.map((row) => ({
          nome: row.nome,
          processo: row.processo,
          local: row.local,
          supervisor: row.supervisor,
          cumpridas: `${row.horasCumpridas}h`,
          totais: `${row.horasTotais}h`,
          saldo: `${Math.max(0, row.horasTotais - row.horasCumpridas)}h`,
        })),
      };
    }

    if (input.tipo === "ausencias") {
      const faltas = await this.prisma.escalas.findMany({
        where: {
          status: "Falta",
          ...(inicio || fim ? { data: { ...(inicio ? { gte: dateForDb(inicio) } : {}), ...(fim ? { lte: dateForDb(fim) } : {}) } } : {}),
          ...(actor.localId == null ? {} : { local_id: actor.localId }),
        },
        include: { locais: true, processos: { include: { prestadores: true } } },
        orderBy: { data: "desc" },
        take: 500,
      });
      const rows = faltas
        .filter((row) => matchLocal(row.locais.nome) && (!input.prestadorId || row.processos.prestador_id === input.prestadorId))
        .map((row) => ({
          prestador: row.processos.prestadores.nome,
          data: formatBrDate(row.data),
          horario: `${formatHmSafe(row.hora_inicio)}–${formatHmSafe(row.hora_fim)}`,
          local: row.locais.nome,
          justificativa: row.justificativa || "Sem justificativa",
        }));
      return {
        tipo: input.tipo,
        slug: "ausencias",
        title: "Ausências e justificativas",
        subtitle: periodLabel,
        kpis: [{ label: "Ausências", value: String(rows.length) }, { label: "Período", value: periodLabel }, { label: "Unidade", value: local || "Todas" }],
        columns: [
          { key: "prestador", label: "Prestador" },
          { key: "data", label: "Data" },
          { key: "horario", label: "Horário" },
          { key: "local", label: "Local" },
          { key: "justificativa", label: "Justificativa" },
        ],
        rows,
      };
    }

    if (input.tipo === "produtividade-local") {
      const byLocal = new Map<string, { horas: number; registros: number }>();
      for (const row of scopedRecords.filter((item) => item.status === "Aprovado")) {
        const current = byLocal.get(row.local) ?? { horas: 0, registros: 0 };
        current.horas += row.horas;
        current.registros += 1;
        byLocal.set(row.local, current);
      }
      const rows = [...byLocal.entries()]
        .sort((a, b) => b[1].horas - a[1].horas)
        .map(([nome, stats]) => ({ local: nome, horas: `${Math.round(stats.horas * 10) / 10}h`, registros: String(stats.registros) }));
      return {
        tipo: input.tipo,
        slug: "produtividade-por-local",
        title: "Produtividade por local",
        subtitle: periodLabel,
        kpis: [
          { label: "Locais", value: String(rows.length) },
          { label: "Horas validadas", value: clockFromMinutes(scopedRecords.filter((row) => row.status === "Aprovado").reduce((total, row) => total + row.minutos, 0)) },
          { label: "Registros", value: String(scopedRecords.filter((row) => row.status === "Aprovado").length) },
        ],
        columns: [
          { key: "local", label: "Local" },
          { key: "horas", label: "Horas" },
          { key: "registros", label: "Registros" },
        ],
        rows,
      };
    }

    if (input.tipo === "consolidado-mensal") {
      const byMonth = new Map<string, { minutos: number; registros: number }>();
      for (const row of scopedRecords.filter((item) => item.status === "Aprovado")) {
        const key = row.iso.slice(0, 7);
        const current = byMonth.get(key) ?? { minutos: 0, registros: 0 };
        current.minutos += row.minutos;
        current.registros += 1;
        byMonth.set(key, current);
      }
      const rows = [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, stats]) => ({ mes: monthName(mes), horas: clockFromMinutes(stats.minutos), registros: String(stats.registros) }));
      return {
        tipo: input.tipo,
        slug: "consolidado-mensal",
        title: "Consolidado mensal",
        subtitle: periodLabel,
        kpis: [
          { label: "Meses", value: String(rows.length) },
          { label: "Total", value: clockFromMinutes(scopedRecords.filter((row) => row.status === "Aprovado").reduce((total, row) => total + row.minutos, 0)) },
          { label: "Registros", value: String(scopedRecords.filter((row) => row.status === "Aprovado").length) },
        ],
        columns: [
          { key: "mes", label: "Mês" },
          { key: "horas", label: "Horas" },
          { key: "registros", label: "Registros" },
        ],
        rows,
      };
    }

    if (input.tipo === "cumprimento") {
      const person = input.prestadorId ? people.find((row) => row.id === String(input.prestadorId)) : people.find((row) => row.situacao === "Ativo") ?? people[0];
      if (!person) throw new AppError(404, "Prestador não encontrado.", "NAO_ENCONTRADO");
      const own = records.filter((row) => row.prestadorId === person.id && row.status === "Aprovado" && inPeriod(row.iso));
      return {
        tipo: input.tipo,
        slug: "cumprimento-judicial",
        title: "Cumprimento judicial",
        subtitle: `${person.nome} · ${periodLabel}`,
        kpis: [
          { label: "Determinadas", value: `${person.horasTotais}h` },
          { label: "Validadas", value: `${person.horasCumpridas}h` },
          { label: "Conclusão", value: `${Math.round((person.horasCumpridas / Math.max(person.horasTotais, 1)) * 100)}%` },
        ],
        columns: [
          { key: "data", label: "Data" },
          { key: "horario", label: "Horário" },
          { key: "horas", label: "Horas" },
          { key: "atividade", label: "Atividade" },
          { key: "local", label: "Local" },
        ],
        rows: own.map((row) => ({
          data: row.data,
          horario: `${row.entrada}–${row.saida}`,
          horas: `${row.horas}h`,
          atividade: row.atividade,
          local: row.local,
        })),
        prestadorId: Number(person.id),
        prestadorNome: person.nome,
      };
    }

    const today = todayIso();
    const stale = people.filter((row) => row.situacao === "Ativo" && matchLocal(row.local) && (row.ultimoRegistro === "—" || row.ultimoRegistro.split("/").reverse().join("-") < addDays(today, -30)));
    return {
      tipo: "sem-registros" as const,
      slug: "sem-registros-recentes",
      title: "Sem registros recentes",
      subtitle: "Ativos sem atividade há mais de 30 dias",
      kpis: [
        { label: "Prestadores", value: String(stale.length) },
        { label: "Unidade", value: local || "Todas" },
        { label: "Critério", value: "> 30 dias" },
      ],
      columns: [
        { key: "nome", label: "Nome" },
        { key: "processo", label: "Processo" },
        { key: "local", label: "Local" },
        { key: "supervisor", label: "Supervisor" },
        { key: "ultimo", label: "Último registro" },
      ],
      rows: stale.map((row) => ({
        nome: row.nome,
        processo: row.processo,
        local: row.local,
        supervisor: row.supervisor,
        ultimo: row.ultimoRegistro,
      })),
    };
  }

  private assertUnit(actor: Actor, localId: number | null | undefined) {
    if (actor.localId != null && localId !== actor.localId) throw new AppError(403, "Registro fora da sua unidade.", "FORA_DA_UNIDADE");
  }

  private async setting(key: string) {
    return (await this.prisma.config_geral.findUnique({ where: { chave: key } }))?.valor ?? null;
  }

  private async ensureVara(tx: Prisma.TransactionClient, nome: string, comarca: string) {
    const city = await tx.comarcas.findFirst({ where: { nome: comarca } });
    const comarcaId = city?.id ?? (await tx.comarcas.create({ data: { nome: comarca, uf: "SP" } })).id;
    const court = await tx.varas.findFirst({ where: { nome, comarca_id: comarcaId } });
    return court?.id ?? (await tx.varas.create({ data: { nome, comarca_id: comarcaId } })).id;
  }

  private absolute(relative: string) {
    const root = path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "storage");
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new AppError(400, "Arquivo inválido.", "ARQUIVO");
    return full;
  }
}

export type PrestadorInput = {
  nome: string;
  cpf: string;
  rg?: string | undefined;
  dataNascimento?: string | undefined;
  telefone?: string | undefined;
  email?: string | undefined;
  endereco?: string | undefined;
  numeroProcesso: string;
  vara: string;
  comarca: string;
  tribunal?: string | undefined;
  dataDecisao?: string | undefined;
  dataInicio?: string | undefined;
  prazo?: string | undefined;
  horasTotais: number;
  limiteSemanal?: number | undefined;
  restricoes?: string | undefined;
  localId: number;
  supervisorId: number;
  observacoes?: string | undefined;
};

function sniff(buffer: Buffer): string | null {
  if (buffer.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

function labelTipo(value: string): string {
  const map: Record<string, string> = { Relat_rio_judicial: "Relatório judicial", Declara__o: "Declaração", Of_cio: "Ofício", Frequ_ncia: "Frequência", Decis_o: "Decisão" };
  return map[value] ?? value;
}

function labelDoc(value: string): string {
  const map: Record<string, string> = { Aguardando_assinatura: "Aguardando assinatura", Enviado_ao_f_rum: "Enviado ao fórum" };
  return map[value] ?? value;
}

function monthName(isoMonth: string): string {
  const date = new Date(Date.UTC(Number(isoMonth.slice(0, 4)), Number(isoMonth.slice(5, 7)) - 1, 1));
  const name = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1, 3);
}

function formatHmSafe(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

function weekBuckets(rows: Array<{ data: Date; hora_inicio: Date; hora_fim: Date; locais: { nome: string }; processos: { prestadores: { nome: string } } }>) {
  const buckets = new Map<string, { dia: string; data: string; itens: { prestador: string; horario: string; local: string }[] }>();
  for (const row of rows) {
    const iso = formatIsoDate(row.data);
    const current = buckets.get(iso) ?? { dia: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(row.data).replace(".", ""), data: formatBrDate(row.data).slice(0, 5), itens: [] };
    current.itens.push({ prestador: row.processos.prestadores.nome, horario: `${formatHmSafe(row.hora_inicio)}–${formatHmSafe(row.hora_fim)}`, local: row.locais.nome });
    buckets.set(iso, current);
  }
  return [...buckets.values()];
}

function approvedRows(items: Array<{ registro_id: number; registros_horas: { status: string; processos: { prestador_id: number }; data: Date; entrada: Date; saida: Date; minutos: number; atividade_texto: string } }>, prestadorId: number) {
  return items
    .filter((item) => item.registros_horas.processos.prestador_id === prestadorId && statusLabel(item.registros_horas.status) === "Aprovado")
    .map((item) => ({ id: item.registro_id, ...item.registros_horas }))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.entrada.getTime() - b.entrada.getTime());
}
function packageSummary(closedAt: Date, rows: Array<{ data: Date; minutos: number }>) {
  if (!rows.length) return null;
  const dates = rows.map((row) => formatIsoDate(row.data));
  const unique = [...new Set(dates)];
  const minutos = rows.reduce((total, row) => total + row.minutos, 0);
  const first = brFromIso(unique[0] ?? "");
  const last = brFromIso(unique[unique.length - 1] ?? "");
  return { fechadoEm: formatBrDate(closedAt), periodo: first === last ? first : `${first} a ${last}`, dias: unique.length, registros: rows.length, minutos, horas: hoursFromMinutes(minutos), horasTexto: clockFromMinutes(minutos) };
}
function formatPackageDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
function brFromIso(iso: string) {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}
function clockFromMinutes(minutos: number) {
  const hours = Math.floor(minutos / 60);
  const minutes = minutos % 60;
  return minutes ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${hours}h`;
}
function pdfRow(row: { data: Date; entrada: Date; saida: Date; minutos: number; atividade_texto: string }) {
  return { data: formatBrDate(row.data), entrada: formatHmSafe(row.entrada), saida: formatHmSafe(row.saida), horas: hoursFromMinutes(row.minutos), atividade: row.atividade_texto };
}
function renderPdf(input: { person: { nome: string; cpf: string; processo: string; local: string; horasTotais: number; horasCumpridas: number; minutosRestantes: number; percentual: number; vara: string; comarca: string }; records: { data: string; entrada: string; saida: string; horas: number; atividade: string }[]; tipo: string; numero: string; code: string; qr: Buffer; emissor: string; pacote?: { fechadoEm: string; horas: string; periodo: string; dias: number; registros: number } }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(11).text("SIGPSC — Prestação de Serviços à Comunidade", { align: "left" });
    doc.moveDown(0.2).fontSize(16).text(input.tipo, { align: "left" });
    doc.fontSize(9).fillColor("#444").text(`Documento ${input.numero}`);
    doc.fillColor("#000").moveDown().fontSize(11);
    doc.text(`Prestador: ${input.person.nome}`);
    doc.text(`CPF: ${input.person.cpf}`);
    doc.text(`Processo: ${input.person.processo}`);
    doc.text(`Vara/Comarca: ${input.person.vara} · ${input.person.comarca}`);
    doc.text(`Local: ${input.person.local}`);
    if (input.pacote) {
      doc.moveDown().fontSize(12).text("Pacote fechado para o fórum");
      doc.fontSize(11).text(`Fechado em ${input.pacote.fechadoEm}`);
      doc.text(`Horas deste pacote: ${input.pacote.horas}`);
      doc.text(`Período das prestações: ${input.pacote.periodo}`);
      doc.text(`${input.pacote.dias} dia(s) · ${input.pacote.registros} registro(s)`);
      doc.fontSize(9).fillColor("#444").text("Este documento lista somente as horas deste fechamento.");
      doc.fillColor("#000");
    }
    doc.moveDown().fontSize(11).text(`Horas determinadas: ${input.person.horasTotais}h`);
    doc.text(`Horas validadas no processo: ${input.person.horasCumpridas}h`);
    doc.text(`Saldo restante: ${Math.floor(input.person.minutosRestantes / 60)}h${String(input.person.minutosRestantes % 60).padStart(2, "0")}min`);
    doc.text(`Conclusão: ${input.person.percentual.toLocaleString("pt-BR")}%`);
    doc.moveDown().fontSize(10).text(input.pacote ? "Horas do pacote" : "Atividades validadas");
    input.records.slice(0, input.pacote ? 80 : 18).forEach((row) => doc.text(`${row.data}  ${row.entrada}–${row.saida}  ${row.horas}h  ${row.atividade}`));
    if (!input.records.length) doc.text("Nenhuma hora validada no período.");
    doc.moveDown().text(`Emitido por ${input.emissor} em ${formatBrDate(new Date())}.`);
    doc.text("Este código confirma a emissão pelo SIGPSC. Não é assinatura digital certificada.");
    doc.image(input.qr, 430, 70, { width: 96 });
    doc.fontSize(8).text(input.code, 430, 172);
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      doc.fontSize(8).text(`${index + 1}/${range.count}`, 500, 800, { lineBreak: false });
    }
    doc.end();
  });
}

async function xlsx(header: string[], rows: unknown[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Frequência");
  sheet.addRow(header.map((cell) => safeSpreadsheet(cell)));
  rows.forEach((row) => sheet.addRow(row.map((cell) => safeSpreadsheet(cell))));
  const data = await book.xlsx.writeBuffer();
  return Buffer.from(data);
}

export type ReportTipo =
  | "frequencia"
  | "horas-periodo"
  | "prestadores-ativos"
  | "ausencias"
  | "produtividade-local"
  | "consolidado-mensal"
  | "cumprimento"
  | "sem-registros";

type ReportQuery = {
  tipo: ReportTipo;
  inicio?: string;
  fim?: string;
  local?: string;
  prestadorId?: number;
};

function renderTablePdf(input: {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
  emissor: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(11).fillColor("#1e3a5f").text("SIGPSC — Prestação de Serviços à Comunidade");
    doc.moveDown(0.3).fontSize(16).fillColor("#000").text(input.title);
    doc.fontSize(10).fillColor("#555").text(input.subtitle);
    doc.moveDown(0.6).fillColor("#000").fontSize(10);
    for (const kpi of input.kpis) doc.text(`${kpi.label}: ${kpi.value}`);
    doc.moveDown(0.8).fontSize(9);
    const width = 515;
    const col = Math.max(1, input.columns.length);
    const colWidth = width / col;
    let y = doc.y;
    doc.rect(40, y, width, 18).fill("#eef2f7");
    doc.fillColor("#123").font("Helvetica-Bold");
    input.columns.forEach((label, index) => {
      doc.text(label, 44 + index * colWidth, y + 4, { width: colWidth - 8, lineBreak: false });
    });
    y += 20;
    doc.font("Helvetica").fillColor("#000");
    const lines = input.rows.slice(0, 40);
    for (const row of lines) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
      row.forEach((cell, index) => {
        doc.text(String(cell).slice(0, 42), 44 + index * colWidth, y, { width: colWidth - 8, lineBreak: false });
      });
      y += 16;
    }
    if (!lines.length) {
      doc.text("Nenhum registro encontrado para os filtros selecionados.", 44, y);
      y += 16;
    }
    if (input.rows.length > lines.length) {
      doc.text(`… e mais ${input.rows.length - lines.length} registro(s).`, 44, y + 4);
      y += 16;
    }
    doc.fontSize(9).fillColor("#555").text(`Emitido por ${input.emissor} em ${formatBrDate(new Date())}.`, 40, Math.max(y + 18, 780), { lineBreak: false });
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      doc.fontSize(8).fillColor("#777").text(`${index + 1}/${range.count}`, 520, 810, { lineBreak: false });
    }
    doc.end();
  });
}

export function verificationHtml(data: { autentico: boolean; numero?: string; tipo?: string; emitidoEm?: string } | null): string {
  const body = data
    ? `<h1>Documento autêntico</h1><p>Número ${escapeHtml(data.numero ?? "")}</p><p>${escapeHtml(data.tipo ?? "")}</p><p>Emitido em ${escapeHtml(data.emitidoEm ?? "")}</p><p>A confirmação não divulga dados pessoais ou judiciais.</p>`
    : `<h1>Documento não confirmado</h1><p>O código não corresponde a uma emissão disponível.</p>`;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Verificação SIGPSC</title><body style="font-family:sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem">${body}</body></html>`;
}
