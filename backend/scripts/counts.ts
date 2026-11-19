import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const [prestadores, horas, usuarios] = await Promise.all([
    prisma.prestadores.count(),
    prisma.registros_horas.count(),
    prisma.usuarios.count(),
  ]);
  console.log(JSON.stringify({ prestadores, horas, usuarios }));
  await prisma.$disconnect();
}
main();
