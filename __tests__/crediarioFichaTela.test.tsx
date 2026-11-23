// ============================================================
// Ficha do crediário em tela cheia (F3 do redesenho, 23/11/2026)
//
// Cobre:
//   - utils/crediarioFichaTela: casca pela largura útil, vizinha na lista,
//     "3 de 38", o que cada tecla faz e o que é campo de texto;
//   - ListaDaFicha renderizada: linhas, selecionada, troca, voltar, filtro;
//   - ClienteCrediarioModal na casca "tela" renderizado: três colunas na
//     larga, barra de troca na média, Receber e Limite e regras abrindo na
//     coluna da direita, Esc fechando o painel e depois a ficha, setas;
//   - crediario.tsx pela fonte: ?cliente= fica no endereço.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  acaoDaTecla, ehCampoEditavel, layoutDaFicha, posicaoNaLista, vizinhaNaLista,
  LARGURA_UTIL_LARGA, LARGURA_UTIL_MEDIA,
} from "@/utils/crediarioFichaTela";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
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

const mockProfile = {
  credit_score: 640, score_label: "regular", credit_limit: 1000, credit_used: 570.66,
  available_limit: 429.34, status: "active", terms: { effective: { max_installments: 6, interest_rate: 0.01 } },
};
const mockDetail = {
  customer: { id: "c1", name: "Maria Aparecida Souza", phone: "12991234567" },
  balance: 570.66, accounts: [], open_installments: [], transactions: [],
};
jest.mock("@/services/creditApi", () => ({
  MAX_INSTALLMENTS_CEILING: 500,
  printReceipt: jest.fn(),
  printCarne: jest.fn(),
  valorAPagarParcela: () => 0,
  creditApi: {
    getCustomerProfile: jest.fn(() => Promise.resolve(mockProfile)),
    getCustomerHistory: jest.fn(() => Promise.resolve(mockDetail)),
    getHistoryTimeline: jest.fn(() => Promise.resolve({ events: [], next_cursor: null })),
    previewPayment: jest.fn(() => Promise.resolve(null)),
  },
}));
jest.mock("@/services/creditReschedule", () => ({ rescheduleApi: { apply: jest.fn() } }));

import { ListaDaFicha } from "@/components/crediario/ficha/ListaDaFicha";
import { ClienteCrediarioModal } from "@/components/crediario/ClienteCrediarioModal";

const porId = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }, { deep: false } as any);

describe("layoutDaFicha", () => {
  test("celular (janela ≤ 768) é sempre a janela", () => {
    expect(layoutDaFicha(2000, 768)).toBe("janela");
    expect(layoutDaFicha(375, 375)).toBe("janela");
  });
  test("pela largura útil: 1366 com o menu aberto (~1086) dá três colunas", () => {
    expect(layoutDaFicha(1086, 1366)).toBe("larga");
    expect(layoutDaFicha(LARGURA_UTIL_LARGA, 1400)).toBe("larga");
  });
  test("entre 700 e 1079 de largura útil, duas colunas", () => {
    expect(layoutDaFicha(LARGURA_UTIL_LARGA - 1, 1280)).toBe("media");
    expect(layoutDaFicha(LARGURA_UTIL_MEDIA, 1000)).toBe("media");
  });
  test("estreito demais ao lado do menu: volta à janela", () => {
    expect(layoutDaFicha(LARGURA_UTIL_MEDIA - 1, 900)).toBe("janela");
  });
});

describe("vizinhaNaLista e posicaoNaLista", () => {
  const ids = ["a", "b", "c"];
  test("anda para cima e para baixo, sem dar a volta", () => {
    expect(vizinhaNaLista(ids, "b", 1)).toBe("c");
    expect(vizinhaNaLista(ids, "b", -1)).toBe("a");
    expect(vizinhaNaLista(ids, "c", 1)).toBeNull();
    expect(vizinhaNaLista(ids, "a", -1)).toBeNull();
  });
  test("cliente fora da lista (filtro, endereço): qualquer seta leva à primeira", () => {
    expect(vizinhaNaLista(ids, "z", 1)).toBe("a");
    expect(vizinhaNaLista(ids, null, -1)).toBe("a");
    expect(vizinhaNaLista([], "a", 1)).toBeNull();
  });
  test("3 de 38", () => {
    expect(posicaoNaLista(ids, "c")).toEqual({ posicao: 3, total: 3 });
    expect(posicaoNaLista(ids, "z")).toEqual({ posicao: 0, total: 3 });
  });
});

describe("acaoDaTecla", () => {
  const base = { key: "", alvoEditavel: false, dialogoAberto: false, painelAberto: false, comModificador: false };
  test("Esc fecha o painel antes da ficha", () => {
    expect(acaoDaTecla({ ...base, key: "Escape", painelAberto: true })).toBe("fechar-painel");
    expect(acaoDaTecla({ ...base, key: "Escape" })).toBe("fechar-ficha");
    // dentro do campo do Receber o Esc também fecha o painel
    expect(acaoDaTecla({ ...base, key: "Escape", painelAberto: true, alvoEditavel: true })).toBe("fechar-painel");
  });
  test("setas trocam de cliente", () => {
    expect(acaoDaTecla({ ...base, key: "ArrowUp" })).toBe("anterior");
    expect(acaoDaTecla({ ...base, key: "ArrowDown" })).toBe("proxima");
  });
  test("setas não trocam dentro de campo nem com painel aberto", () => {
    expect(acaoDaTecla({ ...base, key: "ArrowDown", alvoEditavel: true })).toBeNull();
    expect(acaoDaTecla({ ...base, key: "ArrowDown", painelAberto: true })).toBeNull();
  });
  test("com outra janela por cima ou com Ctrl/Cmd/Alt: nada", () => {
    expect(acaoDaTecla({ ...base, key: "Escape", dialogoAberto: true })).toBeNull();
    expect(acaoDaTecla({ ...base, key: "ArrowDown", comModificador: true })).toBeNull();
    expect(acaoDaTecla({ ...base, key: "Enter" })).toBeNull();
  });
  test("ehCampoEditavel", () => {
    expect(ehCampoEditavel({ tagName: "input" })).toBe(true);
    expect(ehCampoEditavel({ tagName: "TEXTAREA" })).toBe(true);
    expect(ehCampoEditavel({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(ehCampoEditavel({ tagName: "DIV" })).toBe(false);
    expect(ehCampoEditavel(null)).toBe(false);
  });
});

describe("ListaDaFicha", () => {
  const clientes = [
    { id: "c1", nome: "Maria Aparecida Souza", situacao: "Em atraso · 19 dias", atrasada: true, valor: "R$ 570,66" },
    { id: "c2", nome: "Ana Lúcia Ferreira", situacao: "Em dia", atrasada: false, valor: "R$ 180,00" },
  ];
  function montar(extra: any = {}) {
    const props = {
      clientes, selecionadaId: "c1", onEscolher: jest.fn(), onVoltar: jest.fn(),
      busca: "", onBusca: jest.fn(), filtro: "todos", onFiltro: jest.fn(), ...extra,
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<ListaDaFicha {...props} />); });
    return { tree, props };
  }

  test("uma linha por cliente; a aberta fica marcada", () => {
    const { tree } = montar();
    expect(porId(tree, "ficha-lista-item-c1")).toHaveLength(1);
    expect(porId(tree, "ficha-lista-item-c2")).toHaveLength(1);
    expect(porId(tree, "ficha-lista-item-c1")[0].props.accessibilityState).toEqual({ selected: true });
    expect(porId(tree, "ficha-lista-item-c2")[0].props.accessibilityState).toEqual({ selected: false });
  });

  test("um toque troca a ficha; outro volta para a lista", () => {
    const { tree, props } = montar();
    act(() => { porId(tree, "ficha-lista-item-c2")[0].props.onPress(); });
    expect(props.onEscolher).toHaveBeenCalledWith("c2", "Ana Lúcia Ferreira");
    act(() => { porId(tree, "ficha-lista-voltar")[0].props.onPress(); });
    expect(props.onVoltar).toHaveBeenCalled();
  });

  test("filtro Em atraso e a faixa escolhida na página", () => {
    const { tree, props } = montar({ filtro: "31_60_dias", rotuloDaFaixa: "31–60 dias" });
    expect(porId(tree, "ficha-lista-filtro-31–60 dias")).toHaveLength(1);
    act(() => { porId(tree, "ficha-lista-filtro-Em atraso")[0].props.onPress(); });
    expect(props.onFiltro).toHaveBeenCalledWith("atraso");
  });
});

describe("ClienteCrediarioModal na casca tela", () => {
  async function montar(extra: any = {}) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <ClienteCrediarioModal
            visible
            casca="tela"
            companyId="loja1"
            customerId="c1"
            customerName="Maria Aparecida Souza"
            onClose={onClose}
            onCobrar={jest.fn()}
            listaLateral={<ListaDaFicha clientes={[]} selecionadaId="c1" onEscolher={jest.fn()} onVoltar={onClose} busca="" onBusca={jest.fn()} filtro="todos" onFiltro={jest.fn()} />}
            {...extra}
          />
        </QueryClientProvider>,
      );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    return { tree, onClose };
  }

  test("larga: lista, centro e direita; Receber e Cobrar no alto da direita", async () => {
    const { tree } = await montar({ layout: "larga" });
    expect(porId(tree, "ficha-tela")).toHaveLength(1);
    expect(porId(tree, "ficha-lista")).toHaveLength(1);
    expect(porId(tree, "ficha-centro")).toHaveLength(1);
    expect(porId(tree, "ficha-direita")).toHaveLength(1);
    expect(porId(tree, "ficha-receber")).toHaveLength(1);
    expect(porId(tree, "ficha-cobrar")).toHaveLength(1);
    // sem a barra da tela média e sem as abas da janela
    expect(porId(tree, "ficha-barra-troca")).toHaveLength(0);
  });

  test("média: sem a coluna da lista; barra com ‹ 2 de 5 › e Trocar cliente", async () => {
    const onAnterior = jest.fn();
    const { tree } = await montar({ layout: "media", navegacao: { posicao: 2, total: 5, onAnterior } });
    expect(porId(tree, "ficha-lista")).toHaveLength(0);
    expect(porId(tree, "ficha-barra-troca")).toHaveLength(1);
    expect(porId(tree, "ficha-posicao")[0].props.children).toBe("2 de 5");
    act(() => { porId(tree, "ficha-anterior")[0].props.onPress(); });
    expect(onAnterior).toHaveBeenCalled();
    // sem a próxima: botão desligado
    expect(porId(tree, "ficha-proxima")[0].props.disabled).toBe(true);
    act(() => { porId(tree, "ficha-trocar-cliente")[0].props.onPress(); });
    expect(porId(tree, "ficha-trocar-lista")).toHaveLength(1);
    expect(porId(tree, "ficha-lista")).toHaveLength(1);
  });

  test("Limite e regras abre na coluna da direita; Esc fecha o painel e depois a ficha", async () => {
    const { tree, onClose } = await montar({ layout: "larga" });
    act(() => { porId(tree, "ficha-abrir-limite")[0].props.onPress(); });
    const direita = porId(tree, "ficha-direita")[0];
    expect(direita.findAllByProps({ testID: "ficha-painel-limite" }, { deep: false } as any)).toHaveLength(1);

    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(porId(tree, "ficha-painel-limite")).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();

    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Receber pagamento abre por cima da coluna da direita", async () => {
    const { tree } = await montar({ layout: "larga" });
    act(() => { porId(tree, "ficha-receber")[0].props.onPress(); });
    const direita = porId(tree, "ficha-direita")[0];
    const textos = direita.findAll((n: any) => n.props?.children === "Receber pagamento");
    expect(textos.length).toBeGreaterThan(0);
  });

  test("com o Receber aberto as setas não trocam de cliente (levaria o valor digitado)", async () => {
    const onProxima = jest.fn();
    const { tree } = await montar({ layout: "larga", navegacao: { posicao: 1, total: 3, onProxima } });
    act(() => { porId(tree, "ficha-receber")[0].props.onPress(); });
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })); });
    expect(onProxima).not.toHaveBeenCalled();
  });

  test("↓ e ↑ trocam de cliente (sem painel aberto)", async () => {
    const onAnterior = jest.fn();
    const onProxima = jest.fn();
    await montar({ layout: "larga", navegacao: { posicao: 2, total: 3, onAnterior, onProxima } });
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })); });
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" })); });
    expect(onProxima).toHaveBeenCalledTimes(1);
    expect(onAnterior).toHaveBeenCalledTimes(1);
  });

  test("as Movimentações carregam sem trocar de aba", async () => {
    const { creditApi } = jest.requireMock("@/services/creditApi");
    creditApi.getHistoryTimeline.mockClear();
    await montar({ layout: "larga" });
    expect(creditApi.getHistoryTimeline).toHaveBeenCalledWith("loja1", "c1", expect.anything());
  });
});

describe("crediario.tsx: ?cliente= fica no endereço", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "crediario.tsx"), "utf8");
  test("abrir põe o parâmetro, fechar tira", () => {
    expect(fonte).toContain("router.setParams({ cliente: c.id } as any)");
    expect(fonte).toContain("router.setParams({ cliente: undefined } as any)");
  });
  test("o parâmetro não é mais apagado ao abrir", () => {
    expect(fonte).not.toMatch(/setModalCust\(\{ id: cid, name: "" \}\);\s*try \{ router\.setParams\(\{ cliente: undefined \}/);
  });
  test("a lista de baixo não desmonta: só some enquanto a ficha está em tela cheia", () => {
    expect(fonte).toContain('style={[s.screen, fichaEmTela && { display: "none" }]}');
  });
});
