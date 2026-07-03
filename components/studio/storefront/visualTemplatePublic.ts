// ============================================================
// components/studio/storefront/visualTemplatePublic.ts — F3
// Fetch público (sem auth) do template visual do produto na loja.
// GET /storefront/:slug/studio/products/:pid/visual-template
// (Aura-backend#298). Cache module-level por slug/produto — o
// configurador remonta a cada produto e não queremos refetch.
// Falha de rede/rota antiga → null → preview cai no SVG atual.
// ============================================================
import { request } from "@/services/api";
import type { VisualTemplate } from "@/services/studioVisualApi";

const cache = new Map<string, Promise<VisualTemplate | null>>();

export function fetchStorefrontVisualTemplate(
  slug: string,
  productId: string
): Promise<VisualTemplate | null> {
  const k = slug + "/" + productId;
  if (!cache.has(k)) {
    cache.set(
      k,
      request<{ template: VisualTemplate | null }>(
        "/storefront/" + encodeURIComponent(slug) + "/studio/products/" + productId + "/visual-template",
        { method: "GET", retry: 1, timeout: 8000, skipAuth: true } as any
      )
        .then((r) => r?.template || null)
        .catch(() => null)
    );
  }
  return cache.get(k)!;
}
