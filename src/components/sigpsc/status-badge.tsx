import { cn } from "@/lib/utils";
const map: Record<string, string> = {
  Ativo: "bg-info-soft text-info", "Concluído": "bg-success-soft text-success", Suspenso: "bg-danger-soft text-danger",
  Pendente: "bg-warning-soft text-warning", "Liberar para juiz": "bg-info-soft text-info", Aprovado: "bg-success-soft text-success", Assinado: "bg-success-soft text-success", "Enviado ao fórum": "bg-info-soft text-info",
  "Aguardando assinatura": "bg-warning-soft text-warning", Rascunho: "bg-muted text-muted-foreground", Arquivado: "bg-muted text-muted-foreground",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", map[status] ?? "bg-muted text-muted-foreground")}><span className="size-1.5 rounded-full bg-current" />{status}</span>;
}
