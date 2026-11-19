import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { prestadores, registrosPendentes } from "@/lib/mock-data";
import { api } from "@/lib/api";

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
export type Workspace = {
  user: { nome: string; perfil: string };
  prestadores: Array<(typeof prestadores)[number] & { processoId?: string; percentual?: number; limiteSemanal?: number | null; minutosRestantes?: number }>;
  records: HourRecord[];
  locais: { id: number; nome: string }[];
  atividades?: { id: number; nome: string; localId: number | null }[];
  supervisores: { id: number; nome: string }[];
  documentos: { id: string; nome: string; tipo: string; data: string; status: string; tamanho: string }[];
  escalas: { dia: string; data: string; itens: { prestador: string; horario: string; local: string }[] }[];
  notificacoes: { id: string; titulo: string; texto: string; tempo: string; tipo: string }[];
  formatoData?: string;
  dashboard: { kpis: { label: string; value: string; hint: string }[]; horasPorMes: { mes: string; horas: number }[]; horasPorLocal: { local: string; horas: number }[]; situacao: { name: string; value: number }[]; semRegistro: number };
  usuarios: { id: string; name: string; email: string; profile: string; local: string; color: number; active: boolean }[];
  perfis: { id: string; name: string; description: string; color: number; screens: string[] }[];
  agenda: { prestadorId: string; date: string; time: string; activity: string }[];
  dia: { id: string; personId: string; name: string; category: string; title: string; detail: string; date: string }[];
};
const live = import.meta.env.MODE !== "test";
type Demo = { records: HourRecord[]; prestadores: Workspace["prestadores"]; workspace: Workspace | null; ready: boolean; reload: () => Promise<void>; addRecord: (record: HourRecord) => void; review: (ids: string[], status: HourRecord["status"], motivo?: string) => void };
const DemoContext = createContext<Demo | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState(live ? [] : initialRecords);
  const [people, setPeople] = useState<Workspace["prestadores"]>(live ? [] : prestadores);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [pathname, setPathname] = useState(typeof window === "undefined" ? "/" : window.location.pathname);
  const reload = async () => {
    const data = await api<Workspace>("/api/v1/workspace");
    setWorkspace(data);
    setPeople(data.prestadores);
    setRecords(data.records);
  };
  useEffect(() => {
    if (!live) return;
    const sync = () => setPathname(window.location.pathname);
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = ((...args: Parameters<History["pushState"]>) => { push(...args); sync(); }) as History["pushState"];
    history.replaceState = ((...args: Parameters<History["replaceState"]>) => { replace(...args); sync(); }) as History["replaceState"];
    window.addEventListener("popstate", sync);
    sync();
    return () => {
      history.pushState = push;
      history.replaceState = replace;
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    if (!live || pathname === "/login" || workspace) return;
    reload().catch(() => window.location.assign("/login"));
  }, [pathname, workspace]);
  const addRecord = (record: HourRecord) => {
    setRecords((rows) => [...rows.filter((r) => r.id !== record.id), record]);
    if (!live) return;
    const person = people.find((item) => item.id === record.prestadorId);
    if (!person?.processoId) return;
    const [day, month, year] = record.data.split("/");
    const localId = workspace?.locais.find((item) => item.nome === record.local)?.id;
    const body = JSON.stringify({ prestadorId: Number(record.prestadorId), processoId: Number(person.processoId), data: `${year}-${month}-${day}`, entrada: record.entrada, saida: record.saida, atividade: record.atividade, ...(localId ? { localId } : {}) });
    const existing = /^\d+$/.test(record.id);
    void api(existing ? `/api/v1/attendance/${record.id}` : "/api/v1/attendance", { method: existing ? "PATCH" : "POST", body }).then(() => reload()).catch(() => reload());
  };
  const review = (ids: string[], status: HourRecord["status"], motivo?: string) => {
    setRecords((rows) => rows.map((r) => ids.includes(r.id) && (r.status === "Pendente" || (r.status === "Aprovado" && status !== "Aprovado")) ? { ...r, status, motivo } : r));
    if (!live) return Promise.resolve();
    return api("/api/v1/attendance/batch", { method: "POST", body: JSON.stringify({ ids: ids.map(Number), status, motivo }) }).then(() => reload()).catch(async (error: unknown) => { await reload(); throw error; });
  };
  if (live && !workspace && pathname !== "/login") return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando dados…</div>;
  return <DemoContext.Provider value={{ records, prestadores: people, workspace, ready: !live || workspace !== null || pathname === "/login", reload, addRecord, review }}>{children}</DemoContext.Provider>;
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