// ============================================================
// 12/11/2026 — vale-troca permanente, com o prazo da loja em dias.
//
//   1. Cálculo: dia da venda (Brasília) + N dias, nas viradas de mês, de ano
//      e no bissexto; leitura tolerante do pdv_settings (ausente = 30).
//   2. Cupom: o bloco imprime "Troca em até N dias após a compra" (prazo da loja da venda).
//   3. 2ª via: a data é a da venda original + N, nunca hoje + N.
//   4. REGRA DE CUPOM: loja com o vale DESLIGADO = HTML do backend byte a
//      byte, com qualquer prazo salvo. Ligado, só o bloco do vale muda.
//   5. Caixa: o prazo do vale bipado é o da loja QUE VENDEU (campo do
//      sales-for-troca); sem o campo, o da loja ativa.
// ============================================================
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

jest.mock("@/services/trocaApi", () => ({ trocaApi: { searchSalesForTroca: jest.fn() } }));

import {
  VALE_TROCA_ATALHOS_DIAS, VALE_TROCA_PRAZO_PADRAO_DIAS,
  formatarDiaCurto, lerPrazoDoValeEmDias, normalizarPrazoEmDias, prazoDigitado, prazoDoVale,
  somarDias, textoDoEfeitoDoPrazo, textoDoPrazoNoCupom, textoDoValeVencido,
} from "@/utils/valeTroca";
import { blocoDoVale, cupomComVale, MARCA_DO_VALE } from "@/utils/valeTrocaCupom";
import { buscarVendaDoVale } from "@/components/screens/pdv/troca/valeTrocaBusca";
import { trocaApi } from "@/services/trocaApi";

const VENDA = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
const CUPOM = fs.readFileSync(path.join(__dirname, "__fixtures__", "cupomVenda.html"), "utf8");

describe("cálculo do prazo", () => {
  it("padrão 30 e atalhos 7, 15, 30, 60, 90", () => {
    expect(VALE_TROCA_PRAZO_PADRAO_DIAS).toBe(30);
    expect([...VALE_TROCA_ATALHOS_DIAS]).toEqual([7, 15, 30, 60, 90]);
  });

  it("dia da venda + N, virando mês, ano e o 29/02 do bissexto", () => {
    expect(prazoDoVale("2026-11-12T15:00:00Z", 30)).toBe("2026-12-12");
    expect(prazoDoVale("2026-11-12T15:00:00Z", 7)).toBe("2026-11-19");
    expect(prazoDoVale("2026-12-20T15:00:00Z", 15)).toBe("2027-01-04");
    expect(prazoDoVale("2026-11-12T15:00:00Z", 365)).toBe("2027-11-12");
    expect(prazoDoVale("2028-02-20T15:00:00Z", 9)).toBe("2028-02-29");
    expect(prazoDoVale("2026-01-31T15:00:00Z", 1)).toBe("2026-02-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("a venda das 22h em Brasília é do mesmo dia (não do dia seguinte em UTC)", () => {
    // 12/11 22:30 BRT = 13/11 01:30 UTC
    expect(prazoDoVale("2026-11-13T01:30:00Z", 30)).toBe("2026-12-12");
  });

  it("prazo inválido cai no padrão (30)", () => {
    [undefined, null, 0, -1, 366, 7.5, "abc", "", true].forEach((v) => {
      expect(normalizarPrazoEmDias(v)).toBe(30);
    });
    expect(normalizarPrazoEmDias("45")).toBe(45);
    expect(prazoDoVale("2026-11-12T15:00:00Z", 0)).toBe("2026-12-12");
  });

  it("lê o prazo do pdv_settings da loja", () => {
    expect(lerPrazoDoValeEmDias(undefined)).toBe(30);
    expect(lerPrazoDoValeEmDias({})).toBe(30);
    expect(lerPrazoDoValeEmDias({ vale_troca_prazo_dias: null })).toBe(30);
    expect(lerPrazoDoValeEmDias({ vale_troca_prazo_dias: 90 })).toBe(90);
  });

  it("campo livre: só inteiro de 1 a 365", () => {
    expect(prazoDigitado("1")).toBe(1);
    expect(prazoDigitado(" 365 ")).toBe(365);
    expect(prazoDigitado("45")).toBe(45);
    ["", "0", "366", "999", "7,5", "abc", "-3", "1000"].forEach((t) => expect(prazoDigitado(t)).toBeNull());
  });

  it("textos: efeito do campo, cupom e aviso do Caixa", () => {
    const hoje = new Date("2026-11-12T15:00:00Z");
    expect(textoDoEfeitoDoPrazo(30, hoje)).toBe("No cupom: troca em até 30 dias após a compra");
    expect(textoDoEfeitoDoPrazo(60, hoje)).toBe("No cupom: troca em até 60 dias após a compra");
    expect(textoDoEfeitoDoPrazo(1, hoje)).toBe("No cupom: troca em até 1 dia após a compra");
    expect(textoDoPrazoNoCupom(30)).toBe("Troca em até 30 dias após a compra, apresentando este cupom");
    expect(textoDoValeVencido("2026-11-05", hoje))
      .toBe("O prazo de troca desta compra terminou em 05/11. Quer trocar mesmo assim?");
    expect(formatarDiaCurto("2025-12-20", hoje)).toBe("20/12/2025");
  });
});

describe("bloco no cupom", () => {
  const ligado = (dias?: number) => ({ vale_troca_enabled: true, ...(dias ? { vale_troca_prazo_dias: dias } : {}) });

  it("imprime a data da venda + o prazo da loja", () => {
    const vendaEm = new Date("2026-11-12T15:00:00Z");
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje: vendaEm, config: ligado(15) });
    expect(html).toContain("Troca em até 15 dias após a compra, apresentando este cupom");
    expect(html.split(MARCA_DO_VALE).length - 1).toBe(1);
  });

  it("sem prazo salvo (backend antigo ou loja que nunca escolheu): 30 dias", () => {
    const vendaEm = new Date("2026-11-12T15:00:00Z");
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje: vendaEm, config: ligado() });
    expect(html).toContain("Troca em até 30 dias após a compra, apresentando este cupom");
  });

  it("vale o ano todo: venda de março também leva o vale", () => {
    const vendaEm = new Date("2027-03-10T15:00:00Z");
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje: vendaEm, config: ligado(7) });
    expect(html).toContain("Troca em até 7 dias após a compra, apresentando este cupom");
  });

  it("2ª via: a data é a da venda original + N, não hoje + N", () => {
    const vendaEm = "2026-11-02T15:00:00Z";
    const hoje = new Date("2026-11-20T15:00:00Z");
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje, config: ligado(30) });
    expect(html).toContain("Troca em até 30 dias após a compra, apresentando este cupom");
    expect(html).not.toContain("20/12/2026");
  });

  it("2ª via depois do prazo da venda: o vale não sai (cupom idêntico)", () => {
    const html = cupomComVale(CUPOM, {
      companyId: "loja-a", saleId: VENDA, vendaEm: "2026-11-02T15:00:00Z",
      hoje: new Date("2026-11-10T15:00:00Z"), config: ligado(7),
    });
    expect(html).toBe(CUPOM);
  });

  it("ligado, só o bloco do vale muda: tirar o bloco devolve o cupom do backend", () => {
    const vendaEm = new Date("2026-11-12T15:00:00Z");
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje: vendaEm, config: ligado(60) });
    expect(html.replace(blocoDoVale(VENDA, 60), "")).toBe(CUPOM);
  });
});

describe("REGRA DE CUPOM: vale desligado = cupom de hoje, byte a byte", () => {
  it("a fixture é o cupom do backend gravado em 13/10/2026 (não foi mexida)", () => {
    const lf = CUPOM.replace(/\r\n/g, "\n");
    expect(crypto.createHash("sha256").update(lf, "utf8").digest("hex"))
      .toBe("e7f4053f2b9ebb4b3d653fc8d023d27aa3f0bb0d1d77c5da7f0f0cdd77153c2a");
  });

  const vendaEm = new Date("2026-11-12T15:00:00Z");
  it.each([
    ["sem pdv_settings", undefined],
    ["pdv_settings vazio", {}],
    ["desligado", { vale_troca_enabled: false }],
    ["desligado com prazo salvo", { vale_troca_enabled: false, vale_troca_prazo_dias: 90 }],
    ["só o prazo, sem o toggle", { vale_troca_prazo_dias: 15 }],
    ["toggle null", { vale_troca_enabled: null, vale_troca_prazo_dias: 30 }],
  ])("%s: idêntico", (_nome, config) => {
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm, hoje: vendaEm, config: config as any });
    expect(html).toBe(CUPOM);
    expect(Buffer.from(html, "utf8").equals(Buffer.from(CUPOM, "utf8"))).toBe(true);
  });
});

describe("Caixa: prazo do vale bipado", () => {
  const busca = trocaApi.searchSalesForTroca as jest.Mock;
  const venda = (extra: any = {}) => ({ id: VENDA, created_at: "2026-11-02T15:00:00Z", items: [], ...extra });
  beforeEach(() => busca.mockReset());

  it("usa o prazo da loja que vendeu (campo do backend), não o da loja ativa", async () => {
    busca.mockResolvedValue([venda({ vale_troca_prazo_dias: 60, is_cross_filial: true })]);
    const r = await buscarVendaDoVale("loja-ativa", VENDA, new Date("2026-12-20T15:00:00Z"), 7);
    expect(r).toMatchObject({ ok: true, prazoAte: "2027-01-01", vencido: false });
  });

  it("backend sem o campo: vale o prazo da loja ativa", async () => {
    busca.mockResolvedValue([venda()]);
    const r = await buscarVendaDoVale("loja-ativa", VENDA, new Date("2026-11-20T15:00:00Z"), 7);
    expect(r).toMatchObject({ ok: true, prazoAte: "2026-11-09", vencido: true });
  });

  it("sem prazo nenhum: 30 dias", async () => {
    busca.mockResolvedValue([venda()]);
    const r = await buscarVendaDoVale("loja-ativa", VENDA, new Date("2026-11-20T15:00:00Z"));
    expect(r).toMatchObject({ ok: true, prazoAte: "2026-12-02", vencido: false });
  });
});
