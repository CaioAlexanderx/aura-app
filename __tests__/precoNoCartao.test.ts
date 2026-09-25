// ============================================================
// Preço no cartão — regras puras (utils/precoNoCartao.ts).
// Mockup aprovado: docs/mockups/preco-no-cartao.html (telas 2, 3 e 4).
//
//   · automático = preço × (1 + %) para cima nos 10 centavos (42,18 → 42,20);
//   · variante com preço próprio na proporção do card_price do pai;
//   · dividido: base R$ 1.000, cartão R$ 1.110, PIX R$ 400 → cartão
//     R$ 666,00 e total R$ 1.066,00; tudo num método = preço do método; a
//     ordem não muda o total;
//   · rateio: Σ linhas = Σ pagamentos ao centavo (o que o backend e a
//     NFC-e conferem), inclusive com cupom e desconto;
//   · desconto em % sobre o preço do método, em R$ o mesmo nos dois.
// ============================================================
import {
  CARTAO_DESLIGADO, contaComOServidor, descontoDoCupom, ehCartao, editarPrecoNoDividido, editarPrecoProporcional, fraseDaConta, lerConfigDoCartao,
  linhasNoMetodo, linhasRateadas, paraCimaNos10Centavos, percentualReal, precoNoCartaoAutomatico,
  precoNoCartaoDoItem, precoNoCartaoDoProduto, resolverDividido, statusDoDividido, totalComoNoServidor,
  type DescontosDaVenda, type PrecosDaLinha,
} from "@/utils/precoNoCartao";

const LIGADO = { enabled: true, pct: 11 };

// O carrinho do mockup (telas 3–6): R$ 1.000,00 no dinheiro, R$ 1.110,00
// no cartão, com argamassa a 5% e disjuntor a 22,75% no mesmo carrinho.
const CARRINHO: PrecosDaLinha[] = [
  { qty: 10, cash: 38.0, card: 42.18 },
  { qty: 5, cash: 64.8, card: 71.93 },
  { qty: 4, cash: 49.0, card: 51.45 },
  { qty: 5, cash: 20.0, card: 24.55 },
];

function totalNoServidor(linhas: PrecosDaLinha[], alvo: number, d: DescontosDaVenda = {}) {
  return totalComoNoServidor(linhasRateadas(linhas, alvo, d), d).total;
}

describe("opção da loja", () => {
  test("desligada por padrão — qualquer coisa que não seja true", () => {
    expect(lerConfigDoCartao(undefined)).toEqual(CARTAO_DESLIGADO);
    expect(lerConfigDoCartao({})).toEqual(CARTAO_DESLIGADO);
    expect(lerConfigDoCartao({ card_price_enabled: false, card_price_pct: 11 })).toEqual(CARTAO_DESLIGADO);
  });
  test("ligada (loja Matcon) lê o %; null vira 0 e o teto é 100", () => {
    expect(lerConfigDoCartao({ matcon_enabled: true, card_price_enabled: true, card_price_pct: 11 })).toEqual({ enabled: true, pct: 11 });
    expect(lerConfigDoCartao({ matcon_enabled: true, card_price_enabled: true, card_price_pct: null })).toEqual({ enabled: true, pct: 0 });
    expect(lerConfigDoCartao({ matcon_enabled: true, card_price_enabled: true, card_price_pct: 500 })).toEqual({ enabled: true, pct: 100 });
  });
  test("ligada sem Matcon = desligada (decisão 25/09/2026: só lojas Matcon)", () => {
    expect(lerConfigDoCartao({ card_price_enabled: true, card_price_pct: 11 })).toEqual(CARTAO_DESLIGADO);
    expect(lerConfigDoCartao({ matcon_enabled: false, card_price_enabled: true, card_price_pct: 11 })).toEqual(CARTAO_DESLIGADO);
    expect(lerConfigDoCartao({ matcon_enabled: null, card_price_enabled: true, card_price_pct: 11 })).toEqual(CARTAO_DESLIGADO);
  });
  test("débito e crédito são cartão; dinheiro, PIX e crediário não", () => {
    expect(ehCartao("cartao")).toBe(true);
    expect(ehCartao("debito")).toBe(true);
    ["dinheiro", "pix", "crediario", "", null, undefined].forEach((m) => expect(ehCartao(m as any)).toBe(false));
  });
});

describe("preço no cartão automático", () => {
  test("arredonda para cima nos 10 centavos: 42,18 → 42,20", () => {
    expect(paraCimaNos10Centavos(42.18)).toBe(42.2);
    expect(paraCimaNos10Centavos(42.2)).toBe(42.2);
    expect(paraCimaNos10Centavos(42.21)).toBe(42.3);
    expect(precoNoCartaoAutomatico(38, 11)).toBe(42.2);
  });
  test("conta exata não sobe: R$ 100 com 11% = R$ 111,00 (e não 111,10)", () => {
    expect(precoNoCartaoAutomatico(100, 11)).toBe(111);
    expect(precoNoCartaoAutomatico(20, 10)).toBe(22);
  });
  test("% zero ou vazio = o mesmo preço", () => {
    expect(precoNoCartaoAutomatico(38.05, 0)).toBe(38.05);
  });
  test("produto: ajustado à mão vale como está (no centavo); sem ajuste, o %", () => {
    expect(precoNoCartaoDoProduto({ price: 38, cardPrice: 42.18 }, LIGADO)).toBe(42.18);
    expect(precoNoCartaoDoProduto({ price: 38, cardPrice: null }, LIGADO)).toBe(42.2);
    expect(precoNoCartaoDoProduto({ price: 38, cardPrice: 42.18 }, CARTAO_DESLIGADO)).toBeNull();
  });
});

describe("variante com preço próprio / linha de orçamento", () => {
  test("mesmo preço do pai → o card_price do pai, sem mexer", () => {
    expect(precoNoCartaoDoItem(40, { price: 40, cardPrice: 46.05 }, LIGADO)).toBe(46.05);
  });
  test("preço diferente → mesma proporção do pai, para cima nos 10 centavos", () => {
    // 44 × 46 / 40 = 50,60
    expect(precoNoCartaoDoItem(44, { price: 40, cardPrice: 46 }, LIGADO)).toBe(50.6);
    // 45 × 46,05 / 40 = 51,80625 → 51,90
    expect(precoNoCartaoDoItem(45, { price: 40, cardPrice: 46.05 }, LIGADO)).toBe(51.9);
  });
  test("pai sem card_price → o % da loja sobre o preço da variante", () => {
    expect(precoNoCartaoDoItem(44, { price: 40, cardPrice: null }, LIGADO)).toBe(48.9); // 48,84 → 48,90
    expect(precoNoCartaoDoItem(44, null, LIGADO)).toBe(48.9);
  });
  test("opção desligada → null (o carrinho nem guarda preço no cartão)", () => {
    expect(precoNoCartaoDoItem(44, { price: 40, cardPrice: 46 }, CARTAO_DESLIGADO)).toBeNull();
  });
  test("selo do cadastro: % real do ajustado à mão", () => {
    expect(percentualReal(38, 43.7)).toBe(15);
    expect(percentualReal(0, 10)).toBeNull();
  });
});

describe("pagamento dividido (tela 4)", () => {
  test("PIX R$ 400 + cartão: faltam R$ 600 da base → cartão R$ 666,00, total R$ 1.066,00", () => {
    const dv = resolverDividido([{ method: "pix", value: 400 }, { method: "cartao", value: 0, auto: true }], 1000, 1110);
    expect(dv.entradas[1].value).toBe(666);
    expect(dv.total).toBe(1066);
    expect(dv.equilibrado).toBe(true);
    // QA 23/09/2026 (Matcon): uma frase só — o "Pronto" já traz o porquê
    // do valor no cartão. Nada de "Faltam" junto com "Pronto".
    expect(statusDoDividido(dv)).toBe(
      "Pronto · a conta fecha em R$ 1.066,00. No cartão, os R$ 600,00 que faltavam ficam R$ 666,00 (11% a mais).",
    );
    expect(fraseDaConta(dv)).toBe("No cartão, os R$ 600,00 que faltavam ficam R$ 666,00 (11% a mais).");
  });

  test("frase de balcão (QA 23/09): o exemplo da venda nº 176", () => {
    const dv = resolverDividido([{ method: "pix", value: 400 }, { method: "cartao", value: 0, auto: true }], 1142.4, 1268.16);
    expect(fraseDaConta(dv)).toBe("No cartão, os R$ 742,40 que faltavam ficam R$ 824,13 (11% a mais).");
    expect(fraseDaConta(dv)).not.toMatch(/÷|×|=/);
    expect(statusDoDividido(dv)).toBe(
      "Pronto · a conta fecha em R$ 1.224,13. No cartão, os R$ 742,40 que faltavam ficam R$ 824,13 (11% a mais).",
    );
  });

  test("frase: 'o que falta' no PIX; nada faltando; cartão mais barato; sem diferença", () => {
    // No PIX não há acréscimo a explicar: só o "Pronto".
    const pix = resolverDividido([{ method: "cartao", value: 333 }, { method: "pix", value: 0, auto: true }], 1000, 1110);
    expect(fraseDaConta(pix)).toBe("");
    expect(statusDoDividido(pix)).toBe("Pronto · a conta fecha em R$ 1.033,00");
    const pronto = resolverDividido([{ method: "pix", value: 1000 }, { method: "cartao", value: 0, auto: true }], 1000, 1110);
    expect(fraseDaConta(pronto)).toBe("");
    expect(statusDoDividido(pronto)).toBe("Pronto · a conta fecha em R$ 1.000,00");
    const semAuto = resolverDividido([{ method: "pix", value: 400 }], 1000, 1110);
    expect(fraseDaConta(semAuto)).toBe("");
    const maisBarato = resolverDividido([{ method: "cartao", value: 0, auto: true }], 1000, 970);
    expect(fraseDaConta(maisBarato)).toBe("No cartão, os R$ 1.000,00 que faltavam ficam R$ 970,00 (3% a menos).");
    const igual = resolverDividido([{ method: "debito", value: 0, auto: true }], 1000, 1000);
    expect(fraseDaConta(igual)).toBe("");
    expect(statusDoDividido(igual)).toBe("Pronto · a conta fecha em R$ 1.000,00");
  });

  test("uma frase por vez: 'Faltam' e 'Pronto' nunca juntos", () => {
    const casos = [
      resolverDividido([{ method: "pix", value: 400 }, { method: "cartao", value: 0, auto: true }], 1142.4, 1268.16),
      resolverDividido([{ method: "cartao", value: 333 }, { method: "pix", value: 0, auto: true }], 1000, 1110),
      resolverDividido([{ method: "pix", value: 400 }], 1000, 1110),
      resolverDividido([{ method: "pix", value: 1200 }, { method: "cartao", value: 0, auto: true }], 1000, 1110),
    ];
    for (const dv of casos) {
      const st = statusDoDividido(dv);
      expect(/Pronto/.test(st) && /Faltam/.test(st)).toBe(false);
      if (dv.equilibrado) expect(st.startsWith("Pronto")).toBe(true);
    }
  });

  test("tudo num método só dá exatamente o preço daquele método", () => {
    const cartoes = resolverDividido([{ method: "cartao", value: 555 }, { method: "debito", value: 0, auto: true }], 1000, 1110);
    expect(cartoes.total).toBe(1110);
    const dinheiro = resolverDividido([{ method: "dinheiro", value: 600 }, { method: "pix", value: 0, auto: true }], 1000, 1110);
    expect(dinheiro.total).toBe(1000);
    const soCartao = resolverDividido([{ method: "cartao", value: 0, auto: true }], 1000, 1110);
    expect(soCartao.total).toBe(1110);
  });

  test("crediário abate da base pelo valor, como dinheiro", () => {
    const dv = resolverDividido(
      [{ method: "crediario", value: 500 }, { method: "dinheiro", value: 200 }, { method: "debito", value: 0, auto: true }],
      1000, 1110,
    );
    expect(dv.entradas[2].value).toBe(333);
    expect(dv.total).toBe(1033);
  });

  test("a ordem dos pagamentos não muda o total", () => {
    const cartaoPrimeiro = resolverDividido([{ method: "cartao", value: 300 }, { method: "pix", value: 0, auto: true }], 1000, 1110);
    const pix = cartaoPrimeiro.entradas[1].value;
    const pixPrimeiro = resolverDividido([{ method: "pix", value: pix }, { method: "cartao", value: 0, auto: true }], 1000, 1110);
    expect(pixPrimeiro.entradas[1].value).toBe(300);
    expect(pixPrimeiro.total).toBe(cartaoPrimeiro.total);
    const a = resolverDividido([{ method: "crediario", value: 500 }, { method: "dinheiro", value: 200 }, { method: "debito", value: 0, auto: true }], 1000, 1110);
    const b = resolverDividido([{ method: "dinheiro", value: 200 }, { method: "crediario", value: 500 }, { method: "debito", value: 0, auto: true }], 1000, 1110);
    expect(a.total).toBe(b.total);
  });

  test("faltando: o aviso fala as duas línguas; sobrando: avisa no dinheiro", () => {
    const falta = resolverDividido([{ method: "pix", value: 400 }], 1000, 1110);
    expect(falta.equilibrado).toBe(false);
    expect(statusDoDividido(falta)).toBe("Faltam R$ 600,00 no dinheiro ou PIX, ou R$ 666,00 no cartão");
    const sobra = resolverDividido([{ method: "pix", value: 1200 }, { method: "cartao", value: 0, auto: true }], 1000, 1110);
    expect(sobra.entradas[1].value).toBe(0);
    expect(sobra.falta).toBe(-200);
    expect(statusDoDividido(sobra)).toContain("Sobrando R$ 200,00");
  });
});

describe("rateio do acréscimo nas linhas da venda", () => {
  test("os dois totais do carrinho do mockup: R$ 1.000,00 e R$ 1.110,00", () => {
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, false), {}).total).toBe(1000);
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, true), {}).total).toBe(1110);
  });

  test("PIX 400 + cartão 666: Σ linhas = R$ 1.066,00 no servidor e na nota", () => {
    const linhas = linhasRateadas(CARRINHO, 1066, {});
    expect(totalComoNoServidor(linhas, {}).total).toBe(1066);
    // A NFC-e soma qty × unit_price sem arredondar linha a linha.
    const nota = CARRINHO.reduce((s, l, i) => s + l.qty * linhas[i].unit_price, 0);
    expect(Math.round(nota * 100) / 100).toBe(1066);
    // Cada item fica entre o preço do dinheiro e o do cartão.
    linhas.forEach((l, i) => {
      expect(l.unit_price).toBeGreaterThanOrEqual(CARRINHO[i].cash - 0.01);
      expect(l.unit_price).toBeLessThanOrEqual(CARRINHO[i].card + 0.01);
    });
  });

  test("venda toda num método = exatamente as linhas daquele método", () => {
    expect(linhasRateadas(CARRINHO, 1000, {})).toEqual(linhasNoMetodo(CARRINHO, false));
    expect(linhasRateadas(CARRINHO, 1110, {})).toEqual(linhasNoMetodo(CARRINHO, true));
  });

  test("com cupom de 5%: dividido fecha ao centavo", () => {
    const d: DescontosDaVenda = { cupom: { tipo: "percent", valor: 5 } };
    const C = totalComoNoServidor(linhasNoMetodo(CARRINHO, false), d).total;
    const K = totalComoNoServidor(linhasNoMetodo(CARRINHO, true), d).total;
    expect(C).toBe(950);
    expect(K).toBe(1054.5);
    const dv = resolverDividido([{ method: "pix", value: 400 }, { method: "cartao", value: 0, auto: true }], C, K);
    expect(totalNoServidor(CARRINHO, dv.total, d)).toBe(dv.total);
  });

  test("propriedade: Σ linhas = Σ pagamentos em 300 carrinhos e divisões", () => {
    let semente = 7;
    const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
    for (let k = 0; k < 300; k++) {
      const n = 1 + Math.floor(rnd() * 5);
      const linhas: PrecosDaLinha[] = [];
      for (let i = 0; i < n; i++) {
        const cash = Math.round((1 + rnd() * 300) * 100) / 100;
        const card = precoNoCartaoAutomatico(cash, 3 + rnd() * 20);
        const qty = rnd() < 0.3 ? Math.round(rnd() * 250) / 10 + 0.5 : 1 + Math.floor(rnd() * 12);
        linhas.push({ qty, cash, card });
      }
      const d: DescontosDaVenda = rnd() < 0.3 ? { cupom: { tipo: "percent", valor: 5 } }
        : rnd() < 0.5 ? { manualValor: 10 } : {};
      const C = totalComoNoServidor(linhasNoMetodo(linhas, false), d).total;
      const K = totalComoNoServidor(linhasNoMetodo(linhas, true), d).total;
      const pix = Math.round(rnd() * C * 100) / 100;
      const dv = resolverDividido([{ method: "pix", value: pix }, { method: "cartao", value: 0, auto: true }], C, K);
      expect(totalNoServidor(linhas, dv.total, d)).toBe(dv.total);
    }
  });
});

describe("descontos nos dois preços", () => {
  test("desconto em % vale sobre o preço do método", () => {
    const d = { manualPct: 10 };
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, false), d).desconto).toBe(100);
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, true), d).desconto).toBe(111);
  });
  test("desconto em R$ tira o mesmo valor dos dois", () => {
    const d = { manualValor: 50 };
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, false), d).total).toBe(950);
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, true), d).total).toBe(1060);
  });
  test("cupom fixo: o mesmo valor nos dois", () => {
    const d: DescontosDaVenda = { cupom: { tipo: "fixed", valor: 30 } };
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, false), d).total).toBe(970);
    expect(totalComoNoServidor(linhasNoMetodo(CARRINHO, true), d).total).toBe(1080);
  });
});

describe("lápis do carrinho", () => {
  test("editar um preço leva o outro na mesma proporção", () => {
    expect(editarPrecoProporcional({ cash: 38, card: 42.2 }, 34.2, false)).toEqual({ cash: 34.2, card: 37.98 });
    expect(editarPrecoProporcional({ cash: 38, card: 42.2 }, 40, true)).toEqual({ card: 40, cash: 36.02 });
  });
  test("no dividido: o novo vale sobre o preço rateado mostrado", () => {
    // mostrado R$ 40,00 (entre 38 e 42,20); digitou R$ 36,00 → −10% nos dois
    expect(editarPrecoNoDividido({ cash: 38, card: 42.2 }, 40, 36)).toEqual({ cash: 34.2, card: 37.98 });
    expect(editarPrecoNoDividido({ cash: 38, card: 42.2 }, 0, 36)).toEqual({ cash: 36, card: 36 });
  });
});

// QA 23/09/2026 — a tela final mostra a conta que o servidor gravou.
describe("tela final da venda", () => {
  test("descontoDoCupom: % no centavo, fixo com teto", () => {
    expect(descontoDoCupom({ tipo: "percent", valor: 15 }, 1440.15)).toBe(216.02);
    expect(descontoDoCupom({ tipo: "percent", valor: 15 }, 1344)).toBe(201.6);
    expect(descontoDoCupom({ tipo: "fixed", valor: 50 }, 30)).toBe(30);
    expect(descontoDoCupom(null, 100)).toBe(0);
  });
  test("contaComOServidor: vale o total e o desconto gravados; o manual sai da conta local", () => {
    const local = { subtotal: 1440.15, cupom: 201.6, manual: 0, desconto: 201.6, total: 1224.13 };
    expect(contaComOServidor(local, { total_amount: "1224.13", discount_amount: "216.02" }))
      .toEqual({ subtotal: 1440.15, cupom: 216.02, manual: 0, desconto: 216.02, total: 1224.13 });
    const comManual = { subtotal: 200, cupom: 20, manual: 10, desconto: 30, total: 170 };
    expect(contaComOServidor(comManual, { total_amount: 170, discount_amount: 30 }))
      .toEqual({ subtotal: 200, cupom: 20, manual: 10, desconto: 30, total: 170 });
  });
  test("sem os números do servidor, fica a conta local", () => {
    const local = { subtotal: 100, cupom: 5, manual: 0, desconto: 5, total: 95 };
    expect(contaComOServidor(local, { id: "x" } as any)).toBe(local);
    expect(contaComOServidor(local, null)).toBe(local);
  });
});
