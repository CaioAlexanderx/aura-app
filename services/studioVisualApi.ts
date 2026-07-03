// ============================================================
// AURA. — services/studioVisualApi.ts
// Visual Engine (F0/F1, 03/07/2026) — templates visuais 2D/3D
// mantidos pela Aura + registro de renders com content_hash.
//
// Backend: Aura-backend#296 (migration 208) — rotas em
// /companies/:id/studio/visual-templates | /visual-renders.
//
// Módulo separado do studioApi.ts (34KB) de propósito: evita
// colisão de merge no arquivo grande (técnica da casa).
// ============================================================
import { request } from "./api";

// ── Spec do template photo2d ─────────────────────────────
// Coordenadas em px no espaço base da vista (view.base). Quando
// photo_url é null, o motor desenha o garment vetorial provisório
// (assets provisórios até as fotos HD definitivas — decisão F1).
export type VisualArea = {
  id: string;                 // 'front' | 'back' | custom
  width_cm: number;
  height_cm: number;
  rect: { x: number; y: number; w: number; h: number };
};

export type VisualView = {
  id: string;                 // 'front' | 'back'
  label: string;
  base: { w: number; h: number };
  photo_url?: string | null;  // foto HD (R2); null = fallback vetorial
  shading_url?: string | null;// mapa de sombras (multiply) — fase fotos reais
  garment?: { shape: "tshirt"; back?: boolean } | null;
  areas: VisualArea[];
};

export type VisualTemplateSpec = {
  schema: 1;
  views: VisualView[];
};

export type VisualTemplateKind = "photo2d" | "model3d";
export type VisualTemplateStatus = "draft" | "published" | "archived";

export type VisualTemplate = {
  id: string;
  key: string;
  name: string;
  kind: VisualTemplateKind;
  status: VisualTemplateStatus;
  version: number;
  spec?: VisualTemplateSpec;
  created_at?: string;
  updated_at?: string;
};

export type VisualRenderKind = "preview" | "hd_2d" | "snapshot_3d" | "turntable_video";

export type VisualRender = {
  id: string;
  template_key: string;
  template_version: number;
  kind: VisualRenderKind;
  content_hash: string;
  file_url: string | null;
  created_at: string;
};

const base = (cid: string) => "/companies/" + cid + "/studio";

export const studioVisualApi = {
  listVisualTemplates: (cid: string, kind?: VisualTemplateKind) =>
    request<{ templates: VisualTemplate[]; count: number }>(
      base(cid) + "/visual-templates" + (kind ? "?kind=" + kind : ""),
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  getVisualTemplate: (cid: string, key: string) =>
    request<{ template: VisualTemplate }>(
      base(cid) + "/visual-templates/" + encodeURIComponent(key),
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  // Registra um render gerado (o content_hash é calculado no backend a
  // partir de template@version + customization canônica — prova de aprovação)
  createVisualRender: (
    cid: string,
    body: {
      template_key: string;
      template_version?: number;
      kind: VisualRenderKind;
      customization: Record<string, any>;
      file_url?: string | null;
      file_key?: string | null;
      content_type?: string | null;
      sale_item_id?: string | null;
      digital_order_item_id?: string | null;
    }
  ) =>
    request<{ render: VisualRender }>(base(cid) + "/visual-renders", {
      method: "POST", body, retry: 0, timeout: 10000,
    }),
  listVisualRenders: (cid: string, q: { sale_item_id?: string; digital_order_item_id?: string }) => {
    const qs = new URLSearchParams();
    if (q.sale_item_id) qs.set("sale_item_id", q.sale_item_id);
    if (q.digital_order_item_id) qs.set("digital_order_item_id", q.digital_order_item_id);
    return request<{ renders: VisualRender[]; count: number }>(
      base(cid) + "/visual-renders?" + qs.toString(),
      { method: "GET", retry: 1, timeout: 8000 }
    );
  },
};

export default studioVisualApi;
