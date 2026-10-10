// ============================================================
// Kata por notas: classificar a eliminatória para a final (QA 10/10/2026).
//
// Três achados do QA de Competições que este bloco guarda:
//   1. Só a mesa pública montava a final — o bloco virou componente
//      compartilhado (KataAdvanceCard) usado também no Modo Mesário e no
//      painel da categoria.
//   2. O padrão do N vinha min(8, total): bateria de 6 → "classificar os
//      6", final com todo mundo. Agora é metade (mín. 2, máx. 8).
//   3. Um ausente sem nota travava a final para sempre: "eliminatória
//      completa" exigia nota de TODOS. Ausente confirmado (no_show) não
//      conta mais — o backend o elimina no avanço e devolve `absent`.
//
// react-test-renderer direto (moduleNameMapper aponta react-native →
// react-native-web, tudo vira div); Icon mockado como nos outros testes.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import {
  KataAdvanceCard, defaultAdvanceCount, isKataElimComplete, advanceSuccessMessage,
} from "@/components/karate/chaves/KataAdvanceCard";
import type { KataScore } from "@/services/karateBracketsApi";

function row(id: string, nota: number | null, extra: Partial<KataScore> = {}): KataScore {
  return {
    entry_id: id, student_name: `Atleta ${id}`, dojo_name: null, phase: "eliminatoria",
    nota, notas: null, presentation_order: null, advances: null, ...extra,
  };
}

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}

describe("defaultAdvanceCount", () => {
  test("bateria de 6 classifica 3, não os 6", () => {
    expect(defaultAdvanceCount(6)).toBe(3);
  });
  test("nunca menos que 2 nem mais que 8", () => {
    expect(defaultAdvanceCount(2)).toBe(2);
    expect(defaultAdvanceCount(3)).toBe(2);
    expect(defaultAdvanceCount(20)).toBe(8);
  });
});

describe("isKataElimComplete", () => {
  test("ausente confirmado sem nota não trava", () => {
    expect(isKataElimComplete([row("a", 21), row("b", 20.5), row("c", null, { no_show: true })])).toBe(true);
  });
  test("presente sem nota trava", () => {
    expect(isKataElimComplete([row("a", 21), row("b", null)])).toBe(false);
  });
  test("não credenciado (checked_in:false, no_show:false) NÃO é ausente", () => {
    expect(isKataElimComplete([row("a", 21), row("b", null, { checked_in: false, no_show: false })])).toBe(false);
  });
  test("só ausentes = nada a classificar", () => {
    expect(isKataElimComplete([row("a", null, { no_show: true })])).toBe(false);
  });
});

describe("advanceSuccessMessage", () => {
  test("cita os ausentes eliminados automaticamente", () => {
    expect(advanceSuccessMessage({ advanced: 3, eliminated: 3, advancing_entry_ids: [], absent: 1 }))
      .toBe("3 atletas classificados para a final. 1 ausente eliminado automaticamente.");
  });
  test("sem ausentes, não fala deles", () => {
    expect(advanceSuccessMessage({ advanced: 1, eliminated: 1, advancing_entry_ids: [] }))
      .toBe("1 atleta classificado para a final.");
  });
});

describe("KataAdvanceCard", () => {
  const advance = jest.fn();

  test("aparece com um ausente na bateria e sugere metade dos que têm nota", () => {
    const scores = [
      row("a", 22), row("b", 21.5), row("c", 21), row("d", 20.5), row("e", 20), row("f", 19.5),
      row("g", null, { no_show: true }),
    ];
    let arvore: renderer.ReactTestRenderer;
    act(() => { arvore = renderer.create(<KataAdvanceCard scores={scores} advance={advance} />); });
    const texto = textoDe(arvore!.toJSON());
    expect(texto).toContain("Eliminatória completa");
    expect(texto).toContain("Classificar os 3 melhores para a final");
  });

  test("some quando um presente ainda está sem nota", () => {
    let arvore: renderer.ReactTestRenderer;
    act(() => { arvore = renderer.create(<KataAdvanceCard scores={[row("a", 22), row("b", null)]} advance={advance} />); });
    expect(arvore!.toJSON()).toBeNull();
  });

  test("some quando a final já existe", () => {
    const scores = [row("a", 22), row("b", 21), row("a", null, { phase: "final" })];
    let arvore: renderer.ReactTestRenderer;
    act(() => { arvore = renderer.create(<KataAdvanceCard scores={scores} advance={advance} />); });
    expect(arvore!.toJSON()).toBeNull();
  });
});
