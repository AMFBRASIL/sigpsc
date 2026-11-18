import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Clock, MapPin, User, FileText, Eye, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { HourForm } from "@/components/sigpsc/hour-form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { prestadores } from "@/lib/mock-data";
import { recordsFor, useDemo, personalAgenda, personalDocuments, type HourRecord } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/minha-prestacao")({ head: () => meta("Minha prestação", "Horas, próximos comparecimentos, pendências e documentos do prestador."), component: MinhaPrestacao });
const tones = { Pendente: "bg-warning-soft text-warning", Aprovado: "bg-success-soft text-success", Correção: "bg-danger-soft text-danger", Recusado: "bg-danger-soft text-danger" };
function MinhaPrestacao() {
  const { records } = useDemo();
  const [tab, setTab] = useState("resumo");
  const [correction, setCorrection] = useState<HourRecord | undefined>();
  const [document, setDocument] = useState<(typeof personalDocuments)[number] | null>(null);
  const p = prestadores.find((row) => row.id === "1");
  if (!p) return null;
  const own = recordsFor(records, p.id);
  const approvedExtra = own.filter((r) => r.status === "Aprovado" && r.id !== "h-approved").reduce((sum, r) => sum + r.horas, 0);
  const validated = p.horasCumpridas + approvedExtra;
  const pending = own.filter((r) => r.status === "Pendente");
  return <><PageHeader title={`Olá, ${p.nome.split(" ")[0]}`} subtitle={p.local} />
    <div className="mb-6 grid grid-cols-2 gap-3"><div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Horas cumpridas</p><p className="mt-1 font-display text-3xl font-bold text-success">{validated}h</p></div><div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Horas restantes</p><p className="mt-1 font-display text-3xl font-bold">{Math.max(0, p.horasTotais - validated)}h</p></div></div>
    <div className="mb-6"><div className="mb-2 flex justify-between text-sm"><span>{validated}h de {p.horasTotais}h</span><strong>{Math.round(validated / p.horasTotais * 100)}%</strong></div><Progress value={validated / p.horasTotais * 100} /></div>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4"><TabsTrigger value="resumo">Minha prestação</TabsTrigger><TabsTrigger value="registro">Registrar horas</TabsTrigger><TabsTrigger value="pendencias">Meus registros</TabsTrigger><TabsTrigger value="documentos">Documentos</TabsTrigger></TabsList>
      <TabsContent value="resumo" className="mt-6 space-y-6"><section className="border-l-4 border-primary bg-info-soft p-4"><div className="mb-3 flex items-center gap-2 font-semibold text-info"><CalendarDays className="size-5" />Próximo comparecimento</div><p className="font-display text-xl font-bold">{personalAgenda[0]?.date}</p><p className="mt-1 flex items-center gap-2 text-sm"><Clock className="size-4" />{personalAgenda[0]?.time}</p><p className="mt-2 flex items-start gap-2 text-sm"><MapPin className="size-4 shrink-0" />{p.local}</p><p className="mt-2 flex items-center gap-2 text-sm"><User className="size-4" />Responsável: {p.supervisor}</p><Button className="mt-4" onClick={() => setTab("registro")}><Clock />Registrar horas</Button></section>
        <section><h2 className="mb-3 font-display font-semibold">Pendências</h2><div className="divide-y border-y">{pending.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="text-sm">{pending.length} registro(s) aguardando aprovação</p><Button variant="outline" size="sm" onClick={() => setTab("pendencias")}>Ver registros</Button></div>}{own.filter((r) => r.status === "Correção").map((r) => <div key={r.id} className="py-4"><p className="font-medium text-danger">Correção solicitada · {r.data}</p><p className="mt-1 text-sm text-muted-foreground">{r.motivo}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => {setCorrection(r); setTab("registro");}}>Corrigir registro</Button></div>)}</div></section>
        <section><h2 className="mb-3 font-display font-semibold">Agenda</h2>{personalAgenda.map((event) => <div key={event.date} className="flex gap-3 border-b py-4"><CalendarDays className="mt-1 size-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{event.date} · {event.time}</p><p className="text-sm text-muted-foreground">{event.activity}</p><p className="text-xs text-muted-foreground">{p.local} · {p.supervisor}</p></div></div>)}</section>
      </TabsContent>
      <TabsContent value="registro" className="mx-auto mt-6 max-w-xl"><h2 className="mb-4 font-display text-lg font-semibold">{correction ? "Corrigir registro" : "Registrar horas"}</h2><HourForm key={correction?.id ?? "new"} personal correction={correction} onDone={() => {setCorrection(undefined); setTab("pendencias");}} />{correction && <Button variant="ghost" className="mt-3" onClick={() => setCorrection(undefined)}>Cancelar correção</Button>}</TabsContent>
      <TabsContent value="pendencias" className="mt-6"><h2 className="mb-3 font-display font-semibold">Meus registros</h2><div className="space-y-3">{[...own].reverse().map((r) => <article key={r.id} className="rounded-lg border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{r.data} · {r.horas}h</strong><span className={`rounded-md px-2 py-1 text-xs font-medium ${tones[r.status]}`}>{r.status === "Pendente" ? "Aguardando aprovação" : r.status === "Correção" ? "Precisa de correção" : r.status}</span></div><p className="mt-2 text-sm">{r.atividade}</p><p className="text-xs text-muted-foreground">{r.entrada}–{r.saida} · {r.local}</p>{r.motivo && <p className="mt-3 text-sm text-danger">{r.motivo}</p>}{r.status === "Correção" && <Button variant="outline" size="sm" className="mt-3" onClick={() => {setCorrection(r); setTab("registro");}}>Corrigir registro</Button>}</article>)}</div></TabsContent>
      <TabsContent value="documentos" className="mt-6"><h2 className="mb-3 font-display font-semibold">Meus documentos</h2>{personalDocuments.map((d) => <div key={d.id} className="flex items-center gap-3 border-b py-4"><FileText className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.date} · {d.status}</p></div><Button variant="outline" size="icon" aria-label={`Visualizar ${d.name}`} title="Visualizar documento" onClick={() => setDocument(d)}><Eye /></Button></div>)}</TabsContent>
    </Tabs>
    <Dialog open={!!document} onOpenChange={(open) => {if (!open) setDocument(null);}}><DialogContent><DialogHeader><DialogTitle>{document?.name}</DialogTitle><DialogDescription>{p.nome} · {document?.date}</DialogDescription></DialogHeader><div className="space-y-4 border-y py-5"><FileText className="size-10 text-primary" /><p className="font-semibold">{document?.name}</p><p className="text-sm">Prestação de Serviços à Comunidade</p><p className="text-sm">Processo: {p.processo}</p><p className="text-sm">{validated} horas cumpridas de {p.horasTotais} horas determinadas.</p><p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{document?.status}</p></div></DialogContent></Dialog>
  </>;
}