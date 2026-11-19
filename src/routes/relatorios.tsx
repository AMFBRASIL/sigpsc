import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileDown, Clock, Users, UserX, MapPin, Gavel, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/relatorios")({ head: () => meta("Relatórios", "Relatórios gerenciais de frequência, horas, saldos e cumprimento."), component: Rel });
const rel = [
  { t: "Frequência individual", d: "Registros por prestador e período", i: Clock }, { t: "Horas por período", d: "Total realizado e validado", i: BarChart3 },
  { t: "Prestadores ativos", d: "Situação atual e saldos", i: Users }, { t: "Ausências e justificativas", d: "Faltas no período", i: UserX },
  { t: "Produtividade por local", d: "Horas por instituição", i: MapPin }, { t: "Consolidado mensal", d: "Visão geral do mês", i: CalendarRange },
  { t: "Cumprimento judicial", d: "Para encaminhamento ao fórum", i: Gavel }, { t: "Sem registros recentes", d: "Mais de 30 dias sem atividade", i: UserX },
];

function Rel() {
  const { prestadores } = useDemo();
  const alvo = prestadores.find((item) => item.situacao === "Ativo") ?? prestadores[0];
  const pdf = () => {
    if (!alvo) { toast.error("Nenhum prestador disponível"); return; }
    void fetch("/api/v1/documents/generate", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-sigpsc-request": "1" }, body: JSON.stringify({ prestadorId: Number(alvo.id), tipo: "Relatório de cumprimento" }) })
      .then(async (response) => { if (!response.ok) throw new Error("Falha"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "relatorio.pdf"; link.click(); URL.revokeObjectURL(url); toast.success("PDF gerado"); })
      .catch(() => toast.error("Não foi possível gerar o PDF"));
  };
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Relatórios" subtitle="Selecione o relatório e o período" />
      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row">
        <input type="date" defaultValue="2026-11-01" className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm" />
        <input type="date" defaultValue="2026-11-30" className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm" />
        <select className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"><option>Todas as unidades</option><option>Unidade Central</option></select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rel.map((r) => (
        <div key={r.t} className="flex flex-col rounded-xl border bg-card p-4 shadow-card">
          <r.i className="mb-3 size-6 text-primary" /><p className="font-semibold">{r.t}</p><p className="mb-4 flex-1 text-xs text-muted-foreground">{r.d}</p>
          <div className="flex gap-2"><Button size="sm" className="flex-1" onClick={pdf}><FileDown />PDF</Button><Button size="sm" variant="outline" className="flex-1" onClick={() => { void downloadFile("/api/v1/reports/attendance?formato=xlsx", "frequencia.xlsx").then(() => toast.success("Planilha gerada")).catch(() => toast.error("Não foi possível exportar")); }}>Excel</Button></div>
        </div>))}</div>
    </div>
  );
}
