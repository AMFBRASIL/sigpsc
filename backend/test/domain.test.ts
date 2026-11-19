import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidCpf, maskCpf } from "../src/domain/cpf";
import { balance, durationMinutes, rangesOverlap, weekRange } from "../src/domain/time";
import { csvLine, safeSpreadsheet } from "../src/domain/text";

describe("CPF", () => {
  it("rejeita sequência inválida", () => {
    assert.equal(isValidCpf("123.456.789-00"), false);
    assert.equal(isValidCpf("111.111.111-11"), false);
  });
  it("mascara o documento", () => {
    assert.equal(maskCpf("52998224725"), "529.***.***-25");
  });
});

describe("horas", () => {
  it("calcula minutos descontando intervalo", () => {
    assert.equal(durationMinutes("08:00", "12:30", 15), 255);
  });
  it("recusa saída anterior à entrada", () => {
    assert.throws(() => durationMinutes("12:00", "08:00"), /depois da entrada/);
  });
  it("detecta sobreposição", () => {
    assert.equal(rangesOverlap(8 * 60, 12 * 60, 11 * 60, 15 * 60), true);
    assert.equal(rangesOverlap(8 * 60, 12 * 60, 12 * 60, 16 * 60), false);
  });
  it("calcula saldo e percentual", () => {
    const result = balance(400 * 60, 125 * 60 + 30);
    assert.equal(result.remaining, 274 * 60 + 30);
    assert.equal(Math.round(result.percent * 1000) / 1000, 31.375);
  });
  it("abre a semana na segunda", () => {
    assert.deepEqual(weekRange("2026-11-18"), { start: "2026-11-16", end: "2026-11-22" });
  });
});

describe("planilha", () => {
  it("neutraliza fórmula", () => {
    assert.equal(safeSpreadsheet("=CMD()"), "'=CMD()");
    assert.equal(csvLine(["=1+1", "ok"]).startsWith("'=1+1"), true);
  });
});
