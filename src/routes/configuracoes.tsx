import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronRight, User, Palette, Bell, Languages, Users, ShieldCheck, MapPin, Zap, History, Mail, Plug, KeyRound, Database, Lock, Search, Copy, Plus, Download, Cloud, Globe, FileText, MessageSquare, Server, CheckCircle2, Send, Briefcase, Sun, Moon, Monitor, LayoutGrid, List, Rows3, AlertTriangle, Clock, CalendarClock, CalendarDays, Settings2, Workflow, Filter, Scale, FileSignature, FlaskConical, Webhook, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { WizardDialog, ChoiceCard, type WizardStep } from "@/components/sigpsc/wizard-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { api, downloadFile } from "@/lib/api";
import { formatIso, normalizeDatePattern } from "@/lib/date-format";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/configuracoes")({ head: () => meta("Configurações", "Preferências do sistema: conta, equipe, e-mail, automações, API e dados."), component: Config });

type Item = { id: string; title: string; hint: string; icon: LucideIcon; tag?: string; link?: "/usuarios" | "/perfis" | "/locais" };
const groups: { name: string; items: Item[] }[] = [
  { name: "Conta", items: [
    { id: "perfil", title: "Meu perfil", hint: "Informações pessoais e cargo", icon: User },
    { id: "aparencia", title: "Aparência", hint: "Tema, densidade e visual", icon: Palette },
    { id: "notif", title: "Notificações", hint: "Alertas, sons e canais", icon: Bell },
    { id: "idioma", title: "Idioma e região", hint: "Idioma, fuso e formatos", icon: Languages },
  ] },
  { name: "Sistema", items: [
    { id: "sistema", title: "Sistema", hint: "Padrão de data dos cadastros", icon: Settings2 },
  ] },
  { name: "Equipe e operação", items: [
    { id: "usuarios", title: "Usuários", hint: "Contas, convites e status", icon: Users, link: "/usuarios" },
    { id: "perfis", title: "Perfis de acesso", hint: "Permissões por tela", icon: ShieldCheck, link: "/perfis" },
    { id: "locais", title: "Locais de prestação", hint: "Unidades, endereços e vagas", icon: MapPin, link: "/locais" },
    { id: "auto", title: "Automações", hint: "Regras, gatilhos e lembretes", icon: Zap, tag: "Beta" },
    { id: "audit", title: "Auditoria", hint: "Histórico de ações da equipe", icon: History },
  ] },
  { name: "Plataforma", items: [
    { id: "email", title: "E-mail", hint: "Remetente, assinatura e resumos", icon: Mail },
    { id: "integ", title: "Integrações", hint: "Tribunal, WhatsApp, Google", icon: Plug, tag: "2 ativas" },
    { id: "api", title: "API e Webhooks", hint: "Chaves de acesso e endpoints", icon: KeyRound },
  ] },
  { name: "Avançado", items: [
    { id: "dados", title: "Dados e backup", hint: "Exportação, retenção e cópias", icon: Database },
    { id: "seg", title: "Segurança e privacidade", hint: "2 etapas, sessões e LGPD", icon: Lock },
  ] },
];

const Row = ({ label, hint, on = false, setOn }: { label: string; hint?: string; on?: boolean; setOn?: (value: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-card"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div><Switch {...(setOn ? { checked: on, onCheckedChange: setOn } : { defaultChecked: on })} aria-label={label} /></div>
);
const Field = ({ label, value = "", onChange, placeholder, type = "text" }: { label: string; value?: string; onChange?: (value: string) => void; placeholder?: string; type?: string }) => (
  <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><Input type={type} value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder} className="h-12" /></label>
);
function SecretField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className="relative block">
        <Input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" className="h-12 pr-12" />
        <button type="button" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground" aria-label={visible ? "Ocultar credencial" : "Mostrar credencial"} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
      </span>
    </label>
  );
}
const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
const Q = ({ children }: { children: ReactNode }) => <p className="font-display text-lg font-semibold">{children}</p>;
const muted = "bg-muted text-foreground";

type Opt = { t: string; h: string; i: LucideIcon };
function Pick({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) {
  return <Grid>{options.map((o) => <ChoiceCard key={o.t} selected={value === o.t} onClick={() => onChange(o.t)} icon={o.i} title={o.t} hint={o.h} color={muted} />)}</Grid>;
}
function LocalPick({ options }: { options: Opt[] }) { const [v, setV] = useState(options[0]!.t); return <Pick options={options} value={v} onChange={setV} />; }

const providers: Opt[] = [
  { t: "Resend", h: "API moderna, ótima entregabilidade", i: Zap }, { t: "SendGrid", h: "Plataforma robusta para alto volume", i: Cloud },
  { t: "Mailgun", h: "Validação e rotas de e-mail", i: Globe }, { t: "Amazon SES", h: "Baixo custo e grande escala", i: Database },
  { t: "Postmark", h: "Transacionais ultrarrápidos", i: FileText }, { t: "Brevo", h: "E-mail, SMS e automação", i: MessageSquare },
];
const Review = ({ rows }: { rows: [string, string][] }) => (
  <div className="divide-y rounded-xl border bg-card shadow-card">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 p-4 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>)}</div>
);

type Step = WizardStep & { body: () => ReactNode };
type Flow = { headline: string; finish?: string; steps: Step[] };

function useFlows() {
  const [formato, setFormato] = useState("DD/MM/AAAA");
  const [method, setMethod] = useState("API");
  const [provider, setProvider] = useState("Resend");
  const [theme, setTheme] = useState("Claro");
  const [mail, setMail] = useState({ host: "", porta: "587", usuario: "", senha: "", chave: "", remetente: "nao-responda@sigpsc.gov.br", nome: "SIGPSC — Central de Penas", dominio: "sigpsc.gov.br", assinatura: "Central de Penas e Medidas Alternativas", resumo: true, lembrete: true, mensal: false, teste: "" });
  const set = (key: keyof typeof mail) => (value: string) => setMail((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    void api<{ sistema: { formatoData: string }; email: { metodo: string; provedor: string | null; smtpHost: string; smtpPorta: number; smtpUsuario: string; smtpSenha: string; apiKey: string; remetenteEmail: string; remetenteNome: string; dominio: string; assinatura: string; resumoDiario: boolean; lembreteEscala: boolean; relatorioMensal: boolean } | null; perfil: { email: string } }>("/api/v1/settings").then((data) => {
      if (data.sistema?.formatoData) setFormato(data.sistema.formatoData);
      if (!data.email) return;
      setMethod(data.email.metodo);
      if (data.email.provedor) setProvider(data.email.provedor);
      setMail((current) => ({ ...current, host: data.email?.smtpHost ?? "", porta: String(data.email?.smtpPorta ?? 587), usuario: data.email?.smtpUsuario ?? "", senha: data.email?.smtpSenha ?? "", chave: data.email?.apiKey ?? "", remetente: data.email?.remetenteEmail ?? current.remetente, nome: data.email?.remetenteNome ?? current.nome, dominio: data.email?.dominio ?? "", assinatura: data.email?.assinatura ?? "", resumo: data.email?.resumoDiario ?? true, lembrete: data.email?.lembreteEscala ?? true, mensal: data.email?.relatorioMensal ?? false, teste: current.teste || data.perfil.email }));
    }).catch(() => undefined);
  }, []);
  const saveEmail = () => api("/api/v1/settings/email", { method: "POST", body: JSON.stringify({ metodo: method, provedor: provider, smtpHost: mail.host, smtpPorta: Number(mail.porta || 587), smtpUsuario: mail.usuario, smtpSenha: mail.senha || undefined, smtpSeguranca: "TLS", remetenteEmail: mail.remetente, remetenteNome: mail.nome, dominio: mail.dominio, assinatura: mail.assinatura, resumoDiario: mail.resumo, lembreteEscala: mail.lembrete, relatorioMensal: mail.mensal, apiKey: mail.chave || undefined }) });
  const saveSystem = () => api("/api/v1/settings/system", { method: "PATCH", body: JSON.stringify({ formatoData: formato }) });
  const testEmail = () => {
    const email = mail.teste.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Informe o e-mail que deve receber o teste."); return; }
    void api("/api/v1/settings/email/test", { method: "POST", body: JSON.stringify({ email }) }).then(() => toast.success(`E-mail de teste enviado para ${email}`)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível enviar"));
  };
  const flows = {
    sistema: { headline: "Defina o padrão de data do sistema.", finish: "Salvar", steps: [
      { title: "Formato", hint: "Como as datas aparecem", icon: CalendarDays, body: () => <><Q>Qual padrão de data usar?</Q><p className="text-sm text-muted-foreground">Vale para o cadastro de prestadores, o registro de horas e as escalas.</p><Pick value={formato} onChange={setFormato} options={[{ t: "DD/MM/AAAA", h: "Ex.: 19/11/2026", i: CalendarDays }, { t: "MM/DD/AAAA", h: "Ex.: 11/19/2026", i: CalendarDays }, { t: "AAAA-MM-DD", h: "Ex.: 2026-11-19", i: CalendarDays }]} /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Formato", formato], ["Exemplo", formatIso("2026-11-19", normalizeDatePattern(formato))]]} /> },
    ] },
    email: { headline: "Conecte o envio de e-mails.", finish: "Salvar", steps: [
      { title: "Método", hint: "API ou SMTP", icon: Mail, body: () => <><Q>Como você quer enviar?</Q><Pick value={method} onChange={setMethod} options={[{ t: "API", h: "Conecte um serviço de envio usando uma chave de API", i: Zap }, { t: "SMTP", h: "Use seu servidor com host, porta e credenciais", i: Server }]} /></> },
      { title: "Provedor", hint: "Serviço de envio", icon: Cloud, body: () => method === "API" ? <><Q>Qual provedor de API?</Q><Pick value={provider} onChange={setProvider} options={providers} /></> : <><Q>Servidor SMTP</Q><Grid><Field label="Host" value={mail.host} onChange={set("host")} placeholder="smtp.exemplo.gov.br" /><Field label="Porta" value={mail.porta} onChange={set("porta")} /></Grid><Field label="Usuário" value={mail.usuario} onChange={set("usuario")} placeholder="usuario@exemplo.gov.br" /><SecretField label="Senha" value={mail.senha} onChange={set("senha")} placeholder="••••••••" /></> },
      { title: "Credenciais", hint: "Dados de acesso", icon: KeyRound, body: () => <><Q>Dados de acesso</Q>{method === "API" && <SecretField label="Chave de API" value={mail.chave} onChange={set("chave")} placeholder="key-xxxxxxxxxxxx" />}<Grid><Field label="E-mail remetente" value={mail.remetente} onChange={set("remetente")} /><Field label="Nome do remetente" value={mail.nome} onChange={set("nome")} /></Grid><Field label="Domínio de envio" value={mail.dominio} onChange={set("dominio")} /></> },
      { title: "Envios automáticos", hint: "Resumos e assinatura", icon: FileText, body: () => <><Q>O que enviar automaticamente?</Q><Row label="Resumo diário para a equipe" hint="Todos os dias às 8h" on={mail.resumo} setOn={(resumo) => setMail((current) => ({ ...current, resumo }))} /><Row label="Lembrete de escala ao prestador" hint="1 dia antes" on={mail.lembrete} setOn={(lembrete) => setMail((current) => ({ ...current, lembrete }))} /><Row label="Relatório mensal ao juízo" on={mail.mensal} setOn={(mensal) => setMail((current) => ({ ...current, mensal }))} /><Field label="Assinatura" value={mail.assinatura} onChange={set("assinatura")} /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <><Review rows={[["Método", method], [method === "API" ? "Provedor" : "Servidor", method === "API" ? provider : mail.host || "SMTP próprio"], ["Remetente", mail.remetente], ["Domínio", mail.dominio]]} /><Field label="E-mail para o teste" type="email" value={mail.teste} onChange={set("teste")} placeholder="destino@exemplo.gov.br" /><Button type="button" variant="outline" onClick={() => void testEmail()}><Send />Enviar e-mail de teste</Button></> },
    ] },
    perfil: { headline: "Mantenha seus dados em dia.", finish: "Salvar", steps: [
      { title: "Identidade", hint: "Nome e contato", icon: User, body: () => <><Field label="Nome completo" value="Ana Souza" /><Grid><Field label="E-mail" value="ana.souza@sigpsc.gov.br" /><Field label="Telefone" value="(11) 98888-1234" /></Grid></> },
      { title: "Cargo", hint: "Função na equipe", icon: Briefcase, body: () => <><Q>Qual sua função?</Q><LocalPick options={[{ t: "Coordenadora", h: "Gestão geral da central", i: ShieldCheck }, { t: "Técnica", h: "Acompanhamento dos prestadores", i: Users }, { t: "Supervisora de local", h: "Validação no local", i: MapPin }, { t: "Jurídico", h: "Documentos e prazos", i: FileText }]} /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Nome", "Ana Souza"], ["E-mail", "ana.souza@sigpsc.gov.br"], ["Cargo", "Coordenadora"]]} /> },
    ] },
    aparencia: { headline: "Deixe o sistema com a sua cara.", finish: "Aplicar", steps: [
      { title: "Tema", hint: "Claro ou escuro", icon: Palette, body: () => <><Q>Qual tema prefere?</Q><Pick value={theme} onChange={setTheme} options={[{ t: "Claro", h: "Fundo claro, ideal de dia", i: Sun }, { t: "Escuro", h: "Menos brilho, ideal à noite", i: Moon }, { t: "Sistema", h: "Segue o seu aparelho", i: Monitor }]} /></> },
      { title: "Densidade", hint: "Espaço entre itens", icon: LayoutGrid, body: () => <><Q>Como exibir as listas?</Q><LocalPick options={[{ t: "Confortável", h: "Mais espaço e leitura fácil", i: LayoutGrid }, { t: "Padrão", h: "Equilíbrio entre espaço e conteúdo", i: List }, { t: "Compacta", h: "Mais itens na tela", i: Rows3 }]} /><Row label="Animações" on /></> },
      { title: "Revisão", hint: "Confirme e aplique", icon: CheckCircle2, body: () => <Review rows={[["Tema", theme], ["Animações", "Ligadas"]]} /> },
    ] },
    notif: { headline: "Receba só o que importa.", finish: "Salvar", steps: [
      { title: "Canais", hint: "Onde avisar", icon: Bell, body: () => <><Q>Por onde quer ser avisado?</Q><Row label="No sistema" on /><Row label="E-mail" on /><Row label="WhatsApp" /><Row label="Sons no navegador" /></> },
      { title: "Alertas", hint: "O que avisar", icon: AlertTriangle, body: () => <><Row label="Horas aguardando validação" hint="Aviso diário às 8h" on /><Row label="Faltas de prestadores" on /><Row label="Prazos judiciais próximos" hint="7 dias antes" on /><Row label="Resumo semanal" on /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Canais", "Sistema e e-mail"], ["Alertas ativos", "4"]]} /> },
    ] },
    idioma: { headline: "Idioma, horário e formatos.", finish: "Salvar", steps: [
      { title: "Idioma", hint: "Língua do sistema", icon: Languages, body: () => <LocalPick options={[{ t: "Português (Brasil)", h: "pt-BR", i: Globe }, { t: "Español", h: "es", i: Globe }, { t: "English", h: "en", i: Globe }]} /> },
      { title: "Região", hint: "Fuso e calendário", icon: Clock, body: () => <><Field label="Fuso horário" value="America/Sao_Paulo (UTC-3)" /><Field label="Primeiro dia da semana" value="Segunda-feira" /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Idioma", "Português (Brasil)"], ["Fuso", "UTC-3"], ["Data", "Definida em Sistema"]]} /> },
    ] },
    auto: { headline: "Automatize o dia a dia.", finish: "Ativar", steps: [
      { title: "Gatilho", hint: "Quando acontece", icon: Zap, body: () => <><Q>Quando a automação deve rodar?</Q><LocalPick options={[{ t: "Antes da escala", h: "Lembrete ao prestador", i: CalendarClock }, { t: "Falta registrada", h: "Após faltas seguidas", i: AlertTriangle }, { t: "Horas aprovadas", h: "Assim que validar", i: CheckCircle2 }, { t: "Todo mês", h: "No dia 1º", i: Clock }]} /></> },
      { title: "Ação", hint: "O que fazer", icon: Workflow, body: () => <><Q>O que fazer?</Q><LocalPick options={[{ t: "Enviar WhatsApp", h: "Mensagem ao prestador", i: MessageSquare }, { t: "Enviar e-mail", h: "Para equipe ou juízo", i: Mail }, { t: "Criar notificação", h: "Aviso no sistema", i: Bell }, { t: "Gerar relatório", h: "PDF para o processo", i: FileText }]} /></> },
      { title: "Regras ativas", hint: "Ligue ou desligue", icon: List, body: () => <><Row label="Lembrete de presença" hint="WhatsApp 1 dia antes da escala" on /><Row label="Alerta de 3 faltas seguidas" on /><Row label="Relatório mensal automático" /><Row label="Aviso de conclusão" hint="Quando faltar 10% das horas" on /></> },
      { title: "Revisão", hint: "Confirme e ative", icon: CheckCircle2, body: () => <Review rows={[["Gatilho", "Antes da escala"], ["Ação", "Enviar WhatsApp"], ["Regras ativas", "3"]]} /> },
    ] },
    audit: { headline: "Tudo o que a equipe fez.", finish: "Concluir", steps: [
      { title: "Filtros", hint: "Período e pessoa", icon: Filter, body: () => <><Grid><Field label="De" type="date" value="2026-11-01" /><Field label="Até" type="date" value="2026-11-18" /></Grid><Field label="Pessoa" placeholder="Todas" /></> },
      { title: "Histórico", hint: "Ações registradas", icon: History, body: () => <>{[["18/11 10:42", "Ana Souza aprovou 4h de Carlos E. Lima"], ["18/11 09:15", "Roberto Dias registrou horas de Juliana Martins"], ["17/11 16:30", "Ana Souza emitiu relatório judicial"], ["17/11 11:02", "Marcos Teixeira alterou permissões"]].map(([t, a]) => <div key={t} className="rounded-xl border bg-card p-4 text-sm shadow-card"><p>{a}</p><p className="text-xs text-muted-foreground">{t}</p></div>)}</> },
      { title: "Exportar", hint: "Baixe o relatório", icon: Download, body: () => <Grid><Button variant="outline" className="h-14"><Download />PDF</Button><Button variant="outline" className="h-14"><Download />Excel</Button></Grid> },
    ] },
    integ: { headline: "Conecte o SIGPSC a outros sistemas.", finish: "Conectar", steps: [
      { title: "Serviço", hint: "Escolha a integração", icon: Plug, body: () => <><Q>O que deseja conectar?</Q><LocalPick options={[{ t: "Sistema do Tribunal", h: "Conectado", i: Scale }, { t: "WhatsApp", h: "Conectado", i: MessageSquare }, { t: "Google Agenda", h: "Não conectado", i: CalendarClock }, { t: "Assinatura digital", h: "Não conectado", i: FileSignature }]} /></> },
      { title: "Acesso", hint: "Credenciais", icon: KeyRound, body: () => <><Field label="Identificador da conta" placeholder="ID ou usuário" /><Field label="Token de acesso" type="password" placeholder="••••••••" /></> },
      { title: "Sincronização", hint: "O que trocar", icon: Workflow, body: () => <><Row label="Enviar horas aprovadas" on /><Row label="Receber novos processos" on /><Row label="Sincronizar escalas" /></> },
      { title: "Revisão", hint: "Confirme e conecte", icon: CheckCircle2, body: () => <Review rows={[["Serviço", "Sistema do Tribunal"], ["Sincronização", "2 itens"]]} /> },
    ] },
    api: { headline: "Chaves e webhooks da API.", finish: "Salvar", steps: [
      { title: "Ambiente", hint: "Teste ou produção", icon: Server, body: () => <><Q>Para qual ambiente?</Q><LocalPick options={[{ t: "Produção", h: "Dados reais", i: Server }, { t: "Teste", h: "Ambiente de homologação", i: FlaskConical }]} /></> },
      { title: "Chave", hint: "Acesso à API", icon: KeyRound, body: () => <div className="rounded-xl border bg-card p-4 shadow-card"><p className="text-sm font-semibold">Chave de produção</p><div className="mt-2 flex gap-2"><Input readOnly value="sk_live_••••••••••••3f9a" className="h-12 font-mono" /><Button variant="outline" size="icon" className="size-12" aria-label="Copiar" onClick={() => toast.success("Chave copiada")}><Copy /></Button></div><Button variant="outline" className="mt-3"><Plus />Gerar nova chave</Button></div> },
      { title: "Webhooks", hint: "Eventos enviados", icon: Webhook, body: () => <><Field label="Endereço do webhook" value="https://tribunal.exemplo.gov.br/webhooks/horas" /><Row label="Horas aprovadas" on /><Row label="Prestação concluída" on /><Row label="Falta registrada" /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Ambiente", "Produção"], ["Eventos", "2 ativos"]]} /> },
    ] },
    dados: { headline: "Seus dados, seguros e disponíveis.", finish: "Salvar", steps: [
      { title: "Exportação", hint: "Baixar dados", icon: Download, body: () => <Grid>{([["Prestadores (CSV)", "/api/v1/reports/prestadores", "prestadores.csv"], ["Frequência (Excel)", "/api/v1/reports/attendance?formato=xlsx", "frequencia.xlsx"], ["Documentos (ZIP)", "", ""], ["Relatórios (PDF)", "", ""]] as const).map(([label, path, file]) => <Button key={label} variant="outline" className="h-14 justify-start" onClick={() => { if (!path) { toast.error("Esta exportação ainda não está disponível neste formato."); return; } void downloadFile(path, file).then(() => toast.success(`${label} gerado`)).catch(() => toast.error("Não foi possível exportar")); }}><Download />{label}</Button>)}</Grid> },
      { title: "Backup", hint: "Cópias automáticas", icon: Database, body: () => <><Row label="Backup diário automático" hint="Último: hoje, 03:00" on /><LocalPick options={[{ t: "Diário", h: "Todos os dias às 3h", i: Clock }, { t: "Semanal", h: "Domingo às 3h", i: CalendarClock }]} /></> },
      { title: "Retenção", hint: "Por quanto tempo", icon: History, body: () => <><Field label="Retenção de registros" value="5 anos após conclusão" /><Row label="Anonimizar dados após retenção" on /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Backup", "Diário"], ["Retenção", "5 anos"]]} /> },
    ] },
    seg: { headline: "Proteja o acesso e os dados.", finish: "Salvar", steps: [
      { title: "Acesso", hint: "Login e sessões", icon: Lock, body: () => <><Row label="Autenticação em duas etapas" on /><Row label="Encerrar sessão após 30 min parado" on /><Row label="Bloquear após 5 tentativas" on /></> },
      { title: "Privacidade", hint: "LGPD", icon: ShieldCheck, body: () => <><Row label="Ocultar CPF nas listagens" on /><Row label="Exigir foto no registro de horas" /><Field label="Encarregado de dados (LGPD)" value="Marcos Teixeira" /></> },
      { title: "Revisão", hint: "Confirme e salve", icon: CheckCircle2, body: () => <Review rows={[["Duas etapas", "Ligada"], ["CPF", "Oculto"], ["Encarregado", "Marcos Teixeira"]]} /> },
    ] },
  };
  return { flows, saveEmail, saveSystem };
}

function Config() {
  const [open, setOpen] = useState<Item | null>(null);
  const [step, setStep] = useState(0);
  const { reload } = useDemo();
  const { flows, saveEmail, saveSystem } = useFlows();
  const flow = open ? flows[open.id as keyof typeof flows] : undefined;
  const [q, setQ] = useState("");
  const match = (i: Item) => `${i.title} ${i.hint}`.toLowerCase().includes(q.toLowerCase());
  const card = (i: Item) => {
    const inner = <><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><i.icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{i.title}{i.tag && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{i.tag}</span>}</span><span className="block text-sm text-muted-foreground">{i.hint}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></>;
    const cls = "flex w-full items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-ring";
    return i.link ? <Link key={i.id} to={i.link} className={cls}>{inner}</Link> : <button key={i.id} onClick={() => { setStep(0); setOpen(i); }} className={cls}>{inner}</button>;
  };
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Preferências do sistema" subtitle="Selecione uma área para configurar." />
      <div className="relative mb-8 max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar configuração" className="h-11 pl-9" /></div>
      <div className="space-y-10">
        {groups.map((g) => { const items = g.items.filter(match); if (!items.length) return null; return (
          <section key={g.name}>
            <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>{g.name}</span><span className="h-px flex-1 bg-border" /><span className="font-normal normal-case">{items.length} itens</span></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(card)}</div>
          </section>
        ); })}
      </div>
      {open && flow && <WizardDialog open onOpenChange={(o) => !o && setOpen(null)} badge={`Configurações · ${open.title}`} headline={flow.headline} steps={flow.steps} step={step} setStep={setStep} finishLabel={flow.finish ?? "Salvar"} onFinish={() => { const done = () => { toast.success(`${open.title}: alterações salvas`); setOpen(null); }; if (open.id === "email") { void saveEmail().then(done).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar")); return; } if (open.id === "sistema") { void saveSystem().then(() => reload()).then(done).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar")); return; } done(); }}>{flow.steps[step]!.body()}</WizardDialog>}
    </div>
  );
}
