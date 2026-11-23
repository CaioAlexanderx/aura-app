// ============================================================
// Caixa — fechamento: formas de pagamento antes de fechar (23/11/2026).
//
//   1. formasDePagamento: só as formas com valor, rótulos do relatório;
//      a prévia (totais_ao_vivo) e o relatório (total_* do /fechar) dão a
//      mesma lista para os mesmos números;
//   2. VendasPorForma: uma linha por forma (maior primeiro, como as barras
//      do relatório), "Total de entradas" = geral, aviso de que só o
//      dinheiro conta na gaveta, fonte do app em todo texto; sem venda,
//      mensagem gentil;
//   3. modal: o passo 1 e a revisão mostram o bloco; o bloco "Dinheiro na
//      gaveta" segue igual; abrir o fechamento busca o status de novo;
//   4. o PDF de fechamento recebe a mesma lista de formas.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "u1", name: "Dona Lúcia" }, isStaff: true, company: { id: "empresa-1", member_role: "owner" } }),
}));
jest.mock("@/services/api", () => ({ employeesApi: { list: jest.fn() } }));
const mockOpenPdf = jest.fn();
jest.mock("@/utils/cashClosePdf", () => ({ openCashClosePdf: (...a: any[]) => mockOpenPdf(...a) }));

const mockFechar = jest.fn();
jest.mock("@/services/caixaApi", () => ({
  caixaApi: {
    abrir: jest.fn(), fechar: (...a: any[]) => mockFechar(...a),
    movimentos: { list: jest.fn(), registrar: jest.fn(), remover: jest.fn() },
  },
}));

const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { Fonts } from "@/constants/fonts";
import { OpenCloseCashModal } from "@/components/screens/pdv/OpenCloseCashModal";
import { VendasPorForma } from "@/components/screens/pdv/VendasPorForma";
import { formasDePagamento, formasDoFechamento, ordemDoRelatorio } from "@/utils/formasDoFechamento";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function estiloPlano(style: any): any {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(estiloPlano));
  return style || {};
}

const TOTAIS = { pix: 480.5, cartao_debito: 120, cartao_credito: 990, dinheiro: 250, fiado: 0, outros: 35, geral: 1875.5 };

const SESSAO = {
  id: "sessao-1", opened_at: "2026-11-23T11:02:00Z", troco_inicial: 100,
  opened_by: { id: "u1", name: "Dona Lúcia" },
  totais_ao_vivo: TOTAIS,
};

beforeEach(() => {
  mockInvalidate.mockReset(); mockFechar.mockReset(); mockOpenPdf.mockReset();
});

describe("formasDePagamento", () => {
  test("só as formas com valor, com os rótulos do relatório", () => {
    expect(formasDePagamento(TOTAIS)).toEqual([
      { label: "Pix", amount: 480.5 },
      { label: "Crédito", amount: 990 },
      { label: "Débito", amount: 120 },
      { label: "Dinheiro", amount: 250 },
      { label: "Outros", amount: 35 },
    ]);
    expect(formasDePagamento({ fiado: "80.00", pix: "-10" })).toEqual([{ label: "Fiado", amount: 80 }]);
    expect(formasDePagamento(null)).toEqual([]);
  });

  test("prévia e relatório dão a mesma lista para os mesmos números", () => {
    const snapshot = {
      total_pix: "480.50", total_cartao_debito: "120.00", total_cartao_credito: "990.00",
      total_dinheiro: "250.00", total_fiado: "0.00", total_outros: "35.00",
    };
    expect(formasDoFechamento(snapshot)).toEqual(formasDePagamento(TOTAIS));
  });

  test("ordem do relatório: do maior para o menor, empate na ordem de sempre", () => {
    expect(ordemDoRelatorio(formasDePagamento({ pix: 10, cartao_credito: 30, dinheiro: 10 })).map((f) => f.label))
      .toEqual(["Crédito", "Pix", "Dinheiro"]);
  });
});

describe("VendasPorForma", () => {
  test("uma linha por forma, total de entradas e o aviso da gaveta, com a fonte do app", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<VendasPorForma totais={TOTAIS} />); });
    expect(flattenText(porTestID(tree, "caixa-formas-Crédito")[0].children)).toBe("CréditoR$ 990,00");
    expect(flattenText(porTestID(tree, "caixa-formas-Pix")[0].children)).toBe("PixR$ 480,50");
    expect(flattenText(porTestID(tree, "caixa-formas-Dinheiro")[0].children)).toBe("DinheiroR$ 250,00");
    expect(porTestID(tree, "caixa-formas-Fiado")).toHaveLength(0);
    expect(flattenText(porTestID(tree, "caixa-formas-total")[0].children)).toBe("Total de entradasR$ 1875,50");

    const bloco = flattenText(porTestID(tree, "caixa-formas")[0].children);
    expect(bloco.indexOf("Crédito")).toBeLessThan(bloco.indexOf("Pix"));
    expect(bloco).toContain("Vendas por forma de pagamento");
    expect(bloco).toContain("Só o dinheiro entra na conta da gaveta.");

    const textos = tree.root.findAllByType(Text);
    textos.forEach((t) => expect(estiloPlano(t.props.style).fontFamily).toBe(Fonts.body));
    expect(textos.length).toBeGreaterThan(5);
    tree.unmount();
  });

  test("sem venda: mensagem gentil e nenhum total", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<VendasPorForma totais={{ pix: 0, dinheiro: 0, geral: 0 }} />); });
    expect(flattenText(porTestID(tree, "caixa-formas-vazio")[0].children)).toBe("Ainda não há vendas nesta sessão.");
    expect(porTestID(tree, "caixa-formas-total")).toHaveLength(0);
    tree.unmount();
  });
});

function montar() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <OpenCloseCashModal visible companyId="empresa-1" companyName="Doce Encanto" companyCnpj={null}
        sessaoAtiva={SESSAO as any} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
  });
  return tree;
}

describe("OpenCloseCashModal", () => {
  test("passo 1: o bloco das formas aparece e a gaveta segue igual", () => {
    const tree = montar();
    expect(porTestID(tree, "caixa-formas")).toHaveLength(1);
    expect(flattenText(porTestID(tree, "caixa-formas-total")[0].children)).toBe("Total de entradasR$ 1875,50");
    // A gaveta: troco 100 + dinheiro 250.
    expect(flattenText(porTestID(tree, "caixa-esperado")[0].children)).toBe("R$ 350,00");
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["caixa-status"] });
    tree.unmount();
  });

  test("revisão: o bloco aparece no resumo da conferência", () => {
    const tree = montar();
    const input = tree.root.findAll((n) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
    act(() => { input.props.onChangeText("350,00"); });
    const avancar = () => tree.root.findAll((n) => typeof n.props?.onPress === "function" && flattenText(n.children).includes("Avancar"), { deep: false });
    act(() => { avancar()[0].props.onPress(); });
    act(() => { avancar()[0].props.onPress(); });
    expect(porTestID(tree, "caixa-formas-revisar")).toHaveLength(1);
    expect(flattenText(porTestID(tree, "caixa-formas-revisar-Pix")[0].children)).toBe("PixR$ 480,50");
    tree.unmount();
  });

  test("o PDF de fechamento recebe a mesma lista de formas", async () => {
    mockFechar.mockResolvedValue({
      fechamento: {
        id: "f1", sessao_id: "sessao-1", closed_at: "2026-11-23T21:00:00Z", sessao_label: "#ABCDE",
        dinheiro_esperado: "350.00", dinheiro_contado: "350.00", diferenca: "0.00",
        total_pix: "480.50", total_cartao_debito: "120.00", total_cartao_credito: "990.00",
        total_fiado: "0.00", total_dinheiro: "250.00", total_outros: "35.00", total_geral: "1875.50",
        observacao: null, sales_count: 9, new_customers_count: 1, total_vendas: 1875.5,
      },
    });
    const tree = montar();
    const input = tree.root.findAll((n) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
    act(() => { input.props.onChangeText("350,00"); });
    const botao = (txt: string) => tree.root.findAll((n) => typeof n.props?.onPress === "function" && flattenText(n.children).includes(txt), { deep: false });
    act(() => { botao("Avancar")[0].props.onPress(); });
    act(() => { botao("Avancar")[0].props.onPress(); });
    await act(async () => { botao("Fechar caixa")[0].props.onPress(); });
    act(() => { botao("Baixar PDF de fechamento")[0].props.onPress(); });
    expect(mockOpenPdf).toHaveBeenCalledTimes(1);
    expect(mockOpenPdf.mock.calls[0][0].paymentMix).toEqual(formasDePagamento(TOTAIS));
    tree.unmount();
  });
});
