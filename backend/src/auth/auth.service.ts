import { Inject, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppError } from "../common/app-error";
import { audit } from "../audit";
import { PrismaService } from "../prisma.service";
import type { Actor } from "./actor";
import { MailService } from "../mail/mail.service";
import { createTotpSecret, hashPassword, randomToken, sha256, totpUri, verifyPassword, verifyTotp } from "./password";

const COOKIE = "sigpsc_session";

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(MailService) private readonly mail: MailService) {}

  async login(input: { email: string; senha: string; codigo?: string | undefined }, req: Request, res: Response) {
    const login = input.email.trim().toLowerCase();
    const user = await this.prisma.usuarios.findFirst({
      where: { OR: [{ email: login }, { cpf: login }] },
      include: { perfis: { include: { perfil_telas: true } }, locais: true },
    });
    const ip = req.ip ?? null;
    if (!user || !user.ativo) {
      await audit(this.prisma, { acao: "LOGIN_FALHOU", entidade: "usuarios", descricao: "Credencial rejeitada.", ip });
      throw new AppError(401, "E-mail ou senha inválidos.", "CREDENCIAL");
    }
    if (user.bloqueado_ate && user.bloqueado_ate.getTime() > Date.now()) {
      throw new AppError(429, "Acesso temporariamente bloqueado. Tente novamente mais tarde.", "BLOQUEADO");
    }
    const ok = await verifyPassword(input.senha, user.senha_hash);
    if (!ok) {
      const max = Number((await this.setting("seguranca.max_tentativas_login")) ?? "5");
      const attempts = user.tentativas_login + 1;
      const lockMinutes = attempts >= max ? Math.min(60, 2 ** (attempts - max + 1)) : 0;
      await this.prisma.usuarios.update({
        where: { id: user.id },
        data: {
          tentativas_login: Math.min(255, attempts),
          bloqueado_ate: lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : user.bloqueado_ate,
        },
      });
      await audit(this.prisma, { usuarioId: user.id, acao: "LOGIN_FALHOU", entidade: "usuarios", entidadeId: user.id, descricao: "Senha rejeitada.", ip });
      throw new AppError(401, "E-mail ou senha inválidos.", "CREDENCIAL");
    }
    if (user.dois_fatores) {
      if (!input.codigo || !user.dois_fatores_seg || !verifyTotp(user.dois_fatores_seg, input.codigo)) {
        throw new AppError(401, "Informe o código de verificação.", "MFA_REQUIRED");
      }
    }
    await this.prisma.usuarios.update({
      where: { id: user.id },
      data: { tentativas_login: 0, bloqueado_ate: null, ultimo_acesso: new Date() },
    });
    const token = randomToken(32);
    const hours = Number(process.env.SESSION_HOURS ?? "12");
    const inactivity = Number((await this.setting("seguranca.sessao_inatividade_min")) ?? "30");
    await this.prisma.sessoes.create({
      data: {
        id: sha256(token),
        usuario_id: user.id,
        ip: ip?.slice(0, 45) ?? null,
        user_agent: req.get("user-agent")?.slice(0, 255) ?? null,
        expira_em: new Date(Date.now() + hours * 3_600_000),
        ultimo_uso: new Date(),
      },
    });
    this.writeCookie(res, token, hours);
    await audit(this.prisma, { usuarioId: user.id, acao: "LOGIN", entidade: "usuarios", entidadeId: user.id, descricao: "Sessão iniciada.", ip });
    const mfaRequired = (await this.setting("seguranca.dois_fatores_obrigatorio")) === "true" && !user.dois_fatores;
    return { user: this.present(user), mfaEnrollmentRequired: mfaRequired, inactivityMinutes: inactivity };
  }

  async logout(actor: Actor | undefined, req: Request, res: Response) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (token) {
      await this.prisma.sessoes.updateMany({ where: { id: sha256(token) }, data: { revogada: true } });
    }
    res.clearCookie(COOKIE, { path: "/" });
    if (actor) await audit(this.prisma, { usuarioId: actor.id, acao: "LOGOUT", entidade: "usuarios", entidadeId: actor.id, ip: actor.ip });
    return { ok: true };
  }

  async actorFromRequest(req: Request): Promise<Actor | null> {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) return null;
    const session = await this.prisma.sessoes.findUnique({
      where: { id: sha256(token) },
      include: { usuarios: { include: { perfis: { include: { perfil_telas: true } }, locais: true } } },
    });
    if (!session || session.revogada || !session.usuarios || !session.usuarios.ativo) return null;
    if (session.expira_em.getTime() < Date.now()) return null;
    const inactivity = Number((await this.setting("seguranca.sessao_inatividade_min")) ?? "30");
    if (Date.now() - session.ultimo_uso.getTime() > inactivity * 60_000) {
      await this.prisma.sessoes.update({ where: { id: session.id }, data: { revogada: true } });
      return null;
    }
    await this.prisma.sessoes.update({ where: { id: session.id }, data: { ultimo_uso: new Date() } });
    return this.toActor(session.usuarios, req.ip ?? null);
  }

  async forgot(email: string, ip: string | null) {
    const user = await this.prisma.usuarios.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (user?.ativo) {
      const token = randomToken(32);
      await this.prisma.redefinicoes_senha.create({
        data: { email: user.email, token_hash: sha256(token), expira_em: new Date(Date.now() + 30 * 60_000) },
      });
      const link = `${process.env.PUBLIC_APP_URL ?? "http://localhost:8082"}/login?redefinir=${token}`;
      await this.mail.send({
        to: user.email,
        subject: "Redefinição de senha do SIGPSC",
        template: "senha",
        text: `Recebemos um pedido para redefinir sua senha.\n\nAbra este endereço em até 30 minutos:\n${link}\n\nSe você não pediu, ignore esta mensagem.`,
      });
      await audit(this.prisma, { usuarioId: user.id, acao: "SENHA_ESQUECI", entidade: "usuarios", entidadeId: user.id, ip });
    }
    return { ok: true };
  }

  async reset(token: string, senha: string, ip: string | null) {
    const row = await this.prisma.redefinicoes_senha.findFirst({
      where: { token_hash: sha256(token), usado_em: null, expira_em: { gt: new Date() } },
      orderBy: { id: "desc" },
    });
    if (!row) throw new AppError(400, "Link de redefinição inválido ou expirado.", "TOKEN");
    const user = await this.prisma.usuarios.findUnique({ where: { email: row.email } });
    if (!user) throw new AppError(400, "Link de redefinição inválido ou expirado.", "TOKEN");
    await this.prisma.$transaction([
      this.prisma.usuarios.update({
        where: { id: user.id },
        data: { senha_hash: await hashPassword(senha), tentativas_login: 0, bloqueado_ate: null },
      }),
      this.prisma.redefinicoes_senha.update({ where: { id: row.id }, data: { usado_em: new Date() } }),
      this.prisma.sessoes.updateMany({ where: { usuario_id: user.id }, data: { revogada: true } }),
    ]);
    await audit(this.prisma, { usuarioId: user.id, acao: "SENHA_REDEFINIDA", entidade: "usuarios", entidadeId: user.id, ip });
    return { ok: true };
  }

  async changePassword(actor: Actor, atual: string, nova: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { id: actor.id } });
    if (!user || !(await verifyPassword(atual, user.senha_hash))) throw new AppError(400, "Senha atual inválida.", "SENHA");
    await this.prisma.usuarios.update({ where: { id: actor.id }, data: { senha_hash: await hashPassword(nova) } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "SENHA_ALTERADA", entidade: "usuarios", entidadeId: actor.id, ip: actor.ip });
    return { ok: true };
  }

  async setupMfa(actor: Actor) {
    const secret = createTotpSecret();
    await this.prisma.usuarios.update({ where: { id: actor.id }, data: { dois_fatores_seg: secret, dois_fatores: false } });
    return { uri: totpUri(secret, actor.email) };
  }

  async confirmMfa(actor: Actor, codigo: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { id: actor.id } });
    if (!user?.dois_fatores_seg || !verifyTotp(user.dois_fatores_seg, codigo)) {
      throw new AppError(400, "Código de verificação inválido.", "MFA");
    }
    await this.prisma.usuarios.update({ where: { id: actor.id }, data: { dois_fatores: true } });
    await audit(this.prisma, { usuarioId: actor.id, acao: "MFA_ATIVADO", entidade: "usuarios", entidadeId: actor.id, ip: actor.ip });
    return { ok: true };
  }

  present(user: { id: number; nome: string; email: string; perfis: { nome: string }; locais: { nome: string } | null }) {
    return { id: user.id, nome: user.nome, email: user.email, perfil: user.perfis.nome, local: user.locais?.nome ?? null };
  }

  private toActor(user: {
    id: number;
    nome: string;
    email: string;
    perfil_id: number;
    local_id: number | null;
    perfis: { nome: string; perfil_telas: { tela_id: string; pode_ver: boolean; pode_editar: boolean }[] };
    locais: { nome: string } | null;
  }, ip: string | null): Actor {
    const screens: Actor["screens"] = {};
    for (const screen of user.perfis.perfil_telas) {
      screens[screen.tela_id] = { view: screen.pode_ver, edit: screen.pode_editar };
    }
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfilId: user.perfil_id,
      perfilNome: user.perfis.nome,
      localId: user.local_id,
      localNome: user.locais?.nome ?? null,
      administrador: user.perfis.nome === "Administrador",
      screens,
      ip,
    };
  }

  private writeCookie(res: Response, token: string, hours: number) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: hours * 3_600_000,
    });
  }

  private async setting(key: string): Promise<string | null> {
    const row = await this.prisma.config_geral.findUnique({ where: { chave: key } });
    return row?.valor ?? null;
  }
}
