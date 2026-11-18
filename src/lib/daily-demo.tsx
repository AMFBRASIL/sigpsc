import { createContext, useContext, useState, type ReactNode } from "react";
import { prestadores, registrosPendentes } from "@/lib/mock-data";

export type HourRecord = (typeof registrosPendentes)[number] & { prestadorId: string; status: "Pendente" | "Aprovado" | "Correção" | "Recusado"; motivo?: string | undefined };
export const initialRecords: HourRecord[] = registrosPendentes.map((r) => ({ ...r, prestadorId: prestadores.find((p) => p.nome === r.prestador)?.id ?? "", status: "Pendente" }));
initialRecords.push({ ...initialRecords[0], id: "h-approved", prestadorId: "1", prestador: "Carlos Eduardo Lima", data: "14/11/2026", entrada: "08:00", saida: "12:00", horas: 4, atividade: "Apoio na biblioteca", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza", status: "Aprovado" });
initialRecords.push({ ...initialRecords[0], id: "h-correction", prestadorId: "1", prestador: "Carlos Eduardo Lima", data: "16/11/2026", entrada: "08:00", saida: "11:00", horas: 3, atividade: "Organização do acervo", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza", status: "Correção", motivo: "Confirme o horário de saída: a folha de frequência indica 11:30." });
export function durationMinutes(entry: string, exit: string) {
  if (!/^\d{2}:\d{2}$/.test(entry) || !/^\d{2}:\d{2}$/.test(exit)) return 0;
  const [h = 0, m = 0] = entry.split(":").map(Number);
  const [j = 0, n = 0] = exit.split(":").map(Number);
  if (h > 23 || j > 23 || m > 59 || n > 59) return 0;
  return Math.max(0, j * 60 + n - h * 60 - m);
}
export function recordsFor(records: HourRecord[], id: string) { return records.filter((r) => r.prestadorId === id); }
export function selectedSummary(records: HourRecord[], ids: string[]) {
  const selected = records.filter((r) => ids.includes(r.id) && r.status === "Pendente");
  return { selected, hours: selected.reduce((total, r) => total + r.horas, 0) };
}
type Demo = { records: HourRecord[]; addRecord: (record: HourRecord) => void; review: (ids: string[], status: HourRecord["status"], motivo?: string) => void };
const DemoContext = createContext<Demo | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState(initialRecords);
  return <DemoContext.Provider value={{ records, addRecord: (record) => setRecords((rows) => [...rows.filter((r) => r.id !== record.id), record]), review: (ids, status, motivo) => setRecords((rows) => rows.map((r) => ids.includes(r.id) && r.status === "Pendente" ? { ...r, status, motivo } : r)) }}>{children}</DemoContext.Provider>;
}
export function useDemo() { const value = useContext(DemoContext); if (!value) throw new Error("DemoProvider required"); return value; }
export const personalAgenda = [
  { date: "19/11/2026", time: "08:00–12:00", activity: "Organização da biblioteca escolar" },
  { date: "23/11/2026", time: "08:00–12:00", activity: "Apoio na biblioteca" },
];
export const personalDocuments = [
  { id: "pd1", name: "Termo de compromisso", date: "10/02/2026", status: "Assinado" },
  { id: "pd2", name: "Relatório de cumprimento", date: "14/11/2026", status: "Assinado" },
  { id: "pd3", name: "Folha de frequência — Outubro", date: "01/11/2026", status: "Disponível" },
];