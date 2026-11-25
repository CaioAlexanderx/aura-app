// ============================================================
// Renegociar e Mudar a data sem data no passado por engano (24/11/2026)
//
// Caso real (20–23/11/2026): a renegociação sugeria a 1ª parcela no
// vencimento aberto mais antigo, já passado, e a lojista esqueceu o ano ao
// trocar o mês. Cobre, com a ficha renderizada:
//   - Renegociar abre com data hoje ou à frente; data no passado mostra o
//     texto em vermelho e desabilita "Mudar as parcelas"; "Confira o ano"
//     preenche; o 422 FIRST_DUE_DATE_PAST mostra o mesmo texto;
//   - Mudar a data só avisa (âmbar) e oferece o ano certo;
//   - parcela "a conferir" na linha do carnê: texto e link Mudar a data.
// Mocks como em crediarioFichaTela.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { todaySP } from "@/utils/creditOverdue";
import { formatIsoToBr } from "@/components/inputs/DateInput";
import {
  TEXTO_RENEGOCIAR_DATA_PASSADA, TEXTO_MUDAR_DATA_PASSADA, TEXTO_PARCELA_A_CONFERIR,
  sugestaoDaPrimeiraParcela, conferenciaDoAno, textoConfiraOAno,
} from "@/utils/crediarioDatas";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  const Modal = ({ visible, children, ...rest }: any) => (visible ? R.createElement("View", rest, children) : null);
  return { ...RN, Modal };
});
jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/hooks/useNfseAutomatica", () => ({ useNfseAutomaticaConfig: () => ({ ativa: false }) }));
jest.mock("@/components/nfse/NfseDaOrigem", () => ({ NfseDaOrigem: () => null }));
jest.mock("@/components/crediario/DevolucaoModal", () => ({ DevolucaoModal: () => null }));
jest.mock("@/components/crediario/ficha/EditarClienteDaFicha", () => ({ EditarClienteDaFicha: () => null }));
jest.mock("@/components/crediario/ficha/EditarPagamentoModal", () => ({ EditarPagamentoModal: () => null }));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));
jest.mock("@/components/anim", () => {
  const R = jest.requireActual("react");
  return {
    ModalPop: ({ children }: any) => R.createElement(R.Fragment, null, children),
    Collapsible: ({ open, children }: any) => (open ? R.createElement(R.Fragment, null, children) : null),
  };
});

// Datas relativas ao hoje de verdade (SP): o teste vale em qualquer dia.
const HOJE = todaySP();
function dias(n: number): string {
  const d = new Date(HOJE + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Bem mais de 60 dias atrás, e o mesmo dia no ano seguinte à frente.
const ESQUECIDO = dias(-200);
const ESQUECIDO_CERTO = conferenciaDoAno(ESQUECIDO, HOJE) as string;

const CARNE = {
  id: "k1", name: "Compra de 19/10", status: "open", balance: 100, open_count: 1,
  next_due_date: dias(-1), overdue: false, period_unit: "month", period_count: 1,
  purchases: [], purchases_total: 100, total_amount: 100, refunded_total: 0, total_count: 1, paid_count: 0,
  paid_installments: [], open_remaining: 100, unscheduled: 0, remaining: 100,
};
const PARCELA = {
  id: "p1", customer_id: "c1", company_id: "loja1", installment_number: 1, total_installments: 1,
  amount_due: 100, amount_paid: 0, covered_amount: 0, due_date: dias(-1), status: "pending",
  account_id: "k1", is_overdue: false, needs_review: true, created_at: HOJE,
};
const mockDetalhe = {
  customer: { id: "c1", name: "Maria Aparecida Souza", phone: "12991234567" },
  balance: 100, accounts: [CARNE], open_installments: [PARCELA], transactions: [],
};
const mockPerfil = {
  credit_score: 640, score_label: "regular", credit_limit: 1000, credit_used: 100,
  available_limit: 900, status: "active", terms: { effective: { max_installments: 6, interest_rate: 0.01 } },
};
const mockApply = jest.fn();
jest.mock("@/services/creditApi", () => ({
  MAX_INSTALLMENTS_CEILING: 500,
  printReceipt: jest.fn(),
  printCarne: jest.fn(),
  valorAPagarParcela: () => 0,
  creditApi: {
    getCustomerProfile: jest.fn(() => Promise.resolve(mockPerfil)),
    getCustomerHistory: jest.fn(() => Promise.resolve(mockDetalhe)),
    getHistoryTimeline: jest.fn(() => Promise.resolve({ events: [], next_cursor: null })),
    previewPayment: jest.fn(() => Promise.resolve(null)),
    editInstallmentDueDate: jest.fn(() => Promise.resolve({})),
  },
}));
jest.mock("@/services/creditReschedule", () => ({ rescheduleApi: { apply: (...a: any[]) => mockApply(...a) } }));

import { ClienteCrediarioModal } from "@/components/crediario/ClienteCrediarioModal";

const porId = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }, { deep: false } as any);
// O DateInput (composto) recebe o testID e o onChangeText da tela.
const campo = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n: any) => n.props?.testID === testID && typeof n.props.onChangeText === "function" && "value" in n.props)[0];
const textoDe = (tree: renderer.ReactTestRenderer, testID: string) => {
  const n = porId(tree, testID)[0];
  if (!n) return null;
  const c = n.props.children;
  return Array.isArray(c) ? c.join("") : c;
};

async function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={qc}>
        <ClienteCrediarioModal visible casca="tela" layout="larga" companyId="loja1" customerId="c1" onClose={jest.fn()} />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return tree;
}

async function abrirRenegociar(tree: renderer.ReactTestRenderer) {
  act(() => { porId(tree, "carne-k1-mais")[0].props.onPress(); });
  act(() => { porId(tree, "carne-k1-renegociar")[0].props.onPress(); });
}

describe("Renegociar: 1ª parcela nunca no passado", () => {
  beforeEach(() => mockApply.mockReset());

  test("abre com a data hoje ou à frente (a mais antiga, de ontem, já passou)", async () => {
    const tree = await montar();
    await abrirRenegociar(tree);
    const valor: string = campo(tree, "reneg-primeira-parcela").props.value;
    const iso = valor.split("/").reverse().join("-");
    expect(iso >= HOJE).toBe(true);
    expect(iso).toBe(sugestaoDaPrimeiraParcela(dias(-1), HOJE));
    expect(porId(tree, "reneg-primeira-parcela-aviso")).toHaveLength(0);
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(false);
  });

  test("data no passado: texto em vermelho e 'Mudar as parcelas' desabilitado; hoje passa", async () => {
    const tree = await montar();
    await abrirRenegociar(tree);
    act(() => { campo(tree, "reneg-primeira-parcela").props.onChangeText(formatIsoToBr(dias(-1))); });
    expect(textoDe(tree, "reneg-primeira-parcela-aviso")).toBe(TEXTO_RENEGOCIAR_DATA_PASSADA);
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(true);
    await act(async () => { await porId(tree, "reneg-confirmar")[0].props.onPress(); });
    expect(mockApply).not.toHaveBeenCalled();

    act(() => { campo(tree, "reneg-primeira-parcela").props.onChangeText(formatIsoToBr(HOJE)); });
    expect(porId(tree, "reneg-primeira-parcela-aviso")).toHaveLength(0);
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(false);
  });

  test("ano esquecido: 'Confira o ano' preenche a data certa", async () => {
    const tree = await montar();
    await abrirRenegociar(tree);
    act(() => { campo(tree, "reneg-primeira-parcela").props.onChangeText(formatIsoToBr(ESQUECIDO)); });
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(true);
    expect(ESQUECIDO_CERTO >= HOJE).toBe(true);
    const atalho = porId(tree, "reneg-primeira-parcela-ano")[0];
    expect(atalho.findAll((n: any) => n.props?.children === textoConfiraOAno(formatIsoToBr(ESQUECIDO_CERTO))).length).toBeGreaterThan(0);
    act(() => { atalho.props.onPress(); });
    expect(campo(tree, "reneg-primeira-parcela").props.value).toBe(formatIsoToBr(ESQUECIDO_CERTO));
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(false);
  });

  test("422 FIRST_DUE_DATE_PAST do backend: o mesmo texto, até mudar a data", async () => {
    mockApply.mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 422, data: { error: "First due date is in the past", code: "FIRST_DUE_DATE_PAST" },
    }));
    const tree = await montar();
    await abrirRenegociar(tree);
    act(() => { campo(tree, "reneg-primeira-parcela").props.onChangeText(formatIsoToBr(HOJE)); });
    await act(async () => { await porId(tree, "reneg-confirmar")[0].props.onPress(); });
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply.mock.calls[0][3].first_due_date).toBe(HOJE);
    expect(textoDe(tree, "reneg-primeira-parcela-aviso")).toBe(TEXTO_RENEGOCIAR_DATA_PASSADA);
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(true);
    const { toast } = jest.requireMock("@/components/Toast");
    expect(toast.error).toHaveBeenCalledWith(TEXTO_RENEGOCIAR_DATA_PASSADA);

    act(() => { campo(tree, "reneg-primeira-parcela").props.onChangeText(formatIsoToBr(dias(1))); });
    expect(porId(tree, "reneg-primeira-parcela-aviso")).toHaveLength(0);
    expect(porId(tree, "reneg-confirmar")[0].props.disabled).toBe(false);
  });
});

describe("parcela a conferir e Mudar a data", () => {
  test("a linha explica e o link abre o Mudar a data dessa parcela", async () => {
    const tree = await montar();
    expect(tree.root.findAll((n: any) => n.props?.children === TEXTO_PARCELA_A_CONFERIR, { deep: false } as any).length).toBeGreaterThan(0);
    const link = tree.root.findAll((n: any) => typeof n.props?.testID === "string" && n.props.testID.endsWith("-conferir-data") && n.props.onPress, { deep: false } as any)[0];
    expect(link).toBeTruthy();
    act(() => { link.props.onPress(); });
    // abre com a data da parcela (ontem): passado, só aviso em âmbar
    expect(campo(tree, "mudar-data-campo").props.value).toBe(formatIsoToBr(dias(-1)));
    expect(textoDe(tree, "mudar-data-campo-aviso")).toBe(TEXTO_MUDAR_DATA_PASSADA);
    expect(porId(tree, "mudar-data-campo-ano")).toHaveLength(0);
  });

  test("Mudar a data: ano esquecido mostra só o atalho, que preenche", async () => {
    const tree = await montar();
    const link = tree.root.findAll((n: any) => typeof n.props?.testID === "string" && n.props.testID.endsWith("-conferir-data") && n.props.onPress, { deep: false } as any)[0];
    act(() => { link.props.onPress(); });
    act(() => { campo(tree, "mudar-data-campo").props.onChangeText(formatIsoToBr(ESQUECIDO)); });
    expect(porId(tree, "mudar-data-campo-aviso")).toHaveLength(0);
    act(() => { porId(tree, "mudar-data-campo-ano")[0].props.onPress(); });
    expect(campo(tree, "mudar-data-campo").props.value).toBe(formatIsoToBr(ESQUECIDO_CERTO));
    expect(porId(tree, "mudar-data-campo-aviso")).toHaveLength(0);
    // data à frente: nada
    act(() => { campo(tree, "mudar-data-campo").props.onChangeText(formatIsoToBr(dias(10))); });
    expect(porId(tree, "mudar-data-campo-aviso")).toHaveLength(0);
  });
});
