// ============================================================
// A COTA mensal de mensagens promocionais (Fase 8b).
//
// O WhatsApp oficial passou a vir no plano (Negócio e Aura Dojô): a
// cobrança é inclusa e o marketing tem 100 mensagens por mês. Isso muda
// o desenho de um jeito perigoso em duas pontas opostas:
//
// 1. a cota pode PARAR o marketing — e não pode, em hipótese alguma,
//    parar junto a cobrança. Uma loja sem promoção é uma loja sem
//    promoção; uma loja sem cobrança é uma loja que não recebe;
// 2. este app sobe ANTES do backend da fase. Enquanto o `/status` não
//    tiver `usage.marketing`, a tela precisa se comportar exatamente como
//    ontem. Inventar "0 de 0" por omissão desligaria o marketing de todo
//    mundo no dia do deploy — o erro mais caro possível aqui.
//
// Os dois lados de cada asserção estão no arquivo: o estado que bloqueia
// E o estado vizinho que continua liberado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Linking } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

var mockPacks: any = { data: [] };
var mockBuy: any = jest.fn((_id: string, _qty: number) =>
  Promise.resolve({ pack: { id: "p1", qty: 100, status: "pending" }, payment_url: null, needs_manual: true })
);
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return {
    ...actual,
    waApi: {
      ...actual.waApi,
      listMarketingPacks: () => Promise.resolve(mockPacks),
      buyMarketingPack: (id: string, qty: number) => mockBuy(id, qty),
    },
  };
});

import {
  waAutoBlockers, waMarketingBlockers, waMarketingQuotaInfo, waPackPriceLabel,
  waSkipReasonLabel,
} from "@/components/whatsapp/waGuards";
import { WA_ANIVERSARIO_TEMPLATES, WA_CREDIARIO_TEMPLATES } from "@/services/waApi";
import { UsoCard } from "@/components/whatsapp/UsoCard";

/** Loja com tudo pronto para cobrança E para marketing. */
const PRONTO: any = {
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
  quality_rating: "GREEN",
  marketing_consent_at: "2026-09-14T10:00:00.000Z",
  marketing_ready: true,
  usage: { today_sent: 3, month_sent: 41, daily_cap: 300 },
};

function comCota(marketing: any, utility?: any): any {
  return { ...PRONTO, usage: { ...PRONTO.usage, marketing, ...(utility ? { utility } : {}) } };
}

const COTA_CHEIA = { month_sent: 12, quota_base: 100, packs_qty: 0, quota: 100, remaining: 88, pack_qty: 100, pack_price_cents: 4900 };
const COTA_QUASE = { ...COTA_CHEIA, month_sent: 82, remaining: 18 };
const COTA_ZERO = { ...COTA_CHEIA, month_sent: 100, remaining: 0 };

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function acharPorTestId(tree: any, id: string): any {
  return tree.root.findAllByProps({ testID: id })[0];
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

/** Todo o texto renderizado da árvore, numa string só. */
function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join(" ");
  const filhos = node.children || (node.props && node.props.children);
  return filhos ? textoDe(filhos) : "";
}

// ── A leitura da cota ────────────────────────────────────
describe("waMarketingQuotaInfo", () => {
  it("sem usage.marketing devolve null — backend anterior à Fase 8b", () => {
    expect(waMarketingQuotaInfo(PRONTO)).toBeNull();
    expect(waMarketingQuotaInfo(null)).toBeNull();
  });

  it("com a cota do backend, lê os números como vieram", () => {
    const q = waMarketingQuotaInfo(comCota(COTA_CHEIA))!;
    expect(q.monthSent).toBe(12);
    expect(q.quota).toBe(100);
    expect(q.remaining).toBe(88);
    expect(q.exhausted).toBe(false);
    expect(q.near).toBe(false);
  });

  it("pacote comprado soma na cota, e a sobra acompanha", () => {
    const q = waMarketingQuotaInfo(
      comCota({ month_sent: 120, quota_base: 100, packs_qty: 100, quota: 200, remaining: 80 })
    )!;
    expect(q.quota).toBe(200);
    expect(q.packsQty).toBe(100);
    expect(q.exhausted).toBe(false);
  });

  it("sem `remaining` explícito, deduz de quota - usadas (sem ficar negativo)", () => {
    const q = waMarketingQuotaInfo(comCota({ month_sent: 130, quota_base: 100, packs_qty: 0 }))!;
    expect(q.quota).toBe(100);
    expect(q.remaining).toBe(0);
    expect(q.exhausted).toBe(true);
  });

  it("80% é aviso, 100% é esgotada — e são estados diferentes", () => {
    const quase = waMarketingQuotaInfo(comCota(COTA_QUASE))!;
    expect(quase.near).toBe(true);
    expect(quase.exhausted).toBe(false);

    const zero = waMarketingQuotaInfo(comCota(COTA_ZERO))!;
    expect(zero.near).toBe(false);
    expect(zero.exhausted).toBe(true);
    expect(zero.ratio).toBe(1);
  });

  it("preço do pacote sai em reais, com o default quando o backend cala", () => {
    expect(waPackPriceLabel(4900)).toBe("R$ 49");
    expect(waPackPriceLabel(null)).toBe("R$ 49");
    expect(waPackPriceLabel(3990)).toContain("39,90");
  });
});

// ── O bloqueio ───────────────────────────────────────────
describe("bloqueio por cota", () => {
  it("cota zerada bloqueia o MARKETING", () => {
    const b = waMarketingBlockers(comCota(COTA_ZERO), { templateKeys: WA_ANIVERSARIO_TEMPLATES });
    expect(b.map((x) => x.code)).toEqual(["COTA"]);
    expect(b[0].label).toMatch(/pacote/i);
  });

  it("e NÃO bloqueia a cobrança — ela é inclusa no plano", () => {
    const b = waAutoBlockers(comCota(COTA_ZERO), { templateKeys: WA_CREDIARIO_TEMPLATES });
    expect(b).toEqual([]);
  });

  it("com sobra na cota, o marketing segue liberado", () => {
    expect(waMarketingBlockers(comCota(COTA_CHEIA), { templateKeys: WA_ANIVERSARIO_TEMPLATES })).toEqual([]);
    expect(waMarketingBlockers(comCota(COTA_QUASE), { templateKeys: WA_ANIVERSARIO_TEMPLATES })).toEqual([]);
  });

  it("cota AUSENTE não bloqueia: backend antigo não tem cota para esgotar", () => {
    expect(waMarketingBlockers(PRONTO, { templateKeys: WA_ANIVERSARIO_TEMPLATES })).toEqual([]);
  });

  it("cota cheia não apaga os outros bloqueios (consentimento continua valendo)", () => {
    const semConsent = { ...comCota(COTA_ZERO), marketing_consent_at: null, marketing_ready: false };
    expect(waMarketingBlockers(semConsent, { templateKeys: WA_ANIVERSARIO_TEMPLATES }).map((x) => x.code))
      .toEqual(["CONSENTIMENTO", "COTA"]);
  });

  it("o skip_reason da fila fala de cota, não de código", () => {
    const txt = waSkipReasonLabel("LIMITE_MARKETING") || "";
    expect(txt).toMatch(/cota/i);
    expect(txt).not.toMatch(/LIMITE_MARKETING/);
    expect(waSkipReasonLabel("LIMITE_MENSAL")).toMatch(/mensal|mês/i);
  });
});

// ── O cartão de uso ──────────────────────────────────────
describe("UsoCard com cota", () => {
  beforeEach(() => {
    mockPacks = { data: [] };
    mockBuy = jest.fn((_id: string, _qty: number) =>
      Promise.resolve({ pack: { id: "p1", qty: 100, status: "pending" }, payment_url: null, needs_manual: true })
    );
  });

  it("sem cota no /status, o cartão não inventa a seção (backend antigo)", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={PRONTO} companyId="loja-1" />); });
    await flush();
    expect(temTestId(tree, "wa-varejo-uso")).toBe(true);
    expect(temTestId(tree, "wa-varejo-cota")).toBe(false);
    expect(temTestId(tree, "wa-varejo-comprar-pacote")).toBe(false);
  });

  it("mostra as duas linhas: cobrança inclusa e promocionais com cota", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <UsoCard status={comCota(COTA_CHEIA, { month_sent: 210, cap: 1500 })} companyId="loja-1" />
      );
    });
    await flush();

    expect(textoDe(acharPorTestId(tree, "wa-varejo-cota-utilidade"))).toContain("210 este mês");
    expect(textoDe(acharPorTestId(tree, "wa-varejo-cota-utilidade"))).toContain("inclusos no plano");

    const promo = textoDe(acharPorTestId(tree, "wa-varejo-cota-marketing"));
    expect(promo).toContain("12");
    expect(promo).toContain("de 100");
    expect(promo).toContain("100 inclusas");
  });

  it("em 80% avisa em âmbar e já deixa comprar, sem dizer que esgotou", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={comCota(COTA_QUASE)} companyId="loja-1" />); });
    await flush();

    expect(temTestId(tree, "wa-varejo-cota-quase")).toBe(true);
    expect(temTestId(tree, "wa-varejo-cota-esgotada")).toBe(false);
    expect(textoDe(acharPorTestId(tree, "wa-varejo-cota-quase"))).toMatch(/cobranças continuam/i);
    expect(temTestId(tree, "wa-varejo-comprar-pacote")).toBe(true);
  });

  it("em 100% diz que a cota do mês esgotou e oferece o pacote por R$ 49", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={comCota(COTA_ZERO)} companyId="loja-1" />); });
    await flush();

    expect(textoDe(acharPorTestId(tree, "wa-varejo-cota-esgotada"))).toContain("Cota do mês esgotada");
    const botao = textoDe(acharPorTestId(tree, "wa-varejo-comprar-pacote"));
    expect(botao).toContain("100");
    expect(botao).toContain("R$ 49");
  });

  it("sem companyId não há botão de compra — o cartão só lê", async () => {
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={comCota(COTA_ZERO)} />); });
    await flush();
    expect(temTestId(tree, "wa-varejo-cota-esgotada")).toBe(true);
    expect(temTestId(tree, "wa-varejo-comprar-pacote")).toBe(false);
  });

  it("comprar sem cobrança automática avisa que a Aura ativa em 1 dia útil", async () => {
    const onChanged = jest.fn();
    let tree: any;
    await act(async () => {
      tree = renderer.create(<UsoCard status={comCota(COTA_ZERO)} companyId="loja-1" onChanged={onChanged} />);
    });
    await flush();

    await act(async () => { acharPorTestId(tree, "wa-varejo-comprar-pacote").props.onPress(); });
    await flush();

    expect(mockBuy).toHaveBeenCalledWith("loja-1", 100);
    expect(textoDe(acharPorTestId(tree, "wa-varejo-pacote-aviso"))).toContain("1 dia útil");
    expect(onChanged).toHaveBeenCalled();
  });

  it("com link de pagamento, abre o Pix/boleto e diz que ativa ao confirmar", async () => {
    mockBuy = jest.fn(() =>
      Promise.resolve({ pack: { id: "p2", qty: 100, status: "pending" }, payment_url: "https://pay.asaas/x", needs_manual: false })
    );
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true as any);
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={comCota(COTA_ZERO)} companyId="loja-1" />); });
    await flush();

    await act(async () => { acharPorTestId(tree, "wa-varejo-comprar-pacote").props.onPress(); });
    await flush();

    expect(abrir).toHaveBeenCalledWith("https://pay.asaas/x");
    expect(textoDe(acharPorTestId(tree, "wa-varejo-pacote-aviso"))).toMatch(/pagamento confirmar/i);
    abrir.mockRestore();
  });

  it("lista os pacotes já comprados com o status em português", async () => {
    mockPacks = { data: [{ id: "p9", qty: 100, status: "pending", valid_until: "2026-11-13" }] };
    let tree: any;
    await act(async () => { tree = renderer.create(<UsoCard status={comCota(COTA_ZERO)} companyId="loja-1" />); });
    await flush();

    const lista = textoDe(acharPorTestId(tree, "wa-varejo-pacotes"));
    expect(lista).toMatch(/100\s+mensagens/);
    expect(lista).toContain("Aguardando pagamento");
    expect(lista).toContain("13/11/2026");
  });
});
