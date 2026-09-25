// ============================================================
// Temporada e loja fechada (Fase 1C · 25/09/2026)
//
// Três peças puras:
//   - faixaDaTemporada: o que a faixa da vitrine diz e com que voz;
//   - lojaFechada: para onde vai o orçamento da sacola e como o 409 do
//     envio vira "a loja fechou", e não erro cru;
//   - pedidosPelaLoja (painel): o formulário, a validação dos IDs e a
//     prévia, que roda a MESMA regra da vitrine.
// ============================================================
import {
  faixaDaTemporada, diasAtePrazo, DIAS_PARA_AVISAR,
} from "@/components/studio/storefront/modoDaVitrine";
import { destinoDoOrcamento, lojaFechouNoEnvio } from "@/components/studio/storefront/lojaFechada";
import {
  RECADO_MAX, RECADO_PADRAO,
  formDaConfig, corpoDoSalvar, mesmoForm, validarGa4, validarPixel,
  problemaDoForm, pedidosDoForm, previaNaVitrine,
} from "@/components/screens/studio-loja-digital/pedidosPelaLoja";

const EM = (iso: string) => new Date(iso + "T12:00:00");
const aberta = (ate: string | null) => ({ pedidos: { aceita: true, motivo: null, recado: null, pedidos_ate: ate } });

describe("a faixa da temporada", () => {
  test("longe da data, nada", () => {
    expect(faixaDaTemporada(aberta("2026-12-20"), EM("2026-09-25"))).toBeNull();
  });

  test("sem data, nada", () => {
    expect(faixaDaTemporada(aberta(null), EM("2026-12-19"))).toBeNull();
    expect(faixaDaTemporada({}, EM("2026-12-19"))).toBeNull();
  });

  test("perto da data: âmbar, com o texto de avisoDePrazo", () => {
    const f = faixaDaTemporada(aberta("2026-12-20"), EM("2026-12-05"));
    expect(f).toEqual({ texto: "Pedidos até 20/12 — depois disso, só orçamento.", tom: "prazo" });
  });

  test("último dia e véspera: vermelho", () => {
    expect(faixaDaTemporada(aberta("2026-12-20"), EM("2026-12-20"))).toEqual({
      texto: "Último dia para pedir com entrega nesta temporada.", tom: "ultimo_dia",
    });
    expect(faixaDaTemporada(aberta("2026-12-20"), EM("2026-12-19"))?.tom).toBe("ultimo_dia");
    expect(faixaDaTemporada(aberta("2026-12-20"), EM("2026-12-18"))?.tom).toBe("prazo");
  });

  test("loja fechada: o recado da lojista, sempre", () => {
    const f = faixaDaTemporada({
      pedidos: { aceita: false, motivo: "pausado", recado: "Voltamos em 6 de janeiro.", pedidos_ate: null },
    });
    expect(f).toEqual({ texto: "Voltamos em 6 de janeiro.", tom: "fechada" });
  });

  test("diasAtePrazo conta dias de calendário", () => {
    expect(diasAtePrazo("2026-12-20", EM("2026-12-20"))).toBe(0);
    expect(diasAtePrazo("2026-12-20", EM("2026-11-29"))).toBe(DIAS_PARA_AVISAR);
    expect(diasAtePrazo("dezembro", EM("2026-11-29"))).toBeNull();
  });
});

describe("a sacola com a loja fechada", () => {
  const linhas: any[] = [{ lineId: "1", qty: 2, values: {}, product: { id: "p1", name: "Caneca", price: 49.9 } }];

  test("com WhatsApp, o orçamento vai pelo WhatsApp com a lista", () => {
    const d = destinoDoOrcamento({ numero: "(12) 99999-0001", linhas, nomeDaLoja: "Sheid Mania" });
    expect(d.tipo).toBe("whatsapp");
    expect(d.tipo === "whatsapp" && decodeURIComponent(d.link)).toContain("*Caneca* × 2");
  });

  test("sem WhatsApp, a tela de orçamento em lote", () => {
    expect(destinoDoOrcamento({ numero: null, linhas })).toEqual({ tipo: "lote" });
  });
});

describe("o 409 do envio", () => {
  test("loja fechada: vira o store.pedidos novo, com o recado", () => {
    expect(lojaFechouNoEnvio(409, {
      error: "Voltamos em 6 de janeiro.", motivo: "pausado", pedidos_ate: null,
    })).toEqual({ aceita: false, motivo: "pausado", recado: "Voltamos em 6 de janeiro.", pedidos_ate: null });
    expect(lojaFechouNoEnvio(409, { error: "Fechou", motivo: "prazo", pedidos_ate: "2026-12-20" })?.motivo)
      .toBe("prazo");
  });

  test("o outro 409 — frete desatualizado — não fecha a loja", () => {
    expect(lojaFechouNoEnvio(409, { error: "Valor de frete desatualizado.", server_fee: 10, client_fee: 8 }))
      .toBeNull();
  });

  test("outros status não fecham a loja", () => {
    expect(lojaFechouNoEnvio(400, { error: "x", motivo: "pausado" })).toBeNull();
    expect(lojaFechouNoEnvio(409, null)).toBeNull();
  });
});

describe("painel · o formulário de Pedidos pela loja", () => {
  test("lê o GET, com padrões para o que não veio", () => {
    expect(formDaConfig({})).toEqual({
      aceitando: true, recado: "", ate: "", retiradaPorApp: false, ga4: "", pixel: "",
    });
    expect(formDaConfig({
      pedidos_pausados: true, pedidos_ate: "2026-12-20", pedidos_recado: "Voltamos em janeiro.",
      courier_pickup_enabled: true, ga4_measurement_id: "G-ABC123", meta_pixel_id: "123456789012345",
    })).toEqual({
      aceitando: false, recado: "Voltamos em janeiro.", ate: "2026-12-20",
      retiradaPorApp: true, ga4: "G-ABC123", pixel: "123456789012345",
    });
  });

  test("salva só as seis colunas da aba; vazio vira null (limpa)", () => {
    expect(corpoDoSalvar({
      aceitando: true, recado: "  ", ate: "", retiradaPorApp: false, ga4: " g-abc123 ", pixel: "",
    })).toEqual({
      pedidos_pausados: false, pedidos_ate: null, pedidos_recado: null,
      courier_pickup_enabled: false, ga4_measurement_id: "G-ABC123", meta_pixel_id: null,
    });
  });

  test("alteração é o que muda o que vai ao servidor, não espaço em branco", () => {
    const a = formDaConfig({ pedidos_recado: "Oi" });
    expect(mesmoForm(a, { ...a, recado: "Oi  " })).toBe(true);
    expect(mesmoForm(a, { ...a, aceitando: false })).toBe(false);
  });

  test("GA4 ao digitar, na régua da vitrine", () => {
    expect(validarGa4("").estado).toBe("vazio");
    expect(validarGa4("G-8Q3FQ2N1KM")).toEqual({ estado: "ok", mensagem: "Formato válido" });
    expect(validarGa4("g-8q3fq2n1km").estado).toBe("ok");
    expect(validarGa4("UA-1234-1").estado).toBe("erro");
  });

  test("Pixel ao digitar, dizendo o que falta", () => {
    expect(validarPixel("").estado).toBe("vazio");
    expect(validarPixel("123456789012345").estado).toBe("ok");
    expect(validarPixel("741852").mensagem).toMatch(/^Faltam dígitos/);
    expect(validarPixel("12345678901234567").mensagem).toMatch(/^Dígitos demais/);
    expect(validarPixel("12345abc9012345").mensagem).toMatch(/^Só números/);
  });

  test("o que impede salvar antes do servidor", () => {
    const ok = formDaConfig({});
    expect(problemaDoForm(ok)).toBeNull();
    expect(problemaDoForm({ ...ok, recado: "x".repeat(RECADO_MAX + 1) })).toMatch(/280/);
    expect(problemaDoForm({ ...ok, ga4: "UA-1" })).toMatch(/Google Analytics/);
    expect(problemaDoForm({ ...ok, pixel: "12" })).toMatch(/Pixel/);
  });
});

describe("painel · a prévia roda a regra da vitrine", () => {
  const base = formDaConfig({});

  test("aberta sem data: sem faixa, botão de comprar", () => {
    const p = previaNaVitrine(base, EM("2026-09-25"));
    expect(p).toMatchObject({ aberta: true, faixa: null, botao: "Adicionar à sacola" });
  });

  test("fechada na mão: o recado padrão do servidor quando ela não escreve", () => {
    const p = previaNaVitrine({ ...base, aceitando: false }, EM("2026-09-25"));
    expect(p.aberta).toBe(false);
    expect(p.botao).toBe("Pedir orçamento");
    expect(p.faixa).toEqual({ texto: RECADO_PADRAO.pausado, tom: "fechada" });
  });

  test("fechada com recado próprio", () => {
    const p = previaNaVitrine({ ...base, aceitando: false, recado: "Voltamos dia 6." }, EM("2026-09-25"));
    expect(p.faixa?.texto).toBe("Voltamos dia 6.");
  });

  test("data longe: mostra COMO o aviso vai aparecer e a partir de quando", () => {
    const p = previaNaVitrine({ ...base, ate: "2026-12-20" }, EM("2026-09-25"));
    expect(p.aberta).toBe(true);
    expect(p.faixa).toEqual({ texto: "Pedidos até 20/12 — depois disso, só orçamento.", tom: "prazo" });
    expect(p.legenda).toContain("a partir de 29/11");
  });

  test("data vencida: a loja já está fechada (espelho de modoDaLoja)", () => {
    const f = { ...base, ate: "2026-09-01" };
    expect(pedidosDoForm(f, EM("2026-09-25"))).toMatchObject({ aceita: false, motivo: "prazo" });
    const p = previaNaVitrine(f, EM("2026-09-25"));
    expect(p.faixa?.texto).toBe(RECADO_PADRAO.prazo);
    expect(p.legenda).toMatch(/já passou/);
  });

  test("no próprio dia limite ainda aceita", () => {
    expect(pedidosDoForm({ ...base, ate: "2026-12-20" }, EM("2026-12-20")).aceita).toBe(true);
  });
});
