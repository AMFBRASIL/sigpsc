import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Phone, Scale, MapPin, User, Calendar, FileDown } from "lucide-react";
import { recordsFor, useDemo } from "@/lib/daily-demo";
import { api } from "@/lib/api";
import { Panel } from "@/components/sigpsc/page-header";
import { StatusBadge } from "@/components/sigpsc/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/prestadores/$id")({
  head: () => meta("Prestador", "Perfil do prestador: dados judiciais, horas e documentos."),
  component: Perfil,
});

function Info({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-medium">{value}</p></div></div>;
}

type Pack = { id: number; fechadoEm: string; periodo: string; dias: number; registros: number; horas: number; minutos: number; horasTexto: string };
function downloadReport(body: object, filename: string) {
  void fetch("/api/v1/documents/generate", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-sigpsc-request": "1" }, body: JSON.stringify(body) }).then(async (response) => {
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}
function Perfil() {
  const { id } = Route.useParams();
  const { records, prestadores, workspace } = useDemo();
  const [packs, setPacks] = useState<Pack[] | null>(null);
  useEffect(() => { void api<Pack[]>(`/api/v1/prestadores/${id}/packages`).then(setPacks).catch(() => setPacks([])); }, [id]);
  const p = prestadores.find((item) => item.id === id);
  if (!p) return <p className="mx-auto max-w-6xl py-16 text-center text-muted-foreground">Prestador não encontrado.</p>;
  const own = recordsFor(records, p.id);
  const history = own.map((r) => ({id: r.id, date: r.data, title: r.atividade, detail: `${r.entrada}–${r.saida} · ${r.horas}h · ${r.status}${r.motivo ? ` · ${r.motivo}` : ""}`, type: "Horas"})).sort((a, b) => b.date.split("/").reverse().join("").localeCompare(a.date.split("/").reverse().join("")));
  const pct = Math.round((p.horasCumpridas / p.horasTotais) * 100);
  const restante = p.horasTotais - p.horasCumpridas;
  const iniciais = p.nome.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/prestadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Prestadores</Link>
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="h-20 bg-gradient-hero sm:h-24" />
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="-mt-10 grid size-20 place-items-center rounded-2xl border-4 border-card bg-primary font-display text-2xl font-bold text-primary-foreground">{iniciais}</div>
          <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-xl font-bold sm:text-2xl">{p.nome}</h1><StatusBadge status={p.situacao} /></div><p className="font-mono text-xs text-muted-foreground">{p.processo}</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => downloadReport({ prestadorId: Number(p.id), tipo: "Relatório de cumprimento" }, "relatorio-geral.pdf")}><FileDown />Relatório geral</Button></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Horas determinadas", `${p.horasTotais}h`], ["Horas validadas", `${p.horasCumpridas}h`], ["Pendentes", `${p.horasPendentes}h`], ["Saldo restante", `${restante}h`]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>))}
      </div>
      <div className="mt-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Cumprimento da pena</span><span className="font-bold text-primary">{pct}%</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} /></div>
      </div>

      <Tabs defaultValue="pacotes" className="mt-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="pacotes">Pacotes do fórum</TabsTrigger>
          <TabsTrigger value="historico">Histórico completo</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="horas">Histórico de horas</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="pacotes" className="mt-4">
          <Panel title="Pacotes fechados para o juiz">
            <p className="mb-4 text-sm text-muted-foreground">As horas enviadas ao juiz no mesmo dia formam um único pacote. O PDF sai como ofício, com os dias e horários daquele fechamento no anexo. Você pode baixar de novo a qualquer momento.</p>
            <div className="space-y-3">
              {(packs ?? []).map((pack) => {
                const file = `pacote-${pack.fechadoEm.split("/").join("-")}.pdf`;
                return (
                  <div key={pack.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-semibold">Fechado em {pack.fechadoEm}</p>
                      <p className="text-sm text-muted-foreground">{pack.periodo} · {pack.dias} {pack.dias === 1 ? "dia" : "dias"} · {pack.registros} {pack.registros === 1 ? "registro" : "registros"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="text-lg text-success">{pack.horasTexto}</strong>
                      <Button size="sm" onClick={() => downloadReport({ prestadorId: Number(p.id), tipo: "Pacote de horas para o fórum", loteId: pack.id }, file)}><FileDown />Relatório do pacote</Button>
                    </div>
                  </div>
                );
              })}
              {packs && !packs.length && <p className="text-sm text-muted-foreground">Nenhum pacote fechado. Aprove as horas juntas na validação para formar o relatório do juiz.</p>}
              {packs === null && <p className="text-sm text-muted-foreground">Carregando pacotes…</p>}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="historico" className="mt-4"><ol className="border-l-2 border-primary/20 pl-5">{history.map((event) => <li key={event.id} className="relative border-b py-4"><span className="absolute -left-[27px] top-5 size-3 rounded-full border-2 border-background bg-primary" /><p className="text-xs font-semibold text-primary">{event.date} · {event.type}</p><p className="mt-1 text-sm font-semibold">{event.title}</p><p className="text-sm text-muted-foreground">{event.detail}</p></li>)}</ol></TabsContent>
        <TabsContent value="dados" className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Dados pessoais"><div className="grid gap-4 sm:grid-cols-2"><Info icon={User} label="CPF" value={p.cpf} /><Info icon={Phone} label="Telefone" value={p.telefone} /><Info icon={Calendar} label="Último registro" value={p.ultimoRegistro} /><Info icon={MapPin} label="Local de prestação" value={p.local} /></div></Panel>
          <Panel title="Dados judiciais"><div className="grid gap-4 sm:grid-cols-2"><Info icon={Scale} label="Vara" value={p.vara} /><Info icon={MapPin} label="Comarca" value={p.comarca} /><Info icon={Calendar} label="Início autorizado" value={p.inicio} /><Info icon={Calendar} label="Prazo judicial" value={p.prazo} /><Info icon={User} label="Supervisor" value={p.supervisor} /><Info icon={FileText} label="Limite semanal" value={p.limiteSemanal ? `${p.limiteSemanal}h por semana` : "Não definido"} /></div></Panel>
        </TabsContent>
        <TabsContent value="horas" className="mt-4"><Panel>
          <ul className="divide-y">{own.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.atividade}</p><p className="text-xs text-muted-foreground">{r.data} · {r.entrada}–{r.saida} · {r.local}</p>{r.motivo && <p className="mt-1 text-xs text-danger">{r.motivo}</p>}</div><span className="font-semibold">{r.horas}h</span><span className="text-xs font-medium">{r.status}</span></li>)}</ul>{!own.length && <p className="text-sm text-muted-foreground">Nenhum registro de horas.</p>}
        </Panel></TabsContent>
        <TabsContent value="docs" className="mt-4"><Panel>
          <ul className="divide-y">{(workspace?.documentos.filter((d) => d.nome.includes(p.nome.split(" ")[0] ?? "")) ?? []).map((d) => (<li key={d.id} className="flex items-center gap-3 py-3"><FileText className="size-5 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.nome}</p><p className="text-xs text-muted-foreground">{d.tipo} · {d.data}</p></div><StatusBadge status={d.status} /></li>))}</ul>
        </Panel></TabsContent>
      </Tabs>
    </div>
  );
}
