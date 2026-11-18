import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useDemo, selectedSummary, type HourRecord } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/validacao")({ head: () => meta("Validação de horas", "Revise registros selecionados e aprove em lote ou solicite correções individuais."), component: Validacao });
function Validacao() {
  const { records, review } = useDemo();
  const itens = records.filter((r) => r.status === "Pendente");
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState<{ ids: string[]; status: HourRecord["status"] } | null>(null);
  const [reason, setReason] = useState("");
  const { selected, hours } = selectedSummary(records, ids);
  const summary = selectedSummary(records, action?.ids ?? []);
  function finish() {
    if (!action || !summary.selected.length || (action.status !== "Aprovado" && !reason.trim())) return;
    review(action.ids, action.status, reason.trim() || undefined);
    setIds((previous) => previous.filter((id) => !action.ids.includes(id))); setAction(null); setReason("");
    toast.success("Validação atualizada nesta sessão.");
  }
  return <div className="mx-auto max-w-5xl"><PageHeader title="Validação de horas" subtitle={`${itens.length} registros aguardando · ${itens.reduce((a, b) => a + b.horas, 0)}h no total`} />
    {itens.length > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y py-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.length === itens.length} onChange={(e) => setIds(e.target.checked ? itens.map((r) => r.id) : [])} />Selecionar todos</label><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">{selected.length} selecionados · {hours}h</span><Button disabled={!selected.length} onClick={() => setAction({ids: selected.map((r) => r.id), status: "Aprovado"})}><Check />Revisar selecionados</Button></div></div>}
    <div className="space-y-3">{itens.map((r) => <article key={r.id} className="rounded-lg border bg-card p-4"><div className="flex items-start gap-3"><input className="mt-1 size-4 shrink-0" type="checkbox" aria-label={`Selecionar ${r.prestador}`} checked={ids.includes(r.id)} onChange={(e) => setIds((s) => e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id))} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><Link to="/prestadores/$id" params={{id: r.prestadorId}} className="font-semibold hover:text-primary">{r.prestador}</Link><strong className="shrink-0 text-warning">{r.horas}h</strong></div><p className="text-sm">{r.atividade}</p><p className="mt-1 text-xs text-muted-foreground">{r.data} · {r.entrada}–{r.saida} · {r.local} · {r.supervisor}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => {setReason(""); setAction({ids: [r.id], status: "Correção"});}}><MessageSquare />Corrigir</Button><Button variant="outline" size="sm" className="text-danger" onClick={() => {setReason(""); setAction({ids: [r.id], status: "Recusado"});}}><X />Recusar</Button><Button size="sm" onClick={() => setAction({ids: [r.id], status: "Aprovado"})}><Check />Aprovar</Button></div></div></div></article>)}{!itens.length && <div className="py-16 text-center"><Check className="mx-auto mb-2 size-8 text-success" /><p className="font-semibold">Tudo validado!</p><p className="text-sm text-muted-foreground">Nenhum registro pendente.</p></div>}</div>
    <Dialog open={!!action} onOpenChange={(open) => {if (!open) setAction(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{action?.status === "Aprovado" ? "Revisar aprovação" : action?.status === "Correção" ? "Solicitar correção" : "Recusar registro"}</DialogTitle><DialogDescription>{summary.selected.length} registro(s) · {summary.hours}h</DialogDescription></DialogHeader><ul className="divide-y">{summary.selected.map((r) => <li key={r.id} className="py-3 text-sm"><p className="font-semibold">{r.prestador} · {r.horas}h</p><p>{r.data} · {r.entrada}–{r.saida}</p><p className="text-muted-foreground">{r.atividade}</p></li>)}</ul>{action?.status !== "Aprovado" && <div className="space-y-2"><Label htmlFor="reason">Motivo para o prestador</Label><Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Informe o que precisa ser ajustado ou o motivo da recusa" /></div>}<DialogFooter><Button variant="outline" onClick={() => setAction(null)}>Cancelar</Button><Button disabled={action?.status !== "Aprovado" && !reason.trim()} onClick={finish}>{action?.status === "Aprovado" ? "Confirmar aprovação" : "Confirmar e enviar motivo"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
