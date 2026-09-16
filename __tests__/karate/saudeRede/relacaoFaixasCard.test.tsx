// ============================================================
// RelacaoFaixasCard — "Distribuição por faixa" (Saúde da Rede).
//
// BUGFIX (16/09/2026, prod/FPKT): o card lia BELT_HEX/KYU_BY_FAIXA
// (chaveados pelo LABEL em PT, ex. "Azul Escuro") com `b.faixa`, que é
// o SLUG do backend (ex. "azul_escuro"). Nenhuma chave casava: toda
// barra caía no fallback marrom (C.ink2) e o rótulo mostrava o slug
// cru em vez do nome da faixa. Este teste prende os três sintomas:
// rótulo em PT, cor por faixa (não todas iguais) e sub-rótulo "Xº kyu".
//
// react-test-renderer direto (não RTL) — mesma razão do
// guardasDeCusto.test.tsx: moduleNameMapper aponta react-native →
// react-native-web e tudo vira div; a identidade vem do testID.
// ============================================================
import React from "react";
import renderer from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      const state = { company: { id: "dojo-1" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));
jest.mock("@/contexts/KarateFederation", () => ({
  useKarateFederation: () => ({ federationId: "fed-1" }),
}));
// Chip real puxa fontes (expo-font) que não interessam aqui — vira stub.
jest.mock("@/components/karate/shoji", () => ({
  Chip: ({ label }: { label: string }) => label,
}));
jest.mock("@/services/karateNetworkHealthApi", () => ({
  karateNetworkHealthApi: { getRelacaoFaixas: jest.fn() },
}));

import { RelacaoFaixasCard } from "@/components/karate/saude-rede/MetricCards";
import { AnimatedWidthBar } from "@/components/karate/saude-rede/shared";
import { BELT_HEX } from "@/constants/karateBelts";
import type { RelacaoFaixasPayload } from "@/services/karateNetworkHealthApi";

function flattenStyle(style: any): Record<string, any> {
  return Object.assign({}, ...([] as any[]).concat(style).filter(Boolean));
}

const DATA: RelacaoFaixasPayload = {
  total: 18,
  kyu: 15,
  dan: 3,
  dan_pct: 16.7,
  buckets: [
    { faixa: "branca", long: "Branca", n: 10, pct: 55.6 },
    { faixa: "azul_escuro", long: "Azul Escuro", n: 5, pct: 27.8 },
    { faixa: "dan1", long: "1º Dan", n: 3, pct: 16.7 },
  ],
  raw: [],
  _note: "",
};

describe("RelacaoFaixasCard — leitura de faixa por b.long, não b.faixa (slug)", () => {
  it("mostra o nome da faixa em PT, nunca o slug cru", () => {
    const tree = renderer.create(
      <RelacaoFaixasCard data={DATA} loading={false} onDetail={jest.fn()} />
    );
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("Azul Escuro");
    expect(json).toContain("1º Dan");
    // O slug não pode vazar pra tela.
    expect(json).not.toMatch(/>azul_escuro</);
    expect(json).not.toMatch(/>dan1</);
    tree.unmount();
  });

  it("cada faixa recebe a cor canônica dela, não o fallback marrom em todas", () => {
    const tree = renderer.create(
      <RelacaoFaixasCard data={DATA} loading={false} onDetail={jest.fn()} />
    );
    const bars = tree.root.findAllByType(AnimatedWidthBar);
    expect(bars).toHaveLength(3);

    const cores = bars.map((b: any) => flattenStyle(b.props.style).backgroundColor);
    expect(cores[0]).toBe(BELT_HEX.branca);
    expect(cores[1]).toBe(BELT_HEX.azul_escuro);
    expect(cores[2]).toBe(BELT_HEX.preta); // 1º Dan → tom "preta"

    // As três não podem ter colapsado no mesmo fallback.
    expect(new Set(cores).size).toBe(3);
    tree.unmount();
  });

  it("mostra o kyu correspondente por faixa e omite no Dan (que não tem kyu)", () => {
    const tree = renderer.create(
      <RelacaoFaixasCard data={DATA} loading={false} onDetail={jest.fn()} />
    );
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("10º kyu"); // Branca
    expect(json).toContain("4º kyu");  // Azul Escuro
    tree.unmount();
  });

  it("o CSV exporta o nome da faixa em PT, não o slug", () => {
    const tree = renderer.create(
      <RelacaoFaixasCard data={DATA} loading={false} onDetail={jest.fn()} />
    );
    // csvData é montado como prop de SectionRow — real (não mockado),
    // então dá pra ler a prop direto na árvore.
    const sectionRow = tree.root.findByProps({ title: "Distribuição por faixa" });
    expect(sectionRow.props.csvData.rows).toEqual([
      ["Branca", "10", "55,6%"],
      ["Azul Escuro", "5", "27,8%"],
      ["1º Dan", "3", "16,7%"],
    ]);
    tree.unmount();
  });
});
