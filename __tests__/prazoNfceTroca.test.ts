// ============================================================
// Troca e prazo de cancelamento da NFC-e (17/11/2026, b-troca-prazo-nfce)
//
// Antes o Step 4 dizia "cancela e reemite" para venda de menos de 24 h,
// mas a SEFAZ só aceita cancelar a NFC-e até 30 min depois da autorização
// (SP, AP, RJ e MG). Agora o card mostra o que o servidor vai fazer
// (sale.nfce_troca_estrategia, prazo por UF). Sem o campo (backend antigo),
// mostra a devolução — nunca promete um cancelamento.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { inferFiscalStrategy } from "@/components/screens/pdv/troca/Step4Confirm";
import { estrategiaDaVenda, minutosDoPrazoDaTroca, prazoDaNota, PRAZO_NFCE_MIN } from "@/utils/prazoNfce";
import { TEXTOS_PRAZO_NFCE, duracaoDoPrazo } from "@/constants/textosPrazoNfce";

const AGORA = Date.parse("2026-11-17T15:00:00Z");
const minAtras = (m: number) => new Date(AGORA - m * 60000).toISOString();

// Prévia que o backend devolve para cada idade (gateway, UF de 30 min).
function venda(id: string, minutos: number, extra: any = {}) {
  return {
    id, created_at: minAtras(minutos), has_nfce: true,
    nfce_authorized_at: minAtras(minutos),
    nfce_prazo_minutos: 30,
    nfce_troca_estrategia: minutos <= 30 ? "cancel_reissue" : "devolucao_55",
    items: [], ...extra,
  } as any;
}
const devolve = (id: string) => [{ saleId: id }] as any;

describe("inferFiscalStrategy: troca com 10 min, 2 h e 30 h", () => {
  test("10 min: cancela a NFC-e", () => {
    expect(inferFiscalStrategy([venda("a", 10)], devolve("a")).strategy).toBe("cancel_reissue");
  });
  test("2 h: NF-e de devolução (antes dizia que cancelava)", () => {
    expect(inferFiscalStrategy([venda("a", 120)], devolve("a")).strategy).toBe("devolucao_55");
  });
  test("30 h: NF-e de devolução", () => {
    expect(inferFiscalStrategy([venda("a", 30 * 60)], devolve("a")).strategy).toBe("devolucao_55");
  });
  test("misto: 10 min + 2 h = por origem", () => {
    const r = inferFiscalStrategy([venda("a", 10), venda("b", 120)], [{ saleId: "a" }, { saleId: "b" }] as any);
    expect(r).toEqual({ strategy: "per_origin", cancelReissueCount: 1, devolucao55Count: 1 });
  });
  test("backend antigo (sem prévia), venda de 10 min: mostra a devolução, não promete cancelar", () => {
    const v = venda("a", 10);
    delete v.nfce_troca_estrategia;
    expect(inferFiscalStrategy([v], devolve("a")).strategy).toBe("devolucao_55");
  });
  test("sem NFC-e: sem fiscal", () => {
    expect(inferFiscalStrategy([venda("a", 10, { has_nfce: false })], devolve("a")).strategy).toBe("none");
  });
});

describe("estrategiaDaVenda e o prazo mostrado", () => {
  test("respeita a prévia; none e ausente", () => {
    expect(estrategiaDaVenda({ has_nfce: true, nfce_troca_estrategia: "cancel_reissue" })).toBe("cancel_reissue");
    expect(estrategiaDaVenda({ has_nfce: true, nfce_troca_estrategia: "none" })).toBe("none");
    expect(estrategiaDaVenda({ has_nfce: true })).toBe("devolucao_55");
    expect(estrategiaDaVenda({ has_nfce: false, nfce_troca_estrategia: "cancel_reissue" })).toBe("none");
  });
  test("minutos do prazo: o do backend, senão 30", () => {
    expect(minutosDoPrazoDaTroca([{ nfce_prazo_minutos: 20 }])).toBe(20);
    expect(minutosDoPrazoDaTroca([{}])).toBe(PRAZO_NFCE_MIN);
  });
  test("texto do card não fala mais em 24 h", () => {
    expect(TEXTOS_PRAZO_NFCE.trocaCancelaSub(30)).toContain("30 minutos");
    expect(TEXTOS_PRAZO_NFCE.trocaCancelaSub(30)).not.toMatch(/24/);
    expect(duracaoDoPrazo(1440)).toBe("24 horas");
  });
});

describe("prazoDaNota (cancelar venda)", () => {
  test("usa o cancelamento do backend e reconfere pelo relógio", () => {
    const n = { id: "n", tipo: "nfce", status: "autorizada", numero: 9, authorized_at: minAtras(10),
      cancelamento: { uf: "MG", prazo_minutos: 30, ate: new Date(AGORA + 20 * 60000).toISOString(), dentro: true } };
    expect(prazoDaNota(n, AGORA)).toMatchObject({ rotulo: "NFC-e", minutos: 30, dentro: true });
    expect(prazoDaNota(n, AGORA + 21 * 60000).dentro).toBe(false);
  });
  test("backend antigo: 30 min da NFC-e a partir de authorized_at", () => {
    const n = (m: number) => ({ id: "n", tipo: "nfce", status: "autorizada", numero: 9, authorized_at: minAtras(m) });
    expect(prazoDaNota(n(10), AGORA).dentro).toBe(true);
    expect(prazoDaNota(n(120), AGORA).dentro).toBe(false);
  });
  test("NF-e de venda: 24 h", () => {
    const n = { id: "n", tipo: "nfe", status: "autorizada", numero: 9, authorized_at: minAtras(120) };
    expect(prazoDaNota(n, AGORA)).toMatchObject({ rotulo: "NF-e", minutos: 1440, dentro: true });
  });
});
