import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, MessageSquare, Search, ShieldCheck, Scale, X } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/sigpsc/date-field";
import { PageHeader } from "@/components/sigpsc/page-header";
import { StatusBadge } from "@/components/sigpsc/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { durationMinutes, useDemo, selectedSummary, type HourRecord } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/validacao")({ head: () => meta("Validação de horas", "Autorize os registros e depois libere para o juiz, em lote ou individualmente."), component: Validacao });

type ActionStatus = "Autorizado" | "Aprovado" | "Correção" | "Recusado";

function clock(hours: number) {
  const minutes = Math.round(hours * 60);
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${whole}h ${String(rest).padStart(2, "0")}min` : `${whole}h`;
}
function stamp(data: string) {
  const [day, month, year] = data.split("/");
  return `${year ?? ""}${month ?? ""}${day ?? ""}`;
}
function isoFromBr(data: string) {
  const [day, month, year] = data.split("/");
  return year && month && day ? `${year}-${month}-${day}` : "";
}
function maskTime(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function completeTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return value;
}

function Validacao() {
  const { records, review, reload, workspace } = useDemo();
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);
  const queue = useMemo(
    () => records.filter((r) => r.status === "Pendente" || r.status === "Liberar para juiz").slice().sort((a, b) => stamp(b.data).localeCompare(stamp(a.data)) || b.id.localeCompare(a.id)),
    [records],
  );
  const approved = useMemo(() => records.filter((r) => r.status === "Aprovado").slice().sort((a, b) => stamp(b.data).localeCompare(stamp(a.data)) || b.id.localeCompare(a.id)), [records]);
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState<{ ids: string[]; status: ActionStatus } | null>(null);
  const [reason, setReason] = useState("");
  const [validatedOpen, setValidatedOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [fix, setFix] = useState<HourRecord | null>(null);
  const [fixDate, setFixDate] = useState("");
  const [fixEntry, setFixEntry] = useState("");
  const [fixExit, setFixExit] = useState("");
  const [fixActivity, setFixActivity] = useState("");
  const [fixReason, setFixReason] = useState("");
  const [saving, setSaving] = useState(false);
  const itens = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return queue;
    return queue.filter((record) => record.prestador.toLocaleLowerCase("pt-BR").includes(term));
  }, [queue, search]);
  const pendingSelected = selectedSummary(itens, ids, ["Pendente"]);
  const readySelected = selectedSummary(itens, ids, ["Liberar para juiz"]);
  const summary = selectedSummary(records, action?.ids ?? [], ["Pendente", "Liberar para juiz", "Aprovado"]);
  const shown = approved.filter((record) => `${record.prestador} ${record.local} ${record.atividade} ${record.data}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const approvedHours = approved.reduce((total, record) => total + record.horas, 0);
  const entryTime = completeTime(fixEntry);
  const exitTime = completeTime(fixExit);
  const fixReady = !!fix && fixReason.trim().length >= 3 && !!fixDate && !!entryTime && !!exitTime && durationMinutes(entryTime, exitTime) > 0 && fixActivity.trim().length >= 3;
  const pendingCount = queue.filter((item) => item.status === "Pendente").length;
  const readyCount = queue.filter((item) => item.status === "Liberar para juiz").length;

  async function finish() {
    if (!action || !summary.selected.length || ((action.status === "Correção" || action.status === "Recusado") && !reason.trim())) return;
    try {
      await review(action.ids, action.status, reason.trim() || undefined);
      setIds((previous) => previous.filter((id) => !action.ids.includes(id)));
      setAction(null);
      setReason("");
      toast.success(
        action.status === "Autorizado"
          ? "Horas autorizadas. Agora estão prontas para liberar ao juiz."
          : action.status === "Aprovado"
            ? "Pacote do dia atualizado para o juiz. O relatório está na ficha do prestador."
            : "Validação atualizada nesta sessão.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a validação.");
    }
  }
  function openFix(record: HourRecord) {
    setValidatedOpen(false);
    setFix(record);
    setFixDate(isoFromBr(record.data));
    setFixEntry(record.entrada);
    setFixExit(record.saida);
    setFixActivity(record.atividade);
    setFixReason("");
  }
  async function saveFix() {
    if (!fix || !fixReady || saving) return;
    const changed = fixDate !== isoFromBr(fix.data) || entryTime !== fix.entrada || exitTime !== fix.saida || fixActivity.trim() !== fix.atividade;
    setSaving(true);
    try {
      await review([fix.id], "Correção", fixReason.trim());
      if (changed && /^\d+$/.test(fix.id)) {
        await api(`/api/v1/attendance/${fix.id}`, { method: "PATCH", body: JSON.stringify({ data: fixDate, entrada: entryTime, saida: exitTime, atividade: fixActivity.trim(), observacoes: fixReason.trim() }) });
        await reload();
      }
      setFix(null);
      toast.success(changed ? "Registro ajustado e devolvido para validação." : "Correção solicitada. Estas horas saíram do total validado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível corrigir o registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Validação de horas"
        subtitle={`${pendingCount} para autorizar · ${readyCount} para liberar ao juiz · ${queue.reduce((a, b) => a + b.horas, 0)}h no total`}
        actions={<Button variant="outline" onClick={() => { setQuery(""); setValidatedOpen(true); }}><CheckCircle2 />Horas validadas</Button>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome do prestador" className="h-11 pl-9" aria-label="Buscar por nome do prestador" />
      </div>
      {itens.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y py-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ids.length > 0 && ids.length === itens.length} onChange={(e) => setIds(e.target.checked ? itens.map((r) => r.id) : [])} />
            Selecionar todos
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{pendingSelected.selected.length} p/ autorizar · {readySelected.selected.length} p/ liberar</span>
            <Button disabled={!pendingSelected.selected.length} variant="outline" onClick={() => setAction({ ids: pendingSelected.selected.map((r) => r.id), status: "Autorizado" })}>
              <ShieldCheck />Autorizar
            </Button>
            <Button disabled={!readySelected.selected.length} onClick={() => setAction({ ids: readySelected.selected.map((r) => r.id), status: "Aprovado" })}>
              <Scale />Liberar para juiz
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {itens.map((r) => (
          <article key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <input className="mt-1 size-4 shrink-0" type="checkbox" aria-label={`Selecionar ${r.prestador}`} checked={ids.includes(r.id)} onChange={(e) => setIds((s) => e.target.checked ? [...s, r.id] : s.filter((id) => id !== r.id))} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Link to="/prestadores/$id" params={{ id: r.prestadorId }} className="font-semibold hover:text-primary">{r.prestador}</Link>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">Lançado por {r.lancadoPor || "—"} · {r.lancadoEm || "—"}</span>
                    <strong className="text-warning">{r.horas}h</strong>
                  </div>
                </div>
                <p className="text-sm">{r.atividade}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.data} · {r.entrada}–{r.saida} · {r.local} · {r.supervisor}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setReason(""); setAction({ ids: [r.id], status: "Correção" }); }}><MessageSquare />Corrigir</Button>
                  <Button variant="outline" size="sm" className="text-danger" onClick={() => { setReason(""); setAction({ ids: [r.id], status: "Recusado" }); }}><X />Recusar</Button>
                  {r.status === "Pendente" ? (
                    <Button size="sm" onClick={() => setAction({ ids: [r.id], status: "Autorizado" })}><ShieldCheck />Autorizar</Button>
                  ) : (
                    <Button size="sm" onClick={() => setAction({ ids: [r.id], status: "Aprovado" })}><Scale />Liberar para juiz</Button>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
        {!itens.length && (
          <div className="py-16 text-center">
            <Check className="mx-auto mb-2 size-8 text-success" />
            <p className="font-semibold">{queue.length && search.trim() ? "Nenhum prestador encontrado" : "Tudo validado!"}</p>
            <p className="text-sm text-muted-foreground">{queue.length && search.trim() ? "Ajuste o nome buscado." : "Nenhum registro aguardando autorização ou liberação."}</p>
          </div>
        )}
      </div>

      <Dialog open={!!action} onOpenChange={(open) => { if (!open) setAction(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {action?.status === "Autorizado"
                ? "Autorizar horas"
                : action?.status === "Aprovado"
                  ? "Liberar para juiz"
                  : action?.status === "Correção"
                    ? "Solicitar correção"
                    : "Recusar registro"}
            </DialogTitle>
            <DialogDescription>{summary.selected.length} registro(s) · {summary.hours}h</DialogDescription>
          </DialogHeader>
          <ul className="divide-y">
            {summary.selected.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <p className="font-semibold">{r.prestador} · {r.horas}h</p>
                <p>{r.data} · {r.entrada}–{r.saida}</p>
                <p className="text-muted-foreground">{r.atividade}</p>
              </li>
            ))}
          </ul>
          {action?.status === "Autorizado" && <p className="text-sm text-muted-foreground">Após autorizar, o status fica como Liberar para juiz. Depois você envia ao juiz em lote ou um a um.</p>}
          {action?.status === "Aprovado" && <p className="text-sm text-muted-foreground">Estas horas entram no pacote de hoje deste prestador. Se já houver pacote fechado hoje, elas se unificam nele; em outro dia, abre-se um pacote novo.</p>}
          {(action?.status === "Correção" || action?.status === "Recusado") && (
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo para o prestador</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Informe o que precisa ser ajustado ou o motivo da recusa" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancelar</Button>
            <Button disabled={(action?.status === "Correção" || action?.status === "Recusado") && !reason.trim()} onClick={() => { void finish(); }}>
              {action?.status === "Autorizado" ? "Confirmar autorização" : action?.status === "Aprovado" ? "Fechar pacote do dia" : "Confirmar e enviar motivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={validatedOpen} onOpenChange={setValidatedOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Horas validadas</DialogTitle>
            <DialogDescription>{approved.length} registro(s) · {clock(approvedHours)} no total</DialogDescription>
          </DialogHeader>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar prestador, local ou data" aria-label="Buscar horas validadas" />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {shown.map((record) => (
              <article key={record.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Link to="/prestadores/$id" params={{ id: record.prestadorId }} className="font-semibold hover:text-primary">{record.prestador}</Link>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
                    <span className="text-xs text-muted-foreground">Lançado por {record.lancadoPor || "—"} · {record.lancadoEm || "—"}</span>
                    <strong className="text-success">{clock(record.horas)}</strong>
                  </div>
                </div>
                <p className="text-sm">{record.atividade}</p>
                <p className="mt-1 text-xs text-muted-foreground">{record.data} · {record.entrada}–{record.saida} · {record.local} · {record.supervisor}</p>
                <div className="mt-4"><Button variant="outline" size="sm" onClick={() => openFix(record)}><MessageSquare />Corrigir</Button></div>
              </article>
            ))}
            {!shown.length && <p className="py-10 text-center text-sm text-muted-foreground">{approved.length ? "Nenhum registro encontrado." : "Nenhuma hora validada ainda."}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fix} onOpenChange={(open) => { if (!open && !saving) setFix(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Corrigir horas validadas</DialogTitle>
            <DialogDescription>{fix?.prestador} · {fix?.data} · {fix ? clock(fix.horas) : ""}</DialogDescription>
          </DialogHeader>
          {fix && (
            <div className="space-y-4">
              <DateField id="correcao-data" label="Data da prestação" required value={fixDate} onChange={setFixDate} pattern={workspace?.formatoData} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="correcao-entrada">Entrada</Label><Input id="correcao-entrada" inputMode="numeric" value={fixEntry} placeholder="00:00" onChange={(event) => setFixEntry(maskTime(event.target.value))} /></div>
                <div className="space-y-1.5"><Label htmlFor="correcao-saida">Saída</Label><Input id="correcao-saida" inputMode="numeric" value={fixExit} placeholder="00:00" onChange={(event) => setFixExit(maskTime(event.target.value))} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="correcao-atividade">Atividade</Label><Input id="correcao-atividade" value={fixActivity} onChange={(event) => setFixActivity(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="correcao-motivo">O que precisa ser ajustado</Label><Textarea id="correcao-motivo" value={fixReason} onChange={(event) => setFixReason(event.target.value)} placeholder="Descreva o erro encontrado neste registro" /></div>
              <p className="text-xs text-muted-foreground">O registro deixa de contar como hora validada. Se a data, o horário ou a atividade mudarem, ele volta para a fila de validação.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setFix(null)}>Cancelar</Button>
            <Button disabled={!fixReady || saving} onClick={() => { void saveFix(); }}>{saving ? "Salvando…" : "Confirmar correção"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
