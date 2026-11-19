import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import type { Actor } from "./auth/actor";
import { allows } from "./auth/actor";
import { AppError } from "./common/app-error";
import { audit } from "./audit";
import { formatHm, timeForDb } from "./domain/time";
import { seal } from "./mail/secret";
import { MailService, type EmailSetup } from "./mail/mail.service";
import { PrismaService } from "./prisma.service";

const localTipo = { Escola: "Escola", "Saúde": "Sa_de", "Assistência social": "Assist_ncia_social", Ambiental: "Ambiental", Biblioteca: "Biblioteca", Outro: "Outro" } as const;
const tipoLabel: Record<string, string> = { Escola: "Escola", Sa_de: "Saúde", Assist_ncia_social: "Assistência social", Ambiental: "Ambiental", Biblioteca: "Biblioteca", Outro: "Outro" };
type LocalInput = { nome: string; tipo: keyof typeof localTipo; endereco: string; cidade: string; cep: string; vagas: number; responsavel: string; telefone: string; email: string; abre: string; fecha: string; ativo: boolean; atividades?: string[] };
function localData(input: LocalInput) {
  return {
    nome: input.nome.trim(),
    tipo: localTipo[input.tipo],
    endereco: input.endereco || null,
    cidade: input.cidade || null,
    cep: input.cep || null,
    vagas: input.vagas,
    responsavel: input.responsavel || null,
    telefone: input.telefone || null,
    email: input.email || null,
    abre_as: input.abre ? timeForDb(input.abre) : null,
    fecha_as: input.fecha ? timeForDb(input.fecha) : null,
    ativo: input.ativo,
    atualizado_em: new Date(),
  };
}
const datePatterns = ["DD/MM/AAAA", "MM/DD/AAAA", "AAAA-MM-DD"] as const;
export type DatePattern = (typeof datePatterns)[number];
function datePattern(value: string): DatePattern {
  return datePatterns.includes(value as DatePattern) ? (value as DatePattern) : "DD/MM/AAAA";
}

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(MailService) private readonly mail: MailService) {}

  async bundle(actor: Actor) {
    const [email, user, prefs, locais, auditRows, chaves, integracoes, automacoes, geral] = await Promise.all([
      allows(actor, "configuracoes", "view") ? this.mail.publicConfig() : Promise.resolve(null),
      this.prisma.usuarios.findUnique({ where: { id: actor.id } }),
      this.prisma.usuario_preferencias.findUnique({ where: { usuario_id: actor.id } }),
      this.prisma.locais.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      allows(actor, "configuracoes", "view") ? this.prisma.auditoria.findMany({ orderBy: { id: "desc" }, take: 30, include: { usuarios: true } }) : Promise.resolve([]),
      allows(actor, "configuracoes", "view") ? this.prisma.api_chaves.findMany({ where: { revogada_em: null }, orderBy: { id: "desc" }, take: 5 }) : Promise.resolve([]),
      allows(actor, "configuracoes", "view") ? this.prisma.integracoes.findMany() : Promise.resolve([]),
      this.prisma.automacoes.findMany({ orderBy: { id: "asc" } }),
      this.prisma.config_geral.findMany(),
    ]);
    const value = (key: string) => geral.find((item) => item.chave === key)?.valor ?? "";
    return {
      email,
      perfil: { nome: user?.nome ?? "", email: user?.email ?? "", telefone: user?.telefone ?? "", cargo: user?.cargo ?? "" },
      preferencias: prefs,
      locais: locais.map((item) => ({ id: item.id, nome: item.nome, tipo: item.tipo, endereco: item.endereco, cidade: item.cidade, vagas: item.vagas })),
      auditoria: auditRows.map((item) => ({ id: String(item.id), quando: item.criado_em.toISOString(), quem: item.usuarios?.nome ?? "Sistema", acao: item.descricao || item.acao })),
      chaves: chaves.map((item) => ({ id: item.id, ambiente: item.ambiente, prefixo: item.prefixo, ultimos4: item.ultimos4 })),
      integracoes: integracoes.map((item) => ({ id: item.id, servico: item.servico, conectado: item.conectado, conta: item.conta ?? "", enviarHoras: item.enviar_horas, receberProcessos: item.receber_processos, sincronizarEscalas: item.sincronizar_escalas })),
      automacoes: automacoes.map((item) => ({ id: item.id, nome: item.nome, ativo: item.ativo, gatilho: item.gatilho, acao: item.acao })),
      seguranca: {
        doisFatores: value("seguranca.dois_fatores_obrigatorio") === "true",
        inatividade: value("seguranca.sessao_inatividade_min") || "30",
        tentativas: value("seguranca.max_tentativas_login") || "5",
        ocultarCpf: value("privacidade.ocultar_cpf") !== "false",
      },
      sistema: { formatoData: datePattern(value("sistema.formato_data")) },
    };
  }

  saveEmail(input: EmailSetup) {
    return this.mail.save(input);
  }

  async sendTest(actor: Actor, email: string) {
    const result = await this.mail.send({ to: email.trim().toLowerCase(), subject: "Teste de envio do SIGPSC", template: "teste", text: "Esta é uma mensagem de teste da configuração de e-mail do SIGPSC." });
    if (result.status === "Falhou") throw new AppError(502, "O provedor recusou o envio. Confira a configuração.", "EMAIL");
    if (result.status !== "Enviado") throw new AppError(409, "O e-mail ficou na fila porque o envio ainda não está configurado.", "EMAIL_FILA");
    return result;
  }

  async saveProfile(actor: Actor, input: { nome: string; email: string; telefone: string; cargo: string }) {
    await this.prisma.usuarios.update({ where: { id: actor.id }, data: { nome: input.nome.trim(), email: input.email.trim().toLowerCase(), telefone: input.telefone || null, cargo: input.cargo || null } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "PERFIL_PROPRIO", entidade: "usuarios", entidadeId: actor.id, ip: actor.ip });
    return { ok: true };
  }

  async savePreferences(actor: Actor, input: { tema: "Claro" | "Escuro" | "Sistema"; densidade: "Confort_vel" | "Padr_o" | "Compacta"; animacoes: boolean; idioma: string; fuso: string; formatoData: string; notifSistema: boolean; notifEmail: boolean; notifWhatsapp: boolean; notifSom: boolean; alertaValidacao: boolean; alertaFaltas: boolean; alertaPrazos: boolean; resumoSemanal: boolean }) {
    const data = {
      tema: input.tema,
      densidade: input.densidade,
      animacoes: input.animacoes,
      idioma: input.idioma,
      fuso_horario: input.fuso,
      formato_data: input.formatoData,
      notif_sistema: input.notifSistema,
      notif_email: input.notifEmail,
      notif_whatsapp: input.notifWhatsapp,
      notif_som: input.notifSom,
      alerta_validacao: input.alertaValidacao,
      alerta_faltas: input.alertaFaltas,
      alerta_prazos: input.alertaPrazos,
      resumo_semanal: input.resumoSemanal,
    };
    await this.prisma.usuario_preferencias.upsert({ where: { usuario_id: actor.id }, create: { usuario_id: actor.id, ...data }, update: data });
    return { ok: true };
  }

  async saveSecurity(actor: Actor, input: { doisFatores: boolean; inatividade: string; tentativas: string; ocultarCpf: boolean }) {
    const pairs = [
      ["seguranca.dois_fatores_obrigatorio", input.doisFatores ? "true" : "false"],
      ["seguranca.sessao_inatividade_min", input.inatividade],
      ["seguranca.max_tentativas_login", input.tentativas],
      ["privacidade.ocultar_cpf", input.ocultarCpf ? "true" : "false"],
    ] as const;
    for (const [chave, valor] of pairs) {
      await this.prisma.config_geral.upsert({ where: { chave }, create: { chave, valor, atualizado_por: actor.id }, update: { valor, atualizado_por: actor.id, atualizado_em: new Date() } });
    }
    await audit(this.prisma, { usuarioId: actor.id, acao: "CONFIG_SEGURANCA", entidade: "config_geral", ip: actor.ip });
    return { ok: true };
  }

  async saveSystem(actor: Actor, formatoData: DatePattern) {
    await this.prisma.config_geral.upsert({
      where: { chave: "sistema.formato_data" },
      create: { chave: "sistema.formato_data", valor: formatoData, descricao: "Padrão de data dos cadastros", atualizado_por: actor.id },
      update: { valor: formatoData, atualizado_por: actor.id, atualizado_em: new Date() },
    });
    await audit(this.prisma, { usuarioId: actor.id, acao: "CONFIG_SISTEMA", entidade: "config_geral", descricao: formatoData, ip: actor.ip });
    return { ok: true, formatoData };
  }

  async listLocations() {
    const rows = await this.prisma.locais.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { processos: { where: { situacao: "Ativo" } } } }, atividades: { where: { ativo: true }, orderBy: { nome: "asc" } } },
    });
    return rows.map((item) => ({
      id: item.id,
      nome: item.nome,
      tipo: tipoLabel[item.tipo] ?? item.tipo,
      endereco: item.endereco ?? "",
      cidade: item.cidade ?? "",
      cep: item.cep ?? "",
      vagas: item.vagas,
      responsavel: item.responsavel ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      abre: item.abre_as ? formatHm(item.abre_as) : "",
      fecha: item.fecha_as ? formatHm(item.fecha_as) : "",
      ativo: item.ativo,
      prestadores: item._count.processos,
      atividades: item.atividades.map((activity) => activity.nome),
    }));
  }

  async createLocal(actor: Actor, input: LocalInput) {
    const created = await this.prisma.locais.create({ data: localData(input) });
    if (input.atividades) await this.syncActivities(created.id, input.atividades);
    await audit(this.prisma, { usuarioId: actor.id, acao: "LOCAL_CRIADO", entidade: "locais", entidadeId: created.id, ip: actor.ip });
    return { id: created.id };
  }

  async updateLocal(actor: Actor, id: number, input: LocalInput) {
    if (!Number.isInteger(id)) throw new AppError(400, "Local inválido.", "LOCAL");
    const current = await this.prisma.locais.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Local não encontrado.", "NAO_ENCONTRADO");
    await this.prisma.locais.update({ where: { id }, data: localData(input) });
    if (input.atividades) await this.syncActivities(id, input.atividades);
    await audit(this.prisma, { usuarioId: actor.id, acao: "LOCAL_ALTERADO", entidade: "locais", entidadeId: id, ip: actor.ip });
    return { id };
  }

  private async syncActivities(localId: number, names: string[]) {
    const wanted: string[] = [];
    for (const raw of names) {
      const nome = raw.trim().replace(/\s+/g, " ");
      if (nome.length < 2 || wanted.some((item) => item.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0)) continue;
      wanted.push(nome);
    }
    const current = await this.prisma.atividades.findMany({ where: { local_id: localId } });
    const keep = new Set<number>();
    for (const nome of wanted) {
      const found = current.find((item) => item.nome.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0);
      if (found) {
        keep.add(found.id);
        if (!found.ativo || found.nome !== nome) await this.prisma.atividades.update({ where: { id: found.id }, data: { ativo: true, nome } });
      } else {
        const created = await this.prisma.atividades.create({ data: { local_id: localId, nome, ativo: true } });
        keep.add(created.id);
      }
    }
    const drop = current.filter((item) => item.ativo && !keep.has(item.id)).map((item) => item.id);
    if (drop.length) await this.prisma.atividades.updateMany({ where: { id: { in: drop } }, data: { ativo: false } });
  }

  async createKey(actor: Actor, ambiente: "Produ__o" | "Teste") {
    const secret = `sk_${ambiente === "Teste" ? "test" : "live"}_${randomBytes(24).toString("base64url")}`;
    const created = await this.prisma.api_chaves.create({
      data: {
        nome: ambiente === "Teste" ? "Homologação" : "Produção",
        ambiente,
        prefixo: secret.slice(0, 12),
        ultimos4: secret.slice(-4),
        chave_hash: createHash("sha256").update(secret).digest("hex"),
        criado_por: actor.id,
      },
    });
    await audit(this.prisma, { usuarioId: actor.id, acao: "API_CHAVE", entidade: "api_chaves", entidadeId: created.id, ip: actor.ip });
    return { id: created.id, chave: secret };
  }

  async saveIntegration(actor: Actor, id: number, input: { conta: string; token?: string; enviarHoras: boolean; receberProcessos: boolean; sincronizarEscalas: boolean; conectado: boolean }) {
    const data: Prisma.integracoesUncheckedUpdateInput = {
      conta: input.conta || null,
      conectado: input.conectado,
      enviar_horas: input.enviarHoras,
      receber_processos: input.receberProcessos,
      sincronizar_escalas: input.sincronizarEscalas,
      atualizado_em: new Date(),
    };
    if (input.token) data.token_cifrado = seal(input.token);
    await this.prisma.integracoes.update({ where: { id }, data });
    await audit(this.prisma, { usuarioId: actor.id, acao: "INTEGRACAO", entidade: "integracoes", entidadeId: id, ip: actor.ip });
    return { ok: true };
  }

  async setAutomation(actor: Actor, id: number, ativo: boolean) {
    await this.prisma.automacoes.update({ where: { id }, data: { ativo } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "AUTOMACAO", entidade: "automacoes", entidadeId: id, depois: { ativo }, ip: actor.ip });
    return { ok: true };
  }
}
