import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Download, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { StatusBadge } from "@/components/sigpsc/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { prestadores } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/prestadores/")({ head: () => meta("Prestadores", "Lista de prestadores com busca, filtros e acompanhamento de horas."), component: Lista });
const filtros = ["Todos", "Ativo", "Concluído", "Suspenso", "Pendente"];

function Lista() {
  const [q, setQ] = useState(""); const [f, setF] = useState("Todos");
  const rows = useMemo(() => prestadores.filter((p) => (f === "Todos" || p.situacao === f) && (p.nome + p.cpf + p.processo).toLowerCase().includes(q.toLowerCase())), [q, f]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Prestadores" subtitle={`${prestadores.length} cadastrados`} actions={<><Button variant="outline"><Download />Exportar</Button><Button asChild><Link to="/prestadores/novo"><Plus />Novo prestador</Link></Button></>} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, CPF ou nº do processo" className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">{filtros.map((x) => <button key={x} onClick={() => setF(x)} className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-medium ${f === x ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{x}</button>)}</div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Prestador</th><th className="px-4 py-3">Processo</th><th className="px-4 py-3">Local</th><th className="px-4 py-3 w-48">Cumprimento</th><th className="px-4 py-3">Situação</th><th /></tr></thead>
          <tbody className="divide-y">{rows.map((p) => { const pct = Math.round((p.horasCumpridas / p.horasTotais) * 100); return (
            <tr key={p.id} className="hover:bg-muted/40">
              <td className="px-4 py-3"><Link to="/prestadores/$id" params={{ id: p.id }} className="font-semibold hover:text-primary">{p.nome}</Link><p className="text-xs text-muted-foreground">CPF {p.cpf}</p></td>
              <td className="px-4 py-3"><p className="font-mono text-xs">{p.processo}</p><p className="text-xs text-muted-foreground">{p.vara}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{p.local}</td>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress value={pct} className="h-1.5" /><span className="w-10 text-right text-xs font-semibold">{pct}%</span></div><p className="mt-1 text-xs text-muted-foreground">{p.horasCumpridas}/{p.horasTotais}h</p></td>
              <td className="px-4 py-3"><StatusBadge status={p.situacao} /></td>
              <td className="px-4 py-3"><Link to="/prestadores/$id" params={{ id: p.id }} aria-label="Abrir"><ChevronRight className="size-4 text-muted-foreground" /></Link></td>
            </tr>); })}</tbody>
        </table>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>Mostrando {rows.length} de {prestadores.length}</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled>Anterior</Button><Button size="sm" variant="outline">Próxima</Button></div></div>
      </div>

      <div className="space-y-3 md:hidden">{rows.map((p) => { const pct = Math.round((p.horasCumpridas / p.horasTotais) * 100); return (
        <Link key={p.id} to="/prestadores/$id" params={{ id: p.id }} className="block rounded-xl border bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{p.nome}</p><p className="truncate font-mono text-[11px] text-muted-foreground">{p.processo}</p></div><StatusBadge status={p.situacao} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{p.local}</p>
          <div className="mt-3 flex items-center gap-2"><Progress value={pct} className="h-1.5" /><span className="text-xs font-semibold">{p.horasCumpridas}/{p.horasTotais}h</span></div>
        </Link>); })}</div>
      {rows.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum prestador encontrado.</p>}
    </div>
  );
}
