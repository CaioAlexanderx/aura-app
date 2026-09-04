// ============================================================
// O orçamento em lote público (S6 · 03/09/2026)
//
// "50 canecas com o nome de cada convidado, quanto fica?" era conversa
// de WhatsApp respondida na mão. O assistente que calcula isso morava no
// painel, atrás de login — e quem organiza o casamento não tem login.
//
// As regras ficam aqui, fora da tela, porque é aqui que dá para testar:
// como uma lista colada vira nomes, o que ainda falta preencher, e o
// empurrão para a próxima faixa.
// ============================================================
import {
  nomesDaLista, nomesIgnorados, proximoDegrau, telefoneValido,
  pendenciaDoLote, dinheiro, MAXIMO_NOMES,
} from "@/components/studio/storefront/loteDaVitrine";
import type { CotacaoDoLote } from "@/components/studio/storefront/loteDaVitrine";

const FAIXAS = [
  { from: 10, pct: 5, label: "5% off acima de 10" },
  { from: 20, pct: 10, label: "10% off acima de 20" },
  { from: 50, pct: 15, label: "15% off acima de 50" },
  { from: 100, pct: 20, label: "20% off acima de 100" },
];

const cotacao = (qty: number, unit = 49.9): CotacaoDoLote => ({
  qty, unit_price: unit, discount_pct: 0, total_amount: qty * unit,
  savings: 0, tiers: FAIXAS,
});

describe("a lista colada", () => {
  test("uma por linha, que é como a pessoa cola do convite", () => {
    expect(nomesDaLista("Marília\nJoão\nAna Paula")).toEqual(["Marília", "João", "Ana Paula"]);
  });

  test("aceita vírgula e ponto-e-vírgula — quem cola de planilha traz os três", () => {
    expect(nomesDaLista("Ana, Bruno; Carla")).toEqual(["Ana", "Bruno", "Carla"]);
  });

  test("linha vazia e espaço solto não viram peça", () => {
    expect(nomesDaLista("Ana\n\n   \nBruno\n")).toEqual(["Ana", "Bruno"]);
  });

  test("nome com sobrenome fica inteiro", () => {
    expect(nomesDaLista("Maria da Silva\nJosé Carlos")).toEqual(["Maria da Silva", "José Carlos"]);
  });

  test("corta no teto, e diz quantos ficaram de fora", () => {
    const lista = Array.from({ length: 250 }, (_, i) => "Nome " + i).join("\n");
    expect(nomesDaLista(lista)).toHaveLength(MAXIMO_NOMES);
    expect(nomesIgnorados(lista)).toBe(50);
  });

  test("dentro do teto não sobra ninguém", () => {
    expect(nomesIgnorados("Ana\nBruno")).toBe(0);
  });

  test("lista vazia não quebra", () => {
    expect(nomesDaLista("")).toEqual([]);
    expect(nomesDaLista(undefined as any)).toEqual([]);
  });
});

describe("o empurrão para a próxima faixa", () => {
  test("diz quantos faltam e por quanto sai", () => {
    // 12 peças a R$ 49,90: a próxima faixa é 20, com 10% off.
    const d = proximoDegrau(cotacao(12));
    expect(d).toEqual({ faltam: 8, pct: 10, precoUn: 44.91 });
  });

  test("na última faixa, o silêncio é a resposta certa", () => {
    expect(proximoDegrau(cotacao(120))).toBeNull();
  });

  test("exatamente no degrau, aponta o seguinte", () => {
    expect(proximoDegrau(cotacao(50))?.faltam).toBe(50);
  });

  test("sem cotação ou sem faixas, não inventa empurrão", () => {
    expect(proximoDegrau(null)).toBeNull();
    expect(proximoDegrau({ ...cotacao(5), tiers: [] })).toBeNull();
  });
});

describe("o que ainda falta", () => {
  const cheio = {
    evento: "Casamento Marília & João", produtoId: "p1",
    nomes: ["Ana", "Bruno"], contato: "Caio", telefone: "(12) 99999-0000",
  };

  test("com tudo preenchido, libera", () => {
    expect(pendenciaDoLote(cheio)).toBeNull();
  });

  test("a ordem é a da tela — cobra o primeiro que falta", () => {
    expect(pendenciaDoLote({ ...cheio, evento: "" })).toMatch(/evento/i);
    expect(pendenciaDoLote({ ...cheio, produtoId: null })).toMatch(/peça/i);
    expect(pendenciaDoLote({ ...cheio, nomes: [] })).toMatch(/lista de nomes/i);
    expect(pendenciaDoLote({ ...cheio, contato: "" })).toMatch(/seu nome/i);
    expect(pendenciaDoLote({ ...cheio, telefone: "123" })).toMatch(/WhatsApp/i);
  });

  test("o WhatsApp precisa de DDD — é por onde a lojista responde", () => {
    expect(telefoneValido("(12) 99614-5447")).toBe(true);
    expect(telefoneValido("1299614544")).toBe(true);
    expect(telefoneValido("99614544")).toBe(false);
    expect(telefoneValido("")).toBe(false);
  });
});

describe("dinheiro em português", () => {
  test("vírgula decimal e dois dígitos", () => {
    expect(dinheiro(538.8)).toBe("R$ 538,80");
    expect(dinheiro(49.9)).toBe("R$ 49,90");
    expect(dinheiro(0)).toBe("R$ 0,00");
  });
});

describe("a tela esta ligada nas rotas publicas certas", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..");
  const tela = fs.readFileSync(
    path.join(RAIZ, "components/studio/storefront/OrcamentoEmLote.tsx"), "utf8");

  test("cota no bulk-quote e registra no bulk-order", () => {
    expect(tela).toContain("/studio/bulk-quote");
    expect(tela).toContain("/studio/bulk-order");
  });

  test("o preco vem do servidor, nunca de conta local", () => {
    // O desconto por volume e regra de dinheiro e mora em
    // services/studioLote.js, lido tambem pelo painel. Recalcular aqui
    // seria a conta do cliente divergindo da conta da lojista.
    expect(tela).not.toMatch(/discount_pct\s*=\s*\d/);
    expect(tela).toContain("setCotacao(j)");
  });

  test("a cotacao tem respiro — nao e uma chamada por tecla", () => {
    expect(tela).toContain("setTimeout");
    expect(tela).toContain("clearTimeout");
  });

  test("a tela diz que e orcamento, nao pedido fechado (decisao 2)", () => {
    expect(tela).toContain("ainda não é um pedido fechado");
  });

  test("o bloco B2B da home abre o assistente", () => {
    const home = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/ProductList.tsx"), "utf8");
    expect(home).toContain('sf.goTo("lote")');
  });

  test("o estagio novo e aditivo: quem nao conhece cai em list", () => {
    const tipos = fs.readFileSync(
      path.join(RAIZ, "components/studio/storefront/types.ts"), "utf8");
    expect(tipos).toContain('"sent" | "lote"');
  });
});
