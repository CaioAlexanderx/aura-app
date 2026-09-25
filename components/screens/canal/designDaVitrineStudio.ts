// ============================================================
// Canal digital · a aba Design quando a loja é Studio (Fase 5)
//
// A mesma aba serve às duas lojas (canal comum e Loja Digital do Studio),
// mas o que a lojista vê do outro lado não é o mesmo:
//   - a PRÉVIA mostrava a loja comum até para a lojista Studio, num
//     endereço antigo do Railway (TabDesign.tsx). A do Studio mostra a
//     vitrine Studio no endereço da loja; a comum, a página da loja pelo
//     endereço da API (enderecoDaApi.ts — um domínio nosso);
//   - os SELOS que o painel grava sozinho (o conjunto de fábrica do GET)
//     contam como "não escritos" na vitrine Studio, que mostra os
//     automáticos dela (Aura-backend, storefrontBuilder.selosDaLojista);
//   - a PEÇA DO DESTAQUE (hero_product_id, migration 356) só existe lá.
//
// Puro de propósito: é regra, tem teste.
// ============================================================
import { enderecoDaApi } from "@/components/studio/storefront/enderecoDaApi";

export type VitrineDoPainel = "comum" | "studio";

/** O endereço público das lojas Studio (vitrineStudioShell.js no backend). */
export const LOJA_STUDIO = "https://loja.getaura.com.br";

/**
 * O endereço que a prévia da aba Design abre.
 *
 * Studio: o endereço da loja que o backend devolve (`storefront_url`,
 * que respeita a configuração do servidor), ou `loja.getaura.com.br/
 * <slug>`. Comum: a página renderizada pelo endereço da API. Sem slug
 * (loja não publicada), nada.
 */
export function enderecoDaPrevia(p: {
  slug?: string | null;
  storefrontUrl?: string | null;
  vitrine?: VitrineDoPainel;
  api?: string;
}): string | null {
  const slug = String(p.slug || "").trim();
  if (!slug) return null;
  if (p.vitrine === "studio") {
    const url = String(p.storefrontUrl || "").trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(url) ? url : `${LOJA_STUDIO}/${encodeURIComponent(slug)}`;
  }
  const api = String(p.api || enderecoDaApi()).replace(/\/+$/, "");
  return `${api}/storefront/${encodeURIComponent(slug)}/page`;
}

/** Os selos que o painel grava sozinho (DEFAULT_SERVICE_CARDS no backend). */
const DE_FABRICA = new Set([
  "Entrega rápida|Confirmação no WhatsApp",
  "Embalagem cuidadosa|Pronta pra presentear",
  "Pagamento seguro|Pix e demais opções",
  "Curadoria editada|Produtos selecionados",
  "Seleção da loja|Escolhidos a dedo",
]);

/**
 * Os selos gravados são o conjunto de fábrica, intocado? Na vitrine
 * Studio eles não aparecem (ela mostra os automáticos), então o painel
 * também não deve mostrá-los como se fossem da lojista.
 */
export function selosDeFabrica(cards: Array<{ title?: string; body?: string; enabled?: boolean }> | null | undefined): boolean {
  const ligados = (cards || []).filter((c) => c && c.enabled !== false);
  return ligados.length > 0 && ligados.every((c) => DE_FABRICA.has(`${c.title || ""}|${c.body || ""}`));
}

export type PecaDoPainel = { id: string; nome: string; foto: string | null; tresD: boolean };

/**
 * A peça automática do destaque, com a mesma regra da vitrine
 * (home/regrasDaHome.ts, pecaDoDestaque): a primeira com prévia 3D; sem
 * 3D, a primeira com foto; sem foto, a primeira.
 */
export function pecaAutomatica(pecas: PecaDoPainel[]): PecaDoPainel | null {
  return pecas.find((p) => p.tresD) || pecas.find((p) => !!p.foto) || pecas[0] || null;
}

/** As peças para o seletor: as com prévia 3D primeiro, na ordem da vitrine. */
export function pecasParaODestaque(produtos: any[] | null | undefined): PecaDoPainel[] {
  const lista = (produtos || []).map((p) => ({
    id: String(p?.id || ""),
    nome: String(p?.name || "Produto"),
    foto: p?.image_url || null,
    tresD: p?.visual_kind === "model3d",
  })).filter((p) => p.id);
  return [...lista.filter((p) => p.tresD), ...lista.filter((p) => !p.tresD)];
}
