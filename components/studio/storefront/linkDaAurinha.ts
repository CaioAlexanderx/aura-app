// ============================================================
// components/studio/storefront/linkDaAurinha.ts
//
// Onda 1B: o link que a Aurinha manda na DM abre a peça, e o pedido que
// nasce dele fica atribuído à conversa.
//
// Contrato (Aura-backend/docs/aurinha-checkout-contract.md, migration 313):
//
//   loja.getaura.com.br/<slug>?produto=<uuid>&variante=<sku_suffix>
//                             &origem=aurinha&conversa=<uuid>
//
// Até aqui a vitrine Studio ignorava os parâmetros e caía na home: a
// venda que a Aurinha fechou na conversa não aparecia como dela.
//
// Regras do contrato que este módulo cumpre:
// - `produto` abre a peça direto; inválido degrada para a home, sem erro.
// - `origem` (≤ 32 caracteres) e `conversa` (UUID) ficam na sessão da aba
//   e vão no pedido como `origem` e `hub_conversation_id`.
// - Atribuição ausente ou inválida NUNCA impede o pedido: o que não
//   valida some calado (o backend valida de novo e também ignora).
//
// `variante` é o `sku_suffix` de product_variants. A vitrine Studio não
// tem variante nesse formato: modelo e cor da louça são produtos
// diferentes na mesma categoria (a Aurinha manda o id do modelo certo).
// O parâmetro é lido e ignorado, sem erro.
// ============================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** O mesmo teto da coluna `digital_orders.origem` (migration 313). */
export const ORIGEM_MAX = 32;

export function ehUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v.trim());
}

/** O primeiro valor de um parâmetro de rota, que pode vir como lista. */
function um(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x.trim() : "";
}

/** `origem` válida ou null: texto curto, sem espaço nem caractere estranho. */
export function origemValida(v: unknown): string | null {
  const s = um(v).toLowerCase();
  if (!s || s.length > ORIGEM_MAX) return null;
  return /^[a-z0-9_.-]+$/.test(s) ? s : null;
}

export type LinkDaAurinha = {
  /** A peça a abrir, já validada como UUID. null = fica na home. */
  produto: string | null;
  variante: string | null;
  origem: string | null;
  conversa: string | null;
};

/** Lê os parâmetros do link. Nada aqui lança: o que não valida vira null. */
export function lerLinkDaAurinha(params: Record<string, unknown> | null | undefined): LinkDaAurinha {
  const p = params || {};
  const produto = um(p.produto);
  const conversa = um(p.conversa);
  const variante = um(p.variante);
  return {
    produto: ehUuid(produto) ? produto.toLowerCase() : null,
    variante: variante && variante.length <= 64 ? variante : null,
    origem: origemValida(p.origem),
    conversa: ehUuid(conversa) ? conversa.toLowerCase() : null,
  };
}

/** A faixa "Separamos esta peça para você" só aparece para a Aurinha. */
export function veioDaAurinha(link: Pick<LinkDaAurinha, "origem"> | null | undefined): boolean {
  return link?.origem === "aurinha";
}

// ── Atribuição guardada na aba ───────────────────────────────
// sessionStorage de propósito: sobrevive à navegação do funil e a um F5
// (a cliente abre a peça, recarrega, vai ao checkout), mas não a outra
// aba nem ao dia seguinte — uma compra por conta própria semanas depois
// não é conversão da conversa.

export type Atribuicao = { origem: string; hub_conversation_id: string | null };

type Guarda = Pick<Storage, "getItem" | "setItem">;

const chave = (slug: string) => "aura-vitrine-origem-" + String(slug || "").toLowerCase();

function guardaDaAba(): Guarda | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    // Safari em janela privada e iframes sem storage lançam no acesso.
    return null;
  }
}

/**
 * Guarda a origem do link. Sem `origem` válida não grava nada — e não
 * apaga a que já estava: o cliente que veio da Aurinha e depois navegou
 * pela loja continua atribuído.
 */
export function guardarAtribuicao(slug: string, link: LinkDaAurinha, guarda: Guarda | null = guardaDaAba()): void {
  if (!guarda || !link.origem) return;
  const a: Atribuicao = { origem: link.origem, hub_conversation_id: link.conversa };
  try { guarda.setItem(chave(slug), JSON.stringify(a)); } catch { /* cheio ou bloqueado: segue sem */ }
}

/** A atribuição da aba para ir no pedido, já revalidada. null = nenhuma. */
export function atribuicaoGuardada(slug: string, guarda: Guarda | null = guardaDaAba()): Atribuicao | null {
  if (!guarda) return null;
  try {
    const raw = guarda.getItem(chave(slug));
    if (!raw) return null;
    const a = JSON.parse(raw);
    const origem = origemValida(a?.origem);
    if (!origem) return null;
    return { origem, hub_conversation_id: ehUuid(a?.hub_conversation_id) ? a.hub_conversation_id : null };
  } catch {
    return null;
  }
}

/** Os campos que o POST do pedido leva. Vazio quando não há atribuição. */
export function camposDeAtribuicao(a: Atribuicao | null): { origem?: string; hub_conversation_id?: string } {
  if (!a) return {};
  return a.hub_conversation_id
    ? { origem: a.origem, hub_conversation_id: a.hub_conversation_id }
    : { origem: a.origem };
}
