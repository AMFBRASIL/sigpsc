import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { registrosPendentes } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/validacao")({ head: () => meta("Validação de horas", "Aprove ou solicite correção dos registros enviados pelos supervisores."), component: Validacao });

function Validacao() {
  const [itens, setItens] = useState(registrosPendentes);
  const act = (id: string, msg: string) => { setItens((s) => s.filter((i) => i.id !== id)); toast.success(msg); };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Validação de horas" subtitle={`${itens.length} registros aguardando · ${itens.reduce((a, b) => a + b.horas, 0)}h no total`}
        actions={itens.length > 0 && <Button onClick={() => { setItens([]); toast.success("Todos os registros aprovados"); }}><Check />Aprovar todos</Button>} />
      <div className="space-y-3">{itens.map((r) => (
        <div key={r.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card md:flex-row md:items-center">
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning"><span className="font-display text-lg font-bold">{r.horas}h</span></div>
          <div className="min-w-0 flex-1"><p className="font-semibold">{r.prestador}</p><p className="text-sm">{r.atividade}</p><p className="text-xs text-muted-foreground">{r.data} · {r.entrada}–{r.saida} · {r.local} · Sup. {r.supervisor}</p></div>
          <div className="grid grid-cols-3 gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={() => act(r.id, "Correção solicitada")}><MessageSquare />Corrigir</Button>
            <Button variant="outline" size="sm" className="text-danger" onClick={() => act(r.id, "Registro recusado")}><X />Recusar</Button>
            <Button size="sm" onClick={() => act(r.id, "Horas aprovadas")}><Check />Aprovar</Button>
          </div>
        </div>))}
        {itens.length === 0 && <div className="rounded-xl border border-dashed bg-card py-16 text-center"><Check className="mx-auto mb-2 size-8 text-success" /><p className="font-semibold">Tudo validado!</p><p className="text-sm text-muted-foreground">Nenhum registro pendente.</p></div>}
      </div>
    </div>
  );
}
