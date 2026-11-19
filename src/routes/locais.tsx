import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Building2, CircleCheck, ClipboardList, Clock, HeartPulse, MapPin, Plus, School, Search, Trees, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sigpsc/page-header";
import { ChoiceCard, FieldLabel, WizardDialog } from "@/components/sigpsc/wizard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/locais")({ head: () => meta("Locais de prestação", "Unidades onde a pena é cumprida: endereço, vagas e horário."), component: Locais });

type Place = { id: number; nome: string; tipo: string; endereco: string; cidade: string; cep: string; vagas: number; responsavel: string; telefone: string; email: string; abre: string; fecha: string; ativo: boolean; prestadores: number; atividades: string[] };
type Draft = { tipo: string; nome: string; endereco: string; cidade: string; cep: string; vagas: string; responsavel: string; telefone: string; email: string; abre: string; fecha: string; ativo: boolean; atividades: string[] };
const types = [
  { t: "Escola", h: "Unidades de ensino", icon: School },
  { t: "Saúde", h: "UBS e hospitais", icon: HeartPulse },
  { t: "Assistência social", h: "CRAS, CREAS e ONGs", icon: Users },
  { t: "Ambiental", h: "Parques e praças", icon: Trees },
  { t: "Biblioteca", h: "Acervo e leitura", icon: BookOpen },
  { t: "Outro", h: "Demais unidades", icon: Building2 },
];
const steps = [
  { title: "Tipo", hint: "Natureza do local", icon: Building2 },
  { title: "Endereço", hint: "Onde fica e como falar", icon: MapPin },
  { title: "Vagas", hint: "Capacidade e horários", icon: Users },
  { title: "Atividades", hint: "O que se faz neste local", icon: ClipboardList },
  { title: "Revisão", hint: "Confira e salve", icon: CircleCheck },
];
const blank: Draft = { tipo: "Escola", nome: "", endereco: "", cidade: "São Paulo", cep: "", vagas: "5", responsavel: "", telefone: "", email: "", abre: "08:00", fecha: "17:00", ativo: true, atividades: [] };
const iconOf = (tipo: string) => types.find((item) => item.t === tipo)?.icon ?? MapPin;

function Locais() {
  const { reload } = useDemo();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Draft>(blank);
  const [activityName, setActivityName] = useState("");
  const load = () => api<Place[]>("/api/v1/settings/locations").then(setPlaces).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível carregar os locais"));
  useEffect(() => { void load(); }, []);
  const list = useMemo(() => (places ?? []).filter((item) => `${item.nome} ${item.tipo} ${item.cidade} ${item.endereco}`.toLowerCase().includes(q.toLowerCase())), [places, q]);
  const set = (key: keyof Draft) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const valid = [!!form.tipo, form.nome.trim().length >= 3, Number(form.vagas) >= 0, true, true][step];
  const start = () => { setEditing(null); setForm(blank); setActivityName(""); setStep(0); setOpen(true); };
  const edit = (place: Place) => {
    setEditing(place.id);
    setForm({ tipo: place.tipo, nome: place.nome, endereco: place.endereco, cidade: place.cidade, cep: place.cep, vagas: String(place.vagas), responsavel: place.responsavel, telefone: place.telefone, email: place.email, abre: place.abre || "08:00", fecha: place.fecha || "17:00", ativo: place.ativo, atividades: place.atividades ?? [] });
    setActivityName("");
    setStep(0);
    setOpen(true);
  };
  const addActivity = () => {
    const nome = activityName.trim().replace(/\s+/g, " ");
    if (nome.length < 2 || form.atividades.some((item) => item.localeCompare(nome, "pt-BR", { sensitivity: "accent" }) === 0)) return;
    setForm((current) => ({ ...current, atividades: [...current.atividades, nome] }));
    setActivityName("");
  };
  const payload = (draft: Draft) => ({ nome: draft.nome.trim(), tipo: draft.tipo, endereco: draft.endereco, cidade: draft.cidade, cep: draft.cep, vagas: Number(draft.vagas || 0), responsavel: draft.responsavel, telefone: draft.telefone, email: draft.email, abre: draft.abre, fecha: draft.fecha, ativo: draft.ativo, atividades: draft.atividades });
  const refresh = async () => { await Promise.all([load(), reload()]); };
  const finish = () => {
    const body = JSON.stringify(payload(form));
    const request = editing == null ? api("/api/v1/settings/locations", { method: "POST", body }) : api(`/api/v1/settings/locations/${editing}`, { method: "PATCH", body });
    void request.then(refresh).then(() => { setOpen(false); toast.success(editing == null ? "Local cadastrado" : "Local atualizado"); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar"));
  };
  const toggle = (place: Place, ativo: boolean) => {
    const body = JSON.stringify({ ...place, vagas: place.vagas, ativo });
    void api(`/api/v1/settings/locations/${place.id}`, { method: "PATCH", body }).then(refresh).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível atualizar"));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Locais de prestação" subtitle={places ? `${places.filter((item) => item.ativo).length} ativos de ${places.length} unidades` : "Carregando unidades"} actions={<Button onClick={start}><Plus />Novo local</Button>} />
      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nome, tipo ou cidade" className="h-11 pl-9" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((place) => {
          const Icon = iconOf(place.tipo);
          return (
            <article key={place.id} className={cn("rounded-xl border bg-card p-4 shadow-card", !place.ativo && "opacity-60")}>
              <button type="button" onClick={() => edit(place)} className="flex w-full items-start gap-3 text-left">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{place.nome}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{[place.endereco, place.cidade].filter(Boolean).join(" · ") || "Endereço não informado"}</span>
                </span>
              </button>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{place.tipo}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{place.vagas} vagas</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Clock className="size-3" />{place.abre && place.fecha ? `${place.abre}–${place.fecha}` : "Sem horário"}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><ClipboardList className="size-3" />{place.atividades?.length ? `${place.atividades.length} ${place.atividades.length === 1 ? "atividade" : "atividades"}` : "Sem atividades"}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{place.prestadores === 1 ? "1 prestador ativo" : `${place.prestadores} prestadores ativos`}{place.responsavel ? ` · ${place.responsavel}` : ""}</p>
                <Switch checked={place.ativo} aria-label={`Ativar ${place.nome}`} onCheckedChange={(ativo) => toggle(place, ativo)} />
              </div>
            </article>
          );
        })}
        {places && list.length === 0 && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><MapPin className="mx-auto mb-2 size-6" />Nenhum local encontrado.</p>}
      </div>

      <WizardDialog open={open} onOpenChange={setOpen} badge={editing == null ? "Novo local" : "Editar local"} headline={editing == null ? "Cadastre um local de prestação." : "Atualize os dados da unidade."} steps={steps} step={step} setStep={setStep} canContinue={valid} finishLabel={editing == null ? "Cadastrar" : "Salvar"} onFinish={finish}>
        {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{types.map((item) => <ChoiceCard key={item.t} selected={form.tipo === item.t} onClick={() => set("tipo")(item.t)} icon={item.icon} title={item.t} hint={item.h} />)}</div>}
        {step === 1 && <>
          <div><FieldLabel>Nome do local</FieldLabel><Input className="h-12" placeholder="Ex.: Escola Municipal Dom Pedro" value={form.nome} onChange={(event) => set("nome")(event.target.value)} /></div>
          <div><FieldLabel>Endereço</FieldLabel><Input className="h-12" placeholder="Rua, número e bairro" value={form.endereco} onChange={(event) => set("endereco")(event.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>Cidade</FieldLabel><Input className="h-12" value={form.cidade} onChange={(event) => set("cidade")(event.target.value)} /></div>
            <div><FieldLabel>CEP</FieldLabel><Input className="h-12" placeholder="00000-000" value={form.cep} onChange={(event) => set("cep")(event.target.value)} /></div>
            <div><FieldLabel>Telefone</FieldLabel><Input className="h-12" placeholder="(00) 0000-0000" value={form.telefone} onChange={(event) => set("telefone")(event.target.value)} /></div>
            <div><FieldLabel>E-mail</FieldLabel><Input className="h-12" type="email" placeholder="local@sigpsc.gov.br" value={form.email} onChange={(event) => set("email")(event.target.value)} /></div>
          </div>
        </>}
        {step === 2 && <div className="grid gap-3 sm:grid-cols-2">
          <div><FieldLabel>Vagas</FieldLabel><Input className="h-12" type="number" min={0} value={form.vagas} onChange={(event) => set("vagas")(event.target.value)} /></div>
          <div><FieldLabel>Responsável</FieldLabel><Input className="h-12" placeholder="Nome do responsável" value={form.responsavel} onChange={(event) => set("responsavel")(event.target.value)} /></div>
          <div><FieldLabel>Abre às</FieldLabel><Input className="h-12" type="time" value={form.abre} onChange={(event) => set("abre")(event.target.value)} /></div>
          <div><FieldLabel>Fecha às</FieldLabel><Input className="h-12" type="time" value={form.fecha} onChange={(event) => set("fecha")(event.target.value)} /></div>
        </div>}
        {step === 3 && <div className="space-y-4">
          <div className="flex gap-2">
            <Input className="h-12" placeholder="Ex.: Organização do acervo" value={activityName} onChange={(event) => setActivityName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addActivity(); } }} aria-label="Nova atividade" />
            <Button type="button" className="h-12" disabled={activityName.trim().length < 2} onClick={addActivity}><Plus />Adicionar</Button>
          </div>
          <div className="space-y-2">
            {form.atividades.map((item) => <div key={item} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"><span className="text-sm font-medium">{item}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item}`} onClick={() => setForm((current) => ({ ...current, atividades: current.atividades.filter((name) => name !== item) }))}><X /></Button></div>)}
            {!form.atividades.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma atividade ainda. Elas aparecem ao registrar horas neste local.</p>}
          </div>
        </div>}
        {step === 4 && <div className="divide-y rounded-xl border bg-card shadow-card">{([["Tipo", form.tipo], ["Nome", form.nome], ["Endereço", [form.endereco, form.cidade].filter(Boolean).join(", ") || "—"], ["Vagas", form.vagas], ["Horário", form.abre && form.fecha ? `${form.abre} – ${form.fecha}` : "—"], ["Responsável", form.responsavel || "—"], ["Atividades", form.atividades.join(", ") || "—"]] as const).map(([label, value]) => <div key={label} className="flex justify-between gap-4 p-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>)}</div>}
      </WizardDialog>
    </div>
  );
}
