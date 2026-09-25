// ============================================================
// components/studio/storefront/chaveV2.ts
//
// A chave `vitrine_v2` do lado da Fase 3 (página do produto nova).
//
// A página do produto nova e a grade de modelos nova ficam atrás desta
// chave (FASEAMENTO §4 Fase 3B: "liga na loja de teste, depois na
// Sheid"). Desligada, a vitrine desenha o ProductConfigurator e a
// GradeDeModelos de hoje, sem mudança nenhuma.
//
// De onde vem:
//   1. `store.site.vitrine_v2 === true` — a chave por loja, do servidor.
//   2. `?v2=1` na URL — para o TL e o QA verem a vitrine nova numa loja
//      ainda desligada. Fica guardado na ABA (sessionStorage, por loja):
//      a vitrine troca a URL a cada tela e o parâmetro some na primeira
//      navegação. `?v2=0` desliga na aba, inclusive numa loja ligada.
//
// MESMO CONTRATO da Fase 2 (CONTRATO_F2.md, "A chave vitrine_v2"), com a
// mesma chave de aba (`aura-vitrine-v2-<slug>`): as duas fases leem e
// gravam o mesmo lugar, então o `?v2=1` aberto numa liga as duas. Se a
// Fase 2 entrar com o módulo dela, um dos dois sai e o outro fica — a
// assinatura é a mesma de propósito.
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
  let v = "";
  try { v = decodeURIComponent(m[1] || "").trim().toLowerCase(); } catch { v = ""; }
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
  store: { site?: any } | null | undefined,
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
  store: { site?: any } | null | undefined,
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
