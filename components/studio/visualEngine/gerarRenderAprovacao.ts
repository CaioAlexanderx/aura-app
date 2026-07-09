// ============================================================
// AURA STUDIO · visualEngine/gerarRenderAprovacao — F2 + F5
//
// Fluxo completo "gerar do pedido" no modal de aprovação:
//   1. Busca o detalhe do pedido (itens + customization)
//   2. Acha o 1º item personalizado com template visual vinculado
//   3a. photo2d → render HD 2048px (compose2d)
//   3b. model3d → VÍDEO turntable ~4s (compose3dMug + MediaRecorder,
//       canvas offscreen 1280px — F5, zero infra)
//   4. Sobe pro R2 (upload-mockup, kind='approval')
//   5. Registra em studio_visual_renders (content_hash server-side)
//   6. Devolve { url, renderId, isVideo } pro modal anexar ao link
//
// Web-only (canvas). Erros são lançados com mensagem amigável — o
// modal mostra o toast e o lojista segue no fluxo manual (upload/URL).
//
// 03/07/2026 — F2/F5 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import { studioApi, type StudioOrderItem } from "@/services/studioApi";
import { studioVisualApi, type VisualView } from "@/services/studioVisualApi";
import { uploadStudioMockup } from "@/services/studioUploadApi";
import { exportPng } from "./compose2d";
import { createMugViewer } from "./compose3dMug";

export type RenderGerado = {
  url: string;
  renderId: string;
  contentHash: string;
  itemName: string;
  view: string;
  isVideo: boolean;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Erro ao ler o vídeo gerado"));
    reader.readAsDataURL(blob);
  });
}

export async function gerarRenderDoPedido(
  companyId: string,
  orderId: string
): Promise<RenderGerado> {
  const detail = await studioApi.getOrder(companyId, orderId);
  const items: StudioOrderItem[] = detail?.items || [];

  const item = items.find((i) => i.product_id && i.customization && typeof i.customization === "object");
  if (!item) {
    throw new Error("Pedido sem item personalizado — envie o mockup manualmente.");
  }

  const tpl = await studioVisualApi.getProductVisualTemplate(companyId, item.product_id);
  const template = tpl?.template;
  if (!template || !template.spec) {
    throw new Error(
      'Produto "' + (item.product_name || "") + '" sem template visual vinculado. Vincule em Estúdio › Produtos ou envie o mockup manualmente.'
    );
  }

  const customization: Record<string, any> = item.customization || {};

  // ── F5: template 3D → vídeo turntable ──────────────────────
  if (template.kind === "model3d") {
    const cv = document.createElement("canvas");
    cv.width = 1280;
    cv.height = 1000;
    const viewer = await createMugViewer(cv, template.spec, customization, {});
    let blob: Blob | null = null;
    try {
      blob = await viewer.recordTurntable(3600);
    } finally {
      viewer.dispose();
    }
    if (!blob || !blob.size) {
      throw new Error("Navegador sem suporte à gravação de vídeo — envie um snapshot ou mockup manual.");
    }
    const contentType = blob.type && blob.type.indexOf("video/") === 0 ? blob.type.split(";")[0] : "video/webm";
    const b64 = await blobToBase64(blob);
    const up = await uploadStudioMockup(companyId, {
      content_base64: b64,
      content_type: contentType,
      kind: "approval",
    });
    if (!up?.url) throw new Error("Falha no upload do vídeo");

    const reg = await studioVisualApi.createVisualRender(companyId, {
      template_key: template.key,
      template_version: template.version,
      kind: "turntable_video",
      customization,
      file_url: up.url,
      content_type: contentType,
      digital_order_item_id: item.id || null,
    });

    return {
      url: up.url,
      renderId: reg.render.id,
      contentHash: reg.render.content_hash,
      itemName: item.product_name || "item",
      view: "turntable",
      isVideo: true,
    };
  }

  // ── F2: template 2D → render HD estático ────────────────────
  if (template.kind !== "photo2d" || !Array.isArray(template.spec.views) || !template.spec.views.length) {
    throw new Error("Template do produto sem vistas 2D — envie o mockup manualmente.");
  }

  // Verso: quando o cliente personalizou o verso e o template tem a vista,
  // o render da frente segue como principal (v1). O verso sai como revisão
  // manual — evolução prevista: composição lado a lado.
  const view: VisualView = template.spec.views[0];

  const dataUrl = await exportPng(view, customization, {}, 2048);
  if (!dataUrl) {
    throw new Error("Não foi possível gerar o render (imagem da arte sem CORS?). Envie o mockup manualmente.");
  }

  const up = await uploadStudioMockup(companyId, {
    content_base64: dataUrl.split(",")[1],
    content_type: "image/png",
    kind: "approval",
  });
  if (!up?.url) throw new Error("Falha no upload do render");

  const reg = await studioVisualApi.createVisualRender(companyId, {
    template_key: template.key,
    template_version: template.version,
    kind: "hd_2d",
    customization,
    file_url: up.url,
    content_type: "image/png",
    digital_order_item_id: item.id || null,
  });

  return {
    url: up.url,
    renderId: reg.render.id,
    contentHash: reg.render.content_hash,
    itemName: item.product_name || "item",
    view: view.id,
    isVideo: false,
  };
}

export default gerarRenderDoPedido;
