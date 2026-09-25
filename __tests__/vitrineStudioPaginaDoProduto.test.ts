// ============================================================
// Vitrine Studio · Fase 3 — as regras da página do produto nova
//
// A régua da escada e a frase "Faltam N", o prazo
// por faixa, o que falta na peça (com a MESMA resposta do validador do
// commit), o aviso de foto pequena, a área de impressão e os nomes que a
// página escreve. Mockup: docs/mockups/studio-vitrine-03-produto.html.
// ============================================================
import {
  QTD_MAXIMA, quantidadeValida, quantidadeDigitada,
  reguaDaEscada, progressoNaRegua, fraseDaEscada, economiaNaFaixa,
  prazoDaQuantidade, linhasDePrazo, textoDeDias,
  faltaNaPeca, ladosDaPeca, camposDoLado, origensDoLado, ladoPreenchido,
  LIMIAR_DE_RESOLUCAO, limiarDaPeca, avisoDeResolucao, medivel, pixelsParaCm, medidasDoArquivo,
  textoDoAvisoDeResolucao, nomeDaPeca, suaPeca, sobreEstaPeca, nomeCurto, enderecoDeRetirada,
  notaDeRevisao, adicionaisDaPeca, precoPodeMudar, areaDeImpressao, textoDaArea,
} from "@/components/studio/storefront/produto/regrasDaPagina";
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";

describe("quantidade digitável", () => {
  test("de 1 a 999; lixo e vazio viram 1", () => {
    expect(quantidadeValida(50)).toBe(50);
    expect(quantidadeValida("17")).toBe(17);
    expect(quantidadeValida(0)).toBe(1);
    expect(quantidadeValida(-3)).toBe(1);
    expect(quantidadeValida("")).toBe(1);
    expect(quantidadeValida("abc")).toBe(1);
    expect(quantidadeValida(2.7)).toBe(2);
    expect(quantidadeValida(5000)).toBe(QTD_MAXIMA);
  });
  test("o campo aceita só dígitos, sem zero à esquerda, até três", () => {
    expect(quantidadeDigitada("5a0")).toBe("50");
    expect(quantidadeDigitada("007")).toBe("7");
    expect(quantidadeDigitada("12345")).toBe("123");
    expect(quantidadeDigitada("")).toBe("");
  });
});

// A escada do mockup: 10/20/50 un com −5/−10/−15% sobre R$ 49,90.
const ESCADA = [
  { min_qty: 10, max_qty: 19, unit_price: 47.41, discount_pct: 5, lead_days: 5 },
  { min_qty: 20, max_qty: 49, unit_price: 44.91, discount_pct: 10, lead_days: 5 },
  { min_qty: 50, max_qty: null, unit_price: 42.42, discount_pct: 15, lead_days: 8 },
] as any;

describe("régua da escada", () => {
  test("uma parada por faixa, mais a de 1 unidade, com o preço de cada", () => {
    const r = reguaDaEscada(ESCADA, 49.9, 0, 1)!;
    expect(r.paradas.map((p) => p.qtd)).toEqual([1, 10, 20, 50]);
    expect(r.paradas.map((p) => p.preco)).toEqual([49.9, 47.41, 44.91, 42.42]);
    expect(r.paradas.map((p) => p.pct)).toEqual([0, 5, 10, 15]);
    expect(r.progresso).toBe(0);
  });

  test("os adicionais por unidade somam DEPOIS da faixa", () => {
    const r = reguaDaEscada(ESCADA, 49.9, 8, 1)!;
    expect(r.paradas.map((p) => p.preco)).toEqual([57.9, 55.41, 52.91, 50.42]);
  });

  test("o marcador anda proporcional entre as paradas e marca as alcançadas", () => {
    const r = reguaDaEscada(ESCADA, 49.9, 0, 17)!;
    expect(r.paradas.map((p) => p.alcancada)).toEqual([true, true, false, false]);
    expect(r.progresso).toBeCloseTo((1 + 7 / 10) / 3, 5);
    expect(reguaDaEscada(ESCADA, 49.9, 0, 50)!.progresso).toBe(1);
    expect(reguaDaEscada(ESCADA, 49.9, 0, 400)!.progresso).toBe(1);
    expect(progressoNaRegua([1], 5)).toBe(0);
  });

  test("sem escada a régua some; faixa de 1 unidade não vira parada repetida", () => {
    expect(reguaDaEscada([], 49.9, 0, 1)).toBeNull();
    expect(reguaDaEscada(null, 49.9, 0, 1)).toBeNull();
    const r = reguaDaEscada([{ min_qty: 1, max_qty: 9, unit_price: 49.9, discount_pct: 0 }, ESCADA[0]] as any, 49.9, 0, 1)!;
    expect(r.paradas.map((p) => p.qtd)).toEqual([1, 10]);
  });

  test("faixa mal cadastrada nunca encarece a parada", () => {
    const r = reguaDaEscada([{ min_qty: 10, max_qty: null, unit_price: 60, discount_pct: 0 }] as any, 49.9, 0, 1)!;
    expect(r.paradas[1].preco).toBe(49.9);
  });
});

describe("frase da escada", () => {
  test("longe da faixa: Leve N e pague", () => {
    expect(fraseDaEscada(ESCADA, 49.9, 0, 1)).toEqual({ tipo: "leve", quantidade: 10, preco: 47.41 });
    expect(fraseDaEscada(ESCADA, 49.9, 0, 4)).toEqual({ tipo: "leve", quantidade: 10, preco: 47.41 });
  });
  test("da metade do caminho em diante: Faltam N", () => {
    expect(fraseDaEscada(ESCADA, 49.9, 0, 5)).toEqual({ tipo: "faltam", faltam: 5, quantidade: 10, preco: 47.41 });
    expect(fraseDaEscada(ESCADA, 49.9, 0, 17)).toEqual({ tipo: "faltam", faltam: 3, quantidade: 20, preco: 44.91 });
    expect(fraseDaEscada(ESCADA, 49.9, 0, 24)).toEqual({ tipo: "leve", quantidade: 50, preco: 42.42 });
  });
  test("na última faixa: o menor preço, com os adicionais", () => {
    expect(fraseDaEscada(ESCADA, 49.9, 0, 50)).toEqual({ tipo: "menor", preco: 42.42 });
    expect(fraseDaEscada(ESCADA, 49.9, 8, 60)).toEqual({ tipo: "menor", preco: 50.42 });
  });
  test("sem escada, nenhuma frase", () => {
    expect(fraseDaEscada([], 49.9, 0, 3)).toBeNull();
  });
  test("a economia é sobre a tabela, vezes a quantidade", () => {
    expect(economiaNaFaixa(ESCADA, 49.9, 17)).toEqual({ valor: 42.33, pct: 5 });
    expect(economiaNaFaixa(ESCADA, 49.9, 50)).toEqual({ valor: 374, pct: 15 });
    expect(economiaNaFaixa(ESCADA, 49.9, 3)).toBeNull();
  });
});

describe("prazo por faixa", () => {
  test("o lead_days da faixa vence; fora dela, o prazo da loja", () => {
    expect(prazoDaQuantidade(ESCADA, 1, 3)).toBe(3);
    expect(prazoDaQuantidade(ESCADA, 17, 3)).toBe(5);
    expect(prazoDaQuantidade(ESCADA, 50, 3)).toBe(8);
  });
  test("faixa sem prazo cai no da loja; sem os dois, nada é inventado", () => {
    const semPrazo = [{ min_qty: 10, max_qty: null, unit_price: 45, discount_pct: 10, lead_days: null }] as any;
    expect(prazoDaQuantidade(semPrazo, 20, 4)).toBe(4);
    expect(prazoDaQuantidade(semPrazo, 20, 0)).toBeNull();
    expect(prazoDaQuantidade(null, 1, undefined)).toBeNull();
  });
  test("a linha de prazos por quantidade só existe com prazo por faixa", () => {
    expect(linhasDePrazo(ESCADA, 3)).toBe(
      "Até 9 un: 3 dias úteis · 10 a 19 un: 5 dias úteis · 20 a 49 un: 5 dias úteis · 50 un ou mais: 8 dias úteis",
    );
    expect(linhasDePrazo([{ min_qty: 10, max_qty: null, unit_price: 45, discount_pct: 10 }] as any, 3)).toBeNull();
    expect(textoDeDias(1)).toBe("1 dia útil");
  });
});

// Configs como os do banco (fixtures do QA da Sheid).
const CANECA_BRANCA: any = {
  print_area: { width_cm: 9, height_cm: 9 },
  has_back: true,
  fields: [
    { id: "text", type: "text", side: "front", required: true, label: "Texto", config: { max_chars: 20 } },
    { id: "image", type: "image", side: "front", required: true, label: "Foto do cliente", config: {} },
    { id: "template", type: "template", side: "front", required: true, label: "Escolher template da galeria", config: {} },
    { id: "color", type: "color", side: "front", required: true, label: "Cor", config: { colors: ["#FFFFFF", "#000000"] } },
    { id: "art_service", type: "option", side: "front", required: false, label: "Quem cria a arte",
      config: { is_art_service: true, choices: [
        { value: "none", label: "Vou enviar minha arte pronta", price_delta: 0 },
        { value: "adjust", label: "Envio minha arte e vocês ajustam", price_delta: 10 },
        { value: "designer", label: "Criem a arte pra mim", price_delta: 25 },
      ] } },
    { id: "art_service_brief", type: "text", side: "front", required: false, label: "Briefing da arte", config: {} },
  ],
};
const COM_VERSO_COBRADO: any = {
  has_back: true, back_charge_enabled: true, back_price_delta: 8,
  has_middle: true, middle_charge_enabled: false,
  fields: [
    { id: "img", type: "image", side: "front", required: true, label: "Sua arte", config: {} },
    { id: "tv", type: "text", side: "back", required: true, label: "Nome do verso", config: {} },
    { id: "tm", type: "text", side: "middle", required: false, label: "Frase do meio", config: {} },
    { id: "tam", type: "option", side: "front", required: true, label: "Tamanho",
      config: { choices: [{ value: "p", label: "P" }, { value: "g", label: "G", price_delta: 5 }] } },
  ],
};

describe("o que falta na peça", () => {
  test("a arte da frente, apontando para o envio", () => {
    expect(faltaNaPeca(CANECA_BRANCA, { color: "#FFFFFF" }, false)).toEqual({
      frase: "Falta a arte da frente", lado: "front", campoId: "image", tipo: "arte",
    });
  });
  test("arquivo OU arte pronta resolve; 'Criem a arte pra mim' dispensa", () => {
    expect(faltaNaPeca(CANECA_BRANCA, { template: "u", text: "Mãe", color: "#FFF" }, false)).toBeNull();
    expect(faltaNaPeca(CANECA_BRANCA, { art_service: "designer", text: "Mãe", color: "#FFF" }, false)).toBeNull();
    // Ajuste não dispensa: ela manda a arte para a loja ajustar.
    expect(faltaNaPeca(CANECA_BRANCA, { art_service: "adjust", text: "Mãe", color: "#FFF" }, false)?.tipo).toBe("arte");
  });
  test("depois da arte, o texto obrigatório", () => {
    expect(faltaNaPeca(CANECA_BRANCA, { image: "u", color: "#FFF" }, false)).toEqual({
      frase: "Falta o texto da frente", lado: "front", campoId: "text", tipo: "campo",
    });
  });
  test("verso só conta quando escolhido; opção vira 'Falta escolher'", () => {
    const base = { img: "u" };
    expect(faltaNaPeca(COM_VERSO_COBRADO, base, false)?.frase).toBe("Falta escolher tamanho");
    expect(faltaNaPeca(COM_VERSO_COBRADO, { ...base, tam: "p" }, false)).toBeNull();
    expect(faltaNaPeca(COM_VERSO_COBRADO, { ...base, tam: "p" }, true)).toEqual({
      frase: "Falta o texto do verso", lado: "back", campoId: "tv", tipo: "campo",
    });
  });
  test("diz 'falta' exatamente quando o validador do commit recusa", () => {
    const casos: Array<[any, Record<string, any>, boolean, boolean]> = [
      [CANECA_BRANCA, {}, false, false],
      [CANECA_BRANCA, { image: "u" }, false, false],
      [CANECA_BRANCA, { image: "u", text: "  " }, false, false],
      [CANECA_BRANCA, { image: "u", text: "a", color: "#000" }, false, false],
      [CANECA_BRANCA, { art_service: "designer" }, false, false],
      [CANECA_BRANCA, { art_service: "adjust", template: "t" }, false, false],
      [COM_VERSO_COBRADO, {}, false, false],
      [COM_VERSO_COBRADO, { img: "u", tam: "g" }, true, true],
      [COM_VERSO_COBRADO, { img: "u", tam: "g", tv: "Ana" }, true, true],
      [null, {}, false, false],
      [{ fields: [] }, {}, false, false],
    ];
    for (const [cfg, v, b, m] of casos) {
      expect(faltaNaPeca(cfg, v, b, m) === null).toBe(validateRequiredFields(cfg, v, b, m) === null);
    }
  });
});

describe("lados e campos", () => {
  test("as abas seguem o produto", () => {
    expect(ladosDaPeca(CANECA_BRANCA)).toEqual(["front", "back"]);
    expect(ladosDaPeca(COM_VERSO_COBRADO)).toEqual(["front", "back", "middle"]);
    expect(ladosDaPeca(null)).toEqual(["front"]);
  });
  test("cada aba mostra o que não tem lugar próprio na página", () => {
    expect(camposDoLado(CANECA_BRANCA, "front").map((f) => f.id)).toEqual(["text"]);
    expect(camposDoLado(COM_VERSO_COBRADO, "front").map((f) => f.id)).toEqual(["tam"]);
    expect(camposDoLado(COM_VERSO_COBRADO, "back").map((f) => f.id)).toEqual(["tv"]);
    expect(origensDoLado(CANECA_BRANCA, "front")).toEqual({
      envio: CANECA_BRANCA.fields[1], pronta: CANECA_BRANCA.fields[2],
    });
    expect(origensDoLado(CANECA_BRANCA, "back")).toEqual({ envio: null, pronta: null });
  });
  test("o pontinho da aba: o lado tem arte ou texto", () => {
    expect(ladoPreenchido(COM_VERSO_COBRADO, "back", { tv: "Ana" })).toBe(true);
    expect(ladoPreenchido(COM_VERSO_COBRADO, "back", { tv: " " })).toBe(false);
    expect(ladoPreenchido(CANECA_BRANCA, "front", { art_service_brief: "ideia" })).toBe(false);
  });
});

describe("aviso de foto pequena", () => {
  test("abaixo de 1200 px no lado maior avisa; PDF não é medido", () => {
    expect(LIMIAR_DE_RESOLUCAO).toBe(1200);
    expect(avisoDeResolucao({ tipo: "image/jpeg", largura: 640, altura: 640 })).toEqual({ ladoMaior: 640, limiar: 1200 });
    expect(avisoDeResolucao({ tipo: "image/png", largura: 2400, altura: 900 })).toBeNull();
    expect(avisoDeResolucao({ tipo: "image/png", largura: 1199, altura: 300 })).toEqual({ ladoMaior: 1199, limiar: 1200 });
    expect(avisoDeResolucao({ tipo: "application/pdf", largura: 10, altura: 10 })).toBeNull();
    expect(avisoDeResolucao({ tipo: "image/jpeg", largura: null, altura: 640 })).toBeNull();
    expect(medivel("image/webp")).toBe(true);
    expect(medivel("image/heic")).toBe(false);
  });
  test("com área cadastrada, o limiar nunca passa do que a página pede", () => {
    const pequena = areaDeImpressao({ print_area: { width_cm: 9, height_cm: 9 } } as any)!;
    expect(pequena.pxLargura).toBe(1063);
    expect(limiarDaPeca(pequena)).toBe(1063);
    const grande = areaDeImpressao({ print_area: { width_cm: 20, height_cm: 9 } } as any)!;
    expect(limiarDaPeca(grande)).toBe(1200);
    expect(limiarDaPeca(null)).toBe(1200);
    expect(avisoDeResolucao({ tipo: "image/png", largura: 1100, altura: 1100 }, limiarDaPeca(pequena))).toBeNull();
  });
  test("as frases", () => {
    expect(textoDoAvisoDeResolucao(640, nomeDaPeca("Canecas"))).toBe("Essa foto tem 640 px. Na caneca ela pode sair borrada.");
    expect(textoDoAvisoDeResolucao(640, nomeDaPeca("Copos"))).toBe("Essa foto tem 640 px. No copo ela pode sair borrada.");
    expect(medidasDoArquivo({ largura: 2400, altura: 2400, bytes: 1.8 * 1024 * 1024 })).toBe("2400 × 2400 px · 1,8 MB");
    expect(medidasDoArquivo({ largura: 640, altura: 640, bytes: 98000 })).toBe("640 × 640 px · 96 KB");
    expect(medidasDoArquivo({ bytes: 0 })).toBe("");
    expect(pixelsParaCm(20)).toBe(2362);
  });
});

describe("a peça em palavras", () => {
  test("o singular da categoria, com o gênero; senão 'peça'", () => {
    expect(nomeDaPeca("Canecas")).toEqual({ nome: "caneca", feminino: true });
    expect(nomeDaPeca("Copos")).toEqual({ nome: "copo", feminino: false });
    expect(nomeDaPeca("Moletons")).toEqual({ nome: "peça", feminino: true });
    expect(nomeDaPeca("Linha Premium")).toEqual({ nome: "peça", feminino: true });
    expect(nomeDaPeca(null)).toEqual({ nome: "peça", feminino: true });
    expect(suaPeca(nomeDaPeca("Canecas"))).toBe("Sua caneca");
    expect(suaPeca(nomeDaPeca("Copos"))).toBe("Seu copo");
    expect(sobreEstaPeca(nomeDaPeca("Copos"))).toBe("Sobre este copo");
  });
  test("o nome curto do modelo tira a palavra da categoria", () => {
    expect(nomeCurto("Caneca Alça Coração", "Canecas")).toBe("Alça Coração");
    expect(nomeCurto("CANECA CHOPP", "Canecas")).toBe("CHOPP");
    expect(nomeCurto("Caneca de Vidro personalizada", "Canecas")).toBe("Vidro personalizada");
    expect(nomeCurto("Caneca", "Canecas")).toBe("Caneca");
    expect(nomeCurto("Xícara com pires", "Canecas")).toBe("Xícara com pires");
    expect(nomeCurto("Caneca Branca", null)).toBe("Caneca Branca");
  });
  test("o endereço de retirada em bairro e rua", () => {
    expect(enderecoDeRetirada("Av Dom Pedro I, 553 - Jardim Colonial")).toEqual({ bairro: "Jardim Colonial", rua: "Av Dom Pedro I, 553" });
    expect(enderecoDeRetirada("Rua A, 10")).toEqual({ bairro: null, rua: "Rua A, 10" });
    expect(enderecoDeRetirada("")).toBeNull();
  });
  test("a promessa de revisão", () => {
    expect(notaDeRevisao({ max_included: 2, extra_price: 10, policy_text: null }))
      .toBe("Você aprova o mockup antes de produzir. 2 revisões inclusas; revisão extra R$ 10,00.");
    expect(notaDeRevisao({ max_included: 0 })).toBe("Você aprova o mockup antes de a loja produzir.");
    expect(notaDeRevisao({ policy_text: "Do jeito da loja." })).toBe("Do jeito da loja.");
    expect(notaDeRevisao(null)).toBeNull();
  });
});

describe("o que o preço já inclui", () => {
  test("rótulos dos adicionais escolhidos, com o serviço de arte marcado", () => {
    expect(adicionaisDaPeca(CANECA_BRANCA, { art_service: "adjust" }, false, false)).toEqual([
      { nome: "ajuste da arte", valor: 10, servicoDeArte: true },
    ]);
    expect(adicionaisDaPeca(COM_VERSO_COBRADO, { tam: "g" }, true, true)).toEqual([
      { nome: "G", valor: 5, servicoDeArte: false },
      { nome: "verso", valor: 8, servicoDeArte: false },
    ]);
    expect(adicionaisDaPeca(COM_VERSO_COBRADO, { tam: "g" }, false, false).map((a) => a.nome)).toEqual(["G"]);
    expect(adicionaisDaPeca(null, {}, true, true)).toEqual([]);
  });
  test("'a partir de' só quando o preço pode mudar na página", () => {
    expect(precoPodeMudar({ customization_config: CANECA_BRANCA })).toBe(true);
    expect(precoPodeMudar({ customization_config: { fields: [] } as any })).toBe(false);
    expect(precoPodeMudar({ customization_config: null, qty_tiers: ESCADA })).toBe(true);
    expect(precoPodeMudar({ customization_config: COM_VERSO_COBRADO })).toBe(true);
  });
});

describe("área de impressão", () => {
  test("uma fonte só: o cadastro, e sem ele o modelo visual", () => {
    const a = areaDeImpressao({ print_area: { width_cm: 20, height_cm: 9 } } as any)!;
    expect(a).toEqual({ larguraCm: 20, alturaCm: 9, pxLargura: 2362, pxAltura: 1063, origem: "cadastro" });
    expect(textoDaArea(a)).toBe("20 × 9 cm");
    expect(areaDeImpressao({ print_area: { width_cm: 0, height_cm: 0 } } as any, [{ width_cm: 19.5, height_cm: 8 }]))
      .toMatchObject({ larguraCm: 19.5, alturaCm: 8, origem: "modelo" });
    expect(textoDaArea(areaDeImpressao(null, [{ width_cm: 19.5, height_cm: 8 }])!)).toBe("19,5 × 8 cm");
    expect(areaDeImpressao(null, [])).toBeNull();
    expect(areaDeImpressao({ print_area: null } as any)).toBeNull();
  });
});
