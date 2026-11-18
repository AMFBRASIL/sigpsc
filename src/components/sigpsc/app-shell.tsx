import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LayoutDashboard, Users, Clock, CheckCheck, CalendarDays, FileText, BarChart3, Bell, Settings, ChevronsLeft, Scale, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/prestadores", label: "Prestadores", icon: Users },
  { to: "/registro", label: "Registrar horas", icon: Clock },
  { to: "/validacao", label: "Validação", icon: CheckCheck },
  { to: "/escalas", label: "Escalas", icon: CalendarDays },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;
const mobileNav = [nav[0], nav[1], nav[2], nav[3]];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  const Brand = ({ small }: { small?: boolean }) => (
    <div className="flex items-center gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-brand text-sidebar-primary-foreground shadow-glow"><Scale className="size-5" /></div>
      {!small && <div className="leading-tight"><p className="font-display text-base font-bold text-sidebar-foreground">SIGPSC</p><p className="text-[11px] text-sidebar-foreground/60">Gestão de PSC</p></div>}
    </div>
  );
  const Links = ({ small, onClick }: { small?: boolean; onClick?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-1">
      {nav.map((n) => (
        <Link key={n.to} to={n.to} onClick={onClick} title={n.label}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            active(n.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground", small && "justify-center px-0")}>
          <n.icon className={cn("size-[18px] shrink-0", active(n.to) && "text-sidebar-primary")} />
          {!small && <span>{n.label}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-all duration-300 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
        <div className={cn("mb-6 flex items-center px-1 pt-2", collapsed ? "justify-center" : "justify-between")}>
          <Brand small={collapsed} />
        </div>
        <Links small={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="mt-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/60" aria-label="Recolher menu">
          <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />{!collapsed && "Recolher"}
        </button>
        <Link to="/login" className={cn("mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60", collapsed && "justify-center")}><LogOut className="size-[18px]" />{!collapsed && "Sair"}</Link>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay animate-in fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar p-4 animate-in slide-in-from-left">
            <div className="mb-6 flex items-center justify-between"><Brand /><button onClick={() => setDrawer(false)} className="text-sidebar-foreground" aria-label="Fechar"><X className="size-5" /></button></div>
            <Links onClick={() => setDrawer(false)} />
            <Link to="/login" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70"><LogOut className="size-[18px]" />Sair</Link>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Buscar prestador, processo ou CPF…" className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="font-display font-bold sm:hidden">SIGPSC</p>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/notificacoes" className="relative grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Notificações">
              <Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-danger" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">AS</div>
              <div className="hidden leading-tight md:block"><p className="text-sm font-semibold">Ana Souza</p><p className="text-xs text-muted-foreground">Coordenadora</p></div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileNav.map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active(n.to) ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="size-5" />{n.label.split(" ")[0]}
          </Link>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"><Menu className="size-5" />Mais</button>
      </nav>
    </div>
  );
}
