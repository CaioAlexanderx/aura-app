// 13/10/2026 — vale-troca por QR no cupom. Formato do código, leitura
// tolerante, prazo nas bordas (dia civil de Brasília) e o bloco no cupom
// com e sem a campanha.
import * as fs from "fs";
import * as path from "path";

// Espia a lib de QR deixando ela rodar de verdade: o conteúdo gravado no QR
// é o que o leitor vai devolver ao Caixa.
jest.mock("qrcode-svg", () => {
  const Real = jest.requireActual("qrcode-svg");
  const chamadas: any[] = [];
  function Espia(this: any, opts: any) {
    chamadas.push(opts);
    return new Real(opts);
  }
  (Espia as any).chamadas = chamadas;
  return Espia;
});

import {
  VALE_TROCA_PRAZO_ATE, VALE_TROCA_VENDAS_ATE, VALE_TROCA_VENDAS_DE,
  deveImprimirVale, diaEmBrasilia, formatarDiaBR, lerCodigoDoVale,
  lerValeTrocaLigado, montarCodigoDoVale, prazoDoVale, salvarValeTrocaLigado,
  textoDoPrazoNoCupom, vendaCaiNoPeriodoDoVale, valeVencido,
} from "@/utils/valeTroca";
import { blocoDoVale, cupomComVale, injetarValeNoCupom, MARCA_DO_VALE } from "@/utils/valeTrocaCupom";

const VENDA = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
const CUPOM = fs.readFileSync(path.join(__dirname, "__fixtures__", "cupomVenda.html"), "utf8");

describe("código do vale", () => {
  it("formato AURA-TROCA:<venda em maiúsculas>", () => {
    expect(montarCodigoDoVale(VENDA)).toBe("AURA-TROCA:3F2A9C1E-7B44-4D0A-9E5F-0A1B2C3D4E5F");
  });

  it("ida e volta devolve o UUID em minúsculas", () => {
    expect(lerCodigoDoVale(montarCodigoDoVale(VENDA))).toEqual({ saleId: VENDA });
  });

  it("aceita minúsculas, espaços nas pontas e o UUID sem hífens", () => {
    expect(lerCodigoDoVale("  aura-troca:" + VENDA + " ")).toEqual({ saleId: VENDA });
    expect(lerCodigoDoVale("AURA-TROCA:" + VENDA.replace(/-/g, "").toUpperCase())).toEqual({ saleId: VENDA });
  });

  it("tolera o separador trocado por leitor com layout de teclado errado", () => {
    expect(lerCodigoDoVale("AURA-TROCAÇ" + VENDA)).toEqual({ saleId: VENDA });
    expect(lerCodigoDoVale("AURA-TROCA;" + VENDA)).toEqual({ saleId: VENDA });
    expect(lerCodigoDoVale("AURA/TROCA:" + VENDA)).toEqual({ saleId: VENDA });
  });

  it("não confunde com código de barras, texto de busca, CPF ou UUID puro", () => {
    expect(lerCodigoDoVale("7891234567895")).toBeNull();
    expect(lerCodigoDoVale("camisa azul")).toBeNull();
    expect(lerCodigoDoVale("12345678901")).toBeNull();
    expect(lerCodigoDoVale(VENDA)).toBeNull();
    expect(lerCodigoDoVale("AURA-TROCA:")).toBeNull();
    expect(lerCodigoDoVale("AURA-TROCA:123")).toBeNull();
    expect(lerCodigoDoVale("AURA-TROCA:" + VENDA + "9")).toBeNull();
    expect(lerCodigoDoVale("OUTRA-COISA:" + VENDA)).toBeNull();
    expect(lerCodigoDoVale(null)).toBeNull();
    expect(lerCodigoDoVale(undefined)).toBeNull();
  });
});

describe("prazo do vale — bordas (dia civil de Brasília, UTC-3)", () => {
  it("as datas da campanha ficam numa constante só", () => {
    expect(VALE_TROCA_VENDAS_DE).toBe("2026-11-01");
    expect(VALE_TROCA_VENDAS_ATE).toBe("2026-12-31");
    expect(VALE_TROCA_PRAZO_ATE).toBe("2027-01-31");
  });

  it("venda de 31/10 às 23:59:59 fica fora; 01/11 às 00:00:00 entra", () => {
    expect(vendaCaiNoPeriodoDoVale("2026-11-01T02:59:59Z")).toBe(false); // 31/10 23:59:59 BRT
    expect(vendaCaiNoPeriodoDoVale("2026-11-01T03:00:00Z")).toBe(true);  // 01/11 00:00:00 BRT
  });

  it("venda de 31/12 às 23:59:59 entra; 01/01 às 00:00:00 fica fora", () => {
    expect(vendaCaiNoPeriodoDoVale("2027-01-01T02:59:59Z")).toBe(true);  // 31/12 23:59:59 BRT
    expect(vendaCaiNoPeriodoDoVale("2027-01-01T03:00:00Z")).toBe(false); // 01/01 00:00:00 BRT
  });

  it("venda no meio da campanha tem prazo até 31/01/2027; fora não tem prazo do vale", () => {
    expect(prazoDoVale("2026-12-12T18:42:10Z")).toBe("2027-01-31");
    expect(prazoDoVale("2026-03-10T12:00:00Z")).toBeNull();
    expect(prazoDoVale(null)).toBeNull();
    expect(prazoDoVale("lixo")).toBeNull();
  });

  it("31/01 inteiro ainda vale; 01/02 às 00:00 BRT venceu", () => {
    expect(valeVencido("2027-01-31", "2027-01-31T02:59:59Z")).toBe(false); // 30/01 23:59 BRT
    expect(valeVencido("2027-01-31", "2027-02-01T02:59:59Z")).toBe(false); // 31/01 23:59:59 BRT
    expect(valeVencido("2027-01-31", "2027-02-01T03:00:00Z")).toBe(true);  // 01/02 00:00:00 BRT
  });

  it("diaEmBrasilia e formatarDiaBR", () => {
    expect(diaEmBrasilia("2026-12-12T01:00:00Z")).toBe("2026-12-11");
    expect(diaEmBrasilia("nada")).toBeNull();
    expect(formatarDiaBR("2027-01-31")).toBe("31/01/2027");
  });

  it("texto do cupom", () => {
    expect(textoDoPrazoNoCupom()).toBe("Troque até 31/01/2027 apresentando este cupom");
  });
});

describe("deveImprimirVale", () => {
  const dentro = "2026-12-12T18:42:10Z";
  it("venda da campanha, loja com o padrão (ligado), prazo em dia: imprime", () => {
    expect(deveImprimirVale({ vendaEm: dentro, hoje: "2026-12-12T18:45:00Z" })).toBe(true);
  });
  it("loja desligou: não imprime", () => {
    expect(deveImprimirVale({ vendaEm: dentro, hoje: "2026-12-12T18:45:00Z", ligado: false })).toBe(false);
  });
  it("venda fora da campanha: não imprime", () => {
    expect(deveImprimirVale({ vendaEm: "2026-10-20T15:00:00Z", hoje: "2026-10-20T15:05:00Z" })).toBe(false);
  });
  it("2ª via depois do prazo: não promete troca vencida", () => {
    expect(deveImprimirVale({ vendaEm: dentro, hoje: "2027-02-03T15:00:00Z" })).toBe(false);
    expect(deveImprimirVale({ vendaEm: dentro, hoje: "2027-01-31T15:00:00Z" })).toBe(true);
  });
});

describe("preferência da loja", () => {
  beforeEach(() => window.localStorage.clear());
  it("padrão é ligado e é guardada por loja", () => {
    expect(lerValeTrocaLigado("loja-a")).toBe(true);
    salvarValeTrocaLigado("loja-a", false);
    expect(lerValeTrocaLigado("loja-a")).toBe(false);
    expect(lerValeTrocaLigado("loja-b")).toBe(true);
    salvarValeTrocaLigado("loja-a", true);
    expect(lerValeTrocaLigado("loja-a")).toBe(true);
  });
  it("sem loja não quebra", () => {
    expect(lerValeTrocaLigado(null)).toBe(true);
    expect(() => salvarValeTrocaLigado(undefined, false)).not.toThrow();
  });
});

describe("cupom impresso", () => {
  beforeEach(() => {
    window.localStorage.clear();
    (require("qrcode-svg") as any).chamadas.length = 0;
  });
  const dez = "2026-12-12T18:42:10Z";
  const agora = new Date("2026-12-12T18:45:00Z");

  it("com a campanha: bloco com QR, texto do prazo e ordem certa (antes do rodapé)", () => {
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm: dez, hoje: agora });
    expect(html).not.toBe(CUPOM);
    expect(html).toContain(MARCA_DO_VALE);
    expect(html).toContain("VALE-TROCA");
    expect(html).toContain("Troque até 31/01/2027 apresentando este cupom");
    expect(html).toMatch(/<svg[\s\S]*<\/svg>/);
    // o QR carrega o código do vale, uma vez só
    const chamadas = (require("qrcode-svg") as any).chamadas;
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].content).toBe("AURA-TROCA:" + VENDA.toUpperCase());
    // orientação padrão (não espelhada) e nível de correção M
    expect(chamadas[0].swap).toBe(true);
    expect(chamadas[0].ecl).toBe("M");
    // entra entre os totais e o rodapé, sem perder nada do cupom original
    expect(html.indexOf("TOTAL")).toBeLessThan(html.indexOf(MARCA_DO_VALE));
    expect(html.indexOf(MARCA_DO_VALE)).toBeLessThan(html.indexOf("Obrigado pela preferencia!"));
    expect(html.replace(blocoDoVale(VENDA, "2027-01-31"), "")).toBe(CUPOM);
  });

  it("sem imagem remota: o QR é SVG inline", () => {
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm: dez, hoje: agora });
    expect(html).not.toMatch(/qrserver|<img/i);
  });

  it("venda fora da campanha: o HTML do backend sai idêntico", () => {
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm: "2026-10-31T17:00:00Z", hoje: agora });
    expect(html).toBe(CUPOM);
  });

  it("loja que desligou o vale: idêntico", () => {
    salvarValeTrocaLigado("loja-a", false);
    const html = cupomComVale(CUPOM, { companyId: "loja-a", saleId: VENDA, vendaEm: dez, hoje: agora });
    expect(html).toBe(CUPOM);
  });

  it("prazo vencido (2ª via em fevereiro): idêntico", () => {
    const html = cupomComVale(CUPOM, {
      companyId: "loja-a", saleId: VENDA, vendaEm: dez, hoje: new Date("2027-02-10T12:00:00Z"),
    });
    expect(html).toBe(CUPOM);
  });

  it("não duplica se o backend já imprimir o bloco", () => {
    const uma = injetarValeNoCupom(CUPOM, VENDA);
    expect(injetarValeNoCupom(uma, VENDA)).toBe(uma);
    expect(uma.split("data-vale-troca").length - 1).toBe(1);
  });

  it("sem o rodapé conhecido entra antes de </body>; sem </body>, no fim", () => {
    const semRodape = "<html><body><p>cupom</p></body></html>";
    const a = injetarValeNoCupom(semRodape, VENDA);
    expect(a.indexOf(MARCA_DO_VALE)).toBeLessThan(a.indexOf("</body>"));
    const b = injetarValeNoCupom("<p>cupom</p>", VENDA);
    expect(b.startsWith("<p>cupom</p>")).toBe(true);
    expect(b).toContain(MARCA_DO_VALE);
  });

  it("o bloco existe com o texto do prazo informado", () => {
    expect(blocoDoVale(VENDA, "2027-01-31")).toContain("Troque até 31/01/2027 apresentando este cupom");
  });
});
