import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronRight, User, Palette, Bell, Languages, Users, ShieldCheck, MapPin, Zap, History, Mail, Plug, KeyRound, Database, Lock, Search, Copy, Plus, Download, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/configuracoes")({ head: () => meta("Configurações", "Preferências do sistema: conta, equipe, e-mail, automações, API e dados."), component: Config });

type Item = { id: string; title: string; hint: string; icon: LucideIcon; tag?: string; link?: "/usuarios" | "/perfis" };
const groups: { name: string; items: Item[] }[] = [
  { name: "Conta", items: [
    { id: "perfil", title: "Meu perfil", hint: "Informações pessoais e cargo", icon: User },
    { id: "aparencia", title: "Aparência", hint: "Tema, densidade e visual", icon: Palette },
    { id: "notif", title: "Notificações", hint: "Alertas, sons e canais", icon: Bell },
    { id: "idioma", title: "Idioma e região", hint: "Idioma, fuso e formatos", icon: Languages },
  ] },
  { name: "Equipe e operação", items: [
    { id: "usuarios", title: "Usuários", hint: "Contas, convites e status", icon: Users, link: "/usuarios" },
    { id: "perfis", title: "Perfis de acesso", hint: "Permissões por tela", icon: ShieldCheck, link: "/perfis" },
    { id: "locais", title: "Locais de prestação", hint: "Unidades, endereços e vagas", icon: MapPin },
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

const Row = ({ label, hint, on = false }: { label: string; hint?: string; on?: boolean }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div><Switch defaultChecked={on} aria-label={label} /></div>
);
const Field = ({ label, value, type = "text" }: { label: string; value: string; type?: string }) => (
  <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><Input type={type} defaultValue={value} className="h-11" /></label>
);
const Choices = ({ options }: { options: string[] }) => { const [v, setV] = useState(options[0]); return <div className="grid grid-cols-3 gap-2">{options.map((o) => <button key={o} onClick={() => setV(o)} className={`rounded-xl border p-3 text-sm font-medium ${v === o ? "border-primary bg-secondary text-secondary-foreground" : "bg-card"}`}>{o}</button>)}</div>; };

const panels: Record<string, () => ReactNode> = {
  perfil: () => <><Field label="Nome" value="Ana Souza" /><Field label="E-mail" value="ana.souza@sigpsc.gov.br" /><Field label="Cargo" value="Coordenadora" /><Field label="Telefone" value="(11) 98888-1234" /></>,
  aparencia: () => <><p className="text-sm font-medium">Tema</p><Choices options={["Claro", "Escuro", "Sistema"]} /><p className="text-sm font-medium">Densidade</p><Choices options={["Confortável", "Padrão", "Compacta"]} /><Row label="Animações" on /></>,
  notif: () => <><Row label="Horas aguardando validação" hint="Aviso diário às 8h" on /><Row label="Faltas de prestadores" on /><Row label="Prazos judiciais próximos" hint="7 dias antes" on /><Row label="Sons no navegador" /><Row label="Resumo semanal por e-mail" on /></>,
  idioma: () => <><Field label="Idioma" value="Português (Brasil)" /><Field label="Fuso horário" value="America/Sao_Paulo (UTC-3)" /><Field label="Formato de data" value="DD/MM/AAAA" /></>,
  locais: () => <>{["Escola Municipal Dom Pedro", "UBS Vila Nova", "Parque Ecológico", "Centro de Assistência Social", "Biblioteca Pública"].map((l, i) => <div key={l} className="flex items-center gap-3 rounded-xl border bg-card p-4"><MapPin className="size-4 text-primary" /><span className="flex-1 text-sm font-medium">{l}</span><span className="text-xs text-muted-foreground">{4 + i} vagas</span></div>)}<Button variant="outline"><Plus />Novo local</Button></>,
  auto: () => <><Row label="Lembrete de presença" hint="WhatsApp 1 dia antes da escala" on /><Row label="Alerta de 3 faltas seguidas" hint="Notifica coordenação e jurídico" on /><Row label="Relatório mensal automático" hint="Todo dia 1º para o juízo" /><Row label="Aprovação automática" hint="Registros com foto e geolocalização" /><Row label="Aviso de conclusão" hint="Quando faltar 10% das horas" on /></>,
  audit: () => <>{[["18/11 10:42", "Ana Souza aprovou 4h de Carlos E. Lima"], ["18/11 09:15", "Roberto Dias registrou horas de Juliana Martins"], ["17/11 16:30", "Ana Souza emitiu relatório judicial"], ["17/11 11:02", "Marcos Teixeira alterou permissões"]].map(([t, a]) => <div key={t} className="rounded-xl border bg-card p-4 text-sm"><p>{a}</p><p className="text-xs text-muted-foreground">{t}</p></div>)}<Button variant="outline"><Download />Exportar histórico</Button></>,
  email: () => <><Choices options={["Padrão", "SMTP", "API"]} /><Field label="Nome do remetente" value="SIGPSC — Central de Penas" /><Field label="E-mail de envio" value="nao-responda@sigpsc.gov.br" /><Field label="Assinatura" value="Central de Penas e Medidas Alternativas" /><Row label="Resumo diário para a equipe" on /><Button variant="outline" onClick={() => toast.success("E-mail de teste enviado (demonstração)")}>Enviar e-mail de teste</Button></>,
  integ: () => <>{[["Sistema do Tribunal", true], ["WhatsApp", true], ["Google Agenda", false], ["Assinatura digital", false]].map(([n, on]) => <Row key={n as string} label={n as string} hint={on ? "Conectado" : "Não conectado"} on={on as boolean} />)}</>,
  api: () => <><div className="rounded-xl border bg-card p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Chave de produção</p><div className="mt-2 flex gap-2"><Input readOnly value="sk_live_••••••••••••3f9a" className="font-mono" /><Button variant="outline" size="icon" aria-label="Copiar" onClick={() => toast.success("Chave copiada")}><Copy /></Button></div></div><Field label="Webhook de horas aprovadas" value="https://tribunal.exemplo.gov.br/webhooks/horas" /><Row label="Enviar evento ao aprovar horas" on /><Row label="Enviar evento ao concluir prestação" on /><Button variant="outline"><Plus />Gerar nova chave</Button></>,
  dados: () => <><Button variant="outline" className="justify-start"><Download />Exportar prestadores (CSV)</Button><Button variant="outline" className="justify-start"><Download />Exportar frequência (Excel)</Button><Field label="Retenção de registros" value="5 anos após conclusão" /><Row label="Backup diário automático" hint="Último: hoje, 03:00" on /><Row label="Anonimizar dados após retenção" on /></>,
  seg: () => <><Row label="Autenticação em duas etapas" on /><Row label="Ocultar CPF nas listagens" on /><Row label="Exigir foto no registro de horas" /><Row label="Encerrar sessão após 30 min parado" on /><Field label="Encarregado de dados (LGPD)" value="Marcos Teixeira" /></>,
};

function Config() {
  const [open, setOpen] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const match = (i: Item) => `${i.title} ${i.hint}`.toLowerCase().includes(q.toLowerCase());
  const card = (i: Item) => {
    const inner = <><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><i.icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{i.title}{i.tag && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{i.tag}</span>}</span><span className="block text-sm text-muted-foreground">{i.hint}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></>;
    const cls = "flex w-full items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-ring";
    return i.link ? <Link key={i.id} to={i.link} className={cls}>{inner}</Link> : <button key={i.id} onClick={() => setOpen(i)} className={cls}>{inner}</button>;
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
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          {open && <>
            <SheetHeader className="border-b p-6 text-left"><div className="mb-2 grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground"><open.icon className="size-5" /></div><SheetTitle className="font-display text-xl">{open.title}</SheetTitle><SheetDescription>{open.hint}</SheetDescription></SheetHeader>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">{panels[open.id]?.()}</div>
            <div className="flex justify-end gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button variant="ghost" onClick={() => setOpen(null)}>Cancelar</Button><Button onClick={() => { toast.success(`${open.title}: alterações salvas`); setOpen(null); }}>Salvar</Button></div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
