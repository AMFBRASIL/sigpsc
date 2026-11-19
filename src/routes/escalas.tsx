import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/sigpsc/date-field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { escalas as escalasMock } from "@/lib/mock-data";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/escalas")({ head: () => meta("Escalas", "Calendário semanal de escalas por prestador e local."), component: Escalas });

function Escalas() {
  const { workspace, prestadores, reload } = useDemo();
  const escalas = workspace?.escalas.length ? workspace.escalas : escalasMock;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ prestadorId: "", data: "2026-11-18", entrada: "08:00", saida: "12:00", localId: "" });
  const salvar = () => {
    const person = prestadores.find((item) => item.id === form.prestadorId) ?? prestadores[0];
    if (!person?.processoId) return;
    void api("/api/v1/schedules", { method: "POST", body: JSON.stringify({ processoId: Number(person.processoId), data: form.data, entrada: form.entrada, saida: form.saida, localId: Number(form.localId || workspace?.locais[0]?.id) }) }).then(() => reload()).then(() => { setOpen(false); toast.success("Escala gravada"); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível gravar"));
  };
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Escalas" subtitle="Semana de 16 a 21 de novembro de 2026" actions={<><Button variant="outline" size="icon" aria-label="Anterior"><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Próxima"><ChevronRight /></Button><Button onClick={() => setOpen(true)}><Plus />Nova escala</Button></>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{escalas.map((d) => (
        <div key={d.dia} className={`rounded-xl border bg-card p-3 shadow-card ${d.data === "18/11" ? "ring-2 ring-primary" : ""}`}>
          <div className="mb-3 flex items-baseline justify-between"><p className="font-display font-semibold">{d.dia}</p><p className="text-xs text-muted-foreground">{d.data}</p></div>
          <div className="space-y-2">{d.itens.map((i, k) => (
            <div key={k} className="rounded-lg border-l-4 border-primary bg-accent p-2.5"><p className="text-xs font-bold text-accent-foreground">{i.horario}</p><p className="text-sm font-medium">{i.prestador}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="size-3" />{i.local}</p></div>))}</div>
        </div>))}</div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nova escala</DialogTitle></DialogHeader><div className="grid gap-3"><select className="h-10 rounded-md border bg-transparent px-3 text-sm" value={form.prestadorId} onChange={(event) => setForm({ ...form, prestadorId: event.target.value })}>{prestadores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><DateField ariaLabel="Data da escala" value={form.data} pattern={workspace?.formatoData} onChange={(data) => setForm({ ...form, data })} className="h-10" /><div className="grid grid-cols-2 gap-3"><Input type="time" value={form.entrada} onChange={(event) => setForm({ ...form, entrada: event.target.value })} /><Input type="time" value={form.saida} onChange={(event) => setForm({ ...form, saida: event.target.value })} /></div><select className="h-10 rounded-md border bg-transparent px-3 text-sm" value={form.localId} onChange={(event) => setForm({ ...form, localId: event.target.value })}>{(workspace?.locais ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><Button onClick={salvar}>Salvar escala</Button></div></DialogContent></Dialog>
    </div>
  );
}
