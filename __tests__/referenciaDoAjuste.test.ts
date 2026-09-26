// ============================================================
// A referência do ajuste vira link no painel (achado A4 do QA da vitrine)
//
// O backend guarda a referência numa última linha "Referência: https://..."
// da nota da cliente. O painel separa e mostra como link; o que não for
// https fica como texto, nunca link.
// ============================================================
import { separarReferencia } from "@/components/studio/referenciaDoAjuste";

describe("separarReferencia", () => {
  test("texto da cliente e referência, no formato que o backend grava", () => {
    expect(separarReferencia("Trocar a fonte por uma mais redonda\nReferência: https://r2.getaura.com.br/ref.png"))
      .toEqual({ texto: "Trocar a fonte por uma mais redonda", referencia: "https://r2.getaura.com.br/ref.png" });
  });

  test("só a referência, sem texto", () => {
    expect(separarReferencia("Referência: https://r2.getaura.com.br/ref.png"))
      .toEqual({ texto: null, referencia: "https://r2.getaura.com.br/ref.png" });
  });

  test("nota sem referência fica como está", () => {
    expect(separarReferencia("Mais rosa, por favor")).toEqual({ texto: "Mais rosa, por favor", referencia: null });
  });

  test("texto de várias linhas é preservado", () => {
    expect(separarReferencia("Linha 1\nLinha 2\nReferência: https://x.com/a.png\n"))
      .toEqual({ texto: "Linha 1\nLinha 2", referencia: "https://x.com/a.png" });
  });

  test("http, javascript: ou endereço no meio do texto não viram link", () => {
    expect(separarReferencia("Referência: http://x.com/a.png").referencia).toBeNull();
    expect(separarReferencia("Referência: javascript:alert(1)").referencia).toBeNull();
    expect(separarReferencia("Referência: https://x.com/a.png\nE mais uma coisa").referencia).toBeNull();
  });

  test("vazio e nulo", () => {
    expect(separarReferencia(null)).toEqual({ texto: null, referencia: null });
    expect(separarReferencia("  ")).toEqual({ texto: null, referencia: null });
  });
});
