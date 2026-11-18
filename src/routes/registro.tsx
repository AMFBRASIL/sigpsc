import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { HourForm } from "@/components/sigpsc/hour-form";
import { meta } from "@/lib/meta";
export const Route = createFileRoute("/registro")({ head: () => meta("Registrar horas", "Registro de entrada, saída e atividade com conferência antes do envio."), component: Registro });
function Registro() { return <div className="mx-auto max-w-2xl"><PageHeader title="Registrar horas" subtitle="Registro de frequência" /><Panel><HourForm /></Panel></div>; }
