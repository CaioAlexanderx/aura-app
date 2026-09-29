// ============================================================
// components/studio/orcamentoModal/useCatalogoDoOrcamento.ts
//
// O que o modal do orçamento carrega uma vez por empresa (29/09/2026):
//   - o catálogo inteiro (a mesma rota do PDV Studio, com categoria,
//     foto e o modelo vinculado a cada produto);
//   - "Mais usados" e "Recentes" (backend 364, por CNPJ). Backend de
//     antes: listas vazias, o catálogo segue aberto em A–Z;
//   - os modelos de mockup publicados e as specs (para miniatura e selo).
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { request } from "@/services/api";
import { studioApi, type ProdutosFrequentesDoOrcamento } from "@/services/studioApi";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { useSpecsDosModelos } from "@/components/studio/mockupPorProduto/useSpecsDosModelos";
import { lerProdutoDoCatalogo, type ProdutoDoCatalogo } from "./regras";

export function useCatalogoDoOrcamento(cid: string | null) {
  const [produtos, setProdutos] = useState<ProdutoDoCatalogo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [frequentes, setFrequentes] = useState<ProdutosFrequentesDoOrcamento | null>(null);
  const [templates, setTemplates] = useState<VisualTemplate[] | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!cid) return;
    let vivo = true;
    setErro(null);
    setProdutos(null);
    request<{ products: any[] }>(
      "/companies/" + cid + "/studio/products?include_non_personalizable=true&limit=500",
      { method: "GET", retry: 1, timeout: 10000 },
    )
      .then((r) => { if (vivo) setProdutos((r?.products || []).map(lerProdutoDoCatalogo)); })
      .catch((e: any) => { if (vivo) { setProdutos([]); setErro(e?.data?.error || e?.message || "Não deu para carregar o catálogo"); } });
    studioApi.produtosFrequentesDoOrcamento(cid, { days: 90 })
      .then((r) => { if (vivo) setFrequentes(r); })
      .catch(() => { if (vivo) setFrequentes({ days: 90, mais_usados: [], recentes: [] }); });
    studioVisualApi.listVisualTemplates(cid)
      .then((r) => { if (vivo) setTemplates(r?.templates || []); })
      .catch(() => { if (vivo) setTemplates([]); });
    return () => { vivo = false; };
  }, [cid, tentativa]);

  const specs = useSpecsDosModelos(cid || undefined, templates);
  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  return { produtos, erro, frequentes, templates: templates || [], specs, recarregar };
}
