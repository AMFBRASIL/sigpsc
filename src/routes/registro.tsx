import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HourRegistrationDialog } from "@/components/sigpsc/hour-registration-dialog";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/registro")({ head: () => meta("Registrar horas", "Registro de entrada, saída e atividade com conferência antes do envio."), component: Registro });

function Registro() {
  const navigate = useNavigate();
  return <HourRegistrationDialog open onOpenChange={(open) => { if (!open) void navigate({ to: "/" }); }} />;
}
