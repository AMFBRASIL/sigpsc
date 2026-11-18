import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/sigpsc/page-header";
import { HourForm } from "@/components/sigpsc/hour-form";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/registro")({
  head: () =>
    meta(
      "Registrar horas",
      "Registro de entrada, saída e atividade com conferência antes do envio.",
    ),
  component: Registro,
});
function Registro() {
  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" className="mb-4 -ml-3">
        <Link to="/">
          <ArrowLeft />
          Início
        </Link>
      </Button>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <Clock className="size-4" />
        Registro de frequência
      </div>
      <PageHeader title="Registrar horas" />
      <HourForm />
    </div>
  );
}
