// ============================================================
// Painel fora da busca (06/10/2026).
//
// O Search Console mostrava app.getaura.com.br/login como soft 404 e
// /register indexado. O painel nao e pagina de busca: quem procura a Aura
// deve cair em www.getaura.com.br. Tres camadas, todas em public/ (o
// app.json usa web.output "single", entao public/index.html E a casca;
// nao ha app/+html.tsx):
//
//   · <meta name="robots" content="noindex, nofollow"> no index.html;
//   · public/robots.txt LIBERA o rastreio (Allow: /): com Disallow o
//     Google nao le o noindex e a URL fica "indexada, mas bloqueada";
//   · X-Robots-Tag no _headers, so para o host app.getaura.com.br.
//
// Cuidado com a vitrine Studio: loja.getaura.com.br/<slug> e servida pelo
// backend com ESTA casca (services/vitrineStudioShell.js). O backend tira
// a meta robots da casca antes de servir; o teste trava o formato da meta
// para continuar casando com a regex de la.
// ============================================================
import fs from "fs";
import path from "path";

const RAIZ = path.join(__dirname, "..");
const ler = (...p: string[]) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");

const indexHtml = ler("public", "index.html");

describe("index.html", () => {
  test("tem a meta robots noindex, nofollow uma vez so", () => {
    const metas = indexHtml.match(/<meta\s+name="robots"[^>]*>/gi) || [];
    expect(metas).toHaveLength(1);
    expect(metas[0]).toContain('content="noindex, nofollow"');
  });

  test("a meta casa com a regex que o backend usa para tira-la da vitrine Studio", () => {
    // Copia de comCabecalhoDaLoja (aura-backend, vitrineStudioShell.js).
    const limpa = indexHtml.replace(
      /<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description|robots)"[^>]*>\s*/gi,
      "",
    );
    expect(limpa).not.toMatch(/name="robots"/i);
  });

  test("continua em pt-BR e sem traducao automatica (app#920)", () => {
    expect(indexHtml).toMatch(/<html lang="pt-BR" translate="no">/);
    expect(indexHtml).toContain('<meta name="google" content="notranslate" />');
  });
});

describe("robots.txt", () => {
  const robots = ler("public", "robots.txt");
  const regras = robots.split("\n").filter((l) => l.trim() && !l.startsWith("#"));

  test("libera o rastreio, para o Google conseguir ler o noindex", () => {
    expect(regras).toEqual(["User-agent: *", "Allow: /"]);
  });

  test("nenhum Disallow", () => {
    expect(robots).not.toMatch(/^\s*Disallow/im);
  });
});

describe("_headers", () => {
  const headers = ler("public", "_headers");

  test("X-Robots-Tag so no host do painel", () => {
    expect(headers).toMatch(
      /^https:\/\/app\.getaura\.com\.br\/\*\n {2}X-Robots-Tag: noindex, nofollow$/m,
    );
    // Nenhuma regra relativa (que valeria para qualquer host) leva o header.
    const linhas = headers.split("\n");
    linhas.forEach((linha, i) => {
      if (!/X-Robots-Tag/i.test(linha)) return;
      let j = i - 1;
      while (j >= 0 && /^\s/.test(linhas[j])) j--;
      expect(linhas[j]).toBe("https://app.getaura.com.br/*");
    });
  });
});
