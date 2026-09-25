// ============================================================
// Etiquetas — menu "Modelo" aberto por baixo da barra de busca (25/09/2026).
//
// No web o RNW dá a cada View o seu próprio z-index: 0. O zIndex 30 do
// menu de modelo só valia dentro do cabeçalho; a busca e o "Selecionar
// todos" (fundo translúcido), que vêm depois, eram pintados por cima da
// lista aberta e a segunda opção ficava ilegível.
//
// Trava: o cabeçalho que contém o menu fica ACIMA dos blocos seguintes, e
// o menu aberto lista todos os modelos.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "empresa-1", name: "Loja" }, token: "t" }) }));
jest.mock("@/services/api", () => ({ companiesApi: {}, pdvSettingsApi: { get: jest.fn(() => Promise.resolve({})), save: jest.fn(() => Promise.resolve({})) } }));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, error: null, invalidate: jest.fn() }) }));
jest.mock("@/services/instalarApp", () => ({ ehIphoneInstalado: () => false }));
jest.mock("@/components/ImpressaoNoIphone", () => ({ avisarImpressaoNoIphone: jest.fn() }));

import { PrintLabels } from "@/components/PrintLabels";
import { LABEL_SIZE_KEYS, LABEL_SIZE_PRESETS } from "@/components/screens/estoque/labels/buildLabelHtml";

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

test("menu de modelo aberto fica acima da busca e do 'Selecionar todos'", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={[]} selectedIds={[]} onSelectionChange={() => {}} />); });

  const cabecalho = t.root.findAll((n) => n.props && n.props.testID === "etiquetas-cabecalho", { deep: false })[0];
  expect(cabecalho).toBeTruthy();
  const zCabecalho = Number(StyleSheet.flatten(cabecalho.props.style).zIndex) || 0;

  // Blocos que vêm DEPOIS do cabeçalho no mesmo container (loja, busca, lista).
  const container = cabecalho.parent!;
  const irmaos = container.children.filter((c: any) => typeof c !== "string" && c !== cabecalho) as renderer.ReactTestInstance[];
  expect(irmaos.length).toBeGreaterThan(0);
  irmaos.forEach((irmao) => {
    const z = Number(StyleSheet.flatten(irmao.props.style || {}).zIndex) || 0;
    expect(zCabecalho).toBeGreaterThan(z);
  });

  const botao = t.root.findAll((n) => n.props && typeof n.props.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Modelo de etiqueta:"), { deep: false })[0];
  act(() => { botao.props.onPress(); });
  const texto = flatten(t.toJSON());
  LABEL_SIZE_KEYS.forEach((k) => expect(texto).toContain(LABEL_SIZE_PRESETS[k].uiLabel));

  t.unmount();
});

// ── Filtros (25/09/2026) ─────────────────────────────────────
const hoje = new Date().toISOString();
const PRODUTOS: any[] = [
  { id: "p1", name: "Blusa nova", code: "001", barcode: "", category: "Blusas", price: 50, stock: 2, unit: "un", created_at: hoje },
  { id: "p2", name: "Calça antiga", code: "002", barcode: "", category: "Calças", price: 90, stock: 0, unit: "un", created_at: "2025-01-10T12:00:00Z" },
  { id: "p3", name: "Blusa antiga", code: "003", barcode: "", category: "Blusas", price: 40, stock: 5, unit: "un", created_at: "2025-02-10T12:00:00Z" },
];

function nomesNaLista(t: renderer.ReactTestRenderer): string[] {
  const texto = flatten(t.toJSON());
  return PRODUTOS.map((p) => p.name).filter((n) => texto.includes(n));
}
const aperta = (t: renderer.ReactTestRenderer, id: string) =>
  act(() => { t.root.findAll((n) => n.props && n.props.testID === id, { deep: false })[0].props.onPress(); });

test("'Cadastrados: Hoje' deixa só o que entrou hoje e 'Selecionar todos' marca só esses", () => {
  const onSel = jest.fn();
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={[]} onSelectionChange={onSel} />); });
  expect(nomesNaLista(t)).toEqual(["Blusa nova", "Calça antiga", "Blusa antiga"]);

  aperta(t, "etiquetas-periodo-hoje");
  expect(nomesNaLista(t)).toEqual(["Blusa nova"]);
  expect(flatten(t.toJSON())).toContain("1 de 3 produtos");
  expect(flatten(t.toJSON())).toContain("Selecionar todos (1)");

  const selTodos = t.root.findAll((n) => n.props && n.props.onPress && flatten(n.children).startsWith("Selecionar todos"), { deep: false })[0];
  act(() => { selTodos.props.onPress(); });
  expect(onSel).toHaveBeenLastCalledWith(["p1"]);

  aperta(t, "etiquetas-limpar-filtros");
  expect(nomesNaLista(t)).toHaveLength(3);
  t.unmount();
});

test("categoria e 'Só com estoque' filtram; o menu de categoria fica acima da lista", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={[]} onSelectionChange={() => {}} />); });

  aperta(t, "etiquetas-com-estoque");
  expect(nomesNaLista(t)).toEqual(["Blusa nova", "Blusa antiga"]);

  aperta(t, "etiquetas-categoria");
  const filtros = t.root.findAll((n) => n.props && n.props.testID === "etiquetas-filtros", { deep: false })[0];
  const zFiltros = Number(StyleSheet.flatten(filtros.props.style).zIndex) || 0;
  const cabecalho = t.root.findAll((n) => n.props && n.props.testID === "etiquetas-cabecalho", { deep: false })[0];
  const zCab = Number(StyleSheet.flatten(cabecalho.props.style).zIndex) || 0;
  expect(zFiltros).toBeGreaterThan(0);
  expect(zCab).toBeGreaterThan(zFiltros);

  aperta(t, "etiquetas-categoria-Calças");
  expect(nomesNaLista(t)).toEqual([]);
  t.unmount();
});

test("calendário: escolher um dia mostra só o que foi cadastrado nele; 'Todos' desfaz", () => {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<PrintLabels products={PRODUTOS} selectedIds={[]} onSelectionChange={() => {}} />); });

  // O botão de calendário fica entre "Cadastrados:" e "Todos".
  const texto0 = flatten(t.toJSON());
  expect(texto0.indexOf("Cadastrados:")).toBeLessThan(texto0.indexOf("Todos"));
  expect(t.root.findAll((n) => n.props && n.props.testID === "etiquetas-calendario", { deep: false })).toHaveLength(1);
  // Nada de <input type="date"> escondido: o calendário é o nosso.
  expect(t.root.findAll((n) => n.type === "input" && n.props.type === "date")).toHaveLength(0);

  // Fechado até tocar no ícone.
  expect(t.root.findAll((n) => n.props && n.props.testID === "etiquetas-calendario-painel", { deep: false })).toHaveLength(0);
  aperta(t, "etiquetas-calendario");

  // O react-native-calendars de verdade renderiza (JS puro, no react-native-web).
  const cal = t.root.findAll((n) => n.props && n.props.markedDates && typeof n.props.onDayPress === "function")[0];
  expect(cal).toBeTruthy();
  expect(cal.props.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // Os dias com produto cadastrado vêm marcados com ponto.
  expect(cal.props.markedDates["2025-01-10"]).toMatchObject({ marked: true });
  expect(cal.props.markedDates["2025-02-10"]).toMatchObject({ marked: true });

  act(() => { cal.props.onDayPress({ dateString: "2025-01-10" }); });
  expect(nomesNaLista(t)).toEqual(["Calça antiga"]);
  expect(flatten(t.toJSON())).toContain("10/01/2025");
  expect(flatten(t.toJSON())).toContain("1 de 3 produtos");
  // Escolher fecha o calendário.
  expect(t.root.findAll((n) => n.props && n.props.testID === "etiquetas-calendario-painel", { deep: false })).toHaveLength(0);

  // Reabrindo, o dia escolhido vem selecionado.
  aperta(t, "etiquetas-calendario");
  const cal2 = t.root.findAll((n) => n.props && n.props.markedDates && typeof n.props.onDayPress === "function")[0];
  expect(cal2.props.markedDates["2025-01-10"]).toMatchObject({ selected: true, marked: true });

  aperta(t, "etiquetas-calendario-painel-limpar");
  expect(nomesNaLista(t)).toHaveLength(3);
  expect(flatten(t.toJSON())).not.toContain("10/01/2025");

  act(() => { t.root.findAll((n) => n.props && n.props.testID === "etiquetas-calendario", { deep: false })[0].props.onPress(); });
  act(() => { t.root.findAll((n) => n.props && n.props.markedDates && typeof n.props.onDayPress === "function")[0].props.onDayPress({ dateString: "2025-02-10" }); });
  expect(nomesNaLista(t)).toEqual(["Blusa antiga"]);
  aperta(t, "etiquetas-periodo-todos");
  expect(nomesNaLista(t)).toHaveLength(3);
  t.unmount();
});
