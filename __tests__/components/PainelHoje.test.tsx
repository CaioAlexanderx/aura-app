// ============================================================
// Gestão Aura › Hoje (13/10/2026)
//
// Tela única de blocos: três seções, um card expandido por vez, alerta que
// expande o bloco dele (ou abre a ficha da loja), catálogo que liga e
// desliga blocos e salva em PUT /layout. Os dados vêm do adminApi (mock) com
// as respostas reais do backend (__tests__/__fixtures__/painel, cópia de
// Aura-backend tests/fixtures/painel).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true, default: stub("Svg"), Svg: stub("Svg"), Path: stub("Path"),
    Circle: stub("Circle"), Line: stub("Line"), Text: stub("SvgText"),
  };
});
// O Modal do react-native-web usa portal, que o test renderer não monta.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.setPrototypeOf({ Modal: ({ visible, children }: any) => (visible ? children : null) }, RN);
});
jest.mock("@/services/adminApi", () => ({
  adminApi: {
    painel: {
      hoje: jest.fn(), bloco: jest.fn(), ficha: jest.fn(), layout: jest.fn(), salvarLayout: jest.fn(), recalcular: jest.fn(),
      // Extrato OFX (seção do bloco Receita): coberto em ExtratoOfxReceita.test.tsx.
      ofx: { extratos: jest.fn(), detalhe: jest.fn() },
      // Registrar contato (backend #836).
      contatos: { registrar: jest.fn() },
    },
    // +7 dias de teste (rota que já existia).
    extendTrial: jest.fn(),
  },
}));

import { Linking } from "react-native";
import { PainelHoje } from "@/components/admin/painel/PainelHoje";
import { DEFINICOES } from "@/components/admin/painel/blocos";
import { PAINEL_HOJE } from "@/components/admin/painel/dadosEstaticos";
import { PAINEL_FALLBACK_DEV } from "@/components/admin/painel/usePainelHoje";
import { adminApi } from "@/services/adminApi";
import { toast } from "@/components/Toast";

const api = (adminApi as any).painel as Record<string, jest.Mock>;
const fx = (nome: string) => JSON.parse(JSON.stringify(require("../__fixtures__/painel/" + nome + ".json")));

const HOJE = fx("hoje");
const IDS: string[] = HOJE.blocos.map((b: any) => b.id);
const LOJA_AURORA = "aaaaaaaa-0000-4000-8000-000000000001";
const MERCADO = "aaaaaaaa-0000-4000-8000-000000000002";

let abrirUrl: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  PAINEL_FALLBACK_DEV.dadosDeExemplo = false;
  delete (global as any).__DEV__;
  api.hoje.mockImplementation(async () => fx("hoje"));
  // Período diferente do gravado é calculado na hora (ao_vivo), como no backend.
  api.bloco.mockImplementation(async (id: string, periodo?: number) => {
    const d = fx("blocos." + id);
    if (periodo) { d.periodo = periodo; d.ao_vivo = true; }
    return d;
  });
  api.ficha.mockImplementation(async () => fx("clientes.ficha"));
  api.layout.mockImplementation(async () => fx("layout.get"));
  api.salvarLayout.mockImplementation(async (blocos: { id: string; visivel: boolean }[]) => ({
    padrao: false, atualizado_em: "2026-10-13T12:00:00.000Z",
    blocos: blocos.map((b) => ({ ...b, titulo: b.id, grupo: "negocio" })),
  }));
  api.recalcular.mockImplementation(async () => fx("recalcular"));
  (api as any).ofx.extratos.mockImplementation(async () => ({ meses: [] }));
  abrirUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as any);
});

afterEach(() => { abrirUrl.mockRestore(); });

// A grade se mede pelo onLayout da própria tela.
async function medir(tree: renderer.ReactTestRenderer, width: number) {
  await act(async () => {
    tree.root.findAllByProps({ testID: "painel-hoje" }, { deep: false })[0].props.onLayout({ nativeEvent: { layout: { width } } });
  });
}

// O react-query notifica por setTimeout(0): microtask sozinha não basta.
async function flush(vezes = 3) {
  for (let i = 0; i < vezes; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mount(width = 1200) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>);
  });
  await flush();
  if (tree!.root.findAllByProps({ testID: "painel-hoje" }, { deep: false }).length) await medir(tree!, width);
  return tree!;
}

// testID no nível do componente (deep:false), como os outros testes de tela.
const byTestId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAllByProps({ testID: id }, { deep: false });
const idsStartingWith = (tree: renderer.ReactTestRenderer, prefix: string) =>
  tree.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith(prefix) && typeof n.type !== "string")
    .map((n) => n.props.testID as string)
    .filter((v, i, a) => a.indexOf(v) === i);
const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());
const estilo = (tree: renderer.ReactTestRenderer, id: string) =>
  Object.assign({}, ...[byTestId(tree, id)[0].props.style].flat(Infinity as 1).filter(Boolean));

async function press(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { byTestId(tree, id)[0].props.onPress(); });
  await flush();
}

// Cards na ordem em que aparecem na tela.
const cardsNaOrdem = (tree: renderer.ReactTestRenderer) =>
  idsStartingWith(tree, "bloco-").map((t) => t.replace("bloco-", "")).filter((id) => IDS.indexOf(id) >= 0);

describe("Gestão Aura › Hoje", () => {
  it("carrega da API e renderiza cabeçalho, faixa, alertas e as três seções", async () => {
    const tree = await mount();
    expect(api.hoje).toHaveBeenCalledTimes(1);
    expect(api.layout).toHaveBeenCalledTimes(1);
    expect(api.bloco).not.toHaveBeenCalled();   // nada aberto, nada buscado

    for (const sec of ["negocio", "produto", "operacao"]) expect(byTestId(tree, "painel-secao-" + sec)).toHaveLength(1);

    const out = text(tree);
    expect(out).toContain("Terça, 13 de outubro");
    expect(out).toContain("06:00");
    for (const t of ["Negócio", "Produto e uso", "Operação", "MRR real · Asaas", "Loja Aurora vence amanhã", "Trials por degrau"]) {
      expect(out).toContain(t);
    }
    expect(idsStartingWith(tree, "destaque-")).toHaveLength(4);
    expect(idsStartingWith(tree, "alerta-")).toHaveLength(4);
    // Um card por bloco calculado, nenhum detalhe aberto.
    for (const id of IDS) expect(byTestId(tree, "bloco-" + id)).toHaveLength(1);
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual([]);
    // Dados reais: sem selo de exemplo; o dia veio gravado, então não é "ao vivo".
    expect(out).not.toContain("dados de exemplo");
    expect(out).not.toContain("calculado agora");
    tree.unmount();
  });

  it("todo bloco da API tem definição de apresentação", () => {
    const ids = DEFINICOES.map((d) => d.id as string);
    for (const id of IDS) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dia calculado na hora mostra o selo 'calculado agora'", async () => {
    api.hoje.mockImplementation(async () => ({ ...fx("hoje"), ao_vivo: true }));
    const tree = await mount();
    expect(text(tree)).toContain("calculado agora");
    tree.unmount();
  });

  it("enquanto carrega mostra o estado de carregamento", async () => {
    let soltar: (v: any) => void = () => {};
    api.hoje.mockImplementation(() => new Promise((res) => { soltar = res; }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}><PainelHoje /></QueryClientProvider>); });
    expect(byTestId(tree!, "painel-carregando")).toHaveLength(1);
    expect(byTestId(tree!, "painel-hoje")).toHaveLength(0);
    await act(async () => { soltar(fx("hoje")); });
    await flush();
    expect(byTestId(tree!, "painel-carregando")).toHaveLength(0);
    expect(byTestId(tree!, "painel-hoje")).toHaveLength(1);
    tree!.unmount();
  });

  it("erro na API mostra 'tentar de novo', que refaz a chamada", async () => {
    api.hoje.mockRejectedValueOnce(new Error("rede"));
    const tree = await mount();
    expect(byTestId(tree, "painel-erro")).toHaveLength(1);
    expect(text(tree)).toContain("Não consegui carregar o painel");
    expect(byTestId(tree, "painel-hoje")).toHaveLength(0);

    await press(tree, "painel-tentar-de-novo");
    await flush();
    expect(api.hoje).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "painel-erro")).toHaveLength(0);
    expect(byTestId(tree, "painel-hoje")).toHaveLength(1);
    tree.unmount();
  });

  it("dia sem blocos calculados mostra o estado vazio e mantém o Recalcular", async () => {
    api.hoje.mockImplementation(async () => ({ ...fx("hoje"), blocos: [], alertas: [] }));
    const tree = await mount();
    expect(byTestId(tree, "painel-vazio")).toHaveLength(1);
    expect(byTestId(tree, "painel-recalcular")).toHaveLength(1);
    expect(idsStartingWith(tree, "painel-secao-")).toEqual([]);
    tree.unmount();
  });

  it("falha no layout não derruba a tela: usa todos os blocos calculados", async () => {
    api.layout.mockRejectedValueOnce(new Error("500"));
    const tree = await mount();
    for (const id of IDS) expect(byTestId(tree, "bloco-" + id)).toHaveLength(1);
    tree.unmount();
  });

  it("expandir um card busca o detalhe, ocupa a largura toda e recolhe o anterior", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-trials_degrau");
    expect(api.bloco).toHaveBeenCalledWith("trials_degrau", undefined);
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-trials_degrau"]);
    expect(text(tree)).toContain("Tech Assist");

    await press(tree, "bloco-expandir-pagantes");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-pagantes"]);
    expect(text(tree)).toContain("Casa do Construtor");
    expect(text(tree)).not.toContain("Tech Assist");
    expect(estilo(tree, "bloco-pagantes").width).toBe("100%");
    expect(estilo(tree, "bloco-cadastros").width).not.toBe("100%");

    // O mesmo botão recolhe.
    await press(tree, "bloco-expandir-pagantes");
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual([]);
    expect(estilo(tree, "bloco-pagantes").width).not.toBe("100%");
    tree.unmount();
  });

  it("cada um dos 15 blocos expande e renderiza indicadores, listas, séries e insight da API", async () => {
    const tree = await mount();
    for (const id of IDS) {
      const raw = fx("blocos." + id);
      await press(tree, "bloco-expandir-" + id);
      expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-" + id]);
      expect(api.bloco).toHaveBeenLastCalledWith(id, undefined);
      const out = text(tree);

      for (const ind of raw.indicadores) expect(out).toContain(ind.rotulo);
      for (const lista of raw.listas) {
        expect(out).toContain(lista.titulo);
        const primeira = lista.linhas[0];
        if (!primeira) continue;
        const col = lista.colunas[0];
        if (col.tipo === "loja" || col.tipo === "texto") expect(out).toContain(String(primeira[col.chave]));
        // Os degraus do trial viram cartões: sem cabeçalho de coluna.
        if (id !== "trials_degrau") for (const c of lista.colunas) expect(out).toContain(c.rotulo);
      }
      for (const serie of raw.series) expect(out).toContain(serie.titulo);
      if (raw.insight) expect(out).toContain(raw.insight.slice(0, 40));
      // O seletor de período está em todo detalhe.
      expect(byTestId(tree, "periodo-" + id + "-30")).toHaveLength(1);
    }
    tree.unmount();
  });

  it("Uso por funcionalidade: Ótica, Matcon, Agenda e Cupons com número; Etiquetas aparece 'sem medida', não zero", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-uso_funcionalidade");
    const out = text(tree);
    for (const rotulo of ["Ótica", "Entregas Matcon", "Parceiros Matcon", "Agenda", "Cupons", "Etiquetas"]) expect(out).toContain(rotulo);
    expect(out).toContain("sem medida");
    // indicador e insight dizem a mesma coisa
    expect(out).toContain("Sem medida");
    expect(out).toContain("Etiquetas está sem medida");
    tree.unmount();
  });

  it("lista longa abre em 10 linhas e 'Ver todas' mostra o resto", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-adocao");
    // Linhas de "Quem usa e quem não usa": um por recurso e pagante.
    expect(byTestId(tree, "tabela-ver-todas").length).toBeGreaterThan(0);
    const antes = idsStartingWith(tree, "loja-").length;
    await act(async () => { byTestId(tree, "tabela-ver-todas")[byTestId(tree, "tabela-ver-todas").length - 1].props.onPress(); });
    expect(idsStartingWith(tree, "loja-").length).toBeGreaterThanOrEqual(antes);
    expect(text(tree)).toContain("Mostrar menos");
    tree.unmount();
  });

  it("grade de 12 colunas: 4 e 6 no desktop, 2 por linha no tablet, coluna única no celular", async () => {
    const tree = await mount(1200);
    // (1200 - 2 vãos de 12) / 3 e (1200 - 12) / 2
    expect(estilo(tree, "bloco-cadastros").width).toBe(392);
    expect(estilo(tree, "bloco-receita").width).toBe(594);
    await medir(tree, 800);
    expect(estilo(tree, "bloco-cadastros").width).toBe(394);
    expect(estilo(tree, "bloco-receita").width).toBe(394);
    await medir(tree, 343);   // 375 px menos as margens
    for (const id of IDS) expect(estilo(tree, "bloco-" + id).width).toBe("100%");
    for (const d of ["receita", "pagantes", "acesso", "plataforma"]) expect(estilo(tree, "destaque-" + d).width).toBe("100%");
    for (const i of [0, 1, 2]) expect(estilo(tree, "alerta-" + i).width).toBe("100%");
    tree.unmount();
  });

  it("alerta sem loja expande o bloco dele; alerta de loja abre a ficha pela API", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-cadastros");
    await press(tree, "alerta-2");   // pagamento sem loja → receita, sem ficha
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-receita"]);
    expect(text(tree)).toContain("Eventos da Asaas");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    expect(api.ficha).not.toHaveBeenCalled();

    await press(tree, "alerta-0");   // pagante anual vencendo → ficha da loja
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(api.ficha).toHaveBeenCalledWith(LOJA_AURORA);
    expect(text(tree)).toContain("Loja Aurora");
    expect(text(tree)).toContain("Módulos que usa");
    await press(tree, "ficha-modal-fechar");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    // A ficha não mexe no card aberto.
    expect(idsStartingWith(tree, "bloco-detalhe-")).toEqual(["bloco-detalhe-receita"]);

    await press(tree, "alerta-1");   // trial com venda vencendo da Ótica Visão: também é de loja
    expect(api.ficha).toHaveBeenLastCalledWith("aaaaaaaa-0000-4000-8000-000000000005");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    tree.unmount();
  });

  it("nome de loja numa lista abre a ficha pela API", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-pagantes");
    await press(tree, "loja-" + MERCADO);
    expect(byTestId(tree, "ficha-modal")).toHaveLength(1);
    expect(api.ficha).toHaveBeenCalledWith(MERCADO);
    expect(text(tree)).toContain("Saúde");
    expect(text(tree)).toContain("Vendas por semana");
    expect(text(tree)).toContain("Cobrança apagada na Asaas · R$ 140,83");
    tree.unmount();
  });

  it("telefone da loja numa lista abre o WhatsApp (wa.me)", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-pagantes");
    await act(async () => { byTestId(tree, "whatsapp-" + MERCADO)[0].props.onPress(); });
    expect(abrirUrl).toHaveBeenCalledWith("https://wa.me/5511999900002");
    expect(text(tree)).toContain("(11) 99990-0002");
    tree.unmount();
  });

  it("telefone solto (Contatos) também abre o WhatsApp", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-contatos");
    await act(async () => { byTestId(tree, "whatsapp-11988880001")[0].props.onPress(); });
    expect(abrirUrl).toHaveBeenCalledWith("https://wa.me/5511988880001");
    tree.unmount();
  });

  it("ficha: WhatsApp abre wa.me e Abrir cliente leva à lista da loja", async () => {
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(text(tree)).toContain("Loja Aurora vence amanhã");   // alerta da própria ficha

    await press(tree, "ficha-whatsapp");
    expect(abrirUrl).toHaveBeenCalledWith("https://wa.me/5511999900001");

    await press(tree, "ficha-abrir-cliente");
    // Com a loja na rota: a tela de Clientes abre o painel dela (?loja=).
    expect(mockPush).toHaveBeenCalledWith("/gestao-aura-clientes?loja=aaaaaaaa-0000-4000-8000-000000000001");
    expect(byTestId(tree, "ficha-modal")).toHaveLength(0);
    tree.unmount();
  });

  it("ficha sem telefone avisa em vez de abrir o WhatsApp", async () => {
    api.ficha.mockImplementation(async () => ({ ...fx("clientes.ficha"), telefone: null, cliente: { ...fx("clientes.ficha").cliente, owner_phone: null } }));
    const tree = await mount();
    await press(tree, "alerta-0");
    await press(tree, "ficha-whatsapp");
    expect(abrirUrl).not.toHaveBeenCalled();
    expect((toast.info as jest.Mock).mock.calls.pop()[0]).toContain("não tem telefone");
    tree.unmount();
  });

  it("erro ao carregar a ficha mostra 'tentar de novo'", async () => {
    api.ficha.mockRejectedValueOnce(new Error("404"));
    const tree = await mount();
    await press(tree, "alerta-0");
    expect(byTestId(tree, "ficha-erro")).toHaveLength(1);
    await press(tree, "ficha-tentar-de-novo");
    await flush();
    expect(api.ficha).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "ficha-erro")).toHaveLength(0);
    expect(text(tree)).toContain("Módulos que usa");
    tree.unmount();
  });

  it("período: 30 refaz a chamada do bloco; o mesmo período não chama de novo", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-fiscal");
    expect(api.bloco).toHaveBeenCalledTimes(1);
    expect(api.bloco).toHaveBeenLastCalledWith("fiscal", undefined);
    // Fiscal abre em 7 dias (padrão do backend).
    expect(byTestId(tree, "periodo-fiscal-7")[0].props.accessibilityState.selected).toBe(true);
    expect(byTestId(tree, "periodo-fiscal-30")[0].props.accessibilityState.selected).toBe(false);
    expect(text(tree)).not.toContain("calculado agora");

    await press(tree, "periodo-fiscal-7");
    expect(api.bloco).toHaveBeenCalledTimes(1);

    await press(tree, "periodo-fiscal-30");
    expect(api.bloco).toHaveBeenCalledTimes(2);
    expect(api.bloco).toHaveBeenLastCalledWith("fiscal", 30);
    expect(byTestId(tree, "periodo-fiscal-30")[0].props.accessibilityState.selected).toBe(true);
    // Período diferente do gravado vem calculado na hora.
    expect(text(tree)).toContain("calculado agora");

    await press(tree, "periodo-fiscal-90");
    expect(api.bloco).toHaveBeenLastCalledWith("fiscal", 90);
    tree.unmount();
  });

  it("Plataforma abre em 14 dias: o padrão do backend entra como chip próprio", async () => {
    const tree = await mount();
    await press(tree, "bloco-expandir-plataforma");
    expect(byTestId(tree, "periodo-plataforma-14")).toHaveLength(1);
    expect(byTestId(tree, "periodo-plataforma-14")[0].props.accessibilityState.selected).toBe(true);
    tree.unmount();
  });

  it("erro no detalhe do bloco mostra 'tentar de novo'", async () => {
    api.bloco.mockRejectedValueOnce(new Error("500"));
    const tree = await mount();
    await press(tree, "bloco-expandir-crediario");
    expect(byTestId(tree, "bloco-erro-crediario")).toHaveLength(1);
    await press(tree, "bloco-tentar-de-novo-crediario");
    await flush();
    expect(api.bloco).toHaveBeenCalledTimes(2);
    expect(byTestId(tree, "bloco-erro-crediario")).toHaveLength(0);
    expect(text(tree)).toContain("Parcelas vencidas por loja");
    tree.unmount();
  });

  it("a ordem e a visibilidade vêm de GET /layout", async () => {
    api.layout.mockImplementation(async () => fx("layout.put").resposta);   // receita, pagantes primeiro; contatos oculto
    const tree = await mount();
    expect(byTestId(tree, "bloco-contatos")).toHaveLength(0);
    const ordem = cardsNaOrdem(tree);
    expect(ordem).not.toContain("contatos");
    expect(ordem.length).toBe(IDS.length - 1);
    // Dentro da seção Negócio: receita e pagantes passam à frente de trials_degrau.
    const negocio = ordem.filter((id) => ["trials_degrau", "receita", "cadastros", "pagantes", "pagantes_sem_venda"].indexOf(id) >= 0);
    expect(negocio).toEqual(["receita", "pagantes", "trials_degrau", "cadastros", "pagantes_sem_venda"]);
    tree.unmount();
  });

  it("o catálogo abre, fecha e salva em PUT /layout com visíveis na ordem e desligados no fim", async () => {
    const tree = await mount();
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    await press(tree, "painel-abrir-catalogo");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(1);
    expect(text(tree)).toContain("Catálogo de blocos");
    expect([].concat(byTestId(tree, "catalogo-contagem")[0].props.children).join("")).toBe("16 ativos · 0 disponíveis · 5 em construção");
    // O que o backend não calcula fica travado.
    for (const id of ["nps", "custos", "etiquetas", "aurinha", "tempo_primeira_venda"]) {
      expect(byTestId(tree, "catalogo-item-" + id)[0].props.disabled).toBe(true);
    }
    expect(byTestId(tree, "catalogo-item-contatos")[0].props.disabled).toBeFalsy();

    // Cancelar descarta o que foi marcado e não chama a API.
    await press(tree, "catalogo-item-fiscal");
    await press(tree, "catalogo-cancelar");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    expect(byTestId(tree, "bloco-fiscal")).toHaveLength(1);
    expect(api.salvarLayout).not.toHaveBeenCalled();

    // Salvar: Fiscal sai (visivel:false, no fim), o resto segue na ordem.
    await press(tree, "painel-adicionar-bloco");
    await press(tree, "catalogo-item-fiscal");
    await press(tree, "catalogo-salvar");
    expect(api.salvarLayout).toHaveBeenCalledTimes(1);
    const corpo = api.salvarLayout.mock.calls[0][0] as { id: string; visivel: boolean }[];
    // 16: o layout do backend já conhece o Check-in (#835), que o hoje gravado ainda não traz.
    expect(corpo).toHaveLength(16);
    expect(corpo[corpo.length - 1]).toEqual({ id: "fiscal", visivel: false });
    expect(corpo.filter((b) => b.visivel).map((b) => b.id)).toEqual(
      IDS.slice(0, 5).concat(["checkin"], IDS.slice(5)).filter((id) => id !== "fiscal")
    );
    expect(corpo.map((b) => b.id)).not.toContain("nps");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(0);
    expect(byTestId(tree, "bloco-fiscal")).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith("Painel salvo.");

    // Ligar de novo: entra no fim da lista de visíveis.
    await press(tree, "painel-abrir-catalogo");
    await press(tree, "catalogo-item-fiscal");
    await press(tree, "catalogo-salvar");
    const corpo2 = api.salvarLayout.mock.calls[1][0] as { id: string; visivel: boolean }[];
    expect(corpo2.every((b) => b.visivel)).toBe(true);
    expect(corpo2[corpo2.length - 1].id).toBe("fiscal");
    expect(byTestId(tree, "bloco-fiscal")).toHaveLength(1);
    tree.unmount();
  });

  it("se o PUT /layout falha, o modal continua aberto e avisa", async () => {
    api.salvarLayout.mockRejectedValueOnce(new Error("400"));
    const tree = await mount();
    await press(tree, "painel-abrir-catalogo");
    await press(tree, "catalogo-item-contatos");
    await press(tree, "catalogo-salvar");
    expect(byTestId(tree, "catalogo-modal")).toHaveLength(1);
    expect(byTestId(tree, "bloco-contatos")).toHaveLength(1);   // nada mudou na tela
    expect(toast.error).toHaveBeenCalled();
    expect((toast.error as jest.Mock).mock.calls[0][0]).toContain("salvar");
    tree.unmount();
  });

  it("Reordenar fica desabilitado", async () => {
    const tree = await mount();
    expect(byTestId(tree, "painel-reordenar")[0].props.disabled).toBe(true);
    tree.unmount();
  });

  it("Recalcular chama POST /recalcular e recarrega o painel", async () => {
    const tree = await mount();
    expect(api.hoje).toHaveBeenCalledTimes(1);
    await press(tree, "painel-recalcular");
    await flush();
    expect(api.recalcular).toHaveBeenCalledTimes(1);
    expect(api.hoje).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Painel recalculado.");
    tree.unmount();
  });

  it("Recalcular com etapa que falhou avisa quantos erros; falha de rede também", async () => {
    api.recalcular.mockImplementationOnce(async () => ({ ...fx("recalcular"), ok: false, erros: [{ bloco: "fiscal" }] }));
    const tree = await mount();
    await press(tree, "painel-recalcular");
    expect((toast.error as jest.Mock).mock.calls[0][0]).toContain("1 erro");

    api.recalcular.mockRejectedValueOnce(new Error("timeout"));
    await press(tree, "painel-recalcular");
    expect((toast.error as jest.Mock).mock.calls[1][0]).toContain("Não consegui recalcular");
    tree.unmount();
  });
});

describe("Gestão Aura › Hoje — fallback de desenvolvimento", () => {
  it("com a constante ligada (e __DEV__) usa os dados estáticos, sem chamar a API, e avisa", async () => {
    PAINEL_FALLBACK_DEV.dadosDeExemplo = true;
    (global as any).__DEV__ = true;
    const tree = await mount();
    expect(api.hoje).not.toHaveBeenCalled();
    expect(api.layout).not.toHaveBeenCalled();
    expect(text(tree)).toContain("dados de exemplo");
    expect(text(tree)).toContain("Sheid Mania vence amanhã");
    for (const b of PAINEL_HOJE.blocos) expect(byTestId(tree, "bloco-" + b.id)).toHaveLength(1);

    await press(tree, "bloco-expandir-trials_degrau");
    expect(api.bloco).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Infortech Group");

    await press(tree, "painel-recalcular");
    expect(api.recalcular).not.toHaveBeenCalled();
    expect((toast.info as jest.Mock).mock.calls.pop()[0]).toContain("exemplo");
    tree.unmount();
  });

  it("em produção (__DEV__ falso) a constante ligada não faz efeito", async () => {
    PAINEL_FALLBACK_DEV.dadosDeExemplo = true;
    (global as any).__DEV__ = false;
    const tree = await mount();
    expect(api.hoje).toHaveBeenCalledTimes(1);
    expect(text(tree)).not.toContain("dados de exemplo");
    expect(text(tree)).not.toContain("Sheid Mania");
    tree.unmount();
  });

  it("desligada (padrão), os dados estáticos nunca aparecem", async () => {
    expect(PAINEL_FALLBACK_DEV.dadosDeExemplo).toBe(false);
    const tree = await mount();
    expect(text(tree)).not.toContain("Sheid Mania");
    tree.unmount();
  });
});
