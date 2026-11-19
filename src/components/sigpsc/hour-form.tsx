import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ClipboardList,
  MapPin,
  Send,
  Sun,
  Sunset,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/sigpsc/date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { durationMinutes, useDemo, type HourRecord } from "@/lib/daily-demo";
import { formatIso, normalizeDatePattern } from "@/lib/date-format";
import { cn } from "@/lib/utils";

function maskTime(raw: string) {
  const cleaned = raw.replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [hours = "", rest = ""] = cleaned.split(":");
    const minutes = rest.replace(/\D/g, "").slice(0, 2);
    return `${hours.slice(0, 2)}${minutes || cleaned.endsWith(":") ? `:${minutes}` : ""}`;
  }
  const digits = cleaned.slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function completeTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    for (const list of [hourList.current, minuteList.current]) {
      const item = list?.querySelector<HTMLElement>("[data-selected]");
      if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
    }
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = completeTime(text) || value || "00:00";
  const [hour, minute] = current.split(":");
  const choose = (nextHour: string, nextMinute: string, close: boolean) => {
    const time = `${nextHour}:${nextMinute}`;
    onChange(time);
    setText(time);
    focused.current = false;
    if (close) setOpen(false);
  };
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-1">
        <Label htmlFor={id}>{label}</Label>
        <Button type="button" variant="ghost" size="sm" className="px-1 text-xs text-primary" onClick={() => onChange(new Date().toTimeString().slice(0, 5))}><Clock />Agora</Button>
      </div>
      <div ref={root} className="relative">
        <Input id={id} inputMode="numeric" autoComplete="off" required placeholder="00:00" aria-label={label} value={text} onClick={() => setOpen(true)} onFocus={() => { focused.current = true; setOpen(true); }} onChange={(event) => { const next = maskTime(event.target.value); setText(next); const time = completeTime(next); if (time) onChange(time); }} onBlur={() => { focused.current = false; const time = completeTime(text); if (time) { onChange(time); setText(time); } else setText(value); }} className="h-14 min-w-0 bg-background px-2 pr-12 text-xl font-semibold sm:text-2xl" />
        <button type="button" aria-label={`Abrir horário de ${label.toLowerCase()}`} aria-expanded={open} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground" onClick={() => setOpen((currentOpen) => !currentOpen)}>
          <Clock className="size-4" />
        </button>
        {open && (
          <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border bg-popover shadow-md" onMouseDown={(event) => event.preventDefault()}>
            <div className="grid grid-cols-2 border-b text-center text-[11px] font-medium text-muted-foreground">
              <span className="border-r py-2">Hora</span>
              <span className="py-2">Minuto</span>
            </div>
            <div className="grid grid-cols-2">
              <div ref={hourList} className="max-h-52 overflow-y-auto border-r p-1">
                {hours.map((item) => <button key={item} type="button" data-selected={item === hour || undefined} className={cn("flex h-9 w-full items-center justify-center rounded-md text-sm", item === hour && "bg-primary font-semibold text-primary-foreground")} onClick={() => choose(item, minute, false)}>{item}</button>)}
              </div>
              <div ref={minuteList} className="max-h-52 overflow-y-auto p-1">
                {minutes.map((item) => <button key={item} type="button" data-selected={item === minute || undefined} className={cn("flex h-9 w-full items-center justify-center rounded-md text-sm", item === minute && "bg-primary font-semibold text-primary-foreground")} onClick={() => choose(hour, item, true)}>{item}</button>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
const steps = ["Data e horários", "Atividade", "Conferência"];
const fallbackActivities = ["Organização do acervo", "Apoio na biblioteca", "Apoio administrativo"];

export function HourForm({
  personal = false,
  correction,
  onDone,
  sidebarHeader,
}: {
  personal?: boolean;
  correction?: HourRecord | undefined;
  onDone?: () => void;
  sidebarHeader?: ReactNode;
}) {
  const { addRecord, prestadores, workspace } = useDemo();
  const locais = workspace?.locais.map((item) => item.nome) ?? ["Escola Municipal Dom Pedro", "UBS Vila Nova", "Parque Ecológico", "Centro de Assistência Social", "Biblioteca Pública"];
  const activitiesFor = (name: string) => {
    if (!workspace) return fallbackActivities;
    const placeId = workspace.locais.find((item) => item.nome === name)?.id;
    return (workspace.atividades ?? []).filter((item) => item.localId === placeId).map((item) => item.nome);
  };
  const [step, setStep] = useState(0);
  const [id, setId] = useState(correction?.prestadorId ?? "1");
  const person = prestadores.find((p) => p.id === id) ?? prestadores[0];
  const [local, setLocal] = useState(correction?.local ?? person?.local ?? "");
  const [date, setDate] = useState(
    correction ? correction.data.split("/").reverse().join("-") : "2026-11-18",
  );
  const shownDate = formatIso(date, normalizeDatePattern(workspace?.formatoData));
  const [entry, setEntry] = useState(correction?.entrada ?? "08:00");
  const [exit, setExit] = useState(correction?.saida ?? "12:00");
  const [activity, setActivity] = useState(correction?.atividade ?? "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const activities = activitiesFor(local);
  const chooseLocal = (name: string) => {
    const previous = activitiesFor(local);
    const next = activitiesFor(name);
    setLocal(name);
    if (previous.includes(activity) && !next.includes(activity)) setActivity("");
  };
  const minutes = durationMinutes(entry, exit);
  const duration = `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  function go(next: number) {
    setStep(next);
    setError("");
    requestAnimationFrame(() => {
      const title = heading.current;
      title?.focus({ preventScroll: true });
      const dialog = title?.closest('[role="dialog"]');
       if (dialog) {
         const fields = title?.closest(".wizard-fields");
         if (fields) fields.scrollTop = 0;
         else dialog.scrollTop = 0;
       }
      else title?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) {
      if (!minutes) {
        setError("A saída deve ser depois da entrada.");
        return;
      }
      go(1);
      return;
    }
    if (step === 1) {
      if (!activity.trim()) {
        setError("Informe a atividade realizada.");
        return;
      }
      go(2);
      return;
    }
    if (!person || !minutes || !date || !activity.trim()) return;
    addRecord({
      id: correction?.id ?? `new-${Date.now()}`,
      prestadorId: person.id,
      prestador: person.nome,
      local: personal ? person.local : local,
      data: date.split("-").reverse().join("/"),
      entrada: entry,
      saida: exit,
      horas: minutes / 60,
      atividade: activity.trim(),
      supervisor: person.supervisor,
      status: "Pendente",
    });
    toast.success("Registro enviado para validação nesta sessão.");
    setSent(true);
    onDone?.();
  }
  if (sent)
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h2 className="font-display text-2xl font-bold">Registro enviado</h2>
        <p className="text-sm text-muted-foreground">{duration} · Aguardando validação</p>
        <Button
          className="h-12"
          onClick={() => {
            setSent(false);
            setActivity("");
            setNote("");
            setPhoto("");
            go(0);
          }}
        >
          Registrar mais horas
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className={cn("hour-wizard", sidebarHeader ? "wizard-dialog-layout" : "space-y-6")}>
      <div className={sidebarHeader ? "wizard-sidebar" : undefined}>
      {sidebarHeader}
      {sidebarHeader && (
        <div className="px-7 pt-6">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>PROGRESSO DO REGISTRO</span>
            <span className="text-primary">{step + 1} / 3</span>
          </div>
          <progress aria-label="Progresso do registro" max={3} value={step + 1} className="wizard-progress" />
        </div>
      )}
      <ol aria-label="Etapas do registro" className={cn("grid", sidebarHeader ? "wizard-step-list" : "grid-cols-3 gap-2 sm:gap-4")}>
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={cn(
              sidebarHeader ? "wizard-step" : "flex min-w-0 flex-col gap-2 border-t-2 pt-3 text-xs sm:flex-row sm:items-center sm:text-sm",
              index <= step ? "border-primary text-primary" : "border-border text-muted-foreground",
              sidebarHeader && step === index && "bg-card shadow-card",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={index > step}
              aria-label={`Etapa ${index + 1}: ${label}`}
              onClick={() => index < step && go(index)}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full font-semibold disabled:opacity-100",
                sidebarHeader && "size-10 rounded-lg",
                index < step ? "bg-success-soft text-success hover:bg-success-soft" : index === step ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {index < step ? <Check className="size-4" /> : `0${index + 1}`}
            </Button>
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              {sidebarHeader && <span className="mt-1 block text-xs font-normal text-muted-foreground">{["Prestador e período", "Descrição e comprovante", "Revisão e envio"][index]}</span>}
            </span>
          </li>
        ))}
      </ol>
      {sidebarHeader && (
        <div className="mt-auto border-t px-7 py-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock className="size-4" /> RESUMO DO REGISTRO</p>
          <p className="text-sm font-semibold">{person?.nome}</p>
          <p className="mt-1 text-xs text-muted-foreground">{shownDate} · {entry} – {exit}</p>
          <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Horas calculadas</span><strong className="text-lg text-success">{minutes ? duration : "—"}</strong></div>
        </div>
      )}
      </div>
      <div className={sidebarHeader ? "wizard-main" : "space-y-6"}>
      <div className={cn("space-y-6", sidebarHeader && "wizard-fields")}>
      <div>
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
          Etapa {step + 1} de 3
        </p>
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-display text-xl font-bold outline-none sm:text-2xl"
        >
          {["Quando foi a prestação?", "O que foi realizado?", "Confira seu registro"][step]}
        </h2>
      </div>
      {correction?.motivo && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">{correction.motivo}</p>
      )}
      {step === 0 && (
        <div className="space-y-5">
          {!personal ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="provider" className="flex items-center gap-2">
                  <UserRound className="size-4 text-primary" />
                  Prestador
                </Label>
                <select
                  id="provider"
                  required
                  className="h-14 w-full min-w-0 rounded-lg border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    chooseLocal(prestadores.find((p) => p.id === e.target.value)?.local ?? "");
                  }}
                >
                  {prestadores
                    .filter((p) => p.situacao === "Ativo")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="local" className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  Local
                </Label>
                <select
                  id="local"
                  required
                  className="h-14 w-full min-w-0 rounded-lg border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
                  value={local}
                  onChange={(e) => chooseLocal(e.target.value)}
                >
                  {locais.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="border-l-2 border-primary pl-3">
              <p className="font-semibold">{person?.nome}</p>
              <p className="text-sm text-muted-foreground">{person?.local}</p>
            </div>
          )}
          <DateField id="date" label="Data da prestação" required value={date} onChange={setDate} pattern={workspace?.formatoData} className="h-14 w-full min-w-0 bg-card text-base" />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Período</legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Manhã", time: "08:00–12:00", start: "08:00", end: "12:00", icon: Sun },
                { label: "Tarde", time: "13:00–17:00", start: "13:00", end: "17:00", icon: Sunset },
              ].map((period) => {
                const selected = entry === period.start && exit === period.end;
                return (
                  <Button
                    key={period.label}
                    type="button"
                    variant="outline"
                    aria-pressed={selected}
                    onClick={() => {
                      setEntry(period.start);
                      setExit(period.end);
                      setError("");
                    }}
                    className={cn(
                      "h-auto min-h-20 justify-start gap-3 whitespace-normal rounded-lg px-3 py-3 text-left",
                      selected && "border-primary bg-info-soft text-info hover:bg-info-soft",
                    )}
                  >
                    <period.icon className="size-5" />
                    <span>
                      <span className="block font-semibold">{period.label}</span>
                      <span className="block text-xs font-normal">{period.time}</span>
                    </span>
                    {selected && <Check className="ml-auto" />}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <TimeField id="Entrada" label="Entrada" value={entry} onChange={setEntry} />
            <TimeField id="Saída" label="Saída" value={exit} onChange={setExit} />
          </div>
          <p className="text-xs text-muted-foreground">Informe o horário real, com minutos. Ex.: 08:10 e 10:40.</p>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-success-soft p-4 text-success">
            <Clock className="size-5" />
            <span className="text-sm font-medium">Total de horas</span>
            <strong className="text-xl">{minutes ? duration : "—"}</strong>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Atividades frequentes</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {activities.map((text, i) => (
                <Button
                  key={text}
                  type="button"
                  variant="outline"
                  aria-pressed={activity === text}
                  className={cn(
                    "h-auto min-h-20 justify-start whitespace-normal rounded-lg p-4 text-left sm:flex-col sm:items-start",
                    activity === text && "border-primary bg-info-soft text-info",
                  )}
                  onClick={() => setActivity(text)}
                >
                  {i === 0 ? <BookOpen /> : <ClipboardList />}
                  <span>{text}</span>
                </Button>
              ))}
            </div>
            {workspace && !activities.length && <p className="mt-3 text-sm text-muted-foreground">Este local ainda não tem atividades frequentes. Cadastre-as em Locais de prestação ou descreva a atividade abaixo.</p>}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="activity">Atividade realizada</Label>
            <Textarea
              id="activity"
              required
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Descreva a atividade realizada"
              className="min-h-24 bg-card text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20 bg-card text-base"
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            aria-label="Anexar foto"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? "")}
          />
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-16 min-w-0 flex-1 justify-start whitespace-normal border-dashed p-4 text-left"
              onClick={() => fileInput.current?.click()}
            >
              <Camera className="shrink-0" />
              <span className="min-w-0 break-all">{photo || "Anexar foto (opcional)"}</span>
            </Button>
            {photo && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover foto"
                onClick={() => {
                  setPhoto("");
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b pb-5">
            <div className="grid size-12 place-items-center rounded-lg bg-info-soft text-info">
              <UserRound />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{person?.nome}</p>
              <p className="text-sm text-muted-foreground">{personal ? person?.local : local}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Data</dt>
              <dd className="mt-2 font-semibold">{shownDate}</dd>
            </div>
            <div className="rounded-lg bg-success-soft p-4 text-success">
              <dt className="text-xs">Total de horas</dt>
              <dd className="mt-2 text-xl font-bold">{duration}</dd>
            </div>
            <div className="col-span-2 border-b pb-4">
              <dt className="text-xs text-muted-foreground">Entrada e saída</dt>
              <dd className="mt-1 text-lg font-semibold">
                {entry} – {exit}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Atividade realizada</dt>
              <dd className="mt-1 break-words font-medium">{activity}</dd>
            </div>
            {note && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Observações</dt>
                <dd className="mt-1 break-words text-sm">{note}</dd>
              </div>
            )}
            {photo && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Foto</dt>
                <dd className="mt-1 break-all text-sm">{photo}</dd>
              </div>
            )}
          </dl>
          <p className="flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />O registro ficará aguardando validação.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      </div>
      <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t pt-5 sm:flex sm:justify-between", sidebarHeader && "wizard-footer")}>
        {step > 0 ? (
          <Button type="button" variant="outline" className="h-12" onClick={() => go(step - 1)}>
            <ArrowLeft />
            Voltar
          </Button>
        ) : (
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Clock className="size-4" />{sidebarHeader ? "Registro de frequência" : ""}</span>
        )}
        <Button type="submit" className="h-12 text-base sm:min-w-56">
          {step === 2 ? (
            <>
              <Send />
              Enviar para validação
            </>
          ) : (
            <>
              {step === 1 ? "Conferir registro" : "Continuar"}
              <ArrowRight />
            </>
          )}
        </Button>
      </div>
      </div>
    </form>
  );
}
