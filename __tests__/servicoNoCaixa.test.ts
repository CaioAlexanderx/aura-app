// ============================================================
// AURA. — Serviço no Caixa (INC-2026-11-18-02, 18/11/2026)
//
// Serviço (unit "srv") nasce com saldo 0 e nunca tem estoque. Com "vender sem
// estoque" desligado ele sumia da grade do Caixa (só com "Mostrar zerados"),
// contava no contador de zerados e o Financeiro barrava com "Estoque
// insuficiente". Regra única (utils/vendaSemEstoque.controlaEstoque):
// serviço nunca é escondido nem barrado por saldo. Só o TIPO conta: item que
// sai em NFS-e com unidade de mercadoria segue controlando estoque.
// ============================================================
import fs from "fs";
import path from "path";
import { apareceParaVender, controlaEstoque, produtoTemEstoque } from "@/utils/vendaSemEstoque";

const raiz = path.resolve(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const DESLIGADA = { mostrarZerados: false, vendeSemEstoque: false };
const servico = { id: "s1", name: "Instalação", unit: "srv", stock: 0 };
const zerado = { id: "p1", name: "Caneca", unit: "un", stock: 0 };
const comSaldo = { id: "p2", name: "Camiseta", unit: "un", stock: 3 };

describe("serviço não tem saldo", () => {
  it("serviço com saldo 0 conta como disponível", () => {
    expect(produtoTemEstoque(servico)).toBe(true);
    expect(produtoTemEstoque({ unit: "srv", stock_qty: "0" })).toBe(true);
    expect(produtoTemEstoque({ unit: " SRV ", stock: 0 })).toBe(true);
  });

  it("serviço aparece na grade do Caixa sem 'Mostrar zerados' e com a chave desligada", () => {
    expect(apareceParaVender(servico, DESLIGADA)).toBe(true);
  });

  it("produto comum zerado continua escondido; com saldo continua aparecendo", () => {
    expect(apareceParaVender(zerado, DESLIGADA)).toBe(false);
    expect(apareceParaVender({ stock: 0 }, DESLIGADA)).toBe(false);
    expect(apareceParaVender(comSaldo, DESLIGADA)).toBe(true);
  });

  it("item que sai em NFS-e com unidade de mercadoria segue controlando estoque", () => {
    const impressao = { unit: "un", stock: 0, notaFiscal: "nfse", nota_fiscal: "nfse" };
    expect(controlaEstoque(impressao)).toBe(true);
    expect(produtoTemEstoque(impressao)).toBe(false);
    expect(apareceParaVender(impressao, DESLIGADA)).toBe(false);
  });

  it("controlaEstoque: só 'srv' fica de fora", () => {
    expect(controlaEstoque(servico)).toBe(false);
    for (const unit of ["un", "kg", "mlh", "", null, undefined]) expect(controlaEstoque({ unit })).toBe(true);
    expect(controlaEstoque(null)).toBe(true);
  });

  it("o contador de zerados do Caixa (mesma conta do usePdvState) não conta o serviço", () => {
    const cadastro = [servico, zerado, comSaldo];
    const zerados = cadastro.reduce((acc, p) => acc + (produtoTemEstoque(p) ? 0 : 1), 0);
    expect(zerados).toBe(1);
    expect(cadastro.filter((p) => apareceParaVender(p, DESLIGADA)).map((p) => p.id)).toEqual(["s1", "p2"]);
  });
});

describe("fiação", () => {
  it("o Caixa usa o util (grade e contador) e nunca testa 'srv' por conta própria", () => {
    const src = ler("hooks/usePdvState.ts");
    expect(src).toMatch(/apareceParaVender\(p, \{ mostrarZerados: showOutOfStock, vendeSemEstoque \}\)/);
    expect(src).toMatch(/produtoTemEstoque\(p\) \? 0 : 1/);
  });

  it("o picker do Financeiro não barra serviço por saldo", () => {
    const src = ler("components/screens/financeiro/AddItemPicker.tsx");
    expect(src).toMatch(/controlaEstoque\(product\) && faltaEstoqueParaVender\(stockToCheck, parsedQty, vendeSemEstoque\)/);
  });

  it("a regra do serviço mora no util, pelo tipo do item (ehUnidadeServico)", () => {
    const src = ler("utils/vendaSemEstoque.ts");
    expect(src).toMatch(/from "@\/utils\/notaDoItem"/);
    expect(src).toMatch(/!ehUnidadeServico\(p\?\.unit\)/);
  });
});
