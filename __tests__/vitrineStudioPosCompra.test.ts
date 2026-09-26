// ============================================================
// Vitrine Studio · Fase 4 "Pós-compra com a marca" — regras puras
//
// posCompra.ts: que visual usar, a próxima ação do acompanhamento, o
// aviso de revisão paga, os rótulos das etapas, o WhatsApp do pedido.
// repeticaoDoPedido.ts: o "Pedir outro igual" — o estado inicial do
// configurador a partir do pedido.
// ============================================================
import {
  acaoDoAcompanhamento, acompanhamentoComMarca, avisoDoAjuste, isVideoUrl, linkDoWhatsAppDoPedido,
  nomeDaLoja, revisoesIlimitadas, revisoesRestantes, rotuloDaEtapa, subtituloDoAcompanhamento, telaDaAprovacao,
  textoDasRevisoes, tituloDaAprovacao, usaVisualDaLoja,
} from "@/components/studio/storefront/posCompra/posCompra";
import {
  caminhoDeRepetir, itemParaOProduto, primeiroDisponivel, textoDaFaixaDeRepeticao,
  valoresIniciaisDaRepeticao, type RespostaDaRepeticao,
} from "@/components/studio/storefront/repeticaoDoPedido";
import { tipoDoErro } from "@/components/studio/storefront/posCompra/apiDoPosCompra";

const MARCA = {
  slug: "sheid-mania", nome: "Sheid Mania", logo_url: null, primary_color: "#D8436F",
  font_family: "classic", whatsapp: "(12) 99614-5447", vitrine_v2: false,
};

describe("que visual usar", () => {
  test("no endereço da loja, sempre o da loja — com a chave ligada ou não", () => {
    expect(usaVisualDaLoja(MARCA, { noEnderecoDaLoja: true })).toBe(true);
    expect(usaVisualDaLoja({ ...MARCA, vitrine_v2: true }, { noEnderecoDaLoja: true })).toBe(true);
  });

  test("no endereço antigo, só com a chave vitrine_v2", () => {
    expect(usaVisualDaLoja(MARCA, { noEnderecoDaLoja: false })).toBe(false);
    expect(usaVisualDaLoja({ ...MARCA, vitrine_v2: true }, { noEnderecoDaLoja: false })).toBe(true);
  });

  test("sem marca (backend de antes, empresa sem vitrine), o de sempre", () => {
    expect(usaVisualDaLoja(null, { noEnderecoDaLoja: true })).toBe(false);
    expect(usaVisualDaLoja(undefined, { noEnderecoDaLoja: false })).toBe(false);
  });

  test("OS da ótica e entrega do Matcon ficam na página deles", () => {
    const v2 = { ...MARCA, vitrine_v2: true };
    expect(acompanhamentoComMarca({ marca: v2 }, { noEnderecoDaLoja: false })).toBe(true);
    expect(acompanhamentoComMarca({ marca: v2, tipo: "oculos" }, { noEnderecoDaLoja: false })).toBe(false);
    expect(acompanhamentoComMarca({ marca: v2, tipo: "entrega" }, { noEnderecoDaLoja: true })).toBe(false);
  });

  test("nome da loja nunca vazio", () => {
    expect(nomeDaLoja(MARCA)).toBe("Sheid Mania");
    expect(nomeDaLoja({ ...MARCA, nome: null }, "Sheid LTDA")).toBe("Sheid LTDA");
    expect(nomeDaLoja(null)).toBe("a loja");
  });
});

describe("aprovar a arte", () => {
  test("a tela pelo estado do link e pela resposta", () => {
    expect(telaDaAprovacao("pending")).toBe("aprovar");
    expect(telaDaAprovacao("pending", "approve")).toBe("aprovada");
    expect(telaDaAprovacao("pending", "request_changes")).toBe("ajuste");
    expect(telaDaAprovacao("approved")).toBe("aprovada");
    expect(telaDaAprovacao("changes_requested")).toBe("ajuste");
    expect(telaDaAprovacao("expired")).toBe("expirado");
  });

  test("título pela peça, sem emoji", () => {
    expect(tituloDaAprovacao([{ product_name: "Caneca Alça Coração" }])).toBe("A arte da sua caneca está pronta");
    expect(tituloDaAprovacao([{ product_name: "Copo Térmico" }])).toBe("A arte do seu copo está pronta");
    expect(tituloDaAprovacao([{ product_name: "Kit Presente" }])).toBe("A arte de Kit Presente está pronta");
    expect(tituloDaAprovacao([{ product_name: "Caneca" }, { product_name: "Copo" }])).toBe("A arte do seu pedido está pronta");
    expect(tituloDaAprovacao([])).toBe("A arte do seu pedido está pronta");
  });

  test("revisões restantes", () => {
    expect(revisoesRestantes({ inclusas: 2, usadas: 0, valor_extra: 10 })).toBe(2);
    expect(revisoesRestantes({ inclusas: 2, usadas: 3, valor_extra: 10 })).toBe(0);
    expect(revisoesRestantes({ inclusas: null, usadas: 1, valor_extra: 0 })).toBeNull();
    expect(textoDasRevisoes({ inclusas: 2, usadas: 0, valor_extra: 10 })).toBe("Você ainda tem 2 revisões inclusas neste pedido.");
    expect(textoDasRevisoes({ inclusas: 2, usadas: 1, valor_extra: 10 })).toBe("Você ainda tem 1 revisão inclusa neste pedido.");
    expect(textoDasRevisoes({ inclusas: 2, usadas: 2, valor_extra: 10 })).toMatch(/já foram usadas/);
    expect(textoDasRevisoes(undefined)).toBeNull();
  });

  test("o aviso ANTES de pedir o ajuste: incluso ou pago (mockup, Tela 2)", () => {
    expect(avisoDoAjuste({ inclusas: 2, usadas: 0, valor_extra: 10 })).toEqual({
      tipo: "inclusa", texto: "Ajuste incluso — você ainda vai ter 1 revisão grátis depois deste.",
    });
    expect(avisoDoAjuste({ inclusas: 3, usadas: 0, valor_extra: 10 })!.texto).toMatch(/2 revisões grátis/);
    expect(avisoDoAjuste({ inclusas: 2, usadas: 1, valor_extra: 10 })!.texto).toMatch(/última revisão grátis/);
    expect(avisoDoAjuste({ inclusas: 2, usadas: 2, valor_extra: 10 })).toEqual({
      tipo: "paga", texto: "Esta seria a 3ª revisão: R$ 10,00. A loja confirma com você antes de cobrar.",
    });
    expect(avisoDoAjuste({ inclusas: 2, usadas: 2, valor_extra: 0 })).toEqual({
      tipo: "paga", texto: "Esta seria a 3ª revisão. A loja confirma com você antes de cobrar.",
    });
    expect(avisoDoAjuste(undefined)).toBeNull();
  });

  // Achado A3 (26/09/2026): 0 = ilimitadas, como o painel diz. A Sheid e a
  // aura-qa estão em 0 e a cliente lia "Esta seria a 1ª revisão...".
  test("revisões ilimitadas: ajuste incluso, nunca fala em cobrança", () => {
    const ILIMITADO = { tipo: "inclusa", texto: "Ajuste incluso. Pode pedir quantos precisar." };
    // Backend novo: ilimitadas true, inclusas null, sem preço.
    const novo = { inclusas: null, usadas: 4, valor_extra: 0, ilimitadas: true };
    expect(revisoesIlimitadas(novo)).toBe(true);
    expect(avisoDoAjuste(novo)).toEqual(ILIMITADO);
    // Backend de antes: loja em 0 (com preço de extra salvo) ou nada configurado.
    expect(avisoDoAjuste({ inclusas: 0, usadas: 0, valor_extra: 10 })).toEqual(ILIMITADO);
    expect(avisoDoAjuste({ inclusas: null, usadas: 2, valor_extra: 0 })).toEqual(ILIMITADO);
    // Nada a contar na tela de aprovar.
    expect(revisoesRestantes(novo)).toBeNull();
    expect(textoDasRevisoes(novo)).toBeNull();
    expect(textoDasRevisoes({ inclusas: 0, usadas: 3, valor_extra: 10 })).toBeNull();
    // Sem travessão decorativo e sem "cobrar".
    expect(ILIMITADO.texto).not.toMatch(/—|cobr/);
    // Limite positivo continua limitado, mesmo se ilimitadas vier false.
    expect(revisoesIlimitadas({ inclusas: 2, usadas: 0, valor_extra: 10, ilimitadas: false })).toBe(false);
    expect(revisoesIlimitadas(undefined)).toBe(false);
  });

  test("mockup em vídeo (turntable do motor 3D)", () => {
    expect(isVideoUrl("https://r2/a.webm")).toBe(true);
    expect(isVideoUrl("https://r2/a.MP4?x=1")).toBe(true);
    expect(isVideoUrl("https://r2/a.png")).toBe(false);
    expect(isVideoUrl(null)).toBe(false);
  });
});

describe("acompanhar o pedido", () => {
  const ETAPAS = [
    { key: "recebido", label: "Pedido recebido" }, { key: "arte", label: "Criando a arte" },
    { key: "producao", label: "Em produção" }, { key: "pronto", label: "Pronto" },
  ];

  test("a próxima ação, uma por vez, na ordem que importa", () => {
    const base = { etapas: ETAPAS, etapa_atual: 1 };
    expect(acaoDoAcompanhamento({ ...base, aprovacao: { token: "t" }, saldo: { valor: 10, vencimento: "", pix: null } })).toBe("aprovar");
    expect(acaoDoAcompanhamento({ ...base, etapa_atual: 2, saldo: { valor: 64.85, vencimento: "2026-10-22", pix: "000201" } })).toBe("saldo");
    expect(acaoDoAcompanhamento({ ...base, etapa_atual: 3 })).toBe("pronto");
    expect(acaoDoAcompanhamento({ ...base, etapa_atual: 3, entregue: true })).toBe("entregue");
    expect(acaoDoAcompanhamento({ ...base })).toBe("andamento");
    expect(acaoDoAcompanhamento(null)).toBe("andamento");
  });

  test("a última etapa diz o que a cliente faz", () => {
    const r = (i: number, o: { retirada: boolean; entregue: boolean }) => rotuloDaEtapa(ETAPAS[i].label, i, 4, o);
    expect(r(3, { retirada: true, entregue: false })).toBe("Pronto para retirar");
    expect(r(3, { retirada: false, entregue: false })).toBe("Pronto");
    expect(r(3, { retirada: true, entregue: true })).toBe("Retirado");
    expect(r(3, { retirada: false, entregue: true })).toBe("Entregue");
    expect(r(1, { retirada: true, entregue: true })).toBe("Criando a arte");
  });

  test("subtítulo do topo", () => {
    expect(subtituloDoAcompanhamento("entregue")).toBe("Seu pedido foi entregue.");
    expect(subtituloDoAcompanhamento("aprovar")).toBe("Acompanhe sua encomenda por aqui.");
  });

  test("WhatsApp da loja já com o número do pedido; sem número, sem botão", () => {
    const link = linkDoWhatsAppDoPedido("(12) 99614-5447", "00123")!;
    expect(link.startsWith("https://wa.me/5512996145447?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("Olá! Queria falar sobre o meu pedido #00123.");
    expect(linkDoWhatsAppDoPedido(null, "00123")).toBeNull();
    expect(linkDoWhatsAppDoPedido("123", "00123")).toBeNull();
  });

  test("erro da API: 404/410 é 'não achamos', o resto é 'não carregou'", () => {
    expect(tipoDoErro(404)).toBe("nao_encontrado");
    expect(tipoDoErro(410)).toBe("nao_encontrado");
    expect(tipoDoErro(500)).toBe("rede");
    expect(tipoDoErro(null)).toBe("rede");
  });
});

// ── Pedir outro igual ───────────────────────────────────────────
const CANECA = {
  customization_config: {
    fields: [
      { id: "nome", type: "text", label: "Nome", required: true, config: {} },
      { id: "cor", type: "color", label: "Cor", required: false, config: { colors: ["#FFFFFF", "#D8436F"] } },
      { id: "alca", type: "color", label: "Alça", required: false, config: { colors: ["#000000"] } },
      { id: "foto", type: "image", label: "Foto", required: false, config: {} },
      { id: "arte", type: "option", label: "Arte", required: false, config: { is_art_service: true, choices: [] } },
    ],
    has_back: true,
    has_middle: false,
  },
} as any;

const RESPOSTA: RespostaDaRepeticao = {
  numero: "00123",
  itens: [
    { product_id: "p9", nome: "Copo", quantidade: 1, indisponivel: true, personalizacao: null },
    {
      product_id: "p1", nome: "Caneca Alça Coração", quantidade: 2, indisponivel: false,
      personalizacao: {
        valores: { nome: "Mãe", nome_cor: "#D8436F", cor: "#D8436F", foto: "https://r2/f.png", arte: "none", art_service_brief: "flores", sumiu: "x" },
        verso: true, meio: true,
      },
    },
  ],
};

describe("pedir outro igual", () => {
  test("o caminho da página do produto", () => {
    expect(caminhoDeRepetir("sheid-mania", "p1", "abc123")).toBe("/sheid-mania/p/p1?repetir=abc123");
  });

  test("o item do pedido para a peça aberta, e o primeiro ainda na loja", () => {
    expect(itemParaOProduto(RESPOSTA, "p1")!.nome).toBe("Caneca Alça Coração");
    expect(itemParaOProduto(RESPOSTA, "p9")).toBeNull();
    expect(itemParaOProduto(null, "p1")).toBeNull();
    expect(primeiroDisponivel(RESPOSTA)!.product_id).toBe("p1");
    expect(primeiroDisponivel({ numero: null, itens: [RESPOSTA.itens[0]] })).toBeNull();
  });

  test("estado inicial do configurador: o pedido por cima dos padrões da peça", () => {
    expect(valoresIniciaisDaRepeticao(itemParaOProduto(RESPOSTA, "p1"), CANECA)).toEqual({
      valores: {
        nome: "Mãe", nome_cor: "#D8436F", cor: "#D8436F",
        // a cor que o pedido não tinha fica no padrão da peça
        alca: "#000000",
        foto: "https://r2/f.png", arte: "none", art_service_brief: "flores",
      },
      quantidade: 2,
      verso: true,
      // a peça não oferece mais o meio
      meio: false,
    });
  });

  test("sem item, exatamente o configurador de sempre", () => {
    expect(valoresIniciaisDaRepeticao(null, CANECA)).toEqual({
      valores: { cor: "#FFFFFF", alca: "#000000" }, quantidade: 1, verso: false, meio: false,
    });
    expect(valoresIniciaisDaRepeticao(null, { customization_config: null } as any)).toEqual({
      valores: {}, quantidade: 1, verso: false, meio: false,
    });
  });

  test("a faixa da página do produto", () => {
    expect(textoDaFaixaDeRepeticao({ estado: "aplicada", numero: "00123" }))
      .toBe("Personalização do pedido #00123 carregada — confira e ajuste.");
    expect(textoDaFaixaDeRepeticao({ estado: "indisponivel", numero: "00123" })).toMatch(/não está mais na loja/);
    expect(textoDaFaixaDeRepeticao({ estado: "erro", numero: null })).toMatch(/^Não conseguimos carregar a personalização do pedido\./);
    expect(textoDaFaixaDeRepeticao({ estado: "carregando", numero: null })).toBeNull();
    expect(textoDaFaixaDeRepeticao(null)).toBeNull();
  });
});
