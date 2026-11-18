import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileText, Phone, Scale, MapPin, User, Calendar, Pencil, FileDown } from "lucide-react";
import { Panel } from "@/components/sigpsc/page-header";
import { StatusBadge } from "@/components/sigpsc/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentos, prestadores, registrosPendentes } from "@/lib/mock-data";

export const Route = createFileRoute("/prestadores/$id")({
  loader: ({ params }) => { const p = prestadores.find((x) => x.id === params.id); if (!p) throw notFound(); return p; },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.nome ?? "Prestador"} | SIGPSC` }, { name: "description", content: "Perfil completo do prestador: dados judiciais, horas e documentos." }, { property: "og:title", content: "Perfil do prestador | SIGPSC" }, { property: "og:description", content: "Perfil completo do prestador." }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" }] }),
  component: Perfil,
});

function Info({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-medium">{value}</p></div></div>;
}

function Perfil() {
  const p = Route.useLoaderData();
  const pct = Math.round((p.horasCumpridas / p.horasTotais) * 100);
  const restante = p.horasTotais - p.horasCumpridas;
  const iniciais = p.nome.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/prestadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Prestadores</Link>
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="h-20 bg-gradient-hero sm:h-24" />
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="-mt-10 grid size-20 place-items-center rounded-2xl border-4 border-card bg-primary font-display text-2xl font-bold text-primary-foreground">{iniciais}</div>
          <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-xl font-bold sm:text-2xl">{p.nome}</h1><StatusBadge status={p.situacao} /></div><p className="font-mono text-xs text-muted-foreground">{p.processo}</p></div>
          <div className="flex gap-2"><Button variant="outline" size="sm"><Pencil />Editar</Button><Button size="sm"><FileDown />Relatório</Button></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Horas determinadas", `${p.horasTotais}h`], ["Horas validadas", `${p.horasCumpridas}h`], ["Pendentes", `${p.horasPendentes}h`], ["Saldo restante", `${restante}h`]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>))}
      </div>
      <div className="mt-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Cumprimento da pena</span><span className="font-bold text-primary">{pct}%</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} /></div>
      </div>

      <Tabs defaultValue="dados" className="mt-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto"><TabsTrigger value="dados">Dados</TabsTrigger><TabsTrigger value="horas">Histórico de horas</TabsTrigger><TabsTrigger value="docs">Documentos</TabsTrigger></TabsList>
        <TabsContent value="dados" className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Dados pessoais"><div className="grid gap-4 sm:grid-cols-2"><Info icon={User} label="CPF" value={p.cpf} /><Info icon={Phone} label="Telefone" value={p.telefone} /><Info icon={Calendar} label="Último registro" value={p.ultimoRegistro} /><Info icon={MapPin} label="Local de prestação" value={p.local} /></div></Panel>
          <Panel title="Dados judiciais"><div className="grid gap-4 sm:grid-cols-2"><Info icon={Scale} label="Vara" value={p.vara} /><Info icon={MapPin} label="Comarca" value={p.comarca} /><Info icon={Calendar} label="Início autorizado" value={p.inicio} /><Info icon={Calendar} label="Prazo judicial" value={p.prazo} /><Info icon={User} label="Supervisor" value={p.supervisor} /><Info icon={FileText} label="Limite semanal" value="12h por semana" /></div></Panel>
        </TabsContent>
        <TabsContent value="horas" className="mt-4"><Panel>
          <ul className="divide-y">{[...registrosPendentes, ...registrosPendentes].slice(0, 6).map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.atividade}</p><p className="text-xs text-muted-foreground">{r.data} · {r.entrada}–{r.saida} · {r.local}</p></div><span className="font-semibold">{r.horas}h</span><StatusBadge status={i < 1 ? "Pendente" : "Concluído"} /></li>))}</ul>
        </Panel></TabsContent>
        <TabsContent value="docs" className="mt-4"><Panel>
          <ul className="divide-y">{documentos.slice(0, 4).map((d) => (<li key={d.id} className="flex items-center gap-3 py-3"><FileText className="size-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.nome}</p><p className="text-xs text-muted-foreground">{d.tipo} · {d.data}</p></div><StatusBadge status={d.status} /></li>))}</ul>
        </Panel></TabsContent>
      </Tabs>
    </div>
  );
}
