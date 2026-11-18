import { createFileRoute } from "@tanstack/react-router";
import { Shield, Users, MapPin, History } from "lucide-react";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/configuracoes")({ head: () => meta("Configurações", "Usuários, permissões, locais e auditoria do sistema."), component: Config });
const usuarios = [["Ana Souza", "Coordenadora"], ["Roberto Dias", "Supervisor"], ["Luciana Prado", "Supervisora"], ["Marcos Teixeira", "Administrador"]];
const audit = [["18/11 10:42", "Ana Souza aprovou 4h de Carlos E. Lima"], ["18/11 09:15", "Roberto Dias registrou horas de Juliana Martins"], ["17/11 16:30", "Ana Souza emitiu relatório judicial"], ["17/11 11:02", "Marcos Teixeira alterou permissões"]];

function Config() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Configurações" subtitle="Administração do sistema" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Usuários e perfis" action={<Button size="sm" variant="outline"><Users />Convidar</Button>}>
          <ul className="divide-y">{usuarios.map(([n, r]) => <li key={n} className="flex items-center gap-3 py-2.5"><div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{(n ?? "").split(" ").map((x) => x[0]).join("")}</div><p className="flex-1 text-sm font-medium">{n}</p><span className="text-xs text-muted-foreground">{r}</span></li>)}</ul>
        </Panel>
        <Panel title="Segurança e privacidade">
          <ul className="space-y-4">{[["Autenticação em duas etapas", true], ["Ocultar CPF nas listagens", true], ["Exigir foto no registro de horas", false], ["Alertas por e-mail", true]].map(([l, v]) => <li key={l as string} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><Shield className="size-4 text-muted-foreground" />{l}</span><Switch defaultChecked={v as boolean} /></li>)}</ul>
        </Panel>
        <Panel title="Locais de prestação"><ul className="space-y-2 text-sm">{["Escola Municipal Dom Pedro", "UBS Vila Nova", "Parque Ecológico", "Centro de Assistência Social", "Biblioteca Pública"].map((l) => <li key={l} className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{l}</li>)}</ul></Panel>
        <Panel title="Auditoria recente"><ul className="space-y-3">{audit.map(([t, a]) => <li key={t} className="flex gap-3 text-sm"><History className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p>{a}</p><p className="text-xs text-muted-foreground">{t}</p></div></li>)}</ul></Panel>
      </div>
    </div>
  );
}
