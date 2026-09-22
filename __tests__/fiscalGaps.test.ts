// ============================================================
// utils/cest.ts — calcularFiscalGaps (Matcon M2, 22/09/2026,
// docs/CONTRACT_MATCON.md §M2). Helper puro por trás do aviso fiscal do
// Estoque (AlertsList) e da lista do FiscalGapsModal.
//
// Conta só produtos de família com ST provável (NCM bate com a tabela de
// utils/cest.ts) e sem código fiscal (CEST) ainda — sem chamada nova, a
// tela de Estoque já tem a lista de produtos em memória.
// ============================================================
import { calcularFiscalGaps } from "@/utils/cest";

const cimento = { id: "1", name: "Cimento CP-II 50 kg", unit: "sc", ncm: "25232910", cest: null as string | null };

describe("calcularFiscalGaps", () => {
  test("conta só produtos com NCM de família ST e sem CEST", () => {
    const produtos = [
      cimento,                                         // família ST, sem CEST -> conta
      { ...cimento, id: "2", cest: "0500100" },         // já tem CEST -> não conta
      { ...cimento, id: "3", ncm: "64041100" },         // NCM fora da tabela -> não conta
      { ...cimento, id: "4", unit: "srv" },              // serviço -> não conta
      { ...cimento, id: "5", ncm: "" },                  // sem NCM -> não conta
      { ...cimento, id: "6", ncm: null as any },         // NCM nulo -> não conta
    ];
    const gaps = calcularFiscalGaps(produtos);
    expect(gaps.map((p) => p.id)).toEqual(["1"]);
  });

  test("CEST vazio ('') também conta como sem código fiscal", () => {
    const gaps = calcularFiscalGaps([{ ...cimento, cest: "" }]);
    expect(gaps.length).toBe(1);
  });

  test("várias famílias juntas", () => {
    const produtos = [
      cimento,
      { ...cimento, id: "2", name: "Argamassa AC-III", ncm: "32149000" },
      { ...cimento, id: "3", name: "Tinta acrílica", ncm: "32091010" },
      { ...cimento, id: "4", name: "Porcelanato", ncm: "69072100" },
    ];
    expect(calcularFiscalGaps(produtos).length).toBe(4);
  });

  test("lista vazia/undefined/null -> []", () => {
    expect(calcularFiscalGaps([])).toEqual([]);
    expect(calcularFiscalGaps(undefined as any)).toEqual([]);
    expect(calcularFiscalGaps(null as any)).toEqual([]);
  });
});
