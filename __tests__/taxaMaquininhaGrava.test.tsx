// ============================================================
// Taxa da maquininha: o que a lojista digita fica gravado (10/11/2026)
//
// Incidente: 14 lojas com a chave ligada e crédito, débito e Pix em 0%.
// Causas no app (CardFeeSection + ciclo de save do PdvSettingsCard):
//   - só gravava no blur, que não chega quando a tela some sem clique;
//   - `if (saving) return` jogava fora a mudança que chegava com outro
//     PUT no ar;
//   - depois do PUT a tela voltava ao cache velho até o GET responder, e o
//     próximo save partia dele (regravava o 0);
//   - o campo travava (editable=false) durante o save.
//
//   1. tela inteira: liga a chave, digita crédito, digita débito com o PUT
//      do crédito ainda no ar, digita o Pix e sai da tela sem blur — tudo
//      fica gravado no "servidor" (que faz merge, como o backend);
//   2. seção: grava sozinha depois da pausa, no Enter e ao desmontar;
//   3. aviso gentil com a chave ligada e tudo em 0%.
// Mocks do padrão do repo (expo-font, FpktLogo, Icon); testID + deep:false.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    () => ({ company: { id: "loja-1", vertical_active: "retail" }, token: "t", isStaff: false, isDemo: false }),
    { getState: () => ({ token: "t", company: { id: "loja-1" } }) },
  ),
}));
jest.mock("@/services/api", () => ({
  pdvSettingsApi: { get: jest.fn(), save: jest.fn() },
  companiesApi: { products: jest.fn() },
}));
jest.mock("@/components/screens/configuracoes/WarrantyTermsEditor", () => ({ WarrantyTermsEditor: () => null }));
jest.mock("@/components/screens/configuracoes/CardPriceSection", () => ({ CardPriceSection: () => null }));
jest.mock("@/components/screens/configuracoes/FrenteDaLoja", () => ({ FrenteDaLoja: () => null, nomeDaFrente: () => "" }));

import { CardFeeSection, CARD_FEE_DEBOUNCE_MS } from "@/components/screens/configuracoes/CardFeeSection";
import { PdvSettingsCard } from "@/components/screens/configuracoes/PdvSettingsCard";
import { pdvSettingsApi } from "@/services/api";

const api = pdvSettingsApi as unknown as Record<string, jest.Mock>;

jest.setTimeout(30000);

const palette = {
  label: "#000", desc: "#000", hint: "#000", trackOff: "#000", trackOn: "#000",
  thumbOff: "#000", thumbOn: "#000", inputBg: "#fff", inputBorder: "#000", inputText: "#000", boxBorder: "#000",
};

const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });

async function flush(vezes = 6) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

// "Servidor" com o mesmo contrato do backend: GET devolve o salvo; o PUT faz
// merge do corpo sobre o salvo. Cada PUT fica no ar até o teste soltar.
function servidorFalso(inicial: Record<string, any>) {
  const banco = { ...inicial };
  const noAr: Array<() => void> = [];
  api.get.mockImplementation(async () => ({ settings: { ...banco } }));
  api.save.mockImplementation((_id: string, corpo: any) => new Promise((resolve) => {
    noAr.push(() => { Object.assign(banco, corpo); resolve({ settings: { ...banco } }); });
  }));
  return {
    banco,
    async soltarTodos() {
      // Solta um PUT por vez, como a rede faria, até a fila esvaziar.
      for (let i = 0; i < 20 && noAr.length; i++) {
        const proximo = noAr.shift()!;
        await act(async () => { proximo(); });
        await flush(3);
      }
    },
    get noAr() { return noAr.length; },
  };
}

async function montarCartao() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PdvSettingsCard /></QueryClientProvider>);
  });
  await flush();
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe("Taxa da maquininha › tela inteira (PdvSettingsCard + seção real)", () => {
  it("liga a chave, digita crédito, digita débito com o PUT no ar, digita o Pix e sai da tela: tudo fica gravado", async () => {
    const srv = servidorFalso({ crediario_enabled: true, caixa_enabled: true, card_fee_enabled: false, card_fee_credit_pct: 0, card_fee_debit_pct: 0 });
    const tree = await montarCartao();
    const switchDaTaxa = () => tree.root.findAll((n: any) => n.props && typeof n.props.onValueChange === "function" && n.props.value === false)
      .find((n: any) => String(n.props.onValueChange).includes("card_fee_enabled"))!;

    // 1. liga a chave (PUT 1 no ar)
    await act(async () => { switchDaTaxa().props.onValueChange(true); });
    await flush(2);
    expect(porId(tree, "card-fee-credit")).toHaveLength(1);

    // 2. digita o crédito e toca no débito — o PUT da chave ainda está no ar
    const credito = () => porId(tree, "card-fee-credit")[0];
    const debito = () => porId(tree, "card-fee-debit")[0];
    const pix = () => porId(tree, "card-fee-pix")[0];
    expect(credito().props.editable).not.toBe(false);
    await act(async () => { credito().props.onChangeText("3,5"); });
    await act(async () => { credito().props.onBlur(); });

    // 3. digita o débito com PUTs no ar: o campo não trava e nada é descartado
    expect(debito().props.editable).not.toBe(false);
    await act(async () => { debito().props.onChangeText("2"); });
    await act(async () => { debito().props.onBlur(); });

    // Os PUTs voltam um a um; a tela não pode voltar ao 0 do cache velho.
    await srv.soltarTodos();
    expect(credito().props.value).toBe("3,5");
    expect(debito().props.value).toBe("2");

    // 4. digita o Pix e sai da tela SEM blur (Esc, voltar do navegador)
    await act(async () => { pix().props.onChangeText("0,99"); });
    await act(async () => { tree.unmount(); });
    await srv.soltarTodos();

    expect(srv.banco).toMatchObject({
      card_fee_enabled: true,
      card_fee_credit_pct: 3.5,
      card_fee_debit_pct: 2,
      card_fee_pix_pct: 0.99,
      crediario_enabled: true,
      caixa_enabled: true,
    });
    // Nenhum PUT mandou o crédito de volta a 0 depois de gravado 3,5.
    const corpos = api.save.mock.calls.map((c) => c[1]);
    const iGravouCredito = corpos.findIndex((c) => c.card_fee_credit_pct === 3.5);
    expect(iGravouCredito).toBeGreaterThanOrEqual(0);
    corpos.slice(iGravouCredito).forEach((c) => expect(c.card_fee_credit_pct).toBe(3.5));
  });

  it("PUT que falha avisa e a tela volta ao valor salvo", async () => {
    const { toast } = require("@/components/Toast");
    api.get.mockResolvedValue({ settings: { card_fee_enabled: true, card_fee_credit_pct: 2, card_fee_debit_pct: 1 } });
    api.save.mockRejectedValue({ data: { error: "Sem conexão" } });
    const tree = await montarCartao();
    const credito = () => porId(tree, "card-fee-credit")[0];
    await act(async () => { credito().props.onChangeText("4"); });
    await act(async () => { credito().props.onBlur(); });
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Sem conexão");
    expect(credito().props.value).toBe("2");
    tree.unmount();
  });
});

describe("Taxa da maquininha › seção", () => {
  function montarSecao(display: any, onToggle = jest.fn()) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CardFeeSection display={display} saving={false} onToggle={onToggle} palette={palette} />);
    });
    return { tree, campo: (id: string) => porId(tree, id)[0], onToggle };
  }
  const base = { card_fee_enabled: true, card_fee_credit_pct: 0, card_fee_debit_pct: 0 };

  afterEach(() => { jest.useRealTimers(); });

  it("grava sozinha depois da pausa, sem precisar sair do campo", () => {
    jest.useFakeTimers();
    const { campo, onToggle } = montarSecao(base);
    act(() => { campo("card-fee-credit").props.onChangeText("3"); });
    act(() => { campo("card-fee-credit").props.onChangeText("3,5"); });
    act(() => { jest.advanceTimersByTime(CARD_FEE_DEBOUNCE_MS - 1); });
    expect(onToggle).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(onToggle.mock.calls).toEqual([["card_fee_credit_pct", 3.5]]);
  });

  it("Enter grava na hora", () => {
    const { campo, onToggle } = montarSecao(base);
    act(() => { campo("card-fee-debit").props.onChangeText("1,99"); });
    act(() => { campo("card-fee-debit").props.onSubmitEditing(); });
    expect(onToggle).toHaveBeenCalledWith("card_fee_debit_pct", 1.99);
  });

  it("sair da tela com algo digitado grava; sem nada digitado não grava", () => {
    const um = montarSecao(base);
    act(() => { um.campo("card-fee-credit").props.onChangeText("11,52"); });
    act(() => { um.tree.unmount(); });
    expect(um.onToggle.mock.calls).toEqual([["card_fee_credit_pct", 11.52]]);

    const dois = montarSecao({ ...base, card_fee_credit_pct: 3 });
    act(() => { dois.tree.unmount(); });
    expect(dois.onToggle).not.toHaveBeenCalled();
  });

  it("o campo não trava durante o save", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<CardFeeSection display={base as any} saving={true} onToggle={jest.fn()} palette={palette} />);
    });
    ["card-fee-credit", "card-fee-debit", "card-fee-pix"].forEach((id) => {
      expect(porId(tree, id)[0].props.editable).not.toBe(false);
    });
  });

  describe("aviso de 0%", () => {
    const texto = "Preencha a taxa do crédito, do débito ou do Pix. Com 0%, nada é lançado.";

    it("aparece com a chave ligada e tudo em 0%", () => {
      const { tree } = montarSecao(base);
      const aviso = porId(tree, "card-fee-aviso-zero");
      expect(aviso).toHaveLength(1);
      expect(aviso[0].props.children).toBe(texto);
    });

    it("some quando a lojista digita uma taxa, mesmo antes de gravar", () => {
      const { tree, campo } = montarSecao(base);
      act(() => { campo("card-fee-debit").props.onChangeText("2"); });
      expect(porId(tree, "card-fee-aviso-zero")).toHaveLength(0);
    });

    it.each([
      ["crédito", { card_fee_credit_pct: 3 }],
      ["débito", { card_fee_debit_pct: "1.5" }],
      ["Pix", { card_fee_pix_pct: 0.99 }],
    ])("não aparece com o %s preenchido", (_n, extra) => {
      const { tree } = montarSecao({ ...base, ...extra });
      expect(porId(tree, "card-fee-aviso-zero")).toHaveLength(0);
    });

    it("não aparece com a chave desligada", () => {
      const { tree } = montarSecao({ ...base, card_fee_enabled: false });
      expect(porId(tree, "card-fee-aviso-zero")).toHaveLength(0);
    });
  });
});
