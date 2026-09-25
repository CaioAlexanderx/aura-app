// ============================================================
// components/studio/storefront/chaveVitrineV2.ts
//
// A chave `vitrine_v2` (Fase 2 · Fechar a venda, 25/09/2026).
//
// Tudo da Fase 2 que muda a TELA — sacola em gaveta, checkout em três
// etapas, tela do Pix, confirmação em /<slug>/pedido/<token> — fica atrás
// desta chave. Desligada, a loja se comporta exatamente como antes
// (FASEAMENTO §4 Fase 2: liga na loja de teste, depois na Sheid; se der
// errado perto da Black Friday, desliga e o checkout de hoje atravessa a
// temporada).
//
// ── DE ONDE VEM ────────────────────────────────────────────────────────
//   1. `store.site.vitrine_v2 === true` — a chave por loja, do servidor
//      (Aura-backend#747, `studio_settings`).
//   2. `?v2=1` na URL — para o TL e o QA verem a vitrine nova numa loja
//      ainda desligada. Fica guardado na ABA (sessionStorage, por loja):
//      a vitrine troca a URL a cada tela e o parâmetro some na primeira
//      navegação. `?v2=0` desliga na aba, inclusive numa loja ligada —
//      é o jeito de comparar com o checkout de hoje sem mexer no painel.
//
// Pura de propósito (o storage entra por parâmetro): é regra, tem teste.
// ============================================================

/** A chave da aba, por loja: `aura-vitrine-v2-<slug>`. */
export function chaveDaAba(slug: string): string {
  return "aura-vitrine-v2-" + String(slug || "").trim().toLowerCase();
}

type Armazem = Pick<Storage, "getItem" | "setItem"> | null | undefined;

/** O `v2` da consulta: "1" liga, "0" desliga, qualquer outra coisa ignora. */
export function v2DaConsulta(search: string | null | undefined): "1" | "0" | null {
  const s = String(search || "");
  const m = /[?&]v2=([^&#]*)/.exec(s.startsWith("?") || s.startsWith("&") ? s : "?" + s);
  if (!m) return null;
  const v = decodeURIComponent(m[1] || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "sim") return "1";
  if (v === "0" || v === "false" || v === "nao" || v === "não") return "0";
  return null;
}

/**
 * A vitrine nova está ligada para esta loja, nesta aba?
 *
 * Escreve na aba quando a URL traz `v2` — é o único efeito, e é o que
 * faz o `?v2=1` sobreviver à troca de tela. Sem storage (nativo, modo
 * privado que recusa), vale só o que a URL e a loja dizem.
 */
export function vitrineV2Ativa(
  store: { site?: { vitrine_v2?: unknown } | null } | null | undefined,
  local: { slug: string; search?: string | null; storage?: Armazem },
): boolean {
  const daUrl = v2DaConsulta(local.search);
  const chave = chaveDaAba(local.slug);
  let daAba: string | null = null;
  try {
    if (daUrl) local.storage?.setItem(chave, daUrl);
    daAba = local.storage?.getItem(chave) ?? null;
  } catch {
    daAba = null;
  }
  const escolha = daUrl || (daAba === "1" || daAba === "0" ? daAba : null);
  if (escolha === "0") return false;
  if (escolha === "1") return true;
  return store?.site?.vitrine_v2 === true;
}

/** A chave com o ambiente do navegador (web); fora dele, só a da loja. */
export function vitrineV2NoNavegador(
  store: { site?: { vitrine_v2?: unknown } | null } | null | undefined,
  slug: string,
): boolean {
  let search: string | null = null;
  let storage: Armazem = null;
  try {
    if (typeof window !== "undefined") {
      search = window.location?.search ?? null;
      storage = window.sessionStorage ?? null;
    }
  } catch {
    storage = null;
  }
  return vitrineV2Ativa(store, { slug, search, storage });
}
