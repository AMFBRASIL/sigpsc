import { readFileSync } from "node:fs";

const password = readFileSync(new URL("../.admin-password", import.meta.url), "utf8").trim();
const base = "http://127.0.0.1:3340";
const results = [];

function note(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
}

async function call(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers);
  headers.set("x-sigpsc-request", "1");
  if (!(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(base + path, { ...options, headers });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  const cookieHeader = response.headers.get("set-cookie") ?? "";
  return { status: response.status, json, text, cookie: cookieHeader.split(";")[0] };
}

const anon = await call("/api/v1/workspace");
note("sem sessão", anon.status === 401, String(anon.status));

const bad = await call("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@sigpsc.gov.br", senha: "senha-incorreta-123" }) });
note("login inválido", bad.status === 401, String(bad.status));

const login = await call("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@sigpsc.gov.br", senha: password }) });
note("login válido", (login.status === 200 || login.status === 201) && login.cookie.includes("sigpsc_session"), String(login.status));
const cookie = login.cookie;

const workspace = await call("/api/v1/workspace", {}, cookie);
const person = workspace.json?.prestadores?.find((item) => item.situacao === "Ativo");
note("workspace", workspace.status === 200 && person, `prestadores=${workspace.json?.prestadores?.length ?? 0}`);

const invalid = await call("/api/v1/attendance", { method: "POST", body: JSON.stringify({ prestadorId: Number(person.id), processoId: Number(person.processoId), data: "2026-11-18", entrada: "12:00", saida: "08:00", atividade: "Teste de horário" }) }, cookie);
note("horário inválido", invalid.status === 400, invalid.json?.code ?? String(invalid.status));

const created = await call("/api/v1/attendance", { method: "POST", body: JSON.stringify({ prestadorId: Number(person.id), processoId: Number(person.processoId), data: "2026-11-18", entrada: "14:00", saida: "16:00", atividade: "Teste automatizado de frequência" }) }, cookie);
note("registro válido", created.status === 201 || created.status === 200, `${created.status} ${created.json?.code ?? ""} minutos=${created.json?.minutos ?? ""}`);

const overlap = await call("/api/v1/attendance", { method: "POST", body: JSON.stringify({ prestadorId: Number(person.id), processoId: Number(person.processoId), data: "2026-11-18", entrada: "15:00", saida: "17:00", atividade: "Teste de sobreposição" }) }, cookie);
note("sobreposição", overlap.status === 409, overlap.json?.code ?? String(overlap.status));

const approved = await call(`/api/v1/attendance/${created.json?.id}/approve`, { method: "POST", body: "{}" }, cookie);
note("aprovação", approved.status === 200 || approved.status === 201, approved.json?.registros?.[0]?.status ?? approved.json?.message ?? approved.json?.code ?? String(approved.status));
const again = await call(`/api/v1/attendance/${created.json?.id}/approve`, { method: "POST", body: "{}" }, cookie);
note("aprovação idempotente", (again.status === 200 || again.status === 201) && again.json?.registros?.[0]?.idempotente === true, `${again.status} ${again.json?.code ?? ""}`);

const balance = await call(`/api/v1/judicial-orders/${person.processoId}/balance`, {}, cookie);
note("saldo", balance.status === 200 && typeof balance.json?.minutosValidados === "number", `restante=${balance.json?.restante}`);

const form = new FormData();
form.append("file", new Blob([Buffer.from("nao sou pdf")], { type: "application/pdf" }), "falso.pdf");
const upload = await fetch(base + "/api/v1/documents/upload", { method: "POST", headers: { cookie, "x-sigpsc-request": "1" }, body: form });
note("upload inválido", upload.status === 400, String(upload.status));

const forbidden = await call("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "ana.souza@sigpsc.gov.br", senha: password }) });
note("coordenação entra", forbidden.status === 200 || forbidden.status === 201, String(forbidden.status));

console.log(`TOTAL ${results.filter((item) => item.ok).length}/${results.length}`);
if (results.some((item) => !item.ok)) process.exit(1);
