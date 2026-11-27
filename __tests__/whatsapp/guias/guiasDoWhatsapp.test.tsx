// Guias do WhatsApp (27/11/2026): o texto e o alvo de cada balão (artboard GuiaPassos),
// o que cada pessoa já viu, o "comece aqui" do menu e o motor (pula alvo ausente, executa e avança pelo estado).
import React from "react";
import fs from "fs";
import path from "path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { guia1, guia2, guia3, guiaDe, MENU_GUIAS, type GuiaCtx } from "@/components/whatsapp/guias/guiasConteudo";
import { proximoGuia, rotuloVisto, lerVistos, gravarVistos } from "@/utils/waGuiasVistos";
import { podeVerAnuncio } from "@/components/whatsapp/guias/GuiaAnuncio";
import { posicionaBalao } from "@/components/whatsapp/guias/guiaVisual";
import { GuiaTour } from "@/components/whatsapp/guias/GuiaTour";
import { GuiaMenu } from "@/components/whatsapp/guias/GuiaMenu";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ usePathname: () => "/", useRouter: () => ({ push: jest.fn() }), router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { id: "u1", is_staff: true }, company: {}, isDemo: false, consolidatedView: false }) }));
jest.mock("@/hooks/useVisibleModules", () => ({ useVisibleModules: () => new Set(["whatsapp", "clientes"]) }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const montados: { root: Root; host: HTMLElement }[] = [];
/** Monta no DOM de verdade (os balões usam portal no body, que o renderer de teste não suporta). */
function monta(el: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  montados.push({ root, host });
  act(() => { root.render(el); });
  return { atualiza: (n: React.ReactElement) => act(() => { root.render(n); }), desmonta: () => act(() => { root.unmount(); }) };
}

const RAIZ = path.resolve(__dirname, "../../..");

function ctxBase(extra: Partial<GuiaCtx> = {}): GuiaCtx {
  return {
    companyId: "c1", lojaNome: "Lume Moda", status: { connected: false } as any, conectado: false, telefone: "",
    auto: { info: null, carregando: false, falhou: false, salvando: false, erro: null, recarregar: jest.fn(), ajustar: jest.fn(), aplicarDivisao: jest.fn(), ligar: jest.fn(), salvarConfig: jest.fn() } as any,
    saldo: null, hubVisible: true, celular: false, produtosEnviados: 0, irPara: jest.fn(), ...extra,
  };
}

function alvo(chave: string, w = 120, h = 40) {
  const d = document.createElement("div");
  d.setAttribute("data-tour", chave);
  (d as any).getBoundingClientRect = () => ({ left: 100, top: 100, width: w, height: h, right: 100 + w, bottom: 100 + h, x: 100, y: 100 });
  (d as any).scrollIntoView = jest.fn();
  document.body.appendChild(d);
  return d;
}

afterEach(() => { montados.splice(0).forEach((m) => { try { act(() => { m.root.unmount(); }); } catch { /* ok */ } }); document.body.innerHTML = ""; try { localStorage.clear(); } catch { /* ok */ } jest.useRealTimers(); });

describe("o texto e o alvo de cada balão", () => {
  it("guia 1 tem 4 passos; guia 2, 7 (Venda+ e Pronto do GuiaExecucao); guia 3, 6", () => {
    expect(guia1(false).passos).toHaveLength(4);
    expect(guia2().passos).toHaveLength(7);
    expect(guia3().passos).toHaveLength(6);
  });
  it("alvos na ordem do artboard", () => {
    expect(guia1(false).passos.map((p) => p.alvo ?? "(centro)")).toEqual(["wa.conexao", "wa.conectar", "(centro)", "wa.saldos"]);
    expect(guia2().passos.map((p) => p.alvo)).toEqual(["wa.saldos", "wa.divisao", "wa.auto.aniversario", "wa.crediario.linha", "wa.auto.venda_mais", "wa.editar", "wa.auto.cartoes"]);
    expect(guia3().passos.map((p) => p.alvo)).toEqual(["wa.lista", "wa.janela", "wa.acoes", "wa.microfone", "wa.ligar_cadastro", "wa.convite"]);
  });
  it("textos finais (amostra literal do artboard)", () => {
    expect(guia1(false).passos[1].corpo).toBe("Abre uma janela do Facebook: é por ela que o WhatsApp confirma que o número é da loja. Se a janela não abrir, libere janelas da Aura no navegador.");
    expect(guia2().passos[1].titulo).toBe("As 10 novidades já vêm divididas");
    expect(guia3().passos[5].corpo).toContain("gasta 1 aviso");
    expect(guia1(false).passos[3].cta).toBe("Ligar as automáticas");
  });
  it("no celular o guia 1 vira um passo só", () => {
    const g = guia1(true);
    expect(g.passos).toHaveLength(1);
    expect(g.passos[0].corpo).toBe("Conecte pelo computador, a janela do Facebook não abre no celular.");
    expect(guiaDe(1, true).passos).toHaveLength(1);
  });
  it("todo alvo wa.* dos guias está marcado no código da tela", () => {
    const fontes = ["components", "app"].flatMap((d) => {
      const out: string[] = [];
      const anda = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        if (e.name === "node_modules" || e.name === "__tests__") return;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) anda(f); else if (/\.tsx?$/.test(e.name)) out.push(fs.readFileSync(f, "utf8"));
      });
      anda(path.join(RAIZ, d));
      return out;
    }).join("\n");
    const chaves = new Set<string>(["wa.guias", "nav.whatsapp", "nav.mais"]);
    [guia1(false), guia2(), guia3()].forEach((g) => g.passos.forEach((p) => { if (p.alvo) chaves.add(p.alvo); }));
    chaves.forEach((k) => { expect(fontes).toContain(k); });
  });
});

describe("o que cada pessoa já viu", () => {
  it("guarda por pessoa e lê de volta", () => {
    gravarVistos("u1", { g1: 123, anuncio: 456 });
    expect(lerVistos("u1")).toEqual({ g1: 123, anuncio: 456 });
    expect(lerVistos("u2")).toEqual({});
    expect(lerVistos(null)).toEqual({});
  });
  it("storage torto não derruba", () => {
    localStorage.setItem("aura:wa-guias:v1:u3", "{nao e json");
    expect(lerVistos("u3")).toEqual({});
  });
  it("visto hoje, ontem, há N dias", () => {
    const agora = new Date(2026, 10, 27, 15, 0).getTime();
    expect(rotuloVisto(new Date(2026, 10, 27, 9, 0).getTime(), agora)).toBe("visto hoje");
    expect(rotuloVisto(new Date(2026, 10, 26, 23, 0).getTime(), agora)).toBe("visto ontem");
    expect(rotuloVisto(new Date(2026, 10, 24, 10, 0).getTime(), agora)).toBe("visto há 3 dias");
    expect(rotuloVisto(new Date(2026, 10, 5, 10, 0).getTime(), agora)).toBe("visto em 05/11");
  });
  it("comece aqui: sem número é o 1; conectado, o 2 e depois o 3", () => {
    expect(proximoGuia(false, {})).toBe(1);
    expect(proximoGuia(false, { g1: 1 })).toBe(1);
    expect(proximoGuia(true, {})).toBe(2);
    expect(proximoGuia(true, { g2: 1 })).toBe(3);
    expect(proximoGuia(true, { g2: 1, g3: 1 })).toBeNull();
    expect(proximoGuia(true, { g2: 1 }, [1, 2])).toBeNull();
  });
});

describe("quem vê o anúncio", () => {
  const base = { user: { is_staff: true }, company: {}, consolidado: false, demo: false, modulos: new Set(["whatsapp", "clientes"]), jaVisto: false };
  it("equipe com WhatsApp no plano e permissão de Clientes", () => { expect(podeVerAnuncio(base)).toBe(true); });
  it("sem WhatsApp no plano ou sem permissão de Clientes, não", () => {
    expect(podeVerAnuncio({ ...base, modulos: new Set(["clientes"]) })).toBe(false);
    expect(podeVerAnuncio({ ...base, modulos: new Set(["whatsapp"]) })).toBe(false);
  });
  it("trava: loja comum não vê; sandbox vê", () => {
    expect(podeVerAnuncio({ ...base, user: { is_staff: false } })).toBe(false);
    expect(podeVerAnuncio({ ...base, user: { is_staff: false }, company: { is_sandbox: true } })).toBe(true);
  });
  it("uma vez só, e nunca no demo nem no consolidado", () => {
    expect(podeVerAnuncio({ ...base, jaVisto: true })).toBe(false);
    expect(podeVerAnuncio({ ...base, demo: true })).toBe(false);
    expect(podeVerAnuncio({ ...base, consolidado: true })).toBe(false);
  });
});

describe("onde o balão cai", () => {
  it("à direita do menu quando cabe (artboard do anúncio)", () => {
    const p = posicionaBalao({ x: 10, y: 500, w: 228, h: 48 }, 1440, 900, 220, 380);
    expect(p.lado).toBe("right");
    expect(p.left).toBe(10 + 228 + 18);
  });
  it("no celular vai abaixo ou acima, nunca fora da tela", () => {
    const p = posicionaBalao({ x: 300, y: 780, w: 60, h: 50 }, 390, 844, 260, 400);
    expect(["top", "bottom"]).toContain(p.lado);
    expect(p.left).toBeGreaterThanOrEqual(16);
    expect(p.left + p.largura).toBeLessThanOrEqual(390 - 16);
  });
  it("sem alvo, no meio", () => { expect(posicionaBalao(null, 1000, 800, 200, 400).lado).toBe("centro"); });
});

describe("o menu de guias", () => {
  it("lista os três, destaca o próximo e mostra o ✓ do que foi visto", () => {
    const ontem = Date.now() - 86400000;
    const t = monta(<GuiaMenu conectado vistos={{ g3: ontem }} hubVisible celular={false} onEscolher={jest.fn()} onFechar={jest.fn()} />);
    const txt = document.body.textContent || "";
    expect(txt).toContain("Por onde começar");
    expect(txt).toContain("Conectar o número da loja");
    expect(txt).toContain("comece aqui");
    expect(txt).toContain("visto ontem");
    expect(document.querySelector("[data-comece='1']")?.textContent).toContain("Ligar as mensagens automáticas");
    t.desmonta();
  });
  it("sem a aba Conversas o guia 3 não aparece", () => {
    const t = monta(<GuiaMenu conectado={false} vistos={{}} hubVisible={false} celular={false} onEscolher={jest.fn()} onFechar={jest.fn()} />);
    expect(document.querySelector("[data-testid='wa-guia-item-3']")).toBeNull();
    expect(document.querySelector("[data-testid='wa-guia-item-1']")).not.toBeNull();
    t.desmonta();
  });
  it("Esc fecha", () => {
    const onFechar = jest.fn();
    const t = monta(<GuiaMenu conectado vistos={{}} hubVisible celular={false} onEscolher={jest.fn()} onFechar={onFechar} />);
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onFechar).toHaveBeenCalled();
    t.desmonta();
  });
  it("tem 3 guias descritos", () => { expect(MENU_GUIAS.map((g) => g.n)).toEqual([1, 2, 3]); });
});

describe("o motor dos guias", () => {
  const passa = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it("mostra o contador, os três botões e troca a aba antes de procurar o alvo", () => {
    jest.useFakeTimers();
    alvo("wa.saldos");
    const ctx = ctxBase();
    const onFim = jest.fn();
    const t = monta(<GuiaTour guia={guia2()} ctx={ctx} onFim={onFim} />);
    passa(700);
    expect(ctx.irPara).toHaveBeenCalledWith({ aba: "automaticas" });
    expect(document.querySelector("[data-testid='guia-contador']")?.textContent).toBe("1 de 7");
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Três saldos, cada um no seu limite");
    expect(document.querySelector("[data-testid='guia-proximo']")?.textContent).toContain("Próximo");
    expect(document.querySelector("[data-testid='guia-pular']")?.textContent).toBe("Pular guia");
    expect(document.querySelector("[data-testid='guia-voltar']")).toBeNull(); // primeiro passo
    t.desmonta();
  });

  it("alvo ausente pula o passo (não cai no balão do meio)", () => {
    jest.useFakeTimers();
    alvo("wa.saldos");
    // wa.divisao não existe; wa.auto.aniversario existe
    alvo("wa.auto.aniversario");
    const ctx = ctxBase();
    const t = monta(<GuiaTour guia={guia2()} ctx={ctx} onFim={jest.fn()} />);
    passa(700);
    act(() => { (document.querySelector("[data-testid='guia-proximo']") as HTMLElement).click(); });
    passa(3000);
    passa(700);
    expect(document.querySelector("[data-testid='guia-contador']")?.textContent).toBe("3 de 7");
    t.desmonta();
  });

  it("Esc fecha sem marcar o guia como feito", () => {
    jest.useFakeTimers();
    alvo("wa.saldos");
    const onFim = jest.fn();
    const t = monta(<GuiaTour guia={guia2()} ctx={ctxBase()} onFim={onFim} />);
    passa(700);
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onFim).toHaveBeenCalledWith({ feito: false });
    t.desmonta();
  });

  it("guia 1 já conectado pula direto para os saldos", () => {
    jest.useFakeTimers();
    alvo("wa.conexao"); alvo("wa.saldos");
    const ctx = ctxBase({ conectado: true, telefone: "(11) 98765-0000" });
    const t = monta(<GuiaTour guia={guia1(false)} ctx={ctx} onFim={jest.fn()} />);
    passa(900);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Número conectado");
    expect(document.querySelector("[data-testid='guia-numero-ligado']")?.textContent).toBe("(11) 98765-0000 ligado");
    t.desmonta();
  });

  it("guia 1: o botão só destrava com as duas conferências; conectar clica o botão REAL; o passo seguinte espera o status", () => {
    jest.useFakeTimers();
    alvo("wa.conexao");
    const real = alvo("wa.conectar");
    const clicou = jest.fn();
    real.addEventListener("click", clicou);
    const ctx = ctxBase();
    const t = monta(<GuiaTour guia={guia1(false)} ctx={ctx} onFim={jest.fn()} />);
    passa(700);
    const acao = () => document.querySelector("[data-testid='guia-acao']") as HTMLButtonElement;
    expect(acao().disabled).toBe(true);
    act(() => { (document.querySelector("[data-testid='guia-chk-cel']") as HTMLElement).click(); });
    expect(acao().disabled).toBe(true);
    act(() => { (document.querySelector("[data-testid='guia-chk-fb']") as HTMLElement).click(); });
    expect(acao().disabled).toBe(false);
    act(() => { acao().click(); });
    passa(700);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Toque em Conectar");
    act(() => { acao().click(); });
    expect(clicou).toHaveBeenCalledTimes(1);
    passa(300);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Siga o que aparece no celular");
    expect(document.querySelector("[data-testid='guia-aguardando']")).not.toBeNull();
    // o estado muda (status conectado): o passo avança sozinho
    alvo("wa.saldos");
    t.atualiza(<GuiaTour guia={guia1(false)} ctx={ctxBase({ conectado: true, telefone: "(11) 98765-0000" })} onFim={jest.fn()} />);
    passa(1500);
    passa(700);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Número conectado");
    t.desmonta();
  });

  it("botão real desabilitado: o balão não finge que conectou", () => {
    jest.useFakeTimers();
    alvo("wa.conexao");
    const real = alvo("wa.conectar");
    real.setAttribute("aria-disabled", "true");
    const clicou = jest.fn();
    real.addEventListener("click", clicou);
    const t = monta(<GuiaTour guia={guia1(false)} ctx={ctxBase()} onFim={jest.fn()} />);
    passa(700);
    act(() => { (document.querySelector("[data-testid='guia-chk-cel']") as HTMLElement).click(); (document.querySelector("[data-testid='guia-chk-fb']") as HTMLElement).click(); });
    act(() => { (document.querySelector("[data-testid='guia-acao']") as HTMLElement).click(); });
    passa(700);
    act(() => { (document.querySelector("[data-testid='guia-acao']") as HTMLElement).click(); });
    expect(clicou).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid='guia-conectar-falhou']")).not.toBeNull();
    t.desmonta();
  });

  it("guia 2: aniversário só liga com o aceite e pelas ações da tela; 'Agora não' não liga nada", () => {
    jest.useFakeTimers();
    alvo("wa.auto.aniversario");
    const ligar = jest.fn().mockResolvedValue({ ok: true, code: null });
    const info: any = { aceiteEm: null, autos: { aniversario: { ligada: false, livres: 4, config: {} }, crediario_cobrar: { ligada: false, config: {} } } };
    const ctx = ctxBase({ conectado: true, status: { connected: true, addon_active: true, template_ready: true } as any, auto: { ...ctxBase().auto, info, ligar } as any });
    const g = guia2();
    const so = { ...g, passos: g.passos.filter((p) => p.id === "g2-aniversario") };
    const onFim = jest.fn();
    const t = monta(<GuiaTour guia={so} ctx={ctx} onFim={onFim} />);
    passa(700);
    const liga = () => document.querySelector("[data-testid='guia-acao']") as HTMLButtonElement;
    expect(liga().disabled).toBe(true); // sem aceite
    act(() => { (document.querySelector("[data-testid='guia-chk-aceite']") as HTMLElement).click(); });
    expect(liga().disabled).toBe(false);
    act(() => { liga().click(); });
    expect(ligar).toHaveBeenCalledWith("aniversario", true, true);
    t.desmonta();
  });

  it("guia 2: número desconectado trava o liga e mostra o motivo (waAutoBlockers)", () => {
    jest.useFakeTimers();
    alvo("wa.auto.aniversario");
    const info: any = { aceiteEm: "2026-11-01", autos: { aniversario: { ligada: false, livres: 4, config: {} } } };
    const ctx = ctxBase({ status: { connected: false, addon_active: true } as any, auto: { ...ctxBase().auto, info } as any });
    const so = { ...guia2(), passos: guia2().passos.filter((p) => p.id === "g2-aniversario") };
    const t = monta(<GuiaTour guia={so} ctx={ctx} onFim={jest.fn()} />);
    passa(700);
    expect((document.querySelector("[data-testid='guia-acao']") as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("[data-testid='guia-auto-bloqueio']")?.textContent).toContain("Conecte o número");
    t.desmonta();
  });

  it("guia 3: o passo do produto avança pelo envio de verdade, não pelo clique", () => {
    jest.useFakeTimers();
    alvo("wa.acoes");
    const so = { ...guia3(), passos: guia3().passos.filter((p) => p.id === "g3-acoes") };
    const onFim = jest.fn();
    const t = monta(<GuiaTour guia={so} ctx={ctxBase({ produtosEnviados: 2 })} onFim={onFim} />);
    passa(700);
    expect(document.querySelector("[data-testid='guia-produto-espera']")).not.toBeNull();
    expect(document.querySelector("[data-testid='guia-produto-feito']")).toBeNull();
    t.atualiza(<GuiaTour guia={so} ctx={ctxBase({ produtosEnviados: 3 })} onFim={onFim} />);
    expect(document.querySelector("[data-testid='guia-produto-feito']")?.textContent).toContain("Foi, e de graça");
    t.desmonta();
  });
});

describe("teclado (acessibilidade no computador)", () => {
  const passa = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
  const tecla = (key: string, extra: any = {}) => act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra })); });

  it("foco inicial no botão principal; Tab fica preso; setas voltam e avançam; Esc devolve o foco", () => {
    jest.useFakeTimers();
    alvo("wa.saldos"); alvo("wa.divisao");
    const origem = document.createElement("button");
    document.body.appendChild(origem);
    origem.focus();
    const onFim = jest.fn();
    monta(<GuiaTour guia={guia2()} ctx={ctxBase()} onFim={onFim} />);
    passa(700);
    expect(document.activeElement).toBe(document.querySelector("[data-testid='guia-proximo']"));
    // Tab circula só dentro do balão
    const dentro = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='wa-guia'] button"));
    for (let k = 0; k < dentro.length + 2; k++) { tecla("Tab"); expect(dentro).toContain(document.activeElement as HTMLElement); }
    tecla("Tab", { shiftKey: true });
    expect(dentro).toContain(document.activeElement as HTMLElement);
    // → avança, ← volta
    tecla("ArrowRight"); passa(700);
    expect(document.querySelector("[data-testid='guia-contador']")?.textContent).toBe("2 de 7");
    tecla("ArrowLeft"); passa(700);
    expect(document.querySelector("[data-testid='guia-contador']")?.textContent).toBe("1 de 7");
    // Esc fecha e devolve o foco a quem abriu
    tecla("Escape");
    expect(onFim).toHaveBeenCalledWith({ feito: false });
    expect(document.activeElement).toBe(origem);
  });

  it("menu: Tab preso, Esc fecha", () => {
    const onFechar = jest.fn();
    monta(<GuiaMenu conectado vistos={{}} hubVisible celular={false} onEscolher={jest.fn()} onFechar={onFechar} />);
    const itens = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='wa-guia-menu'] button"));
    itens[0].focus();
    for (let k = 0; k < 5; k++) { tecla("Tab"); expect(itens).toContain(document.activeElement as HTMLElement); }
    tecla("Escape");
    expect(onFechar).toHaveBeenCalled();
  });
});

describe("Venda+, Pronto, buraco que desliza e guia 3 pendente", () => {
  const passa = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it("Venda+ liga com aceite e pelas ações da tela", () => {
    jest.useFakeTimers();
    alvo("wa.auto.venda_mais");
    const ligar = jest.fn().mockResolvedValue({ ok: true, code: null });
    const info: any = { aceiteEm: null, autos: { venda_mais: { ligada: false, livres: 4, config: {} } } };
    const ctx = ctxBase({ conectado: true, status: { connected: true, addon_active: true } as any, auto: { ...ctxBase().auto, info, ligar } as any });
    const so = { ...guia2(), passos: guia2().passos.filter((p) => p.id === "g2-venda") };
    monta(<GuiaTour guia={so} ctx={ctx} onFim={jest.fn()} />);
    passa(700);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Venda+ todo dia 1º");
    const liga = () => document.querySelector("[data-testid='guia-acao']") as HTMLButtonElement;
    expect(liga().textContent).toBe("Ligar o Venda+");
    expect(liga().disabled).toBe(true);
    act(() => { (document.querySelector("[data-testid='guia-chk-aceite']") as HTMLElement).click(); });
    act(() => { liga().click(); });
    expect(ligar).toHaveBeenCalledWith("venda_mais", true, true);
  });

  it("Pronto resume o que ficou ligado e encadeia o guia 3", () => {
    jest.useFakeTimers();
    alvo("wa.auto.cartoes");
    const info: any = { aceiteEm: "x", autos: { aniversario: { ligada: true }, crediario_cobrar: { ligada: false }, venda_mais: { ligada: true } } };
    const ctx = ctxBase({ auto: { ...ctxBase().auto, info } as any });
    const so = { ...guia2(), passos: guia2().passos.filter((p) => p.id === "g2-pronto") };
    const onFim = jest.fn();
    monta(<GuiaTour guia={so} ctx={ctx} onFim={onFim} />);
    passa(700);
    expect(document.querySelector("[data-testid='guia-resumo']")?.textContent).toContain("Ligado: Aniversário, Venda+.");
    act(() => { (document.querySelector("[data-testid='guia-acao']") as HTMLElement).click(); });
    expect(onFim).toHaveBeenCalledWith({ feito: true, depois: 3 });
  });

  it("Pronto sem nada ligado diz isso", () => {
    jest.useFakeTimers();
    alvo("wa.auto.cartoes");
    const info: any = { aceiteEm: "x", autos: { aniversario: { ligada: false } } };
    const so = { ...guia2(), passos: guia2().passos.filter((p) => p.id === "g2-pronto") };
    monta(<GuiaTour guia={so} ctx={ctxBase({ auto: { ...ctxBase().auto, info } as any })} onFim={jest.fn()} />);
    passa(700);
    expect(document.querySelector("[data-testid='guia-resumo']")?.textContent).toContain("Nada foi ligado");
  });

  it("o buraco é um elemento de tamanho fixo posicionado por translate e scale", () => {
    jest.useFakeTimers();
    alvo("wa.saldos", 200, 60);
    const so = { ...guia2(), passos: guia2().passos.filter((p) => p.id === "g2-saldos") };
    monta(<GuiaTour guia={so} ctx={ctxBase()} onFim={jest.fn()} />);
    passa(700);
    const f = document.querySelector(".wag-furo-d") as HTMLElement;
    expect(f).not.toBeNull();
    expect(f.style.width).toBe("100px");
    expect(f.style.height).toBe("100px");
    expect(f.style.transform).toContain("translate(94px, 94px)");
    expect(f.style.transform).toContain("scale(2.12, 0.72)");
  });

  it("guia 3 sem conversa aberta fica pendente (não pula) e a retomada volta no passo da janela", () => {
    jest.useFakeTimers();
    alvo("wa.lista");
    const onFim = jest.fn();
    monta(<GuiaTour guia={guia3()} ctx={ctxBase()} onFim={onFim} />);
    passa(700);
    act(() => { (document.querySelector("[data-testid='guia-proximo']") as HTMLElement).click(); });
    passa(3000); passa(700);
    expect(document.querySelector("[data-testid='guia-titulo']")?.textContent).toContain("Falta uma conversa aberta");
    act(() => { (document.querySelector("[data-testid='guia-pendente']") as HTMLElement).click(); });
    expect(onFim).toHaveBeenCalledWith({ feito: false, pendente: "g3-janela" });
  });

  it("retomada: com inicioId o guia começa no passo da janela", () => {
    jest.useFakeTimers();
    alvo("wa.janela");
    monta(<GuiaTour guia={guia3()} ctx={ctxBase()} onFim={jest.fn()} inicioId="g3-janela" />);
    passa(700);
    expect(document.querySelector("[data-testid='guia-contador']")?.textContent).toBe("2 de 6");
  });
});
