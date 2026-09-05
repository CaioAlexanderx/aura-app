// ============================================================
// GA4 e Pixel na vitrine Studio (05/09/2026)
//
// A lojista cola o ID no painel (Loja digital > Analytics) desde a
// migration 220 — e ate hoje nenhuma loja lia. A loja comum passou a
// injetar no HTML do servidor; a vitrine Studio e um app, entao os
// scripts entram aqui, no navegador, e SO depois do consentimento.
//
// Regras:
//   - o backend ja validou o formato (services/rastreadores.js); aqui nao
//     se confia mesmo assim, porque `document.createElement('script')`
//     com um ID errado e um script quebrado na loja de uma cliente;
//   - injeta uma vez por pagina: navegar entre produtos nao pode
//     carregar o gtag de novo;
//   - sem consentimento, nada e criado — nem o objeto `dataLayer`.
//
// Modulo puro (menos `injetar`) para o teste cobrir a decisao sem DOM.
// ============================================================

export type Rastreadores = { ga4: string | null; pixel: string | null };

const GA4 = /^G-[A-Z0-9]{6,14}$/;
const PIXEL = /^\d{15,16}$/;

/** Normaliza o que veio do payload: so IDs no formato certo sobrevivem. */
export function rastreadoresValidos(r: Partial<Rastreadores> | null | undefined): Rastreadores {
  const ga4 = String(r?.ga4 || "").trim().toUpperCase();
  const pixel = String(r?.pixel || "").trim();
  return {
    ga4: GA4.test(ga4) ? ga4 : null,
    pixel: PIXEL.test(pixel) ? pixel : null,
  };
}

/** A loja rastreia alguma coisa? Decide se o aviso de cookies aparece. */
export function lojaRastreia(r: Partial<Rastreadores> | null | undefined): boolean {
  const v = rastreadoresValidos(r);
  return !!(v.ga4 || v.pixel);
}

export type ScriptParaInjetar = { id: string; src?: string; inline?: string };

/**
 * A lista do que entra no <head>. Mesmos snippets oficiais do Google e da
 * Meta, com IP anonimizado no GA4 — igual ao que a loja comum injeta.
 */
export function scriptsParaInjetar(r: Partial<Rastreadores> | null | undefined): ScriptParaInjetar[] {
  const v = rastreadoresValidos(r);
  const lista: ScriptParaInjetar[] = [];
  if (v.ga4) {
    lista.push({ id: "aura-ga4-src", src: `https://www.googletagmanager.com/gtag/js?id=${v.ga4}` });
    lista.push({
      id: "aura-ga4",
      inline:
        "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
        `gtag('js',new Date());gtag('config','${v.ga4}',{anonymize_ip:true});`,
    });
  }
  if (v.pixel) {
    lista.push({
      id: "aura-pixel",
      inline:
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};" +
        "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;" +
        "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
        `fbq('init','${v.pixel}');fbq('track','PageView');`,
    });
  }
  return lista;
}

/**
 * Cria os <script> no documento. Idempotente pelo `id`: chamar duas vezes
 * (troca de rota, re-render) nao duplica nada. Retorna quantos entraram.
 */
export function injetarRastreadores(doc: Document | undefined, r: Partial<Rastreadores> | null | undefined): number {
  if (!doc || typeof doc.createElement !== "function") return 0;
  let n = 0;
  for (const s of scriptsParaInjetar(r)) {
    if (doc.getElementById(s.id)) continue;
    const el = doc.createElement("script");
    el.id = s.id;
    if (s.src) { el.src = s.src; el.async = true; }
    if (s.inline) el.text = s.inline;
    (doc.head || doc.body).appendChild(el);
    n++;
  }
  return n;
}
