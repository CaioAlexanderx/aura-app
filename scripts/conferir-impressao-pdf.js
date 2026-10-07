#!/usr/bin/env node
// ============================================================
// Confere, imprimindo DE VERDADE, que o botão "Imprimir / Salvar PDF" não
// sai no papel do orçamento e do fechamento de caixa. NÃO roda no CI —
// precisa de Chrome (ou Edge) instalado e do pdftotext (vem com o Git for
// Windows em /mingw64/bin; no Linux/mac, pacote poppler-utils).
//
// Como rodar (na raiz do aura-app):
//   node scripts/conferir-impressao-pdf.js
//   CHROME="C:/caminho/chrome.exe" node scripts/conferir-impressao-pdf.js
//
// O que faz:
//   1. roda __tests__/impressaoSemBotao.test.ts com AURA_HTML_OUT, que grava
//      os HTMLs dos cenários (com/sem preço no cartão, com/sem logo, nome
//      de item com aspas, `}` e `<`) numa pasta temporária;
//   2. imprime cada um em PDF com o Chrome headless (mídia print, como o
//      diálogo de impressão faz);
//   3. extrai o texto do PDF e falha se "Imprimir" aparecer.
// Contexto: 07/10/2026, ver utils/printBar.ts.
// ============================================================
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const CANDIDATOS = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = CANDIDATOS.find((c) => fs.existsSync(c));
if (!chrome) { console.error("Chrome/Edge não encontrado. Use CHROME=<caminho>."); process.exit(2); }

const raiz = path.resolve(__dirname, "..");
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "aura-impressao-"));
const perfil = path.join(pasta, "perfil"); // perfil próprio: funciona com o Chrome do usuário aberto

// Se o teste falhar, os HTMLs já foram gravados: imprime assim mesmo.
try {
  execFileSync(process.execPath, [
    path.join(raiz, "node_modules/jest/bin/jest.js"),
    "__tests__/impressaoSemBotao.test.ts", "--maxWorkers=2",
  ], { cwd: raiz, stdio: "inherit", env: { ...process.env, AURA_HTML_OUT: pasta } });
} catch (e) {
  console.warn("O teste jest falhou — seguindo para a impressão real.");
}

const htmls = fs.readdirSync(pasta).filter((f) => f.endsWith(".html"));
if (!htmls.length) { console.error("Nenhum HTML gerado em " + pasta); process.exit(2); }

let falhas = 0;
for (const f of htmls) {
  const html = path.join(pasta, f);
  const pdf = html.replace(/\.html$/, ".pdf");
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--user-data-dir=" + perfil,
    "--print-to-pdf=" + pdf,
    pathToFileURL(html).href,
  ], { stdio: "ignore" });
  const texto = execFileSync("pdftotext", ["-enc", "UTF-8", pdf, "-"]).toString("utf8");
  const vazou = /Imprimir/.test(texto);
  const temConteudo = texto.trim().length > 50;
  if (vazou || !temConteudo) falhas++;
  console.log((vazou ? "FALHOU  " : !temConteudo ? "VAZIO   " : "ok      ") + f + (vazou ? "  (botão no papel)" : ""));
}
console.log("PDFs em " + pasta);
process.exit(falhas ? 1 : 0);
