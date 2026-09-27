#!/usr/bin/env node
// ============================================================
// scripts/studio/publicar-template-visual.mjs — 27/09/2026
//
// Publica (ou atualiza) um template visual do Studio a partir de um JSON
// como docs/studio/visual-templates/camiseta-basica-3d.json. É a rota
// staff: POST /companies/:cid/studio/visual-templates cria; se a chave já
// existe (409), PUT /companies/:cid/studio/visual-templates/:key atualiza.
// O corpo é o `VisualTemplate` de services/studioVisualApi.ts.
//
// Uso:
//   AURA_API_TOKEN=... AURA_COMPANY_ID=... node scripts/studio/publicar-template-visual.mjs docs/studio/visual-templates/camiseta-basica-3d.json
//
// Variáveis:
//   AURA_API_TOKEN   JWT de uma conta staff (@getaura.com.br)
//   AURA_COMPANY_ID  empresa em cuja rota o staff publica
//   AURA_API_URL     opcional; padrão https://api.getaura.com.br/api/v1
//   --dry-run        só mostra o que enviaria
//
// O token vem do ambiente de propósito: nada de credencial em arquivo.
// ============================================================
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const arquivo = args.find((a) => !a.startsWith("--"));

if (!arquivo) {
  console.error("Uso: node scripts/studio/publicar-template-visual.mjs <template.json> [--dry-run]");
  process.exit(2);
}

const token = process.env.AURA_API_TOKEN;
const cid = process.env.AURA_COMPANY_ID;
const api = (process.env.AURA_API_URL || "https://api.getaura.com.br/api/v1").replace(/\/+$/, "");

const template = JSON.parse(fs.readFileSync(path.resolve(arquivo), "utf8"));
for (const campo of ["key", "name", "kind", "spec"]) {
  if (template[campo] == null) {
    console.error("O JSON precisa de `" + campo + "`.");
    process.exit(2);
  }
}
if (template.kind === "model3d" && template.spec?.model?.kind === "glb") {
  const url = String(template.spec.model.url || "");
  if (!/^https?:\/\//.test(url)) {
    console.error("model.url precisa ser absoluta (a vitrine roda em outro domínio): " + url);
    process.exit(2);
  }
}

const body = {
  key: template.key,
  name: template.name,
  kind: template.kind,
  status: template.status || "published",
  spec: template.spec,
};

console.log("Template:", body.key, "(" + body.kind + ", " + body.status + ")");
if (dryRun) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}
if (!token || !cid) {
  console.error("Defina AURA_API_TOKEN e AURA_COMPANY_ID (ou use --dry-run).");
  process.exit(2);
}

const base = api + "/companies/" + encodeURIComponent(cid) + "/studio/visual-templates";
const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };

async function chamar(metodo, url) {
  const res = await fetch(url, { method: metodo, headers, body: JSON.stringify(body) });
  const texto = await res.text();
  let dados = null;
  try { dados = JSON.parse(texto); } catch (_e) { dados = texto; }
  return { status: res.status, dados };
}

let r = await chamar("POST", base);
if (r.status === 409) {
  console.log("Chave já existe — atualizando.");
  r = await chamar("PUT", base + "/" + encodeURIComponent(body.key));
}
if (r.status >= 200 && r.status < 300) {
  console.log("OK", r.status, JSON.stringify(r.dados));
} else {
  console.error("Falhou", r.status, JSON.stringify(r.dados));
  process.exit(1);
}
