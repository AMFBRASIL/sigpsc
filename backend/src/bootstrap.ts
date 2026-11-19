import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth/password";
import { formatCpf, isValidCpf } from "./domain/cpf";
import { dateForDb, timeForDb } from "./domain/time";
import type { PrismaService } from "./prisma.service";

type Db = PrismaClient | PrismaService;

export async function ensureReady(prisma: Db): Promise<void> {
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  const admin = await prisma.usuarios.findUnique({ where: { email: "admin@sigpsc.gov.br" } });
  if (admin && admin.senha_hash.includes("TROQUE_ESTE") && password && password.length >= 12) {
    await prisma.usuarios.update({ where: { id: admin.id }, data: { senha_hash: await hashPassword(password) } });
  }
  await prisma.telas.upsert({
    where: { id: "locais" },
    create: { id: "locais", nome: "Locais de prestação", descricao: "Unidades, endereços e vagas", area: "Sistema", rota: "/locais", icone: "MapPin", ordem: 75 },
    update: { nome: "Locais de prestação", descricao: "Unidades, endereços e vagas", rota: "/locais", icone: "MapPin" },
  });
  const adminPerfil = await prisma.perfis.findFirst({ where: { nome: "Administrador" } });
  if (adminPerfil) {
    await prisma.perfil_telas.upsert({
      where: { perfil_id_tela_id: { perfil_id: adminPerfil.id, tela_id: "locais" } },
      create: { perfil_id: adminPerfil.id, tela_id: "locais", pode_ver: true, pode_editar: true },
      update: { pode_ver: true, pode_editar: true },
    });
  }
  if (process.env.SEED_DEMO === "true") await seedDemo(prisma);
}

async function seedDemo(prisma: Db): Promise<void> {
  if ((await prisma.prestadores.count()) > 0) return;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) return;
  const hash = await hashPassword(password);
  const ana = await ensureUser(prisma, "Ana Souza", "ana.souza@sigpsc.gov.br", "Coordenador(a)", hash, 0);
  const roberto = await ensureUser(prisma, "Roberto Dias", "roberto.dias@sigpsc.gov.br", "Supervisor(a) de local", hash, 2);
  const luciana = await ensureUser(prisma, "Luciana Prado", "luciana.prado@sigpsc.gov.br", "Supervisor(a) de local", hash, 3);
  await ensureUser(prisma, "Fernanda Lopes", "fernanda.lopes@sigpsc.gov.br", "Jurídico", hash, 5, false);
  const supervisors: Record<string, number> = { "Ana Souza": ana, "Roberto Dias": roberto, "Luciana Prado": luciana };
  const locais: Record<string, number> = {
    "Escola Municipal Dom Pedro": 1,
    "UBS Vila Nova": 2,
    "Parque Ecológico": 3,
    "Centro de Assistência Social": 4,
    "Biblioteca Pública": 5,
  };
  const people = [
    ["Carlos Eduardo Lima", "0001234-56.2026.8.26.0100", "1ª Vara Criminal", "São Paulo", "Escola Municipal Dom Pedro", "Ana Souza", 240, 198, 8, "Ativo", "2026-02-10", "2026-12-10"],
    ["Mariana Alves Rocha", "0002345-67.2026.8.26.0100", "2ª Vara Criminal", "São Paulo", "UBS Vila Nova", "Roberto Dias", 120, 120, 0, "Concluído", "2026-01-05", "2026-09-05"],
    ["João Pedro Santos", "0003456-78.2026.8.26.0050", "Juizado Especial Criminal", "Guarulhos", "Parque Ecológico", "Ana Souza", 180, 64, 12, "Ativo", "2026-06-15", "2027-03-15"],
    ["Fernanda Costa Melo", "0004567-89.2026.8.26.0100", "3ª Vara Criminal", "São Paulo", "Centro de Assistência Social", "Luciana Prado", 300, 142, 0, "Suspenso", "2026-03-20", "2027-03-20"],
    ["Ricardo Gomes Neto", "0005678-90.2026.8.26.0050", "1ª Vara Criminal", "Guarulhos", "Biblioteca Pública", "Roberto Dias", 90, 82, 4, "Ativo", "2026-08-01", "2027-01-01"],
    ["Patrícia Ribeiro", "0006789-01.2026.8.26.0100", "Vara de Execuções", "São Paulo", "UBS Vila Nova", "Luciana Prado", 160, 0, 0, "Pendente", "2026-12-01", "2027-08-01"],
    ["André Luiz Ferreira", "0007890-12.2026.8.26.0100", "2ª Vara Criminal", "São Paulo", "Escola Municipal Dom Pedro", "Ana Souza", 200, 110, 6, "Ativo", "2026-04-12", "2027-02-12"],
    ["Juliana Martins", "0008901-23.2026.8.26.0050", "Juizado Especial Criminal", "Guarulhos", "Parque Ecológico", "Roberto Dias", 60, 54, 3, "Ativo", "2026-09-03", "2026-12-03"],
  ] as const;
  for (const [index, person] of people.entries()) {
    const cpf = makeCpf(index + 11);
    if (!isValidCpf(cpf)) throw new Error("CPF de demonstração inválido.");
    const localId = locais[person[4]];
    const supervisorId = supervisors[person[5]];
    if (!localId || !supervisorId) continue;
    const prestador = await prisma.prestadores.create({
      data: { nome: person[0], cpf: formatCpf(cpf), telefone: "(11) 90000-0000", endereco: "Endereço de demonstração", criado_por: 1 },
    });
    const situacao = person[9] === "Concluído" ? "Conclu_do" : person[9];
    const processo = await prisma.processos.create({
      data: {
        prestador_id: prestador.id,
        numero: person[1],
        vara_id: await ensureVara(prisma, person[2], person[3]),
        tribunal: "TJSP",
        horas_totais: person[6],
        horas_semanais_max: 12,
        data_inicio: dateForDb(person[10]),
        prazo_final: dateForDb(person[11]),
        local_id: localId,
        supervisor_id: supervisorId,
        situacao: situacao as "Ativo",
        observacoes: "Registro de demonstração. Substituir antes do uso com dados reais.",
      },
    });
    await fillHours(prisma, processo.id, localId, Number(person[7]) * 60, Number(person[8]) * 60);
  }
}

async function fillHours(prisma: Db, processoId: number, localId: number, approved: number, pending: number): Promise<void> {
  const morning = new Date(Date.UTC(2026, 10, 16));
  let left = approved;
  while (left > 0) {
    const weekday = morning.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const chunk = Math.min(240, left);
      const end = 8 * 60 + chunk;
      await prisma.registros_horas.create({
        data: {
          processo_id: processoId,
          local_id: localId,
          atividade_texto: "Atividade de prestação acompanhada",
          data: new Date(morning),
          periodo: "Manh_",
          entrada: timeForDb("08:00"),
          saida: timeForDb(clock(end)),
          minutos: chunk,
          origem: "Equipe",
          registrado_por_usuario: 1,
          status: "Aprovado",
          validado_por: 1,
          validado_em: new Date(),
        },
      });
      left -= chunk;
    }
    morning.setUTCDate(morning.getUTCDate() - 1);
  }
  const afternoon = new Date(Date.UTC(2026, 10, 17));
  let pendingLeft = pending;
  while (pendingLeft > 0) {
    const chunk = Math.min(240, pendingLeft);
    await prisma.registros_horas.create({
      data: {
        processo_id: processoId,
        local_id: localId,
        atividade_texto: "Atividade aguardando validação",
        data: new Date(afternoon),
        periodo: "Tarde",
        entrada: timeForDb("13:00"),
        saida: timeForDb(clock(13 * 60 + chunk)),
        minutos: chunk,
        origem: "Equipe",
        registrado_por_usuario: 1,
        status: "Pendente",
      },
    });
    pendingLeft -= chunk;
    afternoon.setUTCDate(afternoon.getUTCDate() - 1);
  }
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function makeCpf(seed: number): string {
  const base = String(100000000 + seed).padStart(9, "0");
  const digit = (value: string) => {
    let sum = 0;
    for (let index = 0; index < value.length; index += 1) sum += Number(value[index]) * (value.length + 1 - index);
    const mod = sum % 11;
    return String(mod < 2 ? 0 : 11 - mod);
  };
  const withFirst = `${base}${digit(base)}`;
  return `${withFirst}${digit(withFirst)}`;
}

async function ensureUser(prisma: Db, nome: string, email: string, perfilNome: string, hash: string, cor: number, ativo = true): Promise<number> {
  const found = await prisma.usuarios.findUnique({ where: { email } });
  if (found) return found.id;
  const perfil = await prisma.perfis.findUnique({ where: { nome: perfilNome } });
  if (!perfil) return 1;
  const created = await prisma.usuarios.create({
    data: { nome, email, senha_hash: hash, perfil_id: perfil.id, cor_avatar: cor, ativo, cargo: perfilNome },
  });
  await prisma.usuario_preferencias.create({ data: { usuario_id: created.id } });
  return created.id;
}

async function ensureVara(prisma: Db, nome: string, comarca: string): Promise<number> {
  const city = await prisma.comarcas.findFirst({ where: { nome: comarca } });
  const comarcaId = city?.id ?? (await prisma.comarcas.create({ data: { nome: comarca, uf: "SP" } })).id;
  const court = await prisma.varas.findFirst({ where: { nome, comarca_id: comarcaId } });
  return court?.id ?? (await prisma.varas.create({ data: { nome, comarca_id: comarcaId } })).id;
}
