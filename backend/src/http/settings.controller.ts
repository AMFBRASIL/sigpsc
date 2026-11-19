import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Screen } from "../auth/actor";
import { actorOf, type AuthedRequest } from "../auth/auth.guard";
import { ZodPipe } from "../common/http";
import { SettingsService } from "../settings.service";

const localSchema = z.object({
  nome: z.string().min(3).max(150),
  tipo: z.enum(["Escola", "Saúde", "Assistência social", "Ambiental", "Biblioteca", "Outro"]),
  endereco: z.string().max(200).optional(),
  cidade: z.string().max(100).optional(),
  cep: z.string().max(9).optional(),
  vagas: z.number().int().min(0).max(500),
  responsavel: z.string().max(120).optional(),
  telefone: z.string().max(20).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  abre: z.string().regex(/^$|^\d{2}:\d{2}$/).optional(),
  fecha: z.string().regex(/^$|^\d{2}:\d{2}$/).optional(),
  ativo: z.boolean().optional(),
  atividades: z.array(z.string().trim().min(2).max(120)).max(40).optional(),
});
type LocalBody = z.infer<typeof localSchema>;
function localInput(body: LocalBody, ativo = true) {
  return { nome: body.nome, tipo: body.tipo, endereco: body.endereco ?? "", cidade: body.cidade ?? "", cep: body.cep ?? "", vagas: body.vagas, responsavel: body.responsavel ?? "", telefone: body.telefone ?? "", email: body.email ?? "", abre: body.abre ?? "", fecha: body.fecha ?? "", ativo: body.ativo ?? ativo, ...(body.atividades ? { atividades: body.atividades } : {}) };
}

const emailSchema = z.object({
  metodo: z.enum(["API", "SMTP"]),
  provedor: z.string().max(40).nullable().optional(),
  smtpHost: z.string().max(150).optional(),
  smtpPorta: z.number().int().min(1).max(65535).optional(),
  smtpUsuario: z.string().max(150).optional(),
  smtpSenha: z.string().max(200).optional(),
  smtpSeguranca: z.enum(["Nenhuma", "SSL", "TLS"]).optional(),
  remetenteEmail: z.string().email(),
  remetenteNome: z.string().min(2).max(150),
  dominio: z.string().max(150).optional(),
  assinatura: z.string().max(2000).optional(),
  resumoDiario: z.boolean(),
  lembreteEscala: z.boolean(),
  relatorioMensal: z.boolean(),
  apiKey: z.string().max(300).optional(),
});

@ApiTags("configuracoes")
@Controller("settings")
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  bundle(@Req() request: AuthedRequest) {
    return this.settings.bundle(actorOf(request));
  }

  @Screen("configuracoes", "edit")
  @Post("email")
  saveEmail(@Body(new ZodPipe(emailSchema)) body: z.infer<typeof emailSchema>) {
    return this.settings.saveEmail({
      metodo: body.metodo,
      provedor: body.provedor ?? null,
      smtpHost: body.smtpHost ?? "",
      smtpPorta: body.smtpPorta ?? 587,
      smtpUsuario: body.smtpUsuario ?? "",
      smtpSeguranca: body.smtpSeguranca ?? "TLS",
      remetenteEmail: body.remetenteEmail,
      remetenteNome: body.remetenteNome,
      dominio: body.dominio ?? "",
      assinatura: body.assinatura ?? "",
      resumoDiario: body.resumoDiario,
      lembreteEscala: body.lembreteEscala,
      relatorioMensal: body.relatorioMensal,
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
      ...(body.smtpSenha ? { smtpSenha: body.smtpSenha } : {}),
    });
  }

  @Screen("configuracoes", "edit")
  @Post("email/test")
  testEmail(@Body(new ZodPipe(z.object({ email: z.string().email("Informe um e-mail válido.") }))) body: { email: string }, @Req() request: AuthedRequest) {
    return this.settings.sendTest(actorOf(request), body.email);
  }

  @Patch("profile")
  profile(@Body(new ZodPipe(z.object({ nome: z.string().min(5).max(150), email: z.string().email(), telefone: z.string().max(20).optional(), cargo: z.string().max(80).optional() }))) body: { nome: string; email: string; telefone?: string; cargo?: string }, @Req() request: AuthedRequest) {
    return this.settings.saveProfile(actorOf(request), { nome: body.nome, email: body.email, telefone: body.telefone ?? "", cargo: body.cargo ?? "" });
  }

  @Patch("preferences")
  preferences(@Body(new ZodPipe(z.object({
    tema: z.enum(["Claro", "Escuro", "Sistema"]),
    densidade: z.enum(["Confort_vel", "Padr_o", "Compacta"]),
    animacoes: z.boolean(),
    idioma: z.string().max(10),
    fuso: z.string().max(50),
    formatoData: z.string().max(20),
    notifSistema: z.boolean(),
    notifEmail: z.boolean(),
    notifWhatsapp: z.boolean(),
    notifSom: z.boolean(),
    alertaValidacao: z.boolean(),
    alertaFaltas: z.boolean(),
    alertaPrazos: z.boolean(),
    resumoSemanal: z.boolean(),
  }))) body: { tema: "Claro" | "Escuro" | "Sistema"; densidade: "Confort_vel" | "Padr_o" | "Compacta"; animacoes: boolean; idioma: string; fuso: string; formatoData: string; notifSistema: boolean; notifEmail: boolean; notifWhatsapp: boolean; notifSom: boolean; alertaValidacao: boolean; alertaFaltas: boolean; alertaPrazos: boolean; resumoSemanal: boolean }, @Req() request: AuthedRequest) {
    return this.settings.savePreferences(actorOf(request), body);
  }

  @Screen("configuracoes", "edit")
  @Patch("system")
  system(@Body(new ZodPipe(z.object({ formatoData: z.enum(["DD/MM/AAAA", "MM/DD/AAAA", "AAAA-MM-DD"]) }))) body: { formatoData: "DD/MM/AAAA" | "MM/DD/AAAA" | "AAAA-MM-DD" }, @Req() request: AuthedRequest) {
    return this.settings.saveSystem(actorOf(request), body.formatoData);
  }

  @Screen("configuracoes", "edit")
  @Patch("security")
  security(@Body(new ZodPipe(z.object({ doisFatores: z.boolean(), inatividade: z.string().regex(/^\d{1,3}$/), tentativas: z.string().regex(/^\d{1,2}$/), ocultarCpf: z.boolean() }))) body: { doisFatores: boolean; inatividade: string; tentativas: string; ocultarCpf: boolean }, @Req() request: AuthedRequest) {
    return this.settings.saveSecurity(actorOf(request), body);
  }

  @Get("locations")
  locations() {
    return this.settings.listLocations();
  }

  @Screen("configuracoes", "edit")
  @Post("locations")
  location(@Body(new ZodPipe(localSchema)) body: LocalBody, @Req() request: AuthedRequest) {
    return this.settings.createLocal(actorOf(request), localInput(body));
  }

  @Screen("configuracoes", "edit")
  @Patch("locations/:id")
  updateLocation(@Param("id") id: string, @Body(new ZodPipe(localSchema)) body: LocalBody, @Req() request: AuthedRequest) {
    return this.settings.updateLocal(actorOf(request), Number(id), localInput(body, true));
  }

  @Screen("configuracoes", "edit")
  @Post("keys")
  key(@Body(new ZodPipe(z.object({ ambiente: z.enum(["Produção", "Teste"]) }))) body: { ambiente: "Produção" | "Teste" }, @Req() request: AuthedRequest) {
    return this.settings.createKey(actorOf(request), body.ambiente === "Teste" ? "Teste" : "Produ__o");
  }

  @Screen("configuracoes", "edit")
  @Patch("integrations/:id")
  integration(@Param("id") id: string, @Body(new ZodPipe(z.object({ conta: z.string().max(150).optional(), token: z.string().max(500).optional(), enviarHoras: z.boolean(), receberProcessos: z.boolean(), sincronizarEscalas: z.boolean(), conectado: z.boolean() }))) body: { conta?: string; token?: string; enviarHoras: boolean; receberProcessos: boolean; sincronizarEscalas: boolean; conectado: boolean }, @Req() request: AuthedRequest) {
    return this.settings.saveIntegration(actorOf(request), Number(id), { conta: body.conta ?? "", enviarHoras: body.enviarHoras, receberProcessos: body.receberProcessos, sincronizarEscalas: body.sincronizarEscalas, conectado: body.conectado, ...(body.token ? { token: body.token } : {}) });
  }

  @Screen("configuracoes", "edit")
  @Patch("automations/:id")
  automation(@Param("id") id: string, @Body(new ZodPipe(z.object({ ativo: z.boolean() }))) body: { ativo: boolean }, @Req() request: AuthedRequest) {
    return this.settings.setAutomation(actorOf(request), Number(id), body.ativo);
  }
}
