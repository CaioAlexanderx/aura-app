// ============================================================
// components/studio/customizationConfig.ts
// A forma canônica de `products.customization_config` (19/08/2026).
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Havia dois editores gravando esta coluna em formatos diferentes:
// o wizard `produtos/[id]/personalizacao.tsx` (ids estáveis, config
// rico, campos de arte nunca obrigatórios) e o painel embutido no
// estoque, `StudioPersonalizacaoPanel.tsx` (ids `f_<timestamp>`,
// config vazio, checkbox "Obrigatório" livre por campo).
//
// O segundo é o único alcançável pela lojista — o wizard não tinha
// nenhuma navegação apontando para ele. Foi o painel que produziu a
// configuração da Sheid Mania que travou a compra em loja publicada
// (F1 §3.1) e a configuração vazia da §3.2. Duas correções defensivas
// já nasceram desse desencontro: o grupo de origem da arte em
// `useStorefront.validateRequiredFields` (S0) e o `transportarValores`
// por tipo do seletor de modelo (S1) — "porque os ids não são
// estáveis entre produtos".
//
// A decisão (docs/studio/PERSONALIZACAO_CANONICA.md): o painel é o
// editor canônico, a forma do wizard é o dado canônico, e este módulo
// é quem sabe qual é ela. O wizard virou redirect.
//
// TRÊS REGRAS, e todas existem por um bug que já aconteceu:
//
// 1. ID É DERIVADO DO TIPO, NUNCA DO RELÓGIO. O motor visual lê
//    `values.text`, `values.image` e `values.template` por id
//    (compose2d.ts, compose3dMug.ts). Com `f_1747...` o mockup 3D não
//    recebe nada — nem na vitrine, nem no preview do próprio painel.
//
// 2. CONFIG VAZIO NÃO É CONFIG. `{}` significa sem swatches, sem
//    price_delta, sem limite de upload. Todo campo nasce com o padrão
//    do seu tipo, e a lojista edita a partir dali. Com uma fronteira:
//    a normalização preenche decisão de apresentação, nunca fato do
//    produto — ver `normalizationDefaults`.
//
// 3. O IMPOSSÍVEL NÃO É REPRESENTÁVEL. `image` e `template` preenchem
//    o mesmo slot de arte, então obrigatoriedade é do GRUPO, não do
//    campo — marcar os dois separadamente era a armadilha da Sheid.
//    `art_service` e seu briefing nunca são obrigatórios: quem
//    contrata a criação não tem arte para enviar.
// ============================================================
import type {
  CustomizationConfig,
  CustomizationField,
  CustomizationFieldType,
  CustomizationFieldSide,
} from "@/services/studioApi";
import {
  ART_SERVICE_FIELD_ID,
  ART_SERVICE_BRIEF_ID,
  buildArtServiceChoices,
} from "@/components/studio/artService";

export { ART_SERVICE_FIELD_ID, ART_SERVICE_BRIEF_ID };

// ── Presets ────────────────────────────────────────────────
// Vieram do wizard, que era o lado que tinha config rico.
export const FONTS_PRESET = ["Pacifico", "Caveat", "Playfair Display", "Bebas Neue", "Inter"];
export const COLORS_PRESET = ["#0F172A", "#BE185D", "#7C3AED", "#1D4ED8", "#D97706", "#059669", "#EC4899", "#FFFFFF"];
// MIME, nao extensao solta: e o que o atributo `accept` do input de
// arquivo entende e o que a vitrine espera. Com "png" solto o rotulo
// de formatos estourava e derrubava a loja inteira — e como TODO campo
// de imagem nascia daqui, valia pra qualquer produto que pedisse arte.
// A vitrine hoje aceita as duas formas (ver FieldImage), entao os
// produtos ja gravados continuam funcionando sem migration.
export const FORMATS_PRESET = ["image/png", "image/jpeg", "application/pdf"];
export const TEXT_MAX_CHARS_PADRAO = 20;
export const IMAGE_MAX_MB_PADRAO = 10;
export const IMAGE_MIN_DPI_PADRAO = 150;
export const BRIEF_MAX_CHARS = 600;

/**
 * `image` e `template` preenchem o mesmo slot de arte.
 *
 * FONTE ÚNICA: `useStorefront.validateRequiredFields` importa daqui, e
 * `validateCustomizationValues` em src/routes/studioStorefront.js
 * (aura-backend) é o espelho do outro lado. Se os três divergirem, o
 * item entra no carrinho e o pedido leva 400 no fechamento.
 */
export const ART_SOURCE_TYPES: readonly CustomizationFieldType[] = ["image", "template"];

export function isArtSourceType(type: string): boolean {
  return ART_SOURCE_TYPES.includes(type as CustomizationFieldType);
}

/** O campo de serviço de arte, por id canônico ou pela marca no config. */
export function isArtServiceField(f: { id?: string; config?: any } | null | undefined): boolean {
  if (!f) return false;
  return f.id === ART_SERVICE_FIELD_ID || (f.config as any)?.is_art_service === true;
}

/** O briefing só é identificável pelo id — nada no shape o distingue de um texto. */
export function isArtBriefField(f: { id?: string } | null | undefined): boolean {
  return f?.id === ART_SERVICE_BRIEF_ID;
}

/** Campos com id fixo, fora da numeração por tipo. */
export function hasFixedId(f: { id?: string; config?: any } | null | undefined): boolean {
  return isArtServiceField(f) || isArtBriefField(f);
}

// ── Ids ────────────────────────────────────────────────────
/**
 * O id de um campo é `<tipo>` para o primeiro daquele tipo na frente,
 * `<tipo>_back` no verso, `<tipo>_middle` no meio, e sufixo numérico do
 * segundo em diante: `text`, `text_2`, `image`, `image_back`,
 * `color_back_2`, `image_middle`.
 *
 * A regra existe para que o primeiro campo de texto de qualquer produto
 * se chame `text` — é o que o motor visual procura.
 */
export function canonicalFieldId(
  type: CustomizationFieldType,
  side: CustomizationFieldSide,
  ordinal: number
): string {
  const base = side === "front" ? type : `${type}_${side}`;
  return ordinal === 0 ? base : `${base}_${ordinal + 1}`;
}

/**
 * Traduz os valores de um lado para as chaves canonicas da FRENTE.
 *
 * Os motores visuais (compose2d, compose3dMug) leem `values.text`,
 * `values.image` e `values.template` na unha — eles nao sabem o que e
 * lado. Mas o id canonico carrega o sufixo (`text_back`, `text_middle`),
 * entao entregar os valores crus faz o motor nao achar nada e pintar a
 * peca vazia.
 *
 * Aqui o lado pedido vira o "front" do motor. So o que esta naquele lado
 * entra: o verso nao mostra a arte da frente, que e o certo.
 */
export function valuesForSide(
  values: Record<string, any> | null | undefined,
  side: CustomizationFieldSide
): Record<string, any> {
  const v = values || {};
  if (side === "front") return v;
  const out: Record<string, any> = {};
  const re = new RegExp("^(.+?)_" + side + "(_\d+)?$");
  for (const k of Object.keys(v)) {
    const m = k.match(re);
    if (m) out[m[1] + (m[2] || "")] = v[k];
  }
  return out;
}

/**
 * Rotulo legivel de uma chave da personalizacao.
 *
 * O `customization` do pedido nao guarda so os campos: guarda tambem
 * CHAVES LATERAIS que o cliente preencheu na vitrine — a cor da arte, o
 * briefing, o opt-in de verso e meio. Na tela do pedido elas apareciam
 * cruas (`text_cor`, `has_back_selected`), e quem le isso e a oficina,
 * que precisa saber em que cor estampar e se tem verso.
 *
 * Campo normal continua usando o label que a lojista escreveu.
 */
export function rotuloDaChave(
  chave: string,
  camposPorId: Record<string, { label?: string } | undefined>,
): string {
  const campo = camposPorId[chave];
  if (campo?.label) return campo.label;

  if (chave === "art_service_brief") return "Briefing da arte";
  if (chave === "has_back_selected") return "Personalizar o verso";
  if (chave === "has_middle_selected") return "Personalizar o meio";

  const mCor = chave.match(/^(.+)_cor$/);
  if (mCor) {
    const dono = camposPorId[mCor[1]]?.label;
    return dono ? `Cor da arte — ${dono}` : "Cor da arte";
  }

  return chave;
}

/** Valor legivel: booleano vira Sim/Nao em vez de "true". */
export function valorDaChave(valor: unknown): string {
  if (valor === true) return "Sim";
  if (valor === false) return "Não";
  if (valor == null) return "—";
  return String(valor);
}

export function sideOf(f: { side?: string } | null | undefined): CustomizationFieldSide {
  const s = (f as any)?.side;
  return s === "back" || s === "middle" ? s : "front";
}

/**
 * Reescreve os ids de uma lista de campos, preservando a ordem.
 *
 * Devolve também o mapa antigo→novo: quem tiver valores em memória
 * presos aos ids velhos (um rascunho, um preview) consegue reapontá-los
 * sem perder o que a lojista já digitou.
 */
export function canonicalizeIds(fields: CustomizationField[]): {
  fields: CustomizationField[];
  idMap: Record<string, string>;
} {
  const contadores: Record<string, number> = {};
  const idMap: Record<string, string> = {};
  const out = fields.map((f) => {
    if (hasFixedId(f)) {
      const fixo = isArtServiceField(f) ? ART_SERVICE_FIELD_ID : ART_SERVICE_BRIEF_ID;
      if (f.id !== fixo) idMap[f.id] = fixo;
      return { ...f, id: fixo };
    }
    const side = sideOf(f);
    const chave = `${f.type}|${side}`;
    const ordinal = contadores[chave] ?? 0;
    contadores[chave] = ordinal + 1;
    const novo = canonicalFieldId(f.type, side, ordinal);
    if (f.id !== novo) idMap[f.id] = novo;
    return { ...f, id: novo };
  });
  return { fields: out, idMap };
}

// ── Config por tipo ────────────────────────────────────────
/**
 * O config de um campo RECÉM-CRIADO no editor. Inclui um ponto de
 * partida para paleta e opções — a lojista está olhando para a tela e
 * vai editar em cima.
 */
export function defaultFieldConfig(type: CustomizationFieldType): CustomizationField["config"] {
  switch (type) {
    case "color":
      return { ...normalizationDefaults("color"), colors: [...COLORS_PRESET] };
    case "option":
      return {
        ...normalizationDefaults("option"),
        choices: [{ value: "p", label: "P" }, { value: "m", label: "M" }, { value: "g", label: "G" }],
      };
    default:
      return normalizationDefaults(type);
  }
}

/**
 * O que a NORMALIZAÇÃO pode preencher sozinha, sem ninguém olhando.
 *
 * A diferença para `defaultFieldConfig` é deliberada e veio do dado de
 * produção: 26 dos 29 produtos personalizáveis têm `config: {}`. Limite
 * de caracteres, formatos aceitos e DPI mínimo são decisões de
 * apresentação — preencher é favor. Já a paleta de um campo de cor e as
 * choices de um campo de opção são FATOS DO PRODUTO: quais cores essa
 * caneca tem, quais tamanhos essa camisa tem. Inventar P/M/G numa caneca
 * porque o campo estava vazio é escrever no banco uma informação que
 * ninguém deu — e numa loja publicada isso vira preço e expectativa
 * errados na vitrine.
 *
 * Campo de cor ou opção sem valor continua vazio. É trabalho de
 * conteúdo com a lojista (S7 da F1), não de migração.
 */
export function normalizationDefaults(type: CustomizationFieldType): CustomizationField["config"] {
  switch (type) {
    case "text":
      return { max_chars: TEXT_MAX_CHARS_PADRAO, fonts: [...FONTS_PRESET], colors: [...COLORS_PRESET] };
    case "image":
      return { formats: [...FORMATS_PRESET], max_mb: IMAGE_MAX_MB_PADRAO, min_dpi: IMAGE_MIN_DPI_PADRAO };
    case "template":
      return { category_ids: [] };
    case "color":
    case "option":
      return {};
    default:
      return {};
  }
}

export function defaultFieldLabel(type: CustomizationFieldType): string {
  switch (type) {
    case "text":     return "Texto personalizado";
    case "image":    return "Sua arte";
    case "template": return "Escolher da galeria";
    case "color":    return "Cor";
    case "option":   return "Opção";
    default:         return "Campo";
  }
}

/**
 * Completa o config de um campo com o padrão do tipo, sem sobrescrever
 * nada que a lojista tenha escolhido.
 *
 * `art_service` fica de fora: as choices dele são construídas por
 * `buildArtServiceChoices` e o padrão de `option` (P/M/G) só faria
 * estrago ali.
 */
export function withDefaultConfig(field: CustomizationField): CustomizationField {
  const atual: any = field.config && typeof field.config === "object" ? { ...field.config } : {};

  if (isArtServiceField(field)) {
    atual.is_art_service = true;
    if (!Array.isArray(atual.choices) || atual.choices.length === 0) {
      atual.choices = buildArtServiceChoices(0, 0);
    }
    return { ...field, config: atual };
  }
  if (isArtBriefField(field)) {
    if (typeof atual.max_chars !== "number") atual.max_chars = BRIEF_MAX_CHARS;
    return { ...field, config: atual };
  }

  const padrao: any = normalizationDefaults(field.type);
  for (const chave of Object.keys(padrao)) {
    const v = atual[chave];
    const vazio = v == null || (Array.isArray(v) && v.length === 0);
    if (vazio) atual[chave] = padrao[chave];
  }
  return { ...field, config: atual };
}

// ── Obrigatoriedade ────────────────────────────────────────
/**
 * Obrigatoriedade da origem da arte é do grupo, por lado.
 *
 * Se a lojista marcou qualquer um de `image`/`template`, todos do mesmo
 * lado ficam marcados — que é como `validateRequiredFields` já lê o
 * dado desde o S0. O que muda é o dado deixar de mentir: antes o
 * config dizia "os dois obrigatórios, cumulativamente" e só a validação
 * sabia que não era isso.
 */
export function applyRequiredRules(fields: CustomizationField[]): CustomizationField[] {
  const grupoObrigatorio: Record<string, boolean> = { front: false, back: false, middle: false };
  for (const f of fields) {
    if (isArtSourceType(f.type) && f.required && !hasFixedId(f)) {
      grupoObrigatorio[sideOf(f)] = true;
    }
  }
  return fields.map((f) => {
    if (hasFixedId(f)) return { ...f, required: false };
    if (isArtSourceType(f.type)) return { ...f, required: grupoObrigatorio[sideOf(f)] };
    return { ...f, required: f.required === true };
  });
}

/** A obrigatoriedade da origem da arte de um lado, para a UI de um toggle só. */
export function artSourceRequired(
  fields: CustomizationField[],
  side: CustomizationFieldSide = "front"
): boolean {
  return fields.some((f) => isArtSourceType(f.type) && sideOf(f) === side && f.required);
}

// ── Normalização ───────────────────────────────────────────
const POSICOES = ["center", "left", "right"] as const;

function normalizePrintArea(pa: any, padraoW = 10, padraoH = 10) {
  const w = Number(pa?.width_cm);
  const h = Number(pa?.height_cm);
  return {
    width_cm: Number.isFinite(w) && w > 0 ? w : padraoW,
    height_cm: Number.isFinite(h) && h > 0 ? h : padraoH,
    position: (POSICOES as readonly string[]).includes(pa?.position) ? pa.position : "center",
  } as CustomizationConfig["print_area"];
}

/**
 * Qualquer config — vinda do painel antigo, do wizard, ou já canônica —
 * vira a forma canônica. Idempotente: normalizar duas vezes dá o mesmo
 * resultado, e é isso que a migração de dados verifica.
 *
 * Chaves fora do tipo (`size_guide`, `qty_multiplier_by_option`) passam
 * intactas: são de outros donos e não é aqui que se decide sobre elas.
 */
export function normalizeCustomizationConfig(
  cfg: CustomizationConfig | null | undefined
): CustomizationConfig {
  const origem: any = cfg && typeof cfg === "object" ? cfg : {};
  const hasBack = origem.has_back === true;
  const hasMiddle = origem.has_middle === true;

  const tiposValidos: CustomizationFieldType[] = ["text", "image", "template", "color", "option"];
  let fields: CustomizationField[] = (Array.isArray(origem.fields) ? origem.fields : [])
    .filter((f: any) => f && tiposValidos.includes(f.type))
    .map((f: any, i: number) => ({
      id: typeof f.id === "string" && f.id.trim() ? f.id : `_${i}`,
      type: f.type as CustomizationFieldType,
      label: typeof f.label === "string" && f.label.trim() ? f.label : defaultFieldLabel(f.type),
      required: f.required === true,
      config: f.config && typeof f.config === "object" ? f.config : {},
      // Lado desligado rebaixa o campo para a frente — o backend recusa
      // side='back' sem has_back e side='middle' sem has_middle
      // (studio.js), e a validação da vitrine pula esses campos.
      side: ((f.side === "back" && hasBack) || (f.side === "middle" && hasMiddle)
        ? f.side
        : "front") as CustomizationFieldSide,
    }));

  fields = canonicalizeIds(fields).fields;
  fields = fields.map(withDefaultConfig);
  fields = applyRequiredRules(fields);

  const out: any = {
    ...origem,
    print_area: normalizePrintArea(origem.print_area),
    fields,
  };

  if (hasBack) {
    out.has_back = true;
    out.back_print_area = normalizePrintArea(origem.back_print_area);
    if (origem.back_charge_enabled === true) {
      const d = Number(origem.back_price_delta);
      out.back_charge_enabled = true;
      out.back_price_delta = Number.isFinite(d) && d >= 0 ? d : 0;
    } else {
      delete out.back_charge_enabled;
      delete out.back_price_delta;
    }
  } else {
    delete out.has_back;
    delete out.back_print_area;
    delete out.back_charge_enabled;
    delete out.back_price_delta;
  }

  // Meio (faixa central / wrap 360): mesmo tratamento do verso.
  if (hasMiddle) {
    out.has_middle = true;
    out.middle_print_area = normalizePrintArea(origem.middle_print_area);
    if (origem.middle_charge_enabled === true) {
      const d = Number(origem.middle_price_delta);
      out.middle_charge_enabled = true;
      out.middle_price_delta = Number.isFinite(d) && d >= 0 ? d : 0;
    } else {
      delete out.middle_charge_enabled;
      delete out.middle_price_delta;
    }
  } else {
    delete out.has_middle;
    delete out.middle_print_area;
    delete out.middle_charge_enabled;
    delete out.middle_price_delta;
  }

  return out as CustomizationConfig;
}

/**
 * Se a config já está canônica. É o que a migração usa para contar sem
 * escrever, e o que o teste usa para travar a idempotência.
 */
export function isCanonicalConfig(cfg: CustomizationConfig | null | undefined): boolean {
  if (!cfg) return false;
  return JSON.stringify(cfg) === JSON.stringify(normalizeCustomizationConfig(cfg));
}

/** Um campo novo, já canônico, para o botão "+ Adicionar campo" do painel. */
export function makeField(
  type: CustomizationFieldType,
  side: CustomizationFieldSide = "front"
): CustomizationField {
  return {
    id: canonicalFieldId(type, side, 0),
    type,
    label: defaultFieldLabel(type),
    required: false,
    config: defaultFieldConfig(type),
    side,
  } as CustomizationField;
}

/** O par `art_service` + briefing, com os preços dos dois caminhos pagos. */
export function makeArtServiceFields(
  adjustPrice: string | number | null | undefined,
  designPrice: string | number | null | undefined
): CustomizationField[] {
  return [
    {
      id: ART_SERVICE_FIELD_ID,
      type: "option",
      label: "Quem cria a arte",
      required: false,
      side: "front",
      config: {
        is_art_service: true,
        choices: buildArtServiceChoices(adjustPrice, designPrice),
      },
    } as any,
    {
      id: ART_SERVICE_BRIEF_ID,
      type: "text",
      label: "Briefing da arte",
      required: false,
      side: "front",
      config: { max_chars: BRIEF_MAX_CHARS, fonts: [], colors: [] },
    } as any,
  ];
}
