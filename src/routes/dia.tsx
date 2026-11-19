import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCheck, CalendarDays, UserX, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/dia")({ head: () => meta("Lista do dia", "Horas a validar, ausências e prazos da equipe reunidos em uma lista."), component: Dia });
function Dia() {
  const { records, workspace } = useDemo();
  const [filter, setFilter] = useState("Todas");
  const [done, setDone] = useState<string[]>([]);
  const tasks = workspace?.dia ?? [
    ...records.filter((r) => r.status === "Pendente" || r.status === "Liberar para juiz").map((r) => ({ id: r.id, personId: r.prestadorId, name: r.prestador, category: "Validação", title: r.status === "Liberar para juiz" ? `${r.horas}h para liberar ao juiz` : `${r.horas}h para autorizar`, detail: `${r.atividade} · ${r.local}`, date: r.data })),
  ];
  const visible = tasks.filter((t) => (filter === "Todas" || t.category === filter) && !done.includes(t.id));
  return <div className="mx-auto max-w-6xl"><PageHeader title="Lista do dia" subtitle="Quarta-feira, 18 de novembro · Unidade Central" />
    <div className="mb-6 grid grid-cols-3 gap-3">{[["Validação", CheckCheck], ["Ausências", UserX], ["Prazos", CalendarDays]].map(([label, Icon]) => {const I = Icon as typeof CheckCheck; return <Button key={label as string} variant="outline" className="h-auto flex-col items-start gap-2 whitespace-normal p-3 sm:p-4" onClick={() => setFilter(label as string)}><I className="size-5 text-primary" /><strong className="font-display text-2xl">{tasks.filter((t) => t.category === label && !done.includes(t.id)).length}</strong><span className="text-xs">{label as string}</span></Button>;})}</div>
    <div className="mb-4 flex flex-wrap gap-2">{["Todas", "Validação", "Ausências", "Prazos"].map((f) => <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>{f}</Button>)}</div>
    <div className="divide-y border-y">{visible.map((t) => <article key={t.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-primary">{t.category} · {t.date}</p><p className="mt-1 font-semibold">{t.title}</p><Link to="/prestadores/$id" params={{id: t.personId}} className="text-sm font-medium hover:text-primary">{t.name}</Link><p className="text-xs text-muted-foreground">{t.detail}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link to="/prestadores/$id" params={{id: t.personId}}>Ver prestador</Link></Button>{t.category === "Validação" ? <Button size="sm" asChild><Link to="/validacao">Validar<ArrowRight /></Link></Button> : <Button size="sm" onClick={() => setDone((s) => [...s, t.id])}>Marcar tratada</Button>}</div></article>)}</div>{visible.length === 0 && <p className="py-12 text-center text-muted-foreground">Nenhuma pendência nesta lista.</p>}
  </div>;
}