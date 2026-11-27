// ============================================================
// Teclado no computador (padrão ARIA) nas telas de Configurações do WhatsApp
//
// Eventos reais de teclado no DOM (react-dom + KeyboardEvent): abas, escolhas
// únicas (radiogroup), pontos da régua (grupo de caixas), + e − da divisão
// (spinbutton), foco visível e Esc no Editor.
// ============================================================
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/hooks/useClientesPrevia", () => ({ useClientesPrevia: () => [] }));
jest.mock("@/hooks/useWaPacotes", () => ({
  useWaPacotes: () => ({ comprar: () => {}, comprando: null, erro: null, abaBloqueada: false, manual: null, pendentes: [], abrir: () => {} }),
}));
const mockPub: any = { current: null };
const mockModelos: any = { current: null };
jest.mock("@/hooks/useWaAutomatica", () => ({ useWaPublico: () => mockPub.current, useWaModelos: () => mockModelos.current }));

import { AbasWa } from "@/components/whatsapp/CabecalhoWa";
import { Pilulas } from "@/components/whatsapp/configUi";
import { AutomaticasCard } from "@/components/whatsapp/AutomaticasCard";
import { CrediarioConfig } from "@/components/whatsapp/CrediarioConfig";
import { EditorMensagem } from "@/components/whatsapp/EditorMensagem";
import { useWaKeyframes } from "@/components/whatsapp/waVisual";
import { DIVISAO_PADRAO, lerAutomaticas } from "@/components/whatsapp/waDivisao";
import { waCorte } from "@/components/whatsapp/waCorte";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: any;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => { root.unmount(); }); host.remove(); });

async function montar(el: React.ReactElement) { await act(async () => { root.render(el); }); }
function tecla(el: Element, key: string) {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}
const q = (sel: string) => host.querySelector(sel) as HTMLElement;
const qa = (sel: string) => Array.from(host.querySelectorAll(sel)) as HTMLElement[];

const TABS = [
  { key: "conversas", label: "Conversas", testID: "t-conversas" },
  { key: "automaticas", label: "Automáticas", testID: "t-automaticas" },
  { key: "venda_mais", label: "Venda+", testID: "t-venda" },
  { key: "config", label: "Configurações", testID: "t-config" },
];

describe("abas do topo (tablist)", () => {
  it("o DOM sai com os papéis certos e uma só parada de Tab", async () => {
    await montar(<AbasWa tabs={TABS} ativa="venda_mais" onSelect={() => {}} />);
    expect(q('[role="tablist"]')).toBeTruthy();
    const abas = qa('[role="tab"]');
    expect(abas.length).toBe(4);
    expect(abas.map((a) => a.getAttribute("tabindex"))).toEqual(["-1", "-1", "0", "-1"]); // tabindex móvel: só a ativa
    expect(abas[2].getAttribute("aria-selected")).toBe("true");
    expect(abas[0].getAttribute("aria-selected")).toBe("false");
    expect(q("#wa-tab-venda_mais")).toBe(abas[2]);
  });

  it("← → movem o foco e ativam; Home e End vão às pontas; as pontas dão a volta", async () => {
    const onSelect = jest.fn();
    await montar(<AbasWa tabs={TABS} ativa="venda_mais" onSelect={onSelect} />);
    const abas = qa('[role="tab"]');
    abas[2].focus();
    const ev = tecla(abas[2], "ArrowRight");
    expect(ev.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith("config");
    expect(document.activeElement).toBe(abas[3]);
    tecla(abas[3], "ArrowRight"); // dá a volta
    expect(onSelect).toHaveBeenLastCalledWith("conversas");
    tecla(abas[0], "ArrowLeft"); // dá a volta para trás
    expect(onSelect).toHaveBeenLastCalledWith("config");
    tecla(abas[2], "Home");
    expect(onSelect).toHaveBeenLastCalledWith("conversas");
    tecla(abas[0], "End");
    expect(onSelect).toHaveBeenLastCalledWith("config");
    expect(document.activeElement).toBe(abas[3]);
  });

  it("Enter e Espaço ativam a aba focada", async () => {
    const onSelect = jest.fn();
    await montar(<AbasWa tabs={TABS} ativa="conversas" onSelect={onSelect} />);
    const abas = qa('[role="tab"]');
    tecla(abas[1], "Enter");
    expect(onSelect).toHaveBeenLastCalledWith("automaticas");
    tecla(abas[3], " ");
    expect(onSelect).toHaveBeenLastCalledWith("config");
  });

  it("o Guias fica fora da lista de abas e tem nome", async () => {
    await montar(<AbasWa tabs={TABS} ativa="conversas" onSelect={() => {}} />);
    const guias = q('[data-testid="wa-varejo-guias"]');
    expect(guias.getAttribute("aria-label")).toBe("Guias");
    expect(q('[role="tablist"]').contains(guias)).toBe(false);
  });
});

describe("escolha única (radiogroup)", () => {
  const OPC = [{ valor: "a", rotulo: "Carinhoso" }, { valor: "b", rotulo: "Direto" }, { valor: "c", rotulo: "Animado" }];
  it("papéis, aria-checked e tabindex móvel", async () => {
    await montar(<Pilulas idBase="x" rotulo="Jeito de falar" opcoes={OPC} valor="b" onPick={() => {}} />);
    expect(q('[role="radiogroup"]').getAttribute("aria-label")).toBe("Jeito de falar");
    const r = qa('[role="radio"]');
    expect(r.map((x) => x.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(r.map((x) => x.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
  });
  it("as setas mudam a seleção (e Home/End vão às pontas)", async () => {
    const onPick = jest.fn();
    await montar(<Pilulas idBase="x" opcoes={OPC} valor="a" onPick={onPick} />);
    const r = qa('[role="radio"]');
    r[0].focus();
    tecla(r[0], "ArrowRight");
    expect(onPick).toHaveBeenLastCalledWith("b");
    expect(document.activeElement).toBe(r[1]);
    tecla(r[1], "ArrowDown");
    expect(onPick).toHaveBeenLastCalledWith("c");
    tecla(r[2], "ArrowRight"); // dá a volta
    expect(onPick).toHaveBeenLastCalledWith("a");
    tecla(r[0], "End");
    expect(onPick).toHaveBeenLastCalledWith("c");
    tecla(r[2], "Home");
    expect(onPick).toHaveBeenLastCalledWith("a");
  });
  it("desabilitado não muda nada", async () => {
    const onPick = jest.fn();
    await montar(<Pilulas idBase="x" opcoes={OPC} valor="a" onPick={onPick} desabilitado />);
    tecla(qa('[role="radio"]')[0], "ArrowRight");
    expect(onPick).not.toHaveBeenCalled();
  });
});

function autoComSobra(sobra: number) {
  const div = { aniversario: 4, venda_mais: 4 - sobra, crediario: 2 };
  const raw = {
    mes: "2026-12", aceite_novidades_em: "2026-12-01T00:00:00Z",
    novidades: { total: 10, livres: 10, divisao: div, usadas: { aniversario: 1, venda_mais: 0, crediario: 0 }, sem_dono: sobra },
    automaticas: [
      { key: "aniversario", ligada: false, livres: 3, config: {} }, { key: "venda_mais", ligada: false, livres: 4, config: {} },
      { key: "crediario_cobrar", ligada: true, config: { pontos: { antes3: true, dia: true, depois1: true, depois7: false, depois15: false } } },
      { key: "crediario_vender", ligada: false, livres: 2, config: {} },
    ],
  };
  return {
    info: lerAutomaticas(raw), carregando: false, falhou: false, salvando: false, erro: null,
    recarregar: jest.fn(), ajustar: jest.fn(), aplicarDivisao: jest.fn(() => Promise.resolve(true)),
    ligar: jest.fn(() => Promise.resolve({ ok: true, code: null })), salvarConfig: jest.fn(() => Promise.resolve({ ok: true, code: null })),
  } as any;
}

describe("+ e − da divisão (spinbutton)", () => {
  it("o valor expõe aria-valuenow, min e max; ↑ ↓ mudam com as mesmas travas", async () => {
    const a = autoComSobra(2); // 2 novidades sem dono: dá para subir
    await montar(<AutomaticasCard auto={a} />);
    const v = q('[data-testid="wa-auto-valor-aniversario"]');
    expect(v.getAttribute("role")).toBe("spinbutton");
    expect(v.getAttribute("tabindex")).toBe("0");
    expect(v.getAttribute("aria-valuenow")).toBe("4");
    expect(v.getAttribute("aria-valuemin")).toBe("1"); // 1 já usada: não desce abaixo
    expect(v.getAttribute("aria-valuemax")).toBe("6"); // 4 + 2 sem dono
    tecla(v, "ArrowUp");
    expect(a.ajustar).toHaveBeenLastCalledWith("aniversario", 1);
    tecla(v, "ArrowDown");
    expect(a.ajustar).toHaveBeenLastCalledWith("aniversario", -1);
  });
  it("sem sobra, ↑ não faz nada; no mínimo (usadas), ↓ não faz nada", async () => {
    const a = autoComSobra(0);
    await montar(<AutomaticasCard auto={a} />);
    tecla(q('[data-testid="wa-auto-valor-aniversario"]'), "ArrowUp");
    expect(a.ajustar).not.toHaveBeenCalled();
    const b = autoComSobra(0);
    b.info.divisao.venda_mais = 0; // Venda+ já no mínimo (0 usadas)
    await montar(<AutomaticasCard auto={b} />);
    tecla(q('[data-testid="wa-auto-valor-venda_mais"]'), "ArrowDown");
    expect(b.ajustar).not.toHaveBeenCalled();
  });
  it("os botões + e − saem da ordem do Tab (o foco vai no valor)", async () => {
    await montar(<AutomaticasCard auto={autoComSobra(1)} />);
    expect(q('[data-testid="wa-auto-mais-aniversario"]').getAttribute("tabindex")).toBe("-1");
    expect(q('[data-testid="wa-auto-menos-aniversario"]').getAttribute("tabindex")).toBe("-1");
  });
});

describe("pontos da régua (grupo de caixas)", () => {
  it("uma parada de Tab; as setas só movem o foco; nada é gravado sem Espaço", async () => {
    const a = autoComSobra(0);
    mockPub.current = { publico: null, corte: waCorte(null as any, 0), carregando: false, falhou: false, enviando: false, erro: null, enviado: null, recarregar: () => {}, enviarAgora: () => {} };
    mockModelos.current = { modelos: [], carregando: false, recarregar: () => {} };
    await montar(<CrediarioConfig companyId="c" auto={a} saldo={null} status={null} lojaNome="Lume" />);
    expect(q('[role="group"]')).toBeTruthy();
    const c = qa('[data-testid^="wa-cred-ponto-"]');
    expect(c.length).toBe(5);
    expect(c.map((x) => x.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    c[0].focus();
    tecla(c[0], "ArrowRight");
    expect(document.activeElement).toBe(c[1]);
    tecla(c[1], "End");
    expect(document.activeElement).toBe(c[4]);
    expect(a.salvarConfig).not.toHaveBeenCalled();
  });
});

describe("foco visível e Esc", () => {
  it("o foco visível de 2 px #c4b5fd entra na página junto com as keyframes", async () => {
    function Teste() { useWaKeyframes(); return null; }
    await montar(<Teste />);
    const css = document.getElementById("wa-keyframes")?.textContent || "";
    expect(css).toContain("[data-wa-root] :focus-visible{outline:2px solid #c4b5fd");
  });

  it("Esc no Editor volta (fecha)", async () => {
    const onFechar = jest.fn();
    const modelo: any = {
      key: "cred_antes", automatica: "crediario", titulo: "Antes do vencimento", categoria: "UTILITY", campos: ["Nome", "Valor"],
      texto_padrao: "Oi, {Nome}. Valor {Valor}.", texto_em_uso: "Oi, {Nome}. Valor {Valor}.", texto_novo: null, estado: "PRONTA",
      edicao: { pode: true, proxima_em: null, restam_30_dias: 10 },
    };
    await montar(<EditorMensagem companyId="c" modelo={modelo} clientes={[]} onFechar={onFechar} onMudou={() => {}} />);
    const raiz = q('[data-testid="wa-editor"]');
    tecla(raiz.querySelector('[data-testid="wa-editor-campo-Nome"]') as Element, "Escape");
    expect(onFechar).toHaveBeenCalled();
  });
});
