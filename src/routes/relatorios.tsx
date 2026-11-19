import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileDown, Clock, Users, UserX, MapPin, Gavel, CalendarRange, Eye, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, downloadBlob, downloadFile } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/relatorios")({ head: () => meta("Relatórios", "Relatórios gerenciais de frequência, horas, saldos e cumprimento."), component: Rel });

type ReportTipo =
  | "frequencia"
  | "horas-periodo"
  | "prestadores-ativos"
  | "ausencias"
  | "produtividade-local"
  | "consolidado-mensal"
  | "cumprimento"
  | "sem-registros";

type ReportCard = { id: ReportTipo; t: string; d: string; i: typeof Clock; needsPerson?: boolean };

const rel: ReportCard[] = [
  { id: "frequencia", t: "Frequência individual", d: "Registros por prestador e período", i: Clock, needsPerson: true },
  { id: "horas-periodo", t: "Horas por período", d: "Total realizado e validado", i: BarChart3 },
  { id: "prestadores-ativos", t: "Prestadores ativos", d: "Situação atual e saldos", i: Users },
  { id: "ausencias", t: "Ausências e justificativas", d: "Faltas no período", i: UserX },
  { id: "produtividade-local", t: "Produtividade por local", d: "Horas por instituição", i: MapPin },
  { id: "consolidado-mensal", t: "Consolidado mensal", d: "Visão geral do mês", i: CalendarRange },
  { id: "cumprimento", t: "Cumprimento judicial", d: "Para encaminhamento ao fórum", i: Gavel, needsPerson: true },
  { id: "sem-registros", t: "Sem registros recentes", d: "Mais de 30 dias sem atividade", i: UserX },
];

type Preview = {
  title: string;
  subtitle: string;
  slug: string;
  kpis: { label: string; value: string }[];
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  prestadorId?: number;
  prestadorNome?: string;
};

function monthStartIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "11";
  return `${year}-${month}-01`;
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

function Rel() {
  const { prestadores, workspace } = useDemo();
  const [inicio, setInicio] = useState(monthStartIso);
  const [fim, setFim] = useState(todayIso);
  const [local, setLocal] = useState("");
  const [prestadorId, setPrestadorId] = useState("");
  const [open, setOpen] = useState<ReportCard | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const locais = workspace?.locais ?? [];
  const ativos = useMemo(() => prestadores.filter((item) => item.situacao === "Ativo"), [prestadores]);

  useEffect(() => {
    if (!prestadorId && ativos[0]) setPrestadorId(ativos[0].id);
  }, [ativos, prestadorId]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const qs = queryString({
      tipo: open.id,
      inicio,
      fim,
      local: local || undefined,
      prestadorId: open.needsPerson && prestadorId ? Number(prestadorId) : undefined,
    });
    void api<Preview>(`/api/v1/reports/preview?${qs}`)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview(null);
          toast.error(error instanceof Error ? error.message : "Não foi possível carregar o relatório.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, inicio, fim, local, prestadorId]);

  async function exportExcel() {
    if (!open) return;
    setExporting("xlsx");
    try {
      const qs = queryString({
        tipo: open.id,
        formato: "xlsx",
        inicio,
        fim,
        local: local || undefined,
        prestadorId: open.needsPerson && prestadorId ? Number(prestadorId) : undefined,
      });
      await downloadFile(`/api/v1/reports/export?${qs}`, `${preview?.slug ?? open.id}.xlsx`);
      toast.success("Planilha Excel gerada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar o Excel.");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    if (!open) return;
    setExporting("pdf");
    try {
      await downloadBlob(`/api/v1/reports/pdf`, `${preview?.slug ?? open.id}.pdf`, {
        method: "POST",
        body: JSON.stringify({
          tipo: open.id,
          inicio,
          fim,
          local: local || undefined,
          prestadorId: open.needsPerson && prestadorId ? Number(prestadorId) : undefined,
        }),
      });
      toast.success("PDF gerado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Relatórios" subtitle="Abra o relatório para conferir os dados e exportar em PDF ou Excel" />
      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Início</span>
          <input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fim</span>
          <input type="date" value={fim} onChange={(event) => setFim(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Unidade / local</span>
          <select value={local} onChange={(event) => setLocal(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
            <option value="">Todas as unidades</option>
            {locais.map((item) => (
              <option key={item.id} value={item.nome}>{item.nome}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Prestador</span>
          <select value={prestadorId} onChange={(event) => setPrestadorId(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
            {prestadores.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rel.map((r) => (
          <div key={r.id} className="flex flex-col rounded-xl border bg-card p-4 shadow-card">
            <r.i className="mb-3 size-6 text-primary" />
            <p className="font-semibold">{r.t}</p>
            <p className="mb-4 flex-1 text-xs text-muted-foreground">{r.d}</p>
            <Button size="sm" onClick={() => setOpen(r)}><Eye />Abrir</Button>
          </div>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="flex max-h-[90dvh] w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="font-display text-xl">{open?.t}</DialogTitle>
            <DialogDescription>{preview?.subtitle || open?.d}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {open?.needsPerson && (
              <label className="block max-w-md space-y-1 text-sm">
                <span className="text-muted-foreground">Prestador deste relatório</span>
                <select value={prestadorId} onChange={(event) => setPrestadorId(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                  {prestadores.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </label>
            )}

            {loading && (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando dados do relatório…
              </div>
            )}

            {!loading && preview && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {preview.kpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border bg-muted/40 px-4 py-3">
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="font-display text-xl font-semibold">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <div className="max-h-[48vh] overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                        <tr>
                          {preview.columns.map((column) => (
                            <th key={column.key} className="px-3 py-2.5 font-semibold text-muted-foreground">{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, index) => (
                          <tr key={index} className="border-t">
                            {preview.columns.map((column) => (
                              <td key={column.key} className="px-3 py-2 align-top">{row[column.key] || "—"}</td>
                            ))}
                          </tr>
                        ))}
                        {!preview.rows.length && (
                          <tr>
                            <td colSpan={preview.columns.length} className="px-3 py-10 text-center text-muted-foreground">
                              Nenhum registro encontrado para os filtros selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-between">
            <p className="text-xs text-muted-foreground">Use PDF ou Excel para baixar o conteúdo exibido neste relatório.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!preview || !!exporting} onClick={() => { void exportExcel(); }}>
                {exporting === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                Excel
              </Button>
              <Button disabled={!preview || !!exporting} onClick={() => { void exportPdf(); }}>
                {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
                PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
