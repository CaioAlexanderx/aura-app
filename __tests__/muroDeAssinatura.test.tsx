// 11/10/2026 — muro de assinatura com o Caixa vivo. Trial vencido ou cobrança
// inativa não expulsa mais a loja do Caixa: qualquer outra tela leva ao
// Caixa, que mostra o aviso com o botão do checkout. Verticais com casa
// própria seguem indo ao checkout. Caso GF Amorim / Luciano Messias.
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() } }));

import { semAssinatura, destinoSemAssinatura, textoDoAviso, ROTA_CAIXA, ROTA_CHECKOUT } from "@/utils/muroDeAssinatura";
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

  it("trial vencido: diz que o teste terminou, que o Caixa continua, e o botão leva ao checkout", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AvisoAssine trialEndsAt="2026-10-02T00:00:00Z" />); });
    const texto = JSON.stringify(t.toJSON());
    expect(texto).toContain("Seu período de teste terminou");
    expect(texto).toContain("O Caixa continua funcionando");
    expect(texto).toContain("Assinar agora");
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
  const CORPO = "O Caixa continua funcionando. Estoque, clientes, relatórios e o resto ficam bloqueados até você assinar.";

  it("vencido sem nunca ter vendido: 'Seu período de teste terminou'", () => {
    const t = textoDoAviso(FIM, trial());
    expect(t.titulo).toBe("Seu período de teste terminou");
    expect(t.corpo).toBe(CORPO);
  });

  it("vencido depois de vender: 'Seus 7 dias de teste terminaram'", () => {
    const t = textoDoAviso(FIM, trial({ started_by_sale_at: "2026-09-25T12:00:00Z" }));
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
