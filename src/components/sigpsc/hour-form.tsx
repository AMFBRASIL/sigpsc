import { useRef, useState, type FormEvent } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prestadores, locais } from "@/lib/mock-data";
import { durationMinutes, useDemo, type HourRecord } from "@/lib/daily-demo";
import { cn } from "@/lib/utils";

const steps = ["Data e horários", "Atividade", "Conferência"];
const activities = ["Organização do acervo", "Apoio na biblioteca", "Apoio administrativo"];

export function HourForm({
  personal = false,
  correction,
  onDone,
}: {
  personal?: boolean;
  correction?: HourRecord | undefined;
  onDone?: () => void;
}) {
  const { addRecord } = useDemo();
  const [step, setStep] = useState(0);
  const [id, setId] = useState(correction?.prestadorId ?? "1");
  const person = prestadores.find((p) => p.id === id) ?? prestadores[0];
  const [local, setLocal] = useState(correction?.local ?? person?.local ?? "");
  const [date, setDate] = useState(
    correction ? correction.data.split("/").reverse().join("-") : "2026-11-18",
  );
  const [entry, setEntry] = useState(correction?.entrada ?? "08:00");
  const [exit, setExit] = useState(correction?.saida ?? "12:00");
  const [activity, setActivity] = useState(correction?.atividade ?? "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const minutes = durationMinutes(entry, exit);
  const duration = `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  function go(next: number) {
    setStep(next);
    setError("");
    requestAnimationFrame(() => {
      const title = heading.current;
      title?.focus({ preventScroll: true });
      const dialog = title?.closest('[role="dialog"]');
      if (dialog) dialog.scrollTop = 0;
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
    <form onSubmit={submit} className="hour-wizard space-y-6">
      <ol aria-label="Etapas do registro" className="grid grid-cols-3 gap-2 sm:gap-4">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-col gap-2 border-t-2 pt-3 text-xs sm:flex-row sm:items-center sm:text-sm",
              index <= step ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full font-semibold",
                index <= step ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {index < step ? <Check className="size-4" /> : `0${index + 1}`}
            </span>
            <span className="font-medium">{label}</span>
          </li>
        ))}
      </ol>
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
                    setLocal(prestadores.find((p) => p.id === e.target.value)?.local ?? "");
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
                  onChange={(e) => setLocal(e.target.value)}
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
          <div className="space-y-2">
            <Label htmlFor="date">Data da prestação</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-14 w-full min-w-0 bg-card text-base"
            />
          </div>
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
            {[
              { label: "Entrada", value: entry, setter: setEntry },
              { label: "Saída", value: exit, setter: setExit },
            ].map(({ label, value, setter }) => (
              <div key={label} className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-1">
                  <Label htmlFor={label}>{label}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-1 text-xs text-primary"
                    onClick={() => setter(new Date().toTimeString().slice(0, 5))}
                  >
                    <Clock />
                    Agora
                  </Button>
                </div>
                <Input
                  id={label}
                  type="time"
                  required
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="h-14 min-w-0 bg-background px-2 text-xl font-semibold sm:text-2xl"
                />
              </div>
            ))}
          </div>
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
              <dd className="mt-2 font-semibold">{date.split("-").reverse().join("/")}</dd>
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t pt-5 sm:flex sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" className="h-12" onClick={() => go(step - 1)}>
            <ArrowLeft />
            Voltar
          </Button>
        ) : (
          <span />
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
    </form>
  );
}
