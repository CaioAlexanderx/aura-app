// ============================================================
// Guardas de custo do WhatsApp no VAREJO (Fase 6j).
//
// O crediário precisa de DOIS templates aprovados (parcela_lembrete e
// parcela_atraso), não de um só como a mensalidade do dojô. Estes testes
// seguram o que não pode voltar a acontecer:
//
// 1. `templates_ready` ausente, vazio ou só com metade das chaves NÃO
//    pode liberar o envio automático — omissão é bloqueio, sempre;
// 2. a decisão continua sendo UMA (waGuards), com os rótulos trocando
//    por contexto — se o varejo tivesse a sua cópia, um ajuste no dojô
//    deixaria o varejo para trás em silêncio;
// 3. os motivos novos do crediário chegam em pt-BR, nunca como código.
// ============================================================
import {
  mapWaError, waAutoBlockers, waSkipReasonLabel, waTemplatesReadyFor,
} from "@/components/whatsapp/waGuards";
import { waAutoBlockers as waAutoBlockersDojo } from "@/components/karate/dojoWhatsapp/helpers";
import { WA_CREDIARIO_TEMPLATES } from "@/services/waApi";

const BASE: any = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  paused_reason: null,
  usage: { today_sent: 1, month_sent: 10, daily_cap: 300 },
};

const CREDIARIO = { templateKeys: WA_CREDIARIO_TEMPLATES };

describe("waAutoBlockers no crediário — os dois templates", () => {
  it("libera só com os dois templates aprovados", () => {
    const ok = { ...BASE, templates_ready: { parcela_lembrete: true, parcela_atraso: true } };
    expect(waAutoBlockers(ok as any, CREDIARIO)).toEqual([]);
  });

  it("metade aprovada ainda bloqueia", () => {
    const meio = { ...BASE, templates_ready: { parcela_lembrete: true } };
    expect(waAutoBlockers(meio as any, CREDIARIO).map((b) => b.code)).toEqual(["TEMPLATE"]);
  });

  it("templates_ready ausente bloqueia mesmo com template_ready legado true", () => {
    // Backend anterior à Fase 6 responde template_ready (mensalidade) e
    // nada sobre as parcelas. Aproveitar o campo legado seria liberar
    // envio pago com template que a Meta nem viu.
    expect(waAutoBlockers(BASE as any, CREDIARIO).map((b) => b.code)).toEqual(["TEMPLATE"]);
  });

  it("chave explicitamente false bloqueia", () => {
    const recusado = { ...BASE, templates_ready: { parcela_lembrete: true, parcela_atraso: false } };
    expect(waAutoBlockers(recusado as any, CREDIARIO).map((b) => b.code)).toEqual(["TEMPLATE"]);
  });

  it("waTemplatesReadyFor só devolve true com todas as chaves", () => {
    expect(waTemplatesReadyFor({ ...BASE, templates_ready: { parcela_lembrete: true, parcela_atraso: true } } as any, WA_CREDIARIO_TEMPLATES)).toBe(true);
    expect(waTemplatesReadyFor({ ...BASE, templates_ready: { parcela_lembrete: true } } as any, WA_CREDIARIO_TEMPLATES)).toBe(false);
    expect(waTemplatesReadyFor(null, WA_CREDIARIO_TEMPLATES)).toBe(false);
    expect(waTemplatesReadyFor(BASE as any, [])).toBe(false);
  });
});

describe("waAutoBlockers no crediário — as outras guardas continuam valendo", () => {
  const PRONTO = { ...BASE, templates_ready: { parcela_lembrete: true, parcela_atraso: true } };

  it("sem plano nem addon bloqueia com o texto comercial do varejo", () => {
    const b = waAutoBlockers({ ...PRONTO, addon_active: false } as any, {
      ...CREDIARIO,
      labels: { ADDON: "O envio automático por WhatsApp não está no seu plano. Fale com a Aura para ativar." },
    });
    expect(b.map((x) => x.code)).toEqual(["ADDON"]);
    expect(b[0].label).toMatch(/não está no seu plano/);
  });

  it("addon_active ausente bloqueia igual a false", () => {
    const semCampo = { ...PRONTO };
    delete semCampo.addon_active;
    expect(waAutoBlockers(semCampo as any, CREDIARIO).map((x) => x.code)).toContain("ADDON");
  });

  it("sem conexão, com token vencido e com a fila pausada", () => {
    expect(waAutoBlockers({ ...PRONTO, connected: false } as any, CREDIARIO).map((x) => x.code)).toContain("CONEXAO");
    const expirado = waAutoBlockers({ ...PRONTO, connected: false, token_expired: true } as any, CREDIARIO);
    expect(expirado.map((x) => x.code)).toContain("TOKEN");
    expect(expirado.map((x) => x.code)).not.toContain("CONEXAO");
    const pausado = waAutoBlockers({ ...PRONTO, paused_reason: "QUALIDADE_BAIXA" } as any, CREDIARIO);
    expect(pausado.map((x) => x.code)).toEqual(["PAUSADO"]);
    expect(pausado[0].label).toMatch(/qualidade do número/);
  });

  it("status nulo (falha ao carregar) bloqueia — o lado certo do erro", () => {
    expect(waAutoBlockers(null, CREDIARIO).map((x) => x.code)).toEqual(["SEM_STATUS"]);
  });
});

describe("a decisão é uma só — dojô e varejo leem do mesmo lugar", () => {
  it("sem templateKeys o comportamento do dojô não muda", () => {
    // Mesmo status, duas perguntas diferentes: o dojô olha template_ready
    // (mensalidade) e passa; o crediário olha os dois presets e barra.
    expect(waAutoBlockersDojo(BASE as any)).toEqual([]);
    expect(waAutoBlockers(BASE as any, CREDIARIO).map((b) => b.code)).toEqual(["TEMPLATE"]);
  });

  it("o dojô mantém os rótulos dele", () => {
    const b = waAutoBlockersDojo({ ...BASE, connected: false } as any);
    expect(b.find((x) => x.code === "CONEXAO")?.label).toMatch(/número do dojô/);
  });
});

describe("motivos do crediário → pt-BR", () => {
  it("traduz os skip_reason da régua de parcelas", () => {
    expect(waSkipReasonLabel("REGUA_DESLIGADA")).toMatch(/régua de cobrança do crediário/i);
    expect(waSkipReasonLabel("WHATSAPP_AUTO_DESLIGADO")).toMatch(/desligado/i);
    expect(waSkipReasonLabel("SEM_SALDO")).toMatch(/quitada/i);
    expect(waSkipReasonLabel("JA_NA_FILA")).toMatch(/já foi enfileirada/i);
    expect(waSkipReasonLabel("TEMPLATE_NAO_MAPEADO")).toMatch(/template de WhatsApp/i);
  });

  it("motivo desconhecido do backend vira texto legível, nunca o código", () => {
    expect(waSkipReasonLabel("MOTIVO_QUE_AINDA_NAO_EXISTE")).toBe("Motivo que ainda nao existe");
  });

  it("os erros do PUT collection/rules chegam em pt-BR", () => {
    expect(mapWaError({ status: 403, data: { code: "ADDON_REQUIRED" } }).message).not.toMatch(/ADDON_REQUIRED/);
    expect(mapWaError({ status: 409, data: { code: "NAO_CONECTADO" } }).message).toMatch(/não está conectado/i);
    expect(
      mapWaError({ status: 409, data: { code: "TEMPLATE_NAO_APROVADO", error: "Os templates de cobrança ainda não foram aprovados pela Meta." } }).message
    ).toBe("Os templates de cobrança ainda não foram aprovados pela Meta.");
  });
});
