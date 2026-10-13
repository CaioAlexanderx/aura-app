// ============================================================================
// AURA. — Etiquetas: BYTE A BYTE em todos os modelos (13/10/2026)
//
// Clientes imprimem etiqueta hoje. O modo contínuo, o passo entre linhas, o
// deslocamento vertical e a linha de teste (13/10/2026, Divina D'Lux) só
// podem mudar o HTML de quem LIGA uma dessas opções. Os fixtures em
// __fixtures__/labels/byte-a-byte/ foram gravados a partir do
// buildLabelHtml.ts de origin/main (a0efe5b4, ANTES desta mudança) e cobrem
// os 4 modelos (99x21, 105x21, 30x25, 58mm) × EAN-13 e QR × com e sem
// variante, mais deslocamento horizontal, preço no cartão e sem nome da loja.
//
// Este teste NUNCA deve regravar fixture — se algo aqui quebrar, o bug está
// no código novo, não no fixture.
// ============================================================================
import fs from "fs";
import path from "path";
import { buildLabelHtml, LABEL_SIZE_KEYS } from "@/components/screens/estoque/labels/buildLabelHtml";

const FIX_DIR = path.join(__dirname, "__fixtures__", "labels", "byte-a-byte");

// Sem variante: produto simples, nome longo (>16 letras), preço com milhar,
// quantidade que passa de uma linha (7 etiquetas = 3 linhas no rolo de 3).
const SEM_VARIANTE = [
  { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 1 },
  { name: "Porcelanato Retificado Acetinado Extra Grande", price: 1234.56, barcode: "7891234567897", size: "", color: "", qty: 2 },
  { name: "Meia <Arrastão> & \"Cia\"", price: 20, barcode: "2001234567893", size: "", color: "", qty: 4 },
];
// Com variante: tamanho + cor por nome, cor em hex, só tamanho, código que
// não é EAN-13 (cai no CODE128).
const COM_VARIANTE = [
  { name: "Camiseta Basica Algodao", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 2 },
  { name: "Vestido Midi Tule Bordado Manga Longa Festa", price: 1000, barcode: "7891033948208", size: "G", color: "#ffffff", qty: 1 },
  { name: "Calça Jeans", price: 189.9, barcode: "SKU-00123", size: "42", color: "", qty: 2 },
  { name: "Blusa Canelada", price: 59.9, barcode: "7891234567899", size: "ÚNICO", color: "Verde militar", qty: 1 },
];
const COM_CARTAO = [
  { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 2, cardPrice: 39.9 },
  { name: "Camiseta Basica Algodao", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 1 },
];

type Caso = { nome: string; items: any[]; opts: any };

function casos(): Caso[] {
  const lista: Caso[] = [];
  LABEL_SIZE_KEYS.forEach(function (size) {
    (["barcode", "qr"] as const).forEach(function (mode) {
      const base = { mode: mode, storeName: "Divina D'Lux", showStoreName: true, labelSize: size };
      lista.push({ nome: size + "-" + mode + "-sem-variante", items: SEM_VARIANTE, opts: base });
      lista.push({ nome: size + "-" + mode + "-com-variante", items: COM_VARIANTE, opts: base });
    });
    const bc = { mode: "barcode" as const, storeName: "Divina D'Lux", showStoreName: true, labelSize: size };
    lista.push({ nome: size + "-barcode-deslocamento-horizontal", items: COM_VARIANTE, opts: { ...bc, offsetMm: -1.5 } });
    lista.push({ nome: size + "-barcode-preco-no-cartao", items: COM_CARTAO, opts: { ...bc, offsetMm: 0 } });
    lista.push({ nome: size + "-barcode-sem-nome-da-loja", items: SEM_VARIANTE, opts: { ...bc, showStoreName: false } });
  });
  return lista;
}

const CASOS = casos();

describe("buildLabelHtml — opções novas desligadas: byte a byte igual a origin/main", () => {
  test("a matriz cobre os 4 modelos (28 fixtures)", () => {
    expect(CASOS.length).toBe(28);
    expect(fs.readdirSync(FIX_DIR).filter((f) => f.endsWith(".html")).length).toBe(28);
  });

  test.each(CASOS.map((c) => [c.nome, c] as const))("%s — sem nenhuma opção nova", (_nome, c) => {
    const esperado = fs.readFileSync(path.join(FIX_DIR, c.nome + ".html"), "utf-8");
    expect(buildLabelHtml(c.items, c.opts)).toBe(esperado);
  });
});
