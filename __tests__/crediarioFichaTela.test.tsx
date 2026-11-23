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
// F5: o Modal do react-native-web usa portal, que o test renderer não monta.
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
jest.mock("@/components/ConfirmDialog", () => {
  const R = jest.requireActual("react");
  return { ConfirmDialog: ({ visible, title }: any) => (visible ? R.createElement("View", { testID: `dialogo-${title}` }) : null) };
});
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
    // QA 23/11: 1366 − 280 do menu − 6 da barra de rolagem = 1079
    expect(layoutDaFicha(1079, 1366)).toBe("larga");
    expect(layoutDaFicha(1366 - 280 - 17, 1366)).toBe("larga");
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
    // dentro de campo de texto o Esc é do campo: não fecha nada
    expect(acaoDaTecla({ ...base, key: "Escape", painelAberto: true, alvoEditavel: true })).toBeNull();
    expect(acaoDaTecla({ ...base, key: "Escape", alvoEditavel: true })).toBeNull();
  });
  test("setas trocam de cliente", () => {
    expect(acaoDaTecla({ ...base, key: "ArrowUp" })).toBe("anterior");
    expect(acaoDaTecla({ ...base, key: "ArrowDown" })).toBe("proxima");
  });
  test("tecla segurada não troca em rajada", () => {
    expect(acaoDaTecla({ ...base, key: "ArrowDown", repetida: true })).toBeNull();
    expect(acaoDaTecla({ ...base, key: "Escape", repetida: true })).toBe("fechar-ficha");
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
    // QA P2: na média o cabeçalho rola junto com os carnês
    expect(porId(tree, "ficha-cabecalho-rolando")).toHaveLength(1);
    expect(porId(tree, "ficha-cabecalho-fixo")).toHaveLength(0);
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
    act(() => { porId(tree, "ficha-mais")[0].props.onPress(); });
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

describe("revisão da F3: travas da ficha em tela cheia", () => {
  const CARNE = {
    id: "k1", name: "Compra de 19/10", status: "open", balance: 100, open_count: 1,
    next_due_date: "2027-01-20", overdue: false, period_unit: "month", period_count: 1,
    purchases: [], purchases_total: 100, total_amount: 100, refunded_total: 0, total_count: 1, paid_count: 0,
    paid_installments: [], open_remaining: 100, unscheduled: 0, remaining: 100,
  };
  const PARCELA = {
    id: "p1", customer_id: "c1", company_id: "loja1", installment_number: 1, total_installments: 1,
    amount_due: 100, amount_paid: 0, covered_amount: 0, due_date: "2027-01-20", status: "pending",
    account_id: "k1", is_overdue: false, needs_review: false,
  };
  const detalheComCarne = { ...mockDetail, accounts: [CARNE], open_installments: [PARCELA] };

  function arvore(props: any) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (p: any) => (
      <QueryClientProvider client={qc}>
        <ClienteCrediarioModal visible casca="tela" layout="larga" companyId="loja1" onClose={jest.fn()} {...props} {...p} />
      </QueryClientProvider>
    );
  }
  async function esperar() { await act(async () => { await new Promise(r => setTimeout(r, 0)); }); }

  test("com 'Excluir carnê' aberto: setas não trocam, Esc fecha só o diálogo; trocar de cliente limpa o diálogo", async () => {
    const { creditApi } = jest.requireMock("@/services/creditApi");
    creditApi.getCustomerHistory.mockImplementation(() => Promise.resolve(detalheComCarne));
    const onClose = jest.fn();
    const onProxima = jest.fn();
    const Ficha = arvore({ onClose, navegacao: { posicao: 1, total: 2, onProxima } });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<Ficha customerId="c1" />); });
    await esperar();
    act(() => { porId(tree, "carne-k1-mais")[0].props.onPress(); });
    act(() => { porId(tree, "carne-k1-excluir")[0].props.onPress(); });
    expect(porId(tree, "dialogo-Excluir carnê")).toHaveLength(1);

    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })); });
    expect(onProxima).not.toHaveBeenCalled();
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onClose).not.toHaveBeenCalled();
    expect(porId(tree, "dialogo-Excluir carnê")).toHaveLength(0);

    // de novo, e a cliente muda: o diálogo da anterior some
    act(() => { porId(tree, "carne-k1-mais")[0].props.onPress(); });
    act(() => { porId(tree, "carne-k1-excluir")[0].props.onPress(); });
    expect(porId(tree, "dialogo-Excluir carnê")).toHaveLength(1);
    await act(async () => { tree.update(<Ficha customerId="c2" />); });
    expect(porId(tree, "dialogo-Excluir carnê")).toHaveLength(0);
    creditApi.getCustomerHistory.mockImplementation(() => Promise.resolve(mockDetail));
  });

  test("cliente que a loja não acha (404, ?cliente= depois da troca de loja): fecha a ficha", async () => {
    const { creditApi } = jest.requireMock("@/services/creditApi");
    creditApi.getCustomerHistory.mockImplementation(() => Promise.reject(Object.assign(new Error("nf"), { status: 404 })));
    const onClose = jest.fn();
    const Ficha = arvore({ onClose });
    await act(async () => { renderer.create(<Ficha customerId="c9" />); });
    await esperar();
    expect(onClose).toHaveBeenCalled();
    creditApi.getCustomerHistory.mockImplementation(() => Promise.resolve(mockDetail));
  });

  test("cliente de outra loja do grupo, sem nada nesta, aberta pelo endereço: fecha", async () => {
    const { creditApi } = jest.requireMock("@/services/creditApi");
    creditApi.getCustomerHistory.mockImplementation(() => Promise.resolve({
      ...mockDetail, balance: 0, customer: { ...mockDetail.customer, company_id: "outra" },
    }));
    const onClose = jest.fn();
    await act(async () => { renderer.create(arvore({ onClose, abertaPeloEndereco: true })({ customerId: "c3" })); });
    await esperar();
    expect(onClose).toHaveBeenCalled();
    // aberta por um toque (lead do Prontos pra comprar), a mesma cliente fica
    const onClose2 = jest.fn();
    await act(async () => { renderer.create(arvore({ onClose: onClose2 })({ customerId: "c4" })); });
    await esperar();
    expect(onClose2).not.toHaveBeenCalled();
    creditApi.getCustomerHistory.mockImplementation(() => Promise.resolve(mockDetail));
  });

  const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  test("envio em andamento trava a troca de cliente e as respostas checam a cliente", () => {
    expect(fonte).toContain("const ocupado = freeSubmitting || renegSubmitting || excluindo");
    expect(fonte).toContain("{ocupado && <TravaDaLista />}");
    expect(fonte).toMatch(/if \(ocupado\) return;/);
    // recebimento, renegociação, exclusão e juntar: guarda da cliente
    expect(fonte.match(/clienteAtualRef\.current !== pedidoDe\) \{ atualizarDaCliente\(pedidoDe\)/g)?.length).toBe(3);
    expect(fonte).toContain("if (clienteAtualRef.current !== customerId) { atualizarDaCliente(customerId);");
    expect(fonte).toContain("if (vars.cliente !== clienteAtualRef.current) {");
  });
  test("abrir um painel fecha o que estava aberto (na tela cheia)", () => {
    for (const f of ["function receberDaAba(", "function handleEditDueDateOpen(", "function openRenegociar(", "async function openInstallmentPix("]) {
      const i = fonte.indexOf(f);
      expect(fonte.slice(i, i + 160)).toContain("fecharAoAbrirPainel();");
    }
  });
});

describe("F4: cabeçalho de três fatos e o ⋯ da ficha", () => {
  function texto(node: any): string {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(texto).join("");
    return texto(node.children);
  }
  async function montarCasca(casca: "tela" | "janela") {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <ClienteCrediarioModal visible casca={casca} layout="larga" companyId="loja1" customerId="c1" onClose={jest.fn()} onCobrar={jest.fn()} />
        </QueryClientProvider>,
      );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    return tree;
  }

  test("Falta pagar, O que vem agora e Pode comprar mais, com o score em frase", async () => {
    const tree = await montarCasca("tela");
    expect(porId(tree, "ficha-tres-fatos")).toHaveLength(1);
    expect(porId(tree, "crediario-ficha-status")).toHaveLength(1);
    expect(porId(tree, "crediario-ficha-limite")).toHaveLength(1);
    const tudo = texto(tree.toJSON());
    expect(tudo).toContain("Falta pagar");
    expect(tudo).toContain("R$ 570,66");
    expect(tudo).toContain("Sem data marcada");
    expect(tudo).toContain("Pode comprar mais");
    expect(tudo).toContain("R$ 429,34");
    expect(tudo).toContain("limite de R$ 1.000,00 · às vezes atrasa ·");
    // o "ver" é um botão com área de 44 px
    expect(porId(tree, "ficha-fato-ver-limite")[0].props.accessibilityRole).toBe("button");
    // a nota (640) não está no topo; os rótulos antigos sumiram
    expect(tudo).not.toContain("SCORE");
    expect(tudo).not.toContain("FALTA PAGAR");
    expect(tudo).not.toContain("640");
    // o selo Em dia / Em atraso ao lado do nome saiu
    expect(tudo).not.toContain("Em dia");
  });

  test("o ⋯ abre com toque e leva a Limite e regras; o \"ver\" do terceiro fato também", async () => {
    const tree = await montarCasca("tela");
    expect(porId(tree, "ficha-menu")).toHaveLength(0);
    act(() => { porId(tree, "ficha-mais")[0].props.onPress(); });
    const menu = texto(tree.toJSON());
    expect(menu).toContain("Editar cadastro da cliente");
    expect(menu).toContain("Limite e regras desta cliente");
    act(() => { porId(tree, "ficha-mais")[0].props.onPress(); });
    act(() => { porId(tree, "ficha-fato-ver-limite")[0].props.onPress(); });
    expect(porId(tree, "ficha-painel-limite")).toHaveLength(1);
    const painel = texto(tree.toJSON());
    expect(painel).toContain("Usou R$ 570,66 de R$ 1.000,00. ");
    expect(painel).toContain("Pode comprar mais R$ 429,34.");
    expect(painel).toContain("Como ela costuma pagar");
    expect(painel).toContain("Às vezes atrasa");
    expect(painel).toContain("A Aura olha os pagamentos dela e dá uma nota. A nota só avisa você: nunca impede a venda.");
    expect(painel).toContain("640");
    expect(painel).toContain("Deixe em branco para usar a regra da loja.");
    expect(painel).toContain("Liberadas para esta cliente");
  });

  test("na janela, a lista do ⋯ vai para a área que rola (o cabeçalho fixo cortaria)", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
    expect(fonte).toMatch(/<ScrollView style=\{m\.body\}[^>]*>\s*\{listaDoMenuDaFicha\}/);
  });

  test("na janela: duas abas (sem a aba Conta) e Limite e regras pelo ⋯", async () => {
    const tree = await montarCasca("janela");
    const tudo = texto(tree.toJSON());
    expect(tudo).toContain("Movimentações");
    expect(tudo).not.toMatch(/Limite e regras(?! desta)/);
    act(() => { porId(tree, "ficha-mais")[0].props.onPress(); });
    act(() => { porId(tree, "ficha-abrir-limite")[0].props.onPress(); });
    expect(porId(tree, "ficha-painel-limite")).toHaveLength(1);
  });
});

describe("F5: celular, página inteira", () => {
  function texto(node: any): string {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(texto).join("");
    return texto(node.children);
  }
  async function montarPagina(extra: any = {}) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <ClienteCrediarioModal visible casca="pagina" companyId="loja1" customerId="c1" onClose={onClose} onCobrar={jest.fn()} {...extra} />
        </QueryClientProvider>,
      );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    return { tree, onClose };
  }

  test("cabeçalho de uma linha, Falta pagar com a frase, duas abas e rodapé com Cobrar e Receber", async () => {
    const { tree, onClose } = await montarPagina();
    expect(porId(tree, "ficha-pagina")).toHaveLength(1);
    const tudo = texto(tree.toJSON());
    expect(tudo).toContain("Maria Aparecida Souza");
    expect(tudo).toContain("Falta pagar");
    expect(texto(porId(tree, "ficha-pagina-falta")[0].props.children)).toBe("R$ 570,66");
    expect(tudo).toContain("Próxima parcela Sem data marcada · compras sem carnê: receba quando ela pagar");
    expect(tudo).toContain("Pode comprar mais R$ 429,34 · às vezes atrasa ·ver");
    expect(porId(tree, "ficha-aba-parcelas")).toHaveLength(1);
    expect(porId(tree, "ficha-aba-historico")).toHaveLength(1);
    expect(porId(tree, "ficha-aba-conta")).toHaveLength(0);
    const rodape = porId(tree, "ficha-rodape")[0];
    expect(rodape.findAllByProps({ testID: "ficha-cobrar" }, { deep: false } as any)).toHaveLength(1);
    expect(rodape.findAllByProps({ testID: "ficha-receber" }, { deep: false } as any)).toHaveLength(1);
    act(() => { porId(tree, "ficha-voltar")[0].props.onPress(); });
    expect(onClose).toHaveBeenCalled();
  });

  test("Movimentações: a aba troca e o alto encolhe para uma linha", async () => {
    const { tree } = await montarPagina();
    act(() => { porId(tree, "ficha-aba-historico")[0].props.onPress(); });
    expect(porId(tree, "ficha-pagina-hero")).toHaveLength(0);
    expect(texto(tree.toJSON())).toContain("mais recentes primeiro");
  });

  test("voltar do Android / Esc: a pergunta do Receber fecha antes do painel, e o painel antes da ficha", async () => {
    const { tree, onClose } = await montarPagina();
    act(() => { porId(tree, "ficha-receber")[0].props.onPress(); });
    const campo = tree.root.findAll((n: any) => n.props && n.props.placeholder === "0,00" && typeof n.props.onChangeText === "function")[0];
    await act(async () => { campo.props.onChangeText("50"); });
    const rotulo = tree.root.findAll((n: any) => n.props && n.props.children === "Confirmar R$ 50,00")[0];
    let alvo: any = rotulo;
    while (alvo && typeof alvo.props.onPress !== "function") alvo = alvo.parent;
    act(() => { alvo.props.onPress(); });
    expect(texto(tree.toJSON())).toContain("Confirmar recebimento de R$ 50,00");
    const modal = tree.root.findAll((n: any) => n.props && typeof n.props.onRequestClose === "function" && n.props.transparent === false)[0];
    act(() => { modal.props.onRequestClose(); });
    // fechou a pergunta; o painel continua
    expect(texto(tree.toJSON())).not.toContain("Confirmar recebimento de R$ 50,00");
    expect(texto(tree.toJSON())).toContain("Confirmar R$ 50,00");
    act(() => { modal.props.onRequestClose(); });
    expect(texto(tree.toJSON())).not.toContain("Confirmar R$ 50,00");
    expect(onClose).not.toHaveBeenCalled();
    act(() => { modal.props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a página só vale no celular: computador estreito ao lado do menu continua com a janela de 700 px", () => {
    const pagina = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "crediario.tsx"), "utf8");
    expect(pagina).toContain('casca={width > JANELA_DO_CELULAR ? "janela" : "pagina"}');
    const estilos = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ficha", "fichaStyles.ts"), "utf8");
    expect(estilos).toContain("xBtn: { width: 44, height: 44");
  });

  test("QA P1-7: Esc/voltar com o menu do telefone aberto fecha só o menu", async () => {
    const { tree, onClose } = await montarPagina();
    act(() => { porId(tree, "ficha-telefone")[0].props.onPress(); });
    expect(porId(tree, "ficha-telefone-opcoes")).toHaveLength(1);
    const modal = tree.root.findAll((n: any) => n.props && typeof n.props.onRequestClose === "function" && n.props.transparent === false)[0];
    act(() => { modal.props.onRequestClose(); });
    expect(porId(tree, "ficha-telefone-opcoes")).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    act(() => { modal.props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("voltar do Android / Esc com painel aberto fecha o painel, não a ficha", async () => {
    const { tree, onClose } = await montarPagina();
    act(() => { porId(tree, "ficha-receber")[0].props.onPress(); });
    const modal = tree.root.findAll((n: any) => n.props && typeof n.props.onRequestClose === "function" && n.props.transparent === false)[0];
    act(() => { modal.props.onRequestClose(); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { modal.props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("alvos de toque de 44 px ou mais no celular", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
    const pg = fonte.slice(fonte.indexOf("const pg = StyleSheet.create({"), fonte.indexOf("const t = StyleSheet.create({"));
    expect(pg).toContain("voltar: { flexDirection: \"row\", alignItems: \"center\", gap: 4, minHeight: 44, minWidth: 44");
    expect(pg).toContain("segItem: { flex: 1, minHeight: 44");
    expect(pg).toContain("receber: { flex: 1, minHeight: 46");
    // nada de largura fixa na página (320 px sem rolagem para o lado)
    expect(pg).not.toMatch(/\bwidth: \d{3,}/);
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

describe("QA 23/11 (P1-5): depois de mexer no dinheiro, tudo recarrega", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  test("um ajudante só invalida ficha, perfil, carteira (mesmo escondida) e indicadores", () => {
    const i = fonte.indexOf("function atualizarFicha(");
    const corpo = fonte.slice(i, fonte.indexOf("onChanged?.();", i));
    for (const k of ['"credit-customer"', '"credit-profile"', '"credit-balances"', '"credit-dashboard"', '"credit-aging"']) {
      expect(corpo).toContain(k);
    }
    expect(corpo).toContain('refetchType: "all"');
    // fora do ajudante ninguém invalida pela metade
    expect(fonte.match(/qc\.invalidateQueries/g)?.length).toBe(5);
  });
  test("receber, mudar as parcelas, mudar a data, juntar e Movimentações (remover/corrigir/devolver) usam o ajudante", () => {
    const trecho = (marca: string) => fonte.slice(fonte.indexOf(marca), fonte.indexOf("catch", fonte.indexOf(marca)));
    expect(trecho("async function confirmFreePayment(")).toContain("atualizarFicha();");
    expect(trecho("async function confirmRenegociar(")).toContain("atualizarFicha();");
    const data = fonte.slice(fonte.indexOf("const editDueDateMut = useMutation({"), fonte.indexOf("onError", fonte.indexOf("const editDueDateMut = useMutation({")));
    expect(data).toContain("atualizarFicha();");
    expect(fonte).toMatch(/function handleHistoricRefresh\(\) \{\s*atualizarFicha\(customerId\);/);
    const i = fonte.indexOf("function handleJuntou(");
    const juntou = fonte.slice(i, i + 1400);
    expect(juntou).toContain("handleHistoricRefresh();");
  });
});

describe("QA P2: Cobrar mostra que está preparando", () => {
  test("desligado e com 'Preparando…' enquanto a prévia abre", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={qc}>
          <ClienteCrediarioModal visible casca="tela" layout="larga" companyId="loja1" customerId="c1" onClose={jest.fn()} onCobrar={jest.fn()} cobrando />
        </QueryClientProvider>,
      );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const b = porId(tree, "ficha-cobrar")[0];
    expect(b.props.disabled).toBe(true);
    expect(b.props.accessibilityLabel).toBe("Preparando a cobrança");
  });
});

describe("QA P2: anel de foco violeta", () => {
  test("o estilo marca o contêiner da ficha e usa o violeta do app", () => {
    const { cssDoAnelDeFoco } = require("@/components/crediario/ficha/anelDeFoco");
    expect(cssDoAnelDeFoco(true)).toContain("[data-ficha-crediario] :focus-visible { outline: 2px solid #a78bfa");
    expect(cssDoAnelDeFoco(false)).toContain("outline: 2px solid #7c3aed");
  });
  test("as três cascas levam a marca", () => {
    const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
    expect(fonte.match(/MARCA_DA_FICHA/g)?.length).toBeGreaterThanOrEqual(4);
    expect(fonte).toContain("useAnelDeFocoDaFicha(visible);");
  });
});
