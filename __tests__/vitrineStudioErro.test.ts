// ============================================================
// O erro de carregar a loja, com a voz da loja (Fase 1A · 25/09/2026)
//
// Antes: um "!" de 36 px e a mensagem crua da API. O que este teste
// guarda é a separação que a Tela 4 do mockup pede — "não achamos essa
// loja" (o link não leva a uma loja publicada: tentar de novo não
// resolve) contra "a loja não carregou" (rede ou servidor: tentar de
// novo costuma resolver).
// ============================================================
import fs from "fs";
import path from "path";
import {
  classificarErroDaLoja, erroDaLoja, LINK_DA_AURA,
} from "@/components/studio/storefront/erroDaVitrine";

describe("classificarErroDaLoja", () => {
  test("404 — slug errado ou loja despublicada — é 'não achamos'", () => {
    expect(classificarErroDaLoja({ status: 404, mensagem: "Loja nao encontrada" })).toBe("nao_achamos");
  });

  test.each([400, 403, 410])("%s também diz que o endereço não é uma loja aberta", (status) => {
    expect(classificarErroDaLoja({ status })).toBe("nao_achamos");
  });

  test("sem resposta (falha de rede) é 'não carregou'", () => {
    expect(classificarErroDaLoja({ status: null, mensagem: "Failed to fetch" })).toBe("nao_carregou");
  });

  test.each([500, 502, 503, 504])("%s é 'não carregou': a loja existe, o servidor tropeçou", (status) => {
    expect(classificarErroDaLoja({ status })).toBe("nao_carregou");
  });

  test.each([408, 425, 429])("%s passa com nova tentativa: não é 'não achamos'", (status) => {
    expect(classificarErroDaLoja({ status })).toBe("nao_carregou");
  });

  test("200 com corpo quebrado (proxy devolvendo HTML) é 'não carregou'", () => {
    expect(classificarErroDaLoja({ status: 200, mensagem: "Unexpected token <" })).toBe("nao_carregou");
  });

  test("erro ausente ou status lixo cai em 'não carregou' — oferece tentar de novo", () => {
    expect(classificarErroDaLoja(null)).toBe("nao_carregou");
    expect(classificarErroDaLoja(undefined)).toBe("nao_carregou");
    expect(classificarErroDaLoja({ status: NaN })).toBe("nao_carregou");
  });
});

describe("erroDaLoja — o texto que a cliente lê", () => {
  test("404 fala da loja e aponta para a Aura", () => {
    const e = erroDaLoja({ status: 404 });
    expect(e.titulo).toBe("Não achamos essa loja");
    expect(e.texto).toMatch(/link/);
    expect(e.acao).toBe("Ir para a Aura");
    expect(LINK_DA_AURA).toBe("https://getaura.com.br");
  });

  test("rede/5xx pede para tentar de novo", () => {
    const e = erroDaLoja({ status: 503 });
    expect(e.titulo).toBe("A loja não carregou");
    expect(e.acao).toBe("Tentar de novo");
  });

  test("a mensagem crua da API nunca chega na tela", () => {
    const e = erroDaLoja({ status: 404, mensagem: "Loja nao encontrada" });
    expect(JSON.stringify(e)).not.toContain("nao encontrada");
    const r = erroDaLoja({ status: null, mensagem: "Failed to fetch" });
    expect(JSON.stringify(r)).not.toContain("Failed");
  });
});

describe("a página usa a classificação e sabe refazer a carga", () => {
  const RAIZ = path.join(__dirname, "..", "components/studio/storefront");

  test("PaginaDaVitrine desenha a tela de erro com o recarregar do hook", () => {
    const p = fs.readFileSync(path.join(RAIZ, "PaginaDaVitrine.tsx"), "utf8");
    expect(p).toContain("erroDaLoja(erro)");
    expect(p).toContain("onTentarDeNovo={sf.recarregar}");
    // O "!" de 36 px e a mensagem crua saíram.
    expect(p).not.toContain("fontSize: 36");
    expect(p).not.toContain("texto={sf.error}");
  });

  test("useStorefront guarda o status HTTP e refaz a carga pela tentativa", () => {
    const h = fs.readFileSync(path.join(RAIZ, "useStorefront.ts"), "utf8");
    expect(h).toContain("falha.status = r.status");
    expect(h).toContain("}, [slug, tentativa]);");
    expect(h).toContain("setTentativa((t) => t + 1)");
  });
});
