#!/usr/bin/env node
// ============================================================
// scripts/studio/transpilar-viewer-de-teste.mjs — 28/09/2026
//
// Transpila o viewer 3D REAL (components/studio/visualEngine/compose3dMug.ts
// e o que ele importa por caminho relativo) para módulos ES em
// docs/studio/visual-templates/viewer/, para a página de teste
// teste-3d.html usar o mesmo código do app em vez de um espelho copiado à
// mão. Até 27/09 a página era um espelho manual, e cada mudança no viewer
// tinha que ser copiada lá — o espelho já estava atrasado no dia seguinte.
//
// Usa o TypeScript do próprio repo (transpileModule, sem checagem de tipos:
// o tsc do CI é quem checa). Os imports "@/…" do viewer são só de tipos e
// somem na transpilação. A pasta de saída está no .gitignore.
//
// Uso:  node scripts/studio/transpilar-viewer-de-teste.mjs
// Depois: npx serve .  →  http://localhost:3000/docs/studio/visual-templates/teste-3d.html
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const origem = path.join(raiz, "components", "studio", "visualEngine");
const destino = path.join(raiz, "docs", "studio", "visual-templates", "viewer");
const entrada = path.join(origem, "compose3dMug.ts");

// Só os arquivos alcançados por import relativo de valor (não `import type`).
const vistos = new Set();
const fila = [entrada];
while (fila.length) {
  const f = fila.pop();
  if (vistos.has(f)) continue;
  vistos.add(f);
  const src = fs.readFileSync(f, "utf8");
  const re = /from\s+"(\.\/[^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const linha = src.slice(src.lastIndexOf("\n", m.index) + 1, m.index);
    if (/import\s+type/.test(linha)) continue;
    fila.push(path.join(origem, m[1] + ".ts"));
  }
}

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });
for (const f of vistos) {
  const src = fs.readFileSync(f, "utf8");
  const r = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ES2015, target: ts.ScriptTarget.ES2019 },
    fileName: f,
  });
  // O navegador precisa da extensão nos imports.
  const js = r.outputText.replace(/from\s+"(\.\/[^"]+)"/g, (_s, p) => 'from "' + p + '.js"');
  fs.writeFileSync(path.join(destino, path.basename(f, ".ts") + ".js"), js);
}
console.log("viewer transpilado em " + path.relative(raiz, destino) + ": " + Array.from(vistos).map((f) => path.basename(f)).join(", "));
