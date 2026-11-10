// ============================================================
// "Sai em": o item escolhe a nota (10/11/2026, migration 442 do backend)
//
// O que estes testes seguram:
//   1. vaiNaNfse/vaiNaNfce — os quatro casos (produto/serviço × nulo/escolha),
//      com o item do app (notaFiscal) e o do backend (nota_fiscal);
//   2. quem decide nota usa o predicado: composição da venda, selo "Falta
//      código da NFS-e" e o filtro da lista, aviso de CEST;
//   3. useProducts: lê nota_fiscal do backend; no POST/PATCH, undefined não
//      vai no corpo e null limpa.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
const mockBodies: any[] = [];
let mockLista: any[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { products: mockLista }, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: () => ({
    mutateAsync: async (arg: any) => { mockBodies.push(arg && arg.body !== undefined ? arg.body : arg); return { id: "novo" }; },
    mutate: jest.fn(),
  }),
}));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "co-1" }, token: "t", isDemo: false }) }));
jest.mock("@/services/api", () => ({ companiesApi: {} }));

import {
  vaiNaNfse, vaiNaNfce, gravacaoDaNota, notaPadraoDoTipo, lerNotaFiscal, notaEscolhida,
} from "@/utils/notaDoItem";
import { composicaoDaVenda, ehServico, exigeTomador } from "@/utils/nfseAutomatica";
import { faltaCodigoNfse } from "@/utils/nfseServico";
import { servicosSemCodigoNfse } from "@/components/screens/estoque/nfseNaLista";
import { calcularFiscalGaps } from "@/utils/cest";
import { useProducts } from "@/hooks/useProducts";

describe("vaiNaNfse — os quatro casos", () => {
  test.each([
    ["produto, nulo → NFC-e", { unit: "un", notaFiscal: null }, false],
    ["serviço, nulo → NFS-e", { unit: "srv", notaFiscal: null }, true],
    ["produto com NFS-e → NFS-e", { unit: "un", notaFiscal: "nfse" }, true],
    ["serviço com NFC-e → NFC-e", { unit: "srv", notaFiscal: "nfce" }, false],
  ])("%s", (_n, item, esperado) => {
    expect(vaiNaNfse(item as any)).toBe(esperado);
    expect(vaiNaNfce(item as any)).toBe(!esperado);
    // o mesmo item no formato do backend
    const cru = { unit: item.unit, nota_fiscal: item.notaFiscal };
    expect(vaiNaNfse(cru as any)).toBe(esperado);
  });

  test("sem o campo segue o tipo; valor estranho conta como nulo; item vazio é NFC-e", () => {
    expect(vaiNaNfse({ unit: "SRV" })).toBe(true);
    expect(vaiNaNfse({ unit: "kg" })).toBe(false);
    expect(vaiNaNfse({ unit: "un", notaFiscal: "xyz" })).toBe(false);
    expect(vaiNaNfse(null)).toBe(false);
    expect(vaiNaNfse({})).toBe(false);
    expect(notaEscolhida({ notaFiscal: "nfse" })).toBe("nfse");
  });

  test("gravação: a escolha igual ao tipo vira null; a diferente fica", () => {
    expect(notaPadraoDoTipo("un")).toBe("nfce");
    expect(notaPadraoDoTipo("srv")).toBe("nfse");
    expect(gravacaoDaNota("nfse", "un")).toBe("nfse");
    expect(gravacaoDaNota("nfce", "un")).toBeNull();
    expect(gravacaoDaNota("nfce", "srv")).toBe("nfce");
    expect(gravacaoDaNota("nfse", "srv")).toBeNull();
    expect([lerNotaFiscal("nfse"), lerNotaFiscal("nfce"), lerNotaFiscal(null), lerNotaFiscal(undefined), lerNotaFiscal(1)])
      .toEqual(["nfse", "nfce", null, null, null]);
  });
});

describe("quem decide a nota usa o predicado", () => {
  const carimbo = { unit: "un", notaFiscal: "nfse" as const, nfseCtribnac: null };
  const impressao = { unit: "srv", notaFiscal: "nfce" as const, nfseCtribnac: null };
  const caneta = { unit: "un", notaFiscal: null, nfseCtribnac: null };

  test("composição da venda: produto NFS-e conta como da nota de serviço; o Caixa exige o tomador", () => {
    expect(ehServico(carimbo)).toBe(true);
    expect(composicaoDaVenda([carimbo])).toEqual({ temServico: true, temProduto: false, mista: false });
    expect(composicaoDaVenda([carimbo, caneta])).toEqual({ temServico: true, temProduto: true, mista: true });
    expect(composicaoDaVenda([impressao])).toEqual({ temServico: false, temProduto: true, mista: false });
    expect(exigeTomador({ temServico: composicaoDaVenda([carimbo]).temServico, nfseAtiva: true })).toBe(true);
    expect(exigeTomador({ temServico: composicaoDaVenda([impressao]).temServico, nfseAtiva: true })).toBe(false);
  });

  test("selo e filtro do Estoque: produto NFS-e sem código entra; serviço NFC-e sai", () => {
    expect(faltaCodigoNfse(carimbo, true)).toBe(true);
    expect(faltaCodigoNfse(carimbo, false)).toBe(false);
    expect(faltaCodigoNfse(impressao, true)).toBe(false);
    expect(faltaCodigoNfse({ ...carimbo, nfseCtribnac: "130501" }, true)).toBe(false);
    expect(servicosSemCodigoNfse([carimbo, impressao, caneta, { unit: "srv", nfseCtribnac: null }], true)).toHaveLength(2);
  });

  test("CEST é da NFC-e: produto que sai na NFS-e não entra no aviso", () => {
    const cimento = { id: "c", name: "Cimento", unit: "sc", ncm: "25232910", cest: null };
    expect(calcularFiscalGaps([cimento])).toHaveLength(1);
    expect(calcularFiscalGaps([{ ...cimento, notaFiscal: "nfse" as const }])).toHaveLength(0);
  });
});

describe("useProducts — nota_fiscal", () => {
  let api: ReturnType<typeof useProducts>;
  function Sonda() { api = useProducts(); return null; }
  const BASE: any = {
    id: "p1", name: "Carimbo", code: "---", barcode: "", category: "Produtos", price: 30, cost: 8,
    stock: 10, minStock: 0, unit: "un", notes: "", color: "", size: "", ncm: "",
  };
  let tree: renderer.ReactTestRenderer;
  beforeEach(() => {
    mockBodies.length = 0;
    mockLista = [
      { id: "a", name: "Carimbo", unit: "un", nota_fiscal: "nfse" },
      { id: "b", name: "Impressão", unit: "srv", nota_fiscal: "nfce" },
      { id: "c", name: "Caneta", unit: "un" },
    ];
    act(() => { tree = renderer.create(<Sonda />); });
  });
  afterEach(() => { act(() => { tree.unmount(); }); });

  test("lê o campo: valor do backend, ausente = null", () => {
    expect(api.products.map((p) => p.notaFiscal)).toEqual(["nfse", "nfce", null]);
  });

  test("POST com o campo leva nota_fiscal; sem o campo nem a chave vai", async () => {
    await act(async () => { await api.addProduct({ ...BASE, notaFiscal: "nfse" }); });
    expect(mockBodies[0].nota_fiscal).toBe("nfse");
    expect(mockBodies[0].stock_qty).toBe(10);
    await act(async () => { await api.addProduct({ ...BASE }); });
    expect("nota_fiscal" in mockBodies[1]).toBe(false);
  });

  test("PATCH: null limpa (vai null); undefined não vai", async () => {
    await act(async () => { await api.updateProduct({ ...BASE, notaFiscal: null }); });
    expect(mockBodies[0]).toHaveProperty("nota_fiscal", null);
    await act(async () => { await api.updateProduct({ ...BASE, notaFiscal: undefined }); });
    expect("nota_fiscal" in mockBodies[1]).toBe(false);
  });
});
