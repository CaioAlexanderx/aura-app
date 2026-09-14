// ============================================================
// Guardas de MARKETING (Fases 7/8).
//
// A mensagem de cobrança e a de marketing não custam o mesmo, não têm o
// mesmo limite e não dependem das mesmas autorizações. O risco aqui não
// é a tela ficar feia: é sair cupom pago para quem nunca autorizou, ou
// sair em cima de um número que a Meta já rebaixou.
//
// O que estes testes seguram:
//
// 1. consentimento AUSENTE bloqueia — e ausente é o estado de qualquer
//    backend anterior à Fase 7. Omissão não pode virar permissão;
// 2. YELLOW barra marketing e NÃO barra cobrança — são categorias
//    diferentes na Meta, e tratá-las igual desligaria a cobrança de quem
//    só tinha a qualidade em atenção;
// 3. sem `requireConsent`, o dojô e o crediário respondem exatamente como
//    antes (nenhuma tela de cobrança herda guarda de marketing);
// 4. os skip_reason novos chegam em português, nunca como código.
// ============================================================
import {
  mapWaError, waAutoBlockers, waMarketingBlockers, waMarketingConsentOk,
  waMarketingCostLabel, waMarketingQualityOk, waSkipReasonLabel,
} from "@/components/whatsapp/waGuards";
import { WA_ANIVERSARIO_TEMPLATES, WA_CREDIARIO_TEMPLATES } from "@/services/waApi";

/** Tudo o que a COBRANÇA exige, e nada do que o marketing exige a mais. */
const BASE: any = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  templates_ready: {
    parcela_lembrete: true, parcela_atraso: true,
    aniversario_cupom: true, reativacao_cupom: true,
  },
  paused_reason: null,
  usage: { today_sent: 1, month_sent: 10, daily_cap: 300 },
};

const PRONTO: any = {
  ...BASE,
  marketing_consent_at: "2026-09-14T10:00:00.000Z",
  marketing_ready: true,
  quality_rating: "GREEN",
};

const ANIVERSARIO = { templateKeys: WA_ANIVERSARIO_TEMPLATES };

describe("consentimento de marketing", () => {
  it("com tudo declarado e aprovado, libera", () => {
    expect(waMarketingBlockers(PRONTO, ANIVERSARIO)).toEqual([]);
  });

  it("sem consentimento declarado, bloqueia com o caminho para resolver", () => {
    const semConsent = { ...PRONTO, marketing_consent_at: null, marketing_ready: false };
    const b = waMarketingBlockers(semConsent, ANIVERSARIO);
    expect(b.map((x) => x.code)).toEqual(["CONSENTIMENTO"]);
    expect(b[0].label).toMatch(/aba WhatsApp|autorizaram/i);
  });

  it("backend anterior à Fase 7 (campo ausente) bloqueia igual a null", () => {
    const antigo = { ...PRONTO };
    delete antigo.marketing_consent_at;
    delete antigo.marketing_ready;
    expect(waMarketingBlockers(antigo, ANIVERSARIO).map((x) => x.code)).toEqual(["CONSENTIMENTO"]);
    expect(waMarketingConsentOk(antigo)).toBe(false);
  });

  it("string vazia não vale como declaração", () => {
    expect(waMarketingConsentOk({ ...PRONTO, marketing_consent_at: "   " } as any)).toBe(false);
  });
});

describe("qualidade do número: YELLOW barra marketing, não barra cobrança", () => {
  const amarelo = { ...PRONTO, quality_rating: "YELLOW", marketing_ready: false };

  it("marketing para", () => {
    const b = waMarketingBlockers(amarelo, ANIVERSARIO);
    expect(b.map((x) => x.code)).toEqual(["QUALIDADE_MARKETING"]);
    expect(b[0].label).toMatch(/cobrança continua/i);
  });

  it("a cobrança do crediário segue liberada no MESMO status", () => {
    expect(waAutoBlockers(amarelo, { templateKeys: WA_CREDIARIO_TEMPLATES })).toEqual([]);
  });

  it("sem `marketing_ready`, a leitura local do quality_rating decide", () => {
    const semResumo = { ...PRONTO, quality_rating: "YELLOW" };
    delete semResumo.marketing_ready;
    expect(waMarketingQualityOk(semResumo)).toBe(false);
    expect(waMarketingBlockers(semResumo, ANIVERSARIO).map((x) => x.code)).toEqual(["QUALIDADE_MARKETING"]);
  });

  it("fila pausada também para o marketing (e já parava a cobrança)", () => {
    const pausado = { ...PRONTO, paused_reason: "CONTA_RESTRITA", marketing_ready: false };
    expect(waMarketingBlockers(pausado, ANIVERSARIO).map((x) => x.code)).toContain("PAUSADO");
  });
});

describe("as guardas de sempre continuam valendo no marketing", () => {
  it("template de marketing não aprovado bloqueia", () => {
    const semTpl = { ...PRONTO, templates_ready: { parcela_lembrete: true, parcela_atraso: true } };
    expect(waMarketingBlockers(semTpl, ANIVERSARIO).map((x) => x.code)).toEqual(["TEMPLATE"]);
  });

  it("sem plano/addon e sem conexão bloqueiam antes do consentimento", () => {
    expect(waMarketingBlockers({ ...PRONTO, addon_active: false }, ANIVERSARIO).map((x) => x.code)).toContain("ADDON");
    expect(waMarketingBlockers({ ...PRONTO, connected: false }, ANIVERSARIO).map((x) => x.code)).toContain("CONEXAO");
  });

  it("status nulo bloqueia tudo — o lado certo do erro", () => {
    expect(waMarketingBlockers(null, ANIVERSARIO).map((x) => x.code)).toEqual(["SEM_STATUS"]);
  });
});

describe("sem requireConsent, a cobrança não herda nada", () => {
  it("o crediário no mesmo status SEM consentimento continua liberado", () => {
    const semConsent = { ...BASE };
    expect(waAutoBlockers(semConsent, { templateKeys: WA_CREDIARIO_TEMPLATES })).toEqual([]);
    // E o marketing, no mesmíssimo status, barra.
    expect(waMarketingBlockers(semConsent, ANIVERSARIO).map((x) => x.code)).toEqual(["CONSENTIMENTO"]);
  });

  it("o dojô (sem templateKeys) também não muda", () => {
    expect(waAutoBlockers(BASE)).toEqual([]);
  });
});

describe("motivos novos → pt-BR", () => {
  it("os quatro skip_reason de marketing", () => {
    expect(waSkipReasonLabel("FREQUENCIA_MARKETING")).toMatch(/últimos 7 dias/i);
    expect(waSkipReasonLabel("QUALIDADE_MARKETING")).toMatch(/marketing pausado/i);
    // Fase 8b: o mesmo código passou a cobrir a COTA do mês, e a frase
    // mudou junto — dizer "diário" aqui mandaria o lojista esperar amanhã
    // por algo que só volta no mês que vem.
    expect(waSkipReasonLabel("LIMITE_MARKETING")).toMatch(/cota de mensagens promocionais/i);
    expect(waSkipReasonLabel("SEM_CONSENTIMENTO")).toMatch(/consentimento de marketing/i);
    expect(waSkipReasonLabel("OPT_OUT_MARKETING")).toMatch(/não receber/i);
  });

  it("nenhum deles vaza o código cru", () => {
    for (const code of ["FREQUENCIA_MARKETING", "QUALIDADE_MARKETING", "LIMITE_MARKETING", "SEM_CONSENTIMENTO"]) {
      expect(waSkipReasonLabel(code)).not.toContain(code);
    }
  });

  it("o 409 SEM_CONSENTIMENTO do backend vira frase, não código", () => {
    const m = mapWaError({ status: 409, data: { code: "SEM_CONSENTIMENTO" } });
    expect(m.message).not.toMatch(/SEM_CONSENTIMENTO/);
    expect(m.message).toMatch(/autorizaram/i);
  });
});

describe("o custo aparece na frase, não no rodapé", () => {
  it("singular e plural dizem 'paga(s)'", () => {
    expect(waMarketingCostLabel(1)).toBe("1 mensagem de marketing paga");
    expect(waMarketingCostLabel(12)).toBe("12 mensagens de marketing pagas");
    expect(waMarketingCostLabel(0)).toBe("0 mensagens de marketing pagas");
  });
});
