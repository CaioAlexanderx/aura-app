// ============================================================
// Ficha do crediário · faixa "também deve na outra loja" (16/09/2026)
//
// Cobre:
//   - sem saldo em outra loja, a faixa não aparece
//   - com saldo, mostra nome, valor e loja; botão com o nome curto
//   - o botão só aparece para a loja que o usuário pode abrir
//   - clicar chama a troca com a loja certa; "Abrindo…" desabilita
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// Icon puxa react-native-svg, que não carrega no Jest.
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { GrupoEmAberto } from "@/components/crediario/ficha/GrupoEmAberto";

const MATRIZ = "08c05f0e-b75b-4c12-870e-d7fb65f1dca0";
const VILLA = "ea68b4d2-f051-46b1-9ac5-b8438c6cd5fc";
const LOJAS = [{ company_id: VILLA, company_name: "Davi Calçados Villa Branca", balance: 179.99 }];

function texto(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

function nos(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json.flatMap(nos);
  return [json, ...(json.children || []).flatMap((c: any) => (typeof c === "string" ? [] : nos(c)))];
}
const porTestId = (json: any, id: string) => nos(json).filter((n) => n.props?.["data-testid"] === id);

function montar(props: Partial<React.ComponentProps<typeof GrupoEmAberto>> = {}) {
  let t: renderer.ReactTestRenderer;
  act(() => {
    t = renderer.create(
      <GrupoEmAberto
        name="Mary Lucy"
        lojas={LOJAS}
        storeName="Davi Calçados Matriz"
        acessiveis={new Set([MATRIZ, VILLA])}
        onAbrirNaLoja={jest.fn()}
        {...props}
      />,
    );
  });
  return t!;
}

describe("GrupoEmAberto", () => {
  it("sem saldo em outra loja, não renderiza nada", () => {
    expect(montar({ lojas: [] }).toJSON()).toBeNull();
  });

  it("mostra nome, valor e loja, com botão pelo nome curto", () => {
    const json = montar().toJSON();
    const t = texto(json);
    expect(t).toContain("Mary Lucy também deve");
    expect(t).toMatch(/179,99/);
    expect(t).toContain("Davi Calçados Villa Branca");
    expect(t).toContain("Abrir na Villa Branca");
    expect(porTestId(json, `abrir-na-loja-${VILLA}`).length).toBeGreaterThan(0);
  });

  it("sem acesso à outra loja, explica e não mostra o botão", () => {
    const json = montar({ acessiveis: new Set([MATRIZ]) }).toJSON();
    expect(porTestId(json, `abrir-na-loja-${VILLA}`)).toHaveLength(0);
    expect(texto(json)).toContain("por quem tem acesso àquela loja");
  });

  it("clicar troca para a loja certa", () => {
    const onAbrir = jest.fn();
    const t = montar({ onAbrirNaLoja: onAbrir });
    const botao = t.root.findAll((n) => n.props?.testID === `abrir-na-loja-${VILLA}` && typeof n.props?.onPress === "function")[0];
    act(() => botao.props.onPress());
    expect(onAbrir).toHaveBeenCalledWith(VILLA);
  });

  it("durante a troca, o botão fica desabilitado", () => {
    const t = montar({ abrindo: true });
    const botao = t.root.findAll((n) => n.props?.testID === `abrir-na-loja-${VILLA}` && typeof n.props?.onPress === "function")[0];
    expect(botao.props.disabled).toBe(true);
    expect(texto(t.toJSON())).toContain("Abrindo…");
  });
});
