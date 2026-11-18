import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, LogIn, LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/sigpsc/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { locais, prestadores } from "@/lib/mock-data";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/registro")({ head: () => meta("Registrar horas", "Registro rápido de entrada, saída e atividade pelo celular."), component: Registro });
const sel = "h-11 w-full rounded-lg border bg-card px-3 text-sm";

function Registro() {
  const [ent, setEnt] = useState("08:00"); const [sai, setSai] = useState("12:00");
  const dur = (() => { const [a = 0, b = 0] = ent.split(":").map(Number); const [c = 0, d = 0] = sai.split(":").map(Number); const m = c * 60 + d - (a * 60 + b); return m > 0 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ""}` : "—"; })();
  const now = () => new Date().toTimeString().slice(0, 5);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Registrar horas" subtitle="Registro de frequência — enviado para validação" />
      <Panel>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Local</Label><select className={sel}>{locais.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Prestador</Label><select className={sel}>{prestadores.filter((p) => p.situacao === "Ativo").map((p) => <option key={p.id}>{p.nome}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Data</Label><Input type="date" defaultValue="2026-11-18" className="h-11" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Entrada</Label><Input type="time" value={ent} onChange={(e) => setEnt(e.target.value)} className="h-11" /><Button variant="outline" size="sm" className="w-full" onClick={() => setEnt(now())}><LogIn />Agora</Button></div>
            <div className="space-y-1.5"><Label>Saída</Label><Input type="time" value={sai} onChange={(e) => setSai(e.target.value)} className="h-11" /><Button variant="outline" size="sm" className="w-full" onClick={() => setSai(now())}><LogOut />Agora</Button></div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-info-soft px-4 py-3"><span className="text-sm font-medium text-info">Duração calculada</span><span className="font-display text-xl font-bold text-info">{dur}</span></div>
          <div className="space-y-1.5"><Label>Atividade realizada</Label><Input placeholder="Ex.: Organização do acervo" className="h-11" /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} /></div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-sm text-muted-foreground hover:bg-muted/50"><Camera className="size-5" />Anexar foto (opcional)<input type="file" accept="image/*" capture="environment" className="hidden" /></label>
          <Button size="lg" className="h-12 w-full" onClick={() => toast.success("Registro enviado para validação (demonstração)")}><Send />Enviar para validação</Button>
        </div>
      </Panel>
    </div>
  );
}
