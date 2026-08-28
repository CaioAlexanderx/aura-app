// ============================================================
// A barra inferior espremia as abas — e escondia uma tela inteira.
//
// O shell do dojô chegou a NOVE abas fixas num flex row com `flex: 1`:
// ~41px por aba num aparelho de 375px, com "Mensalidades" e "Certificados"
// truncados num rótulo de 10px. A válvula de escape usada até aqui era a
// flag sidebarOnly, que tirava o item do mobile — e foi assim que
// Configurações ficou INALCANÇÁVEL no celular: o item da sidebar era o
// único link para ela no app inteiro, e é de lá que se sobe a logo do dojô.
//
// Regra nova (decisão do Caio, 28/08/2026): teto de ícones na barra; o que
// não couber vai para um menu "Mais". Nada some.
//
// Icon é mockado porque react-native-svg não passa pelo transformIgnorePatterns.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

// O <Modal> do react-native-web monta por ReactDOM.createPortal, que o
// react-test-renderer não sabe renderizar ("An invalid container has been
// provided"). O portal é o comportamento CERTO em produção — é o mesmo
// padrão dos outros modais da casa — então o mock só o achata para dentro
// da árvore, preservando `visible`.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Modal: ({ visible, children }: any) => (visible ? children : null),
  };
});

import { BottomTabBar, splitTabs } from "@/components/karate/BottomTabBar";
import { KarateColors } from "@/constants/karateTheme";

const raiz = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(raiz, "components/karate/DojoShell.tsx"), "utf8");

function nos(arvore: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}
const porTestId = (arvore: any, id: string) =>
  nos(arvore).filter((n) => n.props && n.props["data-testid"] === id);

const item = (n: number) => ({ label: `Item ${n}`, icon: "grid", route: `/r${n}` });
const lista = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1));

// ============================================================
// A regra de corte
// ============================================================
describe("splitTabs", () => {
  test("cabendo tudo, não inventa menu", () => {
    // Um "Mais" que esconde UM item só gasta um slot para economizar um
    // slot — não paga o toque a mais.
    expect(splitTabs(lista(5), 5)).toEqual({ visible: lista(5), overflow: [] });
    expect(splitTabs(lista(3), 5).overflow).toHaveLength(0);
  });

  test("passando do teto, o hambúrguer ocupa o último slot", () => {
    // 6 itens em 5 slots: 4 na barra + "Mais" = 5 ícones, nunca 6.
    const r = splitTabs(lista(6), 5);
    expect(r.visible).toHaveLength(4);
    expect(r.overflow).toHaveLength(2);
  });

  test("nada some: visible + overflow devolve a lista inteira, na ordem", () => {
    const todos = lista(10);
    const r = splitTabs(todos, 5);
    expect([...r.visible, ...r.overflow]).toEqual(todos);
  });

  test("a ORDEM é a prioridade — os primeiros ficam na barra", () => {
    const r = splitTabs(lista(10), 5);
    expect(r.visible.map((i) => i.label)).toEqual(["Item 1", "Item 2", "Item 3", "Item 4"]);
    expect(r.overflow[r.overflow.length - 1].label).toBe("Item 10");
  });

  test("teto de 4 também é respeitado", () => {
    const r = splitTabs(lista(9), 4);
    expect(r.visible).toHaveLength(3);
    expect(r.overflow).toHaveLength(6);
  });
});

// ============================================================
// O componente
// ============================================================
describe("BottomTabBar", () => {
  const render = (n: number, ativo = "/r1", maxSlots?: number) =>
    renderer.create(
      <BottomTabBar
        items={lista(n)}
        isActive={(i) => i.route === ativo}
        onNavigate={() => {}}
        {...(maxSlots ? { maxSlots } : {})}
      />
    );

  test("cabendo tudo, não renderiza o hambúrguer", () => {
    const t = render(5).toJSON();
    expect(porTestId(t, "tab-mais")).toHaveLength(0);
    expect(porTestId(t, "tab-/r5")).toHaveLength(1);
  });

  test("nunca passa do teto de ícones na barra", () => {
    const t = render(10).toJSON();
    const naBarra = nos(t).filter(
      (n) => n.props?.["data-testid"]?.startsWith("tab-")
    );
    expect(naBarra).toHaveLength(5);
    expect(porTestId(t, "tab-mais")).toHaveLength(1);
  });

  test("o que não coube NÃO fica na barra", () => {
    const t = render(10).toJSON();
    expect(porTestId(t, "tab-/r10")).toHaveLength(0);
  });

  test("o menu começa fechado e abre no toque do hambúrguer", () => {
    const t = render(10);
    expect(porTestId(t.toJSON(), "mais-/r10")).toHaveLength(0);

    const botao = t.root.findAll((n: any) => n.props?.testID === "tab-mais")[0];
    renderer.act(() => { botao.props.onPress(); });

    // Todos os itens escondidos ficam a UM toque de distância.
    expect(porTestId(t.toJSON(), "mais-/r10")).toHaveLength(1);
    expect(porTestId(t.toJSON(), "mais-/r5")).toHaveLength(1);
  });

  test("o hambúrguer sinaliza quando a tela ATUAL está escondida nele", () => {
    // Sem isso o sensei fica sem nenhuma marca de onde está: a barra toda
    // apagada enquanto ele navega numa seção do menu.
    // O sinal é VISUAL: o hambúrguer não é role="tab" (ele abre um menu), e
    // aria-selected não vale para button — então o que se garante aqui é a
    // cor de ativo, que é o que o sensei enxerga.
    const corDoIcone = (arvore: any) => {
      const alvo = porTestId(arvore, "tab-mais")[0];
      return nos(alvo).find((n) => n.type === "Icon")?.props?.color;
    };
    expect(corDoIcone(render(10, "/r9").toJSON())).toBe(KarateColors.primary);
    expect(corDoIcone(render(10, "/r1").toJSON())).toBe(KarateColors.ink4);
  });

  test("navegar pelo menu FECHA o menu antes de sair", () => {
    // <Modal> de topo no RN Web fica preso por baixo da rota nova se não
    // for fechado primeiro — armadilha já conhecida deste produto.
    const rotas: string[] = [];
    const t = renderer.create(
      <BottomTabBar items={lista(10)} isActive={() => false} onNavigate={(r) => rotas.push(r)} />
    );
    const botao = t.root.findAll((n: any) => n.props?.testID === "tab-mais")[0];
    renderer.act(() => { botao.props.onPress(); });

    const alvo = t.root.findAll((n: any) => n.props?.testID === "mais-/r10")[0];
    renderer.act(() => { alvo.props.onPress(); });

    expect(rotas).toEqual(["/r10"]);
    expect(porTestId(t.toJSON(), "mais-/r10")).toHaveLength(0); // fechou
  });
});

// ============================================================
// O que a barra do dojô precisa garantir
// ============================================================
describe("a nav do dojô no mobile", () => {
  test("a barra recebe a nav INTEIRA — o corte é do BottomTabBar", () => {
    // O filtro por flag era o que sumia com Configurações no celular.
    expect(shell).toMatch(/const tabs = visibleDojoNav\(linked\);/);
    expect(shell).not.toMatch(/visibleDojoNav\(linked\)\.filter/);
  });

  test("sidebarOnly não existe mais — a flag só decide a sidebar", () => {
    // O nome antigo prometia "só na sidebar" e cumpria escondendo do mobile.
    expect(shell).not.toMatch(/sidebarOnly:/);
    expect(shell).toMatch(/sidebarFooter: boolean/);
  });

  test("Configurações continua no RODAPÉ da sidebar (desktop não muda)", () => {
    expect(shell).toMatch(/"Configurações".*sidebarFooter: true/);
    expect(shell).toMatch(/footerItems = visibleNav\.filter\(\(i\) => i\.sidebarFooter\)/);
  });

  test("Configurações é o último da ordem, então cai no menu 'Mais'", () => {
    const rotas = [...shell.matchAll(/route: "(\/karate\/\(dojo\)[^"]*)"/g)].map((m) => m[1]);
    expect(rotas[rotas.length - 1]).toBe("/karate/(dojo)/configuracoes");
    // E com 10 itens ela realmente não cabe na barra.
    expect(splitTabs(rotas, 5).overflow).toContain("/karate/(dojo)/configuracoes");
  });
});
