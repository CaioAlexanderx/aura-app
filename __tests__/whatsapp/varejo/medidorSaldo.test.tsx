// ============================================================
// Medidor do topo da aba Configurações do WhatsApp (26/11/2026), no
// formato do contrato do agente A (GET /whatsapp/saldo).
//
// Segura: a leitura do saldo (pura), "Faltam N", textos de esgotado,
// presente do Essencial, oferta de R$ 29 só quando o presente acaba,
// número em atenção, bloqueio por dúvida, pacotes (só link, nunca
// cobrança sozinha) e a tradução dos códigos de saldo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockComprar = jest.fn();
const mockListar = jest.fn();
jest.mock("@/services/waConfigApi", () => {
  const actual = jest.requireActual("@/services/waConfigApi");
  return {
    ...actual,
    waConfigApi: {
      ...actual.waConfigApi,
      comprarPacote: (...a: any[]) => mockComprar(...a),
      listarPacotes: (...a: any[]) => mockListar(...a),
    },
  };
});
import { Linking } from "react-native";
const mockAbrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);

import { MedidorSaldoCard } from "@/components/whatsapp/MedidorSaldoCard";
import { precoPacote, waNumeroEmAtencao, waSaldoInfo } from "@/components/whatsapp/waSaldo";
import { waSkipReasonLabel } from "@/components/whatsapp/waGuards";

const NOV = new Date(2026, 10, 26);
const PACOTES: any = {
  novidades: { qty: 100, preco_centavos: 6900 }, avisos: { qty: 200, preco_centavos: 1900 }, aurinha: { qty: 300, preco_centavos: 2900 },
};
const b = (total: number, usado: number, bucket: string, renova_em: string | null = "2026-12-01") => ({
  bucket, total, usado, restante: total - usado, renova_em, pacote: PACOTES[bucket],
  baixo: total - usado > 0 && total - usado <= total * 0.2, esgotado: total - usado === 0,
  aviso_chave: `${bucket}:2026-11`,
});

function raw(over: any = {}) {
  const { novidades, avisos, aurinha, plano, numero, ...resto } = over;
  return {
    ativo: true, mes: "2026-11", renova_em: "2026-12-01",
    plano: plano || { renova: true, origem: "plano" },
    numero: numero || { em_atencao: false, motivo: null },
    saldos: {
      novidades: novidades || b(10, 0, "novidades"),
      avisos: avisos || b(100, 28, "avisos"),
      aurinha: aurinha || b(80, 23, "aurinha"),
    },
    ...resto,
  };
}

const textos = (t: any) => JSON.stringify(t.toJSON()).replace(/","/g, "");
const tem = (t: any, id: string) => t.root.findAllByProps({ testID: id }).length > 0;
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id })[0];
const noop = () => {};
function medidor(r: any, extra: any = {}) {
  return renderer.create(
    <MedidorSaldoCard companyId="c" saldo={waSaldoInfo(r, NOV)} carregando={false} falhou={false} status={null} onRetry={noop} {...extra} />
  );
}

describe("waSaldoInfo (contrato do A)", () => {
  it("lê os três saldos com restante de total", () => {
    const i = waSaldoInfo(raw(), NOV)!;
    expect(i.avisos.livres).toBe("72 de 100 livres");
    expect(i.aurinha.livres).toBe("57 de 80 livres");
    expect(i.novidades.livres).toBe("10 de 10 livres");
    expect(i.mesNome).toBe("novembro");
    expect(i.ativo).toBe(true);
    expect(i.presente).toBe(false);
  });

  it("'Faltam N' com 20% ou menos (e ainda sobra)", () => {
    expect(waSaldoInfo(raw({ avisos: b(100, 80, "avisos") }), NOV)!.avisos.faltam).toBe("Faltam 20");
    expect(waSaldoInfo(raw({ avisos: b(100, 79, "avisos") }), NOV)!.avisos.faltam).toBeNull();
    expect(waSaldoInfo(raw({ avisos: b(100, 100, "avisos") }), NOV)!.avisos.faltam).toBeNull();
  });

  it("textos de esgotado, com 'Voltam em 1º de <mês>' pela renova_em", () => {
    const i = waSaldoInfo(raw({ mes: "2026-12", novidades: b(10, 10, "novidades", "2027-01-01"), avisos: b(100, 100, "avisos", "2027-01-01"), aurinha: b(80, 80, "aurinha", "2027-01-01") }), NOV)!;
    expect(i.novidades.textoEsgotado).toBe("As 10 novidades de dezembro acabaram. Voltam em 1º de janeiro.");
    expect(i.avisos.textoEsgotado).toBe("Os 100 avisos de dezembro acabaram.");
    expect(i.aurinha.textoEsgotado).toBe("A Aurinha atendeu as 80 conversas do mês. As novas ficam com você.");
  });

  it("no Essencial sem add-on (renova_em nulo) não promete que volta", () => {
    const i = waSaldoInfo(raw({ plano: { renova: false, origem: "essencial" }, novidades: b(10, 10, "novidades", null) }), NOV)!;
    expect(i.novidades.textoEsgotado).toBe("As 10 novidades acabaram.");
  });

  it("dúvida bloqueia: balde ausente, negativo ou torto derruba tudo", () => {
    expect(waSaldoInfo(null)).toBeNull();
    expect(waSaldoInfo({ ativo: true } as any)).toBeNull();
    expect(waSaldoInfo(raw({ aurinha: { total: -1, restante: 3 } }))).toBeNull();
    expect(waSaldoInfo(raw({ avisos: { total: 100 } }))).toBeNull();
    expect(waSaldoInfo(raw({ avisos: { total: "100", usado: 1 } }))).toBeNull();
  });

  it("a flag esgotado do servidor vale mesmo com número que diz sobrar", () => {
    const i = waSaldoInfo(raw({ avisos: { total: 100, usado: 90, restante: 10, esgotado: true } }), NOV)!;
    expect(i.avisos.esgotado).toBe(true);
  });

  it("oferta dos R$ 29 só no plano que não renova, com algum saldo esgotado", () => {
    const essencial = { renova: false, origem: "essencial" };
    expect(waSaldoInfo(raw({ plano: essencial }), NOV)!.mostrarOferta).toBe(false);
    expect(waSaldoInfo(raw({ plano: essencial, avisos: b(30, 30, "avisos", null) }), NOV)!.mostrarOferta).toBe(true);
    expect(waSaldoInfo(raw({ avisos: b(100, 100, "avisos") }), NOV)!.mostrarOferta).toBe(false);
    // sem a informação do plano, não afirma
    expect(waSaldoInfo(raw({ plano: {}, avisos: b(30, 30, "avisos") }), NOV)!.presente).toBe(false);
  });

  it("pacote: preço e quantidade do servidor", () => {
    const i = waSaldoInfo(raw(), NOV)!;
    expect(i.novidades.pacote!.rotulo).toBe("Adicionar 100 novidades por R$ 69");
    expect(i.avisos.pacote!.rotulo).toBe("Adicionar 200 avisos por R$ 19");
    expect(i.aurinha.pacote!.rotulo).toBe("Adicionar 300 conversas da Aurinha por R$ 29");
    expect(precoPacote(1990)).toBe("R$ 19,90");
    expect(waSaldoInfo(raw({ avisos: { ...b(100, 0, "avisos"), pacote: null } }), NOV)!.avisos.pacote).toBeNull();
  });
});

describe("número em atenção", () => {
  it("pelo saldo (contrato) ou pelo status", () => {
    expect(waSaldoInfo(raw({ numero: { em_atencao: true, motivo: "QUALIDADE" } }), NOV)!.numeroEmAtencao).toBe(true);
    expect(waNumeroEmAtencao({ quality_rating: "YELLOW" } as any)).toBe(true);
    expect(waNumeroEmAtencao({ paused_reason: "MANUAL" } as any)).toBe(false);
    expect(waNumeroEmAtencao(null)).toBe(false);
  });
});

describe("skip_reason de saldo em português", () => {
  it("nenhum código cru aparece", () => {
    expect(waSkipReasonLabel("SALDO_ESGOTADO")).toMatch(/saldo.*acabou/i);
    expect(waSkipReasonLabel("NUMERO_EM_ATENCAO")).toBe("O WhatsApp pediu uma pausa nas novidades. Avisos e cobranças continuam.");
    expect(waSkipReasonLabel("SALDO_INDISPONIVEL")).toMatch(/não consegui conferir o saldo/i);
    expect(waSkipReasonLabel("SALDO_ESGOTADO")).not.toMatch(/SALDO_/);
  });
});

describe("MedidorSaldoCard", () => {
  beforeEach(() => { mockComprar.mockReset(); mockListar.mockReset().mockResolvedValue({ data: [] }); mockAbrir.mockReset(); });

  it("mostra os três saldos, sem botão de pacote enquanto sobra", () => {
    const t = medidor(raw());
    expect(tem(t, "wa-saldo-medidor")).toBe(true);
    expect(textos(t)).toContain("72 de 100 livres");
    expect(tem(t, "wa-saldo-avisos-faltam")).toBe(false);
    expect(tem(t, "wa-saldo-pacotes")).toBe(false);
  });

  it("Faltam N com 20% ou menos", () => {
    expect(textos(medidor(raw({ avisos: b(100, 82, "avisos") })))).toContain("Faltam 18");
  });

  it("Essencial: presente não renova; oferta só quando acaba", () => {
    const essencial = { renova: false, origem: "essencial" };
    const antes = medidor(raw({ plano: essencial, novidades: b(10, 0, "novidades", null), avisos: b(30, 5, "avisos", null), aurinha: b(50, 0, "aurinha", null) }));
    expect(textos(antes)).toContain("Presente de boas-vindas: 30 avisos, 10 novidades, 50 conversas da Aurinha · não renova");
    expect(tem(antes, "wa-saldo-oferta")).toBe(false);
    const depois = medidor(raw({ plano: essencial, novidades: b(10, 0, "novidades", null), avisos: b(30, 30, "avisos", null), aurinha: b(50, 0, "aurinha", null) }));
    expect(tem(depois, "wa-saldo-oferta")).toBe(true);
    expect(textos(depois)).toContain("Cobrar pelo meu WhatsApp");
  });

  it("número em atenção pausa as novidades e diz que avisos continuam", () => {
    const t = medidor(raw({ numero: { em_atencao: true, motivo: "QUALIDADE" } }));
    expect(tem(t, "wa-saldo-numero-em-atencao")).toBe(true);
    expect(textos(t)).toContain("Avisos e cobranças continuam.");
  });

  it("sem saldo lido: trava e oferece tentar de novo", () => {
    const t = renderer.create(<MedidorSaldoCard saldo={null} carregando={false} falhou onRetry={noop} status={null} />);
    expect(tem(t, "wa-saldo-indisponivel")).toBe(true);
    expect(tem(t, "wa-saldo-tentar-de-novo")).toBe(true);
    expect(tem(t, "wa-saldo-medidor")).toBe(false);
  });

  it("trava do servidor desligada: não mostra os números como se valessem", () => {
    const t = medidor(raw({ ativo: false }));
    expect(tem(t, "wa-saldo-inativo")).toBe(true);
    expect(tem(t, "wa-saldo-medidor")).toBe(false);
    expect(textos(t)).toContain("Os limites novos ainda não estão valendo nesta loja.");
    expect(textos(t)).not.toContain("livres");
  });

  it("esgotado: botões de pacote com o aviso de que só vale depois do pagamento", async () => {
    const t = medidor(raw({ novidades: b(10, 10, "novidades"), avisos: b(100, 100, "avisos"), aurinha: b(80, 80, "aurinha") }));
    expect(textos(t)).toContain("Adicionar 100 novidades por R$ 69");
    expect(textos(t)).toContain("Adicionar 200 avisos por R$ 19");
    expect(textos(t)).toContain("Adicionar 300 conversas da Aurinha por R$ 29");
    expect(textos(t)).toContain("Só passa a valer depois do pagamento. A Aura nunca compra sozinha.");
  });

  it("comprar pede só o link: abre o pagamento e não soma nada sozinho", async () => {
    mockComprar.mockResolvedValue({ pack: { id: "p1" }, payment_url: "https://asaas.test/pay/1", needs_manual: false });
    mockListar.mockResolvedValue({ data: [{ id: "p1", bucket: "avisos", qty: 200, status: "pending", payment_url: "https://asaas.test/pay/1" }] });
    const onRetry = jest.fn();
    const t = medidor(raw({ avisos: b(100, 100, "avisos") }), { onRetry });
    await act(async () => { achar(t, "wa-saldo-pacote-avisos").props.onPress(); });
    expect(mockComprar).toHaveBeenCalledWith("c", "avisos");
    expect(mockAbrir).toHaveBeenCalledWith("https://asaas.test/pay/1");
    expect(onRetry).not.toHaveBeenCalled(); // o saldo só é relido quando ela diz que pagou
    expect(tem(t, "wa-saldo-pacotes-pendentes")).toBe(true);
    await act(async () => { achar(t, "wa-saldo-pacote-atualizar").props.onPress(); });
    expect(onRetry).toHaveBeenCalled();
  });

  it("sem link (needs_manual): avisa que a Aura combina o pagamento", async () => {
    mockComprar.mockResolvedValue({ pack: { id: "p2" }, payment_url: null, needs_manual: true });
    const t = medidor(raw({ avisos: b(100, 100, "avisos") }));
    await act(async () => { achar(t, "wa-saldo-pacote-avisos").props.onPress(); });
    expect(tem(t, "wa-saldo-pacote-manual")).toBe(true);
  });

  it("erro da compra mostra a frase do servidor", async () => {
    mockComprar.mockRejectedValue({ status: 503, data: { code: "SCHEMA_PENDING", error: "O servidor está sendo atualizado." } });
    const t = medidor(raw({ avisos: b(100, 100, "avisos") }));
    await act(async () => { achar(t, "wa-saldo-pacote-avisos").props.onPress(); });
    expect(achar(t, "wa-saldo-pacote-erro").props.children).toBe("O servidor está sendo atualizado.");
  });
});
