// ============================================================
// Rodada 2 das decisoes do QA "O dia da Marina" (05/09/2026)
//
//   3  - link de acompanhamento na confirmacao do pedido
//   10 - ficha de producao A5 + baixar arte com nome legivel
//   11 - Clientes dentro do Studio
//   12 - GA4 / Pixel / SEO nas lojas, so com consentimento
// ============================================================
import fs from "fs";
import path from "path";
import {
  rastreadoresValidos, lojaRastreia, scriptsParaInjetar, injetarRastreadores,
} from "../components/studio/storefront/rastreadoresDaVitrine";
import { extensaoDaUrl, nomeDoArquivo } from "../components/studio/baixarArquivo";
import { filtrarClientes } from "../components/screens/clientes/filtrarClientes";

const raiz = path.join(__dirname, "..");
const le = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

describe("12 · rastreadores da vitrine", () => {
  test("so ID no formato certo sobrevive", () => {
    expect(rastreadoresValidos({ ga4: "g-abc123xyz", pixel: "123456789012345" }))
      .toEqual({ ga4: "G-ABC123XYZ", pixel: "123456789012345" });
    expect(rastreadoresValidos({ ga4: "UA-1234-1", pixel: "12" })).toEqual({ ga4: null, pixel: null });
    expect(rastreadoresValidos(undefined)).toEqual({ ga4: null, pixel: null });
  });

  test("loja sem rastreador nao tem o que perguntar", () => {
    expect(lojaRastreia(null)).toBe(false);
    expect(lojaRastreia({ ga4: "lixo", pixel: null })).toBe(false);
    expect(lojaRastreia({ ga4: "G-ABC123XYZ", pixel: null })).toBe(true);
  });

  test("os scripts levam o ID e o IP anonimizado", () => {
    const lista = scriptsParaInjetar({ ga4: "G-ABC123XYZ", pixel: "123456789012345" });
    expect(lista.map((s) => s.id)).toEqual(["aura-ga4-src", "aura-ga4", "aura-pixel"]);
    expect(lista[0].src).toContain("id=G-ABC123XYZ");
    expect(lista[1].inline).toContain("anonymize_ip:true");
    expect(lista[2].inline).toContain("fbq('init','123456789012345')");
    expect(scriptsParaInjetar({ ga4: null, pixel: null })).toEqual([]);
  });

  test("injeta uma vez por pagina — a segunda chamada nao duplica", () => {
    const r = { ga4: "G-ABC123XYZ", pixel: null };
    expect(injetarRastreadores(document, r)).toBe(2);
    expect(injetarRastreadores(document, r)).toBe(0);
    expect(document.getElementById("aura-ga4")).not.toBeNull();
    expect(document.getElementById("aura-pixel")).toBeNull();
  });

  test("o aviso e a injecao passam pelo consentimento, e o banner do painel sai da vitrine", () => {
    const c = le("components/studio/storefront/ConsentimentoDaVitrine.tsx");
    expect(c).toContain("hasAnalyticsConsent()");
    expect(c).toContain('saveConsent(aceita ? "all" : "essential")');
    expect(c).toContain("if (!rastreia || !pendente) return null;");
    const l = le("components/LGPDConsent.tsx");
    expect(l).toContain('new Set(["[slug]", "cardapio"])');
    expect(l).toContain("if (!visible || naVitrine) return null;");
    const p = le("components/studio/storefront/PaginaDaVitrine.tsx");
    expect(p).toContain("<ConsentimentoDaVitrine");
  });
});

describe("3 · link de acompanhamento", () => {
  test("a confirmacao mostra o bloco so quando o backend mandou o link", () => {
    const c = le("components/studio/storefront/SentConfirmation.tsx");
    expect(c).toContain("sentOrder.track_url ? (");
    expect(c).toContain("Acompanhe seu pedido");
    expect(le("components/studio/storefront/types.ts")).toContain("track_url?: string | null;");
  });
});

describe("10 · ficha de producao e arte com nome", () => {
  test("nome do arquivo e pedido + campo, com a extensao da URL", () => {
    expect(extensaoDaUrl("https://r2/x/abc.JPG?x=1")).toBe("jpg");
    expect(extensaoDaUrl("https://r2/x/abc")).toBe("png");
    expect(nomeDoArquivo("SM-0042", "Foto do cliente", "https://r2/a/b.png"))
      .toBe("SM-0042 - Foto do cliente.png");
    expect(nomeDoArquivo("SM/0042", 'Arte: "verso"', "https://r2/a/b.pdf"))
      .toBe("SM0042 - Arte verso.pdf");
  });

  test("a ficha existe, imprime em A5 e o detalhe do pedido leva ate ela", () => {
    const f = le("app/studio/(estudio)/pedidos/ficha/[id].tsx");
    expect(f).toContain("size: A5 portrait");
    expect(f).toContain("window.print()");
    expect(f).toContain('side="back"');
    expect(le("app/studio/(estudio)/pedidos/[id].tsx")).toContain("/studio/pedidos/ficha/${order.id}");
  });
});

describe("11 · clientes no Studio", () => {
  const base = { email: "", instagram: "", birthday: "", lastPurchase: "", totalSpent: 0, visits: 0, firstVisit: "", notes: "", rating: null, creditBalance: 0 };
  const lista = [
    { ...base, id: "1", name: "Ana Paula", phone: "(11) 98888-1234" },
    { ...base, id: "2", name: "Bruno", phone: "", email: "bruno@x.com", instagram: "@brunoo" },
  ] as any[];

  test("busca por nome, telefone, e-mail ou instagram", () => {
    expect(filtrarClientes(lista, "").map((c) => c.id)).toEqual(["1", "2"]);
    expect(filtrarClientes(lista, "ana").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(lista, "98888").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(lista, "bruno@").map((c) => c.id)).toEqual(["2"]);
    expect(filtrarClientes(lista, "@brunoo").map((c) => c.id)).toEqual(["2"]);
    expect(filtrarClientes(lista, "zzz")).toEqual([]);
  });

  test("a porta esta no menu do Studio", () => {
    const nav = le("components/studio/StudioShell/nav.ts");
    expect(nav).toContain("route: '/studio/clientes'");
  });
});
