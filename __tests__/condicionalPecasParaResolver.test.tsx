// ============================================================
// Vendas › Condicionais: Peças para resolver (C16, 26/11/2026)
//
// O que o mockup aprovado pede:
//   1. o quinto chip "Peças para resolver · N" só existe com N > 0;
//   2. a lista mostra peça (cor e tamanho), cliente e nº, quando voltou e a
//      nota, com "Voltar ao estoque" e "Dar baixa" sempre à vista;
//   3. "Voltar ao estoque" grava, mostra o aviso e "Desfazer" desfaz;
//   4. "Dar baixa" abre "Qual o motivo?" (Defeito, Sem etiqueta, Perda,
//      Outro com texto) e grava com o motivo;
//   5. selo âmbar "N para resolver" no Estoque e no cartão do Caixa, fora de
//      "com clientes" e de "livre";
//   6. "Ver a lista" na gaveta leva à lista.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockLargura = 1280;
const mockRequest = jest.fn();
const mockToast = jest.fn();

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/ListSkeleton", () => ({ ListSkeleton: "ListSkeleton" }));
jest.mock("@/components/Toast", () => ({ toast: { info: (...a: any[]) => mockToast("info", ...a), success: (...a: any[]) => mockToast("success", ...a), error: (...a: any[]) => mockToast("error", ...a) } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null) }));
jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: any) => {
    const st = {
      user: { id: "u1", is_staff: true }, token: "t", isHydrated: true,
      company: { id: "comp-1", plan: "essencial" }, consolidatedView: false,
    };
    return typeof sel === "function" ? sel(st) : st;
  },
}));
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return new Proxy(rn, {
    get(alvo: any, k: string) {
      if (k === "useWindowDimensions") return () => ({ width: mockLargura, height: 900, scale: 1, fontScale: 1 });
      return alvo[k];
    },
  });
});

import { AbaCondicionais } from "@/components/screens/vendas/condicionais/AbaCondicionais";
import {
  corETamanho, quandoVoltou, subDaBaixa, MOTIVOS_DA_BAIXA, TEXTOS_PARA_RESOLVER_DA_ABA as PR,
} from "@/components/screens/vendas/condicionais/PecasParaResolver";
import { ProductGrid } from "@/components/screens/pdv/ProductGrid";
import { ProductTableWeb } from "@/components/screens/estoque/ProductTableWeb";
import { mapApiProduct } from "@/hooks/useProducts";
import { paraResolverDoProduto, camposDeParaResolver, livresDaPeca, TEXTOS_PARA_RESOLVER } from "@/utils/comClientes";
import { textoDoEvento } from "@/components/screens/vendas/condicionais/detalhe/regrasDoDetalhe";

const HOJE = "2026-11-25";

function linha(over: any = {}) {
  return {
    id: "k1", company_id: "comp-1", company_name: "Loja Centro", numero: 31, numero_exibicao: "C-0031",
    status: "aberta", situacao: "com_cliente", parcial: false, dias_de_atraso: 0,
    customer_id: "cu1", customer_name: "Marina Duarte", customer_phone: "(11) 98888-0101", seller_name: "Jéssica",
    due_date: "2026-11-28", notes: null, pecas: 3, pecas_com_cliente: 3, pecas_ficou: 0, pecas_a_cobrar: 0,
    pecas_voltou: 0, valor_total: 389.7, valor_com_cliente: 389.7, valor_a_cobrar: 0,
    primeira_peca: "Vestido Midi Lívia", created_at: "2026-11-25T13:00:00Z", closed_at: null, cancelled_at: null,
    ...over,
  };
}
function listaDeCondicionais() {
  return {
    condicionais: [linha()], filtro: "em_aberto", hoje: HOJE,
    totalizador: { valor: 389.7, pecas: 3, clientes: 1, texto: "R$ 389,70 em 3 peças com 1 cliente" },
    valor_a_cobrar: 0,
    counts: { em_aberto: 1, com_cliente: 1, vence_hoje: 0, atrasadas: 0, a_cobrar: 0, concluidas: 0, canceladas: 0, todas: 1 },
    pagination: { page: 1, limit: 100, total: 1, pages: 1 },
  };
}
const PECA_A = {
  item_id: "it-1", condicional_id: "k31", company_id: "comp-1", company_name: "Loja Centro", numero: 31, numero_exibicao: "C-0031",
  customer_name: "Marina Duarte", product_id: "p1", variant_id: "v1", product_name: "Blusa Tricô Nina", variant_label: "Off-white · P",
  color_name: "Off-white", size_label: "P", nota: "Fio puxado na manga", voltou_em: "2026-11-25T15:00:00Z", estoque: 4,
};
const PECA_B = {
  ...PECA_A, item_id: "it-2", condicional_id: "k26", numero: 26, numero_exibicao: "C-0026", customer_name: "Sofia Antunes",
  product_name: "Saia Midi Lara", color_name: "Preto", size_label: "M", variant_label: null, nota: "Zíper com defeito",
  voltou_em: "2026-11-23T15:00:00Z", estoque: 2,
};

let pecasDoServidor: any[] = [];
function servidor() {
  mockRequest.mockImplementation((path: string, opts?: any) => {
    if (path.endsWith("/para-resolver")) return Promise.resolve({ pecas: pecasDoServidor, total: pecasDoServidor.length });
    if (path.includes("/resolver")) return Promise.resolve({ item_id: "x" });
    return Promise.resolve(listaDeCondicionais());
  });
}

async function montar(el: React.ReactElement = <AbaCondicionais />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: any;
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
function textoDe(no: any): string {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === "string" || typeof n === "number") { out.push(String(n)); return; }
    (n.children || []).forEach(walk);
  };
  walk(no);
  return out.join("");
}
const textos = (tree: any) => textoDe(tree.toJSON());
const tem = (tree: any, id: string) => tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false }).length > 0;
function tocavel(tree: any, id: string) {
  const a = tree.root.findAll((n: any) => n.props && n.props.testID === id && typeof n.props.onPress === "function");
  if (!a.length) throw new Error("sem tocável " + id);
  return a[0];
}
async function tocar(tree: any, id: string) {
  await act(async () => { tocavel(tree, id).props.onPress(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const chamadasDeEscrita = () => mockRequest.mock.calls.filter((c) => c[1] && c[1].method === "POST");

beforeEach(() => {
  mockLargura = 1280;
  mockRequest.mockReset();
  mockToast.mockReset();
  pecasDoServidor = [PECA_A, PECA_B];
  servidor();
});

describe("regras puras", () => {
  it("cor e tamanho, quando voltou e a janela da baixa", () => {
    expect(corETamanho(PECA_A)).toBe("Off-white · P");
    expect(corETamanho({ color_name: null, size_label: null, variant_label: "Azul M" })).toBe("Azul M");
    expect(quandoVoltou(PECA_A.voltou_em, HOJE)).toBe("voltou hoje, 25/11");
    expect(quandoVoltou(PECA_B.voltou_em, HOJE)).toBe("voltou seg., 23/11");
    expect(subDaBaixa(PECA_A as any)).toBe("Off-white · P · o estoque vai de 4 para 3");
    expect(subDaBaixa({ ...PECA_A, estoque: null } as any)).toBe("Off-white · P");
    expect(MOTIVOS_DA_BAIXA.map((m) => m.label)).toEqual(["Defeito", "Sem etiqueta", "Perda", "Outro"]);
  });

  it("para resolver: ausente = 0, só com a trava, por variante, e tira do livre", () => {
    expect(paraResolverDoProduto({}, true)).toBe(0);
    expect(paraResolverDoProduto({ resolverQty: 2 }, false)).toBe(0);
    expect(paraResolverDoProduto({ resolverQty: 2 }, true)).toBe(2);
    expect(paraResolverDoProduto({ resolverQty: 3, resolverByVariant: { vP: 2 } }, true, "vP")).toBe(2);
    expect(paraResolverDoProduto({ resolverQty: 3, resolverByVariant: { vP: 2 } }, true, "vM")).toBe(0);
    expect(camposDeParaResolver({})).toEqual({});
    expect(camposDeParaResolver({ resolver_qty: "1", resolver_by_variant: { v1: 1, v2: 0 } })).toEqual({ resolverQty: 1, resolverByVariant: { v1: 1 } });
    // 4 no estoque: 1 com cliente, 1 reservado, 1 para resolver, 1 livre.
    expect(livresDaPeca(4, 1, 1, 1)).toBe(1);
    expect(livresDaPeca(4, 1, 1)).toBe(2);
    expect(livresDaPeca(1, 0, 0, 3)).toBe(0);
    expect(TEXTOS_PARA_RESOLVER.selo(1)).toBe("1 para resolver");
  });

  it("GET /products: resolver_qty chega ao produto; sem o campo, o produto é o de antes", () => {
    const cru = { id: "p1", name: "Blusa", price: "10", stock_qty: "4" };
    expect(mapApiProduct({ ...cru, resolver_qty: 1, resolver_by_variant: { v1: 1 } } as any)).toMatchObject({ resolverQty: 1, resolverByVariant: { v1: 1 } });
    expect("resolverQty" in mapApiProduct(cru as any)).toBe(false);
  });

  it("eventos novos no histórico", () => {
    const c: any = { numero_exibicao: "C-0031", items: [{ id: "it-1", product_name: "Blusa" }] };
    const ev = (tipo: string) => ({ id: "e", tipo, item_id: "it-1", dados: null, user_id: null, created_at: "2026-11-25T15:00:00Z" });
    expect(textoDoEvento(ev("resolvida_voltou"), c)).toBe("Blusa voltou ao estoque em 25/11.");
    expect(textoDoEvento(ev("resolvida_baixa"), c)).toBe("Baixa de Blusa em 25/11.");
    expect(textoDoEvento(ev("resolucao_desfeita"), c)).toBe("Blusa voltou para Peças para resolver em 25/11.");
  });
});

describe("selo âmbar no Estoque e no Caixa", () => {
  const BASE: any = {
    id: "11111111-1111-4111-8111-111111111111", name: "Blusa Tricô Nina", code: "B1", barcode: "", category: "Blusas",
    price: 89.9, cost: 40, stock: 4, minStock: 1, unit: "un", notes: "", color: "", size: "",
  };
  const montarSimples = (el: React.ReactElement) => { let t!: renderer.ReactTestRenderer; act(() => { t = renderer.create(el); }); return t; };
  const tabela = (items: any[], extra: any = {}) =>
    <ProductTableWeb items={items} bulkMode={false} bulkSelected={new Set()} onSelect={() => {}} canLink={false} {...extra} />;

  it("Estoque: '1 para resolver' ao lado do com clientes e do reservado; livres = 1", () => {
    const p = { ...BASE, outQty: 1, reservedQty: 1, resolverQty: 1 };
    const t = montarSimples(tabela([p], { reservaLiberada: true, comClientesLiberado: true }));
    const txt = textoDe(t.toJSON());
    expect(txt).toContain("1 para resolver");
    expect(txt).toContain("1 com cliente");
    expect(txt).toContain("1 reservado");
    expect(txt).toContain("1 livre");
    expect(t.root.findAll((n) => n.props && n.props.testID === "estoque-para-resolver-" + BASE.id).length).toBeGreaterThan(0);
  });

  it("Estoque: só para resolver também aparece; sem o campo ou sem a trava, nada muda", () => {
    const so = montarSimples(tabela([{ ...BASE, resolverQty: 2 }], { comClientesLiberado: true }));
    expect(textoDe(so.toJSON())).toContain("2 para resolver");
    expect(textoDe(so.toJSON())).toContain("2 livres");
    const semTrava = montarSimples(tabela([{ ...BASE, resolverQty: 2 }], { comClientesLiberado: false }));
    const antes = montarSimples(tabela([BASE], { comClientesLiberado: false }));
    expect(JSON.stringify(semTrava.toJSON())).toBe(JSON.stringify(antes.toJSON()));
  });

  it("cartão do Caixa", () => {
    const grid = (p: any, lib: boolean) =>
      <ProductGrid products={[p]} qtyById={{}} onAdd={() => {}} comClientesLiberado={lib} />;
    const com = montarSimples(grid({ ...BASE, resolverQty: 1 }, true));
    expect(textoDe(com.toJSON())).toContain("1 para resolver");
    expect(com.root.findAll((n) => n.props && n.props.testID === "grid-para-resolver-" + BASE.id).length).toBeGreaterThan(0);
    const sem = montarSimples(grid({ ...BASE, resolverQty: 1 }, false));
    expect(textoDe(sem.toJSON())).not.toContain("para resolver");
  });
});

describe("aba Condicionais: Peças para resolver", () => {
  it("sem peça para resolver não existe o chip", async () => {
    pecasDoServidor = [];
    const tree = await montar();
    expect(tem(tree, "chip-resolver")).toBe(false);
    expect(textos(tree)).not.toContain(PR.chip);
  });

  it("com 2 peças: quinto chip com a contagem; a lista tem as duas ações à vista", async () => {
    const tree = await montar();
    expect(mockRequest).toHaveBeenCalledWith("/companies/comp-1/condicionais/para-resolver");
    expect(textoDe(tree.root.findAll((n: any) => n.props?.testID === "chip-resolver")[0])).toBe("Peças para resolver2");
    await tocar(tree, "chip-resolver");
    const t = textos(tree);
    expect(t).toContain(PR.subtitulo);
    expect(t).toContain("Blusa Tricô Nina");
    expect(t).toContain("Off-white · P");
    expect(t).toContain("Marina Duarte · C-0031");
    expect(t).toContain("voltou hoje, 25/11");
    expect(t).toContain("“Fio puxado na manga”");
    expect(t).toContain("voltou seg., 23/11");
    for (const id of ["it-1", "it-2"]) {
      expect(tem(tree, "resolver-voltar-" + id)).toBe(true);
      expect(tem(tree, "resolver-baixa-" + id)).toBe(true);
    }
    expect(t).toContain("Voltar ao estoque");
    expect(t).toContain("Dar baixa");
  });

  it("Voltar ao estoque grava na loja da peça, com chave, mostra o aviso e o Desfazer desfaz", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    await tocar(tree, "resolver-voltar-it-1");
    const [caminho, opts] = chamadasDeEscrita()[0];
    expect(caminho).toBe("/companies/comp-1/condicionais/itens/it-1/resolver");
    expect(opts.body).toEqual({ acao: "voltar_estoque" });
    expect(opts.headers["Idempotency-Key"]).toBeTruthy();
    const aviso = textos(tree);
    expect(aviso).toContain("Voltou ao estoque, livre para vender.");
    expect(aviso).toContain("Blusa Tricô Nina · Off-white · P");
    await tocar(tree, "resolver-desfazer");
    expect(chamadasDeEscrita()[1][0]).toBe("/companies/comp-1/condicionais/itens/it-1/resolver/desfazer");
    expect(tem(tree, "resolver-aviso")).toBe(false);
    expect(mockToast).toHaveBeenCalledWith("info", PR.desfeito);
  });

  it("falha ao voltar: mostra a frase do servidor e não mostra o aviso", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    mockRequest.mockImplementation((path: string) => path.includes("/itens/")
      ? Promise.reject(Object.assign(new Error("Esta peça já foi resolvida. Atualize a lista."), { status: 409 }))
      : Promise.resolve(path.endsWith("/para-resolver") ? { pecas: pecasDoServidor, total: 2 } : listaDeCondicionais()));
    await tocar(tree, "resolver-voltar-it-1");
    expect(textoDe(tree.root.findAll((n: any) => n.props?.testID === "resolver-erro-acao")[0])).toBe("Esta peça já foi resolvida. Atualize a lista.");
    expect(tem(tree, "resolver-aviso")).toBe(false);
  });

  it("Dar baixa: a janela pergunta o motivo; Perda grava com motivo e o estoque 'de 4 para 3' aparece", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    await tocar(tree, "resolver-baixa-it-1");
    const t = textos(tree);
    expect(t).toContain("Dar baixa na Blusa Tricô Nina?");
    expect(t).toContain("Off-white · P · o estoque vai de 4 para 3");
    expect(t).toContain("Qual o motivo?");
    for (const m of ["Defeito", "Sem etiqueta", "Perda", "Outro"]) expect(t).toContain(m);
    expect(t).toContain("Fica no histórico do estoque com o motivo e a anotação “Fio puxado na manga”. É o mesmo ajuste de estoque de sempre.");
    await tocar(tree, "resolver-motivo-perda");
    await tocar(tree, "resolver-modal-salvar");
    const [caminho, opts] = chamadasDeEscrita()[0];
    expect(caminho).toBe("/companies/comp-1/condicionais/itens/it-1/resolver");
    expect(opts.body).toEqual({ acao: "baixa", motivo: "perda" });
    expect(tem(tree, "resolver-modal")).toBe(false);
    expect(mockToast).toHaveBeenCalledWith("success", PR.baixaFeita);
  });

  it("Outro pede o texto: sem texto o botão não grava; com texto vai em motivo_texto", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    await tocar(tree, "resolver-baixa-it-2");
    await tocar(tree, "resolver-motivo-outro");
    const salvar = tocavel(tree, "resolver-modal-salvar");
    expect(salvar.props.disabled).toBe(true);
    await tocar(tree, "resolver-modal-salvar");
    expect(chamadasDeEscrita()).toHaveLength(0);
    const campo = tree.root.findAll((n: any) => n.props && n.props.testID === "resolver-motivo-texto" && typeof n.props.onChangeText === "function")[0];
    await act(async () => { campo.props.onChangeText("  Doada para brechó "); });
    await tocar(tree, "resolver-modal-salvar");
    expect(chamadasDeEscrita()[0][1].body).toEqual({ acao: "baixa", motivo: "outro", motivo_texto: "Doada para brechó" });
  });

  it("Cancelar fecha a janela sem gravar", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    await tocar(tree, "resolver-baixa-it-1");
    await tocar(tree, "resolver-modal-cancelar");
    expect(tem(tree, "resolver-modal")).toBe(false);
    expect(chamadasDeEscrita()).toHaveLength(0);
  });

  it("lista vazia pelo atalho: 'Nenhuma peça para resolver' e 'Ver as condicionais' volta", async () => {
    const tree = await montar();
    await tocar(tree, "chip-resolver");
    pecasDoServidor = [];
    // A lista esvazia no refetch depois da baixa.
    await tocar(tree, "resolver-baixa-it-1");
    await tocar(tree, "resolver-modal-salvar");
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    const t = textos(tree);
    expect(t).toContain("Nenhuma peça para resolver");
    expect(t).toContain("Tudo certo por aqui. Quando uma peça voltar com defeito ou sem etiqueta, ela aparece nesta lista.");
    await tocar(tree, "resolver-ver-condicionais");
    expect(tem(tree, "condicionais-tabela")).toBe(true);
  });

  it("lista que não abre: sem lista não há chip", async () => {
    mockRequest.mockImplementation((path: string) => path.endsWith("/para-resolver")
      ? Promise.reject(new Error("rede"))
      : Promise.resolve(listaDeCondicionais()));
    const tree = await montar();
    expect(tem(tree, "chip-resolver")).toBe(false);
  });
});
