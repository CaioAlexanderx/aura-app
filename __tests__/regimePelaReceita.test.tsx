// 12/10/2026 — regime tributário pela Receita na tela de Configurações.
// Mesma regra do backend: optante do SIMEI é MEI; optante do Simples é
// Simples; fora do Simples é Presumido. Natureza 2135 sozinha não diz nada.
import { inferRegime } from "@/components/screens/configuracoes/CnpjSection";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "co-1" } }) }));
jest.mock("@/services/api", () => ({ companiesApi: { updateProfile: jest.fn() } }));

const ei = { natureza_juridica: { id: "2135" }, porte: { descricao: "Micro Empresa" } };
const ltda = { natureza_juridica: { id: "2062" }, porte: { descricao: "Micro Empresa" } };

describe("inferRegime (Configurações › CNPJ)", () => {
  it("MEI optante é MEI", () => {
    expect(inferRegime({ ...ei, simples: { mei: "Sim", simples: "Sim" } })).toBe("mei");
  });
  it("Empresário Individual fora do MEI e no Simples é Simples", () => {
    expect(inferRegime({ ...ei, simples: { mei: "Não", simples: "Sim" } })).toBe("simples_nacional");
  });
  it("LTDA fora do Simples é Presumido", () => {
    expect(inferRegime({ ...ltda, simples: { mei: "Não", simples: "Não" } })).toBe("lucro_presumido");
  });
  it("sem o bloco simples cai no porte", () => {
    expect(inferRegime(ltda)).toBe("simples_nacional");
    expect(inferRegime({ ...ltda, porte: { descricao: "DEMAIS" } })).toBe("lucro_presumido");
  });
});
