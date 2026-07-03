// ============================================================
// AURA STUDIO · visualEngine/gerarRenderAprovacao — F2
//
// Fluxo completo "gerar mockup do pedido" no modal de aprovação:
//   1. Busca o detalhe do pedido (itens + customization)
//   2. Acha o 1º item personalizado com template visual 2D vinculado
//   3. Gera o render HD 2048px com o MESMO motor do preview (compose2d)
//   4. Sobe pro R2 (upload-mockup, kind='approval')
//   5. Registra em studio_visual_renders (content_hash server-side)
//   6. Devolve { url, renderId } pro modal anexar ao link de aprovação
//
// Web-only (canvas). Erros são lançados com mensagem amigável — o
// modal mostra o toast e o lojista segue no fluxo manual (upload/URL).
//
// 03/07/2026 — F2 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import { studioApi, type StudioOrderItem } from "@/services/studioApi";
import { studioVisualApi, type VisualView } from "@/services/studioVisualApi";
import { uploadStudioMockup } from "@/services/studioUploadApi";
import { exportPng } from "./compose2d";

export type RenderGerado = {
  url: string;
  renderId: string;
  contentHash: string;
  itemName: string;
  view: string;
};

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
  if (template.kind !== "photo2d" || !Array.isArray(template.spec.views) || !template.spec.views.length) {
    throw new Error("Template do produto não é 2D — use o snapshot do viewer 3D ou envie manualmente.");
  }

  const customization: Record<string, any> = item.customization || {};
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
  };
}

export default gerarRenderDoPedido;
