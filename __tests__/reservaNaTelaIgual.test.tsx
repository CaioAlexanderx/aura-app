// ============================================================
// Pedido separado de venda (A4, p-63d): sem a reserva (trava desligada ou
// sem os campos na resposta), o cartão do Caixa e as linhas do Estoque ficam
// iguais aos de antes, byte a byte.
//
// __tests__/fixtures/reservaNaTela.json guarda o sha256 da árvore de
// ProductGrid, ProductRow e ProductTableWeb do código ANTES do A4
// (feat/pedido-a2-novo-pedido, com GERAR_FIXTURE=1). Os produtos dos
// cenários já trazem reservedQty / reservedByVariant: o código antigo os
// ignorava, e o novo também precisa ignorar quando a trava está desligada.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: (sel?: any) => { const st = { company: { id: "c1" }, user: { id: "u1", is_staff: false } }; return sel ? sel(st) : st; } }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { ProductGrid, __reiniciarEntradaDaGrade } from "@/components/screens/pdv/ProductGrid";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { ProductTableWeb } from "@/components/screens/estoque/ProductTableWeb";

const FIXTURE = path.join(__dirname, "fixtures", "reservaNaTela.json");

const VESTIDO: any = {
  id: "11111111-1111-4111-8111-111111111111", name: "Vestido Midi Linho", code: "V1", barcode: "", category: "Vestidos",
  price: 189.9, cost: 80, stock: 4, minStock: 1, unit: "un", notes: "", color: "", size: "",
  reservedQty: 1, reservedByVariant: {},
};
const CINTO: any = { ...VESTIDO, id: "22222222-2222-4222-8222-222222222222", name: "Cinto Couro", stock: 1, reservedQty: 1 };
const BLUSA: any = { ...VESTIDO, id: "33333333-3333-4333-8333-333333333333", name: "Blusa Tricot", stock: 2, reservedQty: 0 };
const SEM_CAMPO: any = { id: "44444444-4444-4444-8444-444444444444", name: "Saia", code: "S1", barcode: "", category: "Saias", price: 149.9, cost: 50, stock: 6, minStock: 0, unit: "un", notes: "", color: "", size: "" };
const PRODUTOS = [VESTIDO, CINTO, BLUSA, SEM_CAMPO];

function hash(el: React.ReactElement): string {
  __reiniciarEntradaDaGrade();
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  const json = JSON.stringify(tree.toJSON());
  tree.unmount();
  return createHash("sha256").update(json).digest("hex");
}

const CENARIOS: Record<string, () => React.ReactElement> = {
  "grade": () => <ProductGrid products={PRODUTOS} qtyById={{}} onAdd={() => {}} minCard={180} />,
  "grade-com-carrinho": () => <ProductGrid products={PRODUTOS} qtyById={{ [VESTIDO.id]: 2 }} onAdd={() => {}} compact />,
  "linha-vestido": () => <ProductRow product={VESTIDO} />,
  "linha-cinto": () => <ProductRow product={CINTO} />,
  "linha-sem-campo": () => <ProductRow product={SEM_CAMPO} />,
  "tabela": () => <ProductTableWeb items={PRODUTOS} bulkMode={false} bulkSelected={new Set()} onSelect={() => {}} canLink={false} />,
};

if (process.env.GERAR_FIXTURE === "1") {
  test("grava as impressões de antes", () => {
    const out: Record<string, string> = {};
    for (const [nome, el] of Object.entries(CENARIOS)) out[nome] = hash(el());
    fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 2) + "\n");
    expect(Object.keys(out).length).toBe(Object.keys(CENARIOS).length);
  });
} else {
  const gravado: Record<string, string> = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  describe("trava desligada: cartão e linhas iguais aos de antes", () => {
    for (const [nome, el] of Object.entries(CENARIOS)) {
      test(nome, () => { expect(hash(el())).toBe(gravado[nome]); });
    }
  });
}
