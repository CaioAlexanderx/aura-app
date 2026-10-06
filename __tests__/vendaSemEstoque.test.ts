// ============================================================
// AURA. — Testes: vender sem estoque (06/10/2026)
//
// Configurações > Políticas do Caixa > "Vender sem estoque"
// (pdv_settings.allow_sale_without_stock, desligada por padrão).
//
// O que estes testes travam:
//   1. só `true` literal liga a chave
//   2. desligada, o Caixa continua escondendo os zerados
//   3. ligada, os zerados aparecem sem precisar do "Mostrar zerados"
//   4. ligada, quem trava por saldo no app deixa de travar
//   5. as telas leem a chave pelo util (nenhuma lê o campo cru) e a tela de
//      Configurações tem o interruptor
// ============================================================
import fs from "fs";
import path from "path";
import {
  apareceParaVender,
  faltaEstoqueParaVender,
  lerVendaSemEstoque,
  produtoTemEstoque,
} from "@/utils/vendaSemEstoque";

const raiz = path.resolve(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

describe("lerVendaSemEstoque", () => {
  it.each([
    [{ allow_sale_without_stock: true }, true],
    [{ allow_sale_without_stock: false }, false],
    [{ allow_sale_without_stock: "true" }, false],
    [{ allow_sale_without_stock: 1 }, false],
    [{}, false],
    [null, false],
    [undefined, false],
  ])("%j => %s", (settings, esperado) => {
    expect(lerVendaSemEstoque(settings as any)).toBe(esperado);
  });
});

describe("produtoTemEstoque", () => {
  it("saldo positivo conta, zero e negativo não", () => {
    expect(produtoTemEstoque({ stock: 3 })).toBe(true);
    expect(produtoTemEstoque({ stock: 0 })).toBe(false);
    expect(produtoTemEstoque({ stock: -2 })).toBe(false);
  });

  it("lê stock_qty em texto, como vem do scan", () => {
    expect(produtoTemEstoque({ stock_qty: "4.000" })).toBe(true);
    expect(produtoTemEstoque({ stock_qty: "0" })).toBe(false);
  });

  it("sem campo de saldo ou com lixo vale zero", () => {
    expect(produtoTemEstoque({})).toBe(false);
    expect(produtoTemEstoque({ stock: "abc" })).toBe(false);
    expect(produtoTemEstoque(null)).toBe(false);
  });

  it("produto com variantes sempre passa: o saldo está na variante", () => {
    expect(produtoTemEstoque({ has_variants: true, stock: 0 })).toBe(true);
  });
});

describe("apareceParaVender", () => {
  const zerado = { stock: 0 };
  const comSaldo = { stock: 5 };

  it("chave desligada: zerado fica escondido", () => {
    expect(apareceParaVender(zerado, { mostrarZerados: false, vendeSemEstoque: false })).toBe(false);
    expect(apareceParaVender(comSaldo, { mostrarZerados: false, vendeSemEstoque: false })).toBe(true);
  });

  it("chave desligada: 'Mostrar zerados' continua trazendo o zerado", () => {
    expect(apareceParaVender(zerado, { mostrarZerados: true, vendeSemEstoque: false })).toBe(true);
  });

  it("chave ligada: zerado aparece sem o operador pedir", () => {
    expect(apareceParaVender(zerado, { mostrarZerados: false, vendeSemEstoque: true })).toBe(true);
  });

  it("um cadastro inteiro zerado não abre vazio com a chave ligada", () => {
    const cadastro = Array.from({ length: 50 }, (_, i) => ({ id: i, stock: 0 }));
    const filtra = (vendeSemEstoque: boolean) =>
      cadastro.filter((p) => apareceParaVender(p, { mostrarZerados: false, vendeSemEstoque }));
    expect(filtra(false)).toHaveLength(0);
    expect(filtra(true)).toHaveLength(50);
  });
});

describe("faltaEstoqueParaVender", () => {
  it("chave desligada: barra quando o saldo é menor que a quantidade", () => {
    expect(faltaEstoqueParaVender(0, 1, false)).toBe(true);
    expect(faltaEstoqueParaVender(2, 3, false)).toBe(true);
  });

  it("chave desligada: saldo igual ou maior passa", () => {
    expect(faltaEstoqueParaVender(3, 3, false)).toBe(false);
    expect(faltaEstoqueParaVender(10, 1, false)).toBe(false);
  });

  it("chave ligada: nunca barra", () => {
    expect(faltaEstoqueParaVender(0, 1, true)).toBe(false);
    expect(faltaEstoqueParaVender(0, 999, true)).toBe(false);
  });

  it("saldo ilegível vale zero (parseFloat de lixo dá NaN)", () => {
    expect(faltaEstoqueParaVender(NaN, 1, false)).toBe(true);
    expect(faltaEstoqueParaVender(NaN, 1, true)).toBe(false);
  });
});

// As telas importam Icon / stores/auth, que não carregam no Jest — então o
// que dá para travar nelas é a fiação, pelo texto do arquivo.
describe("fiação nas telas", () => {
  const telas = [
    "hooks/usePdvState.ts",
    "components/screens/financeiro/TransactionModal.tsx",
    "components/screens/financeiro/AddItemPicker.tsx",
    "components/screens/configuracoes/PdvSettingsCard.tsx",
  ];

  it.each(telas)("%s lê a chave pelo util", (rel) => {
    const src = ler(rel);
    expect(src).toMatch(/from "@\/utils\/vendaSemEstoque"/);
    expect(src).toMatch(/lerVendaSemEstoque\(/);
  });

  it("nenhuma tela lê o campo cru fora do util e do interruptor", () => {
    const usePdv = ler("hooks/usePdvState.ts");
    const modal = ler("components/screens/financeiro/TransactionModal.tsx");
    const picker = ler("components/screens/financeiro/AddItemPicker.tsx");
    for (const src of [usePdv, modal, picker]) {
      expect(src).not.toMatch(/allow_sale_without_stock/);
    }
  });

  it("o Caixa filtra por apareceParaVender e zera o contador com a chave ligada", () => {
    const src = ler("hooks/usePdvState.ts");
    expect(src).toMatch(/apareceParaVender\(p, \{ mostrarZerados: showOutOfStock, vendeSemEstoque \}\)/);
    expect(src).toMatch(/vendeSemEstoque \? 0 : products\.reduce/);
  });

  it("o picker do Financeiro pergunta ao util antes de barrar", () => {
    const src = ler("components/screens/financeiro/AddItemPicker.tsx");
    expect(src).toMatch(/faltaEstoqueParaVender\(stockToCheck, parsedQty, vendeSemEstoque\)/);
    expect(src).not.toMatch(/if \(stockToCheck < parsedQty\)/);
  });

  it("Configurações tem o interruptor gravando a chave certa", () => {
    const src = ler("components/screens/configuracoes/PdvSettingsCard.tsx");
    expect(src).toMatch(/Vender sem estoque/);
    expect(src).toMatch(/toggle\("allow_sale_without_stock", v\)/);
    expect(src).toMatch(/testID="toggle-vender-sem-estoque"/);
  });

  it("o tipo PdvSettings conhece a chave", () => {
    expect(ler("services/authApi.ts")).toMatch(/allow_sale_without_stock\?: boolean;/);
  });
});
