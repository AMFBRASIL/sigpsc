import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Info, XCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { notificacoes as notificacoesMock } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { useDemo } from "@/lib/daily-demo";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/notificacoes")({ head: () => meta("Notificações", "Alertas de prazos, pendências e prestadores sem registros."), component: Notif });
const ic = { alerta: [AlertTriangle, "bg-warning-soft text-warning"], info: [Info, "bg-info-soft text-info"], erro: [XCircle, "bg-danger-soft text-danger"], sucesso: [CheckCircle2, "bg-success-soft text-success"] } as const;

function actionLabel(link: string) {
  if (link.startsWith("/validacao")) return "Ir para validação";
  if (link.startsWith("/registro")) return "Ir para registro";
  if (link.startsWith("/prestadores/")) return "Ver prestador";
  if (link.startsWith("/prestadores")) return "Ver prestadores";
  if (link.startsWith("/dia")) return "Ver lista do dia";
  if (link.startsWith("/documentos")) return "Ver documentos";
  if (link.startsWith("/relatorios")) return "Ver relatórios";
  return "Abrir aviso";
}

function resolveLink(n: { id: string; titulo: string; texto: string; link?: string }) {
  if (n.link) return n.link;
  const text = `${n.titulo} ${n.texto}`.toLocaleLowerCase("pt-BR");
  if (n.id === "pendentes" || text.includes("validação") || text.includes("validacao")) return "/validacao";
  if (n.id.startsWith("prazo-")) return `/prestadores/${n.id.slice(6)}`;
  if (n.id === "sem-registro" || text.includes("sem registro")) return "/prestadores";
  if (text.includes("correção") || text.includes("correcao") || text.includes("recusado")) return "/registro";
  return undefined;
}

function Notif() {
  const router = useRouter();
  const { workspace, reload } = useDemo();
  const notificacoes = workspace?.notificacoes.length ? workspace.notificacoes : notificacoesMock;
  const marcar = () => { void api("/api/v1/notifications/read", { method: "POST", body: JSON.stringify({ ids: notificacoes.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0) }) }).then(() => reload()); };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notificações" subtitle="Central de alertas" actions={<Button variant="outline" size="sm" onClick={marcar}>Marcar todas como lidas</Button>} />
      <div className="space-y-3">
        {notificacoes.map((n) => {
          const [I, c] = ic[n.tipo as keyof typeof ic] ?? ic.info;
          const href = resolveLink(n);
          return (
            <div key={n.id} className="flex gap-3 rounded-xl border bg-card p-4 shadow-card">
              <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${c}`}><I className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{n.titulo}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{n.tempo}</span>
                </div>
                <p className="text-sm text-muted-foreground">{n.texto}</p>
                {href && (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => router.history.push(href)}>
                      {actionLabel(href)}
                      <ArrowRight />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
