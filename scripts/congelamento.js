#!/usr/bin/env node
// ============================================================
// congelamento.js — janela de congelamento de deploy (13/10/2026)
//
// Dois comandos, um arquivo, uma definição de "hotfix":
//
//   node scripts/congelamento.js gerar-versao [dist]
//     Roda DEPOIS do `expo export` (wrangler.jsonc › build.command). Grava
//     dist/version.json = { hash, hotfix, sha, builtAt }. O app lê esse
//     arquivo dentro da janela para decidir se troca de bundle
//     (services/atualizarApp › atualizacaoLiberada). NUNCA derruba o
//     build: se algo falhar, grava hotfix:false e avisa.
//
//   node scripts/congelamento.js guardar
//     Roda no CI a cada push na main (.github/workflows/congelamento.yml).
//     Dentro da janela, falha se a mensagem do commit não tiver [hotfix].
//     Lê COMMIT_MESSAGE; CONGELAMENTO_AGORA (ISO) troca o relógio nos testes
//     e no workflow_dispatch.
//
// As datas vêm de constants/janelasDeCongelamento.json, o MESMO arquivo de
// utils/janelaDeCongelamento.ts (o app). A conta de dia é repetida aqui
// porque o CI roda Node puro, sem compilar TypeScript; o teste
// __tests__/congelamento.test.ts garante que as duas respondem igual.
//
// "Hotfix" = a mensagem do commit contém "[hotfix]" (qualquer caixa) OU a
// variável de ambiente HOTFIX é 1/true. Docs: docs/CONGELAMENTO.md.
// ============================================================
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const ARQUIVO_DAS_JANELAS = path.join(RAIZ, "constants", "janelasDeCongelamento.json");
const BRASILIA_MS = 3 * 60 * 60 * 1000;

function lerJanelas(arquivo = ARQUIVO_DAS_JANELAS) {
  return JSON.parse(fs.readFileSync(arquivo, "utf8")).janelas;
}

/** Dia de Brasília (UTC-3 fixo) de um instante, "AAAA-MM-DD"; inválido → null. */
function diaDeBrasilia(data) {
  const t = data.getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - BRASILIA_MS).toISOString().slice(0, 10);
}

/** A janela que cobre o dia da `data` (bordas inclusivas) ou null. */
function janelaEmVigor(data, janelas = lerJanelas()) {
  const dia = diaDeBrasilia(data);
  if (!dia) return null;
  return janelas.find((j) => dia >= j.inicio && dia <= j.fim) || null;
}

/** A mensagem do commit marca hotfix? */
function mensagemEhHotfix(mensagem) {
  return /\[hotfix\]/i.test(String(mensagem || ""));
}

/** HOTFIX=1 (ou true) no ambiente do build. */
function ambienteEhHotfix(env = process.env) {
  return /^(1|true)$/i.test(String(env.HOTFIX || "").trim());
}

/** O conteúdo de dist/version.json. */
function montarVersao({ hash, sha, mensagem, env = process.env, agora = new Date() }) {
  return {
    hash: hash || null,
    hotfix: mensagemEhHotfix(mensagem) || ambienteEhHotfix(env),
    sha: sha || null,
    builtAt: agora.toISOString(),
  };
}

/** Hash do entry-<hash>.js que o expo export gerou, ou null. */
function hashDoBundle(dist) {
  const dir = path.join(dist, "_expo", "static", "js", "web");
  try {
    for (const nome of fs.readdirSync(dir)) {
      const m = nome.match(/^entry-([a-f0-9]+)\.js$/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function gerarVersao(dist, env = process.env) {
  const mensagem = env.COMMIT_MESSAGE || git("log", "-1", "--format=%B");
  const sha = env.WORKERS_CI_COMMIT_SHA || env.GITHUB_SHA || git("rev-parse", "HEAD");
  const hash = hashDoBundle(dist);
  if (!hash) console.warn("aviso: entry-<hash>.js não encontrado em " + dist + "; version.json sem hash (o app trata como não-hotfix).");
  const versao = montarVersao({ hash, sha, mensagem, env });
  fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify(versao, null, 2) + "\n");
  console.log("version.json: " + JSON.stringify(versao));
  return versao;
}

/**
 * O que o guarda decide. `ok:false` só dentro da janela e sem hotfix.
 * Devolve também a mensagem para o log.
 */
function decidirGuarda({ agora, mensagem, janelas = lerJanelas() }) {
  const janela = janelaEmVigor(agora, janelas);
  if (!janela) return { ok: true, motivo: "Fora da janela de congelamento." };
  if (mensagemEhHotfix(mensagem)) {
    return { ok: true, motivo: `Dentro da janela (${janela.inicio} a ${janela.fim}), mas marcado como hotfix.` };
  }
  return {
    ok: false,
    motivo:
      `Janela de congelamento (${janela.inicio} a ${janela.fim}${janela.motivo ? ", " + janela.motivo : ""}): ` +
      `deploy na main sem [hotfix] na mensagem do commit. Hotfix só com aprovação do Caio; ` +
      `veja docs/CONGELAMENTO.md.`,
  };
}

function guardar(env = process.env) {
  const agora = env.CONGELAMENTO_AGORA ? new Date(env.CONGELAMENTO_AGORA) : new Date();
  // workflow_dispatch não traz head_commit: cai na mensagem do HEAD.
  const mensagem = env.COMMIT_MESSAGE || git("log", "-1", "--format=%B");
  const r = decidirGuarda({ agora, mensagem });
  if (r.ok) {
    console.log(r.motivo);
    return 0;
  }
  console.log("::error::" + r.motivo);
  return 1;
}

function main(argv) {
  const [cmd, arg] = argv;
  if (cmd === "gerar-versao") {
    try {
      gerarVersao(path.resolve(RAIZ, arg || "dist"));
    } catch (e) {
      // Falha aqui NÃO derruba o deploy: sem version.json o app trata o
      // bundle como não-hotfix, que é o lado seguro da janela.
      console.warn("aviso: não consegui gerar version.json: " + (e && e.message));
    }
    return 0;
  }
  if (cmd === "guardar") return guardar();
  console.error("uso: congelamento.js gerar-versao [dist] | guardar");
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  ambienteEhHotfix,
  decidirGuarda,
  diaDeBrasilia,
  gerarVersao,
  guardar,
  hashDoBundle,
  janelaEmVigor,
  lerJanelas,
  mensagemEhHotfix,
  montarVersao,
};
