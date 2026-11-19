import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { AppError } from "../common/app-error";
import { ZodPipe } from "../common/http";
import { Public, Screen } from "../auth/actor";
import { actorOf, type AuthedRequest } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { OperationsService, verificationHtml } from "../operations.service";
import { RecordsService } from "../records.service";

const password = z.string().min(12, "A senha precisa ter ao menos 12 caracteres.").max(200);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const hour = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido.");

const hourBody = z.object({
  prestadorId: z.number().int().positive().optional(),
  processoId: z.number().int().positive().optional(),
  data: iso,
  entrada: hour,
  saida: hour,
  intervaloMinutos: z.number().int().min(0).max(600).optional(),
  atividade: z.string().trim().min(3).max(200),
  localId: z.number().int().positive().optional(),
  observacoes: z.string().max(2000).optional(),
});

const prestadorSchema = z.object({
  nome: z.string().trim().min(5).max(150),
  cpf: z.string().min(11).max(14),
  rg: z.string().max(20).optional(),
  dataNascimento: iso.optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  endereco: z.string().max(200).optional(),
  numeroProcesso: z.string().min(10).max(30),
  vara: z.string().min(2).max(150),
  comarca: z.string().min(2).max(120),
  tribunal: z.string().max(120).optional(),
  dataDecisao: iso.optional(),
  dataInicio: iso.optional(),
  prazo: iso.optional(),
  horasTotais: z.number().positive().max(10000),
  limiteSemanal: z.number().positive().max(44).optional(),
  restricoes: z.string().max(2000).optional(),
  localId: z.number().int().positive(),
  supervisorId: z.number().int().positive(),
  observacoes: z.string().max(2000).optional(),
});

function numericId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Identificador inválido.", "VALIDACAO");
  return id;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body(new ZodPipe(z.object({ email: z.string().min(3).max(150), senha: z.string().min(8).max(200), codigo: z.string().regex(/^\d{6}$/).optional() }))) body: { email: string; senha: string; codigo?: string }, @Req() request: AuthedRequest, @Res({ passthrough: true }) response: Response) {
    return this.auth.login(body, request, response);
  }

  @Public()
  @Post("logout")
  logout(@Req() request: AuthedRequest, @Res({ passthrough: true }) response: Response) {
    return this.auth.logout(request.actor, request, response);
  }

  @Get("me")
  me(@Req() request: AuthedRequest) {
    const actor = actorOf(request);
    return { id: actor.id, nome: actor.nome, email: actor.email, perfil: actor.perfilNome, local: actor.localNome, administrador: actor.administrador };
  }

  @Public()
  @Post("forgot-password")
  forgot(@Body(new ZodPipe(z.object({ email: z.string().email() }))) body: { email: string }, @Req() request: AuthedRequest) {
    return this.auth.forgot(body.email, request.ip ?? null);
  }

  @Public()
  @Post("reset-password")
  reset(@Body(new ZodPipe(z.object({ token: z.string().min(20), senha: password }))) body: { token: string; senha: string }, @Req() request: AuthedRequest) {
    return this.auth.reset(body.token, body.senha, request.ip ?? null);
  }

  @Post("password")
  change(@Body(new ZodPipe(z.object({ atual: z.string().min(8), nova: password }))) body: { atual: string; nova: string }, @Req() request: AuthedRequest) {
    return this.auth.changePassword(actorOf(request), body.atual, body.nova);
  }

  @Post("mfa/setup")
  setup(@Req() request: AuthedRequest) {
    return this.auth.setupMfa(actorOf(request));
  }

  @Post("mfa/confirm")
  confirm(@Body(new ZodPipe(z.object({ codigo: z.string().regex(/^\d{6}$/) }))) body: { codigo: string }, @Req() request: AuthedRequest) {
    return this.auth.confirmMfa(actorOf(request), body.codigo);
  }
}

@ApiTags("prestadores")
@Controller("prestadores")
export class PrestadoresController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Screen("prestadores", "view")
  @Get()
  async list(@Query(new ZodPipe(z.object({ q: z.string().optional(), situacao: z.string().optional(), local: z.string().optional(), supervisor: z.string().optional(), conclusao: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) }))) query: { q?: string; situacao?: string; local?: string; supervisor?: string; conclusao?: "true" | "false"; page: number; pageSize: number }, @Req() request: AuthedRequest) {
    const all = await this.operations.cards(actorOf(request));
    const term = (query.q ?? "").toLowerCase();
    const digits = (query.q ?? "").replace(/\D/g, "");
    const filtered = all.filter((item) => {
      const matches = !term || item.nome.toLowerCase().includes(term) || item.processo.toLowerCase().includes(term) || (digits.length >= 3 && item.cpf.replace(/\D/g, "").includes(digits));
      return matches && (!query.situacao || query.situacao === "Todos" || item.situacao === query.situacao) && (!query.local || item.local === query.local) && (!query.supervisor || item.supervisor === query.supervisor) && (query.conclusao !== "true" || (item.situacao === "Ativo" && item.percentual >= 80));
    });
    const start = (query.page - 1) * query.pageSize;
    return { data: filtered.slice(start, start + query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize };
  }

  @Screen("prestadores", "view")
  @Get(":id/packages")
  packages(@Param("id") id: string, @Req() request: AuthedRequest) {
    return this.operations.hourPackages(actorOf(request), numericId(id));
  }

  @Screen("prestadores", "view")
  @Get(":id")
  async one(@Param("id") id: string, @Req() request: AuthedRequest) {
    const card = (await this.operations.cards(actorOf(request), true)).find((item) => item.id === id);
    if (!card) throw new AppError(404, "Prestador não encontrado.", "NAO_ENCONTRADO");
    return card;
  }

  @Screen("prestadores", "edit")
  @Post()
  create(@Body(new ZodPipe(prestadorSchema)) body: z.infer<typeof prestadorSchema>, @Req() request: AuthedRequest) {
    return this.operations.createPrestador(actorOf(request), body);
  }

  @Screen("prestadores", "edit")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodPipe(prestadorSchema.partial().extend({ situacao: z.string().optional(), motivo: z.string().max(255).optional() }))) body: z.infer<typeof prestadorSchema>, @Req() request: AuthedRequest) {
    return this.operations.updatePrestador(actorOf(request), numericId(id), body);
  }
}

@ApiTags("frequencia")
@Controller("attendance")
export class AttendanceController {
  constructor(@Inject(RecordsService) private readonly records: RecordsService, @Inject(OperationsService) private readonly operations: OperationsService) {}

  @Screen("registro", "view")
  @Get()
  list(@Req() request: AuthedRequest) {
    return this.operations.records(actorOf(request));
  }

  @Screen("registro", "edit")
  @Post()
  create(@Body(new ZodPipe(hourBody)) body: z.infer<typeof hourBody>, @Req() request: AuthedRequest) {
    return this.records.create(actorOf(request), body);
  }

  @Screen("registro", "edit")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodPipe(hourBody)) body: z.infer<typeof hourBody>, @Req() request: AuthedRequest) {
    return this.records.update(actorOf(request), numericId(id), body);
  }

  @Screen("validacao", "edit")
  @Post("batch")
  batch(@Body(new ZodPipe(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100), status: z.enum(["Aprovado", "Correção", "Recusado"]), motivo: z.string().max(255).optional() }))) body: { ids: number[]; status: "Aprovado" | "Correção" | "Recusado"; motivo?: string }, @Req() request: AuthedRequest) {
    return this.records.review(actorOf(request), body.ids, body.status, body.motivo);
  }

  @Screen("validacao", "edit")
  @Post(":id/approve")
  approve(@Param("id") id: string, @Req() request: AuthedRequest) {
    return this.records.review(actorOf(request), [numericId(id)], "Aprovado");
  }

  @Screen("validacao", "edit")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body(new ZodPipe(z.object({ motivo: z.string().min(3).max(255) }))) body: { motivo: string }, @Req() request: AuthedRequest) {
    return this.records.review(actorOf(request), [numericId(id)], "Recusado", body.motivo);
  }

  @Screen("validacao", "edit")
  @Post(":id/request-correction")
  correct(@Param("id") id: string, @Body(new ZodPipe(z.object({ motivo: z.string().min(3).max(255) }))) body: { motivo: string }, @Req() request: AuthedRequest) {
    return this.records.review(actorOf(request), [numericId(id)], "Correção", body.motivo);
  }
}

@ApiTags("processos")
@Controller("judicial-orders")
export class OrdersController {
  constructor(@Inject(RecordsService) private readonly records: RecordsService) {}

  @Screen("prestadores", "view")
  @Get(":id/balance")
  balance(@Param("id") id: string) {
    return this.records.balanceOf(numericId(id));
  }
}

@ApiTags("documentos")
@Controller("documents")
export class DocumentsController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Screen("documentos", "edit")
  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@UploadedFile() file: { buffer: Buffer; originalname: string; size: number } | undefined, @Body() body: { prestadorId?: string; processoId?: string }, @Req() request: AuthedRequest) {
    if (!file) throw new AppError(400, "Arquivo obrigatório.", "ARQUIVO");
    return this.operations.upload(actorOf(request), file, { prestadorId: body.prestadorId ? Number(body.prestadorId) : undefined, processoId: body.processoId ? Number(body.processoId) : undefined });
  }

  @Screen("documentos", "view")
  @Get(":id/download")
  async download(@Param("id") id: string, @Req() request: AuthedRequest, @Res() response: Response) {
    const file = await this.operations.download(actorOf(request), numericId(id));
    response.setHeader("Content-Type", file.mime);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Disposition", `attachment; filename="${file.nome.replace(/[^\w.\-]+/g, "_")}"`);
    response.send(file.buffer);
  }

  @Screen("documentos", "edit")
  @Post("generate")
  async generate(@Body(new ZodPipe(z.object({ prestadorId: z.number().int().positive(), tipo: z.string().min(3).max(80), inicio: iso.optional(), fim: iso.optional(), loteId: z.number().int().positive().optional() }))) body: { prestadorId: number; tipo: string; inicio?: string; fim?: string; loteId?: number }, @Req() request: AuthedRequest, @Res() response: Response) {
    const file = await this.operations.generatePdf(actorOf(request), body);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${file.nome}"`);
    response.send(file.buffer);
  }
}

@ApiTags("relatorios")
@Controller("reports")
export class ReportsController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Screen("relatorios", "view")
  @Get("attendance")
  async attendance(@Query(new ZodPipe(z.object({ formato: z.enum(["csv", "xlsx"]).default("csv"), inicio: iso.optional(), fim: iso.optional() }))) query: { formato: "csv" | "xlsx"; inicio?: string; fim?: string }, @Req() request: AuthedRequest, @Res() response: Response) {
    const file = await this.operations.exportTable(actorOf(request), query.formato, query.inicio, query.fim);
    response.setHeader("Content-Type", file.mime);
    response.setHeader("Content-Disposition", `attachment; filename="${file.nome}"`);
    response.send(file.buffer);
  }

  @Screen("prestadores", "view")
  @Get("prestadores")
  async people(@Req() request: AuthedRequest, @Res() response: Response) {
    const file = await this.operations.exportPeople(actorOf(request));
    response.setHeader("Content-Type", file.mime);
    response.setHeader("Content-Disposition", `attachment; filename="${file.nome}"`);
    response.send(file.buffer);
  }
}

@ApiTags("operacao")
@Controller()
export class WorkspaceController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Get("workspace")
  workspace(@Req() request: AuthedRequest) {
    return this.operations.workspace(actorOf(request));
  }

  @Screen("escalas", "edit")
  @Post("schedules")
  schedule(@Body(new ZodPipe(z.object({ processoId: z.number().int().positive(), data: iso, entrada: hour, saida: hour, localId: z.number().int().positive().optional(), atividade: z.string().max(120).optional() }))) body: { processoId: number; data: string; entrada: string; saida: string; localId?: number; atividade?: string }, @Req() request: AuthedRequest) {
    return this.operations.createSchedule(actorOf(request), body);
  }

  @Screen("escalas", "edit")
  @Post("schedules/:id/cancel")
  cancel(@Param("id") id: string, @Body(new ZodPipe(z.object({ motivo: z.string().min(3).max(255) }))) body: { motivo: string }, @Req() request: AuthedRequest) {
    return this.operations.cancelSchedule(actorOf(request), numericId(id), body.motivo);
  }

  @Post("notifications/read")
  readNotifications(@Body(new ZodPipe(z.object({ ids: z.array(z.number().int().positive()).max(100).optional() }))) body: { ids?: number[] }, @Req() request: AuthedRequest) {
    return this.operations.markNotifications(actorOf(request), body.ids ?? []);
  }

  @Screen("perfis", "edit")
  @Post("profiles")
  createProfile(@Body(new ZodPipe(z.object({ nome: z.string().min(3).max(80), descricao: z.string().max(255).optional(), cor: z.number().int().min(0).max(8), telas: z.array(z.string()).max(30) }))) body: { nome: string; descricao?: string; cor: number; telas: string[] }, @Req() request: AuthedRequest) {
    return this.operations.createProfile(actorOf(request), body);
  }

  @Screen("usuarios", "edit")
  @Post("users")
  createUser(@Body(new ZodPipe(z.object({ nome: z.string().min(5).max(150), email: z.string().email(), perfilId: z.number().int().positive(), localId: z.number().int().positive().nullable().optional(), cor: z.number().int().min(0).max(8) }))) body: { nome: string; email: string; perfilId: number; localId?: number | null; cor: number }, @Req() request: AuthedRequest) {
    return this.operations.createUser(actorOf(request), body);
  }

  @Screen("usuarios", "edit")
  @Patch("users/:id")
  userActive(@Param("id") id: string, @Body(new ZodPipe(z.object({ ativo: z.boolean() }))) body: { ativo: boolean }, @Req() request: AuthedRequest) {
    return this.operations.setUserActive(actorOf(request), numericId(id), body.ativo);
  }

  @Screen("perfis", "edit")
  @Patch("profiles/:id/screens")
  screens(@Param("id") id: string, @Body(new ZodPipe(z.object({ telas: z.array(z.string()).max(30) }))) body: { telas: string[] }, @Req() request: AuthedRequest) {
    return this.operations.setProfileScreens(actorOf(request), numericId(id), body.telas);
  }
}

@ApiTags("publico")
@Controller()
export class PublicController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Public()
  @Get("health")
  health() {
    return { status: "ok" };
  }

  @Public()
  @Get("public/documentos/:codigo")
  async verify(@Param("codigo") codigo: string, @Res() response: Response) {
    const data = await this.operations.verify(codigo);
    response.status(data ? 200 : 404).json(data ?? { autentico: false });
  }
}

export { verificationHtml };
