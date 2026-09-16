// ============================================================
// A régua única de "dias sem comprar" (Fase 0, I0.2).
//
// O app media a mesma coisa de dois jeitos: a tag "Inativo" da lista
// acendia com MAIS DE 30 dias, o motor de reativação só chamava de
// inativo quem tinha 61 a 120. O lojista via "Inativo" na lista, abria a
// reativação e não achava a pessoa.
//
// O que estes testes seguram:
//
// 1. as fronteiras exatas das quatro faixas (30/31, 60/61, 120/121) —
//    é ali que uma régua nova volta a divergir da outra;
// 2. quem nunca comprou ("---") não cai em faixa nenhuma: ausência de
//    data não é sinônimo de abandono;
// 3. a tag "Inativo" da lista agora é a MESMA fronteira do motor (61+),
//    e "Novo" não sai junto com ela;
// 4. o corte escolhido na entrada vira um alvo enviável — e nunca
//    "lost", que não é alvo de disparo em lugar nenhum.
// ============================================================
import {
  LIMIARES, FAIXAS, faixaInfo, descricaoDoSegmento, parseDataBR, diasSemComprar,
  classificarDias, faixaDoCliente, estaInativo, alvoParaDias, CORTES_DIAS, CORTE_PADRAO,
} from "@/components/screens/clientes/diasSemComprar";
import { getStatus } from "@/components/screens/clientes/types";

// Relógio fixo: 16/09/2026, meio-dia. Sem isto o teste passa ou falha
// conforme a hora em que roda.
const AGORA = new Date(2026, 8, 16, 12, 0, 0).getTime();

/** Data "dd/mm/aaaa" de N dias atrás, do jeito que o app guarda. */
function haDias(n: number): string {
  const d = new Date(AGORA - n * 864e5);
  return d.toLocaleDateString("pt-BR");
}

describe("classificação por dias sem comprar", () => {
  it("as fronteiras das quatro faixas são as da régua", () => {
    expect(classificarDias(0)).toBe("ativo");
    expect(classificarDias(30)).toBe("ativo");
    expect(classificarDias(31)).toBe("em_risco");
    expect(classificarDias(60)).toBe("em_risco");
    expect(classificarDias(61)).toBe("inativo");
    expect(classificarDias(120)).toBe("inativo");
    expect(classificarDias(121)).toBe("perdido");
    expect(classificarDias(900)).toBe("perdido");
  });

  it("sem número de dias não há faixa", () => {
    expect(classificarDias(null)).toBeNull();
    expect(classificarDias(undefined)).toBeNull();
    expect(classificarDias(NaN)).toBeNull();
  });

  it("as faixas cobrem a reta sem buraco e sem sobreposição", () => {
    expect(FAIXAS[0].min).toBe(0);
    for (let i = 1; i < FAIXAS.length; i++) {
      expect(FAIXAS[i].min).toBe((FAIXAS[i - 1].max as number) + 1);
    }
    expect(FAIXAS[FAIXAS.length - 1].max).toBeNull();
  });

  it("cada faixa tem o nome que o backend de reativação usa", () => {
    expect(faixaInfo("em_risco").segmento).toBe("at_risk");
    expect(faixaInfo("inativo").segmento).toBe("dormant");
    expect(faixaInfo("perdido").segmento).toBe("lost");
    expect(descricaoDoSegmento("at_risk")).toBe("sem comprar há 31 a 60 dias");
    expect(descricaoDoSegmento("dormant")).toBe("sem comprar há 61 a 120 dias");
    expect(descricaoDoSegmento("nada")).toBe("");
  });

  it("os limiares publicados são 31 / 61 / 121", () => {
    expect(LIMIARES.emRisco).toBe(31);
    expect(LIMIARES.inativo).toBe(61);
    expect(LIMIARES.perdido).toBe(121);
    expect(CORTES_DIAS).toEqual([30, 60, 90, 120, 180]);
    expect(CORTE_PADRAO).toBe(60);
  });
});

describe("leitura da data que a lista guarda", () => {
  it("lê dd/mm/aaaa e conta os dias", () => {
    expect(diasSemComprar(haDias(0), AGORA)).toBe(0);
    expect(diasSemComprar(haDias(45), AGORA)).toBe(45);
    expect(diasSemComprar(haDias(200), AGORA)).toBe(200);
  });

  it("quem nunca comprou não entra em faixa nenhuma", () => {
    expect(diasSemComprar("---", AGORA)).toBeNull();
    expect(diasSemComprar("", AGORA)).toBeNull();
    expect(diasSemComprar(null, AGORA)).toBeNull();
    expect(diasSemComprar(undefined, AGORA)).toBeNull();
    expect(faixaDoCliente({ lastPurchase: "---" }, AGORA)).toBeNull();
  });

  it("recusa data impossível em vez de deslizar para o mês seguinte", () => {
    // new Date(2026, 1, 31) vira 03/03 — aceitar isso seria inventar compra.
    expect(parseDataBR("31/02/2026")).toBeNull();
    expect(parseDataBR("00/01/2026")).toBeNull();
    expect(parseDataBR("15/13/2026")).toBeNull();
    expect(parseDataBR("15/09")).toBeNull();
    expect(parseDataBR("ontem")).toBeNull();
  });

  it("data no futuro conta como zero, não como negativo", () => {
    const amanha = new Date(AGORA + 5 * 864e5).toLocaleDateString("pt-BR");
    expect(diasSemComprar(amanha, AGORA)).toBe(0);
  });

  it("faixaDoCliente usa a mesma régua", () => {
    expect(faixaDoCliente({ lastPurchase: haDias(10) }, AGORA)).toBe("ativo");
    expect(faixaDoCliente({ lastPurchase: haDias(45) }, AGORA)).toBe("em_risco");
    expect(faixaDoCliente({ lastPurchase: haDias(90) }, AGORA)).toBe("inativo");
    expect(faixaDoCliente({ lastPurchase: haDias(400) }, AGORA)).toBe("perdido");
  });
});

describe("a tag única da lista segue a régua (Fase 1, C1.2)", () => {
  // 16/09/2026 — getStatus passou a devolver UMA tag só (era um array de
  // até duas), delegando pra classificarCliente (./segmentos.ts). O
  // rótulo visível de "61 a 120 dias" também trocou: era "Inativo", agora
  // é "Sumido" — a chave interna da régua única (estaInativo,
  // FAIXAS[...].key === "inativo") não mudou.
  it("estaInativo é 61 dias ou mais, perdidos incluídos", () => {
    expect(estaInativo(60)).toBe(false);
    expect(estaInativo(61)).toBe(true);
    expect(estaInativo(365)).toBe(true);
    expect(estaInativo(null)).toBe(false);
  });

  it("45 dias parado NÃO é 'Sumido' — cai em 'Em risco' (31–60 da régua)", () => {
    const tag = getStatus({ visits: 6, totalSpent: 500, lastPurchase: haDias(45), firstVisit: haDias(400) });
    expect(tag).not.toBe("Sumido");
    expect(tag).toBe("Em risco");
  });

  it("90 dias parado é 'Sumido' — o mesmo que a reativação chama de inativo (rótulo mudou, régua não)", () => {
    const tag = getStatus({ visits: 6, totalSpent: 500, lastPurchase: haDias(90), firstVisit: haDias(400) });
    expect(tag).toBe("Sumido");
  });

  it("'Novo' e 'Sumido' nunca aparecem juntos: quem sumiu prevalece (é a tag única, sempre um dos dois)", () => {
    const sumido = getStatus({ visits: 2, totalSpent: 300, lastPurchase: haDias(200), firstVisit: haDias(400) });
    expect(sumido).toBe("Perdido"); // 200 dias já é "perdido" (121+), não mais "sumido"
    expect(sumido).not.toBe("Novo");

    const recente = getStatus({ visits: 2, totalSpent: 300, lastPurchase: haDias(5), firstVisit: haDias(5) });
    expect(recente).toBe("Novo");
    expect(recente).not.toBe("Sumido");
  });

  it("Devendo vence as outras tags — prioridade 1 (saldo em aberto)", () => {
    const tag = getStatus({ visits: 12, totalSpent: 3000, lastPurchase: haDias(2), firstVisit: haDias(400), creditBalance: 50 });
    expect(tag).toBe("Devendo");
  });

  it("VIP é relativo à base — sem contexto (chamada avulsa) ninguém vira VIP, mesmo gastando muito", () => {
    const tag = getStatus({ visits: 12, totalSpent: 3000, lastPurchase: haDias(2), firstVisit: haDias(400) });
    expect(tag).not.toBe("VIP");
    // 12 compras e ativo (2 dias) — sem ser VIP, vira Recorrente.
    expect(tag).toBe("Recorrente");
  });

  it("quem nunca comprou e foi cadastrado recentemente ganha 'Novo', não 'Sumido'", () => {
    const tag = getStatus({ visits: 0, totalSpent: 0, lastPurchase: "---", firstVisit: haDias(5) });
    expect(tag).not.toBe("Sumido");
    expect(tag).toBe("Novo");
  });
});

describe("corte de dias da entrada -> alvo enviável", () => {
  it("até 60 dias o alvo é 'os dois': o corte aberto pega em risco e inativo", () => {
    expect(alvoParaDias(30)).toBe("both");
    expect(alvoParaDias(60)).toBe("both");
  });

  it("de 61 em diante não há mais ninguém 'em risco' no corte", () => {
    expect(alvoParaDias(61)).toBe("dormant");
    expect(alvoParaDias(90)).toBe("dormant");
    expect(alvoParaDias(120)).toBe("dormant");
  });

  it("perdidos não são alvo de disparo — 180 também cai em 'dormant'", () => {
    expect(alvoParaDias(180)).toBe("dormant");
    expect(alvoParaDias(999)).toBe("dormant");
  });

  it("sem corte, o alvo é o default da tela", () => {
    expect(alvoParaDias(null)).toBe("at_risk");
    expect(alvoParaDias(undefined)).toBe("at_risk");
  });
});
