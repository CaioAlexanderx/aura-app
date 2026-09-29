// Comprovante do lançamento (contas a pagar F3 · 29/09/2026): validação do
// arquivo antes de subir e o nome curto mostrado no anexo.
jest.mock("@/services/api", () => ({ companiesApi: {} }));
jest.mock("@/services/studioUploadApi", () => ({ pickFileWeb: jest.fn(), fileToBase64Web: jest.fn() }));

import { MAX_BYTES, nomeCurto, problemaDoArquivo } from "@/utils/comprovante";

describe("problemaDoArquivo", () => {
  it("foto e PDF passam", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf", "IMAGE/JPEG"]) {
      expect(problemaDoArquivo(t, 1000)).toBeNull();
    }
  });
  it("outros tipos, arquivo grande e vazio são recusados com a mensagem", () => {
    expect(problemaDoArquivo("text/html", 1000)).toMatch(/foto .* ou um PDF/);
    expect(problemaDoArquivo("application/pdf", MAX_BYTES + 1)).toMatch(/3,5 MB/);
    expect(problemaDoArquivo("application/pdf", MAX_BYTES)).toBeNull();
    expect(problemaDoArquivo("image/png", 0)).toBe("Arquivo vazio.");
  });
});

describe("nomeCurto", () => {
  it("mantém nomes curtos e corta os longos preservando a extensão", () => {
    expect(nomeCurto("boleto.pdf")).toBe("boleto.pdf");
    const curto = nomeCurto("comprovante-pagamento-energia-setembro-2026.pdf");
    expect(curto).toBe("comprovante-pagamento-e….pdf");
    expect(curto).toHaveLength(28);
    expect(nomeCurto(null)).toBe("comprovante");
  });
});
