// ============================================================================
// AURA. — Etiquetas: NÃO VAZA (QA 23/09/2026, restrição do Caio)
//
// Clientes imprimindo etiqueta hoje não podem ver NENHUMA mudança de byte
// com `card_price_enabled` desligado/ausente. Os 4 fixtures em
// __fixtures__/labels/ foram gravados a partir do buildLabelHtml.ts de
// origin/main (ANTES desta mudança), cobrindo os dois formatos (33x21 e
// 30x25), os dois modos (código de barras e QR), produto simples, produto
// com variante (cor/tamanho) e nome longo (>16 chars, trunca com "..."), e
// preço com separador de milhar (R$ 1.234,56).
//
// Este teste NUNCA deve regravar fixture — se algo aqui quebrar, o bug está
// no código novo, não no fixture.
// ============================================================================
import fs from "fs";
import path from "path";
import { buildLabelHtml } from "@/components/screens/estoque/labels/buildLabelHtml";

const FIX_DIR = path.join(__dirname, "__fixtures__", "labels");

const ITEM_SIMPLE = { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 1 };
const ITEM_VARIANT = { name: "Camiseta Basica Algodao", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 2 };
const ITEM_LONGNAME = { name: "Porcelanato Retificado Acetinado Extra Grande", price: 1234.56, barcode: "7891234567897", size: "", color: "", qty: 1 };

const ITEMS = [ITEM_SIMPLE, ITEM_VARIANT, ITEM_LONGNAME];

describe("buildLabelHtml — sem preço no cartão é byte-idêntico a origin/main", () => {
  (["99x21", "30x25"] as const).forEach(function (size) {
    (["barcode", "qr"] as const).forEach(function (mode) {
      test(size + " " + mode + " — HTML idêntico ao fixture", () => {
        const fixturePath = path.join(FIX_DIR, "sem-cartao-" + size + "-" + mode + ".html");
        const expected = fs.readFileSync(fixturePath, "utf-8");
        const actual = buildLabelHtml(ITEMS as any, {
          mode: mode, storeName: "Depósito Finesse", showStoreName: true, labelSize: size, offsetMm: 0,
        });
        expect(actual).toBe(expected);
      });
    });
  });
});
