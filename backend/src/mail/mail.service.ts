import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { escapeHtml } from "../domain/text";
import { PrismaService } from "../prisma.service";
import { deliver, type MailConfig } from "./deliver";
import { openSecret, seal } from "./secret";

const providerLabel: Record<string, string> = {
  Resend: "Resend",
  SendGrid: "SendGrid",
  Mailgun: "Mailgun",
  Amazon_SES: "Amazon SES",
  Postmark: "Postmark",
  Brevo: "Brevo",
  Mailjet: "Mailjet",
  SparkPost: "SparkPost",
  Elastic_Email: "Elastic Email",
};

type ProviderKey = "Resend" | "SendGrid" | "Mailgun" | "Amazon_SES" | "Postmark" | "Brevo" | "Mailjet" | "SparkPost" | "Elastic_Email";

export type MailDraft = { to: string; subject: string; text: string; template?: string };

export type EmailSetup = {
  metodo: "API" | "SMTP";
  provedor: string | null;
  smtpHost: string;
  smtpPorta: number;
  smtpUsuario: string;
  smtpSenha?: string;
  smtpSeguranca: "Nenhuma" | "SSL" | "TLS";
  remetenteEmail: string;
  remetenteNome: string;
  dominio: string;
  assinatura: string;
  resumoDiario: boolean;
  lembreteEscala: boolean;
  relatorioMensal: boolean;
  apiKey?: string;
};

@Injectable()
export class MailService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async send(draft: MailDraft) {
    const config = await this.load();
    const text = [draft.text.trim(), config?.assinatura].filter(Boolean).join("\n\n");
    const row = await this.prisma.email_envios.create({
      data: { destinatario: draft.to.slice(0, 150), assunto: draft.subject.slice(0, 200), modelo: draft.template?.slice(0, 60) ?? null, corpo: text, status: "Na_fila" },
    });
    await this.dispatch(row.id);
    const saved = await this.prisma.email_envios.findUnique({ where: { id: row.id } });
    return { id: Number(row.id), status: saved?.status ?? "Na_fila" };
  }

  async flush() {
    const waiting = await this.prisma.email_envios.findMany({ where: { status: "Na_fila", corpo: { not: null } }, orderBy: { id: "asc" }, take: 20 });
    for (const row of waiting) await this.dispatch(row.id);
  }

  async publicConfig() {
    const row = await this.prisma.config_email.findUnique({ where: { id: 1 } });
    if (!row) return null;
    return {
      metodo: row.metodo,
      provedor: row.provedor ? providerLabel[row.provedor] ?? row.provedor : null,
      smtpHost: row.smtp_host ?? "",
      smtpPorta: row.smtp_porta ?? 587,
      smtpUsuario: row.smtp_usuario ?? "",
      smtpSeguranca: row.smtp_seguranca ?? "TLS",
      remetenteEmail: row.remetente_email,
      remetenteNome: row.remetente_nome,
      dominio: row.dominio_envio ?? "",
      assinatura: row.assinatura ?? "",
      resumoDiario: row.resumo_diario,
      lembreteEscala: row.lembrete_escala,
      relatorioMensal: row.relatorio_mensal,
      apiKey: reveal(row.api_key_cifrada) ?? "",
      smtpSenha: reveal(row.smtp_senha_cifrada) ?? "",
      temChave: Boolean(row.api_key_cifrada),
      temSenhaSmtp: Boolean(row.smtp_senha_cifrada),
    };
  }

  async save(input: EmailSetup) {
    const current = await this.prisma.config_email.findUnique({ where: { id: 1 } });
    const data: Prisma.config_emailUncheckedUpdateInput = {
      metodo: input.metodo,
      provedor: input.metodo === "API" ? providerKey(input.provedor) : null,
      smtp_host: input.smtpHost || null,
      smtp_porta: input.smtpPorta,
      smtp_usuario: input.smtpUsuario || null,
      smtp_seguranca: input.smtpSeguranca,
      remetente_email: input.remetenteEmail,
      remetente_nome: input.remetenteNome,
      dominio_envio: input.dominio || null,
      assinatura: input.assinatura || null,
      resumo_diario: input.resumoDiario,
      lembrete_escala: input.lembreteEscala,
      relatorio_mensal: input.relatorioMensal,
      atualizado_em: new Date(),
    };
    if (input.apiKey) data.api_key_cifrada = seal(input.apiKey);
    if (input.smtpSenha) data.smtp_senha_cifrada = seal(input.smtpSenha);
    if (current) await this.prisma.config_email.update({ where: { id: 1 }, data });
    else {
      const created: Prisma.config_emailUncheckedCreateInput = {
        id: 1,
        metodo: input.metodo,
        provedor: input.metodo === "API" ? providerKey(input.provedor) : null,
        smtp_host: input.smtpHost || null,
        smtp_porta: input.smtpPorta,
        smtp_usuario: input.smtpUsuario || null,
        smtp_seguranca: input.smtpSeguranca,
        remetente_email: input.remetenteEmail,
        remetente_nome: input.remetenteNome,
        dominio_envio: input.dominio || null,
        assinatura: input.assinatura || null,
        resumo_diario: input.resumoDiario,
        lembrete_escala: input.lembreteEscala,
        relatorio_mensal: input.relatorioMensal,
      };
      if (input.apiKey) created.api_key_cifrada = seal(input.apiKey);
      if (input.smtpSenha) created.smtp_senha_cifrada = seal(input.smtpSenha);
      await this.prisma.config_email.create({ data: created });
    }
    await this.flush();
    return this.publicConfig();
  }

  private async dispatch(id: bigint) {
    const row = await this.prisma.email_envios.findUnique({ where: { id } });
    if (!row?.corpo || row.status === "Enviado") return;
    const config = await this.load();
    if (!config || !ready(config)) {
      await this.prisma.email_envios.update({ where: { id }, data: { erro: "Aguardando configuração de envio." } });
      return;
    }
    const html = `<div>${escapeHtml(row.corpo).replaceAll("\n", "<br>")}</div>`;
    try {
      await deliver(config, { to: row.destinatario, subject: row.assunto, text: row.corpo, html });
      await this.prisma.email_envios.update({ where: { id }, data: { status: "Enviado", enviado_em: new Date(), erro: null } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio.";
      await this.prisma.email_envios.update({ where: { id }, data: { status: "Falhou", erro: message.slice(0, 500) } });
    }
  }

  private async load(): Promise<(MailConfig & { assinatura: string }) | null> {
    const row = await this.prisma.config_email.findUnique({ where: { id: 1 } });
    if (!row) return null;
    return {
      metodo: row.metodo,
      provedor: row.provedor ? providerLabel[row.provedor] ?? null : null,
      apiKey: reveal(row.api_key_cifrada),
      smtpHost: row.smtp_host,
      smtpPorta: row.smtp_porta,
      smtpUsuario: row.smtp_usuario,
      smtpSenha: reveal(row.smtp_senha_cifrada),
      smtpSeguranca: row.smtp_seguranca ?? "TLS",
      remetenteEmail: row.remetente_email,
      remetenteNome: row.remetente_nome,
      dominio: row.dominio_envio,
      assinatura: row.assinatura ?? "",
    };
  }
}

function providerKey(label: string | null): ProviderKey | null {
  if (!label) return null;
  const found = Object.entries(providerLabel).find(([, value]) => value === label);
  return (found?.[0] as ProviderKey | undefined) ?? null;
}

function reveal(value: Buffer | Uint8Array | null): string | null {
  if (!value) return null;
  try {
    return openSecret(value);
  } catch {
    return null;
  }
}

function ready(config: MailConfig): boolean {
  if (config.metodo === "SMTP") return Boolean(config.smtpHost && config.smtpPorta);
  return Boolean(config.apiKey && config.provedor);
}
