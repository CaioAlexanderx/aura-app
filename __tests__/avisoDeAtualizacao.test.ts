// ============================================================
// AURA. — Aviso automático de versão nova: os freios (05/11/2026)
//
// O aviso voltou (UpdateBanner, desligado de 11/07 a 05/11/2026) depois da
// Lulume imprimir horas com o app velho. O que este arquivo trava:
//   1. a regra deveAvisar: só com hash diferente, versão com 30 min de vida
//      e sem "Agora não" valendo; sem builtAt fica quieto;
//   2. "Agora não" cala por 24 h neste navegador e sobrevive a reabrir;
//   3. builtAtServido lê o version.json e só vale para o hash servido;
//   4. o banner tem os dois botões e os textos vêm de um lugar só.
// ============================================================
import * as fs from "fs";
import * as path from "path";
import {
  _limparSilencio, CHAVE_SILENCIO, deveAvisar, IDADE_MINIMA_MS, SILENCIO_MS, silenciadoAte, silenciarPorUmDia, TEXTO_DO_AVISO,
} from "@/utils/avisoDeAtualizacao";
import { builtAtServido } from "@/services/atualizarApp";

const AGORA = Date.parse("2026-11-05T15:00:00Z");
const BASE = { carregado: "aaaa1111", servido: "bbbb2222", builtAt: AGORA - 2 * IDADE_MINIMA_MS, silenciadoAte: null, agora: AGORA };

describe("deveAvisar", () => {
  it("avisa: hash diferente, versão assentada, ninguém pediu silêncio", () => {
    expect(deveAvisar(BASE)).toBe(true);
  });
  it("não avisa com o mesmo hash, nem sem hash (dev/nativo/offline)", () => {
    expect(deveAvisar({ ...BASE, servido: "aaaa1111" })).toBe(false);
    expect(deveAvisar({ ...BASE, carregado: null })).toBe(false);
    expect(deveAvisar({ ...BASE, servido: null })).toBe(false);
  });
  it("versão com menos de 30 min de vida espera (sequência de deploys = um aviso só, com o último)", () => {
    expect(deveAvisar({ ...BASE, builtAt: AGORA - IDADE_MINIMA_MS + 1000 })).toBe(false);
    expect(deveAvisar({ ...BASE, builtAt: AGORA - IDADE_MINIMA_MS })).toBe(true);
    expect(deveAvisar({ ...BASE, builtAt: AGORA + 60000 })).toBe(false); // relógio adiantado: espera
  });
  it("sem builtAt (version.json ausente, de outro bundle ou ilegível) fica quieto", () => {
    expect(deveAvisar({ ...BASE, builtAt: null })).toBe(false);
    expect(deveAvisar({ ...BASE, builtAt: NaN })).toBe(false);
  });
  it("'Agora não' vale até o prazo; depois dele avisa de novo", () => {
    expect(deveAvisar({ ...BASE, silenciadoAte: AGORA + 1 })).toBe(false);
    expect(deveAvisar({ ...BASE, silenciadoAte: AGORA })).toBe(true);
    expect(deveAvisar({ ...BASE, silenciadoAte: 0 })).toBe(true);
  });
  it("os números do freio", () => {
    expect(IDADE_MINIMA_MS).toBe(30 * 60 * 1000);
    expect(SILENCIO_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("o silêncio no navegador", () => {
  beforeEach(() => _limparSilencio());
  it("começa sem silêncio; 'Agora não' grava 24 h; lê de volta", () => {
    expect(silenciadoAte()).toBeNull();
    const ate = silenciarPorUmDia(AGORA);
    expect(ate).toBe(AGORA + SILENCIO_MS);
    expect(window.localStorage.getItem(CHAVE_SILENCIO)).toBe(String(ate));
    expect(silenciadoAte()).toBe(ate);
  });
  it("lixo no armazenamento vale como 'não está calado'", () => {
    window.localStorage.setItem(CHAVE_SILENCIO, "ontem");
    expect(silenciadoAte()).toBeNull();
  });
});

describe("builtAtServido", () => {
  const resposta = (body: any, ok = true) => async () => ({ ok, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
  it("devolve o builtAt do version.json quando o hash é o do bundle servido", async () => {
    const buscar = jest.fn(resposta({ hash: "bbbb2222", hotfix: false, sha: "b29b2cf3", builtAt: "2026-11-05T00:12:00Z" }));
    expect(await builtAtServido("bbbb2222", { buscar })).toBe(Date.parse("2026-11-05T00:12:00Z"));
    expect(buscar).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });
  it("null quando o hash é de outro bundle, sem builtAt, JSON ruim, resposta ruim ou erro", async () => {
    expect(await builtAtServido("bbbb2222", { buscar: resposta({ hash: "cccc3333", builtAt: "2026-11-05T00:12:00Z" }) })).toBeNull();
    expect(await builtAtServido("bbbb2222", { buscar: resposta({ hash: "bbbb2222" }) })).toBeNull();
    expect(await builtAtServido("bbbb2222", { buscar: resposta({ hash: "bbbb2222", builtAt: "ontem" }) })).toBeNull();
    expect(await builtAtServido("bbbb2222", { buscar: resposta("<html>") })).toBeNull();
    expect(await builtAtServido("bbbb2222", { buscar: resposta({ hash: "bbbb2222", builtAt: "2026-11-05T00:12:00Z" }, false) })).toBeNull();
    expect(await builtAtServido("bbbb2222", { buscar: async () => { throw new Error("offline"); } })).toBeNull();
    expect(await builtAtServido("bbbb2222", { w: null })).toBeNull();
  });
});

describe("o banner", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "UpdateBanner.tsx"), "utf8");
  it("está ligado, tem 'Atualizar' e 'Agora não', e os textos vêm de TEXTO_DO_AVISO", () => {
    expect(src).toMatch(/const ENABLED = true;/);
    expect(src).toMatch(/testID="aviso-atualizacao-atualizar"/);
    expect(src).toMatch(/testID="aviso-atualizacao-agora-nao"/);
    expect(src).toMatch(/\{TEXTO_DO_AVISO\.titulo\}/);
    expect(src).toMatch(/\{TEXTO_DO_AVISO\.atualizar\}/);
    expect(src).toMatch(/\{TEXTO_DO_AVISO\.agoraNao\}/);
    expect(src).not.toMatch(/Nova versão da Aura disponível\./);
    expect(TEXTO_DO_AVISO.titulo).toBe("Nova versão da Aura disponível.");
  });
  it("'Agora não' cala por um dia e libera o próximo poll; 'Atualizar' usa o serviço (service worker + reload)", () => {
    expect(src).toMatch(/silenciarPorUmDia\(\);\s*\n\s*\/\/[^\n]*\n\s*shown\.current = false;\s*\n\s*setReady\(false\);/);
    expect(src).toMatch(/onPress=\{\(\) => \{ atualizarAgora\(\); \}\}/);
  });
  it("continua montado uma vez só, no _layout raiz (alcança Food, Odonto, Studio e Karatê)", () => {
    const layout = fs.readFileSync(path.join(__dirname, "..", "app", "_layout.tsx"), "utf8");
    expect(layout.match(/<UpdateBanner \/>/g)).toHaveLength(1);
  });
});
