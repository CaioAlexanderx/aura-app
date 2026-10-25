// 11/10/2026 — muro de assinatura com o Caixa vivo. Trial vencido ou cobrança
// inativa não expulsa mais a loja do Caixa: qualquer outra tela leva ao
// Caixa, que mostra o aviso com o botão do checkout. Verticais com casa
// própria seguem indo ao checkout. Caso GF Amorim / Luciano Messias.
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() } }));

import { semAssinatura, destinoSemAssinatura, textoDoAviso, temCaixaVivo, ROTA_CAIXA, ROTA_CHECKOUT } from "@/utils/muroDeAssinatura";
import { AvisoAssine } from "@/components/screens/pdv/AvisoAssine";

const dono = {
  billingStatus: "trial", trialActive: false, isDemo: false, isStaff: false, emailVerified: true,
  temEmpresa: true, isOwner: true, isKarateFederation: false, isKarateDojoVertical: false,
};

describe("semAssinatura", () => {
  it("trial vencido do dono é sem assinatura", () => {
    expect(semAssinatura(dono)).toBe(true);
  });
  it("trial ativo, cobrança ativa, demo, staff, vendedor e karatê não são", () => {
    expect(semAssinatura({ ...dono, trialActive: true })).toBe(false);
    expect(semAssinatura({ ...dono, billingStatus: "active" })).toBe(false);
    expect(semAssinatura({ ...dono, isDemo: true })).toBe(false);
    expect(semAssinatura({ ...dono, isStaff: true })).toBe(false);
    expect(semAssinatura({ ...dono, isOwner: false })).toBe(false);
    expect(semAssinatura({ ...dono, emailVerified: false })).toBe(false);
    expect(semAssinatura({ ...dono, isKarateDojoVertical: true })).toBe(false);
  });
});

describe("destinoSemAssinatura · shell Negócio (Caixa vivo)", () => {
  const vivo = { caixaVivo: true };
  it("no Caixa fica; no checkout fica", () => {
    expect(destinoSemAssinatura(["(tabs)", "pdv"], vivo)).toBeNull();
    expect(destinoSemAssinatura(["(tabs)", "checkout"], vivo)).toBeNull();
  });
  it("qualquer outra tela vai para o Caixa, não para o checkout", () => {
    expect(destinoSemAssinatura(["(tabs)"], vivo)).toBe(ROTA_CAIXA);
    expect(destinoSemAssinatura(["(tabs)", "estoque"], vivo)).toBe(ROTA_CAIXA);
    expect(destinoSemAssinatura(["(tabs)", "clientes"], vivo)).toBe(ROTA_CAIXA);
    expect(destinoSemAssinatura(["empresas"], vivo)).toBe(ROTA_CAIXA);
    expect(destinoSemAssinatura(["crediario"], vivo)).toBe(ROTA_CAIXA);
  });
});

describe("destinoSemAssinatura · verticais com casa própria", () => {
  const antigo = { caixaVivo: false };
  it("seguem indo ao checkout, inclusive do Caixa", () => {
    expect(destinoSemAssinatura(["(tabs)", "pdv"], antigo)).toBe(ROTA_CHECKOUT);
    expect(destinoSemAssinatura(["dental", "(clinic)", "hoje"], antigo)).toBe(ROTA_CHECKOUT);
    expect(destinoSemAssinatura(["(tabs)", "checkout"], antigo)).toBeNull();
  });
});

describe("AvisoAssine", () => {
  beforeEach(() => mockPush.mockClear());

  it("trial vencido: diz que o teste terminou, que o Caixa segue, e o botão leva ao checkout", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AvisoAssine trialEndsAt="2026-10-02T00:00:00Z" caixaVivo />); });
    const texto = JSON.stringify(t.toJSON());
    expect(texto).toContain("Seu período de teste terminou");
    expect(texto).toContain("O Caixa segue liberado para você vender");
    expect(texto).toContain("Assinar agora");
    // "Preciso de ajuda" é da faixa de atraso (item 11), não do fim do teste.
    expect(t.root.findAllByProps({ testID: "caixa-aviso-ajuda" }, { deep: false })).toHaveLength(0);
    act(() => { t.root.findByProps({ testID: "caixa-aviso-assinar" }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith(ROTA_CHECKOUT);
  });

  it("sem trial (assinatura cancelada): texto de assinatura inativa", () => {
    expect(textoDoAviso(null).titulo).toBe("Sua assinatura está inativa");
    expect(textoDoAviso("2026-10-02").titulo).toBe("Seu período de teste terminou");
  });
});

// 14/10/2026 (decisão da Nina, aprovada pelo Caio): o título do muro depende
// de a loja ter vendido ou não durante o teste (company.trial).
describe("título do muro conforme company.trial", () => {
  const FIM = "2026-10-02T00:00:00Z";
  const trial = (extra: Record<string, unknown> = {}) => ({
    mode: "primeira_venda",
    ends_at: FIM,
    started_by_sale_at: null,
    dias_restantes: 0,
    teto_em: FIM,
    aguardando_primeira_venda: false, // vencido: o servidor não "aguarda" mais
    dias_apos_primeira_venda: 7,
    ...extra,
  });
  const CORPO = "O Caixa segue liberado para você vender. O resto fica guardado e volta assim que você escolher o plano.";
  const VIVO = { caixaVivo: true };

  it("vencido sem nunca ter vendido: 'Seu período de teste terminou'", () => {
    const t = textoDoAviso(FIM, trial(), null, VIVO);
    expect(t.titulo).toBe("Seu período de teste terminou");
    expect(t.corpo).toBe(CORPO);
  });

  it("vencido depois de vender: 'Seus 7 dias de teste terminaram'", () => {
    const t = textoDoAviso(FIM, trial({ started_by_sale_at: "2026-09-25T12:00:00Z" }), null, VIVO);
    expect(t.titulo).toBe("Seus 7 dias de teste terminaram");
    expect(t.corpo).toBe(CORPO);
  });

  it("modo fixo (código, cupom, extensão) e backend sem o bloco: texto neutro", () => {
    expect(textoDoAviso(FIM, trial({ mode: "fixo", started_by_sale_at: "2026-09-25T12:00:00Z" })).titulo)
      .toBe("Seu período de teste terminou");
    expect(textoDoAviso(FIM, null).titulo).toBe("Seu período de teste terminou");
    expect(textoDoAviso(FIM, undefined).titulo).toBe("Seu período de teste terminou");
    expect(textoDoAviso(FIM, "lixo").titulo).toBe("Seu período de teste terminou");
  });

  it("sem trial_ends_at continua 'Sua assinatura está inativa', mesmo com bloco", () => {
    expect(textoDoAviso(null, trial({ started_by_sale_at: "2026-09-25T12:00:00Z" })).titulo)
      .toBe("Sua assinatura está inativa");
  });

  it("o componente repassa company.trial ao texto", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(
        <AvisoAssine trialEndsAt={FIM} trial={trial({ started_by_sale_at: "2026-09-25T12:00:00Z" })} />,
      );
    });
    expect(JSON.stringify(t.toJSON())).toContain("Seus 7 dias de teste terminaram");
    act(() => { t.update(<AvisoAssine trialEndsAt={FIM} trial={trial()} />); });
    const out = JSON.stringify(t.toJSON());
    expect(out).toContain("Seu período de teste terminou");
    expect(out).not.toContain("Seus 7 dias");
  });
});

// 25/10/2026 (tom das mensagens, item 10, aprovado pelo Caio): sem
// "bloqueados" nem "regularizada"; o Caixa só aparece no shell Negócio.
describe("tom do aviso do muro", () => {
  it("shell Negócio: o Caixa segue liberado e o resto fica guardado", () => {
    expect(textoDoAviso("2026-10-02", null, null, { caixaVivo: true }).corpo)
      .toBe("O Caixa segue liberado para você vender. O resto fica guardado e volta assim que você escolher o plano.");
    expect(textoDoAviso(null, null, null, { caixaVivo: true }).corpo)
      .toBe("O Caixa segue liberado. O resto volta assim que você ativar a assinatura de novo.");
  });

  it("Odonto, Food e Studio (sem Caixa vivo): nenhuma menção ao Caixa", () => {
    const teste = textoDoAviso("2026-10-02", null, null, { caixaVivo: false });
    const inativa = textoDoAviso(null);
    expect(teste.corpo).toBe("Seus dados ficam guardados e voltam assim que você escolher o plano.");
    expect(inativa.corpo).toBe("Seus dados ficam guardados e voltam assim que você ativar a assinatura de novo.");
    for (const t of [teste, inativa]) expect(t.corpo).not.toMatch(/Caixa/);
  });

  it("nenhum corpo usa 'bloqueados', 'regularizada' ou 'para sempre'", () => {
    for (const vivo of [true, false]) {
      for (const fim of ["2026-10-02", null]) {
        expect(textoDoAviso(fim, null, null, { caixaVivo: vivo }).corpo).not.toMatch(/bloquead|regularizad|para sempre/i);
      }
    }
  });

  it("temCaixaVivo segue o AuthGuard: varejo sim; Odonto, Food, Studio e Karatê não", () => {
    expect(temCaixaVivo({ vertical_active: null })).toBe(true);
    expect(temCaixaVivo({ vertical_active: "barber" })).toBe(true);
    expect(temCaixaVivo(null)).toBe(true);
    expect(temCaixaVivo({ vertical_active: "odonto" })).toBe(false);
    expect(temCaixaVivo({ vertical_active: "food" })).toBe(false);
    expect(temCaixaVivo({ vertical_active: "studio" })).toBe(false);
    expect(temCaixaVivo({ vertical: "karate_dojo" })).toBe(false);
    expect(temCaixaVivo({ vertical_active: "karate_federation" })).toBe(false);
  });

  it("o Caixa passa caixaVivo ao aviso nas duas faixas (desktop e mobile)", () => {
    const fs = jest.requireActual("fs");
    const p = jest.requireActual("path");
    const src = fs.readFileSync(p.join(__dirname, "..", "app", "(tabs)", "pdv.tsx"), "utf8");
    expect((src.match(/caixaVivo=\{temCaixaVivo\(auth\.company\)\}/g) || []).length).toBe(2);
  });
});
