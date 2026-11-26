// ============================================================
// Medidor do topo da aba Configurações do WhatsApp (26/11/2026).
//
// Segura: a leitura do saldo (pura), os textos de "Faltam N" e de
// esgotado, o presente do Essencial, a oferta de R$ 29 só quando o
// presente acaba, o número em atenção e o bloqueio por dúvida.
// ============================================================
import React from "react";
import renderer from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { MedidorSaldoCard } from "@/components/whatsapp/MedidorSaldoCard";
import { waNumeroEmAtencao, waSaldoInfo } from "@/components/whatsapp/waSaldo";

const NOV = new Date(2026, 10, 26);
const b = (total: number, usado: number) => ({ total, usado, restante: total - usado });

function raw(over: any = {}) {
  return {
    mes_ref: "2026-11",
    presente_boas_vindas: false,
    novidades: b(10, 0),
    avisos: b(100, 28),
    aurinha: b(80, 23),
    ...over,
  };
}

function textos(tree: any): string {
  return JSON.stringify(tree.toJSON());
}
function tem(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

describe("waSaldoInfo", () => {
  it("lê os três saldos com restante de total", () => {
    const i = waSaldoInfo(raw(), NOV)!;
    expect(i.avisos.livres).toBe("72 de 100 livres");
    expect(i.aurinha.livres).toBe("57 de 80 livres");
    expect(i.novidades.livres).toBe("10 de 10 livres");
    expect(i.mesNome).toBe("novembro");
  });

  it("'Faltam N' só quando restam 20% ou menos (e ainda sobra)", () => {
    expect(waSaldoInfo(raw({ avisos: b(100, 80) }), NOV)!.avisos.faltam).toBe("Faltam 20");
    expect(waSaldoInfo(raw({ avisos: b(100, 79) }), NOV)!.avisos.faltam).toBeNull();
    expect(waSaldoInfo(raw({ avisos: b(100, 100) }), NOV)!.avisos.faltam).toBeNull();
  });

  it("textos de esgotado", () => {
    const i = waSaldoInfo(raw({ novidades: b(10, 10), avisos: b(100, 100), aurinha: b(80, 80), mes_ref: "2026-12" }), NOV)!;
    expect(i.novidades.textoEsgotado).toBe("As 10 novidades de dezembro acabaram. Voltam em 1º de janeiro.");
    expect(i.avisos.textoEsgotado).toBe("Os 100 avisos de dezembro acabaram.");
    expect(i.aurinha.textoEsgotado).toBe("A Aurinha atendeu as 80 conversas do mês. As novas ficam com você.");
  });

  it("dúvida bloqueia: balde ausente, negativo ou torto derruba tudo", () => {
    expect(waSaldoInfo(null)).toBeNull();
    expect(waSaldoInfo(raw({ aurinha: undefined }))).toBeNull();
    expect(waSaldoInfo(raw({ avisos: { total: -1, restante: 3 } }))).toBeNull();
    expect(waSaldoInfo(raw({ avisos: { total: 100 } }))).toBeNull();
    expect(waSaldoInfo(raw({ avisos: { total: "100", usado: 1 } as any }))).toBeNull();
  });

  it("restante nunca passa do total", () => {
    expect(waSaldoInfo(raw({ avisos: { total: 100, restante: 150 } }), NOV)!.avisos.restante).toBe(100);
  });

  it("oferta dos R$ 29 só no presente do Essencial com os avisos acabados", () => {
    expect(waSaldoInfo(raw({ presente_boas_vindas: true }), NOV)!.mostrarOferta).toBe(false);
    expect(waSaldoInfo(raw({ presente_boas_vindas: true, avisos: b(30, 30) }), NOV)!.mostrarOferta).toBe(true);
    // Negócio nunca vê a oferta, mesmo sem avisos.
    expect(waSaldoInfo(raw({ avisos: b(100, 100) }), NOV)!.mostrarOferta).toBe(false);
  });
});

describe("waNumeroEmAtencao", () => {
  it("amarelo, vermelho ou pausa por qualidade", () => {
    expect(waNumeroEmAtencao({ quality_rating: "YELLOW" } as any)).toBe(true);
    expect(waNumeroEmAtencao({ quality_rating: "RED" } as any)).toBe(true);
    expect(waNumeroEmAtencao({ paused_reason: "QUALIDADE_BAIXA" } as any)).toBe(true);
    expect(waNumeroEmAtencao({ quality_rating: "GREEN" } as any)).toBe(false);
    expect(waNumeroEmAtencao({ paused_reason: "MANUAL" } as any)).toBe(false);
    expect(waNumeroEmAtencao(null)).toBe(false);
  });
});

describe("MedidorSaldoCard", () => {
  const noop = () => {};

  it("mostra os três saldos", () => {
    const t = renderer.create(<MedidorSaldoCard saldo={waSaldoInfo(raw(), NOV)} carregando={false} falhou={false} status={null} onRetry={noop} />);
    expect(tem(t, "wa-saldo-medidor")).toBe(true);
    expect(textos(t)).toContain("72 de 100 livres");
    expect(textos(t)).toContain("57 de 80 livres");
    expect(tem(t, "wa-saldo-avisos-faltam")).toBe(false);
  });

  it("Faltam N aparece com 20% ou menos", () => {
    const t = renderer.create(<MedidorSaldoCard saldo={waSaldoInfo(raw({ avisos: b(100, 82) }), NOV)} carregando={false} falhou={false} status={null} onRetry={noop} />);
    expect(textos(t)).toContain("Faltam 18");
  });

  it("Essencial: presente não renova; oferta só quando acaba", () => {
    const antes = renderer.create(
      <MedidorSaldoCard saldo={waSaldoInfo(raw({ presente_boas_vindas: true, novidades: b(10, 0), avisos: b(30, 5), aurinha: b(50, 0) }), NOV)} carregando={false} falhou={false} status={null} onRetry={noop} />
    );
    expect(textos(antes)).toContain("Presente de boas-vindas: 30 avisos, 10 novidades, 50 conversas da Aurinha · não renova");
    expect(tem(antes, "wa-saldo-oferta")).toBe(false);

    const depois = renderer.create(
      <MedidorSaldoCard saldo={waSaldoInfo(raw({ presente_boas_vindas: true, novidades: b(10, 0), avisos: b(30, 30), aurinha: b(50, 0) }), NOV)} carregando={false} falhou={false} status={null} onRetry={noop} />
    );
    expect(tem(depois, "wa-saldo-oferta")).toBe(true);
    expect(textos(depois)).toContain("Cobrar pelo meu WhatsApp");
  });

  it("número em atenção pausa as novidades e diz que avisos continuam", () => {
    const t = renderer.create(<MedidorSaldoCard saldo={waSaldoInfo(raw(), NOV)} carregando={false} falhou={false} status={{ quality_rating: "YELLOW" } as any} onRetry={noop} />);
    expect(tem(t, "wa-saldo-numero-em-atencao")).toBe(true);
    expect(textos(t)).toContain("Avisos e cobranças continuam.");
  });

  it("sem saldo lido: trava e oferece tentar de novo", () => {
    const t = renderer.create(<MedidorSaldoCard saldo={null} carregando={false} falhou onRetry={noop} status={null} />);
    expect(tem(t, "wa-saldo-indisponivel")).toBe(true);
    expect(tem(t, "wa-saldo-tentar-de-novo")).toBe(true);
    expect(tem(t, "wa-saldo-medidor")).toBe(false);
  });
});
