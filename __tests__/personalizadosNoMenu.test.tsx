// ============================================================
// Personalizados: a frente Studio dentro do shell Negócio (p-128, 16/11/2026).
//
// O que este teste segura:
//   1. quem vê a seção: só empresa com studio_enabled E sem vertical_active;
//   2. cada item do menu com `mod` próprio, nos dois mapas (regra 3);
//   3. plano Negócio: no Essencial as chaves somem (sem cadeado), e o
//      override por empresa liga e desliga;
//   4. a permissão do membro (personalizados.access) e a linha em
//      MembersSection, que só aparece com a frente ligada;
//   5. o filtro do toggle no único caminho comum do menu (buildRawNav) e a
//      Produção no topo do "Mais" do celular;
//   6. item sem tela fica fora do menu (constants/modulosOcultos.ts);
//   7. o adaptador de cores: as telas que leem useStudioTokens() recebem a
//      paleta do Negócio dentro de <TemaDoNegocio>, e a do Studio fora dele.
//
// O NAV é lido do fonte do _layout, como em __tests__/matconNav.test.ts:
// importar o _layout puxaria expo-router e o app inteiro.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

jest.mock("@/services/api", () => ({ request: jest.fn() }));
jest.mock("@/stores/auth", () => ({ useAuthStore: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("expo-font", () => ({ loadAsync: jest.fn(), isLoaded: () => true, useFonts: () => [true, null] }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: "FpktLogo" }));

import { View } from "react-native";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { personalizadosAtivo, MODS_PERSONALIZADOS, PERSONALIZADOS_LIBERADO } from "@/utils/personalizados";
import { MODULOS_OCULTOS } from "@/constants/modulosOcultos";
import { tokensDoNegocio } from "@/constants/personalizados-tokens";
import { LightPalette, DarkPalette, useThemeStore } from "@/constants/colors";
import { StudioColors, StudioColorsDark } from "@/constants/studio-tokens";
import { getStudioSemantic } from "@/constants/studio-semantic";
import { StudioThemeProvider, useStudioTokens, useStudioSemantic, useStudioTheme } from "@/contexts/StudioThemeMode";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";

const raiz = path.join(__dirname, "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");
const LAYOUT = ler("app/(tabs)/_layout.tsx");
const MEMBROS = ler("components/MembersSection.tsx");

// Mockup p-131 (aprovado em 16/11): Orçamentos 3D, Produção e Insumos.
const DO_MENU = [
  { r: "/personalizados/orcamentos", mod: "personalizados.orcamentos" },
  { r: "/personalizados/producao", mod: "personalizados.producao" },
  { r: "/personalizados/insumos", mod: "personalizados.insumos" },
];
const TODAS = [...MODS_PERSONALIZADOS];

function linhaDoGrupo(nome: string): string {
  const linha = LAYOUT.split("\n").find((l) => l.includes(`{ s: "${nome}"`));
  if (!linha) throw new Error(`grupo "${nome}" não existe no NAV`);
  return linha;
}
function itensDoGrupo(nome: string) {
  return Array.from(linhaDoGrupo(nome).matchAll(/\{ r: "([^"]+)"[^}]*\}/g)).map((m) => ({
    r: m[1],
    mod: (m[0].match(/mod: "([^"]+)"/) || [])[1] || null,
    toggle: /personalizadosToggle: true/.test(m[0]),
  }));
}
function corpoDoBuildRawNav(): string {
  const i = LAYOUT.indexOf("function buildRawNav(");
  return LAYOUT.slice(i, LAYOUT.indexOf("\n}", i));
}

describe("trava geral: nada aparece até a migração completa (Caio, 16/11)", () => {
  test("a trava está desligada no código", () => {
    expect(PERSONALIZADOS_LIBERADO).toBe(false);
  });

  test("sem passar a trava, ninguém vê, nem com studio_enabled e sem vertical", () => {
    expect(personalizadosAtivo({ studio_enabled: true }, null)).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: true }, undefined)).toBe(false);
  });
});

describe("quem vê a seção", () => {
  test("studio_enabled ligado e sem vertical_active: vê", () => {
    expect(personalizadosAtivo({ studio_enabled: true }, null, true)).toBe(true);
    expect(personalizadosAtivo({ studio_enabled: true }, undefined, true)).toBe(true);
    expect(personalizadosAtivo({ studio_enabled: true }, "", true)).toBe(true);
  });

  test("quem está no shell /studio (vertical_active = studio) não vê", () => {
    expect(personalizadosAtivo({ studio_enabled: true }, "studio", true)).toBe(false);
  });

  test("outra vertical também não vê", () => {
    for (const v of ["food", "odonto", "karate_dojo", "karate_federation"]) {
      expect(personalizadosAtivo({ studio_enabled: true }, v, true)).toBe(false);
    }
  });

  test("sem o interruptor ligado ninguém vê", () => {
    expect(personalizadosAtivo({}, null, true)).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: false }, null, true)).toBe(false);
    expect(personalizadosAtivo({ studio_enabled: "true" }, null, true)).toBe(false);
    expect(personalizadosAtivo(null, null, true)).toBe(false);
    expect(personalizadosAtivo(undefined, null, true)).toBe(false);
  });
});

describe("NAV: seção Personalizados, um mod por item", () => {
  test("os três itens do mockup, na ordem, com rota, mod próprio e o toggle", () => {
    expect(itensDoGrupo("Personalizados")).toEqual(DO_MENU.map((i) => ({ ...i, toggle: true })));
  });

  test("nenhum mod repetido e nenhum emprestado de outra seção", () => {
    const mods = itensDoGrupo("Personalizados").map((i) => i.mod);
    expect(new Set(mods).size).toBe(mods.length);
    const outros = LAYOUT.split("\n")
      .filter((l) => /^\s*\{ s: "/.test(l) && !l.includes('{ s: "Personalizados"'))
      .join("\n");
    mods.forEach((m) => expect(outros).not.toContain(`mod: "${m}"`));
  });

  test("a seção vem logo depois de Vendas, antes de Clientes e WhatsApp", () => {
    const grupos = Array.from(LAYOUT.matchAll(/^\s*\{ s: "([^"]+)"/gm)).map((m) => m[1]);
    const i = grupos.indexOf("Personalizados");
    expect(grupos[i - 1]).toBe("Vendas");
    expect(grupos[i + 1]).toBe("Clientes e WhatsApp");
  });

  test("os rótulos são os do mockup", () => {
    const rotulos = Array.from(linhaDoGrupo("Personalizados").matchAll(/l: "([^"]+)"/g)).map((m) => m[1]);
    expect(rotulos).toEqual(["Orçamentos 3D", "Produção", "Insumos"]);
  });

  test("o rótulo não colide com o Orçamentos do Matcon", () => {
    expect(linhaDoGrupo("Personalizados")).toContain('l: "Orçamentos 3D"');
    expect(linhaDoGrupo("Matcon")).toContain('l: "Orçamentos"');
  });

  test("buildRawNav derruba o item sem a frente ligada, antes do plano", () => {
    const corpo = corpoDoBuildRawNav();
    expect(corpo).toContain("if (item.personalizadosToggle && personalizadosOn !== true) return false;");
    expect(corpo.indexOf("item.personalizadosToggle")).toBeLessThan(corpo.indexOf("visibleMods.has(item.mod)"));
  });

  test("Sidebar e MBar fazem a mesma conta e passam para o buildRawNav", () => {
    // p-188: a trava vem do hook reativo (constante OU empresa de teste).
    const contas = LAYOUT.match(/const personalizadosOn = personalizadosAtivo\(pdvSettingsNav, activeVertical, personalizadosLiberadoNav\);/g) || [];
    expect(contas.length).toBe(2);
    // p-187: no consolidado, a seção aparece quando alguma loja do grupo tem a frente.
    const noMenu = LAYOUT.match(/const personalizadosNoMenu = personalizadosOn \|\| lojasComPersonalizados\.ligadas\.size > 0;/g) || [];
    expect(noMenu.length).toBe(2);
    const chamadas = LAYOUT.match(/buildRawNav\(visibleMods, isStaff, activeVertical, osEnabled, oticaEnabled, matconEnabled, blackFridayOn, personalizadosNoMenu\)/g) || [];
    expect(chamadas.length).toBe(2);
  });

  test("celular: a Produção é a primeira do menu Mais", () => {
    const m = LAYOUT.match(/const MORE_PRIORIDADE = \[([^\]]+)\]/);
    const rotas = Array.from((m as RegExpMatchArray)[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]);
    expect(rotas[0]).toBe("/personalizados/producao");
    expect(rotas.slice(1)).toEqual(["/clientes", "/whatsapp", "/clientes/reativacao"]);
  });
});

describe("plano: Negócio, e no Essencial some", () => {
  test("as 8 chaves estão em MODULE_PLAN_MAP no Negócio", () => {
    expect(TODAS).toHaveLength(8);
    TODAS.forEach((m) => expect(MODULE_PLAN_MAP[m]).toBe("negocio"));
    const registradas = Object.keys(MODULE_PLAN_MAP).filter((k) => k.startsWith("personalizados."));
    expect(registradas.sort()).toEqual([...TODAS].sort());
  });

  test("Essencial não vê nenhuma; Negócio e Expansão veem todas", () => {
    const essencial = computeVisibleModules("essencial", null, undefined);
    TODAS.forEach((m) => expect(essencial.has(m)).toBe(false));
    for (const plano of ["negocio", "expansao"]) {
      const v = computeVisibleModules(plano, null, undefined);
      TODAS.forEach((m) => expect(v.has(m)).toBe(true));
    }
  });

  test("o Essencial não ganha cadeado nem selo: sem a chave visível o item não chega ao menu", () => {
    const corpo = corpoDoBuildRawNav();
    expect(corpo).toContain("return !item.mod || visibleMods.has(item.mod);");
    expect(linhaDoGrupo("Personalizados")).not.toMatch(/soon|plan:/);
  });

  test("override por empresa: liga uma tela no Essencial e desliga uma no Negócio", () => {
    const ligada = computeVisibleModules("essencial", { "personalizados.producao": true }, undefined);
    expect(ligada.has("personalizados.producao")).toBe(true);
    expect(ligada.has("personalizados.orcamentos")).toBe(false);
    const desligada = computeVisibleModules("negocio", { "personalizados.galeria": false }, undefined);
    expect(desligada.has("personalizados.galeria")).toBe(false);
    expect(desligada.has("personalizados.producao")).toBe(true);
  });

  test("os planos das outras frentes não mudaram", () => {
    expect(MODULE_PLAN_MAP["matcon.orcamentos"]).toBe("essencial");
    expect(MODULE_PLAN_MAP["otica.laboratorio"]).toBe("essencial");
    expect(MODULE_PLAN_MAP["canal"]).toBe("negocio");
  });
});

describe("permissão do membro", () => {
  test("personalizados.access libera as 8 chaves, e só ela", () => {
    expect([...PERM_TO_MODULES["personalizados.access"]].sort()).toEqual([...TODAS].sort());
    Object.keys(PERM_TO_MODULES)
      .filter((k) => k !== "personalizados.access")
      .forEach((k) => TODAS.forEach((m) => expect(PERM_TO_MODULES[k]).not.toContain(m)));
  });

  test("membro sem a permissão não vê; com ela, vê", () => {
    const sem = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true, estoque: true } });
    TODAS.forEach((m) => expect(sem.has(m)).toBe(false));
    const com = computeVisibleModules("negocio", null, { is_owner: false, permissions: { "personalizados.access": true } });
    TODAS.forEach((m) => expect(com.has(m)).toBe(true));
    expect(com.has("pdv")).toBe(false);
  });

  test("a permissão não vence o plano", () => {
    const v = computeVisibleModules("essencial", null, { is_owner: false, permissions: { "personalizados.access": true } });
    TODAS.forEach((m) => expect(v.has(m)).toBe(false));
  });

  test("consolidado: o backend devolve false quando uma loja não libera, e a seção some", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true, "personalizados.access": false } });
    TODAS.forEach((m) => expect(v.has(m)).toBe(false));
  });

  test("dono vê tudo no Negócio", () => {
    const v = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
    TODAS.forEach((m) => expect(v.has(m)).toBe(true));
  });

  test("MembersSection: a linha existe e só aparece com a frente ligada", () => {
    expect(MEMBROS).toMatch(/\{ key: "personalizados\.access", label: "Personalizados", hint: "Orçamentos 3D, Produção e Insumos", onlyWhen: "personalizados" as const \}/);
    expect(MEMBROS).toContain("const personalizadosOn = personalizadosAtivo(pdvSettings, verticalAtiva, personalizadosLiberadoAqui);");
    expect(MEMBROS).toContain("personalizados: personalizadosOn }");
  });
});

describe("item sem tela fica fora do menu", () => {
  test("todo item do menu ou tem a tela em app/(tabs)/personalizados ou está nos ocultos", () => {
    for (const { r, mod } of DO_MENU) {
      const base = path.join(raiz, "app/(tabs)", r.replace(/^\//, ""));
      const temTela = fs.existsSync(base + ".tsx") || fs.existsSync(path.join(base, "index.tsx"));
      expect({ mod, noMenu: temTela }).toEqual({ mod, noMenu: !MODULOS_OCULTOS.has(mod) });
    }
  });

  test("os ocultos de hoje são só de Personalizados", () => {
    MODULOS_OCULTOS.forEach((m) => expect(m.startsWith("personalizados.")).toBe(true));
  });
});

describe("adaptador de cores: Negócio no formato do Studio", () => {
  test("mesmas chaves da paleta do Studio, nos dois temas", () => {
    for (const [paleta, escuro] of [[LightPalette, false], [DarkPalette, true]] as const) {
      const t = tokensDoNegocio(paleta, escuro);
      expect(Object.keys(t).sort()).toEqual(Object.keys(StudioColors).sort());
      Object.values(t).forEach((v) => expect(typeof v === "string" && v.length > 0).toBe(true));
    }
  });

  test("a marca é o violeta do Negócio, não o navy nem o magenta do Studio", () => {
    const claro = tokensDoNegocio(LightPalette, false);
    expect(claro.primary).toBe("#7c3aed");
    expect(claro.bg).toBe(LightPalette.bg);
    expect(claro.paperCard).toBe(LightPalette.bg3);
    expect(claro.ink).toBe(LightPalette.ink);
    const valores = Object.entries(claro).filter(([k]) => /^(primary|accent)/.test(k)).map(([, v]) => String(v).toLowerCase());
    for (const doStudio of ["#1e3a8a", "#ec4899", "#f472b6", "#be185d"]) expect(valores).not.toContain(doStudio);
    const escuro = tokensDoNegocio(DarkPalette, true);
    expect(escuro.bg).toBe(DarkPalette.bg);
    expect(escuro.ink).toBe(DarkPalette.ink);
  });

  test("as cores de estado continuam as do Studio no tema correspondente", () => {
    const claro = tokensDoNegocio(LightPalette, false);
    const escuro = tokensDoNegocio(DarkPalette, true);
    for (const k of ["danger", "dangerSoft", "dangerInk", "warning", "warningInk", "info", "success", "successInk"] as const) {
      expect(claro[k]).toBe(StudioColors[k]);
      expect(escuro[k]).toBe(StudioColorsDark[k]);
    }
  });
});

describe("render: <TemaDoNegocio> entrega as cores às telas que leem useStudioTokens", () => {
  function Leitor({ id }: { id: string }) {
    const t = useStudioTokens();
    const s = useStudioSemantic();
    const tema = useStudioTheme();
    return (
      <View
        testID={id}
        style={{ backgroundColor: t.bg, borderColor: t.primary }}
        accessibilityLabel={`${tema.isDark ? "escuro" : "claro"}|${s.approved.base}`}
      />
    );
  }
  const porTestId = (arvore: renderer.ReactTestRenderer, id: string) =>
    arvore.root.findAllByProps({ testID: id }, { deep: false })[0];
  const estilo = (no: any) => Object.assign({}, ...[no.props.style].flat(Infinity).filter(Boolean));

  function montar() {
    let arvore!: renderer.ReactTestRenderer;
    act(() => {
      arvore = renderer.create(
        <StudioThemeProvider>
          <Leitor id="fora" />
          <TemaDoNegocio>
            <Leitor id="dentro" />
          </TemaDoNegocio>
        </StudioThemeProvider>,
      );
    });
    return arvore;
  }

  afterEach(() => {
    act(() => { useThemeStore.setState({ isDark: false } as any); });
  });

  test("tema claro do app: dentro recebe o Negócio claro; fora continua o Studio", () => {
    act(() => { useThemeStore.setState({ isDark: false } as any); });
    const arvore = montar();
    const dentro = porTestId(arvore, "dentro");
    expect(estilo(dentro).backgroundColor).toBe(LightPalette.bg);
    expect(estilo(dentro).borderColor).toBe("#7c3aed");
    expect(dentro.props.accessibilityLabel).toBe(`claro|${getStudioSemantic(false).approved.base}`);
    // Fora do adaptador nada muda: o Studio segue escuro por padrão.
    const fora = porTestId(arvore, "fora");
    expect(estilo(fora).backgroundColor).toBe(StudioColorsDark.bg);
    expect(estilo(fora).borderColor).toBe(StudioColorsDark.primary);
    arvore.unmount();
  });

  test("tema escuro do app: dentro recebe o Negócio escuro", () => {
    act(() => { useThemeStore.setState({ isDark: true } as any); });
    const arvore = montar();
    const dentro = porTestId(arvore, "dentro");
    expect(estilo(dentro).backgroundColor).toBe(DarkPalette.bg);
    expect(dentro.props.accessibilityLabel).toBe(`escuro|${getStudioSemantic(true).approved.base}`);
    arvore.unmount();
  });

  test("setMode dentro do adaptador não troca o modo salvo do Studio", () => {
    let modoDeFora = "";
    let trocar: (m: any) => void = () => {};
    function Fora() { modoDeFora = useStudioTheme().mode; return null; }
    function Dentro() { trocar = useStudioTheme().setMode; return null; }
    let arvore!: renderer.ReactTestRenderer;
    act(() => {
      arvore = renderer.create(
        <StudioThemeProvider><Fora /><TemaDoNegocio><Dentro /></TemaDoNegocio></StudioThemeProvider>,
      );
    });
    const antes = modoDeFora;
    act(() => { trocar("light"); });
    expect(modoDeFora).toBe(antes);
    arvore.unmount();
  });
});
