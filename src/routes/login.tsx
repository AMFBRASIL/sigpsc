import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/login")({ head: () => meta("Entrar", "Acesso restrito para servidores e supervisores do SIGPSC."), component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [token] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("redefinir") ?? ""));
  const enviar = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    setAviso("");
    const pedido = token
      ? api("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ token, senha }) })
      : api("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, senha }) });
    void pedido.then(() => nav({ to: "/" })).catch((error: unknown) => setErro(error instanceof Error ? error.message : "Falha no acesso")).finally(() => setEnviando(false));
  };
  const esqueci = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!email.includes("@")) { setErro("Informe o e-mail institucional."); return; }
    setErro("");
    void api("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }).then(() => setAviso("Se o e-mail existir, o link de redefinição foi enviado.")).catch((error: unknown) => setErro(error instanceof Error ? error.message : "Não foi possível enviar"));
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-hero p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-gradient-brand"><Scale className="size-5" /></div><span className="font-display text-lg font-bold">SIGPSC</span></div>
        <div><h1 className="font-display text-4xl font-bold leading-tight">Gestão integrada da prestação de serviços à comunidade.</h1><p className="mt-4 max-w-md text-sidebar-foreground/70">Cadastro, horas, escalas e documentos judiciais em um único lugar.</p></div>
        <p className="flex items-center gap-2 text-sm text-sidebar-foreground/60"><ShieldCheck className="size-4" />Dados protegidos conforme a LGPD</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm space-y-5" onSubmit={enviar}>
          <div className="flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-lg bg-gradient-brand text-primary-foreground"><Scale className="size-5" /></div><span className="font-display text-lg font-bold">SIGPSC</span></div>
          <div><h2 className="font-display text-2xl font-bold">Entrar</h2><p className="text-sm text-muted-foreground">Use suas credenciais institucionais</p></div>
          <div className="space-y-1.5"><Label htmlFor="e">E-mail ou CPF</Label><Input id="e" className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></div>
          <div className="space-y-1.5"><div className="flex justify-between"><Label htmlFor="s">{token ? "Nova senha" : "Senha"}</Label>{!token && <a href="#redefinir" className="text-xs font-medium text-primary" onClick={esqueci}>Esqueci a senha</a>}</div><Input id="s" type="password" className="h-11" value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete={token ? "new-password" : "current-password"} /></div>
          {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <Button type="submit" size="lg" className="h-11 w-full" disabled={enviando}>{enviando ? "Enviando…" : token ? "Redefinir senha" : "Acessar sistema"}</Button>
        </form>
      </div>
    </div>
  );
}
