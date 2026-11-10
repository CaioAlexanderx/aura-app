// ============================================================
// Entrega da venda do Caixa (09/11/2026, parte 2) — utils/entregaDaVenda.ts
//   - a trava: só com frete; cliente sem endereço -> "endereco"; sem
//     cliente -> "quem"; entrega preenchida vale só para o mesmo cliente;
//   - o corpo da venda: delivery_check com frete; delivery_address e o
//     cliente inline só quando a trava juntou;
//   - a caixinha: marcada com frete, desmarcada sem frete, some sem endereço;
//   - Bobina/A4 lembrado, sem quebrar quando o armazenamento falha;
//   - a rota do cupom sem o papel é EXATAMENTE a de sempre.
// ============================================================
import {
  precisaPedirEntrega, camposDaEntregaNaVenda, caixinhaDaEntrega, entregaValeParaACliente,
  lerFormatoDoPapel, gravarFormatoDoPapel, CHAVE_DO_FORMATO, rotaDoCupom, rotaDoPapelA4,
  encadearPapelA4, MARCA_DO_ENCADEAMENTO, faltandoNaEntrega, textoDoQueFalta, type EntregaDaVenda,
} from "@/utils/entregaDaVenda";
import { ENDERECO_VAZIO, type Endereco } from "@/components/endereco/endereco";

const END: Endereco = {
  ...ENDERECO_VAZIO, zip: "04538132", street: "Rua Jerônimo da Veiga", number: "45",
  neighborhood: "Itaim Bibi", city: "São Paulo", state: "SP", reference: "portão azul",
};
const ENTREGA: EntregaDaVenda = {
  customerId: "c1", nome: "Cliente Teste", telefone: "(11) 95555-4321", endereco: END, recado: "interfone 32", novoCliente: false,
};
const NOVA: EntregaDaVenda = { ...ENTREGA, customerId: null, novoCliente: true };

describe("precisaPedirEntrega", () => {
  test("sem frete: nunca pergunta", () => {
    expect(precisaPedirEntrega({ frete: 0, customerId: null, clienteTemEndereco: false, entrega: null })).toBeNull();
    expect(precisaPedirEntrega({ frete: 0, customerId: "c1", clienteTemEndereco: false, entrega: null })).toBeNull();
  });
  test("frete com cliente sem endereço: 'endereco'", () => {
    expect(precisaPedirEntrega({ frete: 15, customerId: "c1", clienteTemEndereco: false, entrega: null })).toBe("endereco");
  });
  test("frete sem cliente: 'quem'", () => {
    expect(precisaPedirEntrega({ frete: 15, customerId: null, clienteTemEndereco: false, entrega: null })).toBe("quem");
  });
  test("frete com cliente que tem endereço: segue", () => {
    expect(precisaPedirEntrega({ frete: 15, customerId: "c1", clienteTemEndereco: true, entrega: null })).toBeNull();
  });
  test("entrega já preenchida para este cliente: segue; para outro: pergunta de novo", () => {
    expect(precisaPedirEntrega({ frete: 15, customerId: "c1", clienteTemEndereco: false, entrega: ENTREGA })).toBeNull();
    expect(precisaPedirEntrega({ frete: 15, customerId: "c2", clienteTemEndereco: false, entrega: ENTREGA })).toBe("endereco");
    expect(precisaPedirEntrega({ frete: 15, customerId: null, clienteTemEndereco: false, entrega: NOVA })).toBeNull();
    expect(precisaPedirEntrega({ frete: 15, customerId: "c1", clienteTemEndereco: false, entrega: NOVA })).toBe("endereco");
  });
  test("entrega incompleta não vale", () => {
    expect(entregaValeParaACliente({ ...ENTREGA, endereco: { ...END, number: "" } }, "c1")).toBe(false);
    expect(entregaValeParaACliente({ ...NOVA, nome: " " }, null)).toBe(false);
  });
});

describe("o que falta", () => {
  test("nome entra só no 'Quem recebe'", () => {
    expect(faltandoNaEntrega(ENDERECO_VAZIO, { pedeNome: true, nome: "" })).toEqual(["nome", "CEP ou rua", "número", "cidade"]);
    expect(faltandoNaEntrega(ENDERECO_VAZIO, { pedeNome: false })).toEqual(["CEP ou rua", "número", "cidade"]);
    expect(textoDoQueFalta(["número", "cidade"])).toBe("número e cidade");
    expect(textoDoQueFalta(["nome", "número", "cidade"])).toBe("nome, número e cidade");
  });
});

describe("camposDaEntregaNaVenda", () => {
  test("sem frete e sem entrega: nada (corpo de sempre)", () => {
    expect(camposDaEntregaNaVenda(null, { frete: 0, customerId: "c1" })).toEqual({});
  });
  test("frete com cliente que tem endereço: só o delivery_check", () => {
    expect(camposDaEntregaNaVenda(null, { frete: 15, customerId: "c1" })).toEqual({ delivery_check: true });
  });
  test("cliente sem endereço: delivery_address com recado, sem cliente inline", () => {
    const b = camposDaEntregaNaVenda(ENTREGA, { frete: 15, customerId: "c1" });
    expect(b).toEqual({
      delivery_check: true,
      delivery_address: {
        zip_code: "04538132", street: "Rua Jerônimo da Veiga", number: "45", complement: null,
        neighborhood: "Itaim Bibi", city: "São Paulo", state: "SP", address_reference: "portão azul",
        name: "Cliente Teste", phone: "11955554321", note: "interfone 32",
      },
    });
  });
  test("sem cliente: cliente inline com nome, telefone e endereço", () => {
    const b = camposDaEntregaNaVenda(NOVA, { frete: 15, customerId: null });
    expect(b.customer).toEqual({
      name: "Cliente Teste", phone: "11955554321",
      zip_code: "04538132", street: "Rua Jerônimo da Veiga", number: "45", complement: null,
      neighborhood: "Itaim Bibi", city: "São Paulo", state: "SP", address_reference: "portão azul",
    });
    expect(b.delivery_address.name).toBe("Cliente Teste");
  });
  test("entrega de outro cliente não vai", () => {
    expect(camposDaEntregaNaVenda(ENTREGA, { frete: 15, customerId: "c2" })).toEqual({ delivery_check: true });
  });
});

describe("caixinhaDaEntrega", () => {
  test("com frete e endereço: aparece marcada", () => {
    expect(caixinhaDaEntrega({ frete: 15, endereco: END })).toEqual({ mostra: true, marcada: true });
  });
  test("sem frete, cliente com endereço: aparece desmarcada", () => {
    expect(caixinhaDaEntrega({ frete: 0, endereco: END })).toEqual({ mostra: true, marcada: false });
  });
  test("sem endereço: não aparece", () => {
    expect(caixinhaDaEntrega({ frete: 0, endereco: null })).toEqual({ mostra: false, marcada: false });
    expect(caixinhaDaEntrega({ frete: 15, endereco: ENDERECO_VAZIO })).toEqual({ mostra: false, marcada: false });
  });
});

describe("Bobina / A4 lembrado no computador", () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });
  test("padrão bobina; grava e lê A4", () => {
    expect(lerFormatoDoPapel()).toBe("bobina");
    gravarFormatoDoPapel("a4");
    expect(localStorage.getItem(CHAVE_DO_FORMATO)).toBe("a4");
    expect(lerFormatoDoPapel()).toBe("a4");
  });
  test("armazenamento que lança: não quebra, volta bobina", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => gravarFormatoDoPapel("a4")).not.toThrow();
    expect(lerFormatoDoPapel()).toBe("bobina");
    get.mockRestore(); set.mockRestore();
  });
});

describe("rotas e a janela única", () => {
  test("sem o papel: a rota do cupom é a de sempre, sem parâmetro", () => {
    expect(rotaDoCupom("https://api", "co", "v1", false)).toBe("https://api/companies/co/print/receipt/v1/preview");
    expect(rotaDoCupom("https://api", "co", "v1", true)).toBe("https://api/companies/co/print/receipt/v1/preview?entrega=1");
    expect(rotaDoPapelA4("https://api", "co", "v1")).toBe("https://api/companies/co/print/delivery/v1?format=a4&autoprint=1");
  });
  test("A4: o cupom ganha o encadeamento antes do </body>, depois de imprimir", () => {
    const cupom = "<html><body><div>cupom</div>\n</body>\n</html>";
    const out = encadearPapelA4(cupom, "blob:https://app/abc");
    expect(out.startsWith("<html><body><div>cupom</div>\n")).toBe(true);
    expect(out.endsWith("</body>\n</html>")).toBe(true);
    expect(out).toContain(MARCA_DO_ENCADEAMENTO);
    expect(out).toContain('window.addEventListener("afterprint",ir)');
    expect(out).toContain('location.href="blob:https://app/abc"');
    expect(out).not.toContain("window.open");
  });
});

describe("seguir sem identificar (10/11/2026, incidente)", () => {
  test("dispensada: não pergunta, com ou sem cliente", () => {
    expect(precisaPedirEntrega({ frete: 15, customerId: null, clienteTemEndereco: false, entrega: null, dispensada: true })).toBeNull();
    expect(precisaPedirEntrega({ frete: 15, customerId: "c1", clienteTemEndereco: false, entrega: null, dispensada: true })).toBeNull();
  });
  test("dispensada: sem delivery_check (o servidor não trava); sem frete segue igual", () => {
    expect(camposDaEntregaNaVenda(null, { frete: 15, customerId: null, dispensada: true })).toEqual({});
    expect(camposDaEntregaNaVenda(null, { frete: 15, customerId: "c1", dispensada: true })).toEqual({});
    expect(camposDaEntregaNaVenda(null, { frete: 0, customerId: null, dispensada: true })).toEqual({});
    expect(camposDaEntregaNaVenda(null, { frete: 15, customerId: null, dispensada: false })).toEqual({ delivery_check: true });
  });
  test("caixinha sem endereço: não aparece (venda sem cliente com frete)", () => {
    expect(caixinhaDaEntrega({ frete: 15, endereco: null })).toEqual({ mostra: false, marcada: false });
  });
});
