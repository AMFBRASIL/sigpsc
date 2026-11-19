import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { FileText, Upload, Download, Eye, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { StatusBadge } from "@/components/sigpsc/status-badge";
import { Button } from "@/components/ui/button";
import { documentos as documentosMock } from "@/lib/mock-data";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/documentos")({ head: () => meta("Documentos", "Relatórios, declarações e ofícios para o Poder Judiciário."), component: Docs });
const modelos = ["Relatório de cumprimento", "Declaração de conclusão", "Comunicação de ausência", "Folha de frequência"];

function Docs() {
  const { workspace, prestadores, reload } = useDemo();
  const documentos = workspace?.documentos ?? documentosMock;
  const fileRef = useRef<HTMLInputElement>(null);
  const alvo = prestadores.find((item) => item.situacao === "Ativo") ?? prestadores[0];
  const emitir = (tipo: string) => {
    if (!alvo) { toast.error("Nenhum prestador disponível"); return; }
    void fetch("/api/v1/documents/generate", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-sigpsc-request": "1" }, body: JSON.stringify({ prestadorId: Number(alvo.id), tipo }) })
      .then(async (response) => { if (!response.ok) throw new Error("Falha"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "documento.pdf"; link.click(); URL.revokeObjectURL(url); await reload(); toast.success(`${tipo} gerado`); })
      .catch(() => toast.error("Não foi possível gerar o documento"));
  };
  const enviar = (file: File) => {
    if (!alvo?.processoId) return;
    const body = new FormData();
    body.append("file", file);
    body.append("prestadorId", alvo.id);
    body.append("processoId", alvo.processoId);
    void fetch("/api/v1/documents/upload", { method: "POST", credentials: "include", headers: { "x-sigpsc-request": "1" }, body })
      .then(async (response) => { if (!response.ok) throw new Error("Falha"); await reload(); toast.success("Arquivo enviado"); })
      .catch(() => toast.error("Não foi possível enviar o arquivo"));
  };
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Documentos" subtitle="Gestão digital e emissão para o fórum" actions={<><input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) enviar(file); }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Enviar arquivo</Button></>} />
      <h2 className="mb-3 font-display text-sm font-semibold">Emitir documento</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{modelos.map((m) => (
        <button key={m} onClick={() => emitir(m)} className="group rounded-xl border bg-card p-4 text-left shadow-card transition hover:border-primary">
          <FilePlus className="mb-3 size-6 text-primary" /><p className="text-sm font-semibold">{m}</p><p className="text-xs text-muted-foreground">Gerar PDF</p></button>))}</div>
      <h2 className="mb-3 font-display text-sm font-semibold">Recentes</h2>
      <div className="divide-y rounded-xl border bg-card shadow-card">{documentos.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-lg bg-info-soft text-info"><FileText className="size-5" /></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{d.nome}</p><p className="text-xs text-muted-foreground">{d.tipo} · {d.data} · {d.tamanho}</p></div>
          <StatusBadge status={d.status} />
          <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Visualizar"><Eye /></Button><Button variant="ghost" size="icon" aria-label="Baixar"><Download /></Button></div>
        </div>))}</div>
    </div>
  );
}
