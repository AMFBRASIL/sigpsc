import { describe, expect, it } from "vitest";
import { formatIso, maskDateInput, parseDateInput } from "@/lib/date-format";

describe("padrão de data", () => {
  it("mostra e lê o dia antes do mês", () => {
    expect(formatIso("2026-03-20", "DD/MM/AAAA")).toBe("20/03/2026");
    expect(parseDateInput("20/03/2026", "DD/MM/AAAA")).toBe("2026-03-20");
    expect(maskDateInput("20032026", "DD/MM/AAAA")).toBe("20/03/2026");
  });
  it("aceita mês primeiro e o formato ISO", () => {
    expect(parseDateInput("03/20/2026", "MM/DD/AAAA")).toBe("2026-03-20");
    expect(formatIso("2026-11-19", "AAAA-MM-DD")).toBe("2026-11-19");
    expect(parseDateInput("31/02/2026", "DD/MM/AAAA")).toBe("");
  });
});
