// ============================================================
// scripts/congelamento.js — o guarda do CI e o version.json do build.
//
// O que aqui segura:
//   1. o guarda REPROVA dentro da janela sem [hotfix] e APROVA com ele
//      (qualquer caixa), e aprova fora da janela;
//   2. o processo de verdade sai com 1/0 — é o que o GitHub Actions lê;
//   3. o version.json sai com o hash do bundle e hotfix pela mensagem do
//      commit OU por HOTFIX=1, e o build nunca quebra por causa dele;
//   4. a conta de datas do script (Node puro, sem TypeScript) responde
//      igual à do app (utils/janelaDeCongelamento) em todo o intervalo;
//   5. o workflow e o build.command realmente chamam o script.
// ============================================================
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { emCongelamento } from "@/utils/janelaDeCongelamento";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cong = require("../scripts/congelamento.js");

const RAIZ = path.join(__dirname, "..");
const SCRIPT = path.join(RAIZ, "scripts", "congelamento.js");
const DENTRO = new Date("2026-11-25T12:00:00-03:00");
const FORA = new Date("2026-10-13T12:00:00-03:00");

function guardarComProcesso(mensagem: string, agora: string) {
  const env = { ...process.env, COMMIT_MESSAGE: mensagem, CONGELAMENTO_AGORA: agora };
  const r = spawnSync(process.execPath, [SCRIPT, "guardar"], { env, encoding: "utf8" });
  return { codigo: r.status, saida: String(r.stdout) };
}

describe("mensagemEhHotfix", () => {
  test.each([
    ["fix(caixa): [hotfix] bipe do grupo", true],
    ["[HOTFIX] corrige o login", true],
    ["fix: algo\n\ncorpo longo\n\n[Hotfix]", true],
    ["fix: hotfix sem colchetes", false],
    ["feat: coisa nova", false],
    ["", false],
  ])("%j → %s", (mensagem, esperado) => {
    expect(cong.mensagemEhHotfix(mensagem)).toBe(esperado);
  });
  test("mensagem ausente não explode", () => {
    expect(cong.mensagemEhHotfix(undefined)).toBe(false);
  });
});

describe("decidirGuarda", () => {
  test("fora da janela: passa, com ou sem hotfix", () => {
    expect(cong.decidirGuarda({ agora: FORA, mensagem: "feat: coisa" }).ok).toBe(true);
    expect(cong.decidirGuarda({ agora: FORA, mensagem: "fix: [hotfix] x" }).ok).toBe(true);
  });
  test("dentro da janela sem hotfix: REPROVA e explica", () => {
    const r = cong.decidirGuarda({ agora: DENTRO, mensagem: "feat: coisa nova" });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/2026-11-24 a 2026-12-01/);
    expect(r.motivo).toMatch(/\[hotfix\]/);
    expect(r.motivo).toMatch(/CONGELAMENTO\.md/);
  });
  test("dentro da janela com hotfix: passa", () => {
    expect(cong.decidirGuarda({ agora: DENTRO, mensagem: "fix: [hotfix] caixa fora do ar" }).ok).toBe(true);
  });
  test("bordas: 01/12 23h59 reprova, 02/12 00h00 passa", () => {
    const m = "feat: x";
    expect(cong.decidirGuarda({ agora: new Date("2026-12-01T23:59:59-03:00"), mensagem: m }).ok).toBe(false);
    expect(cong.decidirGuarda({ agora: new Date("2026-12-02T00:00:00-03:00"), mensagem: m }).ok).toBe(true);
  });
});

describe("o processo (o que o GitHub Actions enxerga)", () => {
  test("dentro da janela sem hotfix: sai com 1 e escreve ::error::", () => {
    const r = guardarComProcesso("feat: coisa nova", "2026-11-25T12:00:00-03:00");
    expect(r.codigo).toBe(1);
    expect(r.saida).toMatch(/^::error::/m);
  });
  test("dentro da janela com hotfix: sai com 0", () => {
    expect(guardarComProcesso("fix: [hotfix] urgente", "2026-11-25T12:00:00-03:00").codigo).toBe(0);
  });
  test("fora da janela: sai com 0", () => {
    expect(guardarComProcesso("feat: coisa nova", "2026-10-13T12:00:00-03:00").codigo).toBe(0);
  });
});

describe("version.json do build", () => {
  let dist: string;
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "aura-dist-"));
    const web = path.join(dist, "_expo", "static", "js", "web");
    fs.mkdirSync(web, { recursive: true });
    fs.writeFileSync(path.join(web, "runtime-1234.js"), "");
    fs.writeFileSync(path.join(web, "entry-abc123def.js"), "");
  });
  afterEach(() => {
    fs.rmSync(dist, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const ler = () => JSON.parse(fs.readFileSync(path.join(dist, "version.json"), "utf8"));

  test("acha o hash do entry-<hash>.js", () => {
    expect(cong.hashDoBundle(dist)).toBe("abc123def");
  });

  test("commit normal: hotfix false, com hash e sha", () => {
    cong.gerarVersao(dist, { COMMIT_MESSAGE: "feat: coisa", GITHUB_SHA: "deadbeef" });
    expect(ler()).toMatchObject({ hash: "abc123def", hotfix: false, sha: "deadbeef" });
    expect(typeof ler().builtAt).toBe("string");
  });

  test("[hotfix] na mensagem: hotfix true", () => {
    cong.gerarVersao(dist, { COMMIT_MESSAGE: "fix: [hotfix] caixa", GITHUB_SHA: "deadbeef" });
    expect(ler().hotfix).toBe(true);
  });

  test("HOTFIX=1 no ambiente: hotfix true mesmo sem marca na mensagem", () => {
    cong.gerarVersao(dist, { COMMIT_MESSAGE: "feat: coisa", HOTFIX: "1", GITHUB_SHA: "deadbeef" });
    expect(ler().hotfix).toBe(true);
  });

  test("HOTFIX=0 não conta", () => {
    cong.gerarVersao(dist, { COMMIT_MESSAGE: "feat: coisa", HOTFIX: "0", GITHUB_SHA: "x" });
    expect(ler().hotfix).toBe(false);
  });

  test("sem bundle no dist: grava hash null e hotfix false, sem lançar", () => {
    fs.rmSync(path.join(dist, "_expo"), { recursive: true, force: true });
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    cong.gerarVersao(dist, { COMMIT_MESSAGE: "feat: coisa", GITHUB_SHA: "x" });
    aviso.mockRestore();
    expect(ler()).toMatchObject({ hash: null, hotfix: false });
  });

  test("o comando gerar-versao nunca derruba o build (dist inexistente → exit 0)", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "gerar-versao", path.join(dist, "nao-existe")], { encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});

describe("a conta do script é a do app", () => {
  test("a cada 6h, de 20/11/2026 a 05/01/2027, as duas respondem igual", () => {
    const janelas = cong.lerJanelas();
    const inicio = new Date("2026-11-20T00:00:00Z").getTime();
    const fim = new Date("2027-01-05T00:00:00Z").getTime();
    let n = 0;
    for (let t = inicio; t <= fim; t += 6 * 60 * 60 * 1000) {
      const data = new Date(t);
      expect([data.toISOString(), cong.janelaEmVigor(data, janelas) !== null]).toEqual([
        data.toISOString(),
        emCongelamento(data),
      ]);
      n++;
    }
    expect(n).toBeGreaterThan(150);
  });
});

describe("a fiação", () => {
  test("o workflow chama o guarda, na main, passando a mensagem por env (não interpolada)", () => {
    const yml = fs.readFileSync(path.join(RAIZ, ".github", "workflows", "congelamento.yml"), "utf8");
    expect(yml).toMatch(/branches: \[main\]/);
    expect(yml).toMatch(/run: node scripts\/congelamento\.js guardar/);
    expect(yml).toMatch(/COMMIT_MESSAGE: \$\{\{ github\.event\.head_commit\.message \}\}/);
    // texto de commit é entrada não confiável: nunca dentro do `run:`
    expect(yml).not.toMatch(/run:.*head_commit/);
  });

  test("o build gera o version.json depois do export", () => {
    const cfg = fs.readFileSync(path.join(RAIZ, "wrangler.jsonc"), "utf8");
    expect(cfg).toMatch(/"command": "npx expo export -p web && node scripts\/congelamento\.js gerar-versao"/);
  });

  test("a doc cita as duas janelas do JSON", () => {
    const doc = fs.readFileSync(path.join(RAIZ, "docs", "CONGELAMENTO.md"), "utf8");
    expect(doc).toMatch(/24\/11\/2026/);
    expect(doc).toMatch(/01\/12\/2026/);
    expect(doc).toMatch(/20\/12\/2026/);
    expect(doc).toMatch(/02\/01\/2027/);
    expect(doc).toMatch(/Caio/);
  });
});
