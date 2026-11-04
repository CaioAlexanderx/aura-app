// ============================================================
// AURA. — Avisos no celular (04/11/2026, par do Aura-backend #953)
//
// O que este arquivo trava:
//   1. quem vê o convite: dona, admin e acesso total; funcionária com
//      Financeiro recebe o aviso, mas não é dela a decisão de ligar;
//   2. "Agora não" vale para sempre neste aparelho, e sem localStorage o
//      app não quebra;
//   3. a seção "Caixa e crediário" nas preferências, com os três tipos
//      ligados por padrão e os mesmos nomes do backend;
//   4. os três tipos no catálogo do sino (com rota de queda);
//   5. o botão não se chama mais "Aviso de pedido novo" em lugar nenhum.
// ============================================================
import * as fs from "fs";
import * as path from "path";
import {
  CHAVE_DO_CONVITE, TEXTO_DO_CONVITE, _limparConvite, conviteDispensado, dispensarConvite, podeVerConvite,
} from "@/utils/avisosNoCelular";
import { PREF_SECTIONS, visualForEvent } from "@/components/notificationEventModel";

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

describe("quem vê o convite", () => {
  test("dona, admin e acesso total", () => {
    expect(podeVerConvite({ is_owner: true })).toBe(true);
    expect(podeVerConvite({ is_owner: false, role: "owner" })).toBe(true);
    expect(podeVerConvite({ is_owner: false, role: "admin", permissions: { pdv: true } })).toBe(true);
    expect(podeVerConvite({ is_owner: false, role: "member", permissions: null })).toBe(true);
  });

  test("funcionaria com Financeiro recebe o aviso, mas nao ve o convite (decisao da dona)", () => {
    expect(podeVerConvite({ is_owner: false, role: "member", permissions: { financeiro: true, pdv: true } })).toBe(false);
    expect(podeVerConvite({ is_owner: false, role: "member", permissions: { pdv: true, estoque: true, painel: false } })).toBe(false);
  });

  test("sem resposta de permissoes ainda, nao mostra", () => {
    expect(podeVerConvite(undefined)).toBe(false);
    expect(podeVerConvite(null)).toBe(false);
  });
});

describe("Agora nao", () => {
  // O jsdom nao deixa trocar o window: troca-se so o localStorage dele.
  const w = (globalThis as any).window || ((globalThis as any).window = {});
  const descritor = Object.getOwnPropertyDescriptor(w, "localStorage");
  afterEach(() => {
    if (descritor) Object.defineProperty(w, "localStorage", descritor);
    else delete w.localStorage;
  });

  test("fica dispensado para sempre neste aparelho", () => {
    const store: Record<string, string> = {};
    Object.defineProperty(w, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    });
    _limparConvite();
    expect(conviteDispensado()).toBe(false);
    dispensarConvite();
    expect(store[CHAVE_DO_CONVITE]).toBe("1");
    expect(conviteDispensado()).toBe(true);
  });

  test("sem localStorage (navegador privado): nao quebra e nao dispensa", () => {
    Object.defineProperty(w, "localStorage", {
      configurable: true,
      get() { throw new Error("SecurityError"); },
    });
    expect(() => dispensarConvite()).not.toThrow();
    expect(conviteDispensado()).toBe(false);
  });
});

describe("preferencias do sino", () => {
  test('secao "Caixa e crediario" logo depois de "Sempre ligado", com os tres tipos ligados por padrao', () => {
    const i = PREF_SECTIONS.findIndex((s) => s.titulo === "Caixa e crediário");
    expect(i).toBe(1);
    expect(PREF_SECTIONS[0].titulo).toBe("Sempre ligado");
    const tipos = PREF_SECTIONS[i].linhas.map((l) => l.type);
    expect(tipos).toEqual(["loja_venda_realizada", "loja_crediario_recebido", "loja_orcamento_aprovado"]);
    for (const l of PREF_SECTIONS[i].linhas) {
      expect(l.padrao).toBe(true);
      expect(l.fixo).toBeFalsy();
      expect(l.nome.length).toBeGreaterThan(3);
      expect(l.desc.length).toBeGreaterThan(10);
    }
    expect(PREF_SECTIONS[i].linhas[0].desc).toMatch(/Só no celular/);
  });

  test("nenhum tipo aparece em duas secoes", () => {
    const todos = PREF_SECTIONS.flatMap((s) => s.linhas.map((l) => l.type));
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe("catalogo do sino", () => {
  test("crediario e orcamento tem card proprio, com rota de queda", () => {
    const c = visualForEvent({ type: "loja_crediario_recebido", severity: "info" });
    expect(c.label).toBe("Recebido no crediário");
    expect(c.fallbackRoute).toBe("/crediario");
    expect(c.requiresAction).toBe(false);
    const o = visualForEvent({ type: "loja_orcamento_aprovado", severity: "info" });
    expect(o.label).toBe("Orçamento aprovado");
    expect(o.fallbackRoute).toBe("/matcon/orcamentos");
    const v = visualForEvent({ type: "loja_venda_realizada", severity: "info" });
    expect(v.label).toBe("Venda realizada");
  });
});

describe("o botao mudou de nome", () => {
  test('"Aviso de pedido novo" nao existe mais na interface', () => {
    for (const arq of [
      ["components", "screens", "configuracoes", "AuraNoCelularCard.tsx"],
      ["components", "NotificationPrefs.tsx"],
      ["components", "InstallBanner.tsx"],
    ]) {
      const jsx = ler(...arq).split(/export function|function Linha/).slice(1).join("\n");
      expect(jsx).not.toMatch(/Aviso de pedido novo/);
      expect(jsx).not.toMatch(/Aviso no computador/);
    }
    expect(ler("components", "screens", "configuracoes", "AuraNoCelularCard.tsx")).toMatch(/>Avisos no celular</);
    expect(ler("components", "NotificationPrefs.tsx")).toMatch(/>Avisos neste aparelho</);
  });

  test("o convite esta no Painel e no Caixa, fora do demo", () => {
    expect(ler("app", "(tabs)", "index.tsx")).toMatch(/\{!isDemo && <ConviteDeAvisos \/>\}/);
    expect(ler("app", "(tabs)", "pdv.tsx")).toMatch(/\{!auth\.isDemo && <ConviteDeAvisos \/>\}/);
    expect(TEXTO_DO_CONVITE.titulo).toBe("Saiba de cada venda no celular");
  });
});
