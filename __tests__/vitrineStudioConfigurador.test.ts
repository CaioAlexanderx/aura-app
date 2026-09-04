// ============================================================
// O configurador avisa antes, não depois (S4 · 03/09/2026)
//
// `validateRequiredFields` existia desde a Onda 0 e só rodava no commit:
// a pessoa configurava a peça inteira, tocava "Comprar agora" e só então
// descobria que faltava a arte. A mesma função, chamada durante o
// preenchimento, vira aviso na tela em vez de recusa no fim.
//
// Ser a MESMA função é o ponto. Duas validações divergentes fazem o
// aviso sumir e o botão recusar assim mesmo — que é o pior dos dois
// mundos, e foi exatamente o que aconteceu entre app e backend em
// 18/08/2026 (S0), quando a Sheid marcou quatro campos como obrigatórios.
// ============================================================
import fs from "fs";
import path from "path";
import { validateRequiredFields } from "@/components/studio/storefront/useStorefront";

/** A config real da Caneca Branca: texto, foto, galeria e cor obrigatórios. */
const CANECA_BRANCA: any = {
  has_back: true,
  fields: [
    { id: "text", side: "front", type: "text", label: "Texto", required: true, config: { max_chars: 25 } },
    { id: "image", side: "front", type: "image", label: "Foto do cliente", required: true, config: {} },
    { id: "template", side: "front", type: "template", label: "Escolher template da galeria", required: true, config: {} },
    { id: "color", side: "front", type: "color", label: "Cor", required: true, config: {} },
    { id: "art_service", side: "front", type: "option", label: "Quem cria a arte", required: false,
      config: { is_art_service: true, choices: [
        { value: "none", label: "Vou enviar minha arte pronta", price_delta: 0 },
        { value: "designer", label: "Criem a arte pra mim", price_delta: 15 },
      ] } },
  ],
};

describe("o grupo de origem da arte", () => {
  test("com nada preenchido, o aviso diz o que fazer", () => {
    const r = validateRequiredFields(CANECA_BRANCA, {}, true, false);
    expect(r).toBeTruthy();
    expect(String(r)).toMatch(/arte/i);
  });

  test("enviar a foto satisfaz o grupo — não precisa também da galeria", () => {
    // Foi este o defeito de 18/08: exigir os dois tornava a compra
    // impossível, porque os dois preenchem o MESMO lugar na caneca.
    const r = validateRequiredFields(
      CANECA_BRANCA, { image: "https://x/arte.png", text: "Pai", color: "#000" }, true, false);
    expect(r).toBeNull();
  });

  test("escolher da galeria também satisfaz", () => {
    const r = validateRequiredFields(
      CANECA_BRANCA, { template: "https://x/t.png", text: "Pai", color: "#000" }, true, false);
    expect(r).toBeNull();
  });

  test("contratar a criação dispensa enviar arte", () => {
    const r = validateRequiredFields(
      CANECA_BRANCA, { art_service: "designer", text: "Pai", color: "#000" }, true, false);
    expect(r).toBeNull();
  });

  test("com a arte resolvida, ainda cobra o texto que falta", () => {
    const r = validateRequiredFields(
      CANECA_BRANCA, { image: "https://x/a.png", color: "#000" }, true, false);
    expect(String(r)).toMatch(/Texto/i);
  });

  test("campo em branco não conta como preenchido", () => {
    const r = validateRequiredFields(
      CANECA_BRANCA, { image: "https://x/a.png", text: "   ", color: "#000" }, true, false);
    expect(String(r)).toMatch(/Texto/i);
  });
});

describe("lado inativo não é cobrado", () => {
  const comVerso: any = {
    has_back: true, back_charge_enabled: true,
    fields: [
      { id: "f", side: "front", type: "text", label: "Frente", required: true, config: {} },
      { id: "b", side: "back", type: "text", label: "Verso", required: true, config: {} },
    ],
  };

  test("verso desligado não exige o campo do verso", () => {
    expect(validateRequiredFields(comVerso, { f: "oi" }, false, false)).toBeNull();
  });

  test("verso ligado passa a exigir", () => {
    expect(String(validateRequiredFields(comVerso, { f: "oi" }, true, false))).toMatch(/Verso/i);
  });
});

describe("a tela usa a MESMA validação do commit", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "../components/studio/storefront/ProductConfigurator.tsx"), "utf8");

  test("o configurador importa validateRequiredFields e calcula a pendência", () => {
    expect(fonte).toContain('import { validateRequiredFields } from "./useStorefront"');
    expect(fonte).toContain("const pendencia = validateRequiredFields(");
  });

  test("passa os MESMOS lados ativos que o commit usa", () => {
    // showBackBody/showMiddleBody são o que decide se a seção aparece —
    // cobrar um campo de um lado que a pessoa não vê seria impossível.
    expect(fonte).toMatch(/validateRequiredFields\(\s*\n?\s*cfg \?\? null, editingValues, showBackBody, showMiddleBody/);
  });

  test("o aviso aparece ANTES do botão, não depois do toque", () => {
    const iAviso = fonte.indexOf("{pendencia ?");
    // Ancora no rotulo de acessibilidade do botao, nao na frase solta:
    // "Comprar agora" aparece antes num comentario, e o teste passaria
    // ou falharia por causa de prosa.
    // 04/09/2026: o rotulo virou ternario — com a loja fechada para o
    // pico ele diz "Pedir orcamento". A regra guardada e a mesma.
    const iBotao = fonte.indexOf('? "Comprar agora por "');
    expect(iAviso).toBeGreaterThan(0);
    expect(iAviso).toBeLessThan(iBotao);
  });

  test("a nota de revisão sai da política da loja, não de texto fixo", () => {
    expect(fonte).toContain("const notaDeRevisao");
    expect(fonte).toContain("r.policy_text");
    expect(fonte).toContain("max_included");
  });

  test("no celular a peça fica grudada no topo (decisão 3)", () => {
    expect(fonte).toContain("const previewGrudento");
    expect(fonte).toContain('position: "sticky"');
    // Só no celular: no desktop as duas colunas cabem lado a lado.
    expect(fonte).toContain("!telaLarga && Platform.OS === \"web\"");
  });
});
