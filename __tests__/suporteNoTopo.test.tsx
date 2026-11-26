// 26/11/2026 (Caio): a secao "Contabil" e a Reativacao saem da sidebar de todas
// as frentes; o Suporte vira um botao ao lado do sino. As rotas continuam.
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

const mockPush = jest.fn();
const mockVisible = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => mockVisible() }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({
  useColors: () => ({ bg3: "#fff", border: "#ddd", ink3: "#666" }),
}));

import { SuporteButton } from "@/components/SuporteButton";

const raiz = path.join(__dirname, "..");
const LAYOUT = fs.readFileSync(path.join(raiz, "app/(tabs)/_layout.tsx"), "utf8");

describe("botão Suporte ao lado do sino", () => {
  beforeEach(() => mockPush.mockClear());

  test("com o módulo suporte: aparece e leva a /suporte", () => {
    mockVisible.mockReturnValue(new Set(["painel", "suporte"]));
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SuporteButton />); });
    const btn = tree.root.findByProps({ testID: "suporte-button" });
    act(() => { btn.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/suporte");
  });

  test("sem o módulo suporte: não aparece", () => {
    mockVisible.mockReturnValue(new Set(["painel"]));
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SuporteButton />); });
    expect(tree.root.findAllByProps({ testID: "suporte-button" })).toHaveLength(0);
  });
});

describe("sidebar do Negócio sem Contabilidade, Seu Analista e Reativação", () => {
  const nav = LAYOUT.slice(LAYOUT.indexOf("const NAV: NavSection[] = ["));
  const corpo = nav.slice(0, nav.indexOf("\n];"));

  test("itens saíram do NAV", () => {
    expect(corpo).not.toContain('r: "/contabilidade"');
    expect(corpo).not.toContain('r: "/suporte"');
    expect(corpo).not.toContain('r: "/clientes/reativacao"');
    expect(corpo).not.toContain('s: "Contábil"');
  });

  test("Reativação saiu do Mais do celular", () => {
    const m = LAYOUT.match(/const MORE_PRIORIDADE = \[([^\]]+)\]/);
    expect(m![1]).not.toContain("reativacao");
  });

  test("o botão está nos três topos (celular web, desktop e nativo)", () => {
    expect((LAYOUT.match(/<SuporteButton/g) || []).length).toBe(3);
  });

  test("outras frentes: Dental e Studio sem Contabilidade na sidebar", () => {
    const dental = fs.readFileSync(path.join(raiz, "components/dental/DentalSidebar.tsx"), "utf8");
    const studio = fs.readFileSync(path.join(raiz, "components/studio/StudioShell/nav.ts"), "utf8");
    expect(dental).not.toContain('label: "Contabilidade"');
    expect(studio).not.toContain("label: 'Contabilidade'");
  });
});
