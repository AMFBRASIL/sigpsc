import { describe, expect, it } from "vitest";
import { durationMinutes, initialRecords, recordsFor, selectedSummary } from "@/lib/daily-demo";

describe("Rotina de prestação", () => {
  it("separa os registros do prestador dos registros de outras pessoas", () => {
    const own = recordsFor(initialRecords, "1");
    expect(own.map((r) => r.id)).toEqual(["r1", "h-approved", "h-correction"]);
    expect(own.some((r) => r.prestador === "João Pedro Santos")).toBe(false);
  });
  it("resume apenas registros pendentes selecionados para aprovação em lote", () => {
    const summary = selectedSummary(initialRecords, ["r1", "r4", "h-approved"]);
    expect(summary.hours).toBe(7);
    expect(summary.selected.map((r) => r.id)).toEqual(["r1", "r4"]);
  });
  it("calcula a duração entre entrada e saída", () => {
    expect(durationMinutes("08:00", "12:30")).toBe(270);
    expect(durationMinutes("12:00", "08:00")).toBe(0);
  });
});