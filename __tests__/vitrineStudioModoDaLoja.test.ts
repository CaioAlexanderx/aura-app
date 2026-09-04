// ============================================================
// A loja no pico (04/09/2026)
//
// Em dezembro a lojista vende o que não consegue produzir. A saída que
// ela tinha era despublicar a loja — e junto ia a vitrine, o Instagram e
// o orçamento que ela produziria em janeiro.
//
// Fechar não pode apagar a loja: produtos, fotos, preço e mockup 3D
// continuam inteiros, e o botão vira "Pedir orçamento".
// ============================================================
import {
  modoDaVitrine, avisoDePrazo, dataCurta, DIAS_PARA_AVISAR,
} from "@/components/studio/storefront/modoDaVitrine";

const EM = (iso: string) => new Date(iso);

describe("loja aberta", () => {
  test("com o campo dizendo que aceita", () => {
    const m = modoDaVitrine({ pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: null } });
    expect(m.aceita).toBe(true);
    expect(m.rotuloDoBotao).toBe("Comprar agora");
  });

  test("payload ANTIGO, sem o campo, continua vendendo", () => {
    // Cache do navegador ou backend anterior. O erro seguro aqui é
    // deixar vender — travar uma loja aberta seria pior.
    expect(modoDaVitrine({}).aceita).toBe(true);
    expect(modoDaVitrine(null).aceita).toBe(true);
    expect(modoDaVitrine({ pedidos: null }).aceita).toBe(true);
  });
});

describe("loja fechada para pedidos", () => {
  const fechada = {
    pedidos: {
      aceita: false, motivo: "pausado",
      recado: "No momento a loja esta fechada para pedidos novos.",
      pedidos_ate: null,
    },
  };

  test("o botão principal vira orçamento", () => {
    expect(modoDaVitrine(fechada).rotuloDoBotao).toBe("Pedir orçamento");
  });

  test("o recado do servidor é o que a cliente lê", () => {
    expect(modoDaVitrine(fechada).recado).toContain("fechada para pedidos");
  });

  test("servidor sem recado ainda produz uma frase", () => {
    // Rede de segurança: loja sem botão de comprar e sem explicação
    // parece quebrada.
    const m = modoDaVitrine({ pedidos: { aceita: false, motivo: "prazo", recado: null, pedidos_ate: null } });
    expect(m.recado.length).toBeGreaterThan(30);
    expect(m.recado).toMatch(/orçamento/i);
  });
});

describe("o aviso de prazo, enquanto ainda dá para pedir", () => {
  const loja = (ate: string) => ({
    pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: ate },
  });

  test("não aparece quando falta muito", () => {
    // "Aceito até 20/12" em setembro não informa, ocupa.
    expect(avisoDePrazo(loja("2026-12-20"), EM("2026-09-04T12:00:00"))).toBeNull();
  });

  test("aparece quando falta pouco", () => {
    const a = avisoDePrazo(loja("2026-12-20"), EM("2026-12-05T12:00:00"));
    expect(a).toContain("20/12");
  });

  test("no limite da janela, ainda aparece", () => {
    const dia = new Date("2026-12-20T12:00:00");
    dia.setDate(dia.getDate() - DIAS_PARA_AVISAR);
    expect(avisoDePrazo(loja("2026-12-20"), dia)).not.toBeNull();
  });

  test("no último dia, a frase muda", () => {
    expect(avisoDePrazo(loja("2026-12-20"), EM("2026-12-20T09:00:00")))
      .toBe("Último dia para pedir com entrega nesta temporada.");
  });

  test("na véspera, também", () => {
    expect(avisoDePrazo(loja("2026-12-20"), EM("2026-12-19T09:00:00")))
      .toBe("Amanhã é o último dia para pedir nesta temporada.");
  });

  test("passada a data, o aviso some — quem fala é o modo fechado", () => {
    expect(avisoDePrazo(loja("2026-12-20"), EM("2026-12-21T09:00:00"))).toBeNull();
  });

  test("loja já fechada não mostra aviso de prazo", () => {
    const l = { pedidos: { aceita: false, motivo: "prazo", recado: "x", pedidos_ate: "2026-12-20" } };
    expect(avisoDePrazo(l, EM("2026-12-19T09:00:00"))).toBeNull();
  });

  test("sem data, sem aviso", () => {
    expect(avisoDePrazo({ pedidos: { aceita: true, pedidos_ate: null } })).toBeNull();
    expect(avisoDePrazo({})).toBeNull();
  });
});

describe("a data escrita para gente", () => {
  test("no ano corrente, sem o ano", () => {
    expect(dataCurta("2026-12-20", EM("2026-09-04T12:00:00"))).toBe("20/12");
  });

  test("em outro ano, com o ano", () => {
    expect(dataCurta("2027-01-05", EM("2026-09-04T12:00:00"))).toBe("05/01/2027");
  });

  test("lixo não vira data", () => {
    expect(dataCurta("dezembro")).toBe("");
    expect(dataCurta(null)).toBe("");
  });
});

describe("o configurador respeita o modo", () => {
  const fs = require("fs");
  const path = require("path");
  const conf = fs.readFileSync(
    path.join(__dirname, "..", "components", "studio", "storefront", "ProductConfigurator.tsx"),
    "utf8");

  test("o rótulo do botão vem do modo, não é fixo", () => {
    expect(conf).toContain("{modo.rotuloDoBotao}");
  });

  test("com a loja fechada, o botão leva ao orçamento", () => {
    expect(conf).toContain("if (!modo.aceita) {");
    expect(conf).toContain('sf.goTo("lote")');
  });

  test("o carrinho some quando não há checkout", () => {
    expect(conf).toContain("{modo.aceita ? (");
  });

  test("e a cliente lê por que o botão mudou", () => {
    expect(conf).toContain("{modo.recado}");
  });
});
