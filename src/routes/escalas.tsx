import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, MapPin } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { escalas } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/escalas")({ head: () => meta("Escalas", "Calendário semanal de escalas por prestador e local."), component: Escalas });

function Escalas() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Escalas" subtitle="Semana de 16 a 21 de novembro de 2026" actions={<><Button variant="outline" size="icon" aria-label="Anterior"><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Próxima"><ChevronRight /></Button><Button><Plus />Nova escala</Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{escalas.map((d) => (
        <div key={d.dia} className={`rounded-xl border bg-card p-3 shadow-card ${d.data === "18/11" ? "ring-2 ring-primary" : ""}`}>
          <div className="mb-3 flex items-baseline justify-between"><p className="font-display font-semibold">{d.dia}</p><p className="text-xs text-muted-foreground">{d.data}</p></div>
          <div className="space-y-2">{d.itens.map((i, k) => (
            <div key={k} className="rounded-lg border-l-4 border-primary bg-accent p-2.5"><p className="text-xs font-bold text-accent-foreground">{i.horario}</p><p className="text-sm font-medium">{i.prestador}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="size-3" />{i.local}</p></div>))}</div>
        </div>))}</div>
    </div>
  );
}
