import { useState, type FormEvent } from "react";
import { Camera, Check, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { prestadores, locais } from "@/lib/mock-data";
import { durationMinutes, useDemo, type HourRecord } from "@/lib/daily-demo";

export function HourForm({ personal = false, correction, onDone }: { personal?: boolean; correction?: HourRecord | undefined; onDone?: () => void }) {
  const { addRecord } = useDemo();
  const [id, setId] = useState(correction?.prestadorId ?? "1");
  const person = prestadores.find((p) => p.id === id) ?? prestadores[0];
  const [local, setLocal] = useState(correction?.local ?? person?.local ?? "");
  const [date, setDate] = useState(correction ? correction.data.split("/").reverse().join("-") : "2026-11-18");
  const [entry, setEntry] = useState(correction?.entrada ?? "08:00");
  const [exit, setExit] = useState(correction?.saida ?? "12:00");
  const [activity, setActivity] = useState(correction?.atividade ?? "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [confirm, setConfirm] = useState(false);
  const minutes = durationMinutes(entry, exit);
  const duration = `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  function submit(e: FormEvent) { e.preventDefault(); if (!minutes) { toast.error("A saída deve ser depois da entrada."); return; } setConfirm(true); }
  function send() {
    if (!person || !minutes) return;
    addRecord({ id: correction?.id ?? `new-${Date.now()}`, prestadorId: person.id, prestador: person.nome, local: personal ? person.local : local, data: date.split("-").reverse().join("/"), entrada: entry, saida: exit, horas: minutes / 60, atividade: activity.trim(), supervisor: person.supervisor, status: "Pendente" });
    setConfirm(false); setActivity(""); setNote(""); setPhoto(""); toast.success("Registro enviado para validação nesta sessão."); onDone?.();
  }
  return <><form onSubmit={submit} className="space-y-4">
    {correction?.motivo && <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">{correction.motivo}</p>}
    {!personal && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="provider">Prestador</Label><select id="provider" className="h-11 w-full rounded-lg border bg-card px-3 text-sm" value={id} onChange={(e) => { setId(e.target.value); setLocal(prestadores.find((p) => p.id === e.target.value)?.local ?? ""); }}>{prestadores.filter((p) => p.situacao === "Ativo").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="local">Local</Label><select id="local" className="h-11 w-full rounded-lg border bg-card px-3 text-sm" value={local} onChange={(e) => setLocal(e.target.value)}>{locais.map((l) => <option key={l}>{l}</option>)}</select></div></div>}
    <div className="space-y-1.5"><Label htmlFor="date">Data</Label><Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-11 min-w-0" /></div>
    <div className="grid grid-cols-2 gap-3">{[["Entrada", entry, setEntry], ["Saída", exit, setExit]].map(([label, value, setter]) => <div key={label as string} className="min-w-0 space-y-1.5"><Label htmlFor={label as string}>{label as string}</Label><Input id={label as string} type="time" required value={value as string} onChange={(e) => (setter as (s: string) => void)(e.target.value)} className="h-12 min-w-0 text-lg" /><Button type="button" variant="outline" size="sm" className="w-full" onClick={() => (setter as (s: string) => void)(new Date().toTimeString().slice(0, 5))}><Clock />Agora</Button></div>)}</div>
    <div className="flex justify-between rounded-lg bg-info-soft p-3 text-info"><span>Duração</span><strong>{minutes ? duration : "—"}</strong></div>
    <div className="space-y-1.5"><Label htmlFor="activity">Atividade realizada</Label><Input id="activity" required value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex.: Organização do acervo" className="h-11" /></div>
    <div className="space-y-1.5"><Label htmlFor="notes">Observações</Label><Textarea id="notes" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><Camera className="size-5 shrink-0" /><span className="break-all">{photo || "Anexar foto (opcional)"}</span><input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? "")} /></label>
    <Button type="submit" size="lg" className="w-full"><Send />Conferir registro</Button>
  </form><Dialog open={confirm} onOpenChange={setConfirm}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Confirmar envio</DialogTitle><DialogDescription>{person?.nome} · {personal ? person?.local : local}</DialogDescription></DialogHeader><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Data e horários</dt><dd>{date.split("-").reverse().join("/")} · {entry}–{exit} · {duration}</dd></div><div><dt className="text-muted-foreground">Atividade</dt><dd className="break-words">{activity}</dd></div>{note && <div><dt className="text-muted-foreground">Observações</dt><dd className="break-words">{note}</dd></div>}{photo && <div><dt className="text-muted-foreground">Foto</dt><dd className="break-all">{photo}</dd></div>}</dl><DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Voltar e editar</Button><Button onClick={send}><Check />Enviar para validação</Button></DialogFooter></DialogContent></Dialog></>;
}