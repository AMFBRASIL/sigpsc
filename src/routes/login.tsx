import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/login")({ head: () => meta("Entrar", "Acesso restrito para servidores e supervisores do SIGPSC."), component: Login });

function Login() {
  const nav = useNavigate();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-hero p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-gradient-brand"><Scale className="size-5" /></div><span className="font-display text-lg font-bold">SIGPSC</span></div>
        <div><h1 className="font-display text-4xl font-bold leading-tight">Gestão integrada da prestação de serviços à comunidade.</h1><p className="mt-4 max-w-md text-sidebar-foreground/70">Cadastro, horas, escalas e documentos judiciais em um único lugar.</p></div>
        <p className="flex items-center gap-2 text-sm text-sidebar-foreground/60"><ShieldCheck className="size-4" />Dados protegidos conforme a LGPD</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm space-y-5" onSubmit={(e) => { e.preventDefault(); nav({ to: "/" }); }}>
          <div className="flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-lg bg-gradient-brand text-primary-foreground"><Scale className="size-5" /></div><span className="font-display text-lg font-bold">SIGPSC</span></div>
          <div><h2 className="font-display text-2xl font-bold">Entrar</h2><p className="text-sm text-muted-foreground">Use suas credenciais institucionais</p></div>
          <div className="space-y-1.5"><Label htmlFor="e">E-mail ou CPF</Label><Input id="e" className="h-11" defaultValue="ana.souza@prefeitura.gov.br" /></div>
          <div className="space-y-1.5"><div className="flex justify-between"><Label htmlFor="s">Senha</Label><a href="#" className="text-xs font-medium text-primary">Esqueci a senha</a></div><Input id="s" type="password" className="h-11" defaultValue="12345678" /></div>
          <Button type="submit" size="lg" className="h-11 w-full">Acessar sistema</Button>
        </form>
      </div>
    </div>
  );
}
