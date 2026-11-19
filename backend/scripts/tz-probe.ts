import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    "SELECT @@session.time_zone tz, CAST('08:30:00' AS TIME) AS t, CAST('2026-11-18' AS DATE) AS d",
  );
  console.log(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Date ? v.toISOString() : v)));
  await prisma.$disconnect();
}

main();
