// ============================================================
// Ficha do crediário · Juntar carnês (10/10/2026)
//
//   - com menos de 2 marcados o botão fica desabilitado e nada é pedido;
//   - com 2, o "Como fica" vem do PREVIEW do backend (com debounce) e o
//     botão habilita com o valor da parcela que o backend devolveu;
//   - confirmar manda a Idempotency-Key, e o retry do mesmo plano repete a
//     MESMA chave; mudar o plano troca;
//   - backend antigo (404 na rota): avisa que ainda não está disponível;
//   - abrir pelo Renegociar já traz aquele carnê marcado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// Icon puxa react-native-svg, que não carrega no Jest.
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/services/creditApi", () => ({ MAX_INSTALLMENTS_CEILING: 500 }));

const mockPreview = jest.fn();
const mockApply = jest.fn();
jest.mock("@/services/creditMerge", () => ({
  mergeApi: {
    preview: (...a: any[]) => mockPreview(...a),
    apply: (...a: any[]) => mockApply(...a),
  },
}));

import { JuntarCarnesPanel, DEBOUNCE_DO_PREVIEW_MS } from "@/components/crediario/ficha/JuntarCarnesPanel";
import { derivarCarne, MSG_JUNCAO_INDISPONIVEL } from "@/utils/crediarioCarne";

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const apertar = (t: renderer.ReactTestRenderer, id: string) => act(() => { porId(t, id)[0].props.onPress(); });
const botao = (t: renderer.ReactTestRenderer) => porId(t, "juntar-confirmar")[0];

const parc = (id: string, account_id: string, due_date: string) => ({ id, account_id, due_date, amount_due: 70, covered_amount: 0 });
const CARNES = [
  derivarCarne({ id: "c1", name: "Compra de 13/09", balance: 140, remaining: 140, total_count: 4, paid_count: 2,
    purchases: [{ description: "Vans Hylane 40/41", quantity: 1, amount: 120 }, { description: "Slide Alta 40/41", quantity: 2, amount: 160 }] },
    [parc("a", "c1", "2026-11-10"), parc("b", "c1", "2026-12-10")]),
  derivarCarne({ id: "c2", name: "Compra de 14/09", balance: 180, remaining: 180, total_count: 4, paid_count: 1,
    purchases: [{ description: "Sapatênis Boss 40/41", quantity: 1, amount: 240 }] },
    [parc("c", "c2", "2026-11-05"), parc("d", "c2", "2026-12-05"), parc("e", "c2", "2027-01-05")]),
  derivarCarne({ id: null, name: "Conta geral", balance: 85, remaining: 85, total_count: 0, paid_count: 0, purchases: [] }, []),
];

const PLANO = {
  name: "Carnê de 10/10",
  origins: [],
  open_remaining: 320, target_total: 320, delta: 0, installments_count: 3,
  schedule: [
    { number: 1, amount_due: 106.66, due_date: "2026-11-10" },
    { number: 2, amount_due: 106.66, due_date: "2026-12-10" },
    { number: 3, amount_due: 106.68, due_date: "2027-01-10" },
  ],
};

function montar(props: Record<string, any> = {}) {
  const all = {
    companyId: "emp", customerId: "cli", customerName: "Alexander Olivier",
    carnes: CARNES, preselecionados: [] as string[],
    onBack: jest.fn(), onClose: jest.fn(), onDone: jest.fn(),
    ...props,
  };
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<JuntarCarnesPanel {...(all as any)} />); });
  return { t, props: all };
}

/** Passa o debounce e deixa a promise do preview/apply resolver. */
async function assentar() {
  await act(async () => { jest.advanceTimersByTime(DEBOUNCE_DO_PREVIEW_MS + 10); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("JuntarCarnesPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPreview.mockReset().mockResolvedValue(PLANO);
    mockApply.mockReset().mockResolvedValue({ ...PLANO, account: { id: "novo", name: "Carnê de 10/10" }, adjustment: null, new_balance: 405 });
  });
  afterEach(() => { jest.useRealTimers(); });

  it("lista os carnês com produtos e quanto falta, inclusive Compras anteriores", async () => {
    const { t } = montar();
    const txt = texto(t.toJSON());
    expect(txt).toContain("Compra de 13/09");
    expect(txt).toContain("2× Slide Alta 40/41");
    expect(txt).toContain("R$ 140,00");
    expect(txt).toContain("Compras anteriores");
    expect(porId(t, "juntar-carne-general")).toHaveLength(1);
  });

  it("menos de 2 marcados: botão desabilitado e nenhum pedido ao backend", async () => {
    const { t } = montar();
    await assentar();
    expect(botao(t).props.disabled).toBe(true);
    expect(texto(t.toJSON())).toContain("Marque pelo menos 2 carnês");
    expect(texto(t.toJSON())).toContain("use o Renegociar dele");
    apertar(t, "juntar-carne-c1");
    await assentar();
    expect(botao(t).props.disabled).toBe(true);
    expect(mockPreview).not.toHaveBeenCalled();
    expect(porId(t, "juntar-como-fica")).toHaveLength(0);
  });

  it("2 marcados: cronograma do preview do backend e botão habilitado com o valor dele", async () => {
    const { t } = montar();
    apertar(t, "juntar-carne-c1");
    apertar(t, "juntar-carne-c2");
    // Antes do debounce nada foi pedido e o botão segue travado.
    expect(mockPreview).not.toHaveBeenCalled();
    expect(botao(t).props.disabled).toBe(true);
    await assentar();

    expect(mockPreview).toHaveBeenCalledTimes(1);
    const [emp, cli, opts] = mockPreview.mock.calls[0];
    expect([emp, cli]).toEqual(["emp", "cli"]);
    expect(opts.account_ids).toEqual(["c1", "c2"]);
    expect(opts.installments).toBe(3); // maior nº de parcelas a pagar entre os carnês
    expect(opts.period_unit).toBe("month");
    expect(opts.total).toBeUndefined();
    expect(opts.first_due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const txt = texto(t.toJSON());
    expect(txt).toContain("Parcela 1/3 · 10/11/2026");
    expect(txt).toContain("R$ 106,68"); // a última, com os centavos do backend
    expect(txt).toContain("Juntar 2 carnês em 3× de R$ 106,66");
    expect(txt).toContain("Os 2 carnês viram um só, com 3 produtos");
    expect(botao(t).props.disabled).toBe(false);
  });

  it("mudar as parcelas ou o intervalo pede o preview de novo", async () => {
    const { t } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    apertar(t, "juntar-mais");
    await assentar();
    expect(mockPreview.mock.calls[1][2].installments).toBe(4);
    apertar(t, "juntar-intervalo-quinzenal");
    await assentar();
    expect(mockPreview.mock.calls[2][2]).toMatchObject({ period_unit: "week", period_count: 2 });
  });

  it("ajustar o total manda total no preview", async () => {
    const { t } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    apertar(t, "juntar-ajustar-total");
    act(() => { porId(t, "juntar-total-input")[0].props.onChangeText("300,00"); });
    mockPreview.mockResolvedValue({ ...PLANO, target_total: 300, delta: -20 });
    await assentar();
    expect(mockPreview.mock.calls[mockPreview.mock.calls.length - 1][2].total).toBe(300);
    expect(texto(t.toJSON())).toContain("Desconto no saldo");
  });

  it("confirmar junta com Idempotency-Key e devolve o carnê novo ao shell", async () => {
    const { t, props } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    await act(async () => { botao(t).props.onPress(); });
    await assentar();
    expect(mockApply).toHaveBeenCalledTimes(1);
    const [, , opts, chave] = mockApply.mock.calls[0];
    expect(opts.account_ids).toEqual(["c1", "c2"]);
    expect(chave).toMatch(/^merge-emp-cli-/);
    expect(props.onDone).toHaveBeenCalledWith(expect.objectContaining({ account: { id: "novo", name: "Carnê de 10/10" } }));
  });

  it("retry do mesmo plano repete a MESMA chave; mudar o plano troca", async () => {
    mockApply.mockRejectedValueOnce({ status: 0, isNetworkError: true });
    const { t, props } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    await act(async () => { botao(t).props.onPress(); });
    await assentar();
    expect(texto(t.toJSON())).toContain("Sem conexão");
    expect(props.onDone).not.toHaveBeenCalled();

    mockApply.mockRejectedValueOnce({ status: 500, message: "falhou" });
    await act(async () => { botao(t).props.onPress(); });
    await assentar();
    expect(mockApply.mock.calls[1][3]).toBe(mockApply.mock.calls[0][3]);

    apertar(t, "juntar-mais");
    await assentar();
    await act(async () => { botao(t).props.onPress(); });
    await assentar();
    expect(mockApply.mock.calls[2][3]).not.toBe(mockApply.mock.calls[0][3]);
  });

  it("backend antigo (404 na rota): avisa que ainda não está disponível e não habilita", async () => {
    mockPreview.mockRejectedValue({ status: 404, data: { error: "Not found" } });
    const { t } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    expect(porId(t, "juntar-erro")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain(MSG_JUNCAO_INDISPONIVEL);
    expect(botao(t).props.disabled).toBe(true);
  });

  it("erro de regra do backend aparece em português", async () => {
    mockPreview.mockRejectedValue({ status: 409, data: { code: "CREDIT_ACCOUNT_CLOSED", error: "closed" } });
    const { t } = montar({ preselecionados: ["c1", "c2"] });
    await assentar();
    expect(texto(t.toJSON())).toContain("já foi quitado ou encerrado");
  });

  it("vindo do Renegociar, o carnê de origem já vem marcado", async () => {
    const { t } = montar({ preselecionados: ["c2"] });
    expect(porId(t, "juntar-carne-c2")[0].props.accessibilityState).toEqual({ checked: true });
    expect(porId(t, "juntar-carne-c1")[0].props.accessibilityState).toEqual({ checked: false });
  });

  it("com exatamente dois carnês, os dois já vêm marcados", async () => {
    const { t } = montar({ carnes: CARNES.slice(0, 2) });
    await assentar();
    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(botao(t).props.disabled).toBe(false);
  });
});
