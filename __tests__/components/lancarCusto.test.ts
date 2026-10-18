// Gestão Aura › Lançar custo do mês: regras do formulário (lancarCusto.ts).
import {
  erroDaLinha, formDoMes, lerValor, mesAtualBRT, mesesDoSeletor, montarCorpo, rotuloDoMes, totalPrevisto, validar, valorParaTexto,
} from "@/components/admin/painel/lancarCusto";
import type { PainelApiCustosMes } from "@/services/adminApi";

const MES: PainelApiCustosMes = {
  mes: "2026-09",
  existe_linha: true,
  mrr_total: 1136.07,
  total_costs: 871.17,
  taxas_asaas: 26.95,
  das: 45.34,
  sem_abertura: 321.17,
  categorias: [
    { id: "infraestrutura", rotulo: "Infraestrutura", ajuda: "", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "anthropic", rotulo: "Anthropic", ajuda: "", valor: 550, origem: "socio", observacao: "paga em conta pessoal do socio", lancado_em: null },
    { id: "meta", rotulo: "Meta", ajuda: "", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "outros", rotulo: "Outros", ajuda: "", valor: null, origem: null, observacao: null, lancado_em: null },
    { id: "demais", rotulo: "Demais (sem abertura)", ajuda: "", valor: 321.17, origem: null, observacao: "sem abertura", lancado_em: null },
  ],
  origens: [{ id: "empresa", rotulo: "Conta da empresa" }, { id: "socio", rotulo: "Conta pessoal do sócio" }, { id: "estimativa", rotulo: "Estimativa" }],
};

describe("lancarCusto", () => {
  it("meses do seletor: o corrente (Brasília) e os 5 anteriores", () => {
    // 01/11 01:00 UTC ainda é 31/10 em Brasília
    expect(mesAtualBRT(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(mesesDoSeletor(new Date("2026-02-10T15:00:00Z"))).toEqual(["2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
    expect(rotuloDoMes("2026-10")).toBe("out/2026");
  });

  it("lê o valor digitado em reais", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("180,4")).toBe(180.4);
    expect(lerValor("550")).toBe(550);
    expect(lerValor("R$ 49.90")).toBe(49.9);
    expect(lerValor("")).toBeNull();
    expect(lerValor("abc")).toBeNaN();
    expect(valorParaTexto(550)).toBe("550,00");
    expect(valorParaTexto(null)).toBe("");
  });

  it("linha intacta não valida nem vai no corpo; mexida exige valor >= 0, 2 casas e origem", () => {
    const linhas = formDoMes(MES);
    expect(validar(linhas)).toEqual({ ok: false, erros: {}, alteradas: 0 });

    const infra = { ...linhas[0], texto: "180,40" };
    expect(erroDaLinha(infra)).toMatch(/origem|onde saiu/);
    expect(erroDaLinha({ ...infra, origem: "empresa" })).toBeNull();
    expect(erroDaLinha({ ...infra, origem: "empresa", texto: "-5" })).toMatch(/negativo/);
    expect(erroDaLinha({ ...infra, origem: "empresa", texto: "1.234" })).toMatch(/2 casas/);
    expect(erroDaLinha({ ...infra, origem: "empresa", texto: "" })).toMatch(/Informe o valor/);
    expect(erroDaLinha({ ...infra, texto: "" })).toBeNull(); // voltou ao original: não mexida
    expect(erroDaLinha({ ...linhas[1], texto: "" })).toMatch(/Informe o valor/);
    expect(erroDaLinha({ ...infra, origem: "empresa", texto: "0" })).toBeNull();
  });

  it("corpo leva só as categorias mexidas, com valor em número e o motivo", () => {
    const linhas = formDoMes(MES).map((l) => {
      if (l.id === "infraestrutura") return { ...l, texto: "180,40", origem: "empresa" as const, observacao: " Railway + Supabase " };
      if (l.id === "demais") return { ...l, texto: "140,77", origem: "estimativa" as const };
      return l;
    });
    expect(validar(linhas)).toEqual({ ok: true, erros: {}, alteradas: 2 });
    expect(montarCorpo("2026-09", linhas, " abertura da sobra ")).toEqual({
      mes: "2026-09",
      categorias: {
        infraestrutura: { valor: 180.4, origem: "empresa", observacao: "Railway + Supabase" },
        demais: { valor: 140.77, origem: "estimativa", observacao: "sem abertura" },
      },
      motivo: "abertura da sobra",
    });
    // 550 + 180,40 + 140,77
    expect(totalPrevisto(linhas, MES.sem_abertura)).toBe(871.17);
  });

  it("total previsto soma o total sem abertura quando ele não é uma linha (abril)", () => {
    const abril = { ...MES, sem_abertura: 250, categorias: MES.categorias.filter((c) => c.id !== "demais").map((c) => ({ ...c, valor: null, origem: null })) };
    const linhas = formDoMes(abril).map((l) => (l.id === "meta" ? { ...l, texto: "10", origem: "empresa" as const } : l));
    expect(totalPrevisto(linhas, 250)).toBe(260);
  });
});
