// SpotlightTour generalizado (05/10/2026): escolha do alvo e caminho do
// tour pendente. O Odonto continua usando o mesmo componente.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { findTourTarget } from "@/components/onboarding/SpotlightTour";
import { normalizarPath } from "@/stores/pendingTour";
import { tourSelector } from "@/utils/tourTarget";
import { SpotlightTour as DentalSpotlightTour } from "@/components/dental/onboarding/SpotlightTour";

function el(tour: string, w: number, h: number) {
  const d = document.createElement("div");
  d.setAttribute("data-tour", tour);
  (d as any).getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 });
  document.body.appendChild(d);
  return d;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("findTourTarget", () => {
  it("vale o primeiro seletor com elemento visível", () => {
    el("studio.catalogo_novo", 0, 0); // botão do cabeçalho escondido no celular
    const fab = el("studio.fab", 56, 56);
    el("studio.titulo", 200, 30);
    const alvo = findTourTarget([tourSelector("studio.catalogo_novo"), tourSelector("studio.fab"), tourSelector("studio.titulo")]);
    expect(alvo).toBe(fab);
  });
  it("nenhum visível: null (o tour cai no tooltip central)", () => {
    el("x", 0, 0);
    expect(findTourTarget([tourSelector("x"), tourSelector("y")])).toBeNull();
  });
});

describe("normalizarPath", () => {
  it("tira query e barra final", () => {
    expect(normalizarPath("/estoque?x=1")).toBe("/estoque");
    expect(normalizarPath("/studio/producao/")).toBe("/studio/producao");
    expect(normalizarPath("/")).toBe("/");
  });
});

describe("SpotlightTour do Odonto (wrapper)", () => {
  it("continua com contador e 'Pular tour' no passo sem alvo", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DentalSpotlightTour open onComplete={jest.fn()} onSkip={jest.fn()}
          steps={[{ id: "a", title: "Bem-vindo", body: "Oi" }, { id: "b", title: "Agenda", body: "Aqui" }]} />,
      );
    });
    const txt = JSON.stringify(tree.toJSON());
    expect(txt).toContain("Pular tour");
    expect(txt).toContain("Bem-vindo");
    expect(txt).toContain("Próximo");
    tree.unmount();
  });
});
