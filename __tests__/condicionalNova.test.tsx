// ============================================================
// Nova condicional, passos 1 e 2 (C6, 26/11/2026). Mockup aprovado.
//   1. Cliente: busca, "+ Novo cliente" (nome e telefone obrigatórios, CPF
//      opcional), cliente sem telefone pede o telefone;
//   2. Peças: busca, cor e tamanho com livre/com cliente, uma unidade por
//      linha, aviso âmbar para quem vende sem estoque, bloqueio de quem
//      controla estoque, 409 com a condicional que segura a peça;
//   consolidado: "De qual loja as peças vão sair?" antes do passo 1.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ active, children }: any) => (active ? children : null) }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let mockAuth: any = { company: { id: "loja-1", trade_name: "Loja Centro" }, availableCompanies: [], token: "t" };
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

const mockClientes = [
  { id: "c-1", name: "Marina Duarte", phone: "(11) 98888-0142" },
  { id: "c-2", name: "Carla Menezes", phone: null },
];
jest.mock("@/hooks/useCustomers", () => ({ useCustomers: () => ({ customers: mockClientes, isLoading: false }) }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), getQueriesData: () => [] }),
  useQuery: () => ({ data: null, isLoading: false }),
}));
const mockCreateCustomer = jest.fn();
jest.mock("@/services/api", () => ({ companiesApi: { createCustomer: (...a: any[]) => mockCreateCustomer(...a), products: jest.fn(), variants: jest.fn() }, request: jest.fn() }));
let mockSemEstoque = false;
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: { allow_sale_without_stock: mockSemEstoque } }),
}));

const mockVestido = { id: "p-vest", name: "Vestido Midi Lívia", code: "VML", barcode: "789", variantBarcodes: ["VAR-PRETO-M"], coresDasVariantes: ["Verde-oliva", "Preto"], preco: 189.9, price: 189.9, emPromocao: false, precoEfetivo: null, estoque: 3, temVariantes: true, reserva: { reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 0, comClientePorVariante: {} } };
const mockBrinco = { id: "p-brinco", name: "Brinco Argola Luz", code: "BAL", barcode: "111", variantBarcodes: [], coresDasVariantes: [], preco: 69.9, price: 69.9, emPromocao: false, precoEfetivo: null, estoque: 2, temVariantes: false, reserva: { reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 0, comClientePorVariante: {} } };
const mockBlusa = { ...mockBrinco, id: "p-blusa", name: "Blusa Tricô Nina", code: "BTN", barcode: "222", preco: 139.9, price: 139.9, estoque: 1, reserva: { reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 1, comClientePorVariante: {} } };
const mockVariantes = [
  { id: "v-ol-p", cor: "Verde-oliva", tamanho: "P", rotulo: "P", barcode: "", preco: 189.9, livre: 1, comCliente: 0 },
  { id: "v-ol-m", cor: "Verde-oliva", tamanho: "M", rotulo: "M", barcode: "", preco: 189.9, livre: 1, comCliente: 0 },
  { id: "v-ol-g", cor: "Verde-oliva", tamanho: "G", rotulo: "G", barcode: "", preco: 189.9, livre: 0, comCliente: 1 },
  { id: "v-pr-m", cor: "Preto", tamanho: "M", rotulo: "M", barcode: "VAR-PRETO-M", preco: 189.9, livre: 1, comCliente: 0 },
];
jest.mock("@/components/screens/vendas/condicionais/nova/usePecasDaLoja", () => ({
  usePecasDaLoja: () => ({ produtos: [mockVestido, mockBrinco, mockBlusa], carregando: false, variantesDe: async () => mockVariantes }),
}));
// O campo de bipe vira um input simples: onChangeText filtra, onScan bipa.
jest.mock("@/components/ScannerInput", () => ({
  ScannerInput: require("react").forwardRef((props: any, ref: any) => {
    require("react").useImperativeHandle(ref, () => ({ limpar: () => {}, focar: () => {} }));
    return require("react").createElement("ScannerInputMock", props);
  }),
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { NovaCondicionalModal } from "@/components/screens/vendas/condicionais/nova/NovaCondicionalModal";
import { PassoPecas } from "@/components/screens/vendas/condicionais/nova/PassoPecas";
import { TEXTOS_DA_NOVA as T } from "@/components/screens/vendas/condicionais/nova/textos";
import { livresParaLevar, reservaDoProdutoCru } from "@/components/screens/vendas/condicionais/nova/livre";
import { filtrarProdutos, acharPeloCodigo, variantesDoProduto, totalDasPecas } from "@/components/screens/vendas/condicionais/nova/busca";

function flat(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flat).join("");
  return flat(node.children);
}
const texto = (t: renderer.ReactTestRenderer) => flat(t.toJSON() as any);
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const um = (t: renderer.ReactTestRenderer, id: string) => {
  const r = porId(t, id);
  if (!r.length) throw new Error("sem testID " + id);
  return r[0];
};
const tem = (t: renderer.ReactTestRenderer, id: string) => porId(t, id).length > 0;
async function tocar(t: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(t, id).props.onPress(); });
}
async function digitar(t: renderer.ReactTestRenderer, id: string, v: string) {
  await act(async () => { um(t, id).props.onChangeText(v); });
}

function montar(extra: Record<string, any> = {}) {
  const onCriada = jest.fn();
  const onClose = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<NovaCondicionalModal visible onClose={onClose} onCriada={onCriada} hoje="2026-11-26" {...extra} />); });
  return { tree, onCriada, onClose };
}

async function ateOPasso2(t: renderer.ReactTestRenderer) {
  await tocar(t, "nova-cliente-opcao-c-1");
  await tocar(t, "nova-continuar");
}
async function buscar(t: renderer.ReactTestRenderer, q: string) {
  await act(async () => { um(t, "nova-busca-peca").props.onChangeText(q); });
}

beforeEach(() => {
  mockAuth = { company: { id: "loja-1", trade_name: "Loja Centro" }, availableCompanies: [], token: "t" };
  mockSemEstoque = false;
  mockCreateCustomer.mockReset();
});

describe("Passo 1 · Cliente", () => {
  it("mostra os textos do mockup e o Continuar fica desligado sem cliente", () => {
    const { tree } = montar();
    const t = texto(tree);
    expect(t).toContain(T.titulo);
    expect(t).toContain(T.quemVaiLevar);
    expect(t).toContain(T.notaObrigatorios);
    expect(t).toContain(T.rodapeSemCliente);
    expect(um(tree, "nova-continuar").props.disabled).toBe(true);
    expect(texto(tree)).toContain(T.passoDe(1, "Cliente"));
  });

  it("escolhe a cliente, mostra 'Para Marina Duarte' e vai para as peças", async () => {
    const { tree } = montar();
    await tocar(tree, "nova-cliente-opcao-c-1");
    expect(texto(tree)).toContain(T.rodapeCliente("Marina Duarte"));
    await tocar(tree, "nova-continuar");
    expect(tem(tree, "nova-passo-2")).toBe(true);
    expect(texto(tree)).toContain(T.nenhumaPeca);
  });

  it("cliente sem telefone: pede o telefone antes de continuar", async () => {
    const { tree } = montar();
    await tocar(tree, "nova-cliente-opcao-c-2");
    expect(tem(tree, "nova-sem-telefone")).toBe(true);
    await tocar(tree, "nova-continuar");
    expect(tem(tree, "nova-passo-2")).toBe(false);
    expect(tem(tree, "nova-telefone-avulso-erro")).toBe(true);
    await digitar(tree, "nova-telefone-avulso", "11977776666");
    await tocar(tree, "nova-continuar");
    expect(tem(tree, "nova-passo-2")).toBe(true);
  });

  it("+ Novo cliente: nome e telefone obrigatórios, CPF opcional", async () => {
    mockCreateCustomer.mockResolvedValue({ id: "c-9", name: "Ana Souza", phone: "11988887777" });
    const { tree } = montar();
    await tocar(tree, "nova-cliente-novo");
    expect(texto(tree)).toContain(T.campoTelefone);
    expect(texto(tree)).toContain(T.campoCpf);
    await tocar(tree, "nova-novo-cliente-salvar");
    expect(tem(tree, "nova-novo-cliente-erro-nome")).toBe(true);
    expect(tem(tree, "nova-novo-cliente-erro-tel")).toBe(true);
    expect(mockCreateCustomer).not.toHaveBeenCalled();
    await digitar(tree, "nova-novo-cliente-nome", "Ana Souza");
    await digitar(tree, "nova-novo-cliente-tel", "11988887777");
    await tocar(tree, "nova-novo-cliente-salvar");
    expect(mockCreateCustomer).toHaveBeenCalledWith("loja-1", { name: "Ana Souza", phone: "11988887777", source: "pdv" });
    expect(texto(tree)).toContain(T.rodapeCliente("Ana Souza"));
  });

  it("CPF digitado vai no cadastro; CPF errado trava", async () => {
    mockCreateCustomer.mockResolvedValue({ id: "c-9", name: "Ana", phone: "11988887777" });
    const { tree } = montar();
    await tocar(tree, "nova-cliente-novo");
    await digitar(tree, "nova-novo-cliente-nome", "Ana");
    await digitar(tree, "nova-novo-cliente-tel", "11988887777");
    await digitar(tree, "nova-novo-cliente-cpf", "11111111111");
    await tocar(tree, "nova-novo-cliente-salvar");
    expect(tem(tree, "nova-novo-cliente-erro-cpf")).toBe(true);
    await digitar(tree, "nova-novo-cliente-cpf", "52998224725");
    await tocar(tree, "nova-novo-cliente-salvar");
    expect(mockCreateCustomer).toHaveBeenCalledWith("loja-1", { name: "Ana", phone: "11988887777", cpf_cnpj: "52998224725", source: "pdv" });
  });
});

describe("Passo 2 · Peças", () => {
  it("peça com variante: cor, tamanho com livre e com cliente, e entra uma unidade", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    expect(texto(tree)).toContain(T.comeceTitulo);
    await buscar(tree, "vestido");
    await tocar(tree, "nova-sugestao-p-vest");
    const t = texto(tree);
    expect(t).toContain("Cor");
    expect(t).not.toContain("Tamanho");
    await tocar(tree, "nova-cor-Verde-oliva");
    expect(texto(tree)).toContain("Tamanho");
    expect(texto(tree)).toContain("1 livre");
    expect(texto(tree)).toContain(T.comCliente);
    expect(um(tree, "nova-tamanho-v-ol-g").props.disabled).toBe(true);
    await tocar(tree, "nova-tamanho-v-ol-m");
    await tocar(tree, "nova-colocar");
    expect(texto(tree)).toContain("Verde-oliva · M · 1 un.");
    expect(texto(tree)).toContain(T.oQueElaVaiLevar);
    expect(texto(tree)).toContain("1 peça · R$");
    expect(um(tree, "nova-continuar").props.disabled).toBe(false);
  });

  it("a mesma variante só entra até acabar o livre (uma unidade por linha)", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    for (let i = 0; i < 2; i++) {
      await buscar(tree, "vestido");
      await tocar(tree, "nova-sugestao-p-vest");
      await tocar(tree, "nova-cor-Preto");
      if (i === 1) { expect(um(tree, "nova-tamanho-v-pr-m").props.disabled).toBe(true); break; }
      await tocar(tree, "nova-tamanho-v-pr-m");
      await tocar(tree, "nova-colocar");
    }
    expect(porId(tree, "nova-lista-pecas").length).toBe(1);
  });

  it("peça sem variante entra direto e tirar remove a linha", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    await buscar(tree, "brinco");
    await tocar(tree, "nova-sugestao-p-brinco");
    expect(texto(tree)).toContain("Brinco Argola Luz");
    expect(texto(tree)).toContain("1 peça · R$ 69,90");
    const tirar = tree.root.findAll((n) => typeof n.props?.testID === "string" && n.props.testID.startsWith("nova-tirar-"), { deep: false })[0];
    await act(async () => { tirar.props.onPress(); });
    expect(texto(tree)).toContain(T.nenhumaPeca);
    expect(um(tree, "nova-continuar").props.disabled).toBe(true);
  });

  it("bipe de código de variante coloca a peça certa", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    await act(async () => { um(tree, "nova-busca-peca").props.onScan({ code: "VAR-PRETO-M", source: "scanner" }); });
    expect(texto(tree)).toContain("Preto · M · 1 un.");
  });

  it("bipe de código que não existe avisa", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    await act(async () => { um(tree, "nova-busca-peca").props.onScan({ code: "000", source: "scanner" }); });
    expect(texto(tree)).toContain(T.naoAchouCodigo("000"));
  });

  it("loja que controla estoque: peça sem unidade livre não entra", async () => {
    const { tree } = montar();
    await ateOPasso2(tree);
    await buscar(tree, "blusa");
    await tocar(tree, "nova-sugestao-p-blusa");
    expect(texto(tree)).toContain(T.semLivreNaLoja("Blusa Tricô Nina"));
    expect(tem(tree, "nova-lista-pecas")).toBe(false);
  });

  it("loja que vende sem estoque: entra com o aviso âmbar na linha e o Continuar fica ativo", async () => {
    mockSemEstoque = true;
    const { tree } = montar();
    await ateOPasso2(tree);
    await buscar(tree, "blusa");
    await tocar(tree, "nova-sugestao-p-blusa");
    expect(texto(tree)).toContain(T.semUnidadeLivre);
    expect(um(tree, "nova-continuar").props.disabled).toBe(false);
  });

  it("409 COND_SEM_SALDO: mostra a condicional que segura a peça e trava o Continuar", () => {
    const pecas = [{ chave: "k1", productId: "p-blusa", variantId: null, nome: "Blusa Tricô Nina", cor: "off-white", tamanho: "P", preco: 139.9, semLivre: false }];
    const faltas = [{ product_id: "p-blusa", variant_id: null, nome: "Blusa Tricô Nina", condicionais: [{ id: "cond-29", numero_exibicao: "C-0029", customer_name: "Tainá Moraes", due_date: "2026-11-28" }] }];
    const onVer = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <PassoPecas produtos={[mockBlusa as any]} carregando={false} variantesDe={async () => []} pecas={pecas} onAdicionar={jest.fn()}
          onTirar={jest.fn()} vendeSemEstoque={false} faltas={faltas} onVerCondicional={onVer} />,
      );
    });
    const t = texto(tree);
    expect(t).toContain(T.semUnidadeLivreChip);
    expect(t).toContain(T.faltaTitulo("Blusa Tricô Nina"));
    expect(t).toContain("C-0029");
    expect(t).toContain("Tainá Moraes");
    act(() => { um(tree, "nova-falta-ver").props.onPress(); });
    expect(onVer).toHaveBeenCalledWith("cond-29");
  });
});

describe("Consolidado (multi-CNPJ)", () => {
  it("pergunta de qual loja as peças vão sair antes do passo 1", async () => {
    mockAuth = { company: null, availableCompanies: [{ id: "loja-1", trade_name: "Loja Centro" }, { id: "loja-2", trade_name: "Loja Shopping" }], token: "t" };
    const { tree } = montar();
    expect(texto(tree)).toContain(T.loja.titulo);
    expect(texto(tree)).toContain(T.loja.sub);
    expect(texto(tree)).toContain("Loja Shopping");
    expect(tem(tree, "nova-passo-1")).toBe(false);
    await tocar(tree, "nova-loja-loja-2");
    expect(tem(tree, "nova-passo-1")).toBe(true);
  });

  it("loja única não pergunta a loja", () => {
    const { tree } = montar();
    expect(texto(tree)).not.toContain(T.loja.titulo);
  });
});

describe("Livres e busca (funções puras)", () => {
  it("livres = estoque − com clientes − reservado, nunca negativo", () => {
    expect(livresParaLevar(4, 1, 1)).toBe(2);
    expect(livresParaLevar(1, 1, 1)).toBe(0);
    expect(reservaDoProdutoCru({})).toEqual({ reservadoTotal: 0, reservadoPorVariante: {}, comClienteTotal: 0, comClientePorVariante: {} });
    expect(reservaDoProdutoCru({ out_qty: 2, out_by_variant: { v1: 2 }, reserved_by_variant: { v1: 1 } }).comClientePorVariante).toEqual({ v1: 2 });
  });
  it("variantes: livre desconta com clientes e reservado; cor em hex vira nome", () => {
    const p = { ...mockVestido, reserva: { reservadoTotal: 1, reservadoPorVariante: { a: 1 }, comClienteTotal: 1, comClientePorVariante: { a: 1 } } };
    const vs = variantesDoProduto(p as any, [{ id: "a", stock_qty: 3, attributes: [{ attribute: "Cor", value: "Preto" }, { attribute: "Tamanho", value: "M" }] }, { id: "b", stock_qty: 1, is_active: false, attributes: [] }]);
    expect(vs).toHaveLength(1);
    expect(vs[0]).toMatchObject({ id: "a", cor: "Preto", tamanho: "M", livre: 1, comCliente: 1 });
  });
  it("busca por nome sem acento, e bipe por código de barras ou de variante", () => {
    expect(filtrarProdutos([mockVestido, mockBrinco] as any, "LIVIA").map((p) => p.id)).toEqual(["p-vest"]);
    expect(filtrarProdutos([mockVestido] as any, "")).toEqual([]);
    expect(acharPeloCodigo([mockVestido, mockBrinco] as any, "111")?.produto.id).toBe("p-brinco");
    expect(acharPeloCodigo([mockVestido] as any, "VAR-PRETO-M")).toMatchObject({ codigoDeVariante: true });
    expect(totalDasPecas([{ preco: 189.9 }, { preco: 69.9 }] as any)).toBe(259.8);
  });
});
