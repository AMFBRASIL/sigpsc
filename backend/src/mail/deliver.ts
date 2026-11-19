import nodemailer from "nodemailer";

export type MailConfig = {
  metodo: "API" | "SMTP";
  provedor: string | null;
  apiKey: string | null;
  smtpHost: string | null;
  smtpPorta: number | null;
  smtpUsuario: string | null;
  smtpSenha: string | null;
  smtpSeguranca: "Nenhuma" | "SSL" | "TLS";
  remetenteEmail: string;
  remetenteNome: string;
  dominio: string | null;
};

export type MailBody = { to: string; subject: string; text: string; html: string };

export async function deliver(config: MailConfig, message: MailBody): Promise<void> {
  if (config.metodo === "SMTP") {
    if (!config.smtpHost || !config.smtpPorta) throw new Error("Servidor SMTP incompleto.");
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPorta,
      secure: config.smtpSeguranca === "SSL",
      requireTLS: config.smtpSeguranca === "TLS",
      auth: config.smtpUsuario ? { user: config.smtpUsuario, pass: config.smtpSenha ?? "" } : undefined,
    });
    await transport.sendMail({
      from: `"${config.remetenteNome.replace(/"/g, "")}" <${config.remetenteEmail}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return;
  }
  if (!config.apiKey) throw new Error("Chave de API ausente.");
  if (config.provedor === "Amazon SES") throw new Error("Amazon SES deve ser configurado pelo método SMTP.");
  await postApi(config, message);
}

async function postApi(config: MailConfig, message: MailBody): Promise<void> {
  const from = `${config.remetenteNome} <${config.remetenteEmail}>`;
  const key = config.apiKey ?? "";
  const calls: Record<string, () => Promise<Response>> = {
    Resend: () => fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }) }),
    SendGrid: () => fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: message.to }] }], from: { email: config.remetenteEmail, name: config.remetenteNome }, subject: message.subject, content: [{ type: "text/plain", value: message.text }, { type: "text/html", value: message.html }] }) }),
    Mailgun: () => {
      const body = new URLSearchParams({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
      return fetch(`https://api.mailgun.net/v3/${config.dominio ?? "sigpsc.gov.br"}/messages`, { method: "POST", headers: { authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` }, body });
    },
    Postmark: () => fetch("https://api.postmarkapp.com/email", { method: "POST", headers: { "x-postmark-server-token": key, "content-type": "application/json" }, body: JSON.stringify({ From: from, To: message.to, Subject: message.subject, TextBody: message.text, HtmlBody: message.html }) }),
    Brevo: () => fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": key, "content-type": "application/json" }, body: JSON.stringify({ sender: { email: config.remetenteEmail, name: config.remetenteNome }, to: [{ email: message.to }], subject: message.subject, textContent: message.text, htmlContent: message.html }) }),
    Mailjet: () => {
      const [pub, secret] = key.split(":");
      return fetch("https://api.mailjet.com/v3.1/send", { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${pub}:${secret ?? ""}`).toString("base64")}`, "content-type": "application/json" }, body: JSON.stringify({ Messages: [{ From: { Email: config.remetenteEmail, Name: config.remetenteNome }, To: [{ Email: message.to }], Subject: message.subject, TextPart: message.text, HTMLPart: message.html }] }) });
    },
    SparkPost: () => fetch("https://api.sparkpost.com/api/v1/transmissions", { method: "POST", headers: { authorization: key, "content-type": "application/json" }, body: JSON.stringify({ recipients: [{ address: message.to }], content: { from, subject: message.subject, text: message.text, html: message.html } }) }),
    "Elastic Email": () => fetch("https://api.elasticemail.com/v4/emails", { method: "POST", headers: { "x-elasticemail-apikey": key, "content-type": "application/json" }, body: JSON.stringify({ Recipients: [{ Email: message.to }], Content: { From: config.remetenteEmail, Subject: message.subject, Body: [{ ContentType: "PlainText", Content: message.text }, { ContentType: "HTML", Content: message.html }] } }) }),
  };
  const call = config.provedor ? calls[config.provedor] : undefined;
  if (!call) throw new Error("Provedor de e-mail não suportado.");
  const response = await call();
  if (!response.ok) throw new Error(`O provedor recusou o envio (${response.status}).`);
}
