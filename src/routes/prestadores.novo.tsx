import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/sigpsc/date-field";
import { api } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/prestadores/novo")({ head: () => meta("Novo prestador", "Cadastro de prestador em etapas: dados pessoais, judiciais e acompanhamento."), component: Novo });
const etapas = ["Dados pessoais", "Dados judiciais", "Acompanhamento"];
const F = ({ label, ...p }: { label: string } & React.ComponentProps<typeof Input>) => <div className="space-y-1.5"><Label>{label}</Label><Input {...p} /></div>;
const sel = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function Novo() {
  const [step, setStep] = useState(0); const nav = useNavigate();
  const { workspace, reload } = useDemo();
  const [form, setForm] = useState({ nome: "", cpf: "", rg: "", dataNascimento: "", telefone: "", email: "", endereco: "", numeroProcesso: "", vara: "", comarca: "", dataDecisao: "", dataInicio: "", horasTotais: "120", limiteSemanal: "12", restricoes: "", localId: "", supervisorId: "", observacoes: "" });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const put = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const locais = workspace?.locais ?? [];
  const supervisores = workspace?.supervisores ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/prestadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Prestadores</Link>
      <PageHeader title="Novo prestador" subtitle="Preencha as informações em etapas" />
      <ol className="mb-6 flex items-center gap-2">{etapas.map((e, i) => (
        <li key={e} className="flex flex-1 items-center gap-2">
          <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i < step ? <Check className="size-4" /> : i + 1}</span>
          <span className={`hidden text-sm font-medium sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{e}</span>
          {i < etapas.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < step ? "bg-primary" : "bg-border"}`} />}
        </li>))}</ol>
      <Panel title={etapas[step]}>
        {step === 0 && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><F label="Nome completo" value={form.nome} onChange={set("nome")} placeholder="Ex.: Maria da Silva" /></div><F label="CPF" value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" /><F label="RG" value={form.rg} onChange={set("rg")} /><DateField label="Data de nascimento" value={form.dataNascimento} onChange={put("dataNascimento")} pattern={workspace?.formatoData} /><F label="Telefone" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" /><div className="sm:col-span-2"><F label="E-mail" type="email" value={form.email} onChange={set("email")} /></div><div className="sm:col-span-2"><F label="Endereço completo" value={form.endereco} onChange={set("endereco")} /></div></div>}
        {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><F label="Número do processo" value={form.numeroProcesso} onChange={set("numeroProcesso")} placeholder="0000000-00.0000.0.00.0000" /></div><F label="Vara judicial" value={form.vara} onChange={set("vara")} /><F label="Comarca" value={form.comarca} onChange={set("comarca")} /><DateField label="Data da decisão" value={form.dataDecisao} onChange={put("dataDecisao")} pattern={workspace?.formatoData} /><DateField label="Início autorizado" value={form.dataInicio} onChange={put("dataInicio")} pattern={workspace?.formatoData} /><F label="Total de horas" type="number" value={form.horasTotais} onChange={set("horasTotais")} /><F label="Limite semanal (h)" type="number" value={form.limiteSemanal} onChange={set("limiteSemanal")} /><div className="space-y-1.5 sm:col-span-2"><Label>Restrições</Label><Textarea value={form.restricoes} onChange={set("restricoes")} placeholder="Horários ou atividades não permitidas" /></div></div>}
        {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Local de prestação</Label><select className={sel} value={form.localId} onChange={set("localId")}>{locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></div><div className="space-y-1.5"><Label>Supervisor</Label><select className={sel} value={form.supervisorId} onChange={set("supervisorId")}>{supervisores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div><div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={set("observacoes")} /></div></div>}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
          {step < 2 ? <Button onClick={() => setStep(step + 1)}>Continuar</Button> : <Button onClick={() => { void api("/api/v1/prestadores", { method: "POST", body: JSON.stringify({ ...form, localId: Number(form.localId || locais[0]?.id), supervisorId: Number(form.supervisorId || supervisores[0]?.id), horasTotais: Number(form.horasTotais), limiteSemanal: Number(form.limiteSemanal), email: form.email || undefined, dataNascimento: form.dataNascimento || undefined, dataDecisao: form.dataDecisao || undefined, dataInicio: form.dataInicio || undefined }) }).then(() => reload()).then(() => { toast.success("Prestador cadastrado"); nav({ to: "/prestadores" }); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar")); }}>Salvar cadastro</Button>}
        </div>
      </Panel>
    </div>
  );
}
