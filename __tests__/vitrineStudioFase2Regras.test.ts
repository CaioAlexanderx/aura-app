// ============================================================
// Fase 2 · Fechar a venda — as regras puras (25/09/2026)
//
// A chave vitrine_v2, o preço por linha (serviço de arte UMA vez), os
// nomes da personalização, o formulário das três etapas, os dados
// lembrados, o pedido guardado, a leitura do pedido por token, a
// cotação no servidor, o CEP e o lote.
// ============================================================
import { vitrineV2Ativa, v2DaConsulta, chaveDaAba } from "@/components/studio/storefront/chaveVitrineV2";
import {
  precoDaPeca, precoDaLinha, totalDaLinha, precoUnitarioDaLinha, subtotalDaSacola,
  descontoDoPix, pecasNaSacola, ehCampoDeArte, deltaDasOpcoes, deltaDaArte,
} from "@/components/studio/storefront/precoDaSacola";
import { nomeDaEscolha, linhasDaPeca, resumoDaLinha } from "@/components/studio/storefront/resumoDaPeca";
import {
  mensagemDoCarrinho, mensagemDoPedido, linhasDaPersonalizacao,
} from "@/components/studio/storefront/pedidoPeloWhatsApp";
import {
  maskCep, whatsappCompleto, emailValido, situacaoDoDocumento, maskDocumento, avisoDoDocumento,
  faltaNosDados, faltaNaEntrega, formasDePagamento, botaoDoPagamento, fraseDasRevisoes,
  modosDeEntrega, diasUteis,
} from "@/components/studio/storefront/formularioDoCheckout";
import {
  lerDadosLembrados, guardarDadosLembrados, esquecerDadosLembrados, saudacao, primeiroNome,
  chaveDosDados, VALIDADE_DOS_DADOS_MS,
} from "@/components/studio/storefront/dadosLembrados";
import {
  guardarPedidoPendente, lerPedidoPendente, esquecerPedidoPendente, guardarIdDoPedido, idDoPedido,
  aindaEsperaPagamento, lerRetornoDoCartao, PRAZO_DO_PIX_MS, chaveDoPedidoPendente,
} from "@/components/studio/storefront/pedidoGuardado";
import {
  lerPedidoPublico, situacaoDoPedido, deveConsultar, fraseDaValidade, numeroDoPedido,
  detalheDaEtapa, linkParaGuardar, estaPago, ETAPAS_PADRAO,
} from "@/components/studio/storefront/pedidoPorToken";
import { itensDoPedido, lerCotacao, assinaturaDaCotacao } from "@/components/studio/storefront/cotacaoDaSacola";
import { lerViaCep, buscarEnderecoPorCep, linhaDoBairro } from "@/components/studio/storefront/enderecoPorCep";
import {
  dataMinimaDoLote, dataDoLoteLegivel, codigoDoOrcamento, mensagemDoOrcamento,
} from "@/components/studio/storefront/loteDaVitrine";
import { caminhoDaTela, mesmaTela, telaPronta, resolverTela } from "@/components/studio/storefront/rotasDaVitrine";

/** Um storage de mentira, do jeito que o navegador expõe. */
function armazem(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    m,
  };
}
const quebrado = {
  getItem: () => { throw new Error("SecurityError"); },
  setItem: () => { throw new Error("SecurityError"); },
  removeItem: () => { throw new Error("SecurityError"); },
};

// ── O serviço de arte e a caneca do exemplo do contrato ──────────
const ARTE = {
  id: "art_service", type: "option", label: "Quem cria a arte",
  config: { is_art_service: true, choices: [
    { value: "none", label: "Vou enviar minha arte pronta", price_delta: 0 },
    { value: "adjust", label: "Envio minha arte e vocês ajustam", price_delta: 10 },
    { value: "designer", label: "Criem a arte pra mim", price_delta: 15 },
  ] },
};
const TAMANHO = {
  id: "tam", type: "option", label: "Tamanho",
  config: { choices: [{ value: "m", label: "M", price_delta: 0 }, { value: "gg", label: "GG", price_delta: 5 }] },
};
const caneca = (extra: any = {}) => ({
  id: "c1", name: "Caneca Branca", price: 39.9, description: null, image_url: null, stock_qty: 1,
  category: null, templates: [],
  qty_tiers: [{ min_qty: 10, max_qty: 49, unit_price: 35.91, discount_pct: 10 }],
  customization_config: {
    fields: [
      { id: "text", type: "text", label: "Arte", config: {} },
      { id: "image", type: "image", label: "Sua foto", config: {} },
      ARTE,
      { id: "art_service_brief", type: "text", label: "Briefing", config: { is_art_service: true } },
      TAMANHO,
    ],
    has_back: true, back_charge_enabled: true, back_price_delta: 8,
  },
  ...extra,
} as any);
const linha = (qty: number, values: any = {}, extra: any = {}) =>
  ({ lineId: "l" + qty, product: caneca(), qty, values, ...extra } as any);

describe("a chave vitrine_v2", () => {
  test("a loja ligada no servidor liga a vitrine nova", () => {
    expect(vitrineV2Ativa({ site: { vitrine_v2: true } }, { slug: "s", search: "", storage: armazem() })).toBe(true);
    expect(vitrineV2Ativa({ site: { vitrine_v2: false } }, { slug: "s", search: "", storage: armazem() })).toBe(false);
    expect(vitrineV2Ativa({ site: {} }, { slug: "s", storage: armazem() })).toBe(false);
    expect(vitrineV2Ativa(null, { slug: "s" })).toBe(false);
  });

  test("?v2=1 liga na aba e sobrevive à troca de tela (a URL perde o parâmetro)", () => {
    const aba = armazem();
    expect(vitrineV2Ativa({ site: {} }, { slug: "Sheid", search: "?v2=1", storage: aba })).toBe(true);
    expect(aba.m.get(chaveDaAba("sheid"))).toBe("1");
    expect(vitrineV2Ativa({ site: {} }, { slug: "sheid", search: "", storage: aba })).toBe(true);
    // outra loja, mesma aba: não liga
    expect(vitrineV2Ativa({ site: {} }, { slug: "outra", search: "", storage: aba })).toBe(false);
  });

  test("?v2=0 desliga na aba, mesmo com a loja ligada (comparar com o de hoje)", () => {
    const aba = armazem();
    expect(vitrineV2Ativa({ site: { vitrine_v2: true } }, { slug: "s", search: "?x=1&v2=0", storage: aba })).toBe(false);
    expect(vitrineV2Ativa({ site: { vitrine_v2: true } }, { slug: "s", search: "", storage: aba })).toBe(false);
  });

  test("storage que recusa não quebra: vale a URL e a loja", () => {
    expect(vitrineV2Ativa({ site: { vitrine_v2: true } }, { slug: "s", search: "", storage: quebrado as any })).toBe(true);
    expect(vitrineV2Ativa({ site: {} }, { slug: "s", search: "?v2=1", storage: quebrado as any })).toBe(true);
  });

  test("v2DaConsulta entende as grafias e ignora o resto", () => {
    expect(v2DaConsulta("?v2=1")).toBe("1");
    expect(v2DaConsulta("v2=true")).toBe("1");
    expect(v2DaConsulta("?a=b&v2=0")).toBe("0");
    expect(v2DaConsulta("?v2=talvez")).toBeNull();
    expect(v2DaConsulta("")).toBeNull();
  });
});

describe("o preço da linha: serviço de arte UMA vez por linha", () => {
  test("o exemplo do contrato: caneca R$ 39,90, ajuste R$ 10, 2 unidades = R$ 89,80", () => {
    const p = precoDaLinha(linha(2, { art_service: "adjust" }));
    expect(p.unitario).toBeCloseTo(39.9, 2);
    expect(p.arte).toBe(10);
    expect(p.total).toBeCloseTo(89.8, 2); // antes: (39,90 + 10) × 2 = 99,80
    expect(totalDaLinha(linha(2, { art_service: "adjust" }))).toBeCloseTo(89.8, 2);
    expect(precoUnitarioDaLinha(linha(2, { art_service: "adjust" }))).toBeCloseTo(39.9, 2);
  });

  test("com a faixa de quantidade, a arte continua uma vez", () => {
    const p = precoDaLinha(linha(10, { art_service: "designer" }));
    expect(p.base).toBeCloseTo(35.91, 2);
    expect(p.total).toBeCloseTo(35.91 * 10 + 15, 2);
    expect(p.faixa).toEqual({ min_qty: 10, pct: 10 });
  });

  test("opções e verso continuam por unidade; o campo de arte fica fora das opções", () => {
    const l = linha(3, { art_service: "adjust", tam: "gg" }, { hasBackSelected: true });
    const p = precoDaLinha(l);
    expect(p.opcoes).toBe(5);
    expect(p.verso).toBe(8);
    expect(p.unitario).toBeCloseTo(39.9 + 5 + 8, 2);
    expect(p.total).toBeCloseTo((39.9 + 5 + 8) * 3 + 10, 2);
    expect(deltaDasOpcoes(l.product.customization_config, l.values)).toBe(5);
    expect(deltaDaArte(l.product.customization_config, l.values)).toBe(10);
  });

  test("o campo de arte é o de opção com a marca ou o id canônico; o briefing (texto) não", () => {
    expect(ehCampoDeArte(ARTE)).toBe(true);
    expect(ehCampoDeArte({ id: "art_service", type: "option", config: {} })).toBe(true);
    expect(ehCampoDeArte({ id: "outro", type: "option", config: { is_art_service: true } })).toBe(true);
    expect(ehCampoDeArte({ id: "art_service_brief", type: "text", config: { is_art_service: true } })).toBe(false);
    expect(ehCampoDeArte(TAMANHO)).toBe(false);
  });

  test("arte pronta não cobra nada", () => {
    expect(precoDaLinha(linha(2, { art_service: "none" })).total).toBeCloseTo(79.8, 2);
  });

  test("a peça no configurador usa a mesma conta", () => {
    const p = precoDaPeca({ produto: caneca(), quantidade: 2, values: { art_service: "adjust" } });
    expect(p.total).toBeCloseTo(89.8, 2);
  });

  test("subtotal, peças e desconto do Pix (mesma conta do servidor)", () => {
    const sacola = [linha(2, { art_service: "adjust" }), linha(1, {})];
    expect(subtotalDaSacola(sacola)).toBeCloseTo(89.8 + 39.9, 2);
    expect(pecasNaSacola(sacola)).toBe(3);
    expect(descontoDoPix(217.69, 5)).toBe(10.88);
    expect(descontoDoPix(100, 0)).toBe(0);
    expect(descontoDoPix(100, null)).toBe(0);
  });
});

describe("a personalização com os nomes que a cliente viu", () => {
  test("a escolha vira o rótulo, não o valor ('designer', 'm')", () => {
    expect(nomeDaEscolha(ARTE, "designer")).toBe("Criem a arte pra mim");
    expect(nomeDaEscolha(TAMANHO, "m")).toBe("M");
    expect(nomeDaEscolha(TAMANHO, "xg")).toBe("xg");
    expect(nomeDaEscolha(TAMANHO, "")).toBeNull();
  });

  test("linhasDaPeca: arte, briefing, cor da arte e arquivo", () => {
    const l = linhasDaPeca(caneca(), {
      text: "Mãe", text_cor: "#d62828", image: "https://r2/arte.png",
      art_service: "adjust", art_service_brief: "tirar o fundo", tam: "m",
    });
    expect(l).toEqual([
      { rotulo: "Arte", valor: "Mãe", tipo: "texto" },
      { rotulo: "Cor da arte", valor: "#D62828", tipo: "cor" },
      { rotulo: "Sua foto", valor: "https://r2/arte.png", tipo: "arquivo" },
      { rotulo: "Quem cria a arte", valor: "Envio minha arte e vocês ajustam", tipo: "arte" },
      { rotulo: "Briefing da arte", valor: "tirar o fundo", tipo: "briefing" },
      { rotulo: "Tamanho", valor: "M", tipo: "escolha" },
    ]);
  });

  test("arte pronta não vira linha; briefing sem campo no config ainda chega", () => {
    const p = { customization_config: { fields: [ARTE] } } as any;
    expect(linhasDaPeca(p, { art_service: "none", art_service_brief: "azul" })).toEqual([
      { rotulo: "Briefing da arte", valor: "azul", tipo: "briefing" },
    ]);
  });

  test("o resumo curto: verso só quando escolhido E preenchido; sem hex nem endereço", () => {
    const cfg = {
      fields: [
        { id: "text", type: "text", label: "Arte", config: {} },
        { id: "text_back", type: "text", label: "Verso", side: "back", config: {} },
        { id: "cor", type: "color", label: "Cor", config: {} },
        ARTE,
      ],
      has_back: true, back_charge_enabled: false,
    };
    const produto = { name: "Caneca", customization_config: cfg } as any;
    const semVerso = resumoDaLinha({ product: produto, values: { text: "Mãe", cor: "#000000", art_service: "adjust" } } as any);
    expect(semVerso).toEqual(["Arte: Mãe", "Envio minha arte e vocês ajustam"]);
    const comVerso = resumoDaLinha({ product: produto, values: { text: "Mãe", text_back: "Te amo" } } as any);
    expect(comVerso[0]).toBe("Frente e verso");
  });
});

describe("a mensagem do WhatsApp diz o que a tela disse", () => {
  const l2 = linha(2, {
    text: "Mãe", text_cor: "#d62828", art_service: "adjust", art_service_brief: "tirar o fundo", tam: "m",
  });

  test("nomes das opções, briefing, cor da arte — nada de 'adjust' ou 'm' cru", () => {
    const m = mensagemDoCarrinho({ linhas: [l2], nomeDaLoja: "Sheid Mania" });
    expect(m).toContain("Quem cria a arte: Envio minha arte e vocês ajustam");
    expect(m).toContain("Briefing da arte: tirar o fundo");
    expect(m).toContain("Cor da arte: #D62828");
    expect(m).toContain("Tamanho: M");
    expect(m).not.toMatch(/: adjust\b/);
    expect(m).not.toMatch(/Tamanho: m\b/);
  });

  test("o preço com a arte uma vez e a faixa", () => {
    expect(mensagemDoCarrinho({ linhas: [l2] })).toContain("2 × R$ 39,90 + R$ 10,00 do serviço de arte = R$ 89,80");
    const m10 = mensagemDoCarrinho({ linhas: [linha(10, { art_service: "designer" })] });
    expect(m10).toContain("10 × R$ 35,91 + R$ 15,00 do serviço de arte = R$ 374,10 (faixa de 10 un: -10%)");
    expect(m10).toContain("Total estimado: R$ 374,10 (sem frete)");
  });

  test("o pedido de uma peça leva a arte uma vez", () => {
    const m = mensagemDoPedido({ produto: caneca(), valores: { art_service: "adjust" }, quantidade: 2, precoUnitario: 39.9, arte: 10 });
    expect(m).toContain("2 × R$ 39,90 + R$ 10,00 do serviço de arte = R$ 89,80");
    expect(mensagemDoPedido({ produto: caneca(), quantidade: 1, precoUnitario: 39.9, arte: 15 }))
      .toContain("R$ 39,90 + R$ 15,00 do serviço de arte = R$ 54,90");
  });

  test("linhasDaPersonalizacao continua no formato de antes", () => {
    expect(linhasDaPersonalizacao(caneca(), { tam: "gg" })).toEqual([{ rotulo: "Tamanho", valor: "GG" }]);
  });
});

describe("o formulário do checkout em etapas", () => {
  test("máscaras", () => {
    expect(maskCep("12242000")).toBe("12242-000");
    expect(maskCep("12242-0001")).toBe("12242-000");
    expect(maskCep("122")).toBe("122");
    expect(maskDocumento("52998224725")).toBe("529.982.247-25");
    expect(maskDocumento("11222333000181")).toBe("11.222.333/0001-81");
  });

  test("WhatsApp com DDD e e-mail opcional (a regra da Negócio)", () => {
    expect(whatsappCompleto("(12) 99183-4410")).toBe(true);
    expect(whatsappCompleto("(12) 3322-1100")).toBe(true);
    expect(whatsappCompleto("99183-4410")).toBe(false);
    expect(emailValido("")).toBe(true);
    expect(emailValido("helena@gmail.com")).toBe(true);
    expect(emailValido("helena@gmail")).toBe(false);
    expect(emailValido("helena@.com")).toBe(false);
    expect(emailValido("a@b@c.com")).toBe(false);
  });

  test("CPF/CNPJ com dígito verificador", () => {
    expect(situacaoDoDocumento("")).toBe("vazio");
    expect(situacaoDoDocumento("529.982")).toBe("incompleto");
    expect(situacaoDoDocumento("52998224725")).toBe("cpf");
    expect(situacaoDoDocumento("52998224724")).toBe("invalido");
    expect(situacaoDoDocumento("11111111111")).toBe("invalido");
    expect(situacaoDoDocumento("11.222.333/0001-81")).toBe("cnpj");
    expect(situacaoDoDocumento("11.222.333/0001-80")).toBe("invalido");
    expect(avisoDoDocumento("52998224725")).toEqual({ texto: "CPF válido", ok: true });
    expect(avisoDoDocumento("52998224724")?.ok).toBe(false);
    expect(avisoDoDocumento("529")).toBeNull();
  });

  test("etapa 1: o botão diz o que falta, na ordem da tela", () => {
    const base = { nome: "", whatsapp: "", email: "", querDocumento: false, documento: "" };
    expect(faltaNosDados(base)).toEqual({ texto: "Falta seu nome", campo: "nome" });
    expect(faltaNosDados({ ...base, nome: "Helena" })).toEqual({ texto: "Falta seu WhatsApp", campo: "whatsapp" });
    expect(faltaNosDados({ ...base, nome: "Helena", whatsapp: "9918" })?.campo).toBe("whatsapp");
    const ok = { ...base, nome: "Helena", whatsapp: "(12) 99183-4410" };
    expect(faltaNosDados(ok)).toBeNull();
    expect(faltaNosDados({ ...ok, email: "x@" })?.campo).toBe("email");
    expect(faltaNosDados({ ...ok, querDocumento: true })).toEqual({ texto: "Falta o CPF ou CNPJ", campo: "documento" });
    expect(faltaNosDados({ ...ok, querDocumento: true, documento: "52998224724" })?.texto).toBe("Confira o CPF ou CNPJ");
    expect(faltaNosDados({ ...ok, querDocumento: true, documento: "52998224725" })).toBeNull();
  });

  test("etapa 2: entrega pede o endereço; retirada por app aceita 'informo depois'", () => {
    const base = {
      tipo: null as any, cep: "", rua: "", numero: "", bairro: "", cidade: "", uf: "",
      foraDaArea: false, cotando: false, buscandoCep: false, courierNome: "", courierPlaca: "", informarDepois: false,
    };
    expect(faltaNaEntrega(base)?.texto).toBe("Escolha como receber");
    expect(faltaNaEntrega({ ...base, tipo: "pickup" })).toBeNull();
    const casa = { ...base, tipo: "delivery" as const, cep: "12242-000", rua: "Av. São João", bairro: "Jd", cidade: "SJC", uf: "SP" };
    expect(faltaNaEntrega(casa)).toEqual({ texto: "Falta o número da casa", campo: "numero" });
    expect(faltaNaEntrega({ ...casa, numero: "553" })).toBeNull();
    expect(faltaNaEntrega({ ...casa, numero: "553", foraDaArea: true })?.texto).toBe("Esse CEP está fora da área");
    expect(faltaNaEntrega({ ...casa, numero: "553", cotando: true })?.texto).toBe("Calculando o frete…");
    const app = { ...base, tipo: "courier" as const };
    expect(faltaNaEntrega(app)?.campo).toBe("courierNome");
    expect(faltaNaEntrega({ ...app, courierNome: "Rogério", courierPlaca: "FXT-4" })?.texto).toBe("Confira a placa do veículo");
    expect(faltaNaEntrega({ ...app, courierNome: "Rogério", courierPlaca: "FXT-4A12" })).toBeNull();
    expect(faltaNaEntrega({ ...app, informarDepois: true })).toBeNull();
  });

  test("modos de entrega do config (e o par de sempre sem o bloco)", () => {
    expect(modosDeEntrega(null).map((m) => m.tipo)).toEqual(["pickup", "delivery"]);
    expect(modosDeEntrega({ pickup_enabled: true, delivery_enabled: false, courier_pickup_enabled: true }).map((m) => m.tipo))
      .toEqual(["pickup", "courier"]);
  });

  test("etapa 3: formas de pagar, e 'na retirada' some na retirada por app", () => {
    const p = { has_pix: true, has_card: true, pay_on_delivery_enabled: true };
    expect(formasDePagamento(p, "pickup").map((f) => f.titulo)).toEqual(["Pix", "Cartão de crédito", "Pagar na retirada"]);
    expect(formasDePagamento(p, "delivery").map((f) => f.titulo)).toContain("Pagar na entrega");
    expect(formasDePagamento(p, "courier").map((f) => f.forma)).toEqual(["pix", "card"]);
    expect(botaoDoPagamento(null, "R$ 1,00")).toBe("Escolha como pagar");
    expect(botaoDoPagamento("pix", "R$ 206,81")).toBe("Pagar R$ 206,81 no Pix");
    expect(botaoDoPagamento("card", "R$ 217,69")).toBe("Pagar R$ 217,69 no cartão");
    expect(botaoDoPagamento("on_delivery", "R$ 217,69")).toBe("Fazer pedido · R$ 217,69");
  });

  test("a política de revisões em uma linha", () => {
    expect(fraseDasRevisoes({ max_included: 2 })).toBe("Você aprova o mockup antes de produzir. 2 revisões inclusas.");
    expect(fraseDasRevisoes({ max_included: 1 })).toContain("1 revisão inclusa");
    expect(fraseDasRevisoes({ max_included: 0 })).toBe("Você aprova o mockup antes de produzir.");
    expect(diasUteis(1)).toBe("1 dia útil");
    expect(diasUteis(3)).toBe("3 dias úteis");
  });
});

describe("os dados lembrados (90 dias, a chave da Negócio)", () => {
  const dados = {
    name: "Helena Martins", phone: "(12) 99183-4410", email: "", customer_cpf_cnpj: "", request_nfce: false,
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
  };

  test("guarda depois do pedido e lê na volta", () => {
    const s = armazem();
    guardarDadosLembrados("Sheid-Mania", dados, s, 1000);
    expect(s.m.has(chaveDosDados("sheid-mania"))).toBe(true);
    expect(chaveDosDados("sheid-mania")).toBe("aura_customer_sheid-mania");
    expect(lerDadosLembrados("sheid-mania", s, 2000)?.name).toBe("Helena Martins");
  });

  test("vencido depois de 90 dias some, e a chave é apagada", () => {
    const s = armazem();
    guardarDadosLembrados("x", dados, s, 0);
    expect(lerDadosLembrados("x", s, VALIDADE_DOS_DADOS_MS + 1)).toBeNull();
    expect(s.m.size).toBe(0);
  });

  test("'Não sou eu' apaga; dado corrompido ou sem nome não saúda ninguém", () => {
    const s = armazem();
    guardarDadosLembrados("x", dados, s);
    esquecerDadosLembrados("x", s);
    expect(lerDadosLembrados("x", s)).toBeNull();
    expect(lerDadosLembrados("x", armazem({ aura_customer_x: "{quebrado" }))).toBeNull();
    expect(lerDadosLembrados("x", armazem({ aura_customer_x: JSON.stringify({ ts: Date.now(), name: " " }) }))).toBeNull();
    expect(lerDadosLembrados("x", quebrado as any)).toBeNull();
    expect(() => guardarDadosLembrados("x", dados, quebrado as any)).not.toThrow();
  });

  test("a saudação é neutra", () => {
    expect(saudacao("Helena Martins")).toBe("Que bom te ver de novo, Helena");
    expect(saudacao("")).toBe("Que bom te ver de novo");
    expect(saudacao("Helena")).not.toMatch(/Bem-vind/);
    expect(primeiroNome("  Ana  Paula ")).toBe("Ana");
  });
});

describe("o pedido guardado no navegador", () => {
  const p = {
    id: "o1", token: "tok", order_number: "123", payment_method: "pix", total: 206.81, pecas: 4,
    imagens: ["a", "b"], card_init_point: null,
  };

  test("pedido em andamento: guarda, lê e vence em 72 h", () => {
    const s = armazem();
    guardarPedidoPendente("loja", p, s, 1000);
    expect(s.m.has(chaveDoPedidoPendente("loja"))).toBe(true);
    expect(chaveDoPedidoPendente("loja")).toBe("aura_pending_order_loja");
    expect(lerPedidoPendente("loja", s, 2000)).toMatchObject({ id: "o1", token: "tok", pecas: 4, ts: 1000 });
    expect(lerPedidoPendente("loja", s, 1000 + PRAZO_DO_PIX_MS + 1)).toBeNull();
    expect(s.m.size).toBe(0);
  });

  test("sem id não conta; esquecer apaga; storage quebrado não lança", () => {
    const s = armazem({ aura_pending_order_x: JSON.stringify({ ts: Date.now() }) });
    expect(lerPedidoPendente("x", s)).toBeNull();
    const t = armazem();
    guardarPedidoPendente("x", p, t);
    esquecerPedidoPendente("x", t);
    expect(lerPedidoPendente("x", t)).toBeNull();
    expect(lerPedidoPendente("x", quebrado as any)).toBeNull();
  });

  test("o id do pedido por token, na aba (nunca na URL)", () => {
    const aba = armazem();
    guardarIdDoPedido("tok", "o1", aba);
    expect(idDoPedido("tok", aba)).toBe("o1");
    expect(idDoPedido("outro", aba)).toBeNull();
    expect(idDoPedido("tok", quebrado as any)).toBeNull();
  });

  test("a Tela 8 só aparece com o pedido ainda esperando pagamento", () => {
    expect(aindaEsperaPagamento({ status: "pending_payment", payment_status: "pending" })).toBe(true);
    expect(aindaEsperaPagamento({ status: "awaiting_approval" })).toBe(true);
    expect(aindaEsperaPagamento({ status: "confirmed", payment_status: "paid" })).toBe(false);
    expect(aindaEsperaPagamento({ status: "pending_payment", payment_status: "paid" })).toBe(false);
    expect(aindaEsperaPagamento({ status: "cancelled" })).toBe(false);
    expect(aindaEsperaPagamento(null)).toBe(false);
  });

  test("a volta do cartão (?order_id=&payment=, o contrato da Negócio)", () => {
    expect(lerRetornoDoCartao("?order_id=o1&payment=approved")).toEqual({ orderId: "o1", resultado: "approved" });
    expect(lerRetornoDoCartao("?order_id=o1&payment=failed")?.resultado).toBe("failed");
    expect(lerRetornoDoCartao("?order_id=o1&payment=pending")?.resultado).toBe("pending");
    expect(lerRetornoDoCartao("?order_id=o1&payment=in_process")?.resultado).toBe("pending");
    expect(lerRetornoDoCartao("?payment=approved")).toBeNull();
    expect(lerRetornoDoCartao("")).toBeNull();
  });
});

describe("o pedido lido pelo token", () => {
  const base = {
    numero: "123", criado_em: "2026-09-25T17:03:00Z", cliente_primeiro_nome: "Helena",
    status: "pending_payment", payment_status: "pending", payment_method: "pix",
    subtotal: 217.69, desconto_pix: 10.88, frete: 0, total: 206.81,
    entrega: { tipo: "pickup", prazo_texto: null, retirada_endereco: "Av. Dom Pedro I", bairro_cidade: null, courier_a_informar: false },
    itens: [{ nome: "Caneca", quantidade: 1, preco_unitario: 57.9, total: 57.9, imagem_url: null, resumo: ["Frente e verso"] }],
    pix: { qrcode: null, copia_e_cola: "000201", expira_em: "2026-09-28T17:03:00Z", modo: "manual" },
    cartao: null, comprovante_enviado: false,
    etapas: [{ chave: "recebido", rotulo: "Pedido recebido", estado: "atual" }],
    prazo_dias_uteis: 3, revisoes: { max_included: 2, extra_price: 10, policy_text: null },
    acompanhar_url: "https://x/acompanhar/t", loja: { nome: "Sheid Mania", whatsapp: "5512996145447" },
  };

  test("a leitura garante tudo que a tela usa", () => {
    const p = lerPedidoPublico({ numero: 7 })!;
    expect(p.numero).toBe("7");
    expect(p.itens).toEqual([]);
    expect(p.etapas).toEqual(ETAPAS_PADRAO);
    expect(p.entrega.tipo).toBe("pickup");
    expect(p.pix).toBeNull();
    expect(lerPedidoPublico({ error: "Pedido nao encontrado" })).toBeNull();
    expect(lerPedidoPublico(null)).toBeNull();
    expect(lerPedidoPublico({ pix: { copia_e_cola: "" } })!.pix).toBeNull();
  });

  test("qual tela o pedido pede", () => {
    const p = lerPedidoPublico(base)!;
    expect(situacaoDoPedido(p)).toBe("pix");
    expect(situacaoDoPedido({ ...p, status: "awaiting_approval", pix: null })).toBe("aguardando");
    expect(situacaoDoPedido({ ...p, status: "confirmed", payment_status: "paid", pix: null })).toBe("confirmado");
    expect(situacaoDoPedido({ ...p, status: "cancelled" })).toBe("cancelado");
    expect(situacaoDoPedido({ ...p, payment_status: "expired" })).toBe("cancelado");
    expect(situacaoDoPedido({ ...p, payment_method: "on_delivery", status: "confirmed", pix: null })).toBe("confirmado");
    const cartao = { ...p, payment_method: "card", pix: null };
    expect(situacaoDoPedido(cartao)).toBe("cartao_pendente");
    expect(situacaoDoPedido(cartao, "approved")).toBe("cartao_analise");
    expect(situacaoDoPedido(cartao, "pending")).toBe("cartao_analise");
    expect(situacaoDoPedido(cartao, "failed")).toBe("cartao_recusado");
    expect(situacaoDoPedido({ ...cartao, status: "confirmed", payment_status: "paid" }, "approved")).toBe("confirmado");
    expect(estaPago({ status: "in_production", payment_status: null })).toBe(true);
  });

  test("consulta a cada 4 s só enquanto espera pagamento", () => {
    expect(deveConsultar("pix")).toBe(true);
    expect(deveConsultar("aguardando")).toBe(true);
    expect(deveConsultar("cartao_analise")).toBe(true);
    expect(deveConsultar("confirmado")).toBe(false);
    expect(deveConsultar("cancelado")).toBe(false);
    expect(deveConsultar("cartao_recusado")).toBe(false);
  });

  test("textos: validade de 72 h, número, etapas sem horário, link para guardar", () => {
    expect(fraseDaValidade("2026-09-28T17:32:00Z")).toBe("O código vale por 72 horas, até 28/09 às 14:32. Depois disso o pedido cancela sozinho.");
    expect(fraseDaValidade(null)).toBe("O código vale por 72 horas. Depois disso o pedido cancela sozinho.");
    expect(numeroDoPedido("123")).toBe("#00123");
    expect(numeroDoPedido("L-9")).toBe("#L-9");
    expect(numeroDoPedido(null)).toBe("");
    const ctx = { loja: "Sheid Mania", forma: "pix", tipo: "pickup", prazo: 3, pago: true };
    expect(detalheDaEtapa("recebido", ctx)).toBe("Hoje, pago no Pix");
    expect(detalheDaEtapa("recebido", { ...ctx, pago: false })).toBe("Hoje, esperando o Pix");
    expect(detalheDaEtapa("arte", ctx)).toBe("Sheid Mania prepara o mockup e manda para você aprovar");
    expect(detalheDaEtapa("pronto", ctx)).toBe("Para retirar na loja, 3 dias úteis após a aprovação");
    expect(detalheDaEtapa("pronto", { ...ctx, tipo: "delivery", prazo: 1 })).toBe("Sai para entrega, 1 dia útil após a aprovação");
    const l = decodeURIComponent(linkParaGuardar("https://loja.getaura.com.br/sheid-mania/pedido/k7", "Sheid Mania"));
    expect(l).toBe("https://wa.me/?text=Meu pedido na Sheid Mania: https://loja.getaura.com.br/sheid-mania/pedido/k7");
  });
});

describe("a cotação no servidor", () => {
  test("os itens são os do pedido: lado inativo sai sem os campos", () => {
    const cfg = {
      fields: [
        { id: "text", type: "text", label: "Frente", config: {} },
        { id: "text_back", type: "text", label: "Verso", side: "back", config: {} },
      ],
      has_back: true, back_charge_enabled: true, back_price_delta: 8,
    };
    const l = { lineId: "1", qty: 2, product: { id: "p", price: 10, customization_config: cfg }, values: { text: "A", text_back: "B" }, hasBackSelected: false } as any;
    const [it] = itensDoPedido([l]);
    expect(it).toEqual({ product_id: "p", quantity: 2, customization: { text: "A", has_back_selected: false, has_middle_selected: false } });
    const [com] = itensDoPedido([{ ...l, hasBackSelected: true }]);
    expect(com.customization).toMatchObject({ text_back: "B", has_back_selected: true });
  });

  test("a resposta é validada; estranha vira null (fica a estimativa)", () => {
    const j = {
      itens: [{ indice: 0, preco_unitario: 39.9, total: 89.8, detalhe: { base: 39.9, opcoes: 0, verso: 0, meio: 0, arte: 10, faixa: null } }],
      subtotal: 89.8, desconto_pix: 4.49, total: 89.8, total_pix: 85.31, prazo_dias_uteis: 3,
    };
    const c = lerCotacao(j, 1)!;
    expect(c.subtotal).toBe(89.8);
    expect(c.itens[0].detalhe?.arte).toBe(10);
    expect(c.total_pix).toBe(85.31);
    expect(lerCotacao(j, 2)).toBeNull();
    expect(lerCotacao({ error: "x" }, 1)).toBeNull();
    expect(lerCotacao({ ...j, subtotal: "abc" }, 1)).toBeNull();
    expect(lerCotacao({ ...j, total_pix: undefined }, 1)!.total_pix).toBeCloseTo(85.31, 2);
  });

  test("a assinatura muda quando a sacola muda", () => {
    const a = assinaturaDaCotacao([linha(1)]);
    expect(assinaturaDaCotacao([linha(1)])).toBe(a);
    expect(assinaturaDaCotacao([linha(2)])).not.toBe(a);
  });
});

describe("o CEP primeiro", () => {
  test("ViaCEP: lê o endereço; 'erro' e resposta sem cidade viram null", () => {
    expect(lerViaCep({ logradouro: "Av. São João", bairro: "Jd. Esplanada", localidade: "São José dos Campos", uf: "sp" }, "12242000"))
      .toEqual({ cep: "12242000", rua: "Av. São João", bairro: "Jd. Esplanada", cidade: "São José dos Campos", uf: "SP" });
    expect(lerViaCep({ erro: true }, "0")).toBeNull();
    expect(lerViaCep({ erro: "true" }, "0")).toBeNull();
    expect(lerViaCep({ logradouro: "x" }, "0")).toBeNull();
    expect(linhaDoBairro({ bairro: "Jardim Esplanada", cidade: "São José dos Campos", uf: "SP" }))
      .toBe("Jardim Esplanada · São José dos Campos/SP");
    expect(linhaDoBairro({ bairro: "", cidade: "Taubaté", uf: "SP" })).toBe("Taubaté/SP");
  });

  test("buscar só com 8 dígitos, no endereço do ViaCEP", async () => {
    const fake = jest.fn(async () => ({ ok: true, json: async () => ({ localidade: "Taubaté", uf: "SP", logradouro: "", bairro: "" }) }));
    expect(await buscarEnderecoPorCep("122", fake as any)).toBeNull();
    expect(fake).not.toHaveBeenCalled();
    const e = await buscarEnderecoPorCep("12020-000", fake as any);
    expect(fake).toHaveBeenCalledWith("https://viacep.com.br/ws/12020000/json/");
    expect(e?.cidade).toBe("Taubaté");
  });
});

describe("o orçamento em lote (Tela 9)", () => {
  test("a data mínima conta dias úteis a partir do prazo da faixa", () => {
    // sexta, 25/09/2026
    const sexta = new Date(2026, 8, 25);
    expect(dataMinimaDoLote(1, sexta)).toBe("2026-09-28"); // segunda
    expect(dataMinimaDoLote(5, sexta)).toBe("2026-10-02");
    expect(dataMinimaDoLote(null, sexta)).toBe("2026-09-26"); // sem prazo: amanhã
    expect(dataDoLoteLegivel("2026-10-12")).toBe("12/10/2026");
    expect(dataDoLoteLegivel("")).toBe("");
  });

  test("o código vem do servidor; sem ele, nada de número inventado", () => {
    expect(codigoDoOrcamento({ codigo: "L-3F9A2C" })).toBe("L-3F9A2C");
    expect(codigoDoOrcamento({ codigo: 42 })).toBe("42");
    expect(codigoDoOrcamento({ event: { event_name: "Formatura" } })).toBeNull();
    expect(codigoDoOrcamento(null)).toBeNull();
  });

  test("a mensagem para a loja leva o número", () => {
    const m = mensagemDoOrcamento({ codigo: "L-3F9A2C", evento: "Formatura", pecas: 50, produto: "Caneca Branca", total: 1696, nomeDaLoja: "Sheid Mania" });
    expect(m).toContain("orçamento #L-3F9A2C");
    expect(m).toContain("50 peças · Caneca Branca");
    expect(m).toContain("R$ 1.696,00");
    expect(mensagemDoOrcamento({ codigo: null, evento: "X", pecas: 1 })).not.toContain("#");
  });
});

describe("a rota do pedido", () => {
  test("/<slug>/pedido/<token> e a igualdade por token", () => {
    expect(caminhoDaTela("sheid-mania", { tipo: "pedido", token: "k7Qm2x9T" })).toBe("/sheid-mania/pedido/k7Qm2x9T");
    expect(mesmaTela({ tipo: "pedido", token: "a" }, { tipo: "pedido", token: "a" })).toBe(true);
    expect(mesmaTela({ tipo: "pedido", token: "a" }, { tipo: "pedido", token: "b" })).toBe(false);
    expect(telaPronta({ tipo: "pedido", token: "a" }, { stage: "list" })).toBe(true);
    expect(resolverTela({ tipo: "pedido", token: "a" }, null, [])).toEqual({ acao: "pedido", token: "a" });
  });
});
