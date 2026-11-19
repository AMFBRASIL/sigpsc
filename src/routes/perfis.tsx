import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Shield, Save, Plus, Search, Users, IdCard, LayoutGrid, CircleCheck, Palette } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { WizardDialog, FieldLabel, ColorPicker, avatarColors } from "@/components/sigpsc/wizard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { areas, initialProfiles, initialUsers, screens, type Profile } from "@/lib/access-demo";
import { cn } from "@/lib/utils";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/perfis")({ head: () => meta("Perfis de acesso", "Defina quais telas cada perfil da equipe pode abrir."), component: Perfis });

const steps = [
  { title: "Identidade do perfil", hint: "Nome, descrição e cor", icon: IdCard },
  { title: "Telas liberadas", hint: "O que este perfil pode abrir", icon: LayoutGrid },
  { title: "Revisão", hint: "Confira e crie", icon: CircleCheck },
];
const members = (id: string) => initialUsers.filter((u) => u.profile === id).length;

function ScreenToggles({ value, onChange, query = "", area }: { value: string[]; onChange: (s: string[]) => void; query?: string; area?: string }) {
  const list = screens.filter((s) => (!area || s.area === area) && s.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {list.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><s.icon className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.hint}</p></div>
          <Switch aria-label={s.name} checked={value.includes(s.id)} onCheckedChange={(v) => onChange(v ? [...value, s.id] : value.filter((x) => x !== s.id))} />
        </li>
      ))}
      {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma tela encontrada.</li>}
    </ul>
  );
}

function Perfis() {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [sel, setSel] = useState(profiles[0]!.id);
  const [area, setArea] = useState(areas[0]!);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Omit<Profile, "id">>({ name: "", description: "", color: 0, screens: ["dashboard"] });
  const p = profiles.find((x) => x.id === sel)!;
  const update = (patch: Partial<Profile>) => setProfiles((all) => all.map((x) => (x.id === sel ? { ...x, ...patch } : x)));
  const start = () => { setDraft({ name: "", description: "", color: 0, screens: ["dashboard"] }); setStep(0); setOpen(true); };
  const finish = () => { const id = crypto.randomUUID(); setProfiles((a) => [...a, { id, ...draft }]); setSel(id); setOpen(false); toast.success(`Perfil “${draft.name}” criado`); };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Perfis de acesso" subtitle="Quem pode abrir cada tela do sistema" actions={<Button onClick={start}><Plus />Novo perfil</Button>} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border bg-card p-3 shadow-card">
          <p className="flex justify-between px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground"><span>Perfis</span><span>{profiles.length}</span></p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {profiles.map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={cn("flex min-w-56 items-center gap-3 rounded-xl border border-transparent p-3 text-left lg:min-w-0", sel === x.id ? "border-primary bg-secondary" : "hover:bg-muted")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-primary-foreground", avatarColors[x.color])}><Shield className="size-5" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{x.name}</span><span className="block text-xs text-muted-foreground">{x.screens.length} de {screens.length} telas · {members(x.id)} membros</span></span>
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card xl:flex-row xl:items-center">
            <span className={cn("hidden size-11 shrink-0 place-items-center rounded-xl text-primary-foreground xl:grid", avatarColors[p.color])}><ShieldCheck className="size-5" /></span>
            <Input aria-label="Nome do perfil" value={p.name} onChange={(e) => update({ name: e.target.value })} className="h-11 xl:max-w-56" />
            <Input aria-label="Descrição" value={p.description} onChange={(e) => update({ description: e.target.value })} className="h-11 flex-1" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">{avatarColors.map((c, i) => <button key={c} aria-label={`Cor ${i + 1}`} onClick={() => update({ color: i })} className={cn("size-7 rounded-full", c, p.color === i && "ring-2 ring-ring ring-offset-2")} />)}</div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />{members(p.id)} · {p.screens.length}/{screens.length}</span>
              <Button onClick={() => toast.success("Perfil salvo")}><Save />Salvar</Button>
            </div>
          </section>
          <section className="rounded-xl border bg-card p-4 shadow-card">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display font-semibold">Telas <span className="text-sm font-normal text-muted-foreground">de {p.name}</span></h2>
              <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tela" className="pl-9" /></div>
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {areas.map((a) => { const all = screens.filter((s) => s.area === a); return <button key={a} onClick={() => setArea(a)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", area === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary")}>{a} {all.filter((s) => p.screens.includes(s.id)).length}/{all.length}</button>; })}
            </div>
            <ScreenToggles value={p.screens} onChange={(s) => update({ screens: s })} query={q} area={area} />
          </section>
        </div>
      </div>

      <WizardDialog open={open} onOpenChange={setOpen} badge="Novo perfil" headline="Acesso certo para cada pessoa." steps={steps} step={step} setStep={setStep} canContinue={step !== 0 || draft.name.trim().length > 2} onFinish={finish} finishLabel="Criar perfil">
        {step === 0 && <>
          <div><FieldLabel>Nome do perfil</FieldLabel><Input className="h-12 text-base" placeholder="Ex.: Assistente social" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><FieldLabel>Descrição</FieldLabel><Input className="h-12 text-base" placeholder="O que este perfil faz no dia a dia" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div><FieldLabel icon={Palette}>Cor</FieldLabel><ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} /></div>
        </>}
        {step === 1 && areas.map((a) => <div key={a}><FieldLabel>{a}</FieldLabel><ScreenToggles area={a} value={draft.screens} onChange={(s) => setDraft({ ...draft, screens: s })} /></div>)}
        {step === 2 && <div className="rounded-xl border bg-card p-5 shadow-card"><div className="flex items-center gap-3"><span className={cn("grid size-12 place-items-center rounded-xl text-primary-foreground", avatarColors[draft.color])}><Shield /></span><div><p className="font-semibold">{draft.name}</p><p className="text-sm text-muted-foreground">{draft.description || "Sem descrição"}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{screens.filter((s) => draft.screens.includes(s.id)).map((s) => <span key={s.id} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{s.name}</span>)}</div></div>}
      </WizardDialog>
    </div>
  );
}
