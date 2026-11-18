import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { locais } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/prestadores/novo")({ head: () => meta("Novo prestador", "Cadastro de prestador em etapas: dados pessoais, judiciais e acompanhamento."), component: Novo });
const etapas = ["Dados pessoais", "Dados judiciais", "Acompanhamento"];
const F = ({ label, ...p }: { label: string } & React.ComponentProps<typeof Input>) => <div className="space-y-1.5"><Label>{label}</Label><Input {...p} /></div>;
const sel = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

function Novo() {
  const [step, setStep] = useState(0); const nav = useNavigate();
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
        {step === 0 && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><F label="Nome completo" placeholder="Ex.: Maria da Silva" /></div><F label="CPF" placeholder="000.000.000-00" /><F label="RG" /><F label="Data de nascimento" type="date" /><F label="Telefone" placeholder="(00) 00000-0000" /><div className="sm:col-span-2"><F label="E-mail" type="email" /></div><div className="sm:col-span-2"><F label="Endereço completo" /></div></div>}
        {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><F label="Número do processo" placeholder="0000000-00.0000.0.00.0000" /></div><F label="Vara judicial" /><F label="Comarca" /><F label="Data da decisão" type="date" /><F label="Início autorizado" type="date" /><F label="Total de horas" type="number" /><F label="Limite semanal (h)" type="number" /><div className="space-y-1.5 sm:col-span-2"><Label>Restrições</Label><Textarea placeholder="Horários ou atividades não permitidas" /></div></div>}
        {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Local de prestação</Label><select className={sel}>{locais.map((l) => <option key={l}>{l}</option>)}</select></div><div className="space-y-1.5"><Label>Supervisor</Label><select className={sel}><option>Ana Souza</option><option>Roberto Dias</option><option>Luciana Prado</option></select></div><div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea /></div></div>}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
          {step < 2 ? <Button onClick={() => setStep(step + 1)}>Continuar</Button> : <Button onClick={() => { toast.success("Prestador cadastrado (demonstração)"); nav({ to: "/prestadores" }); }}>Salvar cadastro</Button>}
        </div>
      </Panel>
    </div>
  );
}
