// ============================================================
// AURA. — C2: wizard de migração de categorias (F0)
//
// O que estes testes provam:
//   1. O `kind` enviado ao backend é do enum REAL
//      (category|brand|attribute|collection|discard). O B3 tipava
//      existing|new|ignore, que a rota rejeita com 400 — se alguém
//      reintroduzir aqueles valores, estes testes quebram.
//   2. `target_path` é obrigatório quando kind === 'category' e ausente
//      nos demais — o apply resolve o caminho, nunca cria.
//   3. O item vai como `status: 'approved'`; sem isso o apply o ignora.
//   4. A linha órfã aparece SEPARADA e não é classificável — esconder
//      faria o lojista achar que o catálogo está coberto.
//   5. Aplicar fica bloqueado enquanto não houver item aprovado.
//   6. Nada aqui infere `kind` nem propõe `target_path` — a fase é sem IA.
//
// Mesmo padrão do teste do B3: react-native e o hook mockados, sem
// QueryClient, auth store ou rede.
// ============================================================
import TestRenderer, { act } from "react-test-renderer";
import React from "react";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
}));

jest.mock("@/constants/colors", () => ({
  useColors: () => ({
    bg: "#060816", bg3: "#0e1228", ink: "#f0edff", ink3: "#aaa", border: "#222",
  }),
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

jest.mock("@/hooks/useCategoryMigration", () => ({ useCategoryMigration: jest.fn() }));

import MigracaoCategoriasScreen from "@/app/catalogo/migracao";
import { useCategoryMigration } from "@/hooks/useCategoryMigration";

const mockedHook = useCategoryMigration as jest.Mock;

const ITEM_SANDALIA = {
  id: "item-1",
  raw_value: "Sandalia Feminina",
  product_count: 42,
  sample_product_names: ["Sandália Rasteira Bege", "Sandália Salto Fino"],
  status: "pending" as const,
};

const ORFA = {
  id: "item-orfa",
  raw_value: "",
  product_count: 7,
  sample_product_names: [],
  status: "pending" as const,
};

function montar(over: Record<string, any> = {}) {
  const patchItem = jest.fn();
  const analyze = jest.fn();
  const apply = jest.fn();

  mockedHook.mockReturnValue({
    proposal: [ITEM_SANDALIA],
    orphan: null,
    isLoadingProposal: false,
    status: { state: "ready", total: 1, approved: 0, applied: 0, orphans: 7 },
    analyze, isAnalyzing: false,
    patchItem, apply, isApplying: false,
    ...over,
  });

  let tree: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<MigracaoCategoriasScreen />); });
  return { tree: tree!, patchItem, analyze, apply };
}

// Extrai o texto renderizado de uma instância, andando na árvore.
// JSON.stringify nos props.children bate em referência circular (FiberNode).
function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  // Junta SEM separador: o React quebra `{n} produto{s}` em nós
  // separados ("42", " produto", "s") e um join com espaço produziria
  // "42  produto s".
  if (Array.isArray(node)) return node.map(textoDe).join("");
  if (node.children) return textoDe(node.children);
  return "";
}

// Acha um Pressable pelo texto que ele contém.
function pressableComTexto(tree: TestRenderer.ReactTestRenderer, texto: string) {
  const achado = tree.root
    .findAll((n) => n.type === "Pressable")
    .find((n) => textoDe(n).includes(texto));
  if (!achado) throw new Error(`Pressable com texto "${texto}" nao encontrado`);
  return achado;
}

function textoDaTela(tree: TestRenderer.ReactTestRenderer) {
  return textoDe(tree.root);
}

describe("C2 — wizard de migração", () => {
  beforeEach(() => jest.clearAllMocks());

  test("envia o kind do enum REAL do backend, não existing/new/ignore", () => {
    const { tree, patchItem } = montar();

    act(() => { pressableComTexto(tree, "É marca").props.onPress(); });
    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });

    expect(patchItem).toHaveBeenCalledTimes(1);
    const [itemId, body] = patchItem.mock.calls[0];
    expect(itemId).toBe("item-1");
    expect(body.kind).toBe("brand");
    // A regressão que estes testes existem para impedir.
    expect(["existing", "new", "ignore"]).not.toContain(body.kind);
  });

  test("kind='category' exige target_path e o envia", () => {
    const { tree, patchItem } = montar();

    act(() => { pressableComTexto(tree, "É categoria").props.onPress(); });

    // Sem caminho preenchido, confirmar não dispara escrita.
    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });
    expect(patchItem).not.toHaveBeenCalled();

    const input = tree.root.findAllByType("TextInput" as any)[0];
    act(() => { input.props.onChangeText("Feminino > Calçados > Sandálias"); });
    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });

    expect(patchItem).toHaveBeenCalledTimes(1);
    const [, body] = patchItem.mock.calls[0];
    expect(body.kind).toBe("category");
    expect(body.target_path).toBe("Feminino > Calçados > Sandálias");
  });

  test("kind não-categoria não manda target_path", () => {
    const { tree, patchItem } = montar();

    act(() => { pressableComTexto(tree, "Descartar").props.onPress(); });
    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });

    const [, body] = patchItem.mock.calls[0];
    expect(body.kind).toBe("discard");
    expect(body).not.toHaveProperty("target_path");
  });

  test("manda status 'approved' — sem isso o apply ignora o item", () => {
    const { tree, patchItem } = montar();

    act(() => { pressableComTexto(tree, "É atributo").props.onPress(); });
    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });

    expect(patchItem.mock.calls[0][1].status).toBe("approved");
  });

  test("não infere nada: sem escolha do lojista, nenhuma escrita sai", () => {
    const { tree, patchItem } = montar();

    act(() => { pressableComTexto(tree, "Confirmar este").props.onPress(); });

    expect(patchItem).not.toHaveBeenCalled();
  });

  test("linha órfã aparece separada e sem opção de classificar", () => {
    const { tree } = montar({ orphan: ORFA });
    const txt = textoDaTela(tree);

    expect(txt).toContain("Produtos sem categoria nenhuma");
    expect(txt).toContain("7 produtos");
    // Só o item classificável tem o botão; a órfã não ganha um segundo.
    const confirmares = tree.root
      .findAll((n) => n.type === "Pressable")
      .filter((n) => textoDe(n).includes("Confirmar este"));
    expect(confirmares).toHaveLength(1);
  });

  test("aplicar fica bloqueado enquanto não há item aprovado", () => {
    const { tree, apply } = montar();

    // O RN nao dispara onPress num Pressable desabilitado; chamar o
    // handler na mao testaria o mock, nao a tela. A garantia real e o
    // proprio `disabled`.
    const botao = pressableComTexto(tree, "Aplicar migração");
    expect(botao.props.disabled).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });

  test("aplicar libera quando existe item aprovado", () => {
    const { tree, apply } = montar({
      proposal: [{ ...ITEM_SANDALIA, status: "approved" }],
    });

    const botao = pressableComTexto(tree, "Aplicar migração");
    expect(botao.props.disabled).toBe(false);
    act(() => { botao.props.onPress(); });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  test("item já aplicado sai da fila de classificação", () => {
    const { tree } = montar({
      proposal: [{ ...ITEM_SANDALIA, status: "applied" }],
    });

    expect(textoDaTela(tree)).not.toContain("Sandalia Feminina");
  });

  test("mostra contagem e exemplos para o lojista reconhecer o valor", () => {
    const { tree } = montar();
    const txt = textoDaTela(tree);

    expect(txt).toContain("Sandalia Feminina");
    expect(txt).toContain("42 produtos");
    expect(txt).toContain("Sandália Rasteira Bege");
  });

  test("analisar dispara o analyze do hook", () => {
    const { tree, analyze } = montar();

    act(() => { pressableComTexto(tree, "Analisar catálogo").props.onPress(); });

    expect(analyze).toHaveBeenCalledTimes(1);
  });
});
