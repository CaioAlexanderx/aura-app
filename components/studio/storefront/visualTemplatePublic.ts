// ============================================================
// components/studio/storefront/visualTemplatePublic.ts — F3
// Fetch público (sem auth) do template visual do produto na loja.
// GET /storefront/:slug/studio/products/:pid/visual-template
// (Aura-backend#298). Cache module-level por slug/produto — o
// configurador remonta a cada produto e não queremos refetch.
// Falha de rede/rota antiga → null → preview cai no SVG atual.
//
// ── POR QUE NÃO `request` DE services/api (QA de 04/09/2026) ───────────
// Este era o único fetch da vitrine que ainda passava pelo cliente
// genérico do app, cujo endereço de reserva é o nome que o PROVEDOR dá
// à nossa aplicação. Servida em `loja.getaura.com.br`, a vitrine vive
// sob uma CSP que só deixa falar com `api.getaura.com.br` — e o
// navegador bloqueava a chamada em silêncio. O `.catch(() => null)`
// engolia o bloqueio e o preview caía na foto plana: NENHUMA loja
// mostrava a caneca em 3D, o maior diferencial do produto, e nada
// acusava erro. A vitrine fala pelo endereço dela (enderecoDaApi), como
// o resto dos fetches deste diretório.
// ============================================================
import type { VisualTemplate } from "@/services/studioVisualApi";
import { enderecoDaApi } from "./enderecoDaApi";

const cache = new Map<string, Promise<VisualTemplate | null>>();

/** O endereço do template visual de um produto, no domínio da vitrine. */
export function urlDoTemplateVisual(slug: string, productId: string): string {
  return (
    enderecoDaApi() +
    "/storefront/" + encodeURIComponent(slug) +
    "/studio/products/" + encodeURIComponent(productId) + "/visual-template"
  );
}

export function fetchStorefrontVisualTemplate(
  slug: string,
  productId: string
): Promise<VisualTemplate | null> {
  const k = slug + "/" + productId;
  if (!cache.has(k)) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    cache.set(
      k,
      fetch(urlDoTemplateVisual(slug, productId), {
        method: "GET",
        signal: controller?.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.template) || null)
        .catch(() => null)
        .finally(() => { if (timer) clearTimeout(timer); })
    );
  }
  return cache.get(k)!;
}
