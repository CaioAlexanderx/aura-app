// ============================================================
// Check-in de entrada (cartão t1-12, parte 2; 14/10/2026).
//
// Depois da escolha de frente e antes do Painel: 3 perguntas em chip, nenhum
// campo digitado, "Pular" sempre visível. Contrato fixo com o backend:
//   GET /companies/:id/checkin → { habilitado, respondido, pulou, versao, respostas }
//   PUT /companies/:id/checkin { comeco?, onde_anota?, produtos_faixa?, pulou? }
//
// O que este teste segura:
//   1. quando mostrar e quando esconder (regra pura);
//   2. erro de rede / 404 / formato estranho = não mostrar, nunca bloquear;
//   3. cada chip grava na hora, em PUT parcial; "Pular" grava `pulou: true`;
//   4. opção que o plano não tem SOME (Essencial), nunca desabilitada;
//   5. módulo próprio nos mapas e funcionando no Essencial;
//   6. fonte: sem campo digitado, rotas do contrato, gate no Painel.
// ============================================================
import fs from "fs";
import path from "path";
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

const mockReplace = jest.fn();
// Navegador raiz montado (INC-2026-10-19-02): `key` nula = ainda não montou.
let mockNavState: any = { key: "raiz" };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...a: any[]) => mockReplace(...a), push: jest.fn() }),
  router: { replace: (...a: any[]) => mockReplace(...a) },
  useRootNavigationState: () => mockNavState,
}));

let mockAuth: any;
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) { return typeof selector === "function" ? selector(mockAuth) : mockAuth; },
    { getState: () => mockAuth },
  ),
}));

let mockModulos: Set<string> = new Set();
jest.mock("@/hooks/useVisibleModules", () => {
  const real = jest.requireActual("@/hooks/useVisibleModules");
  return { ...real, useVisibleModules: () => mockModulos };
});

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock("@/services/checkinApi", () => {
  const real = jest.requireActual("@/services/checkinApi");
  return {
    ...real,
    checkinApi: { get: (...a: any[]) => mockGet(...a), put: (...a: any[]) => mockPut(...a) },
  };
});

// 19/10/2026 (tq-31): a loja já tem produto? (destino do "Vender no caixa")
let mockTemProduto: boolean | null = false;
jest.mock("@/hooks/useTemProduto", () => ({
  temProdutoQueryKey: (cid: any) => ["tem-produto", cid || null],
  useTemProduto: () => ({ data: mockTemProduto }),
  garantirTemProduto: () => Promise.resolve(mockTemProduto),
}));

import { CheckinEntrada } from "@/components/onboarding/CheckinEntrada";
import { useCheckinGate, __zerarCheckinDaSessao } from "@/hooks/useCheckin";
import { MOD_CHECKIN, PERGUNTAS_CHECKIN, MAX_RESPOSTA } from "@/constants/checkin";
import { computeVisibleModules, MODULE_PLAN_MAP, PERM_TO_MODULES } from "@/hooks/useVisibleModules";
import {
  abrirCom, corpoCompleto, corpoDaResposta, corpoDoPular, deveMostrarCheckin, lerCheckin,
  opcoesVisiveis, quantasRespostas, type ContextoDoCheckin,
  TEXTOS_ABRIR_COM, TEXTO_ESTOQUE_MEDIO_TQ34,
} from "@/utils/checkinRegras";

const raiz = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const CTX: ContextoDoCheckin = {
  temEmpresa: true, isStaff: false, isDemo: false, consolidado: false, papel: "owner", moduloVisivel: true,
};
const HABILITADO = { habilitado: true, respondido: false, pulou: false, versao: 1, respostas: {} };

// ── 1. regra pura ────────────────────────────────────────────
describe("quando mostrar", () => {
  test("habilitado, sem resposta e sem ter pulado: mostra", () => {
    expect(deveMostrarCheckin(lerCheckin(HABILITADO), CTX)).toBe(true);
  });

  test("desligado (interruptor), respondido ou pulado: esconde", () => {
    expect(deveMostrarCheckin(lerCheckin({ ...HABILITADO, habilitado: false }), CTX)).toBe(false);
    expect(deveMostrarCheckin(lerCheckin({ ...HABILITADO, respondido: true }), CTX)).toBe(false);
    expect(deveMostrarCheckin(lerCheckin({ ...HABILITADO, pulou: true }), CTX)).toBe(false);
  });

  test("sem estado (erro, 404, fora do formato): esconde", () => {
    expect(deveMostrarCheckin(null, CTX)).toBe(false);
    expect(deveMostrarCheckin(undefined, CTX)).toBe(false);
    expect(lerCheckin(undefined)).toBeNull();
    expect(lerCheckin({ error: "Not found" })).toBeNull();
    expect(lerCheckin("habilitado")).toBeNull();
  });

  test("conta interna, demo, consolidado, módulo escondido ou membro comum: esconde", () => {
    const e = lerCheckin(HABILITADO);
    expect(deveMostrarCheckin(e, { ...CTX, isStaff: true })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, isDemo: true })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, consolidado: true })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, moduloVisivel: false })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, temEmpresa: false })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, papel: "vendedor" })).toBe(false);
    expect(deveMostrarCheckin(e, { ...CTX, papel: "admin" })).toBe(true);
    expect(deveMostrarCheckin(e, { ...CTX, papel: undefined })).toBe(true);
  });

  test("lerCheckin descarta resposta fora do limite de 40 caracteres", () => {
    const e = lerCheckin({ ...HABILITADO, respostas: { comeco: "x".repeat(41), onde_anota: "caderno" } });
    expect(e?.respostas).toEqual({ onde_anota: "caderno" });
  });
});

// ── 3. corpo do PUT ──────────────────────────────────────────
describe("PUT parcial", () => {
  test("uma resposta vira um corpo de uma chave só", () => {
    expect(corpoDaResposta("comeco", "estoque")).toEqual({ comeco: "estoque" });
    expect(corpoDaResposta("onde_anota", "planilha")).toEqual({ onde_anota: "planilha" });
    expect(corpoDaResposta("produtos_faixa", "ate_50")).toEqual({ produtos_faixa: "ate_50" });
  });

  test("valor que não é opção da pergunta não vai ao backend", () => {
    expect(corpoDaResposta("comeco", "qualquer coisa")).toBeNull();
    expect(corpoDaResposta("onde_anota", "estoque")).toBeNull();
  });

  test("pular grava só `pulou: true`", () => {
    expect(corpoDoPular()).toEqual({ pulou: true });
  });

  test("reenvio completo leva só o que foi marcado", () => {
    expect(corpoCompleto({ comeco: "caixa", produtos_faixa: "ate_50" })).toEqual({
      comeco: "caixa", produtos_faixa: "ate_50",
    });
    expect(quantasRespostas({ comeco: "caixa" })).toBe(1);
  });

  test("todo valor tem até 40 caracteres e é único dentro da pergunta", () => {
    for (const p of PERGUNTAS_CHECKIN) {
      const valores = p.opcoes.map((o) => o.valor);
      expect(new Set(valores).size).toBe(valores.length);
      valores.forEach((v) => expect(v.length).toBeLessThanOrEqual(MAX_RESPOSTA));
    }
  });
});

// ── 4. plano: some, não desabilita ───────────────────────────
describe("opções por plano", () => {
  const comeco = PERGUNTAS_CHECKIN[0];

  test("Essencial não vê fiado nem loja online; vê o resto que o plano tem", () => {
    const visiveis = computeVisibleModules("essencial", null, undefined);
    const valores = opcoesVisiveis(comeco, visiveis).map((o) => o.valor);
    expect(valores).not.toContain("fiado");
    expect(valores).not.toContain("loja_online");
    expect(valores).toEqual(expect.arrayContaining(["estoque", "caixa", "nota_fiscal", "outra"]));
  });

  test("Negócio vê todas as sete", () => {
    const visiveis = computeVisibleModules("negocio", null, { is_owner: true, permissions: null });
    expect(opcoesVisiveis(comeco, visiveis).map((o) => o.valor)).toEqual([
      "estoque", "caixa", "fiado", "nota_fiscal", "loja_online", "sumidos", "outra",
    ]);
  });

  test("override de módulo também esconde a opção", () => {
    const visiveis = computeVisibleModules("negocio", { crediario: false }, undefined);
    expect(opcoesVisiveis(comeco, visiveis).map((o) => o.valor)).not.toContain("fiado");
  });

  test("as outras duas perguntas valem para todos os planos", () => {
    const visiveis = computeVisibleModules("essencial", null, undefined);
    expect(opcoesVisiveis(PERGUNTAS_CHECKIN[1], visiveis)).toHaveLength(4);
    expect(opcoesVisiveis(PERGUNTAS_CHECKIN[2], visiveis)).toHaveLength(4);
  });
});

// ── "Vamos abrir com" ────────────────────────────────────────
describe("abrirCom", () => {
  test("nada respondido: nada", () => {
    expect(abrirCom({})).toBeNull();
  });

  // 19/10/2026 (tq-31): textos decididos pela Nina, alinhados ao destino.
  const ab = (r: any, o: any = {}) => abrirCom(r, o);

  test("Vender no caixa, sem produto (modo primeira venda e modo fixo)", () => {
    expect(ab({ comeco: "caixa" }, { testeComecaNaVenda: true, temProduto: false })).toEqual({
      titulo: "Cadastrar um produto e fazer a primeira venda",
      sub: "Nome e preço bastam. Sua primeira venda também começa o seu teste.",
    });
    expect(ab({ comeco: "caixa" }, { temProduto: false })).toEqual({
      titulo: "Cadastrar um produto e fazer a primeira venda", sub: "Nome e preço bastam.",
    });
    // sem saber se tem produto: o destino é o cadastro, o texto também
    expect(ab({ comeco: "caixa" }, { testeComecaNaVenda: true })?.titulo).toBe("Cadastrar um produto e fazer a primeira venda");
  });

  test("Vender no caixa, com produto", () => {
    expect(ab({ comeco: "caixa" }, { testeComecaNaVenda: true, temProduto: true })).toEqual({
      titulo: "Fazer a primeira venda no Caixa", sub: "Sua primeira venda também começa o seu teste.",
    });
    // modo fixo: o teste não começa na venda, então sem subtítulo
    expect(ab({ comeco: "caixa" }, { temProduto: true })).toEqual({ titulo: "Fazer a primeira venda no Caixa", sub: "" });
  });

  test("fiado, loja online e sumidos: sem mudança", () => {
    expect(ab({ comeco: "fiado" })).toEqual({ titulo: "Cadastrar um cliente e lançar o primeiro fiado", sub: "Leva uns 2 minutos." });
    expect(ab({ comeco: "loja_online" })).toEqual({ titulo: "Montar sua loja online", sub: "Os produtos que você cadastrar já aparecem nela." });
    expect(ab({ comeco: "sumidos" })).toEqual({
      titulo: "Trazer sua lista de clientes", sub: "Depois você vê quem não volta há 60 dias e chama com um toque.",
    });
  });

  test("nota fiscal e outra coisa", () => {
    expect(ab({ comeco: "nota_fiscal" })).toEqual({
      titulo: "Configurar a nota fiscal", sub: "Você cadastra o certificado ou a Aura ajuda pelo WhatsApp.",
    });
    expect(ab({ comeco: "outra" })).toEqual({ titulo: "Ver o seu Painel", sub: "De lá você faz a primeira venda quando quiser." });
  });

  test("estoque com planilha até 300: importar a planilha", () => {
    const esperado = { titulo: "Importar sua planilha", sub: "Você confere tudo antes de gravar." };
    expect(ab({ comeco: "estoque", onde_anota: "planilha" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", onde_anota: "planilha", produtos_faixa: "ate_50" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", onde_anota: "planilha", produtos_faixa: "de_51_a_300" })).toEqual(esperado);
  });

  test("estoque com mais de 300 ou outro sistema: com a nossa ajuda", () => {
    const esperado = {
      titulo: "Trazer seus produtos com a nossa ajuda",
      sub: "Você manda a planilha ou o arquivo do outro sistema pelo WhatsApp. Costuma levar de uma hora a um dia.",
    };
    expect(ab({ comeco: "estoque", onde_anota: "planilha", produtos_faixa: "de_301_a_1000" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", produtos_faixa: "mais_de_1000" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", onde_anota: "outro_sistema" })).toEqual(esperado);
  });

  test("caderno, ainda não anoto ou 51 a 300 (até o tq-34): os primeiros produtos", () => {
    const esperado = { titulo: "Cadastrar seus primeiros produtos", sub: "Nome e preço bastam. Os outros você traz depois." };
    expect(ab({ comeco: "estoque", onde_anota: "caderno" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", onde_anota: "nao_anoto" })).toEqual(esperado);
    expect(ab({ comeco: "estoque", produtos_faixa: "de_51_a_300" })).toEqual(esperado);
    expect(ab({ produtos_faixa: "ate_50" })).toEqual(esperado);
    expect(TEXTO_ESTOQUE_MEDIO_TQ34).toEqual({
      titulo: "Trazer seus produtos do seu jeito", sub: "Um por um, por planilha ou com a nossa ajuda.",
    });
  });

  test("nenhum texto cita produto de teste nem o teto de 15 dias", () => {
    const todos = JSON.stringify(TEXTOS_ABRIR_COM) + JSON.stringify(TEXTO_ESTOQUE_MEDIO_TQ34);
    expect(todos).not.toMatch(/produto de teste|15 dias|teto/i);
  });
});

// ── 5. módulo próprio ────────────────────────────────────────
describe("módulo próprio (armadilha 3)", () => {
  test("chave nos dois mapas, no Essencial", () => {
    expect(MOD_CHECKIN).toBe("onboarding.checkin");
    expect(MODULE_PLAN_MAP[MOD_CHECKIN]).toBe("essencial");
    expect(PERM_TO_MODULES.configuracoes).toContain(MOD_CHECKIN);
  });

  test("o Essencial vê o módulo; override false esconde; membro sem configurações não", () => {
    expect(computeVisibleModules("essencial", null, undefined).has(MOD_CHECKIN)).toBe(true);
    expect(computeVisibleModules("essencial", { [MOD_CHECKIN]: false }, undefined).has(MOD_CHECKIN)).toBe(false);
    const membro = computeVisibleModules("negocio", null, { is_owner: false, permissions: { pdv: true } });
    expect(membro.has(MOD_CHECKIN)).toBe(false);
  });
});

// ── a tela e o gate, com a rede simulada ─────────────────────
function Sonda() { useCheckinGate(); return null; }

function renderComClient(el: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ui: <QueryClientProvider client={client}>{el}</QueryClientProvider> };
}

function resetar() {
  mockReplace.mockReset(); mockGet.mockReset(); mockPut.mockReset();
  mockPut.mockResolvedValue({ ok: true });
  mockTemProduto = false;
  __zerarCheckinDaSessao();
  mockNavState = { key: "raiz" };
  mockAuth = {
    token: "t", isHydrated: true, isStaff: false, isDemo: false, consolidatedView: false,
    // Conta com frente: as três perguntas de sempre (a da frente, tq-33,
    // tem o próprio teste em checkinFrente.test.tsx).
    company: { id: "loja-1", name: "Loja", plan: "essencial", member_role: "owner", segment: "varejo", trial: { mode: "primeira_venda" } },
  };
  mockModulos = new Set(["estoque", "pdv", "nfe", "painel", MOD_CHECKIN]);
}

async function montar(el: React.ReactElement) {
  const { ui, client } = renderComClient(el);
  let tree: any;
  await act(async () => { tree = renderer.create(ui); });
  // react-query resolve em alguns ticks: esvazia a fila antes de olhar a tela.
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { tree, client };
}
const achar = (t: any, id: string) => t.root.findAllByProps({ testID: id });

describe("a tela", () => {
  beforeEach(resetar);

  test("habilitado: mostra as 3 perguntas, Pular e Continuar apagado", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    expect(achar(tree, "checkin-raiz").length).toBeGreaterThan(0);
    ["comeco", "onde_anota", "produtos_faixa"].forEach((c) =>
      expect(achar(tree, `checkin-pergunta-${c}`).length).toBeGreaterThan(0));
    expect(achar(tree, "checkin-pular").length).toBeGreaterThan(0);
    expect(achar(tree, "checkin-continuar")[0].props.disabled).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("Essencial: as opções que o plano não tem não aparecem (nem desabilitadas)", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    expect(achar(tree, "checkin-chip-comeco-estoque").length).toBeGreaterThan(0);
    expect(achar(tree, "checkin-chip-comeco-fiado").length).toBe(0);
    expect(achar(tree, "checkin-chip-comeco-loja_online").length).toBe(0);
    tree.unmount();
  });

  test("cada chip grava na hora, em PUT parcial, e o Continuar libera", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    await act(async () => { achar(tree, "checkin-chip-comeco-estoque")[0].props.onPress(); });
    expect(mockPut).toHaveBeenLastCalledWith("loja-1", { comeco: "estoque" });
    await act(async () => { achar(tree, "checkin-chip-onde_anota-planilha")[0].props.onPress(); });
    expect(mockPut).toHaveBeenLastCalledWith("loja-1", { onde_anota: "planilha" });
    await act(async () => { achar(tree, "checkin-chip-produtos_faixa-de_301_a_1000")[0].props.onPress(); });
    expect(mockPut).toHaveBeenLastCalledWith("loja-1", { produtos_faixa: "de_301_a_1000" });
    expect(mockPut).toHaveBeenCalledTimes(3);
    expect(achar(tree, "checkin-continuar")[0].props.disabled).toBe(false);
    expect(achar(tree, "checkin-abrir-com").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("trocar a resposta regrava só aquela chave", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    await act(async () => { achar(tree, "checkin-chip-comeco-estoque")[0].props.onPress(); });
    await act(async () => { achar(tree, "checkin-chip-comeco-caixa")[0].props.onPress(); });
    expect(mockPut).toHaveBeenLastCalledWith("loja-1", { comeco: "caixa" });
    tree.unmount();
  });

  // 19/10/2026 (tq-31): o Continuar leva à tela da resposta.
  async function continuarCom(chips: string[]) {
    const m = await montar(<CheckinEntrada />);
    for (const id of chips) await act(async () => { achar(m.tree, id)[0].props.onPress(); });
    await act(async () => { await achar(m.tree, "checkin-continuar")[0].props.onPress(); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return m;
  }

  test("Continuar com 'Outra coisa' segue para o Painel e não repete a tela", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree, client } = await continuarCom(["checkin-chip-comeco-outra"]);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect((client.getQueryData(["checkin", "loja-1"]) as any).respondido).toBe(true);
    tree.unmount();
  });

  test("Continuar com 'Vender no caixa', sem produto: cadastro do primeiro produto e depois o Caixa", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await continuarCom(["checkin-chip-comeco-caixa"]);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/estoque?novo=produto&depois=pdv");
    tree.unmount();
  });

  test("Continuar com 'Vender no caixa', com produto: direto ao Caixa", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    mockTemProduto = true;
    const { tree } = await continuarCom(["checkin-chip-comeco-caixa"]);
    expect(mockReplace).toHaveBeenCalledWith("/pdv");
    tree.unmount();
  });

  test("Continuar com estoque grande: abre o WhatsApp da Aura no mesmo toque e o cadastro", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const abrir = jest.spyOn(window, "open").mockImplementation(() => null);
    const { tree } = await continuarCom([
      "checkin-chip-comeco-estoque", "checkin-chip-onde_anota-outro_sistema", "checkin-chip-produtos_faixa-mais_de_1000",
    ]);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(String(abrir.mock.calls[0][0])).toMatch(/^https:\/\/wa\.me\/5511956305269\?text=/);
    expect(mockReplace).toHaveBeenCalledWith("/estoque?novo=produto");
    abrir.mockRestore();
    tree.unmount();
  });

  test("Continuar com estoque em planilha (até 300): abre a importação de planilha do Estoque", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await continuarCom([
      "checkin-chip-comeco-estoque", "checkin-chip-onde_anota-planilha", "checkin-chip-produtos_faixa-de_51_a_300",
    ]);
    expect(JSON.stringify(tree.toJSON())).not.toContain("checkin-raiz");
    expect(mockReplace).toHaveBeenCalledWith("/estoque?importar=planilha");
    tree.unmount();
  });

  test("o 'Vamos abrir com' muda com a loja já tendo produto", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    mockTemProduto = true;
    const { tree } = await montar(<CheckinEntrada />);
    await act(async () => { achar(tree, "checkin-chip-comeco-caixa")[0].props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Fazer a primeira venda no Caixa");
    expect(json).toContain("Sua primeira venda também começa o seu teste.");
    tree.unmount();
  });

  test("Continuar com 'Emitir nota fiscal': aba Certificado A1", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await continuarCom(["checkin-chip-comeco-nota_fiscal"]);
    expect(mockReplace).toHaveBeenCalledWith("/nfe?tab=certificado");
    tree.unmount();
  });

  test("Continuar com 'Controlar fiado' no Negócio: Novo lançamento do crediário", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    mockModulos = new Set(["estoque", "pdv", "nfe", "painel", "crediario", MOD_CHECKIN]);
    const { tree } = await continuarCom(["checkin-chip-comeco-fiado"]);
    expect(mockReplace).toHaveBeenCalledWith("/crediario?novo=1");
    tree.unmount();
  });

  test("o plano é revalidado no mount e o Continuar espera a revalidação", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    let soltar: () => void = () => {};
    mockAuth.refreshMe = jest.fn(() => new Promise<void>((r) => { soltar = r; }));
    const { tree } = await montar(<CheckinEntrada />);
    expect(mockAuth.refreshMe).toHaveBeenCalledTimes(1);
    await act(async () => { achar(tree, "checkin-chip-comeco-nota_fiscal")[0].props.onPress(); });
    await act(async () => { achar(tree, "checkin-continuar")[0].props.onPress(); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { soltar(); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockReplace).toHaveBeenCalledWith("/nfe?tab=certificado");
    tree.unmount();
  });

  test("Pular grava `pulou: true` e segue sem esperar a rede", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    mockPut.mockReturnValue(new Promise(() => {})); // nunca resolve
    const { tree, client } = await montar(<CheckinEntrada />);
    await act(async () => { achar(tree, "checkin-pular")[0].props.onPress(); });
    expect(mockPut).toHaveBeenCalledWith("loja-1", { pulou: true });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect((client.getQueryData(["checkin", "loja-1"]) as any).pulou).toBe(true);
    tree.unmount();
  });

  test("PUT que falha não derruba a tela; o Continuar reenvia tudo", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    mockPut.mockRejectedValueOnce(new Error("rede"));
    await act(async () => { achar(tree, "checkin-chip-comeco-caixa")[0].props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    mockPut.mockResolvedValue({ ok: true });
    await act(async () => { await achar(tree, "checkin-continuar")[0].props.onPress(); });
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockPut).toHaveBeenLastCalledWith("loja-1", { comeco: "caixa" });
    expect(mockReplace).toHaveBeenCalledWith("/estoque?novo=produto&depois=pdv");
    tree.unmount();
  });

  test("retoma o que já estava gravado", async () => {
    mockGet.mockResolvedValue({ ...HABILITADO, respostas: { comeco: "caixa" } });
    const { tree } = await montar(<CheckinEntrada />);
    const chip = achar(tree, "checkin-chip-comeco-caixa")[0];
    expect(chip.props.accessibilityState.selected).toBe(true);
    expect(achar(tree, "checkin-continuar")[0].props.disabled).toBe(false);
    tree.unmount();
  });

  test("backend sem a rota (404/erro): vai direto ao Painel, sem mostrar nada", async () => {
    mockGet.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    const { tree } = await montar(<CheckinEntrada />);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(achar(tree, "checkin-raiz").length).toBe(0);
    tree.unmount();
  });

  test("interruptor desligado ou já respondido: vai direto ao Painel", async () => {
    mockGet.mockResolvedValue({ ...HABILITADO, habilitado: false });
    const a = await montar(<CheckinEntrada />);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    a.tree.unmount();

    mockReplace.mockReset();
    mockGet.mockResolvedValue({ ...HABILITADO, respondido: true });
    const b = await montar(<CheckinEntrada />);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    b.tree.unmount();
  });

  test("nenhum campo digitado na tela", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montar(<CheckinEntrada />);
    expect(tree.root.findAllByType("input" as any).length).toBe(0);
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/"type":"input"|textarea/);
    tree.unmount();
  });
});

// ── INC-2026-10-19-02: recarga direto em /checkin ───────────
// O <Slot/> do layout raiz mostra /checkin antes de a sessão voltar
// (isHydrated falso, company nula) e antes de o navegador raiz montar. Um
// router.replace nessa hora lança "Attempted to navigate before mounting the
// Root Layout component" e a pessoa via "Algo deu errado".
describe("recarga direto na rota", () => {
  beforeEach(resetar);

  function antesDaSessao() {
    mockAuth = { ...mockAuth, isHydrated: false, token: null, company: null };
    mockNavState = undefined;
  }
  function sessaoRestaurada(company: any) {
    mockAuth = { ...mockAuth, isHydrated: true, token: "t", company };
    mockNavState = { key: "raiz" };
  }
  const LOJA = { id: "loja-1", name: "Loja", plan: "essencial", member_role: "owner", segment: "varejo" };

  async function montarAntesDaSessao() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = () => <QueryClientProvider client={client}><CheckinEntrada /></QueryClientProvider>;
    let tree: any;
    await act(async () => { tree = renderer.create(ui()); });
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const atualizar = async () => {
      await act(async () => { tree.update(ui()); });
      for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };
    return { tree, atualizar };
  }

  test("sessão ainda não restaurada: não navega, não consulta e mostra o carregando", async () => {
    antesDaSessao();
    mockGet.mockResolvedValue(HABILITADO);
    const { tree } = await montarAntesDaSessao();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(achar(tree, "checkin-carregando").length).toBeGreaterThan(0);
    expect(achar(tree, "checkin-raiz").length).toBe(0);
    tree.unmount();
  });

  test("sessão restaurada mas navegador raiz ainda não montado: não navega", async () => {
    antesDaSessao();
    mockAuth = { ...mockAuth, isHydrated: true, token: "t", company: null };
    mockNavState = { key: undefined };
    const { tree } = await montarAntesDaSessao();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(achar(tree, "checkin-carregando").length).toBeGreaterThan(0);
    tree.unmount();
  });

  test("depois de restaurar, com check-in pendente: mostra as perguntas e fica na tela", async () => {
    antesDaSessao();
    mockGet.mockResolvedValue(HABILITADO);
    const m = await montarAntesDaSessao();
    expect(mockReplace).not.toHaveBeenCalled();
    sessaoRestaurada(LOJA);
    await m.atualizar();
    expect(mockGet).toHaveBeenCalledWith("loja-1");
    expect(achar(m.tree, "checkin-raiz").length).toBeGreaterThan(0);
    ["comeco", "onde_anota", "produtos_faixa"].forEach((c) =>
      expect(achar(m.tree, `checkin-pergunta-${c}`).length).toBeGreaterThan(0));
    expect(mockReplace).not.toHaveBeenCalled();
    m.tree.unmount();
  });

  test("depois de restaurar, sem empresa: vai ao Painel só depois de pronto", async () => {
    antesDaSessao();
    const m = await montarAntesDaSessao();
    expect(mockReplace).not.toHaveBeenCalled();
    sessaoRestaurada(null);
    await m.atualizar();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    m.tree.unmount();
  });

  test("depois de restaurar, com check-in já respondido: vai ao Painel só depois de pronto", async () => {
    antesDaSessao();
    mockGet.mockResolvedValue({ ...HABILITADO, respondido: true });
    const m = await montarAntesDaSessao();
    expect(mockReplace).not.toHaveBeenCalled();
    sessaoRestaurada(LOJA);
    await m.atualizar();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    m.tree.unmount();
  });
});

describe("o gate do Painel", () => {
  beforeEach(resetar);

  test("habilitado: leva a /checkin uma vez só", async () => {
    mockGet.mockResolvedValue(HABILITADO);
    const a = await montar(<Sonda />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/checkin");
    await act(async () => { a.tree.unmount(); });
    const b = await montar(<Sonda />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    b.tree.unmount();
  });

  test("backend sem a rota ou com erro: o Painel segue sem redirecionar", async () => {
    mockGet.mockRejectedValue(new Error("rede"));
    const { tree } = await montar(<Sonda />);
    expect(mockGet).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    tree.unmount();
  });

  test("desligado, respondido ou pulado: não leva", async () => {
    for (const estado of [
      { ...HABILITADO, habilitado: false }, { ...HABILITADO, respondido: true }, { ...HABILITADO, pulou: true },
    ]) {
      resetar();
      mockGet.mockResolvedValue(estado);
      const { tree } = await montar(<Sonda />);
      expect(mockReplace).not.toHaveBeenCalled();
      tree.unmount();
    }
  });

  test("conta interna, consolidado, membro comum ou módulo escondido: nem consulta", async () => {
    const casos: Array<() => void> = [
      () => { mockAuth.isStaff = true; },
      () => { mockAuth.consolidatedView = true; },
      () => { mockAuth.company.member_role = "vendedor"; },
      () => { mockModulos = new Set(["painel"]); },
    ];
    for (const ajusta of casos) {
      resetar();
      ajusta();
      mockGet.mockResolvedValue(HABILITADO);
      const { tree } = await montar(<Sonda />);
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      tree.unmount();
    }
  });
});

// ── 6. fonte ─────────────────────────────────────────────────
describe("fonte", () => {
  test("a tela não tem campo digitado", () => {
    const src = raiz("components/onboarding/CheckinEntrada.tsx");
    expect(src).not.toMatch(/TextInput|<input|keyboardType/);
  });

  test("rotas do contrato com o backend, sem renomear", () => {
    const src = raiz("services/checkinApi.ts");
    expect(src).toContain('"/companies/" + companyId + "/checkin"');
    expect(src).toContain('method: "PUT"');
    ["comeco", "onde_anota", "produtos_faixa", "pulou"].forEach((c) => expect(src).toContain(c));
  });

  test("o Painel chama o gate e a rota /checkin existe", () => {
    const painel = raiz("app/(tabs)/index.tsx");
    expect(painel).toContain('import { useCheckinGate } from "@/hooks/useCheckin";');
    expect(painel).toContain("useCheckinGate();");
    expect(fs.existsSync(path.join(__dirname, "..", "app/checkin.tsx"))).toBe(true);
  });
});
