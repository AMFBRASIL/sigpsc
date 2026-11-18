export type Situacao = "Ativo" | "Concluído" | "Suspenso" | "Pendente";
export interface Prestador {
  id: string; nome: string; cpf: string; processo: string; vara: string; comarca: string;
  local: string; supervisor: string; horasTotais: number; horasCumpridas: number; horasPendentes: number;
  situacao: Situacao; inicio: string; prazo: string; telefone: string; ultimoRegistro: string;
}
export const prestadores: Prestador[] = [
  { id: "1", nome: "Carlos Eduardo Lima", cpf: "123.456.789-00", processo: "0001234-56.2026.8.26.0100", vara: "1ª Vara Criminal", comarca: "São Paulo", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza", horasTotais: 240, horasCumpridas: 198, horasPendentes: 8, situacao: "Ativo", inicio: "10/02/2026", prazo: "10/12/2026", telefone: "(11) 98765-4321", ultimoRegistro: "17/11/2026" },
  { id: "2", nome: "Mariana Alves Rocha", cpf: "234.567.890-11", processo: "0002345-67.2026.8.26.0100", vara: "2ª Vara Criminal", comarca: "São Paulo", local: "UBS Vila Nova", supervisor: "Roberto Dias", horasTotais: 120, horasCumpridas: 120, horasPendentes: 0, situacao: "Concluído", inicio: "05/01/2026", prazo: "05/09/2026", telefone: "(11) 97654-3210", ultimoRegistro: "02/09/2026" },
  { id: "3", nome: "João Pedro Santos", cpf: "345.678.901-22", processo: "0003456-78.2026.8.26.0050", vara: "Juizado Especial Criminal", comarca: "Guarulhos", local: "Parque Ecológico", supervisor: "Ana Souza", horasTotais: 180, horasCumpridas: 64, horasPendentes: 12, situacao: "Ativo", inicio: "15/06/2026", prazo: "15/03/2027", telefone: "(11) 96543-2109", ultimoRegistro: "16/11/2026" },
  { id: "4", nome: "Fernanda Costa Melo", cpf: "456.789.012-33", processo: "0004567-89.2026.8.26.0100", vara: "3ª Vara Criminal", comarca: "São Paulo", local: "Centro de Assistência Social", supervisor: "Luciana Prado", horasTotais: 300, horasCumpridas: 142, horasPendentes: 0, situacao: "Suspenso", inicio: "20/03/2026", prazo: "20/03/2027", telefone: "(11) 95432-1098", ultimoRegistro: "28/09/2026" },
  { id: "5", nome: "Ricardo Gomes Neto", cpf: "567.890.123-44", processo: "0005678-90.2026.8.26.0050", vara: "1ª Vara Criminal", comarca: "Guarulhos", local: "Biblioteca Pública", supervisor: "Roberto Dias", horasTotais: 90, horasCumpridas: 82, horasPendentes: 4, situacao: "Ativo", inicio: "01/08/2026", prazo: "01/01/2027", telefone: "(11) 94321-0987", ultimoRegistro: "18/11/2026" },
  { id: "6", nome: "Patrícia Ribeiro", cpf: "678.901.234-55", processo: "0006789-01.2026.8.26.0100", vara: "Vara de Execuções", comarca: "São Paulo", local: "UBS Vila Nova", supervisor: "Luciana Prado", horasTotais: 160, horasCumpridas: 0, horasPendentes: 0, situacao: "Pendente", inicio: "01/12/2026", prazo: "01/08/2027", telefone: "(11) 93210-9876", ultimoRegistro: "—" },
  { id: "7", nome: "André Luiz Ferreira", cpf: "789.012.345-66", processo: "0007890-12.2026.8.26.0100", vara: "2ª Vara Criminal", comarca: "São Paulo", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza", horasTotais: 200, horasCumpridas: 110, horasPendentes: 6, situacao: "Ativo", inicio: "12/04/2026", prazo: "12/02/2027", telefone: "(11) 92109-8765", ultimoRegistro: "15/11/2026" },
  { id: "8", nome: "Juliana Martins", cpf: "890.123.456-77", processo: "0008901-23.2026.8.26.0050", vara: "Juizado Especial Criminal", comarca: "Guarulhos", local: "Parque Ecológico", supervisor: "Roberto Dias", horasTotais: 60, horasCumpridas: 54, horasPendentes: 3, situacao: "Ativo", inicio: "03/09/2026", prazo: "03/12/2026", telefone: "(11) 91098-7654", ultimoRegistro: "18/11/2026" },
];
export const horasPorMes = [
  { mes: "Jun", horas: 412 }, { mes: "Jul", horas: 486 }, { mes: "Ago", horas: 530 },
  { mes: "Set", horas: 498 }, { mes: "Out", horas: 572 }, { mes: "Nov", horas: 389 },
];
export const horasPorLocal = [
  { local: "Escola D. Pedro", horas: 820 }, { local: "UBS Vila Nova", horas: 640 },
  { local: "Parque Ecológico", horas: 512 }, { local: "Assist. Social", horas: 430 }, { local: "Biblioteca", horas: 298 },
];
export const registrosPendentes = [
  { id: "r1", prestador: "Carlos Eduardo Lima", data: "17/11/2026", entrada: "08:00", saida: "12:00", horas: 4, atividade: "Organização da biblioteca escolar", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza" },
  { id: "r2", prestador: "João Pedro Santos", data: "16/11/2026", entrada: "13:00", saida: "17:00", horas: 4, atividade: "Manutenção de trilhas", local: "Parque Ecológico", supervisor: "Ana Souza" },
  { id: "r3", prestador: "Ricardo Gomes Neto", data: "18/11/2026", entrada: "09:00", saida: "13:00", horas: 4, atividade: "Catalogação de acervo", local: "Biblioteca Pública", supervisor: "Roberto Dias" },
  { id: "r4", prestador: "Juliana Martins", data: "18/11/2026", entrada: "08:00", saida: "11:00", horas: 3, atividade: "Plantio de mudas", local: "Parque Ecológico", supervisor: "Roberto Dias" },
  { id: "r5", prestador: "André Luiz Ferreira", data: "15/11/2026", entrada: "14:00", saida: "16:00", horas: 2, atividade: "Apoio na merenda", local: "Escola Municipal Dom Pedro", supervisor: "Ana Souza" },
];
export const documentos = [
  { id: "d1", nome: "Relatório de cumprimento — Carlos E. Lima", tipo: "Relatório judicial", data: "14/11/2026", status: "Assinado", tamanho: "248 KB" },
  { id: "d2", nome: "Declaração de conclusão — Mariana A. Rocha", tipo: "Declaração", data: "03/09/2026", status: "Enviado ao fórum", tamanho: "112 KB" },
  { id: "d3", nome: "Termo de compromisso — Patrícia Ribeiro", tipo: "Termo", data: "12/11/2026", status: "Aguardando assinatura", tamanho: "96 KB" },
  { id: "d4", nome: "Comunicação de ausência — Fernanda C. Melo", tipo: "Ofício", data: "30/09/2026", status: "Enviado ao fórum", tamanho: "88 KB" },
  { id: "d5", nome: "Folha de frequência — Outubro/2026", tipo: "Frequência", data: "01/11/2026", status: "Rascunho", tamanho: "320 KB" },
  { id: "d6", nome: "Decisão judicial — João P. Santos", tipo: "Decisão", data: "10/06/2026", status: "Arquivado", tamanho: "1,2 MB" },
];
export const escalas = [
  { dia: "Seg", data: "16/11", itens: [{ prestador: "Carlos E. Lima", horario: "08:00–12:00", local: "Escola D. Pedro" }, { prestador: "André L. Ferreira", horario: "14:00–18:00", local: "Escola D. Pedro" }] },
  { dia: "Ter", data: "17/11", itens: [{ prestador: "João P. Santos", horario: "13:00–17:00", local: "Parque Ecológico" }] },
  { dia: "Qua", data: "18/11", itens: [{ prestador: "Ricardo G. Neto", horario: "09:00–13:00", local: "Biblioteca" }, { prestador: "Juliana Martins", horario: "08:00–11:00", local: "Parque Ecológico" }, { prestador: "Carlos E. Lima", horario: "08:00–12:00", local: "Escola D. Pedro" }] },
  { dia: "Qui", data: "19/11", itens: [{ prestador: "André L. Ferreira", horario: "14:00–18:00", local: "Escola D. Pedro" }] },
  { dia: "Sex", data: "20/11", itens: [{ prestador: "João P. Santos", horario: "08:00–12:00", local: "Parque Ecológico" }, { prestador: "Juliana Martins", horario: "08:00–11:00", local: "Parque Ecológico" }] },
  { dia: "Sáb", data: "21/11", itens: [{ prestador: "Ricardo G. Neto", horario: "08:00–12:00", local: "Biblioteca" }] },
];
export const notificacoes = [
  { id: "n1", titulo: "Prazo de relatório se aproxima", texto: "Relatório de Juliana Martins deve ser enviado ao fórum até 25/11.", tempo: "há 2 h", tipo: "alerta" },
  { id: "n2", titulo: "5 registros aguardando validação", texto: "Supervisores enviaram novas horas para validação.", tempo: "há 4 h", tipo: "info" },
  { id: "n3", titulo: "Prestador sem registro recente", texto: "Fernanda Costa Melo sem registros há mais de 30 dias.", tempo: "ontem", tipo: "erro" },
  { id: "n4", titulo: "Cumprimento quase concluído", texto: "Ricardo Gomes Neto atingiu 91% das horas determinadas.", tempo: "ontem", tipo: "sucesso" },
];
export const locais = ["Escola Municipal Dom Pedro", "UBS Vila Nova", "Parque Ecológico", "Centro de Assistência Social", "Biblioteca Pública"];
