// ============================================================
// Venda condicional (C12): "Cobrar no Caixa" abre o Caixa pela condicional.
//
// O usePdvState de verdade (mesmo harness de comClientesNoCaixa.test.tsx),
// react-query falso que devolve o detalhe da condicional. Cobre:
//   · abrir pela URL: carrinho com as peças, no preço do comprovante, cliente
//     da condicional, rótulo "Condicional C-0007";
//   · carrinho travado (bipe, toque, + − e lixeira não mudam nada);
//   · Sair: carrinho limpo e nada gravado;
//   · corpo do POST /pdv/sale com condicional_id e condicional_item_ids;
//   · depois da venda: as quatro consultas são invalidadas;
//   · 409 do servidor: a frase dele na faixa e "Voltar à condicional";
//   · peça já cobrada / outra loja ao abrir;
//   · sem a trava, nada muda (corpo do POST sem os campos, sem busca).
// ============================================================
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => {
  const estado: any = { company: { id: "co-1", plan: "negocio" }, user: { id: "u-1", is_staff: true }, isDemo: false, companyLogo: null, switchCompany: jest.fn(() => Promise.resolve()) };
  (globalThis as any).__estadoAuth = estado;
  const useAuthStore = Object.assign(
    (sel?: (s: any) => any) => (typeof sel === "function" ? sel(estado) : estado),
    { getState: () => estado, setState: () => {}, subscribe: () => () => {} },
  );
  return { useAuthStore };
});
const mockToast = { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock("@/components/Toast", () => ({
  toast: {
    error: (...a: any[]) => mockToast.error(...a), success: (...a: any[]) => mockToast.success(...a),
    info: (...a: any[]) => mockToast.info(...a), warning: (...a: any[]) => mockToast.warning(...a),
  },
}));
const mockInvalidate = jest.fn();
const mockMutate = jest.fn();
const mockQueries: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    mockQueries.push(opts);
    if (opts && opts.queryKey && opts.queryKey[0] === "condicional-detalhe" && opts.enabled !== false) {
      return { data: (globalThis as any).__detalhe, isLoading: false, isError: false, refetch: jest.fn() };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: (...a: any[]) => mockInvalidate(...a), setQueryData: jest.fn() }),
  useMutation: () => ({ mutate: (...a: any[]) => mockMutate(...a), mutateAsync: jest.fn() }),
}));
const mockPush = jest.fn();
const mockSetParams = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => (globalThis as any).__params || {},
  router: { push: (...a: any[]) => mockPush(...a), setParams: (...a: any[]) => mockSetParams(...a), replace: jest.fn() },
  useRouter: () => ({ push: (...a: any[]) => mockPush(...a), replace: jest.fn(), setParams: jest.fn() }),
  usePathname: () => "/pdv",
}));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ products: (globalThis as any).__produtos || [] }) }));
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: [] }) }));
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: (globalThis as any).__settings || {}, isLoading: false, invalidate: jest.fn() }),
  validateSaleAgainstSettings: () => ({ ok: true, missing: [] }),
}));
jest.mock("@/hooks/useCategories", () => ({ useCategories: () => ({ flattened: [] }) }));
jest.mock("@/hooks/useCaixa", () => ({ useCaixa: () => ({ sessaoAtiva: null, isAberto: true, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/hooks/useGlobalBarcodeScanner", () => ({ useGlobalBarcodeScanner: () => {} }));
jest.mock("@/hooks/useCompanyProfile", () => ({ useCompanyProfile: () => null }));
jest.mock("@/hooks/useMatconQuote", () => ({ useMatconQuote: () => ({}) }));
jest.mock("@/hooks/useMatconReferral", () => ({ useMatconReferral: () => ({ clear: () => {} }) }));
jest.mock("@/hooks/useOrcamentoNoCaixa", () => ({ useOrcamentoNoCaixa: () => {}, chaveDoOrcamento: () => null }));
jest.mock("@/hooks/useComandaNoCaixa", () => ({ useComandaNoCaixa: () => ({}) }));
jest.mock("@/components/screens/pdv/ComandasAbertasPanel", () => ({ useComandasAbertas: () => ({ comandas: [] }) }));
jest.mock("@/components/screens/pdv/flyToCart", () => ({ flyToCart: jest.fn() }));
jest.mock("@/services/nfceApi", () => ({ nfceApi: {} }));
jest.mock("@/services/creditApi", () => ({ creditApi: {} }));
jest.mock("@/services/warrantiesApi", () => ({ warrantiesApi: {} }));
const mockScan = jest.fn((..._a: any[]) => Promise.resolve({} as any));
jest.mock("@/services/api", () => ({
  companiesApi: { variants: jest.fn(() => Promise.resolve({ variants: [] })) },
  pdvApi: { scan: (...a: any[]) => mockScan(...a), createSale: jest.fn() },
  couponsApi: {},
  employeesApi: { list: jest.fn() },
  request: jest.fn(),
}));

import { usePdvState } from "@/hooks/usePdvState";
import { guardarVenda, recuperarVenda } from "@/utils/vendaGuardada";
import { useWarrantyDraft } from "@/stores/warrantyDraft";
import {
  condicionalDaUrl, estadoDaCobranca, camposDaCondicionalNaVenda, rotaDoCaixaDaCondicional,
  rotaDeVoltaDaCondicional, idsParaCobrar, ehErroDaCondicional,
} from "@/utils/condicionalNoCaixa";

const LOJA = "co-1";
const COND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333333";
const I1 = "b1111111-1111-4111-8111-111111111111";
const I2 = "b2222222-2222-4222-8222-222222222222";
const I3 = "b3333333-3333-4333-8333-333333333333";

function peca(id: string, produto: string, variante: string | null, nome: string, preco: number, over: any = {}) {
  return {
    id, product_id: produto, variant_id: variante, product_name: nome, variant_label: variante ? "Marinho · M" : null,
    color_name: variante ? "Marinho" : null, size_label: variante ? "M" : null, unit_price: preco, preco_hoje: preco + 10, preco_mudou: true,
    situacao: "com_cliente", defect_note: null, decided_at: null, sale_id: null, added_at: "2026-11-25T13:42:00Z", ...over,
  };
}
function detalhe(over: any = {}) {
  return {
    id: COND_ID, company_id: LOJA, numero: 7, numero_exibicao: "C-0007", status: "aberta", situacao: "com_cliente", parcial: false, dias_de_atraso: 0,
    customer_id: "cli-1", customer_name: "Marina Duarte", customer_phone: "(11) 98888-0142", seller_name: null, due_date: null, notes: null, terms: null,
    created_at: "", closed_at: null, cancelled_at: null, cancel_reason: null, resumo: {}, events: [],
    items: [
      peca(I1, P1, V1, "Vestido Midi Lívia", 189.9),
      peca(I2, P2, null, "Brinco Argola", 59.9),
      peca(I3, P2, null, "Brinco Argola", 59.9),
    ],
    ...over,
  };
}
const URL_COBRAR = { condicional: COND_ID, loja: LOJA, itens: [I1, I2, I3].join(",") };

const CATALOGO = [
  { id: P1, name: "Vestido Midi Lívia", price: 999, stock: 5, unit: "un", outQty: 0, outByVariant: {} },
  { id: P2, name: "Brinco Argola", price: 999, stock: 5, unit: "un", outQty: 0, outByVariant: {} },
];

let host: HTMLDivElement;
let root: Root;
let st: ReturnType<typeof usePdvState>;
function Caixa() { st = usePdvState(); return null; }
const equipe = (on: boolean) => { (globalThis as any).__estadoAuth.user = { id: "u-1", is_staff: on }; };
const lojaAtiva = (id: string) => { (globalThis as any).__estadoAuth.company = { id, plan: "negocio" }; };
async function montar() { await act(async () => { root.render(<Caixa />); }); }
async function esperar() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }
const carrinho = () => (st.displayItems as Array<{ productId: string; qty: number; price: number; name: string }>).map((i) => [i.productId, i.qty, i.price]);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try { window.localStorage.clear(); window.sessionStorage.clear(); } catch {}
  (globalThis as any).__produtos = CATALOGO;
  (globalThis as any).__detalhe = { condicional: detalhe() };
  (globalThis as any).__params = { ...URL_COBRAR };
  mockQueries.length = 0;
  [mockToast.error, mockToast.success, mockToast.info, mockInvalidate, mockMutate, mockPush, mockSetParams, mockScan].forEach((m) => (m as jest.Mock).mockClear());
  equipe(true);
  lojaAtiva(LOJA);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => { root.unmount(); });
  host.remove();
  equipe(false);
});

describe("regras da URL e da cobrança", () => {
  test("a URL só vale com id e peças; undefined e vazio não são condicional", () => {
    expect(condicionalDaUrl(URL_COBRAR)).toEqual({ condicionalId: COND_ID, loja: LOJA, itemIds: [I1, I2, I3] });
    expect(condicionalDaUrl({ condicional: COND_ID, itens: "undefined" })).toBeNull();
    expect(condicionalDaUrl({ condicional: "undefined", itens: I1 })).toBeNull();
    expect(condicionalDaUrl({})).toBeNull();
    expect(condicionalDaUrl(null)).toBeNull();
  });
  test("rotas de ida e volta", () => {
    expect(rotaDoCaixaDaCondicional({ id: COND_ID, company_id: LOJA }, [I1, I2])).toBe(`/pdv?condicional=${COND_ID}&loja=${LOJA}&itens=${I1},${I2}`);
    expect(rotaDeVoltaDaCondicional(COND_ID, LOJA)).toBe(`/vendas?tab=condicionais&condicional=${COND_ID}&loja=${LOJA}`);
  });
  test("campos do POST: sem condicional, objeto vazio", () => {
    expect(camposDaCondicionalNaVenda(null)).toEqual({});
    expect(camposDaCondicionalNaVenda({ id: COND_ID, itemIds: [] })).toEqual({});
    expect(camposDaCondicionalNaVenda({ id: COND_ID, itemIds: [I1] })).toEqual({ condicional_id: COND_ID, condicional_item_ids: [I1] });
  });
  test("estado da cobrança: pronta, já cobrada com o número, encerrada, cancelada", () => {
    const d: any = detalhe();
    expect(estadoDaCobranca(d, [I1, I2]).tipo).toBe("pronta");
    d.items[0].sale_id = "venda-9"; d.items[0].venda_numero = 9;
    expect(estadoDaCobranca(d, [I1, I2])).toEqual(expect.objectContaining({ tipo: "bloqueada", motivo: "ja_cobrada", mensagem: "Estas peças já foram cobradas na venda #9." }));
    expect(estadoDaCobranca(detalhe({ status: "encerrada" }) as any, [I1])).toEqual(expect.objectContaining({ motivo: "encerrada" }));
    expect(estadoDaCobranca(detalhe({ status: "cancelada" }) as any, [I1])).toEqual(expect.objectContaining({ motivo: "cancelada" }));
    expect(estadoDaCobranca(d, ["nao-e-desta"])).toEqual(expect.objectContaining({ motivo: "sem_pecas" }));
  });
  test("ids para cobrar: as que ficaram marcadas e as que ficaram sem venda", () => {
    const d: any = detalhe();
    d.items[2].situacao = "ficou";
    expect(idsParaCobrar(d, [I1])).toEqual([I1, I3]);
    d.items[2].sale_id = "v";
    expect(idsParaCobrar(d, [I1])).toEqual([I1]);
  });
  test("erro COND_* reconhecido", () => {
    expect(ehErroDaCondicional({ data: { code: "COND_JA_COBRADA" } })).toBe(true);
    expect(ehErroDaCondicional({ data: { code: "IDEMPOTENCY_KEY_REUSED" } })).toBe(false);
    expect(ehErroDaCondicional(null)).toBe(false);
  });
});

describe("Caixa aberto pela condicional (trava ligada)", () => {
  test("monta o carrinho com as peças, no preço do comprovante, e escolhe a cliente", async () => {
    await montar(); await esperar();
    expect(st.condicional.ativa).toBe(true);
    expect(st.condicional.estado).toEqual({ tipo: "pronta" });
    // 189,90 (retirada), não 999 (catálogo) nem 199,90 (preço de hoje); os dois brincos somam na mesma linha.
    expect(carrinho()).toEqual([[P1 + "__" + V1, 1, 189.9], [P2, 2, 59.9]]);
    expect(st.selectedCustomerId).toBe("cli-1");
    expect(st.selectedCustomerName).toBe("Marina Duarte");
    expect(st.orderLabel).toBe("Condicional C-0007");
    expect(st.cartProps.condicional).toEqual(expect.objectContaining({ numero: "C-0007", cliente: "Marina Duarte" }));
    // o carrinho não é guardado e não vira venda recuperada
    expect(window.localStorage.length).toBe(0);
    expect(st.vendaRecuperada).toBeNull();
  });

  test("carrinho travado: bipe, toque, + − e lixeira não mudam nada; o preço continua editável", async () => {
    await montar(); await esperar();
    const antes = carrinho();
    await act(async () => { st.handleAddProduct(CATALOGO[0] as any); });
    await act(async () => { await st.handleScan("123"); });
    await act(async () => { st.cartProps.onInc(P2); st.cartProps.onDec(P2); st.cartProps.onSetQty(P2, 9); st.cartProps.onRemove(P2); });
    expect(carrinho()).toEqual(antes);
    expect(mockScan).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalled();
    expect(st.cartProps.pedido).toBeNull();
    expect(st.cartProps.comanda).toBeNull();
    expect(st.cartProps.frete).toBeNull();
    expect(st.cartProps.showOrcamento).toBe(false);
    await act(async () => { st.cartProps.onPriceChange(P2, 50); });
    expect(carrinho()).toEqual([[P1 + "__" + V1, 1, 189.9], [P2, 2, 50]]);
  });

  test("Sair: carrinho limpo, cliente fora, nada gravado, Caixa normal de novo", async () => {
    await montar(); await esperar();
    await act(async () => { st.condicional.sair(); });
    await esperar();
    expect(carrinho()).toEqual([]);
    expect(st.selectedCustomerId).toBeNull();
    expect(st.condicional.ativa).toBe(false);
    expect(st.cartProps.condicional).toBeNull();
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockSetParams).toHaveBeenCalled();
    // destravado: o toque entra normalmente
    await act(async () => { st.handleAddProduct(CATALOGO[1] as any); });
    expect(carrinho()).toEqual([[P2, 1, 999]]);
  });

  test("o POST leva condicional_id, os itens e as linhas de produto+variante", async () => {
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const corpo = mockMutate.mock.calls[0][0];
    expect(corpo.condicional_id).toBe(COND_ID);
    expect(corpo.condicional_item_ids).toEqual([I1, I2, I3]);
    expect(corpo.customer_id).toBe("cli-1");
    expect(corpo.items.map((i: any) => [i.product_id, i.variant_id, i.quantity, i.unit_price])).toEqual([[P1, V1, 1, 189.9], [P2, undefined, 2, 59.9]]);
    expect(corpo.comanda_id).toBeUndefined();
  });

  test("venda feita: condicionais, condicional-detalhe, para-resolver e products são invalidadas", async () => {
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    const opcoes = mockMutate.mock.calls[0][1];
    await act(async () => { opcoes.onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
    const chaves = mockInvalidate.mock.calls.map((c) => c[0].queryKey[0]);
    expect(chaves).toEqual(expect.arrayContaining(["condicionais", "condicional-detalhe", "para-resolver", "products"]));
    expect(st.lastSale && st.lastSale.id).toBe("venda-1");
    expect(st.condicional.ativa).toBe(false);
  });

  test("409: a frase do servidor na faixa, sem toast de erro, com Voltar à condicional", async () => {
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    const opcoes = mockMutate.mock.calls[0][1];
    const frase = "Estas peças já foram cobradas na venda #12.";
    await act(async () => { opcoes.onError({ status: 409, message: frase, data: { code: "COND_JA_COBRADA", error: frase } }); });
    expect(st.condicional.aviso).toBe(frase);
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(st.isProcessing).toBe(false);
    await act(async () => { st.condicional.voltarACondicional(); });
    expect(mockPush).toHaveBeenCalledWith(`/vendas?tab=condicionais&condicional=${COND_ID}&loja=${LOJA}`);
    expect(carrinho()).toEqual([]);
  });

  test("outro erro do servidor segue com o toast de sempre", async () => {
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    const opcoes = mockMutate.mock.calls[0][1];
    await act(async () => { opcoes.onError({ status: 422, message: "Cupom expirado", data: { code: "COUPON_EXPIRED", error: "Cupom expirado" } }); });
    expect(mockToast.error).toHaveBeenCalledWith("Cupom expirado");
    expect(st.condicional.aviso).toBeNull();
  });

  test("peça já cobrada ao abrir: frase com o número, carrinho vazio e nada a concluir", async () => {
    const d: any = detalhe();
    d.items[0].sale_id = "venda-9"; d.items[0].venda_numero = 9;
    (globalThis as any).__detalhe = { condicional: d };
    await montar(); await esperar();
    expect(st.condicional.estado).toEqual({ tipo: "bloqueada", mensagem: "Estas peças já foram cobradas na venda #9." });
    expect(st.condicional.aviso).toBe("Estas peças já foram cobradas na venda #9.");
    expect(carrinho()).toEqual([]);
    // sem contexto fixado o Concluir não manda nada (nem venda comum)
    await act(async () => { st.handleFinalize(); });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("Estas peças já foram cobradas na venda #9.");
  });

  test("busca nova que falha ou volta bloqueada com o carrinho montado: o Concluir continua cobrando a condicional", async () => {
    await montar(); await esperar();
    // a busca agora diria "já cobrada" e depois falharia
    const d: any = detalhe();
    d.items[0].sale_id = "venda-9"; d.items[0].venda_numero = 9;
    (globalThis as any).__detalhe = { condicional: d };
    await montar(); await esperar();
    (globalThis as any).__detalhe = undefined;
    await montar(); await esperar();
    expect(st.condicional.estado).toEqual({ tipo: "pronta" });
    expect(st.condicional.naVenda).toEqual({ id: COND_ID, itemIds: [I1, I2, I3] });
    await act(async () => { st.handleFinalize(); });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].condicional_id).toBe(COND_ID);
    // depois de montado a busca fica desligada e não refaz ao focar a janela
    const buscas = mockQueries.filter((q) => q.queryKey && q.queryKey[0] === "condicional-detalhe");
    expect(buscas[buscas.length - 1].enabled).toBe(false);
    expect(buscas.every((q) => q.refetchOnWindowFocus === false)).toBe(true);
  });

  test("mesmo produto+variante com preços diferentes: uma linha por preço, cada uma com o seu", async () => {
    const d: any = detalhe();
    d.items = [peca(I1, P2, null, "Brinco Argola", 59.9), peca(I2, P2, null, "Brinco Argola", 49.9), peca(I3, P2, null, "Brinco Argola", 59.9)];
    (globalThis as any).__detalhe = { condicional: d };
    await montar(); await esperar();
    expect(carrinho()).toEqual([[P2, 2, 59.9], [P2 + "~c2", 1, 49.9]]);
    await act(async () => { st.handleFinalize(); });
    const corpo = mockMutate.mock.calls[0][0];
    expect(corpo.items.map((i: any) => [i.product_id, i.quantity, i.unit_price])).toEqual([[P2, 2, 59.9], [P2, 1, 49.9]]);
    // o sufixo não vaza para a tela final, a NFC-e nem a garantia: as duas linhas levam o UUID limpo
    await act(async () => { mockMutate.mock.calls[0][1].onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
    expect((st.lastSale as any).items.map((i: any) => i.productId)).toEqual([P2, P2]);
  });

  test("leva unidade e 'sai em' do catálogo ao item", async () => {
    (globalThis as any).__produtos = [{ ...CATALOGO[1], unit: "par", notaFiscal: "nfce" }, CATALOGO[0]];
    await montar(); await esperar();
    const it: any = (st.displayItems as any[]).find((i) => i.productId === P2);
    expect(it.unit).toBe("par");
  });

  test("com venda guardada de 3 itens: entrar não apaga, Sair devolve os 3", async () => {
    const itens = [1, 2, 3].map((n) => ({ productId: "g" + n, name: "G" + n, price: 10 * n, qty: 1, listPrice: 10 * n }));
    guardarVenda("co-1", "u-1", { cart: itens, payment: "pix" });
    await montar(); await esperar();
    expect(st.condicional.estado).toEqual({ tipo: "pronta" });
    expect(carrinho().map((c) => c[0])).toEqual([P1 + "__" + V1, P2]);
    expect(recuperarVenda("co-1", "u-1")).not.toBeNull();
    await act(async () => { st.condicional.sair(); });
    await esperar();
    expect(carrinho().map((c) => c[0])).toEqual(["g1", "g2", "g3"]);
    expect(recuperarVenda("co-1", "u-1")).not.toBeNull();
  });

  test("com venda guardada de 3 itens: depois de concluir a condicional, Nova venda devolve os 3", async () => {
    const itens = [1, 2, 3].map((n) => ({ productId: "g" + n, name: "G" + n, price: 10 * n, qty: 1, listPrice: 10 * n }));
    guardarVenda("co-1", "u-1", { cart: itens, payment: "pix" });
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    await act(async () => { mockMutate.mock.calls[0][1].onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
    expect(recuperarVenda("co-1", "u-1")).not.toBeNull();
    await act(async () => { st.newSale(); });
    await esperar();
    expect(carrinho().map((c) => c[0])).toEqual(["g1", "g2", "g3"]);
  });

  test("a próxima venda começa pelo bipe na tela final: a guardada volta junto e o autosave não a perde", async () => {
    const itens = [1, 2, 3].map((n) => ({ productId: "g" + n, name: "G" + n, price: 10 * n, qty: 1, listPrice: 10 * n }));
    guardarVenda("co-1", "u-1", { cart: itens, payment: "pix" });
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    await act(async () => { mockMutate.mock.calls[0][1].onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
    // newSale e o item bipado no mesmo tique, como o abrirVendaNova do Caixa
    await act(async () => { st.newSale(); st.handleAddProduct(CATALOGO[1] as any); });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(carrinho().map((c) => c[0])).toEqual(["g1", "g2", "g3", P2]);
    const guardada: any = recuperarVenda("co-1", "u-1");
    expect(guardada.cart.map((i: any) => i.productId)).toEqual(["g1", "g2", "g3", P2]);
  });

  test("rascunho antigo de garantia não age na venda da condicional e a tela final não emite garantia", async () => {
    (globalThis as any).__settings = { os_enabled: true };
    useWarrantyDraft.getState().setDays(P2, 30);
    useWarrantyDraft.getState().setOn(true);
    try {
      await montar(); await esperar();
      await act(async () => { st.selectCustomer(null, null); });
      expect(st.cartProps.requiredHints.map((h: any) => h.label)).not.toContain("Cliente para a garantia");
      await act(async () => { st.handleFinalize(); });
      await act(async () => { mockMutate.mock.calls[0][1].onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
      expect((st.lastSale as any).daCondicional).toBe(true);
    } finally {
      useWarrantyDraft.getState().reset();
      (globalThis as any).__settings = undefined;
    }
  });

  test("venda comum com o mesmo rascunho de garantia segue exigindo o cliente (caminho comum)", async () => {
    (globalThis as any).__settings = { os_enabled: true };
    (globalThis as any).__params = {};
    useWarrantyDraft.getState().setDays(P2, 30);
    useWarrantyDraft.getState().setOn(true);
    try {
      await montar(); await esperar();
      await act(async () => { st.handleAddProduct(CATALOGO[1] as any); });
      expect(st.cartProps.requiredHints.map((h: any) => h.label)).toContain("Cliente para a garantia");
    } finally {
      useWarrantyDraft.getState().reset();
      (globalThis as any).__settings = undefined;
    }
  });

  test("bipe na tela final com a guardada reposta: o cupom da guardada é revalidado (limpo) como no fluxo comum", async () => {
    const itens = [1, 2].map((n) => ({ productId: "g" + n, name: "G" + n, price: 10 * n, qty: 1, listPrice: 10 * n }));
    guardarVenda("co-1", "u-1", { cart: itens, payment: "pix", couponCode: "OFF10", couponApplied: { code: "OFF10", discount: 5 } });
    await montar(); await esperar();
    await act(async () => { st.handleFinalize(); });
    await act(async () => { mockMutate.mock.calls[0][1].onSuccess({ sale: { id: "venda-1", sale_number: 12 } }); });
    await act(async () => { st.newSale(); st.handleAddProduct(CATALOGO[1] as any); });
    await esperar();
    expect(st.couponApplied).toBeNull();
    expect(carrinho().map((c) => c[0])).toEqual(["g1", "g2", P2]);
  });

  test("venda comum em andamento no carrinho: a condicional não se mistura com ela", async () => {
    (globalThis as any).__params = {};
    await montar(); await esperar();
    await act(async () => { st.handleAddProduct(CATALOGO[1] as any); });
    (globalThis as any).__params = { ...URL_COBRAR };
    await montar(); await esperar();
    expect(st.condicional.estado && st.condicional.estado.tipo).toBe("bloqueada");
    expect(carrinho()).toEqual([[P2, 1, 999]]);
    await act(async () => { st.handleFinalize(); });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test("loja do Caixa diferente da dona: avisa, não monta o carrinho, não busca na loja errada", async () => {
    lojaAtiva("co-2");
    await montar(); await esperar();
    expect(st.condicional.estado && st.condicional.estado.tipo).toBe("outra_loja");
    expect(carrinho()).toEqual([]);
    const busca = mockQueries.filter((q) => q.queryKey && q.queryKey[0] === "condicional-detalhe");
    expect(busca.every((q) => q.enabled === false)).toBe(true);
    await act(async () => { st.condicional.trocarDeLoja(); });
    expect((globalThis as any).__estadoAuth.switchCompany).toHaveBeenCalledWith(LOJA);
  });
});

describe("sem a trava, o Caixa é o de sempre", () => {
  test("lojista com ?condicional= na URL: nada é buscado, montado nem travado", async () => {
    equipe(false);
    await montar(); await esperar();
    expect(st.comClientesLiberado).toBe(false);
    expect(st.condicional.ativa).toBe(false);
    expect(carrinho()).toEqual([]);
    expect(st.cartProps.condicional).toBeNull();
    expect(st.orderLabel).toBe("Nova venda");
    const busca = mockQueries.filter((q) => q.queryKey && q.queryKey[0] === "condicional-detalhe");
    expect(busca.every((q) => q.enabled === false)).toBe(true);
    await act(async () => { st.handleAddProduct(CATALOGO[1] as any); });
    await act(async () => { st.cartProps.onInc(P2); });
    expect(carrinho()).toEqual([[P2, 2, 999]]);
    await act(async () => { st.handleFinalize(); });
    const corpo = mockMutate.mock.calls[0][0];
    expect("condicional_id" in corpo).toBe(false);
    expect("condicional_item_ids" in corpo).toBe(false);
  });

  test("equipe Aura sem ?condicional= na URL: Caixa normal, também sem campos no POST", async () => {
    (globalThis as any).__params = {};
    await montar(); await esperar();
    expect(st.condicional.ativa).toBe(false);
    await act(async () => { st.handleAddProduct(CATALOGO[1] as any); });
    await act(async () => { st.handleFinalize(); });
    const corpo = mockMutate.mock.calls[0][0];
    expect("condicional_id" in corpo).toBe(false);
  });
});
