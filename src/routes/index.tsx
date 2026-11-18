import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserCheck, Clock, Hourglass, AlertTriangle, FileWarning, Plus, ArrowRight, CalendarCheck, UserX } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { horasPorLocal, horasPorMes, prestadores, registrosPendentes } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/")({ head: () => meta("Dashboard", "Indicadores de horas, prestadores e pendências da prestação de serviços à comunidade."), component: Dashboard });

const kpis = [
  { label: "Prestadores cadastrados", value: "128", hint: "+6 este mês", icon: Users, tone: "bg-info-soft text-info" },
  { label: "Prestadores ativos", value: "84", hint: "65% do total", icon: UserCheck, tone: "bg-success-soft text-success" },
  { label: "Horas validadas", value: "12.480", hint: "de 18.900 previstas", icon: Clock, tone: "bg-info-soft text-info" },
  { label: "Pendentes de validação", value: "33h", hint: "5 registros", icon: Hourglass, tone: "bg-warning-soft text-warning" },
  { label: "Ausências no mês", value: "9", hint: "3 sem justificativa", icon: UserX, tone: "bg-danger-soft text-danger" },
  { label: "Relatórios com prazo", value: "4", hint: "próximos 7 dias", icon: FileWarning, tone: "bg-warning-soft text-warning" },
];
const situacao = [
  { name: "Ativos", value: 84, color: "var(--chart-1)" }, { name: "Concluídos", value: 31, color: "var(--chart-3)" },
  { name: "Suspensos", value: 7, color: "var(--chart-5)" }, { name: "Pendentes", value: 6, color: "var(--chart-4)" },
];
const tip = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 } };

function Dashboard() {
  const proximos = prestadores.filter((p) => p.situacao === "Ativo").map((p) => ({ ...p, pct: Math.round((p.horasCumpridas / p.horasTotais) * 100) })).sort((a, b) => b.pct - a.pct).slice(0, 4);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Bom dia, Ana" subtitle="Quarta-feira, 18 de novembro de 2026 · Unidade Central"
        actions={<><Button variant="outline" asChild><Link to="/relatorios">Relatórios</Link></Button><Button asChild><Link to="/registro"><Plus />Registrar horas</Link></Button></>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4 shadow-card">
            <div className={`mb-3 grid size-9 place-items-center rounded-lg ${k.tone}`}><k.icon className="size-[18px]" /></div>
            <p className="font-display text-2xl font-bold">{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground/80">{k.label}</p>
            <p className="text-[11px] text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Horas realizadas por mês" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer><AreaChart data={horasPorMes} margin={{ left: -20, right: 8 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip {...tip} /><Area type="monotone" dataKey="horas" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Prestadores por situação">
          <div className="h-44"><ResponsiveContainer><PieChart><Pie data={situacao} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={3}>{situacao.map((s) => <Cell key={s.name} fill={s.color} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{situacao.map((s) => <div key={s.name} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.name}<span className="ml-auto font-semibold">{s.value}</span></div>)}</div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Horas por local de prestação">
          <div className="h-60"><ResponsiveContainer><BarChart data={horasPorLocal} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" hide /><YAxis type="category" dataKey="local" width={100} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
            <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="horas" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={16} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Próximos da conclusão" action={<Link to="/prestadores" className="text-xs font-semibold text-primary">Ver todos</Link>}>
          <ul className="space-y-4">{proximos.map((p) => (
            <li key={p.id}><Link to="/prestadores/$id" params={{ id: p.id }} className="block">
              <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{p.nome}</span><span className="font-semibold text-primary">{p.pct}%</span></div>
              <Progress value={p.pct} className="h-2" /><p className="mt-1 text-[11px] text-muted-foreground">{p.horasCumpridas}h de {p.horasTotais}h · {p.local}</p>
            </Link></li>))}</ul>
        </Panel>
        <Panel title="Aguardando validação" action={<Link to="/validacao" className="text-xs font-semibold text-primary">Validar</Link>}>
          <ul className="divide-y">{registrosPendentes.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <div className="grid size-9 place-items-center rounded-lg bg-warning-soft text-warning"><CalendarCheck className="size-4" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.prestador}</p><p className="truncate text-xs text-muted-foreground">{r.data} · {r.atividade}</p></div>
              <span className="text-sm font-semibold">{r.horas}h</span>
            </li>))}</ul>
        </Panel>
      </div>

      <div className="mt-4 rounded-xl bg-gradient-hero p-5 text-sidebar-foreground shadow-card sm:flex sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-sidebar-primary" /><div><p className="font-display font-semibold">2 prestadores sem registro há mais de 30 dias</p><p className="text-sm text-sidebar-foreground/70">Recomenda-se comunicar a vara responsável.</p></div></div>
        <Button variant="secondary" className="mt-4 sm:mt-0" asChild><Link to="/notificacoes">Ver alertas<ArrowRight /></Link></Button>
      </div>
    </div>
  );
}
