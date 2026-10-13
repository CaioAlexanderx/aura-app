// ============================================================
// Página "Black Friday" (13/10/2026) — menu, período, seções, Estoque
//
// Decisão do Caio (13/10): "O que vai faltar" NÃO é aba do Estoque. É a
// primeira seção de /black-friday, que fica no menu logo abaixo de Painel.
// O que estes testes seguram:
//
// 1. o item está no NAV logo abaixo de Painel, com chave própria
//    `black_friday` (NAV + MODULE_PLAN_MAP + PERM_TO_MODULES), no plano do
//    Estoque, e some fora do período (13/10/2026 a 02/02/2027);
// 2. cada seção renderiza, na ordem, com título e a linha "por que agora";
// 3. seção que a loja não tem SOME (consolidado, membro sem a permissão):
//    nada de cartão bloqueado;
// 4. o assento reaproveita o cartão de Configurações (sem moldura) e lá
//    fica só o atalho; o vale-troca é espelho do MESMO estado do toggle de
//    Políticas do Caixa;
// 5. o Estoque não ganhou aba nem item novo.
// ============================================================
import React from "react";
import fs from "fs";
import path from "path";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockSalvar = jest.fn();
jest.mock("@/services/api", () => ({ request: jest.fn(), pdvSettingsApi: { save: (...a: any[]) => mockSalvar(...a) } }));
let mockPdv: any;
const mockInvalidate = jest.fn();
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdv, isLoading: false, invalidate: mockInvalidate }),
}));
const mockToastErro = jest.fn();
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: (...a: any[]) => mockToastErro(...a), info: jest.fn() } }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: (...a: any[]) => mockReplace(...a) } }));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({ useAuthStore: () => mockAuth }));

let mockVisible: Set<string>;
jest.mock("@/hooks/useVisibleModules", () => {
  const actual = jest.requireActual("@/hooks/useVisibleModules");
  return { ...actual, useVisibleModules: () => mockVisible };
});

// Os filhos pesados viram casca: o que importa aqui é a MONTAGEM da página.
jest.mock("@/components/screens/blackfriday/OQueVaiFaltar", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return { OQueVaiFaltar: () => R.createElement(View, { testID: "ruptura-secao" }) };
});
jest.mock("@/components/screens/blackfriday/PlacarDoDiaCard", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return { PlacarDoDiaCard: (p: any) => R.createElement(View, { testID: "placar-do-dia", companyId: p.companyId, isOwner: p.isOwner }) };
});
const mockAssentoProps = jest.fn();
jest.mock("@/components/screens/configuracoes/AssentoTemporadaCard", () => {
  const { View } = jest.requireActual("react-native");
  const R = jest.requireActual("react");
  return {
    AssentoTemporadaCard: (p: any) => {
      mockAssentoProps(p);
      return R.createElement(View, { testID: "assento-temporada" });
    },
  };
});

import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import { BLACK_FRIDAY_ATE, BLACK_FRIDAY_DE, BLACK_FRIDAY_MOD, blackFridayAtivo } from "@/constants/blackFriday";
import { secoesDaPagina } from "@/components/screens/blackfriday/secoes";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";
import { AtalhoAssento } from "@/components/screens/blackfriday/AtalhoAssento";
import { lerValeTrocaLigado } from "@/utils/valeTroca";
import { TABS } from "@/components/screens/estoque/types";

const RAIZ = path.join(__dirname, "..");
const LAYOUT = fs.readFileSync(path.join(RAIZ, "app/(tabs)/_layout.tsx"), "utf8");
const CID = "aaaaaaaa-0000-4000-8000-000000000001";

jest.setTimeout(30000);

function fixarHoje(iso: string) {
  jest.useFakeTimers({
    now: new Date(iso + "T15:00:00Z"),
    doNotFake: [
      "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate",
      "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime",
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  fixarHoje("2026-10-13");
  mockAuth = { company: { id: CID, plan: "negocio", member_role: "owner" }, consolidatedView: false, availableCompanies: [{ id: CID }], isStaff: false };
  mockVisible = new Set(["estoque", "configuracoes", "whatsapp", BLACK_FRIDAY_MOD]);
  mockPdv = { cash_tender_modal_enabled: true };
  mockSalvar.mockResolvedValue({});
  try { localStorage.clear(); } catch {}
});
afterEach(() => jest.useRealTimers());

function montar(el: React.ReactElement) {
  let r: renderer.ReactTestRenderer;
  act(() => { r = renderer.create(el); });
  return r!;
}
function ids(r: renderer.ReactTestRenderer, prefixo: string): string[] {
  const out: string[] = [];
  r.root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith(prefixo), { deep: false })
    .forEach((n) => { if (!out.includes(n.props.testID)) out.push(n.props.testID); });
  return out;
}
function textoDe(node: any): string {
  return (node.children as any[]).map((c) => (typeof c === "string" ? c : textoDe(c))).join("");
}

// ── 1. Menu, módulo e período ────────────────────────────────

describe("item do menu", () => {
  it("está na seção Principal, logo abaixo de Painel, com chave própria e a marca de temporada", () => {
    const linha = LAYOUT.split("\n").find((l) => l.includes('{ s: "Principal"'))!;
    const itens = Array.from(linha.matchAll(/\{ r: "([^"]+)"[^}]*?mod: "([^"]+)"[^}]*\}/g)).map((m) => [m[1], m[2]]);
    expect(itens.slice(0, 2)).toEqual([["/", "painel"], ["/black-friday", "black_friday"]]);
    expect(linha).toContain('{ r: "/black-friday", l: "Black Friday", ic: "tag", mod: "black_friday", temporada: true }');
  });

  it("é filtrado pelo período antes de qualquer outro filtro do buildRawNav", () => {
    expect(LAYOUT).toContain("if (item.temporada && !blackFridayAtivo()) return false;");
  });

  it("nenhum outro item do NAV herda a chave", () => {
    expect(Array.from(LAYOUT.matchAll(/mod: "black_friday"/g))).toHaveLength(1);
  });

  it("a rota existe como arquivo", () => {
    expect(fs.existsSync(path.join(RAIZ, "app/(tabs)/black-friday.tsx"))).toBe(true);
  });
});

describe("módulo black_friday", () => {
  it("MODULE_PLAN_MAP: o mesmo plano do Estoque", () => {
    expect(MODULE_PLAN_MAP[BLACK_FRIDAY_MOD]).toBe("essencial");
    expect(MODULE_PLAN_MAP[BLACK_FRIDAY_MOD]).toBe(MODULE_PLAN_MAP["estoque"]);
  });

  it("PERM_TO_MODULES: quem tem estoque ou configurações", () => {
    expect(PERM_TO_MODULES["estoque"]).toContain(BLACK_FRIDAY_MOD);
    expect(PERM_TO_MODULES["configuracoes"]).toContain(BLACK_FRIDAY_MOD);
    Object.keys(PERM_TO_MODULES)
      .filter((k) => k !== "estoque" && k !== "configuracoes")
      .forEach((k) => expect(PERM_TO_MODULES[k]).not.toContain(BLACK_FRIDAY_MOD));
  });

  it("visibilidade: dono vê em qualquer plano; membro sem estoque nem configurações não vê", () => {
    ["essencial", "negocio", "expansao"].forEach((p) =>
      expect(computeVisibleModules(p, {}, null).has(BLACK_FRIDAY_MOD)).toBe(true)
    );
    const soEstoque = { is_owner: false, permissions: { estoque: true } };
    const soConfig = { is_owner: false, permissions: { configuracoes: true } };
    const nenhuma = { is_owner: false, permissions: { pdv: true, financeiro: true } };
    expect(computeVisibleModules("essencial", {}, soEstoque).has(BLACK_FRIDAY_MOD)).toBe(true);
    expect(computeVisibleModules("essencial", {}, soConfig).has(BLACK_FRIDAY_MOD)).toBe(true);
    expect(computeVisibleModules("essencial", {}, nenhuma).has(BLACK_FRIDAY_MOD)).toBe(false);
  });

  it("override false esconde a página", () => {
    expect(computeVisibleModules("negocio", { [BLACK_FRIDAY_MOD]: false }, null).has(BLACK_FRIDAY_MOD)).toBe(false);
  });
});

describe("período (constante única)", () => {
  it("vai de 13/10/2026 a 02/02/2027, extremos inclusos", () => {
    expect(BLACK_FRIDAY_DE).toBe("2026-10-13");
    expect(BLACK_FRIDAY_ATE).toBe("2027-02-02");
    expect(blackFridayAtivo("2026-10-12")).toBe(false);
    expect(blackFridayAtivo("2026-10-13")).toBe(true);
    expect(blackFridayAtivo("2026-11-30")).toBe(true);
    expect(blackFridayAtivo("2027-02-02")).toBe(true);
    expect(blackFridayAtivo("2027-02-03")).toBe(false);
  });

  it("sem argumento usa o dia de hoje em Brasília", () => {
    fixarHoje("2027-02-03");
    expect(blackFridayAtivo()).toBe(false);
    jest.useRealTimers();
    fixarHoje("2026-12-24");
    expect(blackFridayAtivo()).toBe(true);
  });
});

// ── 2. Quais seções ──────────────────────────────────────────

describe("secoesDaPagina", () => {
  const todos = new Set(["estoque", "configuracoes", "whatsapp", BLACK_FRIDAY_MOD]);

  it("loja com tudo: ruptura, assento, vale-troca e placar, nessa ordem", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["ruptura", "assento", "vale_troca", "placar"]);
  });

  it("plano sem WhatsApp (Essencial) não vê o placar — some, não bloqueia", () => {
    const semWa = new Set(["estoque", "configuracoes", BLACK_FRIDAY_MOD]);
    expect(secoesDaPagina({ visible: semWa, consolidatedView: false, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["ruptura", "assento", "vale_troca"]);
  });

  it("consolidado: assento e vale-troca são por empresa e somem", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: true, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["ruptura"]);
  });

  it("sem o módulo da função a seção some", () => {
    expect(secoesDaPagina({ visible: new Set(["configuracoes"]), consolidatedView: false, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["assento", "vale_troca"]);
    expect(secoesDaPagina({ visible: new Set(["whatsapp"]), consolidatedView: false, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["placar"]);
    expect(secoesDaPagina({ visible: new Set(["estoque"]), consolidatedView: false, hoje: "2026-10-13" }).map((s) => s.chave))
      .toEqual(["ruptura"]);
  });

  it("depois do último dia de troca (31/01/2027) sobram a ruptura e o placar", () => {
    expect(secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2027-01-31" }).map((s) => s.chave))
      .toEqual(["ruptura", "assento", "vale_troca", "placar"]);
    expect(secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2027-02-01" }).map((s) => s.chave))
      .toEqual(["ruptura", "placar"]);
  });

  it("cada seção traz a linha de 'por que agora'", () => {
    secoesDaPagina({ visible: todos, consolidatedView: false, hoje: "2026-10-13" })
      .forEach((s) => expect(s.porQueAgora.length).toBeGreaterThan(20));
  });
});

// ── 3. A página ──────────────────────────────────────────────

describe("PaginaBlackFriday", () => {
  it("renderiza as quatro seções, numeradas, cada uma com título e 'por que agora'", () => {
    const r = montar(<PaginaBlackFriday />);
    expect(ids(r, "bf-secao-").filter((i) => !i.endsWith("-por-que"))).toEqual([
      "bf-secao-ruptura", "bf-secao-assento", "bf-secao-vale-troca", "bf-secao-placar",
    ]);
    const ruptura = textoDe(r.root.findAllByProps({ testID: "bf-secao-ruptura" }, { deep: false })[0]);
    expect(ruptura).toContain("1");
    expect(ruptura).toContain("O que vai faltar");
    expect(ruptura).toContain("Por que agora:");
    const vale = textoDe(r.root.findAllByProps({ testID: "bf-secao-vale-troca" }, { deep: false })[0]);
    expect(vale).toContain("3");
    expect(vale).toContain("Vale-troca no cupom");
    // o conteúdo de cada função está dentro do seu cartão
    expect(r.root.findAllByProps({ testID: "ruptura-secao" }, { deep: false })).toHaveLength(1);
    expect(r.root.findAllByProps({ testID: "assento-temporada" }, { deep: false })).toHaveLength(1);
    const placar = r.root.findAllByProps({ testID: "placar-do-dia" }, { deep: false });
    expect(placar).toHaveLength(1);
    expect(placar[0].props.companyId).toBe(CID);
    expect(placar[0].props.isOwner).toBe(true);
  });

  it("reaproveita o cartão do assento, sem moldura, com a empresa e o dono", () => {
    montar(<PaginaBlackFriday />);
    expect(mockAssentoProps).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: CID, plano: "negocio", isOwner: true, semMoldura: true })
    );
  });

  it("membro não-dono recebe isOwner=false; staff da Aura conta como dono", () => {
    mockAuth = { ...mockAuth, company: { ...mockAuth.company, member_role: "member" } };
    montar(<PaginaBlackFriday />);
    expect(mockAssentoProps).toHaveBeenLastCalledWith(expect.objectContaining({ isOwner: false }));
    mockAuth = { ...mockAuth, isStaff: true };
    montar(<PaginaBlackFriday />);
    expect(mockAssentoProps).toHaveBeenLastCalledWith(expect.objectContaining({ isOwner: true }));
  });

  it("consolidado: só a ruptura, e nenhum cartão bloqueado no lugar das outras", () => {
    mockAuth = { ...mockAuth, company: null, consolidatedView: true, availableCompanies: [{ id: CID }, { id: "x" }] };
    const r = montar(<PaginaBlackFriday />);
    expect(ids(r, "bf-secao-").filter((i) => !i.endsWith("-por-que"))).toEqual(["bf-secao-ruptura"]);
    expect(textoDe(r.root)).toContain("Consolidado · 2 empresas");
    expect(textoDe(r.root)).not.toMatch(/bloquead|assine|upgrade/i);
  });

  it("membro só com a permissão de estoque: só a ruptura", () => {
    mockVisible = new Set(["estoque", BLACK_FRIDAY_MOD]);
    const r = montar(<PaginaBlackFriday />);
    expect(ids(r, "bf-secao-").filter((i) => !i.endsWith("-por-que"))).toEqual(["bf-secao-ruptura"]);
  });

  it("sem nenhuma função disponível, diz isso em vez de ficar em branco", () => {
    mockVisible = new Set([BLACK_FRIDAY_MOD]);
    const r = montar(<PaginaBlackFriday />);
    expect(r.root.findAllByProps({ testID: "black-friday-sem-secoes" }, { deep: false })).toHaveLength(1);
  });

  it("o placar é o PlacarDoDiaCard real (app#1060), sem slot comentado", () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "components/screens/blackfriday/PaginaBlackFriday.tsx"), "utf8");
    expect(fonte).toContain('import { PlacarDoDiaCard } from "./PlacarDoDiaCard";');
    expect(fs.existsSync(path.join(RAIZ, "components/screens/blackfriday/PlacarDoDiaCard.tsx"))).toBe(true);
  });

  it("sem WhatsApp no plano a seção do placar não existe na página", () => {
    mockVisible = new Set(["estoque", "configuracoes", BLACK_FRIDAY_MOD]);
    const r = montar(<PaginaBlackFriday />);
    expect(r.root.findAllByProps({ testID: "bf-secao-placar" }, { deep: false })).toHaveLength(0);
    expect(r.root.findAllByProps({ testID: "placar-do-dia" }, { deep: false })).toHaveLength(0);
  });
});

describe("vale-troca: espelho do mesmo estado (pdv_settings)", () => {
  function chave(r: renderer.ReactTestRenderer) {
    return r.root.findAllByProps({ testID: "toggle-vale-troca-bf" }, { deep: false })[0];
  }
  const esperar = () => act(async () => { await Promise.resolve(); });

  it("lê o mesmo estado do PdvSettingsCard: ligado por padrão, desligado se pdv_settings diz false", () => {
    expect(chave(montar(<PaginaBlackFriday />)).props.value).toBe(true);
    mockPdv = { vale_troca_enabled: false };
    expect(chave(montar(<PaginaBlackFriday />)).props.value).toBe(false);
  });

  it("desligar aqui grava pdv_settings.vale_troca_enabled com o objeto inteiro e marca a migração", async () => {
    mockPdv = { cash_tender_modal_enabled: true, vale_troca_enabled: true };
    const r = montar(<PaginaBlackFriday />);
    await act(async () => { await chave(r).props.onValueChange(false); });
    expect(mockSalvar).toHaveBeenCalledWith(CID, { cash_tender_modal_enabled: true, vale_troca_enabled: false });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(localStorage.getItem("aura:vale-troca-migrado:" + CID)).toBe("1");
  });

  it("falha ao salvar: avisa e volta ao valor do servidor", async () => {
    mockSalvar.mockRejectedValueOnce({ data: { error: "Sem permissão" } });
    const r = montar(<PaginaBlackFriday />);
    await act(async () => { await chave(r).props.onValueChange(false); });
    await esperar();
    expect(mockToastErro).toHaveBeenCalledWith("Sem permissão");
    expect(chave(r).props.value).toBe(true);
    expect(localStorage.getItem("aura:vale-troca-migrado:" + CID)).toBeNull();
  });

  it("a preferência antiga do navegador ainda vale até a migração (mesma regra do card)", () => {
    localStorage.setItem("aura:vale-troca-no-cupom:" + CID, "0");
    expect(lerValeTrocaLigado(CID, mockPdv)).toBe(false);
    expect(chave(montar(<PaginaBlackFriday />)).props.value).toBe(false);
  });

  it("o texto traz as datas da campanha", () => {
    const r = montar(<PaginaBlackFriday />);
    const t = textoDe(r.root.findAllByProps({ testID: "vale-troca-texto" }, { deep: false })[0]);
    expect(t).toContain("01/11/2026");
    expect(t).toContain("31/12/2026");
    expect(t).toContain("31/01/2027");
  });

  it("usa o mesmo hook e o mesmo serviço do PdvSettingsCard", () => {
    const card = fs.readFileSync(path.join(RAIZ, "components/screens/configuracoes/PdvSettingsCard.tsx"), "utf8");
    const espelho = fs.readFileSync(path.join(RAIZ, "components/screens/blackfriday/ValeTrocaEspelho.tsx"), "utf8");
    [card, espelho].forEach((f) => {
      expect(f).toContain("usePdvSettings");
      expect(f).toContain("pdvSettingsApi.save(");
      expect(f).toContain("marcarValeTrocaMigrado");
      expect(f).toContain("lerValeTrocaLigado(");
    });
  });
});

// ── 4. Configurações: só o atalho ────────────────────────────

describe("atalho em Configurações › Plano", () => {
  it("leva à página Black Friday", () => {
    const r = montar(<AtalhoAssento />);
    const atalho = r.root.findAllByProps({ testID: "atalho-assento-black-friday" }, { deep: false })[0];
    expect(textoDe(atalho)).toContain("Ver na página Black Friday");
    act(() => { atalho.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/black-friday");
  });

  it("some junto com a página: fora do período, sem o módulo ou depois da janela do assento", () => {
    mockVisible = new Set(["estoque", "configuracoes"]);
    expect(montar(<AtalhoAssento />).toJSON()).toBeNull();

    mockVisible = new Set([BLACK_FRIDAY_MOD]);
    jest.useRealTimers();
    fixarHoje("2027-02-01"); // página no ar, assento já encerrado (até 31/01)
    expect(montar(<AtalhoAssento />).toJSON()).toBeNull();

    jest.useRealTimers();
    fixarHoje("2027-02-10"); // página fora do ar
    expect(montar(<AtalhoAssento />).toJSON()).toBeNull();
  });

  it("Configurações não monta mais o cartão — só o atalho", () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "app/(tabs)/configuracoes.tsx"), "utf8");
    expect(fonte).toContain("<AtalhoAssento />");
    expect(fonte).not.toContain("<AssentoTemporadaCard");
  });
});

// ── 5. O Estoque não ganhou nada ─────────────────────────────

describe("Estoque", () => {
  it("as abas continuam Produtos, Alertas e Etiquetas", () => {
    expect(TABS).toEqual(["Produtos", "Alertas", "Etiquetas"]);
  });

  it("a tela de Estoque não conhece a ruptura nem a Black Friday", () => {
    const fonte = fs.readFileSync(path.join(RAIZ, "app/(tabs)/estoque.tsx"), "utf8");
    expect(fonte).not.toMatch(/ruptura|vai faltar|black-friday|blackfriday|black_friday/i);
  });

  it("não existe rota /estoque/ruptura nem módulo estoque.ruptura", () => {
    expect(fs.existsSync(path.join(RAIZ, "app/(tabs)/estoque"))).toBe(false);
    expect(MODULE_PLAN_MAP["estoque.ruptura"]).toBeUndefined();
    expect(LAYOUT).not.toContain("estoque/ruptura");
    expect(PERM_TO_MODULES["estoque"]).toEqual(["estoque", BLACK_FRIDAY_MOD]);
  });
});
