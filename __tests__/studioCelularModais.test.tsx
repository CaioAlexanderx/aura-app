// ============================================================
// Studio no celular, etapa 4: modais (05/10/2026)
//
// Uma regra para todo modal abaixo de 768 px (components/studio/
// modalNoCelular.tsx):
//   1. rodapé com no máximo 2 botões, de 44 px, com área segura;
//   2. cabeçalho de uma linha, sem o bloco em gradiente;
//   3. nada de foco automático que abra o teclado ao entrar;
//   4. SKU e URL da foto atrás de "Mais opções";
//   5. no desktop nada disso vale.
//
// O modal do orçamento tem os mocks dele em studio/orcamentoModal.test.tsx;
// aqui ficam as regras puras, o "Novo produto", a folha "Cliente pediu
// ajuste" e o StudioWorkflow (aprovação de arte).
//
// react-native vira componentes-string (padrão dos testes de tela).
// ============================================================
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

let mockLargura = 375;
jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", Modal: "Modal",
  TextInput: "TextInput", Image: "Image", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s, absoluteFillObject: {} }, Platform: { OS: "web" },
  Linking: { openURL: jest.fn() },
  useWindowDimensions: () => ({ width: mockLargura, height: 812 }),
}));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockTokens = {
  primary: "#1E3A8A", primary2: "#3B82F6", primarySoft: "#DBEAFE", primaryGhost: "#EFF6FF",
  accent: "#EC4899", accentSoft: "#FCE7F3", accentInk: "#BE185D", bg: "#E8E9F0",
  bgSoft: "#EEF0F5", paperCard: "#F5F6FA", paperCardElev: "#FFF", mint: "#10B981", mintSoft: "#D1FAE5",
  ink: "#0F172A", ink2: "#334155", ink3: "#5E6A7A", ink4: "#94A3B8", ink5: "#CBD5E1",
  success: "#10B981", danger: "#DC2626", dangerInk: "#991B1B",
};
jest.mock("@/contexts/StudioThemeMode", () => ({
  useStudioTokens: () => mockTokens,
  useStudioTheme: () => ({ tokens: mockTokens, isDark: false }),
}));
jest.mock("@/components/studio/StudioGradient", () => ({ StudioGradient: "StudioGradient" }));
const mockRequest = jest.fn(async (..._a: any[]) => ({ id: "prod-1" }));
jest.mock("@/services/api", () => ({ request: (...a: any[]) => mockRequest(...a) }));
jest.mock("@/services/studioApi", () => ({
  studioApi: { listProductCategories: jest.fn(async () => ({ categories: [] })), createProductCategory: jest.fn() },
}));
jest.mock("@/services/studioUploadApi", () => ({ pickImageBase64: jest.fn(), uploadStudioMockup: jest.fn() }));

import {
  ALVO_DE_TOQUE, LARGURA_DO_CELULAR, MAX_BOTOES_NO_RODAPE, ehCelular, focoAutomatico, rodapeNoCelular,
} from "@/components/studio/modalNoCelularRegras";
import { botaoDoRodape, folhaDeBaixo, rodapeFixo, telaCheia } from "@/components/studio/modalNoCelular";
import {
  acoesDoRodape, acoesNoCelular, rotuloNoCelular, type EstadoDoOrcamento,
} from "@/components/studio/orcamentoModal/regras";
import { StudioNewProductWizard } from "@/components/studio/StudioNewProductWizard";
import { PedidoDeAjusteModal } from "@/components/studio/orcamentoVideo/PedidoDeAjusteModal";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";

const porId = (r: TestRenderer.ReactTestRenderer, id: string) =>
  r.root.findAll((n) => n.props.testID === id && typeof n.type === "string");
const um = (r: TestRenderer.ReactTestRenderer, id: string) => porId(r, id)[0];
/** O estilo achatado: os modais somam a regra do celular num array. */
const plano = (estilo: any): any => Object.assign({}, ...[estilo].flat(Infinity as any).filter(Boolean));
const textos = (n: any): string =>
  n.findAll((x: any) => x.type === "Text").map((x: any) => (Array.isArray(x.props.children) ? x.props.children.join("") : String(x.props.children ?? ""))).join(" | ");
const botoes = (n: any) => n.findAll((x: any) => x.type === "Pressable");
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => { mockLargura = 375; mockRequest.mockClear(); });

// ─── Regras puras ───────────────────────────────────────────
describe("regra do modal no celular", () => {
  test("celular é abaixo de 768 px, a mesma largura do shell", () => {
    expect(LARGURA_DO_CELULAR).toBe(768);
    expect(ehCelular(375)).toBe(true);
    expect(ehCelular(767)).toBe(true);
    expect(ehCelular(768)).toBe(false);
    expect(focoAutomatico(true)).toBe(false);
    expect(focoAutomatico(false)).toBe(true);
  });

  test("orçamento: nenhum estado passa de dois botões no rodapé, e nada some sem ter para onde ir", () => {
    const estados: EstadoDoOrcamento[] = ["novo", "rascunho", "ajuste", "enviado", "aceito", "aprovado", "encerrado"];
    for (const e of estados) {
      for (const catalogoAberto of [false, true]) {
        const todas = acoesDoRodape(e, { temPecas: true, catalogoAberto, temPedido: true });
        const c = acoesNoCelular(todas);
        const noRodape = [c.secundaria, c.primaria].filter(Boolean);
        expect(noRodape.length).toBeLessThanOrEqual(MAX_BOTOES_NO_RODAPE);
        expect(noRodape.length).toBeGreaterThan(0);
        // Só o que apenas fecha o modal pode sair (o X do cabeçalho faz isso).
        const fora = todas.filter((a) => !noRodape.includes(a) && !c.resto.includes(a));
        expect(fora.every((a) => a.id === "cancelar" || a.id === "fechar")).toBe(true);
      }
    }
  });

  test("orçamento: rascunho fica com Salvar e Enviar; enviado manda Fechar sem venda para o corpo", () => {
    const rascunho = acoesNoCelular(acoesDoRodape("rascunho", { temPecas: true, catalogoAberto: false }));
    expect([rascunho.secundaria?.id, rascunho.primaria?.id]).toEqual(["salvar", "enviar"]);
    expect(rascunho.resto).toEqual([]);

    const enviado = acoesNoCelular(acoesDoRodape("enviado", { temPecas: true, catalogoAberto: false }));
    expect([enviado.secundaria?.id, enviado.primaria?.id]).toEqual(["ajuste", "aprovar"]);
    expect(enviado.resto.map((a) => a.id)).toEqual(["fechar_sem_venda"]);

    const ajuste = acoesNoCelular(acoesDoRodape("ajuste", { temPecas: true, catalogoAberto: false }));
    expect([ajuste.secundaria?.id, ajuste.primaria?.id]).toEqual(["salvar", "enviar"]);
    expect(ajuste.resto.map((a) => a.id)).toEqual(["fechar_sem_venda"]);

    // Sem primário, o "Fechar" continua sendo o botão.
    const encerrado = acoesNoCelular(acoesDoRodape("encerrado", { temPecas: true, catalogoAberto: false }));
    expect([encerrado.secundaria?.id, encerrado.primaria]).toEqual(["fechar", null]);
  });

  test("orçamento: rótulos que cabem em meia largura", () => {
    const de = (e: EstadoDoOrcamento) => acoesDoRodape(e, { temPecas: true, catalogoAberto: false }).map(rotuloNoCelular);
    expect(de("rascunho")).toEqual(["Cancelar", "Salvar", "Enviar no WhatsApp"]);
    expect(de("ajuste")).toContain("Reenviar no WhatsApp");
    expect(de("enviado")).toEqual(["Fechar sem venda", "Pediu ajuste", "Aprovar"]);
  });

  test("regra genérica: sem prefereSecundaria fica a primeira ação útil", () => {
    const r = rodapeNoCelular(["sair", "a", "b", "ok"], { ehPrimaria: (x) => x === "ok", soFecha: (x) => x === "sair" });
    expect(r).toEqual({ primaria: "ok", secundaria: "a", resto: ["b"] });
  });

  test("casca: folha de baixo e tela cheia só existem no celular", () => {
    expect(folhaDeBaixo(false)).toEqual({ fundo: null, caixa: null });
    expect(telaCheia(false)).toEqual({ fundo: null, caixa: null });
    expect(rodapeFixo(false)).toBeNull();
    expect(botaoDoRodape(false)).toBeNull();

    const folha = folhaDeBaixo(true);
    expect(folha.fundo).toMatchObject({ justifyContent: "flex-end", padding: 0 });
    expect(folha.caixa).toMatchObject({ width: "100%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 });
    expect(String(folha.caixa.paddingBottom)).toContain("safe-area-inset-bottom");

    const cheia = telaCheia(true);
    expect(cheia.fundo.padding).toBe(0);
    expect(cheia.caixa).toMatchObject({ flex: 1, borderRadius: 0 });

    expect(String(rodapeFixo(true).paddingBottom)).toContain("safe-area-inset-bottom");
    expect(botaoDoRodape(true).minHeight).toBe(ALVO_DE_TOQUE);
  });
});

// ─── Novo produto ───────────────────────────────────────────
describe("Novo produto", () => {
  async function montar() {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<StudioNewProductWizard visible onClose={jest.fn()} companyId="emp-1" />);
    });
    await esperar();
    return r;
  }

  test("celular: cabeçalho de uma linha, sem o gradiente nem o texto de 3 linhas", async () => {
    const r = await montar();
    expect(porId(r, "novo-produto-cabecalho")).toHaveLength(1);
    expect(r.root.findAll((n) => (n.type as any) === "StudioGradient")).toHaveLength(0);
    const cab = um(r, "novo-produto-cabecalho");
    expect(textos(cab)).toBe("Novo produto");
    expect(cab.findAll((x: any) => x.type === "Text")[0].props.numberOfLines).toBe(1);
    expect(textos(um(r, "novo-produto"))).not.toContain("ficam a 1 clique");
    // O fechar tem 44 px.
    expect(um(r, "novo-produto-cabecalho-fechar").props.style.width).toBe(44);
  });

  test("celular: o nome não puxa o foco (o teclado não abre ao entrar)", async () => {
    const r = await montar();
    expect(um(r, "novo-produto-nome").props.autoFocus).toBe(false);
  });

  test("celular: SKU e URL da foto ficam atrás de Mais opções", async () => {
    const r = await montar();
    expect(porId(r, "novo-produto-sku")).toHaveLength(0);
    expect(porId(r, "novo-produto-url-da-foto")).toHaveLength(0);
    expect(textos(um(r, "novo-produto"))).not.toContain("URL");

    await act(async () => { um(r, "novo-produto-mais-opcoes").props.onPress(); });
    expect(porId(r, "novo-produto-sku")).toHaveLength(1);
    expect(porId(r, "novo-produto-url-da-foto")).toHaveLength(1);
    expect(um(r, "novo-produto-mais-opcoes").props["aria-expanded"]).toBe(true);
  });

  test("celular: rodapé com dois botões de 44 px e área segura", async () => {
    const r = await montar();
    const rodape = um(r, "novo-produto-rodape");
    const bs = botoes(rodape);
    expect(bs).toHaveLength(2);
    bs.forEach((b: any) => expect(plano(b.props.style).minHeight).toBe(44));
    expect(String(plano(rodape.props.style).paddingBottom)).toContain("safe-area-inset-bottom");
    // Ocupa a tela toda.
    expect(plano(um(r, "novo-produto").props.style)).toMatchObject({ width: 375, height: 812, borderRadius: 0 });
  });

  test("celular: o SKU digitado em Mais opções continua indo no cadastro", async () => {
    const r = await montar();
    await act(async () => { um(r, "novo-produto-nome").props.onChangeText("Caneca"); });
    await act(async () => { r.root.findAll((n) => (n.type as any) === "TextInput" && n.props.placeholder === "0,00")[0].props.onChangeText("39,90"); });
    await act(async () => { um(r, "novo-produto-mais-opcoes").props.onPress(); });
    await act(async () => { um(r, "novo-produto-sku").props.onChangeText("CAN-01"); });
    await act(async () => { um(r, "novo-produto-url-da-foto").props.onChangeText("https://x/y.png"); });
    await act(async () => { um(r, "novo-produto-criar").props.onPress(); });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][0]).toBe("/companies/emp-1/products");
    expect(mockRequest.mock.calls[0][1].body).toEqual({ name: "Caneca", description: undefined, price: 39.9, sku: "CAN-01", image_url: "https://x/y.png" });
  });

  test("desktop: o gradiente, o foco no nome, o SKU e a URL à vista, como sempre", async () => {
    mockLargura = 1280;
    const r = await montar();
    expect(r.root.findAll((n) => (n.type as any) === "StudioGradient")).toHaveLength(1);
    expect(porId(r, "novo-produto-cabecalho")).toHaveLength(0);
    expect(um(r, "novo-produto-nome").props.autoFocus).toBe(true);
    expect(porId(r, "novo-produto-sku")).toHaveLength(1);
    expect(porId(r, "novo-produto-url-da-foto")).toHaveLength(1);
    expect(porId(r, "novo-produto-mais-opcoes")).toHaveLength(0);
    expect(textos(um(r, "novo-produto"))).toContain("Ou cole uma URL pública abaixo");
    expect(plano(um(r, "novo-produto-rodape").props.style).paddingBottom).toBeUndefined();
  });
});

// ─── Cliente pediu ajuste ───────────────────────────────────
describe("Cliente pediu ajuste", () => {
  const montar = () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <PedidoDeAjusteModal visible t={mockTokens as any} versao={2} onClose={jest.fn()} onConfirmar={jest.fn(async () => true)} />,
      );
    });
    return r;
  };

  test("celular: ajuda de uma linha, sem foco automático, dois botões", () => {
    const r = montar();
    expect(um(r, "folha-ajuste-ajuda").props.numberOfLines).toBe(1);
    expect(um(r, "folha-ajuste-texto").props.autoFocus).toBe(false);
    expect(um(r, "folha-ajuste-fechar").props.style.width).toBe(44);
    // Fechar (X) + Cancelar + Registrar: dois botões de ação.
    expect(botoes(um(r, "folha-ajuste"))).toHaveLength(3);
    expect(String(plano(um(r, "folha-ajuste").props.style).paddingBottom)).toContain("safe-area-inset-bottom");
  });

  test("desktop: o texto completo e o foco no campo", () => {
    mockLargura = 1280;
    const r = montar();
    expect(porId(r, "folha-ajuste-ajuda")).toHaveLength(0);
    expect(textos(um(r, "folha-ajuste"))).toContain("Só você vê esta anotação.");
    expect(um(r, "folha-ajuste-texto").props.autoFocus).toBe(true);
  });
});

// ─── StudioWorkflow (aprovação de arte, pedido em lote) ─────
describe("StudioWorkflow", () => {
  const montar = (passo: number) => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <StudioWorkflow
          title="Solicitar aprovação — #1042"
          steps={["Mockup", "Confirmar e enviar"]}
          current={passo}
          onBack={passo > 1 ? jest.fn() : undefined}
          onNext={jest.fn()}
          onConcluir={jest.fn()}
          onClose={jest.fn()}
        >
          {null}
        </StudioWorkflow>,
      );
    });
    return r;
  };

  test("celular: título de uma linha, o X na mesma linha e sem a régua de passos", () => {
    const r = montar(1);
    expect(um(r, "workflow-titulo").props.numberOfLines).toBe(1);
    expect(porId(r, "workflow-fechar")).toHaveLength(1);
    expect(um(r, "workflow-fechar").props.style.width).toBe(44);
    // A régua repetia "Mockup" e "Confirmar e enviar"; a sobrelinha já diz o passo.
    expect(textos(r.root)).toContain("Passo 1 de 2 · Mockup");
    expect(textos(r.root)).not.toContain("Confirmar e enviar");
  });

  test("celular: rodapé com no máximo dois botões de 44 px", () => {
    const um1 = montar(1);
    expect(botoes(um(um1, "workflow-rodape"))).toHaveLength(1);
    const r = montar(2);
    const bs = botoes(um(r, "workflow-rodape"));
    expect(bs).toHaveLength(2);
    bs.forEach((b: any) => expect(plano(b.props.style).minHeight).toBe(44));
    expect(String(plano(um(r, "workflow-rodape").props.style).paddingBottom)).toContain("safe-area-inset-bottom");
  });

  test("desktop: a régua de passos continua e o X não entra no cabeçalho", () => {
    mockLargura = 1280;
    const r = montar(1);
    expect(porId(r, "workflow-fechar")).toHaveLength(0);
    expect(textos(r.root)).toContain("Confirmar e enviar");
    expect(um(r, "workflow-titulo").props.numberOfLines).toBeUndefined();
  });
});
