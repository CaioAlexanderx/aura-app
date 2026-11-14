// ============================================================
// Nomes de cor para conferir (CP5 da revisão de cores, 14/11/2026)
//
// Aviso + modal no Estoque. Nada é gravado sem o toque da lojista;
// "Confirmar todas" só leva as sugestões únicas da paleta (decisão 4);
// nome inteiro em maiúsculas só é sugerido (decisão 5).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text, TextInput } from "react-native";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({ ResponsiveSheet: ({ children }: any) => children }));
let mockDados: any = null;
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockDados, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
const mockConfirmar = jest.fn();
jest.mock("@/services/coresParaConferirApi", () => ({
  coresParaConferirApi: { listar: jest.fn(), confirmar: (...a: any[]) => mockConfirmar(...a) },
}));

import { ConferirNomesDeCor, ModalDeConferencia } from "@/components/screens/estoque/nomesDeCor/ConferirNomesDeCor";
import { gruposDoConfirmarTodas, itensParaGravar, etiquetaHojeEDepois, deOndeVem } from "@/components/screens/estoque/nomesDeCor/regrasDaConferencia";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const item = (pid: string, hex: string) => ({ product_id: pid, product_name: "Peça", company_id: "c1", hex });
const AZUL: any = { chave: "cortado:AZUL ESCUR", pedaco: "AZUL ESCUR", tipo: "cortado", hex: "#1F2A44", hoje: "Cinza escuro", variantes: 14, produtos: 2,
  itens: [item(P1, "#1F2A44"), item(P2, "#1F2A44")], sugestao: { nome: "Azul escuro", fonte: "paleta" }, opcoes: [], unica_da_paleta: true };
const CINZA: any = { chave: "cortado:CINZA MESC", pedaco: "CINZA MESC", tipo: "cortado", hex: "#8E9196", hoje: "Cinza", variantes: 8, produtos: 1,
  itens: [item(P1, "#8E9196")], sugestao: { nome: "Cinza Mescla", fonte: "loja" }, opcoes: [], unica_da_paleta: false };
const MARROM: any = { chave: "cortado:MARROM CAF", pedaco: "MARROM CAF", tipo: "cortado", hex: "#5A3A29", hoje: "Marrom", variantes: 6, produtos: 1,
  itens: [item(P2, "#5A3A29")], sugestao: null, opcoes: ["Marrom Café", "Marrom Cafeína"], unica_da_paleta: false };
const OFF: any = { chave: "maiusculo:OFF WHITE", pedaco: "OFF WHITE", tipo: "maiusculo", hex: "#FAF9F6", hoje: "Off white", variantes: 3, produtos: 1,
  itens: [item(P1, "#FAF9F6")], sugestao: { nome: "Off white", fonte: "paleta" }, opcoes: [], unica_da_paleta: false };
const GRUPOS = [AZUL, CINZA, MARROM, OFF];

function textoDe(node: any): string {
  return node.findAllByType(Text).map((t: any) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  }).join(" ");
}
const porRotulo = (tree: any, r: string) => tree.root.findAll((n: any) => n.type === Pressable && n.props.accessibilityLabel === r)[0];
const campo = (tree: any, r: string) => tree.root.findAll((n: any) => n.type === TextInput && n.props.accessibilityLabel === r)[0];
const porId = (tree: any, id: string) => tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
async function montar(el: React.ReactElement) {
  let tree: any;
  await act(async () => { tree = renderer.create(el); });
  return tree;
}

beforeEach(() => { mockConfirmar.mockReset().mockResolvedValue({ variantes: 1, itens: 1, recusados: 0 }); mockDados = null; });

describe("regras", () => {
  test("'Confirmar todas' só leva sugestão única da paleta, e só o que falta", () => {
    expect(gruposDoConfirmarTodas(GRUPOS, new Set()).map((g) => g.pedaco)).toEqual(["AZUL ESCUR"]);
    expect(gruposDoConfirmarTodas(GRUPOS, new Set([AZUL.chave]))).toEqual([]);
  });
  test("itens: um por produto e cor, com o nome dela; vazio não manda nada", () => {
    expect(itensParaGravar(AZUL, " Azul escuro ")).toEqual([
      { product_id: P1, hex: "#1F2A44", nome: "Azul escuro" },
      { product_id: P2, hex: "#1F2A44", nome: "Azul escuro" },
    ]);
    expect(itensParaGravar(AZUL, "  ")).toEqual([]);
  });
  test("etiqueta: hoje e depois, pela regra da etiqueta", () => {
    expect(etiquetaHojeEDepois(AZUL, "Azul escuro")).toEqual({ hoje: "Cinza escuro", depois: "Azul escuro" });
    expect(etiquetaHojeEDepois(OFF, "Off White")).toEqual({ hoje: "Off white", depois: "Off White" });
  });
  test("de onde vem a sugestão", () => {
    expect(deOndeVem(CINZA)).toContain("outro produto");
    expect(deOndeVem(MARROM)).toContain("escolha um");
    expect(deOndeVem(OFF)).toContain("sem as maiúsculas");
  });
});

describe("aviso no Estoque", () => {
  test("some sem nada para conferir ou fora do Estoque comum", async () => {
    mockDados = { grupos: [] };
    let t = await montar(<ConferirNomesDeCor companyId="c1" ativo />);
    expect(porId(t, "aviso-nomes-de-cor")).toHaveLength(0);
    mockDados = { grupos: GRUPOS };
    t = await montar(<ConferirNomesDeCor companyId="c1" ativo={false} />);
    expect(porId(t, "aviso-nomes-de-cor")).toHaveLength(0);
  });
  test("aparece com a contagem e abre o modal; abrir não grava nada", async () => {
    mockDados = { grupos: GRUPOS };
    const t = await montar(<ConferirNomesDeCor companyId="c1" ativo />);
    expect(textoDe(porId(t, "aviso-nomes-de-cor")[0])).toContain("4 nomes de cor para conferir");
    await act(async () => { porRotulo(t, "Conferir os nomes de cor").props.onPress(); });
    expect(porId(t, "confirmar-todas")).toHaveLength(1);
    expect(mockConfirmar).not.toHaveBeenCalled();
  });
});

describe("modal", () => {
  test("'Confirmar todas' grava só a sugestão única da paleta", async () => {
    const t = await montar(<ModalDeConferencia companyId="c1" grupos={GRUPOS} onFechar={jest.fn()} />);
    await act(async () => { porRotulo(t, "Confirmar as sugestões únicas da paleta").props.onPress(); });
    expect(mockConfirmar).toHaveBeenCalledTimes(1);
    expect(mockConfirmar.mock.calls[0]).toEqual(["c1", [
      { product_id: P1, hex: "#1F2A44", nome: "Azul escuro" },
      { product_id: P2, hex: "#1F2A44", nome: "Azul escuro" },
    ]]);
    expect(textoDe(porId(t, "conferir-AZUL ESCUR")[0])).toContain("confirmado");
  });

  test("um por um, com o nome que ela escreveu ou escolheu", async () => {
    const t = await montar(<ModalDeConferencia companyId="c1" grupos={GRUPOS} onFechar={jest.fn()} />);
    await act(async () => { porRotulo(t, "Usar Marrom Café").props.onPress(); });
    await act(async () => { porRotulo(t, "Confirmar o nome de MARROM CAF").props.onPress(); });
    await act(async () => { campo(t, "Nome inteiro de OFF WHITE").props.onChangeText("Off White"); });
    await act(async () => { porRotulo(t, "Confirmar o nome de OFF WHITE").props.onPress(); });
    expect(mockConfirmar.mock.calls).toEqual([
      ["c1", [{ product_id: P2, hex: "#5A3A29", nome: "Marrom Café" }]],
      ["c1", [{ product_id: P1, hex: "#FAF9F6", nome: "Off White" }]],
    ]);
  });

  test("sem nome não confirma; 'Depois' não grava", async () => {
    const t = await montar(<ModalDeConferencia companyId="c1" grupos={[MARROM]} onFechar={jest.fn()} />);
    expect(porRotulo(t, "Confirmar o nome de MARROM CAF").props.disabled).toBe(true);
    await act(async () => { porRotulo(t, "Deixar MARROM CAF para depois").props.onPress(); });
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  test("mostra o que sai hoje e o que vai sair na etiqueta", async () => {
    const t = await montar(<ModalDeConferencia companyId="c1" grupos={[AZUL]} onFechar={jest.fn()} />);
    const txt = textoDe(porId(t, "conferir-AZUL ESCUR")[0]);
    expect(txt).toContain("Hoje — Caixa e nota: \"Cinza escuro\" · etiqueta: \"Cinza escuro\" → \"Azul escuro\"");
    expect(txt).toContain("14 variantes em 2 produtos");
  });
});
