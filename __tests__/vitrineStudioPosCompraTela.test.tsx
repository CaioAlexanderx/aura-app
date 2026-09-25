// ============================================================
// Vitrine Studio · Fase 4 "Pós-compra com a marca" (teste de TELA)
//
// Monta as páginas novas como as rotas `/<slug>/aprovacao/<token>` e
// `/<slug>/acompanhar/<token>` montam, com o fetch respondendo no
// formato real do backend, e confere o que a cliente vê e o que a tela
// manda para a API:
//   - aprovar e pedir ajuste (com o aviso de revisão paga e a nota);
//   - link inválido com a voz da loja; falha de rede com "Tentar de novo";
//   - acompanhar: aprovar a arte, Pix do saldo, entregue com "Pedir
//     outro igual";
//   - o endereço antigo troca de cara só com a chave vitrine_v2;
//   - "Pedir outro igual" chega à página do produto com a personalização
//     carregada e a faixa.
// ============================================================
import React from "react";
import { render, screen, fireEvent, waitFor, configure } from "@testing-library/react-native";

configure({
  hostComponentNames: {
    text: "div", textInput: "input", image: "img",
    switch: "input", scrollView: "div", modal: "div",
  },
} as any);

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return { __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path") };
});
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  Slot: () => null,
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useSegments: () => ["(tabs)"],
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockRouter = require("expo-router").router as { push: jest.Mock; replace: jest.Mock; dismissTo: jest.Mock };
// O Modal do react-native-web vira portal no document, e a Testing
// Library quebra ali ("parentInstance.children.indexOf"). A folha de
// ajuste é desenhada no lugar, só quando visível — o que se testa é o
// conteúdo dela, não o portal.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  const R = require("react");
  const Modal = ({ visible, children }: any) => (visible ? R.createElement(R.Fragment, null, children) : null);
  return { ...rn, Modal };
});
jest.mock("@/components/studio/storefront/LivePreview", () => ({
  LivePreview: () => null,
  defaultConfiguratorSize: () => 320,
}));
const mockCopiar = jest.fn();
jest.mock("@/utils/clipboard", () => ({ copyToClipboard: (...a: any[]) => mockCopiar(...a) }));
// A rota antiga lê pelo studioApi; aqui ele responde o que o teste mandar.
const mockTrackAntigo = jest.fn();
jest.mock("@/services/studioApi", () => ({
  studioApi: {
    getPublicTrack: (...a: any[]) => mockTrackAntigo(...a),
    getPublicApproval: jest.fn(),
    respondPublicApproval: jest.fn(),
  },
}));

import { PaginaDaAprovacao, PaginaDoAcompanhamento } from "@/components/studio/storefront/posCompra/PaginasDoPosCompra";
import { CascaDaVitrine } from "@/components/studio/storefront/PaginaDaVitrine";
import { ProvedorDaRota, TelaNaRota, ehPaginaDoPosCompra } from "@/components/studio/storefront/VitrineNaRota";
import AcompanharAntigo from "@/app/acompanhar/[token]";

const TOKEN = "a3f1c2d4e5b6978812ab34cd56ef7890";
const APROV = "hx7k2mq1hx7k2mq1hx7k2mq1";
const CANECA = "8f21c4a9-1b2c-4d3e-8f90-a1b2c3d4e5f6";

const MARCA = {
  slug: "sheid-mania", nome: "Sheid Mania", logo_url: null, primary_color: "#D8436F",
  font_family: "classic", whatsapp: "5512996145447", url: "https://loja.getaura.com.br/sheid-mania", vitrine_v2: false,
};

// O formato de GET /aprovacao/:token (Aura-backend studioApprovalPublic.js).
function aprovacao(extra: Record<string, any> = {}) {
  return {
    token: APROV, mockup_url: "https://r2/mockup.png", status: "pending",
    response_note: null, responded_at: null, expires_at: "2026-10-02T12:00:00Z",
    shop: { name: "Sheid LTDA" },
    order: {
      id: "o1", numero: "00123", customer_name: "Helena Martins", total_amount: 129.7,
      items: [{ product_id: CANECA, product_name: "Caneca Alça Coração", product_image: "https://r2/c.jpg", quantity: 1, unit_price: 49.9, customization: {} }],
    },
    revisions: [{ revision_number: 1, mockup_url: "https://r2/mockup.png", note: "Mockup inicial", created_by_type: "shop", created_at: "2026-09-25" }],
    marca: MARCA,
    revisoes: { inclusas: 2, usadas: 2, valor_extra: 10 },
    prazo_dias_uteis: 3,
    acompanhar_token: TOKEN,
    ...extra,
  };
}

// O formato de GET /acompanhar/:token para o pedido da vitrine.
function acompanhamento(extra: Record<string, any> = {}) {
  return {
    cancelado: false, loja: "Sheid LTDA", cliente: "Helena", pedido: "00123",
    criado_em: "2026-09-25T12:00:00Z", entrega_combinada: null, imagem: "https://r2/c.jpg",
    itens: [{ nome: "Caneca Alça Coração", qtd: 1, imagem: "https://r2/c.jpg", resumo: ["Frente e verso", "Nome: Mãe"] }],
    total: 129.7,
    etapa_atual: 1,
    etapas: [
      { key: "recebido", label: "Pedido recebido" }, { key: "arte", label: "Criando a arte" },
      { key: "producao", label: "Em produção" }, { key: "pronto", label: "Pronto" },
    ],
    saldo: null,
    origem: "vitrine",
    marca: MARCA,
    entregue: false,
    aprovacao: null,
    retirada_endereco: "Av. Dom Pedro I, 553 — Jardim Colonial",
    ...extra,
  };
}

type Rota = (url: string, init?: any) => { status: number; corpo: any } | null;
let rotas: Rota[] = [];
const chamadas: { url: string; init?: any }[] = [];

const fetchOriginal = global.fetch;
beforeEach(() => {
  rotas = [];
  chamadas.length = 0;
  mockParams = {};
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockCopiar.mockReset();
  mockTrackAntigo.mockReset();
  global.fetch = jest.fn((url: string, init?: any) => {
    chamadas.push({ url: String(url), init });
    for (const r of rotas) {
      const res = r(String(url), init);
      if (res) {
        return Promise.resolve({ ok: res.status < 400, status: res.status, json: () => Promise.resolve(res.corpo) });
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: "nao achou" }) });
  }) as any;
  try { window.sessionStorage.clear(); } catch {}
});
afterEach(() => { global.fetch = fetchOriginal; });

const naTela = (t: string) => JSON.stringify(screen.toJSON()).includes(t);
// Sob react-native-web o testID vira `data-testid` no host; a busca é
// pela instância que recebeu a prop (a mais de fora, que tem o onPress).
const porId = (id: string) => screen.UNSAFE_getAllByProps({ testID: id })[0];
const temId = (id: string) => screen.UNSAFE_queryAllByProps({ testID: id }).length > 0;
const acharId = (id: string) => waitFor(() => porId(id));
const quando = (padrao: RegExp, corpo: any, status = 200, metodo = "GET"): Rota =>
  (url, init) => (padrao.test(url) && (init?.method || "GET") === metodo ? { status, corpo } : null);

// ── Aprovar a arte ─────────────────────────────────────────────
describe("aprovar a arte no endereço da loja", () => {
  test("marca da loja, título, revisões e o mockup grande", async () => {
    rotas.push(quando(/\/aprovacao\/hx7k/, aprovacao({ revisoes: { inclusas: 2, usadas: 0, valor_extra: 10 } })));
    render(<PaginaDaAprovacao slug="sheid-mania" token={APROV} />);
    expect(await acharId("aprovacao-aprovar")).toBeTruthy();
    expect(naTela("Sheid Mania")).toBe(true);
    expect(naTela("A arte da sua caneca está pronta")).toBe(true);
    expect(naTela("Oi, Helena! ")).toBe(true);
    expect(naTela("Você ainda tem 2 revisões inclusas neste pedido.")).toBe(true);
    // Sem emoji nem o azul-marinho da página de antes.
    expect(naTela("🎉")).toBe(false);
    expect(naTela("#1E3A8A")).toBe(false);
  });

  test("pedir ajuste: avisa que é revisão paga ANTES, e manda a nota", async () => {
    rotas.push(quando(/\/aprovacao\/hx7k[^/]*$/, aprovacao()));
    rotas.push(quando(/\/aprovacao\/hx7k.*\/respond$/, { ok: true, action: "request_changes" }, 200, "POST"));
    render(<PaginaDaAprovacao slug="sheid-mania" token={APROV} />);
    fireEvent.press(await acharId("aprovacao-ajuste-botao"));
    expect(await acharId("folha-de-ajuste")).toBeTruthy();
    expect(naTela("O que a gente ajusta em Caneca Alça Coração?")).toBe(true);
    expect(naTela("Esta seria a 3ª revisão: R$ 10,00. A loja confirma com você antes de cobrar.")).toBe(true);

    fireEvent.changeText(porId("ajuste-texto"), "Deixar o nome maior");
    fireEvent.press(porId("ajuste-enviar"));
    expect(await acharId("aprovacao-ajuste")).toBeTruthy();
    expect(naTela("Sheid Mania recebeu seu pedido de ajuste")).toBe(true);
    expect(naTela("Deixar o nome maior")).toBe(true);
    const post = chamadas.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(post.init.body)).toEqual({ action: "request_changes", note: "Deixar o nome maior" });
  });

  test("aprovar: 'Arte aprovada', o que acontece agora e o caminho para acompanhar", async () => {
    rotas.push(quando(/\/aprovacao\/hx7k[^/]*$/, aprovacao()));
    rotas.push(quando(/\/respond$/, { ok: true, action: "approve" }, 200, "POST"));
    render(<PaginaDaAprovacao slug="sheid-mania" token={APROV} />);
    fireEvent.press(await acharId("aprovacao-aprovar-botao"));
    expect(await acharId("aprovacao-aprovada")).toBeTruthy();
    expect(naTela("Arte aprovada")).toBe(true);
    expect(naTela("Prazo de 3 dias úteis — sem hora marcada, por etapas.")).toBe(true);
    fireEvent.press(porId("aprovacao-acompanhar"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/sheid-mania/acompanhar/${TOKEN}`);
  });

  test("link que venceu: a voz da loja e o WhatsApp", async () => {
    rotas.push(quando(/\/aprovacao\//, aprovacao({ status: "expired" })));
    render(<PaginaDaAprovacao slug="sheid-mania" token={APROV} />);
    expect(await acharId("pos-compra-erro")).toBeTruthy();
    expect(naTela("Este link de aprovação expirou")).toBe(true);
    expect(naTela("Falar com Sheid Mania no WhatsApp")).toBe(true);
  });
});

describe("link inválido ou que não carregou", () => {
  test("token que não existe: a marca vem da loja do endereço (mockup, Tela 7)", async () => {
    rotas.push(quando(/\/storefront\/sheid-mania\/studio\/products$/, {
      site: { name: "Sheid Mania", primary_color: "#D8436F", font_family: "classic", whatsapp: "5512996145447" },
      products: [],
    }));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token="nao-existe-mesmo-0000" />);
    expect(await acharId("pos-compra-erro")).toBeTruthy();
    expect(naTela("Não encontramos esse pedido")).toBe(true);
    expect(await screen.findByText("Falar com Sheid Mania no WhatsApp")).toBeTruthy();
    expect(naTela("Ir para a loja")).toBe(true);
    expect(naTela("🔍")).toBe(false);
  });

  test("falha de rede: 'Tentar de novo' refaz a carga", async () => {
    let vezes = 0;
    rotas.push((url) => {
      if (!/\/acompanhar\//.test(url)) return null;
      vezes += 1;
      return vezes === 1 ? { status: 503, corpo: { error: "fora" } } : { status: 200, corpo: acompanhamento() };
    });
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    fireEvent.press(await screen.findByText("Tentar de novo"));
    expect(await acharId("acompanhar-com-marca")).toBeTruthy();
  });
});

// ── Acompanhar ─────────────────────────────────────────────────
describe("acompanhar o pedido no endereço da loja", () => {
  test("etapas, a arte esperando por ela, itens com resumo e onde retirar", async () => {
    rotas.push(quando(/\/acompanhar\//, acompanhamento({ aprovacao: { token: APROV } })));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    expect(await acharId("acompanhar-com-marca")).toBeTruthy();
    expect(naTela("Oi, Helena!")).toBe(true);
    expect(naTela("é onde estamos agora")).toBe(true);
    expect(naTela("Pronto para retirar")).toBe(true);
    expect(naTela("Frente e verso · Nome: Mãe")).toBe(true);
    expect(naTela("Av. Dom Pedro I, 553")).toBe(true);
    expect(naTela("Pedido #00123 · Loja desenvolvida com Aura.")).toBe(true);
    fireEvent.press(screen.getByText("Aprovar a arte"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/sheid-mania/aprovacao/${APROV}`);
  });

  test("saldo: Pix a um toque, e o código à mostra quando copiar falha", async () => {
    mockCopiar.mockResolvedValue(false);
    rotas.push(quando(/\/acompanhar\//, acompanhamento({
      etapa_atual: 2, saldo: { valor: 64.85, vencimento: "2026-10-22", pix: "00020126580014BR.GOV.BCB.PIX" },
    })));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    expect(await acharId("acompanhar-acao-saldo")).toBeTruthy();
    expect(naTela("R$ 64,85")).toBe(true);
    expect(naTela("para 22 de outubro")).toBe(true);
    fireEvent.press(porId("acompanhar-copiar-pix"));
    expect(await screen.findByText("Selecione e copie o código:")).toBeTruthy();
    expect(mockCopiar).toHaveBeenCalledWith("00020126580014BR.GOV.BCB.PIX");
  });

  test("entregue: 'Pedir outro igual' leva à peça com a personalização", async () => {
    rotas.push(quando(/\/acompanhar\//, acompanhamento({ etapa_atual: 3, entregue: true })));
    rotas.push(quando(/\/pedido\/.*\/repetir$/, {
      numero: "00123",
      itens: [{ product_id: CANECA, nome: "Caneca Alça Coração", quantidade: 1, indisponivel: false, personalizacao: { valores: {}, verso: false, meio: false } }],
    }));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    expect(await acharId("acompanhar-acao-entregue")).toBeTruthy();
    expect(naTela("Retirado")).toBe(true);
    expect(naTela("Gostou? Peça outra igual")).toBe(true);
    await waitFor(() => expect(chamadas.some((c) => /\/storefront\/sheid-mania\/studio\/pedido\/.+\/repetir$/.test(c.url))).toBe(true));
    await acharId("acompanhar-repetir");
    // O botão só fica ativo depois que o servidor disse o que ainda está na loja.
    await waitFor(() => expect(porId("acompanhar-repetir").props.onPress).toBeTruthy());
    fireEvent.press(porId("acompanhar-repetir"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/sheid-mania/p/${CANECA}?repetir=${TOKEN}`);
  });

  test("entregue, mas a peça saiu da loja: aviso no lugar do botão", async () => {
    rotas.push(quando(/\/acompanhar\//, acompanhamento({ etapa_atual: 3, entregue: true })));
    rotas.push(quando(/\/repetir$/, {
      numero: "00123",
      itens: [{ product_id: CANECA, nome: "Caneca Alça Coração", quantidade: 1, indisponivel: true, personalizacao: null }],
    }));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    expect(await acharId("acompanhar-repetir-indisponivel")).toBeTruthy();
    expect(temId("acompanhar-repetir")).toBe(false);
  });

  test("cancelado: com a voz da loja", async () => {
    rotas.push(quando(/\/acompanhar\//, { cancelado: true, loja: "Sheid LTDA", cliente: "Helena", pedido: "00123", marca: MARCA }));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    expect(await acharId("acompanhar-cancelado")).toBeTruthy();
    expect(naTela("Pedido #00123 cancelado")).toBe(true);
  });

  test("link de OS da ótica colado no endereço da loja vai para a página dela", async () => {
    rotas.push(quando(/\/acompanhar\//, { ...acompanhamento(), tipo: "oculos", marca: null }));
    render(<PaginaDoAcompanhamento slug="sheid-mania" token={TOKEN} />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/acompanhar/${TOKEN}`));
  });
});

// ── O endereço antigo ──────────────────────────────────────────
describe("/acompanhar/<token> — o endereço antigo continua de pé", () => {
  test("chave desligada: a página de sempre", async () => {
    mockParams = { token: TOKEN };
    mockTrackAntigo.mockResolvedValue(acompanhamento());
    render(<AcompanharAntigo />);
    expect(await screen.findByText("Acompanhe sua encomenda por aqui.")).toBeTruthy();
    expect(temId("acompanhar-com-marca")).toBe(false);
  });

  test("chave ligada: a mesma página nova, com a marca", async () => {
    mockParams = { token: TOKEN };
    mockTrackAntigo.mockResolvedValue(acompanhamento({ marca: { ...MARCA, vitrine_v2: true } }));
    render(<AcompanharAntigo />);
    expect(await acharId("acompanhar-com-marca")).toBeTruthy();
  });

  test("backend de antes (sem marca): a página de sempre", async () => {
    mockParams = { token: TOKEN };
    const { marca, origem, ...antigo } = acompanhamento() as any;
    mockTrackAntigo.mockResolvedValue(antigo);
    render(<AcompanharAntigo />);
    expect(await screen.findByText("Acompanhe sua encomenda por aqui.")).toBeTruthy();
  });
});

// ── A página do produto com ?repetir= ─────────────────────────
describe("Pedir outro igual — a página do produto carrega a personalização", () => {
  const LOJA = {
    site: { name: "Sheid Mania", primary_color: "#D8436F", accent_color: "#EC4899", logo_url: null },
    products: [{
      id: CANECA, name: "Caneca Alça Coração", description: "Porcelana 300ml.", price: "49.90",
      image_url: null, gallery_urls: [], category: null, category_id: null, templates: [],
      customization_config: { fields: [{ id: "nome", type: "text", label: "Nome na caneca", required: true, config: {} }] },
    }],
    categories: [],
    sla: { sla_base_days: 5, queue_qty: 0, total_estimate_days: 5 },
    payment: { has_pix: true, has_card: false, pay_on_delivery_enabled: false },
    revisions: {},
    total_products: 1,
  };

  function montar(repetir: any) {
    rotas.push(quando(/\/studio\/products$/, LOJA));
    rotas.push(quando(/\/repetir$/, repetir));
    try { window.sessionStorage.setItem("aura-vitrine-na-aba-sheid-mania", "1"); } catch {}
    const navegar = jest.fn();
    render(
      <ProvedorDaRota navegar={navegar}>
        <CascaDaVitrine slug="sheid-mania" navegar={navegar}>
          <TelaNaRota tela={{ tipo: "produto", id: CANECA }} consulta={{ id: CANECA, repetir: TOKEN }} />
        </CascaDaVitrine>
      </ProvedorDaRota>,
    );
  }

  test("a faixa e o texto do pedido no campo, com a quantidade do pedido", async () => {
    montar({
      numero: "00123",
      itens: [{ product_id: CANECA, nome: "Caneca Alça Coração", quantidade: 3, indisponivel: false, personalizacao: { valores: { nome: "Mãe" }, verso: false, meio: false } }],
    });
    expect(await acharId("faixa-da-repeticao")).toBeTruthy();
    expect(naTela("Personalização do pedido #00123 carregada — confira e ajuste.")).toBe(true);
    await waitFor(() => expect(screen.getByDisplayValue("Mãe")).toBeTruthy());
    expect(chamadas.some((c) => c.url.endsWith(`/storefront/sheid-mania/studio/pedido/${TOKEN}/repetir`))).toBe(true);
    // A faixa fecha.
    fireEvent.press(screen.getByLabelText("Fechar aviso"));
    await waitFor(() => expect(temId("faixa-da-repeticao")).toBe(false));
    // O que foi carregado continua no campo.
    expect(screen.getByDisplayValue("Mãe")).toBeTruthy();
  });

  test("o pedido não tem mais esta peça disponível: faixa de aviso, configurador em branco", async () => {
    montar({
      numero: "00123",
      itens: [{ product_id: CANECA, nome: "Caneca Alça Coração", quantidade: 1, indisponivel: true, personalizacao: null }],
    });
    expect(await acharId("faixa-da-repeticao")).toBeTruthy();
    expect(naTela("A peça do pedido #00123 não está mais na loja.")).toBe(true);
    expect(screen.queryByDisplayValue("Mãe")).toBeNull();
  });
});

describe("o layout desenha o pós-compra sem a casca da loja", () => {
  test("ehPaginaDoPosCompra", () => {
    expect(ehPaginaDoPosCompra(["[slug]", "aprovacao", "[token]"])).toBe(true);
    expect(ehPaginaDoPosCompra(["[slug]", "acompanhar", "[token]"])).toBe(true);
    expect(ehPaginaDoPosCompra(["[slug]", "p", "[id]"])).toBe(false);
    expect(ehPaginaDoPosCompra(["[slug]"])).toBe(false);
    expect(ehPaginaDoPosCompra(["acompanhar", "[token]"])).toBe(false);
    expect(ehPaginaDoPosCompra(null)).toBe(false);
  });
});
