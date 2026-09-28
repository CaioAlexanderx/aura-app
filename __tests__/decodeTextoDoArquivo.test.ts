// ============================================================
// QA fix (item 13, Studio rodada 3, 28/09/2026) — decodeTextoDoArquivo.
//
// Achado: "Folha de sublimação" virou "Folha de sublima��o" no
// banco (produto real, mirror da Sheid). A causa: o import de CSV
// (utils/csv.ts, pickFileAndParse) forçava UTF-8 na leitura — Excel no
// Windows salva "CSV (separado por vírgulas)" em Windows-1252 por
// padrão, não UTF-8. Decodificar Windows-1252 como UTF-8 transforma cada
// byte alto (ex.: 0xE7 = "ç", 0xE3 = "ã") num caractere de substituição,
// porque eles não formam uma sequência UTF-8 válida sozinhos.
// ============================================================
jest.mock("react-native-svg", () => ({}));

// jsdom (o ambiente do Jest) não expõe TextEncoder/TextDecoder — são um
// Web API padrão em todo navegador evergreen (é isso que utils/csv.ts usa
// em produção), mas faltam aqui. Node tem os dois em `util` desde a v11.
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "util";
if (typeof (global as any).TextEncoder === "undefined") (global as any).TextEncoder = NodeTextEncoder;
if (typeof (global as any).TextDecoder === "undefined") (global as any).TextDecoder = NodeTextDecoder;

import { decodeTextoDoArquivo } from "@/utils/csv";

function bufDeBytes(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("decodeTextoDoArquivo", () => {
  test("UTF-8 de verdade decodifica normalmente", () => {
    const utf8 = new TextEncoder().encode("Folha de sublimação");
    expect(decodeTextoDoArquivo(utf8.buffer)).toBe("Folha de sublimação");
  });

  test("Windows-1252 (Excel no Windows) NÃO vira \\uFFFD — cai pro fallback", () => {
    // "ção" em Windows-1252: ç=0xE7, ã=0xE3, o=0x6F — bytes altos que NÃO
    // formam sequência UTF-8 válida sozinhos (é isso que fazia o TextDecoder
    // de UTF-8 não-estrito silenciosamente virar � antes deste fix).
    const win1252 = bufDeBytes([
      0x46, 0x6f, 0x6c, 0x68, 0x61, 0x20, 0x64, 0x65, 0x20, // "Folha de "
      0x73, 0x75, 0x62, 0x6c, 0x69, 0x6d, 0x61, // "sublima"
      0xe7, 0xe3, // "çã" em Windows-1252
      0x6f, // "o"
    ]);
    const resultado = decodeTextoDoArquivo(win1252);
    expect(resultado).toBe("Folha de sublimação");
    expect(resultado).not.toContain("�");
  });

  test("regressão: decodificar Windows-1252 como UTF-8 estrito falharia (por isso o fallback existe)", () => {
    const win1252 = bufDeBytes([0xe7, 0xe3, 0x6f]);
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(win1252)).toThrow();
  });
});
