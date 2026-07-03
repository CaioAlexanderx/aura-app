// ============================================================
// AURA. — services/studioVisualApi.ts
// Visual Engine (F0/F1, 03/07/2026) — templates visuais 2D/3D
// mantidos pela Aura + registro de renders com content_hash.
// F2 (03/07/2026): requestApprovalWithRender (render_id no link de
// aprovação existente) + getProductVisualTemplate (vínculo produto).
//
// Backend: Aura-backend#296 (migration 208) + #298 (migration 209).
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
  id: string;                 // 'front' | 'back' | 'panel' | 'wrap' | custom
  width_cm: number;
  height_cm: number;
  rect?: { x: number; y: number; w: number; h: number }; // photo2d
  uv?: { u0: number; v0: number; u1: number; v1: number }; // model3d
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

// model3d (F4): modelo procedural de caneca (GLB real entra depois
// trocando model.kind → 'glb' + url, sem mudar o viewer).
export type VisualModel3D = {
  kind: "procedural-mug" | "glb";
  url?: string | null;
  texture: { w: number; h: number };
};

export type VisualTemplateSpec = {
  schema: 1;
  views?: VisualView[];       // photo2d
  model?: VisualModel3D;      // model3d
  areas?: VisualArea[];       // model3d: painel/wrap com uv
};

export type VisualTemplateKind = "photo2d" | "model3d";
export type VisualTemplateStatus = "draft" | "published" | "archived";

export type VisualTemplate = {
  id?: string;
  key: string;
  name: string;
  kind: VisualTemplateKind;
  status?: VisualTemplateStatus;
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

export type ApprovalWithRenderCreated = {
  id: string;
  token: string;
  mockup_url: string;
  status: string;
  expires_at: string;
  created_at: string;
  render_id?: string | null;
  approval_url: string;
  wa_me_link: string | null;
  message_text?: string;
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
  // F4: template visual vinculado ao produto (ou null)
  getProductVisualTemplate: (cid: string, pid: string) =>
    request<{ product_id: string; visual_template_key: string | null; template: VisualTemplate | null }>(
      base(cid) + "/products/" + pid + "/visual-template",
      { method: "GET", retry: 1, timeout: 8000 }
    ),
  // F4: lojista vincula/desvincula produto ↔ template publicado
  setProductVisualTemplate: (cid: string, pid: string, key: string | null) =>
    request<{ ok: true; product_id: string; visual_template_key: string | null }>(
      base(cid) + "/products/" + pid + "/visual-template",
      { method: "PUT", body: { key }, retry: 0, timeout: 8000 }
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
  // F2: mesmo endpoint do studioApi.requestApproval + render_id (migration 209).
  // Mantido aqui pra não tocar no studioApi.ts (34KB).
  requestApprovalWithRender: (
    cid: string,
    oid: string,
    body: {
      mockup_url: string;
      render_id?: string | null;
      customer_phone?: string;
      custom_message?: string;
      expires_in_days?: number;
    }
  ) =>
    request<ApprovalWithRenderCreated>(base(cid) + "/orders/" + oid + "/approval", {
      method: "POST", body, retry: 0, timeout: 10000,
    }),
};

export default studioVisualApi;
