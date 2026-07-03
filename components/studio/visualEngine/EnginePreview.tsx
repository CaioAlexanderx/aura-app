// ============================================================
// AURA STUDIO · visualEngine/EnginePreview — F1.5 (03/07/2026)
//
// Superset drop-in do PersonalizationPreview pro PDV Studio:
// mesmas props do preview SVG atual + companyId/productId opcionais
// que habilitam o motor visual (Visual Engine F0–F4).
//
// Comportamento:
//   - Sem companyId/productId (ou nativo) → PersonalizationPreview
//     idêntico ao atual (fallback garantido).
//   - Com ambos + web: busca o template do produto via
//     studioVisualApi.getProductVisualTemplate com cache module-level
//     (1 fetch por cid/pid por sessão; erro limpa a entrada p/ retry).
//       · photo2d com spec.views → canvas 2D via composeView
//       · model3d com spec       → Mug3DPreview (viewer 3D)
//       · template null / carregando / erro → fallback SVG atual
//
// Web-only no caminho do motor (canvas DOM) — nativo cai no fallback.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { composeView } from "@/components/studio/visualEngine/compose2d";
import { Mug3DPreview } from "@/components/studio/visualEngine/Mug3DPreview";
import {
  studioVisualApi,
  type VisualTemplate,
  type VisualView,
} from "@/services/studioVisualApi";

type Props = {
  config: any;
  values: Record<string, any>;
  size?: number;
  productName?: string;
  showLabel?: boolean;
  companyId?: string;   // junto com productId, habilita o motor visual
  productId?: string;
};

// ── Cache module-level do template por produto ───────────────
// Chave "cid/pid" → Promise da resposta. Evita refetch a cada
// remount do painel; erro remove a entrada pra permitir retry.
type TemplateResp = {
  product_id: string;
  visual_template_key: string | null;
  template: VisualTemplate | null;
};
const templateCache = new Map<string, Promise<TemplateResp>>();

function fetchProductTemplate(cid: string, pid: string): Promise<TemplateResp> {
  const key = cid + "/" + pid;
  let p = templateCache.get(key);
  if (!p) {
    p = studioVisualApi.getProductVisualTemplate(cid, pid);
    p.catch(() => { templateCache.delete(key); });
    templateCache.set(key, p);
  }
  return p;
}

// ── Canvas 2D (photo2d) — redesenha via composeView ──────────
function Engine2DCanvas({
  view, values, size,
}: { view: VisualView; values: Record<string, any>; size: number }) {
  const canvasRef = useRef<any>(null);
  const height = Math.round(size * (view.base.h / view.base.w));

  useEffect(() => {
    if (!canvasRef.current) return;
    composeView(canvasRef.current, view, values, { showAreas: false, pixelWidth: 800 })
      .catch((e) => console.error("[EnginePreview] composeView error", e?.message || e));
  }, [view, values, size]);

  return (
    <View style={{ width: size, borderRadius: 12, overflow: "hidden" }}>
      {/* @ts-ignore — canvas DOM no web */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height, display: "block" } as any}
      />
    </View>
  );
}

// ── EnginePreview ────────────────────────────────────────────
export function EnginePreview(props: Props) {
  const { companyId, productId, values, size } = props;
  const engineEnabled = !!companyId && !!productId && Platform.OS === "web";

  // undefined = carregando; null = sem template (fallback SVG)
  const [template, setTemplate] = useState<VisualTemplate | null | undefined>(undefined);

  useEffect(() => {
    if (!engineEnabled) return;
    let alive = true;
    fetchProductTemplate(companyId as string, productId as string)
      .then((r) => { if (alive) setTemplate(r.template); })
      .catch((e: any) => {
        console.error("[EnginePreview] template load error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
        if (alive) setTemplate(null);
      });
    return () => { alive = false; };
  }, [engineEnabled, companyId, productId]);

  if (engineEnabled && template) {
    if (template.kind === "photo2d" && template.spec?.views?.length) {
      return (
        <Engine2DCanvas
          view={template.spec.views[0]}
          values={values}
          size={size ?? 280}
        />
      );
    }
    if (template.kind === "model3d" && template.spec) {
      return <Mug3DPreview spec={template.spec} values={values} size={size ?? 280} />;
    }
  }

  // Fallback: motor desabilitado, carregando, sem template ou kind desconhecido
  return (
    <PersonalizationPreview
      config={props.config}
      values={props.values}
      size={props.size}
      productName={props.productName}
      showLabel={props.showLabel}
    />
  );
}

export default EnginePreview;
