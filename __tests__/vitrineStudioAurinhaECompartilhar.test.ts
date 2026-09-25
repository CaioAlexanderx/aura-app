// ============================================================
// Vitrine Studio · Onda 1B — link da Aurinha e Compartilhar
//
// 1. linkDaAurinha.ts: `?produto=&variante=&origem=&conversa=` (contrato
//    em Aura-backend/docs/aurinha-checkout-contract.md). Parâmetro
//    inválido degrada calado; a atribuição vive na aba e vai no pedido.
// 2. compartilhar.ts: folha do sistema no celular, copiar no computador.
// ============================================================
import {
  lerLinkDaAurinha, origemValida, ehUuid, veioDaAurinha,
  guardarAtribuicao, atribuicaoGuardada, camposDeAtribuicao, ORIGEM_MAX,
} from "@/components/studio/storefront/linkDaAurinha";
import { compartilharOuCopiar } from "@/components/studio/storefront/compartilhar";

const PRODUTO = "8F21C4A9-1B2C-4D3E-8F90-A1B2C3D4E5F6";
const CONVERSA = "3f0e7a52-9c1d-4b8e-a6f2-0d5c7e9b1a24";

/** Um sessionStorage de mentira, por teste. */
function guarda() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    _m: m,
  };
}

describe("lerLinkDaAurinha", () => {
  test("o link do contrato inteiro", () => {
    expect(lerLinkDaAurinha({
      slug: "sheid-mania", produto: PRODUTO, variante: "M-vinho", origem: "aurinha", conversa: CONVERSA,
    })).toEqual({
      produto: PRODUTO.toLowerCase(), variante: "M-vinho", origem: "aurinha", conversa: CONVERSA,
    });
  });

  test("produto que não é UUID degrada para a home (null), sem erro", () => {
    expect(lerLinkDaAurinha({ produto: "caneca-azul" }).produto).toBeNull();
    expect(lerLinkDaAurinha({ produto: "" }).produto).toBeNull();
    expect(lerLinkDaAurinha({ produto: 42 as any }).produto).toBeNull();
  });

  test("parâmetro repetido na URL (lista) usa o primeiro", () => {
    expect(lerLinkDaAurinha({ produto: [PRODUTO, "x"] }).produto).toBe(PRODUTO.toLowerCase());
  });

  test("sem parâmetro nenhum, nada", () => {
    expect(lerLinkDaAurinha(undefined)).toEqual({ produto: null, variante: null, origem: null, conversa: null });
    expect(lerLinkDaAurinha({ slug: "sheid-mania" }).origem).toBeNull();
  });

  test("conversa inválida some, a origem fica", () => {
    const l = lerLinkDaAurinha({ origem: "aurinha", conversa: "nao-e-uuid" });
    expect(l.origem).toBe("aurinha");
    expect(l.conversa).toBeNull();
  });

  test("a faixa só para a Aurinha", () => {
    expect(veioDaAurinha(lerLinkDaAurinha({ origem: "aurinha" }))).toBe(true);
    expect(veioDaAurinha(lerLinkDaAurinha({ origem: "AURINHA" }))).toBe(true);
    expect(veioDaAurinha(lerLinkDaAurinha({ origem: "instagram" }))).toBe(false);
    expect(veioDaAurinha(lerLinkDaAurinha({}))).toBe(false);
  });
});

describe("origemValida e ehUuid", () => {
  test("origem curta e simples passa; longa ou estranha não", () => {
    expect(origemValida("aurinha")).toBe("aurinha");
    expect(origemValida("bio_instagram")).toBe("bio_instagram");
    expect(origemValida("x".repeat(ORIGEM_MAX))).toHaveLength(32);
    expect(origemValida("x".repeat(ORIGEM_MAX + 1))).toBeNull();
    expect(origemValida("<script>")).toBeNull();
    expect(origemValida("com espaço")).toBeNull();
    expect(origemValida("")).toBeNull();
  });

  test("UUID", () => {
    expect(ehUuid(CONVERSA)).toBe(true);
    expect(ehUuid(PRODUTO)).toBe(true);
    expect(ehUuid("8f21c4a9")).toBe(false);
    expect(ehUuid(null)).toBe(false);
  });
});

describe("a atribuição na aba vai no pedido", () => {
  test("guarda origem e conversa e devolve os campos do POST", () => {
    const g = guarda();
    guardarAtribuicao("Sheid-Mania", lerLinkDaAurinha({ origem: "aurinha", conversa: CONVERSA }), g);
    const a = atribuicaoGuardada("sheid-mania", g);
    expect(a).toEqual({ origem: "aurinha", hub_conversation_id: CONVERSA });
    expect(camposDeAtribuicao(a)).toEqual({ origem: "aurinha", hub_conversation_id: CONVERSA });
  });

  test("sem conversa, só a origem", () => {
    const g = guarda();
    guardarAtribuicao("x", lerLinkDaAurinha({ origem: "instagram" }), g);
    expect(camposDeAtribuicao(atribuicaoGuardada("x", g))).toEqual({ origem: "instagram" });
  });

  test("link sem origem não apaga a que já estava (a cliente só navegou)", () => {
    const g = guarda();
    guardarAtribuicao("x", lerLinkDaAurinha({ origem: "aurinha", conversa: CONVERSA }), g);
    guardarAtribuicao("x", lerLinkDaAurinha({ produto: PRODUTO }), g);
    expect(atribuicaoGuardada("x", g)?.origem).toBe("aurinha");
  });

  test("uma loja não herda a atribuição da outra", () => {
    const g = guarda();
    guardarAtribuicao("loja-a", lerLinkDaAurinha({ origem: "aurinha" }), g);
    expect(atribuicaoGuardada("loja-b", g)).toBeNull();
  });

  test("nada guardado, lixo guardado ou storage bloqueado: pedido sem atribuição", () => {
    const g = guarda();
    expect(camposDeAtribuicao(atribuicaoGuardada("x", g))).toEqual({});
    g.setItem("aura-vitrine-origem-x", "{quebrado");
    expect(atribuicaoGuardada("x", g)).toBeNull();
    g.setItem("aura-vitrine-origem-x", JSON.stringify({ origem: "<b>", hub_conversation_id: CONVERSA }));
    expect(atribuicaoGuardada("x", g)).toBeNull();
    const bloqueado = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("x"); } };
    expect(() => guardarAtribuicao("x", lerLinkDaAurinha({ origem: "aurinha" }), bloqueado)).not.toThrow();
    expect(atribuicaoGuardada("x", bloqueado)).toBeNull();
    expect(atribuicaoGuardada("x", null)).toBeNull();
  });

  test("o pedido do Studio leva os campos (useStorefront)", () => {
    const fs = require("fs");
    const path = require("path");
    const h = fs.readFileSync(path.join(__dirname, "..", "components/studio/storefront/useStorefront.ts"), "utf8");
    expect(h).toContain("...camposDeAtribuicao(atribuicaoGuardada(slug)),");
  });
});

describe("compartilharOuCopiar", () => {
  const dados = { titulo: "Caneca · Sheid Mania", url: "https://loja.getaura.com.br/sheid-mania/p/1" };

  test("celular com folha do sistema: compartilha", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const copiar = jest.fn();
    expect(await compartilharOuCopiar(dados, { share, toque: true, copiar })).toBe("compartilhado");
    expect(share).toHaveBeenCalledWith({ title: dados.titulo, url: dados.url });
    expect(copiar).not.toHaveBeenCalled();
  });

  test("fechar a folha não copia por cima", async () => {
    const share = jest.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    const copiar = jest.fn();
    expect(await compartilharOuCopiar(dados, { share, toque: true, copiar })).toBe("cancelado");
    expect(copiar).not.toHaveBeenCalled();
  });

  test("folha que falha por outro motivo cai para copiar", async () => {
    const share = jest.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    const copiar = jest.fn().mockResolvedValue(undefined);
    expect(await compartilharOuCopiar(dados, { share, toque: true, copiar })).toBe("copiado");
    expect(copiar).toHaveBeenCalledWith(dados.url);
  });

  test("computador copia direto, mesmo com a folha disponível (nota do mockup)", async () => {
    const share = jest.fn();
    const copiar = jest.fn().mockResolvedValue(undefined);
    expect(await compartilharOuCopiar(dados, { share, toque: false, copiar })).toBe("copiado");
    expect(share).not.toHaveBeenCalled();
  });

  test("sem folha, copia; canShare negando também copia", async () => {
    const copiar = jest.fn().mockResolvedValue(undefined);
    expect(await compartilharOuCopiar(dados, { toque: true, copiar })).toBe("copiado");
    const share = jest.fn();
    expect(await compartilharOuCopiar(dados, { share, canShare: () => false, toque: true, copiar })).toBe("copiado");
    expect(share).not.toHaveBeenCalled();
  });

  test("sem folha e sem área de transferência: falhou (a tela avisa)", async () => {
    expect(await compartilharOuCopiar(dados, {})).toBe("falhou");
    const copiar = jest.fn().mockRejectedValue(new Error("negado"));
    expect(await compartilharOuCopiar(dados, { copiar })).toBe("falhou");
  });
});
