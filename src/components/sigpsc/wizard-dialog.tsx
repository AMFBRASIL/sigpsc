import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, CalendarDays, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardStep = { title: string; hint: string; icon: LucideIcon };
export const avatarColors = ["bg-chart-1", "bg-danger", "bg-success", "bg-chart-2", "bg-info", "bg-warning", "bg-primary-glow", "bg-chart-3"] as const;

const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

export function WizardDialog({ open, onOpenChange, badge, headline, steps, step, setStep, canContinue = true, onFinish, finishLabel = "Cadastrar", children }: {
  open: boolean; onOpenChange: (o: boolean) => void; badge: string; headline: string; steps: WizardStep[]; step: number; setStep: (n: number) => void;
  canContinue?: boolean | undefined; onFinish: () => void; finishLabel?: string; children: ReactNode;
}) {
  const last = step === steps.length - 1;
  const current = steps[step]!;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hour-registration-dialog flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(820px,92dvh)] sm:w-[calc(100%-3rem)] sm:max-w-6xl sm:rounded-2xl md:grid md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex shrink-0 flex-col bg-gradient-hero px-5 py-5 text-sidebar-foreground md:px-7 md:py-7">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-xs font-semibold"><Sparkles className="size-3.5" />{badge}</span>
          <p className="mt-4 font-display text-xl font-bold leading-tight md:mt-6 md:text-3xl">{headline}</p>
          <p className="mt-2 hidden text-sm capitalize text-sidebar-foreground/70 md:block">{today}</p>
          <ol className="mt-8 hidden flex-1 flex-col justify-center gap-2 md:flex">
            {steps.map((s, i) => (
              <li key={s.title}>
                <button type="button" disabled={i > step} onClick={() => setStep(i)} className={cn("flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors", i === step && "border-sidebar-border bg-sidebar-accent", i < step && "hover:bg-sidebar-accent/60")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border", i === step ? "bg-sidebar-foreground text-sidebar" : i < step ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70")}>
                    {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
                  </span>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{s.title}</span><span className="block truncate text-xs text-sidebar-foreground/60">{s.hint}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-4 md:mt-6">
            <p className="mb-2 text-xs text-sidebar-foreground/70">Passo {step + 1} de {steps.length} · <span className="md:hidden">{current.title}</span></p>
            <div className="h-1.5 overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-sidebar-foreground transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          </div>
        </aside>
        <section className="flex min-h-0 flex-1 flex-col bg-background">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8">
            <p className="mb-5 hidden items-center gap-2 text-sm capitalize text-muted-foreground md:flex"><CalendarDays className="size-4" />{today}</p>
            <DialogTitle className="font-display text-2xl font-bold">{current.title}</DialogTitle>
            <DialogDescription className="mt-1">{current.hint}</DialogDescription>
            <div className="mt-6 space-y-5">{children}</div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-10">
            {step === 0 ? <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button> : <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft />Voltar</Button>}
            <Button size="lg" disabled={!canContinue} onClick={() => (last ? onFinish() : setStep(step + 1))}>{last ? <><Check />{finishLabel}</> : <>Continuar<ArrowRight /></>}</Button>
          </footer>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function FieldLabel({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{Icon && <Icon className="size-3.5" />}{children}</p>;
}

export function ChoiceCard({ selected, onClick, icon: Icon, title, hint, color }: { selected: boolean; onClick: () => void; icon: LucideIcon; title: string; hint: string; color?: string | undefined }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:border-ring", selected && "border-primary ring-2 ring-ring/40")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-primary-foreground", color ?? "bg-primary")}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
      {selected && <Check className="size-5 shrink-0 text-primary" />}
    </button>
  );
}

export function ColorPicker({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {avatarColors.map((c, i) => (
        <button key={c} type="button" aria-label={`Cor ${i + 1}`} onClick={() => onChange(i)} className={cn("size-10 rounded-xl transition-transform hover:scale-105", c, value === i && "ring-2 ring-ring ring-offset-2 ring-offset-background")} />
      ))}
    </div>
  );
}
