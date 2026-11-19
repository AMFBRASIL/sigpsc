import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IdCard, Mail, Palette, Shield, MapPin, CircleCheck, Plus, Search, UserCog } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { WizardDialog, FieldLabel, ChoiceCard, ColorPicker, avatarColors } from "@/components/sigpsc/wizard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { initialProfiles, initialUsers, locais, initials, type SystemUser } from "@/lib/access-demo";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/usuarios")({ head: () => meta("Usuários do sistema", "Cadastre e gerencie as contas da equipe do SIGPSC."), component: Usuarios });

const steps = [
  { title: "Quem está chegando?", hint: "Nome, e-mail e cor do avatar", icon: IdCard },
  { title: "Perfil de acesso", hint: "Defina o que a pessoa pode ver", icon: Shield },
  { title: "Local de atuação", hint: "Unidade ou todos os locais", icon: MapPin },
  { title: "Revisão", hint: "Confira e cadastre", icon: CircleCheck },
];
const blank = { name: "", email: "", color: 0, profile: "", local: "" };

function Usuarios() {
  const { workspace, reload } = useDemo();
  const profiles = workspace?.perfis.length ? workspace.perfis : initialProfiles;
  const places = workspace?.locais.length ? ["Todos os locais", ...workspace.locais.map((item) => item.nome)] : locais;
  const [users, setUsers] = useState<SystemUser[]>(initialUsers);
  useEffect(() => { if (workspace?.usuarios.length) setUsers(workspace.usuarios); }, [workspace]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const [q, setQ] = useState("");
  const list = useMemo(() => users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())), [users, q]);
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";
  const valid = [form.name.trim().length > 2 && /\S+@\S+\.\S+/.test(form.email), !!form.profile, !!form.local, true][step];

  const start = () => { setForm(blank); setStep(0); setOpen(true); };
  const finish = () => {
    const localId = form.local === "Todos os locais" ? null : workspace?.locais.find((item) => item.nome === form.local)?.id ?? null;
    void api<{ senhaTemporaria: string }>("/api/v1/users", { method: "POST", body: JSON.stringify({ nome: form.name, email: form.email, perfilId: Number(form.profile), localId, cor: form.color }) })
      .then(async (created) => { await reload(); setOpen(false); toast.success(`${form.name} foi cadastrado(a)`, { description: `Senha temporária: ${created.senhaTemporaria}` }); })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar"));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Usuários do sistema" subtitle={`${users.filter((u) => u.active).length} ativos de ${users.length} contas`} actions={<Button onClick={start}><Plus />Novo usuário</Button>} />
      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" className="h-11 pl-9" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((u) => (
          <article key={u.id} className={cn("rounded-xl border bg-card p-4 shadow-card", !u.active && "opacity-60")}>
            <div className="flex items-center gap-3">
              <div className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground", avatarColors[u.color])}>{initials(u.name)}</div>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
              <Switch checked={u.active} aria-label={`Ativar ${u.name}`} onCheckedChange={(v) => { setUsers((all) => all.map((x) => (x.id === u.id ? { ...x, active: v } : x))); void api(`/api/v1/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ ativo: v }) }).catch(() => reload()); }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground"><Shield className="size-3" />{profileName(u.profile)}</span>
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><MapPin className="size-3 shrink-0" /><span className="truncate">{u.local}</span></span>
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><UserCog className="mx-auto mb-2 size-6" />Nenhum usuário encontrado.</p>}
      </div>

      <WizardDialog open={open} onOpenChange={setOpen} badge="Novo usuário" headline="Faça a equipe crescer junto." steps={steps} step={step} setStep={setStep} canContinue={valid} onFinish={finish}>
        {step === 0 && <>
          <div><FieldLabel>Nome completo</FieldLabel><Input className="h-12 text-base" placeholder="Ex.: Maria Fernanda Costa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><FieldLabel icon={Mail}>E-mail</FieldLabel><Input className="h-12 text-base" type="email" placeholder="maria@sigpsc.gov.br" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><FieldLabel icon={Palette}>Cor do avatar</FieldLabel><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></div>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card"><div className={cn("grid size-12 place-items-center rounded-full font-bold text-primary-foreground", avatarColors[form.color])}>{initials(form.name)}</div><div><p className="font-semibold">{form.name || "Nome do usuário"}</p><p className="text-xs text-muted-foreground">Pré-visualização do cartão</p></div></div>
        </>}
        {step === 1 && <div className="grid gap-3">{profiles.map((p) => <ChoiceCard key={p.id} selected={form.profile === p.id} onClick={() => setForm({ ...form, profile: p.id })} icon={Shield} title={p.name} hint={`${p.description} · ${p.screens.length} telas`} color={avatarColors[p.color]} />)}</div>}
        {step === 2 && <div className="grid gap-3 sm:grid-cols-2">{places.map((l) => <ChoiceCard key={l} selected={form.local === l} onClick={() => setForm({ ...form, local: l })} icon={MapPin} title={l} hint={l === "Todos os locais" ? "Acesso a todas as unidades" : "Unidade de prestação"} />)}</div>}
        {step === 3 && <div className="divide-y rounded-xl border bg-card shadow-card">{[["Nome", form.name], ["E-mail", form.email], ["Perfil", profileName(form.profile)], ["Local", form.local]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 p-4 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>)}</div>}
      </WizardDialog>
    </div>
  );
}
