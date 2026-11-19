import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIso, maskDateInput, normalizeDatePattern, parseDateInput, type DatePattern } from "@/lib/date-format";
import { cn } from "@/lib/utils";

function isoToLocal(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
function localToIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateField({ id, label, ariaLabel, value, onChange, pattern, required, className }: { id?: string; label?: string; ariaLabel?: string; value: string; onChange: (iso: string) => void; pattern?: string | null; required?: boolean; className?: string }) {
  const resolved: DatePattern = normalizeDatePattern(pattern);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const root = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatIso(value, resolved));
  useEffect(() => {
    if (!focused.current) setText(formatIso(value, resolved));
  }, [value, resolved]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const choose = (iso: string) => {
    onChange(iso);
    setText(formatIso(iso, resolved));
    focused.current = false;
    setOpen(false);
  };
  const field = (
    <div ref={root} className="relative">
      <Input
        id={inputId}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={resolved}
        aria-label={ariaLabel ?? label}
        value={text}
        className={cn(className, "pr-12")}
        onFocus={() => { focused.current = true; }}
        onChange={(event) => {
          const next = maskDateInput(event.target.value, resolved);
          setText(next);
          if (next === "" || parseDateInput(next, resolved)) onChange(parseDateInput(next, resolved));
        }}
        onBlur={() => {
          focused.current = false;
          const iso = parseDateInput(text, resolved);
          onChange(iso);
          setText(formatIso(iso, resolved));
        }}
      />
      <button type="button" aria-label="Abrir calendário" aria-expanded={open} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground" onClick={() => setOpen((current) => !current)}>
        <CalendarDays className="size-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 rounded-xl border bg-popover shadow-md">
          <Calendar mode="single" locale={ptBR} weekStartsOn={1} selected={isoToLocal(value)} defaultMonth={isoToLocal(value)} onSelect={(day) => { if (day) choose(localToIso(day)); }} />
        </div>
      )}
    </div>
  );
  if (!label) return field;
  return <div className="space-y-1.5"><Label htmlFor={inputId}>{label}</Label>{field}</div>;
}
