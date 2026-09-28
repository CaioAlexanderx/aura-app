// ============================================================
// components/studio/mockupPorProduto/useSpecsDosModelos.ts
//
// A lista de modelos (GET /studio/visual-templates) não traz a `spec` —
// só key, nome, tipo e versão. A prévia precisa dela para desenhar, e a
// miniatura para saber se o 3D é caneca ou camiseta. Aqui: um cache por
// key@versão no módulo (a aba pode desmontar e montar sem refazer as
// buscas) e um hook que pede todas depois que a lista chega.
// ============================================================
import { useEffect, useState } from "react";
import { studioVisualApi, type VisualTemplate, type VisualTemplateSpec } from "@/services/studioVisualApi";

const cache = new Map<string, Promise<VisualTemplateSpec | null>>();

function chave(cid: string, t: Pick<VisualTemplate, "key" | "version">) {
  return cid + "/" + t.key + "@" + (t.version ?? 0);
}

export function buscarSpec(cid: string, t: Pick<VisualTemplate, "key" | "version">): Promise<VisualTemplateSpec | null> {
  const k = chave(cid, t);
  let p = cache.get(k);
  if (!p) {
    p = studioVisualApi.getVisualTemplate(cid, t.key)
      .then((r) => r?.template?.spec || null)
      .catch(() => { cache.delete(k); return null; });
    cache.set(k, p);
  }
  return p;
}

/** Só para os testes: esquece o que já foi buscado. */
export function limparCacheDeSpecs() { cache.clear(); }

/**
 * key → spec (undefined enquanto busca; null quando não veio). A spec
 * que já veio na lista (quando a API passar a mandar) vale direto.
 */
export function useSpecsDosModelos(cid: string | undefined, templates: VisualTemplate[] | null) {
  const [specs, setSpecs] = useState<Record<string, VisualTemplateSpec | null>>({});
  useEffect(() => {
    if (!cid || !templates || !templates.length) return;
    let vivo = true;
    templates.forEach((t) => {
      if (t.spec) {
        setSpecs((s) => (s[t.key] ? s : { ...s, [t.key]: t.spec as VisualTemplateSpec }));
        return;
      }
      buscarSpec(cid, t).then((spec) => {
        if (vivo) setSpecs((s) => ({ ...s, [t.key]: spec }));
      });
    });
    return () => { vivo = false; };
  }, [cid, templates]);
  return specs;
}
