// ============================================================
// AURA STUDIO · PDV — hook do catálogo (Fase 6)
// Carga de produtos (TODOS, via include_non_personalizable), stats do
// dia, filtro por categoria/busca, categorias derivadas, leitor de
// código de barras (DD-8) e cache de templates pro configurador.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import { request } from "@/services/api";
import { studioApi } from "@/services/studioApi";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import type { StudioProduct, DayStats } from "./types";

type ScanResult = { ok: boolean; product?: StudioProduct };

export function useStudioCatalog(
  cid: string | undefined,
  onScanProduct?: (p: StudioProduct) => void,
) {
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [stats, setStats] = useState<DayStats>({
    pedidos_hoje: 0, faturamento_hoje: 0, aguardando_arte: 0, em_producao: 0,
  });
  const [scanStatus, setScanStatus] = useState<{ tone: "ok" | "hit" | "miss"; text: string }>({
    tone: "ok", text: "Pronto · aponte ou digite",
  });
  const [templatesById, setTemplatesById] = useState<Record<string, Array<{ id: string; name: string; image_url: string; thumb_url: string | null }>>>({});

  const reload = useCallback(() => {
    if (!cid) return;
    setLoading(true);
    request<{ products: any[] }>(
      "/companies/" + cid + "/studio/products?include_non_personalizable=true&limit=500",
      { method: "GET" }
    )
      .then((data) => {
        setProducts(
          (data.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            image_url: p.image_url || null,
            category: p.category || null,
            stock_qty: parseFloat(p.stock_qty || 0),
            is_personalizable: !!p.is_personalizable,
            customization_config: p.customization_config,
            sku: p.sku || p.barcode || p.code || null,
          }))
        );
      })
      .catch((e) => setError(e?.message || "Erro ao carregar produtos"))
      .finally(() => setLoading(false));
  }, [cid]);

  useEffect(() => { reload(); }, [reload]);

  // Stats do dia — best-effort (padrão defensivo armadilha_schema_pre_migration)
  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    request<any>("/companies/" + cid + "/studio/dashboard/today", { method: "GET" })
      .then((r) => {
        if (cancelled || !r) return;
        setStats({
          pedidos_hoje: Number(r?.pedidos_hoje || r?.orders_today || 0),
          faturamento_hoje: Number(r?.faturamento_hoje || r?.revenue_today || 0),
          aguardando_arte: Number(r?.aguardando_arte || r?.awaiting_art || 0),
          em_producao: Number(r?.em_producao || r?.in_production || 0),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cid]);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    products.forEach((p) => {
      const c = p.category || "Sem categoria";
      seen.set(c, (seen.get(c) || 0) + 1);
    });
    return [
      { id: "all", label: "Todos", count: products.length },
      ...Array.from(seen.entries()).map(([label, count]) => ({ id: label, label, count })),
    ];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "all" || (p.category || "Sem categoria") === cat) &&
        (!q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
    );
  }, [products, cat, query]);

  const findByCode = useCallback(
    (code: string): ScanResult => {
      const c = code.trim().toLowerCase();
      const hit = products.find((p) => (p.sku || "").toLowerCase() === c);
      return hit ? { ok: true, product: hit } : { ok: false };
    },
    [products]
  );

  // Leitor de código (DD-8) — Enter com buffer válido dispara onScan
  useGlobalBarcodeScanner({
    enabled: !!cid && products.length > 0,
    onScan: (code) => {
      const r = findByCode(code);
      if (r.ok && r.product) {
        setScanStatus({ tone: "hit", text: r.product.name });
        onScanProduct?.(r.product);
      } else {
        setScanStatus({ tone: "miss", text: `Código ${code} não encontrado` });
      }
    },
  });

  const loadTemplates = useCallback(
    async (productId: string) => {
      if (templatesById[productId] || !cid) return;
      try {
        const data = await studioApi.templatesByProduct(cid, productId);
        const list = (data.templates || []).map((tpl: any) => ({
          id: tpl.id, name: tpl.name, image_url: tpl.image_url, thumb_url: tpl.thumb_url || null,
        }));
        setTemplatesById((prev) => ({ ...prev, [productId]: list }));
      } catch (_) {
        setTemplatesById((prev) => ({ ...prev, [productId]: [] }));
      }
    },
    [cid, templatesById]
  );

  return {
    products, loading, error, setError, stats,
    query, setQuery, cat, setCat, categories, filtered,
    scanStatus, reload, templatesById, loadTemplates,
  };
}
