import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openSecret, seal } from "../src/mail/secret";

describe("segredo de e-mail", () => {
  it("cifra e recupera a chave sem gravar o texto puro", () => {
    const packed = seal("chave-de-api");
    assert.equal(Buffer.from(packed).toString("utf8").includes("chave-de-api"), false);
    assert.equal(openSecret(packed), "chave-de-api");
  });
});
