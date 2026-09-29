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
//
// 27/09/2026 — Mockup na foto: sem template do banco, o render HD sai
// da marcação que a lojista fez na foto da peça (`mockup_foto`), pela
// mesma spec e pelo mesmo exportPng que a vitrine usa no preview. Os
// valores passam por valoresDoMotor, como na vitrine, para a cor e a
// fonte da arte aprovada serem as que o cliente viu.
//
// 28/09/2026 — Travamento do "Gerar do pedido" (QA): o PNG de 2048 px
// saía com `toDataURL` (síncrono, até ~0,7 s por imagem com a aba parada),
// frente e verso eram codificados, decodificados e codificados de novo
// para ficar lado a lado, e o arquivo chegava a 11 MB. Agora as vistas
// ficam em canvas até o fim, o arquivo é um JPEG 0,9 feito com `toBlob`
// (assíncrono) e o base64 sai pelo FileReader. O 3D grava no canvas fora
// da tela com pixelRatio 1 (1280 × 1000, o tamanho que o vídeo sempre
// quis ter). `aoAvancar` diz a etapa para o botão mostrar o progresso.
// ============================================================
import { studioApi, type StudioOrderItem } from "@/services/studioApi";
import { studioVisualApi, type VisualView } from "@/services/studioVisualApi";
import { uploadStudioMockup } from "@/services/studioUploadApi";
import { canvasParaBlob, exportCanvas } from "./compose2d";
import { valoresDoMotor, valoresComArte, type ValoresDoMotor } from "@/components/studio/storefront/valoresDoMotor";
import { areaParaLado } from "./areasDaPeca";
import type { CustomizationConfig } from "@/services/studioApi";
import {
  chaveDoMockupFoto,
  specDaFotoDoProdutoMedida,
  versaoDoMockupFoto,
} from "./specDaFotoDoProduto";
import { createMugViewer, MIME_DO_VIDEO } from "./compose3dMug";

export type RenderGerado = {
  url: string;
  renderId: string;
  contentHash: string;
  itemName: string;
  view: string;
  isVideo: boolean;
};

/** Etapas que o botão do modal mostra enquanto gera. */
export type EtapaDoRender = "pedido" | "mockup" | "video" | "arquivo" | "envio";
export type AoAvancar = (etapa: EtapaDoRender) => void;

/** Formato do mockup estático: JPEG 0,9 — nítido na prova e bem menor que o PNG. */
const TIPO_DO_MOCKUP = "image/jpeg" as const;
const QUALIDADE_DO_MOCKUP = 0.9;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo gerado"));
    reader.readAsDataURL(blob);
  });
}

/** Cede a vez à página: o spinner e o texto da etapa pintam entre um passo pesado e outro. */
function cederAVez(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

// ── Formatação da arte (28/09/2026) ─────────────────────────
// A render de aprovação passa pela MESMA tradução da vitrine
// (valoresDoMotor): cor, fonte, tamanho e posição que a cliente viu, e
// todos os textos e imagens do lado. Antes, com template do banco, o
// customization ia cru e a cliente aprovava um texto grafite em Georgia
// no lugar do rosa em Pacifico que tinha escolhido. E quando o verso tem
// arte, a prova mostra frente e verso.

/** O verso tem arte da cliente? */
function temVerso(cfg: CustomizationConfig | null, customizacao: Record<string, any>): ValoresDoMotor | null {
  if (!cfg || (cfg as any).has_back !== true) return null;
  const m = valoresDoMotor(cfg, customizacao, "back");
  return m.arte.imagens.length || m.arte.textos.length ? m : null;
}

/** Dois canvas lado a lado, na mesma altura, num canvas só (sem codificar no meio). */
function ladoALado(telas: HTMLCanvasElement[]): HTMLCanvasElement {
  if (telas.length < 2 || typeof document === "undefined") return telas[0];
  const h = Math.max(...telas.map((t) => t.height));
  const larguras = telas.map((t) => Math.round((t.width * h) / t.height));
  const cv = document.createElement("canvas");
  cv.width = larguras.reduce((a, b) => a + b, 0);
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return telas[0];
  let x = 0;
  telas.forEach((t, i) => { ctx.drawImage(t, x, 0, larguras[i], h); x += larguras[i]; });
  return cv;
}

/** Frente (e verso, se tiver arte) de uma lista de vistas 2D, num canvas só. */
async function telaDasVistas(
  vistas: VisualView[],
  cfg: CustomizationConfig | null,
  customizacao: Record<string, any>,
  peca: string | null,
): Promise<{ tela: HTMLCanvasElement | null; vista: VisualView }> {
  const frente = valoresDoMotor(cfg, customizacao, "front", { peca });
  const vista = vistas[0];
  const telaFrente = await exportCanvas(vista, valoresComArte(frente), { artColor: frente.artColor, font: frente.font }, 2048);
  const verso = temVerso(cfg, customizacao);
  const vistaDoVerso = vistas.find((v) => v.id === "back") || (vistas[1] && vistas[1].id !== "middle" ? vistas[1] : null);
  if (!telaFrente || !verso || !vistaDoVerso) return { tela: telaFrente, vista };
  await cederAVez();
  const versoCfg = valoresDoMotor(cfg, customizacao, "back", { peca });
  const telaVerso = await exportCanvas(vistaDoVerso, valoresComArte(versoCfg), { artColor: versoCfg.artColor, font: versoCfg.font }, 2048);
  return { tela: telaVerso ? ladoALado([telaFrente, telaVerso]) : telaFrente, vista };
}

/** O canvas do mockup em JPEG, já em base64 — tudo assíncrono. Null = canvas sem CORS. */
async function arquivoDoMockup(tela: HTMLCanvasElement | null, aoAvancar?: AoAvancar): Promise<string | null> {
  if (!tela) return null;
  aoAvancar?.("arquivo");
  await cederAVez();
  const blob = await canvasParaBlob(tela, TIPO_DO_MOCKUP, QUALIDADE_DO_MOCKUP);
  return blob ? blobToBase64(blob) : null;
}

export async function gerarRenderDoPedido(
  companyId: string,
  orderId: string,
  aoAvancar?: AoAvancar
): Promise<RenderGerado> {
  aoAvancar?.("pedido");
  const detail = await studioApi.getOrder(companyId, orderId);
  const items: StudioOrderItem[] = detail?.items || [];

  const item = items.find((i) => i.product_id && i.customization && typeof i.customization === "object");
  if (!item) {
    throw new Error("Pedido sem item personalizado — envie o mockup manualmente.");
  }

  const tpl = await studioVisualApi.getProductVisualTemplate(companyId, item.product_id);
  const template = tpl?.template;
  if (!template || !template.spec) {
    // Precedência: template do banco > mockup na foto. Só chega aqui sem
    // template; a config do produto diz se há foto marcada.
    const doProduto = await studioApi.getCustomizationConfig(companyId, item.product_id).catch(() => null);
    const cfg = doProduto?.config || null;
    const spec = cfg ? await specDaFotoDoProdutoMedida(cfg) : null;
    if (spec && spec.views && spec.views.length) {
      const customizacao: Record<string, any> = item.customization || {};
      aoAvancar?.("mockup");
      await cederAVez();
      const { tela, vista } = await telaDasVistas(spec.views, cfg, customizacao, null);
      const b64 = await arquivoDoMockup(tela, aoAvancar);
      if (!b64) {
        throw new Error("Não foi possível gerar o render (foto ou arte sem CORS?). Envie o mockup manualmente.");
      }
      aoAvancar?.("envio");
      const enviado = await uploadStudioMockup(companyId, {
        content_base64: b64,
        content_type: TIPO_DO_MOCKUP,
        kind: "approval",
      });
      if (!enviado?.url) throw new Error("Falha no upload do render");
      const registro = await studioVisualApi.createVisualRender(companyId, {
        template_key: chaveDoMockupFoto(item.product_id),
        template_version: versaoDoMockupFoto((cfg as any).mockup_foto),
        kind: "hd_2d",
        customization: customizacao,
        file_url: enviado.url,
        content_type: TIPO_DO_MOCKUP,
        digital_order_item_id: item.id || null,
      });
      return {
        url: enviado.url,
        renderId: registro.render.id,
        contentHash: registro.render.content_hash,
        itemName: item.product_name || "item",
        view: vista.id,
        isVideo: false,
      };
    }
    throw new Error(
      // O vínculo mora na aba Aparência da Loja Digital desde o S7 — a
      // mensagem mandava a lojista procurar em "Estúdio › Produtos", onde
      // não há nada disso.
      'Produto "' + (item.product_name || "") + '" sem mockup 3D vinculado. Vincule em Vendas › Loja Digital › Aparência ou envie o mockup manualmente.'
    );
  }

  const customization: Record<string, any> = item.customization || {};
  // A config do produto: é ela que diz os campos, a paleta, as fontes e a
  // área — sem ela, cai no customization cru de antes.
  const doProdutoT = await studioApi.getCustomizationConfig(companyId, item.product_id).catch(() => null);
  const cfgT: CustomizationConfig | null = doProdutoT?.config || null;
  const pecaT = template.kind === "model3d" ? ((template.spec as any)?.model?.kind === "glb" ? "camiseta" : "caneca") : null;

  // ── F5: template 3D → vídeo turntable ──────────────────────
  if (template.kind === "model3d") {
    const cv = document.createElement("canvas");
    cv.width = 1280;
    cv.height = 1000;
    // Frente e verso na mesma textura: o vídeo dá a volta e mostra os dois.
    const frente3d = valoresDoMotor(cfgT, customization, "front", { peca: pecaT });
    const verso3d = temVerso(cfgT, customization);
    const areaFrente = areaParaLado(template.spec.areas, "front");
    const areaVerso = verso3d ? areaParaLado(template.spec.areas, "back") : null;
    const porArea: Record<string, any> = {};
    if (areaFrente) porArea[areaFrente] = frente3d.arte;
    if (areaVerso && areaVerso !== areaFrente) porArea[areaVerso] = valoresDoMotor(cfgT, customization, "back", { peca: pecaT }).arte;
    const valores3d = cfgT ? { ...frente3d.values, __artePorArea: porArea } : customization;
    aoAvancar?.("video");
    await cederAVez();
    // pixelRatio 1: o canvas fora da tela já tem 1280 × 1000; com o dpr 2
    // de um notebook ele virava 2560 × 2000 (4× o trabalho por quadro) e o
    // gravador perdia quadros.
    const viewer = await createMugViewer(cv, template.spec, valores3d, {
      ...(cfgT ? { artColor: frente3d.artColor, font: frente3d.font } : {}),
      pixelRatio: 1,
    });
    let blob: Blob | null = null;
    try {
      blob = await viewer.recordTurntable(3600);
    } finally {
      viewer.dispose();
    }
    if (!blob || !blob.size) {
      throw new Error("Navegador sem suporte à gravação de vídeo — envie um snapshot ou mockup manual.");
    }
    const contentType = blob.type && blob.type.indexOf("video/") === 0 ? blob.type.split(";")[0] : MIME_DO_VIDEO;
    aoAvancar?.("arquivo");
    const b64 = await blobToBase64(blob);
    aoAvancar?.("envio");
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

  // Verso: quando a cliente personalizou o verso e o template tem a vista,
  // frente e verso saem lado a lado num PNG só (28/09/2026).
  aoAvancar?.("mockup");
  await cederAVez();
  const { tela, vista: view } = cfgT
    ? await telaDasVistas(template.spec.views as VisualView[], cfgT, customization, pecaT)
    : { tela: await exportCanvas(template.spec.views[0], customization, {}, 2048), vista: template.spec.views[0] as VisualView };
  const b64 = await arquivoDoMockup(tela, aoAvancar);
  if (!b64) {
    throw new Error("Não foi possível gerar o render (imagem da arte sem CORS?). Envie o mockup manualmente.");
  }

  aoAvancar?.("envio");
  const up = await uploadStudioMockup(companyId, {
    content_base64: b64,
    content_type: TIPO_DO_MOCKUP,
    kind: "approval",
  });
  if (!up?.url) throw new Error("Falha no upload do render");

  const reg = await studioVisualApi.createVisualRender(companyId, {
    template_key: template.key,
    template_version: template.version,
    kind: "hd_2d",
    customization,
    file_url: up.url,
    content_type: TIPO_DO_MOCKUP,
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
