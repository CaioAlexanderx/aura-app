// ============================================================
// QA 23/09/2026 (Matcon): trocar o tema claro/escuro recarregava a página e o
// carrinho do Caixa sumia sem aviso. 14/10/2026: o mesmo carrinho também
// sumia ao trocar de página e voltar. A venda em andamento agora é guardada a
// cada mudança e ao sair da tela (utils/vendaGuardada + hooks/useCart), no
// localStorage, por empresa + usuário, com validade de 24 h.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
let mockEmpresa: string | null = "empresa-1";
let mockUsuario: string | null = "user-1";
let mockDemo = false;
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    company: mockEmpresa ? { id: mockEmpresa } : null,
    user: mockUsuario ? { id: mockUsuario } : null,
    isDemo: mockDemo,
  }),
}));
jest.mock("@/services/api", () => ({ pdvApi: { createSale: jest.fn() } }));
// O POST da venda: cada teste diz como o servidor responde.
let mockResposta: "pendente" | "ok" | "erro" = "pendente";
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutate: (_body: any, cbs: any) => {
      if (mockResposta === "ok") cbs.onSuccess({ sale: { id: "venda-1", sale_number: 7 } });
      else if (mockResposta === "erro") cbs.onError({ message: "falhou" });
    },
  }),
}));

import { useCart } from "@/hooks/useCart";
import {
  apagarTodasAsVendasGuardadas, apagarVendaGuardada, apagarVendasDeOutrosUsuarios,
  guardarAntesDeRecarregar, guardarVenda, recuperarVenda, VALIDADE_DA_VENDA_GUARDADA_MS,
  __zerarParaTestes,
} from "@/utils/vendaGuardada";

const CHAVE = "aura:caixa:venda:empresa-1:user-1";
const HORA = 60 * 60 * 1000;

let api: ReturnType<typeof useCart>;
function Harness({ opcoes }: { opcoes?: { recuperar?: boolean } }) {
  api = useCart(undefined, opcoes);
  return null;
}
function montar(opcoes?: { recuperar?: boolean }) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Harness opcoes={opcoes} />); });
  return tree;
}
function remontar(tree: renderer.ReactTestRenderer, opcoes?: { recuperar?: boolean }) {
  act(() => { tree.update(<Harness opcoes={opcoes} />); });
}
function esperarDebounce() {
  act(() => { jest.advanceTimersByTime(500); });
}
function guardado(chave: string = CHAVE): any {
  const bruto = window.localStorage.getItem(chave);
  return bruto ? JSON.parse(bruto) : null;
}
function chavesDaVenda(): string[] {
  const ks: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)!;
    if (k.indexOf("aura:caixa:venda:") === 0) ks.push(k);
  }
  return ks;
}
/** Uma venda com cliente, CPF e pagamento — o que o Caixa guarda. */
function montarVenda() {
  act(() => { api.addToCart({ id: "piso", name: "Porcelanato", price: 64.8 }); });
  act(() => { api.setQty("piso", 18.56); });
  act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
  act(() => { api.setPayment("cartao"); });
  act(() => { api.selectCustomer("cli-1", "Dona Maria", "11999990000"); });
  act(() => { api.setCpfNaNota("123.456.789-09"); });
}

beforeEach(() => {
  jest.useFakeTimers();
  __zerarParaTestes();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockEmpresa = "empresa-1";
  mockUsuario = "user-1";
  mockDemo = false;
  mockResposta = "pendente";
});
afterEach(() => { jest.useRealTimers(); });

describe("utils/vendaGuardada", () => {
  test("guarda e recupera na mesma empresa e usuário, sem apagar na leitura", () => {
    guardarVenda("empresa-1", "user-1", { cart: [1] }, 1000);
    expect(recuperarVenda("empresa-1", "user-1", 2000)).toEqual({ cart: [1] });
    // A guarda é contínua: ler de novo devolve a mesma venda.
    expect(recuperarVenda("empresa-1", "user-1", 3000)).toEqual({ cart: [1] });
  });

  test("é da empresa: outra empresa não recupera (e a venda continua lá)", () => {
    guardarVenda("empresa-1", "user-1", { cart: [1] }, 1000);
    expect(recuperarVenda("empresa-2", "user-1", 2000)).toBeNull();
    expect(recuperarVenda("empresa-1", "user-1", 2000)).toEqual({ cart: [1] });
  });

  test("uma venda por empresa: guardar em uma não mexe na outra", () => {
    guardarVenda("empresa-1", "user-1", { cart: ["a"] }, 1000);
    guardarVenda("empresa-2", "user-1", { cart: ["b"] }, 1000);
    expect(recuperarVenda("empresa-1", "user-1", 2000)).toEqual({ cart: ["a"] });
    expect(recuperarVenda("empresa-2", "user-1", 2000)).toEqual({ cart: ["b"] });
  });

  test("é do usuário: outro usuário no mesmo navegador não herda, e a venda dele some", () => {
    guardarVenda("empresa-1", "user-1", { cart: [1] }, 1000);
    expect(recuperarVenda("empresa-1", "user-2", 2000)).toBeNull();
    // Quem entrou varreu a venda do usuário anterior.
    expect(chavesDaVenda()).toEqual([]);
  });

  test("validade de 24 h: dentro devolve, passou apaga e não devolve", () => {
    guardarVenda("empresa-1", "user-1", { cart: [1] }, 0);
    expect(recuperarVenda("empresa-1", "user-1", VALIDADE_DA_VENDA_GUARDADA_MS - 1000)).toEqual({ cart: [1] });
    expect(recuperarVenda("empresa-1", "user-1", VALIDADE_DA_VENDA_GUARDADA_MS + 1)).toBeNull();
    expect(chavesDaVenda()).toEqual([]);
    expect(VALIDADE_DA_VENDA_GUARDADA_MS).toBe(24 * HORA);
  });

  test("sem empresa ou sem usuário não guarda nem recupera", () => {
    expect(guardarVenda(null, "user-1", { cart: [1] })).toBe(false);
    expect(guardarVenda("empresa-1", null, { cart: [1] })).toBe(false);
    expect(chavesDaVenda()).toEqual([]);
    expect(recuperarVenda(null, "user-1")).toBeNull();
    expect(recuperarVenda("empresa-1", null)).toBeNull();
  });

  test("apagarVendaGuardada tira só a desta empresa e usuário", () => {
    guardarVenda("empresa-1", "user-1", { cart: ["a"] }, 1000);
    guardarVenda("empresa-2", "user-1", { cart: ["b"] }, 1000);
    apagarVendaGuardada("empresa-1", "user-1");
    expect(recuperarVenda("empresa-1", "user-1", 2000)).toBeNull();
    expect(recuperarVenda("empresa-2", "user-1", 2000)).toEqual({ cart: ["b"] });
  });

  test("logout: apaga todas, de qualquer empresa e usuário, e não mexe em outras chaves", () => {
    guardarVenda("empresa-1", "user-1", { cart: ["a"] }, 1000);
    guardarVenda("empresa-2", "user-1", { cart: ["b"] }, 1000);
    window.localStorage.setItem("aura_theme", "dark");
    apagarTodasAsVendasGuardadas();
    expect(chavesDaVenda()).toEqual([]);
    expect(window.localStorage.getItem("aura_theme")).toBe("dark");
  });

  test("login: apaga as de outro usuário e mantém as do próprio", () => {
    guardarVenda("empresa-1", "user-1", { cart: ["a"] }, 1000);
    guardarVenda("empresa-1", "user-2", { cart: ["b"] }, 1000);
    apagarVendasDeOutrosUsuarios("user-2", 2000);
    expect(chavesDaVenda()).toEqual(["aura:caixa:venda:empresa-1:user-2"]);
  });

  test("dado corrompido no storage não quebra: devolve null", () => {
    window.localStorage.setItem(CHAVE, "{isso não é json");
    expect(recuperarVenda("empresa-1", "user-1")).toBeNull();
  });

  test("sem storage (aba anônima com bloqueio) nada lança", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("bloqueado"); } });
    try {
      expect(guardarVenda("empresa-1", "user-1", { cart: [1] })).toBe(false);
      expect(recuperarVenda("empresa-1", "user-1")).toBeNull();
      expect(() => apagarVendaGuardada("empresa-1", "user-1")).not.toThrow();
      expect(() => apagarTodasAsVendasGuardadas()).not.toThrow();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("Caixa: guardar a cada mudança", () => {
  test("a venda vai para o localStorage depois do debounce, com tudo que o tipo já tem", () => {
    const t = montar();
    montarVenda();
    expect(guardado()).toBeNull(); // ainda no debounce
    esperarDebounce();
    const env = guardado();
    expect(env).not.toBeNull();
    expect(env.empresa).toBe("empresa-1");
    expect(env.usuario).toBe("user-1");
    expect(env.dados.cart.map((i: any) => [i.productId, i.qty])).toEqual([["piso", 18.56], ["cim", 1]]);
    expect(env.dados.payment).toBe("cartao");
    expect(env.dados.selectedCustomerId).toBe("cli-1");
    expect(env.dados.cpfNaNota).toBe("123.456.789-09");
    act(() => { t.unmount(); });
  });

  test("cada mudança regrava (quantidade nova chega ao storage)", () => {
    const t = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    esperarDebounce();
    expect(guardado().dados.cart[0].qty).toBe(1);
    act(() => { api.updateQty("cim", 2); });
    esperarDebounce();
    expect(guardado().dados.cart[0].qty).toBe(3);
    act(() => { t.unmount(); });
  });

  test("não guarda nada além do tipo da venda (sem token, senha ou pagamento extra)", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    const campos = Object.keys(guardado().dados).sort();
    // idempotencyKey (17/10/2026, tq-15): uuid aleatório da venda, não é
    // credencial — viaja para a outra aba mandar a mesma chave.
    expect(campos).toEqual([
      "cart", "comanda", "couponApplied", "couponCode", "couponRule", "cpfNaNota", "discountType", "discountValue",
      "idempotencyKey", "lotAllocations", "payment", "quoteId", "selectedCustomerId", "selectedCustomerName", "selectedCustomerPhone",
      "selectedEmployeeId", "selectedEmployeeName", "sellerName", "splitMode", "splitPayments",
    ].sort());
    act(() => { t.unmount(); });
  });

  test("sair da tela leva o último estado sem esperar o debounce", () => {
    const t = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    expect(guardado()).toBeNull();
    act(() => { t.unmount(); });
    expect(guardado().dados.cart.map((i: any) => i.productId)).toEqual(["cim"]);
  });

  test("carrinho vazio ao sair não guarda nada", () => {
    const t = montar();
    act(() => { t.unmount(); });
    expect(chavesDaVenda()).toEqual([]);
  });

  test("demo não guarda", () => {
    mockDemo = true;
    const t = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    esperarDebounce();
    act(() => { t.unmount(); });
    expect(chavesDaVenda()).toEqual([]);
  });
});

describe("Caixa: restaurar ao abrir", () => {
  function guardarEDesmontar() {
    const t = montar();
    montarVenda();
    act(() => { t.unmount(); });
  }

  test("abre com a venda guardada e carrinho vazio: restaura em silêncio e acende a faixa", () => {
    guardarEDesmontar();
    __zerarParaTestes(); // "página nova"
    const t = montar();
    expect(api.cart.map((i) => [i.productId, i.qty])).toEqual([["piso", 18.56], ["cim", 1]]);
    expect(api.payment).toBe("cartao");
    expect(api.selectedCustomerName).toBe("Dona Maria");
    expect(api.cpfNaNota).toBe("123.456.789-09");
    expect(api.vendaRecuperada?.itens).toHaveLength(2);
    const { toast } = require("@/components/Toast");
    expect(toast.info).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("a faixa some quando o carrinho esvazia e quando o lojista dispensa", () => {
    guardarEDesmontar();
    const t = montar();
    expect(api.vendaRecuperada).not.toBeNull();
    act(() => { api.dispensarVendaRecuperada(); });
    expect(api.vendaRecuperada).toBeNull();
    expect(api.cart).toHaveLength(2); // dispensar mantém a venda
    act(() => { t.unmount(); });

    guardarEDesmontar();
    const t2 = montar();
    expect(api.vendaRecuperada).not.toBeNull();
    act(() => { api.removeItem("piso"); });
    act(() => { api.removeItem("cim"); });
    expect(api.vendaRecuperada).toBeNull();
    act(() => { t2.unmount(); });
  });

  test("é por empresa: em outro CNPJ o Caixa abre vazio e a venda da primeira continua guardada", () => {
    guardarEDesmontar();
    mockEmpresa = "empresa-2";
    const t = montar();
    expect(api.cart).toHaveLength(0);
    expect(api.vendaRecuperada).toBeNull();
    expect(guardado()).not.toBeNull();
    act(() => { t.unmount(); });
    // Voltando à empresa 1, ela está lá.
    mockEmpresa = "empresa-1";
    const t2 = montar();
    expect(api.cart).toHaveLength(2);
    act(() => { t2.unmount(); });
  });

  test("é por usuário: outro usuário no mesmo navegador não herda o carrinho", () => {
    guardarEDesmontar();
    mockUsuario = "user-2";
    const t = montar();
    expect(api.cart).toHaveLength(0);
    expect(api.selectedCustomerName).toBeNull();
    act(() => { t.unmount(); });
    expect(chavesDaVenda()).toEqual([]);
  });

  test("a empresa chega depois da abertura: a venda espera e volta", () => {
    guardarEDesmontar();
    mockEmpresa = null;
    const t = montar();
    expect(api.cart).toHaveLength(0);
    expect(guardado()).not.toBeNull();
    mockEmpresa = "empresa-1";
    remontar(t);
    expect(api.cart).toHaveLength(2);
    act(() => { t.unmount(); });
  });

  test("carrinho que já começou nesta página nunca é sobrescrito", () => {
    guardarEDesmontar();
    mockEmpresa = null;
    const t = montar();
    act(() => { api.addToCart({ id: "arg", name: "Argamassa", price: 22 }); });
    mockEmpresa = "empresa-1";
    remontar(t);
    expect(api.cart.map((i) => i.productId)).toEqual(["arg"]);
    expect(api.vendaRecuperada).toBeNull();
    act(() => { t.unmount(); });
  });

  test("passou de 24 h: abre vazio e a guarda vencida é apagada", () => {
    guardarEDesmontar();
    const env = guardado();
    env.em = Date.now() - VALIDADE_DA_VENDA_GUARDADA_MS - 1000;
    window.localStorage.setItem(CHAVE, JSON.stringify(env));
    const t = montar();
    expect(api.cart).toHaveLength(0);
    expect(chavesDaVenda()).toEqual([]);
    act(() => { t.unmount(); });
  });

  test("dentro de 24 h ainda volta (23 h depois)", () => {
    guardarEDesmontar();
    const env = guardado();
    env.em = Date.now() - 23 * HORA;
    window.localStorage.setItem(CHAVE, JSON.stringify(env));
    const t = montar();
    expect(api.cart).toHaveLength(2);
    act(() => { t.unmount(); });
  });

  test("Caixa aberto com ?quote= (recuperar: false) não restaura por cima do orçamento", () => {
    guardarEDesmontar();
    const t = montar({ recuperar: false });
    expect(api.cart).toHaveLength(0);
    expect(api.vendaRecuperada).toBeNull();
    act(() => { t.unmount(); });
  });

  test("item inválido no storage fica de fora; venda sem item válido é descartada", () => {
    window.localStorage.setItem(CHAVE, JSON.stringify({
      v: 2, empresa: "empresa-1", usuario: "user-1", em: Date.now(),
      dados: { cart: [
        { productId: "ok", name: "Bom", price: 10, qty: 1 },
        { productId: "", name: "Sem id", price: 10, qty: 1 },
        { productId: "neg", name: "Qtd zero", price: 10, qty: 0 },
        { productId: "nan", name: "Sem preço", price: "x", qty: 1 },
      ] },
    }));
    const t = montar();
    expect(api.cart.map((i) => i.productId)).toEqual(["ok"]);
    act(() => { t.unmount(); });

    window.localStorage.setItem(CHAVE, JSON.stringify({
      v: 2, empresa: "empresa-1", usuario: "user-1", em: Date.now(),
      dados: { cart: [{ productId: "", name: "x", price: 1, qty: 1 }] },
    }));
    const t2 = montar();
    expect(api.cart).toHaveLength(0);
    expect(chavesDaVenda()).toEqual([]);
    act(() => { t2.unmount(); });
  });
});

describe("Caixa: a guarda sai quando a venda acaba", () => {
  test("finalizar a venda apaga a guarda; voltar ao Caixa abre vazio", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    expect(guardado()).not.toBeNull();
    mockResposta = "ok";
    act(() => { api.finalizeSale(); });
    expect(api.lastSale?.id).toBe("venda-1");
    expect(api.cart).toHaveLength(0);
    esperarDebounce();
    expect(guardado()).toBeNull();
    act(() => { t.unmount(); });
    expect(guardado()).toBeNull();

    __zerarParaTestes();
    const t2 = montar();
    expect(api.cart).toHaveLength(0);
    act(() => { t2.unmount(); });
  });

  test("venda em voo: sair da tela não regrava o carrinho (o servidor já registrou)", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    mockResposta = "pendente"; // o POST não respondeu
    act(() => { api.finalizeSale(); });
    expect(guardado()).toBeNull();
    // Mudança durante o voo também não regrava.
    esperarDebounce();
    act(() => { t.unmount(); });
    expect(guardado()).toBeNull();
    __zerarParaTestes();
    const t2 = montar();
    expect(api.cart).toHaveLength(0);
    act(() => { t2.unmount(); });
  });

  test("o POST falhou com a tela aberta: o carrinho volta a ser guardado", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    mockResposta = "erro";
    act(() => { api.finalizeSale(); });
    expect(api.cart).toHaveLength(2);
    expect(api.isProcessing).toBe(false);
    esperarDebounce();
    expect(guardado()).not.toBeNull();
    expect(guardado().dados.cart).toHaveLength(2);
    act(() => { t.unmount(); });
  });

  test("Nova venda (e lançar na comanda, que limpa por ela) apaga a guarda", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    expect(guardado()).not.toBeNull();
    act(() => { api.newSale(); });
    expect(guardado()).toBeNull();
    expect(api.cart).toHaveLength(0);
    act(() => { t.unmount(); });
    expect(guardado()).toBeNull();
  });

  test("Limpar (tirar os itens um a um) apaga a guarda", () => {
    const t = montar();
    montarVenda();
    esperarDebounce();
    act(() => { api.removeItem("piso"); });
    esperarDebounce();
    expect(guardado().dados.cart.map((i: any) => i.productId)).toEqual(["cim"]);
    act(() => { api.removeItem("cim"); });
    expect(guardado()).toBeNull();
    act(() => { t.unmount(); });
    expect(guardado()).toBeNull();
  });

  test("Limpar na faixa 'Venda recuperada' (newSale) zera o carrinho e a guarda", () => {
    const t0 = montar();
    montarVenda();
    act(() => { t0.unmount(); });
    __zerarParaTestes();
    const t = montar();
    expect(api.vendaRecuperada).not.toBeNull();
    act(() => { api.newSale(); });
    expect(api.cart).toHaveLength(0);
    expect(api.vendaRecuperada).toBeNull();
    expect(guardado()).toBeNull();
    act(() => { t.unmount(); });
    expect(guardado()).toBeNull();
  });
});

describe("Caixa: a troca de tema continua levando a venda", () => {
  test("guardarAntesDeRecarregar guarda na hora, sem esperar o debounce", () => {
    const t = montar();
    act(() => { api.addToCart({ id: "cim", name: "Cimento", price: 38 }); });
    expect(guardado()).toBeNull();
    expect(guardarAntesDeRecarregar()).toBe(true);
    expect(guardado().dados.cart[0].productId).toBe("cim");
    act(() => { t.unmount(); });
  });

  test("carrinho vazio: não guarda e devolve false (o toggle não avisa)", () => {
    const t = montar();
    expect(guardarAntesDeRecarregar()).toBe(false);
    expect(chavesDaVenda()).toEqual([]);
    act(() => { t.unmount(); });
  });

  test("Caixa desmontado não guarda (o registro sai no cleanup)", () => {
    const t = montar();
    act(() => { t.unmount(); });
    expect(guardarAntesDeRecarregar()).toBe(false);
  });

  test("a recarga: venda guardada antes volta numa página nova", () => {
    const antes = montar();
    montarVenda();
    guardarAntesDeRecarregar();
    act(() => { antes.unmount(); });
    __zerarParaTestes(); // a recarga zera o que vive em memória
    const depois = montar();
    expect(api.cart.map((i) => [i.productId, i.qty])).toEqual([["piso", 18.56], ["cim", 1]]);
    expect(api.payment).toBe("cartao");
    act(() => { depois.unmount(); });
  });
});
