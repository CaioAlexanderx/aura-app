// ============================================================
// Etiquetas — "Minha medida" na tela (15/10/2026, mockup aprovado
// docs/mockups/etiqueta-self-service.html).
//
// Trava: "+ Minha medida" sempre no seletor; wizard de 4 passos (medida,
// teste, ajuste, pronto) com os textos do mockup; a medida salva vira
// "Minha etiqueta L x A mm" com lápis e lixeira (com confirmação), por
// empresa, neste computador; a impressão usa a medida e o ajuste; voltar a
// um modelo fixo imprime exatamente o HTML de sempre.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja", trade_name: "Toda Linda" }, token: "t" }) }));
jest.mock("@/services/api", () => ({ companiesApi: {}, pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})) } }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children, active }: any) => (active ? children : null) }));

import { PrintLabels } from "@/components/PrintLabels";
import { buildLabelHtml, LABEL_SIZE_KEYS, LABEL_SIZE_PRESETS } from "@/components/screens/estoque/labels/buildLabelHtml";
import { pdvSettingsApi } from "@/services/api";

const PRODUTOS: any[] = [
  { id: "p1", name: "Blusa Canelada", code: "001", barcode: "7891033948208", category: "Blusas", price: 59.9, stock: 2, unit: "un", size: "", color: "" },
];

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}
const acha = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const aperta = (t: renderer.ReactTestRenderer, id: string) => act(() => { acha(t, id)[0].props.onPress(); });
const digita = (t: renderer.ReactTestRenderer, id: string, v: string) => act(() => { acha(t, id)[0].props.onChangeText(v); });
const texto = (t: renderer.ReactTestRenderer) => flatten(t.toJSON());
const abreMenu = (t: renderer.ReactTestRenderer) => act(() => {
  t.root.findAll((n) => n.props && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Modelo de etiqueta:"), { deep: false })[0].props.onPress();
});

let htmls: string[] = [];
const BlobDeVerdade = global.Blob;
beforeEach(() => {
  window.localStorage.clear();
  htmls = [];
  (global as any).Blob = function (partes: any[]) { htmls.push(String(partes[0])); return {}; };
  (URL as any).createObjectURL = jest.fn(() => "blob:teste");
  window.open = jest.fn(() => ({} as any));
  (pdvSettingsApi.save as jest.Mock).mockClear();
});
afterAll(() => { (global as any).Blob = BlobDeVerdade; });

function monta(selecionados: string[] = []) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={selecionados} onSelectionChange={() => {}} />); });
  return t;
}

function criaMedida40x25(t: renderer.ReactTestRenderer) {
  abreMenu(t);
  aperta(t, "etiquetas-minha-medida");
  aperta(t, "medida-atalho-40x25");
  aperta(t, "medida-continuar");
  aperta(t, "medida-ja-imprimi");
  aperta(t, "medida-dir-esquerda");
  aperta(t, "medida-dir-esquerda");
  aperta(t, "medida-dir-cima");
  aperta(t, "medida-ficou-certo");
}

test("'+ Minha medida' está sempre no seletor, junto com todos os modelos fixos", () => {
  const t = monta();
  abreMenu(t);
  const tx = texto(t);
  LABEL_SIZE_KEYS.forEach((k) => expect(tx).toContain(LABEL_SIZE_PRESETS[k].uiLabel));
  expect(tx).toContain("Minha medida");
  expect(acha(t, "etiquetas-minha-medida")).toHaveLength(1);
  t.unmount();
});

test("passo 1: textos, rolo ao vivo, aviso de estreita, erro de limite e espaços", () => {
  const t = monta();
  abreMenu(t);
  aperta(t, "etiquetas-minha-medida");
  expect(acha(t, "medida-wizard")).toHaveLength(1);
  let tx = texto(t);
  expect(tx).toContain("Minha medida de etiqueta");
  expect(tx).toContain("Qual é o tamanho da sua etiqueta?");
  expect(tx).toContain("Comece por um atalho ou digite a medida em milímetros (mm).");
  expect(tx).toContain("Meça só a etiqueta, sem o papel em volta.");
  expect(tx).toContain("Quantas etiquetas lado a lado no rolo?");
  expect(tx).toContain("“Lado a lado” só vale com 2 ou 3 etiquetas no rolo.");
  expect(tx).toContain("Usando o padrão");
  ["Medida", "Teste", "Ajuste", "Pronto"].forEach((p) => expect(tx).toContain(p));
  // rolo em escala com a medida padrão
  const rolo = () => acha(t, "medida-rolo")[0].props.html as string;
  expect(rolo()).toContain(">50 mm</text>");

  digita(t, "medida-largura", "20");
  expect(acha(t, "medida-aviso-estreita")).toHaveLength(1);
  expect(rolo()).toContain(">20 mm</text>");
  aperta(t, "medida-usar-30");
  expect(acha(t, "medida-aviso-estreita")).toHaveLength(0);
  expect(acha(t, "medida-largura")[0].props.value).toBe("30");

  digita(t, "medida-largura", "140");
  expect(flatten(acha(t, "medida-erro-largura")[0].props.children)).toBe("Use um valor entre 15 e 110 mm");
  expect(acha(t, "medida-continuar")[0].props.disabled).toBe(true);
  expect(rolo()).toContain(">30 mm</text>"); // fica na última medida válida

  digita(t, "medida-largura", "33,5");
  expect(acha(t, "medida-continuar")[0].props.disabled).toBe(false);
  // 1 coluna: campo "lado a lado" desligado
  expect(acha(t, "medida-espacoLado")[0].props.editable).toBe(false);
  aperta(t, "medida-colunas-3");
  expect(acha(t, "medida-espacoLado")[0].props.editable).toBe(true);
  digita(t, "medida-espacoLinha", "4");
  tx = texto(t);
  expect(tx).toContain("Não sei, usar o padrão");
  aperta(t, "medida-usar-padrao");
  expect(acha(t, "medida-espacoLinha")[0].props.value).toBe("2");

  aperta(t, "medida-cancelar");
  expect(acha(t, "medida-wizard")).toHaveLength(0);
  expect(window.localStorage.getItem("aura_label_custom_empresa-1")).toBeNull();
  t.unmount();
});

test("fluxo completo: teste com a medida, ajuste por direção, salvar e imprimir com o ajuste", () => {
  const t = monta(["p1"]);
  abreMenu(t);
  aperta(t, "etiquetas-minha-medida");
  aperta(t, "medida-atalho-40x25");
  aperta(t, "medida-continuar");

  // passo 2: imprime a moldura de teste com a impressão de sempre (blob)
  expect(texto(t)).toContain("Imprima uma etiqueta de teste");
  expect(texto(t)).toContain("Gasta só uma etiqueta.");
  aperta(t, "medida-imprimir-teste");
  expect(htmls).toHaveLength(1);
  expect(htmls[0]).toContain("<title>Teste de posição da etiqueta</title>");
  expect(htmls[0]).toContain("@page{margin:0;size:40mm 27mm}");
  expect(acha(t, "medida-teste-enviado")).toHaveLength(1);
  aperta(t, "medida-ja-imprimi");

  // passo 3
  expect(texto(t)).toContain("Como saiu o teste?");
  expect(texto(t)).toContain("A ilustração mostra um exemplo de etiqueta que saiu torta.");
  const moldura = () => acha(t, "medida-moldura")[0].props.html as string;
  expect(moldura()).toContain('transform="translate(-2 -1)"');
  aperta(t, "medida-dir-esquerda");
  expect(texto(t)).toContain("Movi a moldura 0,5 mm para a direita.");
  expect(moldura()).toContain('transform="translate(-1.5 -1)"');
  aperta(t, "medida-dir-esquerda");
  aperta(t, "medida-dir-cima");
  aperta(t, "medida-ajuste-fino");
  expect(flatten(acha(t, "medida-fino-x-valor")[0].props.children)).toBe("+1,0 mm");
  expect(flatten(acha(t, "medida-fino-y-valor")[0].props.children)).toBe("+0,5 mm");
  aperta(t, "medida-fino-x-mais");
  aperta(t, "medida-fino-x-menos");
  // "Imprimir de novo" já sai com o ajuste
  aperta(t, "medida-imprimir-de-novo");
  expect(htmls[1]).toContain("transform:translate(1mm,0.5mm)");
  expect(texto(t)).toContain("Saiu com o ajuste de hoje (Horizontal +1,0 mm · Vertical +0,5 mm)");
  aperta(t, "medida-ficou-certo");

  // passo 4
  let tx = texto(t);
  expect(tx).toContain("Sua etiqueta 40 x 25 mm está salva neste computador");
  expect(tx).toContain("Ela já aparece na lista de modelos como “Minha etiqueta 40 x 25 mm”.");
  expect(flatten(acha(t, "medida-resumo-ajuste")[0].props.children)).toBe("Horizontal +1,0 mm · Vertical +0,5 mm");
  expect(flatten(acha(t, "medida-resumo-rolo")[0].props.children)).toBe("Uma etiqueta por linha");
  expect(tx).toContain("O ajuste fica neste computador");
  const salvo = JSON.parse(window.localStorage.getItem("aura_label_custom_empresa-1")!);
  expect(salvo.medidas).toHaveLength(1);
  expect(salvo.medidas[0]).toMatchObject({ larguraMm: 40, alturaMm: 25, colunas: 1, ajusteXMm: 1, ajusteYMm: 0.5 });
  expect(salvo.escolhida).toBe(salvo.medidas[0].id);
  // nada vai para o servidor
  expect(pdvSettingsApi.save).not.toHaveBeenCalled();

  aperta(t, "medida-imprimir-agora");
  expect(acha(t, "medida-wizard")).toHaveLength(0);
  const real = htmls[htmls.length - 1];
  expect(real).toContain("@page{margin:0;size:40mm 27mm}");
  expect(real).toContain("transform:translate(1mm,0.5mm)");
  expect(real).toContain('data-code="7891033948208"');

  // o seletor e o título mostram a medida; a calibração dos fixos some
  tx = texto(t);
  expect(tx).toContain("Etiquetas Minha etiqueta 40 x 25 mm — Padrão EAN-13");
  expect(acha(t, "etiquetas-calibracao")).toHaveLength(0);
  t.unmount();
});

test("lista: medida salva com lápis (abre preenchida) e lixeira com confirmação; voltar ao fixo imprime o HTML de sempre", () => {
  const t = monta(["p1"]);
  criaMedida40x25(t);
  aperta(t, "medida-fechar");
  const id = JSON.parse(window.localStorage.getItem("aura_label_custom_empresa-1")!).medidas[0].id;

  abreMenu(t);
  expect(texto(t)).toContain("Minha etiqueta 40 x 25 mm");
  expect(texto(t)).toContain("ajuste guardado neste computador");
  expect(acha(t, "etiquetas-medida-editar-" + id)).toHaveLength(1);
  expect(acha(t, "etiquetas-medida-apagar-" + id)).toHaveLength(1);
  expect(acha(t, "etiquetas-minha-medida")).toHaveLength(1); // "+ Minha medida" continua

  // lápis: abre "Editar minha etiqueta" no passo 1, preenchido
  aperta(t, "etiquetas-medida-editar-" + id);
  expect(texto(t)).toContain("Editar minha etiqueta");
  expect(acha(t, "medida-largura")[0].props.value).toBe("40");
  expect(acha(t, "medida-altura")[0].props.value).toBe("25");
  aperta(t, "medida-x");

  // voltar a um modelo fixo: o HTML é o de sempre, byte a byte
  abreMenu(t);
  act(() => {
    t.root.findAll((n) => n.props && n.props.accessibilityRole === "menuitem" && flatten(n.children).includes(LABEL_SIZE_PRESETS["99x21"].uiLabel), { deep: false })[0].props.onPress();
  });
  expect(JSON.parse(window.localStorage.getItem("aura_label_custom_empresa-1")!).escolhida).toBeNull();
  htmls = [];
  act(() => { t.root.findAll((n) => n.props && n.props.onPress && flatten(n.children).startsWith("Imprimir 1 etiqueta"), { deep: false })[0].props.onPress(); });
  const esperado = buildLabelHtml(
    [{ name: "Blusa Canelada", price: 59.9, barcode: "7891033948208", size: "", color: "", qty: 1, productId: "p1" }],
    // 24/10/2026: sem marcar o toggle, modelo fixo sai sem o nome da loja.
    { mode: "barcode", storeName: "Toda Linda", showStoreName: false, labelSize: "99x21", offsetMm: 0 },
  );
  expect(htmls).toHaveLength(1);
  expect(htmls[0]).toBe(esperado);

  // lixeira: pede confirmação; cancelar não apaga; apagar some da lista
  abreMenu(t);
  aperta(t, "etiquetas-medida-apagar-" + id);
  expect(texto(t)).toContain("Apagar “Minha etiqueta 40 x 25 mm” deste computador?");
  aperta(t, "etiquetas-medida-apagar-cancelar");
  expect(acha(t, "etiquetas-medida-" + id)).toHaveLength(1);
  aperta(t, "etiquetas-medida-apagar-" + id);
  aperta(t, "etiquetas-medida-apagar-sim");
  expect(acha(t, "etiquetas-medida-" + id)).toHaveLength(0);
  expect(window.localStorage.getItem("aura_label_custom_empresa-1")).toBeNull();
  t.unmount();
});

test("a medida escolhida volta ao reabrir a tela (por empresa, neste computador)", () => {
  const t = monta(["p1"]);
  criaMedida40x25(t);
  aperta(t, "medida-fechar");
  t.unmount();
  const t2 = monta(["p1"]);
  expect(texto(t2)).toContain("Etiquetas Minha etiqueta 40 x 25 mm — Padrão EAN-13");
  t2.unmount();
});

test("passo 3: limite de 8 mm avisa e 'Voltar ao padrão' zera", () => {
  const t = monta();
  abreMenu(t);
  aperta(t, "etiquetas-minha-medida");
  aperta(t, "medida-continuar");
  aperta(t, "medida-ja-imprimi");
  for (let i = 0; i < 17; i++) aperta(t, "medida-dir-direita");
  expect(acha(t, "medida-limite")).toHaveLength(1);
  expect(texto(t)).toContain("Chegou no limite de 8 mm.");
  aperta(t, "medida-ajuste-fino");
  expect(flatten(acha(t, "medida-fino-x-valor")[0].props.children)).toBe("−8,0 mm");
  aperta(t, "medida-voltar-padrao");
  expect(flatten(acha(t, "medida-fino-x-valor")[0].props.children)).toBe("0,0 mm");
  // os passos já feitos são clicáveis
  aperta(t, "medida-passo-1");
  expect(texto(t)).toContain("Qual é o tamanho da sua etiqueta?");
  t.unmount();
});

describe("touch e padrões do app", () => {
  const fonte = (f: string) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf-8");

  test("nada de hover-reveal no wizard nem no seletor novo", () => {
    const wiz = fonte("components/screens/estoque/labels/MinhaMedidaWizard.tsx");
    expect(wiz).not.toMatch(/onHoverIn|onHoverOut|onMouseEnter|:hover|hovered/);
    expect(fonte("components/PrintLabels.tsx")).not.toMatch(/onHoverIn|onHoverOut|onMouseEnter|:hover|hovered/);
  });

  test("alvos de toque de 44 px ou mais nos controles novos", () => {
    const t = monta(["p1"]);
    criaMedida40x25(t);
    aperta(t, "medida-fechar");
    abreMenu(t);
    const id = JSON.parse(window.localStorage.getItem("aura_label_custom_empresa-1")!).medidas[0].id;
    ["etiquetas-medida-editar-" + id, "etiquetas-medida-apagar-" + id, "etiquetas-minha-medida"].forEach((tid) => {
      const st = StyleSheet.flatten(acha(t, tid)[0].props.style);
      expect(Math.max(Number(st.minHeight) || 0, Number(st.height) || 0)).toBeGreaterThanOrEqual(44);
    });
    aperta(t, "etiquetas-medida-editar-" + id);
    ["medida-atalho-40x25", "medida-colunas-2", "medida-usar-padrao", "medida-x", "medida-continuar"].forEach((tid) => {
      const st = StyleSheet.flatten(acha(t, tid)[0].props.style);
      expect(Math.max(Number(st.minHeight) || 0, Number(st.height) || 0)).toBeGreaterThanOrEqual(44);
    });
    aperta(t, "medida-continuar");
    aperta(t, "medida-ja-imprimi");
    aperta(t, "medida-ajuste-fino");
    ["medida-dir-cima", "medida-fino-x-mais", "medida-imprimir-de-novo", "medida-voltar-padrao"].forEach((tid) => {
      const st = StyleSheet.flatten(acha(t, tid)[0].props.style);
      expect(Math.max(Number(st.minHeight) || 0, Number(st.height) || 0)).toBeGreaterThanOrEqual(44);
    });
    t.unmount();
  });
});
