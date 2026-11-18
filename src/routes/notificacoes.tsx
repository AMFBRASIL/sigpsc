import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Info, XCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { notificacoes } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/notificacoes")({ head: () => meta("Notificações", "Alertas de prazos, pendências e prestadores sem registros."), component: Notif });
const ic = { alerta: [AlertTriangle, "bg-warning-soft text-warning"], info: [Info, "bg-info-soft text-info"], erro: [XCircle, "bg-danger-soft text-danger"], sucesso: [CheckCircle2, "bg-success-soft text-success"] } as const;

function Notif() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notificações" subtitle="Central de alertas" actions={<Button variant="outline" size="sm">Marcar todas como lidas</Button>} />
      <div className="space-y-3">{notificacoes.map((n) => { const [I, c] = ic[n.tipo as keyof typeof ic]; return (
        <div key={n.id} className="flex gap-3 rounded-xl border bg-card p-4 shadow-card">
          <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${c}`}><I className="size-5" /></div>
          <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-semibold">{n.titulo}</p><span className="shrink-0 text-xs text-muted-foreground">{n.tempo}</span></div><p className="text-sm text-muted-foreground">{n.texto}</p></div>
        </div>); })}</div>
    </div>
  );
}
