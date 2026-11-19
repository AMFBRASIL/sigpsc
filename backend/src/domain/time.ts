export class TimeRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeRuleError";
  }
}

export function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function durationMinutes(entry: string, exit: string, interval = 0): number {
  const start = toMinutes(entry);
  const end = toMinutes(exit);
  if (start == null || end == null) throw new TimeRuleError("Horário inválido.");
  if (end <= start) throw new TimeRuleError("A saída deve ser depois da entrada.");
  if (!Number.isInteger(interval) || interval < 0 || interval >= end - start) {
    throw new TimeRuleError("Intervalo inválido.");
  }
  return end - start - interval;
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function balance(determinedMinutes: number, validatedMinutes: number) {
  const determined = Math.max(0, Math.trunc(determinedMinutes));
  const validated = Math.max(0, Math.trunc(validatedMinutes));
  const remaining = Math.max(0, determined - validated);
  const percent = determined === 0 ? 0 : (validated / determined) * 100;
  return { determined, validated, remaining, percent };
}

export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatClock(minutes: number): string {
  const whole = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}min`;
}

export function weekRange(isoDate: string): { start: string; end: string } {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) throw new TimeRuleError("Data inválida.");
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: isoFromUtc(start), end: isoFromUtc(end) };
}

export function isoFromUtc(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function todayIso(timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtc(date);
}

export function dateForDb(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function timeForDb(value: string): Date {
  const minutes = toMinutes(value);
  if (minutes == null) throw new TimeRuleError("Horário inválido.");
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60, 0));
}

export function formatIsoDate(value: Date): string {
  return isoFromUtc(value);
}

export function formatBrDate(value: Date | null | undefined): string {
  if (!value) return "—";
  const iso = formatIsoDate(value);
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatHm(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

export function brToIso(value: string): string {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return value;
  return `${year}-${month}-${day}`;
}
