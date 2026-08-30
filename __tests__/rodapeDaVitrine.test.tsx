// ============================================================
// O rodapé da vitrine DESENHA, não decide.
//
// Como pagar e o que acontece se a peça não servir. A loja comum ganhou
// esse rodapé em 24/08; a vitrine tinha ficado sem.
//
// O risco de portar era copiar o cálculo: um dia a loja comum diria
// "Pix · Cartão" e a vitrine só "Pix", e ninguém perceberia — as duas
// telas nunca são olhadas juntas. Por isso o conteúdo chega pronto do
// backend (`store.rodape_institucional`) e estes testes guardam que a
// vitrine não remonta nada.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";

import { RodapeInstitucional } from "@/components/studio/storefront/RodapeInstitucional";

function nos(a: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(a);
  return out;
}
const porTestId = (a: any, id: string) =>
  nos(a).filter((n) => n.props && n.props["data-testid"] === id);
const textoDe = (a: any, id: string) =>
  porTestId(a, id).flatMap((n) => n.children).filter((c: any) => typeof c === "string").join("");

const cores = { corDoTexto: "#111", corFraca: "#666", corDaLinha: "#eee" };
const render = (rodape: any) =>
  renderer.create(<RodapeInstitucional rodape={rodape} {...cores} />).toJSON();

describe("desenha o que o backend mandou", () => {
  test("junta as formas com ' · ', igual à loja comum", () => {
    const a = render({ formas: ["Pix", "Cartão de crédito e débito"], politica: "" });
    expect(textoDe(a, "rodape-formas")).toBe("Pix · Cartão de crédito e débito");
  });

  test("mostra a política que veio, sem reescrever", () => {
    const a = render({ formas: [], politica: "Troca em 30 dias." });
    expect(textoDe(a, "rodape-politica")).toBe("Troca em 30 dias.");
  });

  test("título da política vem do payload, com queda para o padrão", () => {
    const a = render({ formas: [], politica: "x", politica_titulo: "Devoluções" });
    expect(JSON.stringify(a)).toContain("Devoluções");
    const b = render({ formas: [], politica: "x" });
    expect(JSON.stringify(b)).toContain("Trocas e devoluções");
  });
});

describe("não desenha bloco vazio", () => {
  test("payload antigo (sem o campo) não renderiza nada", () => {
    // Cache do payload anterior ao backend #632, ou base velha. Um bloco
    // com dois títulos e nenhum texto seria pior que rodapé nenhum.
    expect(render(undefined)).toBeNull();
    expect(render(null)).toBeNull();
    expect(render({})).toBeNull();
  });

  test("loja sem pagamento configurado não mostra 'Formas de pagamento'", () => {
    const a = render({ formas: [], politica: "Alguma política." });
    expect(porTestId(a, "rodape-formas")).toHaveLength(0);
    expect(JSON.stringify(a)).not.toContain("Formas de pagamento");
  });

  test("política em branco não vira bloco", () => {
    const a = render({ formas: ["Pix"], politica: "   " });
    expect(porTestId(a, "rodape-politica")).toHaveLength(0);
  });

  test("formas que não são lista não quebram a vitrine", () => {
    expect(render({ formas: "Pix", politica: "" })).toBeNull();
  });
});

describe("a vitrine não recalcula o que o backend já resolveu", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "components/studio/storefront/RodapeInstitucional.tsx"),
    "utf8"
  );

  test("não conhece has_pix, has_card nem o texto do CDC", () => {
    // Se aparecer qualquer um destes aqui, a vitrine voltou a decidir —
    // e é assim que as duas lojas divergem.
    for (const proibido of ["has_pix", "has_card", "pay_on_delivery", "7 dias corridos"]) {
      expect(fonte).not.toContain(proibido);
    }
  });

  test("a tela passa o campo do payload, sem montar a lista", () => {
    const lista = fs.readFileSync(
      path.join(__dirname, "..", "components/studio/storefront/ProductList.tsx"),
      "utf8"
    );
    expect(lista).toContain("rodape_institucional");
    expect(lista).not.toContain("Cartão de crédito e débito");
  });
});
