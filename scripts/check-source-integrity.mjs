#!/usr/bin/env node
// ============================================================
// check-source-integrity.mjs — Aura
// Falha o CI se algum arquivo de codigo estiver:
//   (a) salvo INTEIRO em base64 (a armadilha do MCP GitHub), ou
//   (b) com erro de sintaxe (parse com @babel/parser, o mesmo do Metro).
// O check de base64 roda sem dependencias; o parse precisa de
// @babel/parser (instalado no passo do workflow).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const SKIP = new Set([".git", "node_modules", ".expo", ".expo-shared", "dist", "build", ".next", ".turbo", "coverage", "ios", "android", ".cache", "web-build"]);
const PARSE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css"]);
const NUL = String.fromCharCode(0);

let parse = null;
try { parse = createRequire(path.join(ROOT, "x.js"))("@babel/parser").parse; }
catch { console.warn("aviso: @babel/parser indisponivel — checagem de sintaxe pulada."); }

function looksBase64(raw) {
  const c = raw.trim().replace(/[\r\n]/g, "");
  if (c.length < 200) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(c)) return false;
  if (c.length % 4 === 1) return false;
  const dec = Buffer.from(c + "=".repeat((4 - c.length % 4) % 4), "base64").toString("utf8");
  if (dec.includes(NUL)) return false;
  return /(^|\n)\s*(import |export |\/\/|\/\*|const |function )/.test(dec);
}

const b64bad = [], parsebad = [];
let scanned = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); continue; }
    const ext = path.extname(e.name).toLowerCase();
    if (e.name.endsWith(".d.ts") || !TEXT_EXT.has(ext)) continue;
    const raw = fs.readFileSync(full, "utf8");
    const rel = path.relative(ROOT, full);
    if (looksBase64(raw)) { b64bad.push(rel); continue; }
    if (parse && PARSE_EXT.has(ext)) {
      scanned++;
      try { parse(raw, { sourceType: "module", plugins: ["typescript", "jsx"] }); }
      catch (err) { parsebad.push([rel, err.loc ? `${err.loc.line}:${err.loc.column}` : "?", err.message.split("\n")[0]]); }
    }
  }
}
walk(ROOT);

let fail = false;
if (b64bad.length) { fail = true; console.error(`\n[X] ${b64bad.length} arquivo(s) salvos em BASE64 (decodifique antes de commitar):`); b64bad.forEach((f) => console.error("   - " + f)); }
if (parsebad.length) { fail = true; console.error(`\n[X] ${parsebad.length} arquivo(s) com ERRO DE SINTAXE:`); parsebad.forEach(([f, loc, msg]) => console.error(`   - ${f} [${loc}] ${msg}`)); }
if (fail) { console.error("\nIntegridade de codigo FALHOU.\n"); process.exit(1); }
console.log(`[OK] Integridade: ${scanned} arquivos parseados, 0 base64, 0 erros de sintaxe.`);
