import { LayoutDashboard, ListTodo, Users, Clock, CheckCheck, CalendarDays, FileText, BarChart3, Bell, Settings, UserCog, ShieldCheck, type LucideIcon } from "lucide-react";

export type Screen = { id: string; name: string; hint: string; area: string; icon: LucideIcon };
export const screens: Screen[] = [
  { id: "dashboard", name: "Dashboard", hint: "Visão geral e indicadores", area: "Principal", icon: LayoutDashboard },
  { id: "dia", name: "Lista do dia", hint: "Pendências e prazos do dia", area: "Principal", icon: ListTodo },
  { id: "prestadores", name: "Prestadores", hint: "Cadastro e perfis", area: "Acompanhamento", icon: Users },
  { id: "registro", name: "Registrar horas", hint: "Lançamento de frequência", area: "Acompanhamento", icon: Clock },
  { id: "validacao", name: "Validação", hint: "Aprovar ou devolver horas", area: "Acompanhamento", icon: CheckCheck },
  { id: "escalas", name: "Escalas", hint: "Agenda dos locais", area: "Acompanhamento", icon: CalendarDays },
  { id: "documentos", name: "Documentos", hint: "Ofícios e anexos judiciais", area: "Judicial", icon: FileText },
  { id: "relatorios", name: "Relatórios", hint: "Emissão para o juízo", area: "Judicial", icon: BarChart3 },
  { id: "notificacoes", name: "Notificações", hint: "Alertas e avisos", area: "Sistema", icon: Bell },
  { id: "usuarios", name: "Usuários", hint: "Contas da equipe", area: "Sistema", icon: UserCog },
  { id: "perfis", name: "Perfis", hint: "Permissões de acesso", area: "Sistema", icon: ShieldCheck },
  { id: "configuracoes", name: "Configurações", hint: "Preferências gerais", area: "Sistema", icon: Settings },
];
export const areas = ["Principal", "Acompanhamento", "Judicial", "Sistema"];

export type Profile = { id: string; name: string; description: string; color: number; screens: string[] };
export const initialProfiles: Profile[] = [
  { id: "admin", name: "Administrador", description: "Acesso total ao sistema", color: 6, screens: screens.map((s) => s.id) },
  { id: "coord", name: "Coordenador(a)", description: "Gestão de prestadores e relatórios", color: 0, screens: ["dashboard", "dia", "prestadores", "registro", "validacao", "escalas", "documentos", "relatorios", "notificacoes"] },
  { id: "sup", name: "Supervisor(a) de local", description: "Registra e acompanha a frequência", color: 2, screens: ["dashboard", "dia", "registro", "escalas"] },
  { id: "juridico", name: "Jurídico", description: "Documentos e relatórios judiciais", color: 5, screens: ["dashboard", "documentos", "relatorios"] },
];

export type SystemUser = { id: string; name: string; email: string; profile: string; local: string; color: number; active: boolean };
export const initialUsers: SystemUser[] = [
  { id: "1", name: "Ana Souza", email: "ana.souza@sigpsc.gov.br", profile: "coord", local: "Todos os locais", color: 0, active: true },
  { id: "2", name: "Roberto Dias", email: "roberto.dias@sigpsc.gov.br", profile: "sup", local: "Escola Municipal Dom Pedro", color: 2, active: true },
  { id: "3", name: "Luciana Prado", email: "luciana.prado@sigpsc.gov.br", profile: "sup", local: "UBS Vila Nova", color: 3, active: true },
  { id: "4", name: "Marcos Teixeira", email: "marcos.t@sigpsc.gov.br", profile: "admin", local: "Todos os locais", color: 6, active: true },
  { id: "5", name: "Fernanda Lopes", email: "fernanda.lopes@sigpsc.gov.br", profile: "juridico", local: "Todos os locais", color: 5, active: false },
];
export const locais = ["Todos os locais", "Escola Municipal Dom Pedro", "UBS Vila Nova", "Parque Ecológico", "Centro de Assistência Social", "Biblioteca Pública"];
export const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
