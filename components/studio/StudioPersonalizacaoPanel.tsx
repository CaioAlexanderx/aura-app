// ============================================================
// AURA STUDIO · StudioPersonalizacaoPanel — a ficha de personalização
// do produto (aba Personalização de Estoque › produto aberto)
//
// Redesenho de 29/09/2026 (pedido do PO: "muito extensa, simplificar").
// Diagnóstico e decisões: docs/studio/ficha-de-personalizacao-diagnostico.md
// Mockup aprovado:        docs/mockups/studio-ficha-de-personalizacao.html
//
//   ┌─ Prévia (uma só) ─┐  ┌─ Interruptor "aceita personalização" ─────┐
//   │ Frente · Verso    │  │ 1 Como a peça aparece na loja (seletor)    │
//   │ [EnginePreview]   │  │ 2 Onde imprime (Frente · Verso · Volta)    │
//   │ Testar com a arte │  │ 3 O que a cliente escolhe (cartões)        │
//   │ Ver na loja · Wpp │  │ 4 Serviço de arte (padrão da loja)         │
//   └───────────────────┘  │ ▸ Avançado                                 │
//                          │ [Salvo · Frente: 2 campos]   [ Salvar ]    │
//                          └────────────────────────────────────────────┘
//   Desktop (> 768): prévia em coluna fixa de 380 px (sticky).
//   Celular: prévia fixa no topo, encolhe ao rolar; Salvar fixo embaixo.
//
// Editor CANÔNICO de `customization_config` (19/08/2026). O redesenho não
// muda o que se grava: a forma mora em customizationConfig.ts, e todo
// mutator estrutural passa por `comIdsCanonicos`. O cartão "Arte da
// cliente" é a UI do grupo imagem + template de um lado, que é como a
// forma canônica já trata os dois.
//
// Convenções (não negociar):
//   - useStudioTokens() + useMemo(() => buildStyles(t), [t])
//   - toast de @/components/Toast; erro: [status] data.error || message
//   - console.error com {status, code, message, data}; NUNCA logar payload
//     completo (PII) — só contagens
//   - companyId em toda chamada (multi-CNPJ)
//   - alvos de 44 px; nada escondido atrás de hover
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  StyleSheet, ScrollView, Modal, Platform, useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { respiroInferior } from "@/components/studio/modalNoCelular";
import {
  studioApi,
  type CustomizationConfig,
  type CustomizationField,
  type CustomizationFieldType,
} from "@/services/studioApi";
import { EnginePreview, invalidateProductTemplate } from "@/components/studio/visualEngine/EnginePreview";
import { studioStorefrontUrl } from "@/utils/storefrontUrl";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { useSpecsDosModelos } from "@/components/studio/mockupPorProduto/useSpecsDosModelos";
import { MiniaturaDoModelo } from "@/components/studio/mockupPorProduto/MiniaturaDoModelo";
import { metaDoModelo } from "@/components/studio/mockupPorProduto/regras";
import { PreviewWhatsAppModal } from "@/components/studio/PreviewWhatsAppModal";
import { MockupNaFotoSecao } from "@/components/studio/MockupNaFotoSecao";
import {
  TECNICAS, rotuloDaTecnica, explicacaoDaTecnica, campoDaArteDeTeste, EditorDeTesteDaArte,
} from "@/components/studio/TecnicaETesteDaArte";
import { EscolherDaGaleriaModal } from "@/components/studio/EscolherDaGaleriaModal";
import { temMockupNaFoto } from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { request } from "@/services/api";
import { ladoSemCampo, AVISO_LADO_SEM_CAMPO } from "@/components/studio/ladoSemCampo";
import {
  normalizeCustomizationConfig, canonicalizeIds, canonicalFieldId, makeField, makeArtServiceFields,
  artSourceRequired, isArtSourceType, isArtServiceField, isArtBriefField, hasFixedId, sideOf,
  TEXT_MAX_CHARS_PADRAO,
} from "@/components/studio/customizationConfig";
import {
  ART_ADJUST, ART_DESIGNER, parseArtPrice, buildArtServiceChoices,
} from "@/components/studio/artService";

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────
type Props = {
  productId: string;
  companyId: string;
  productName: string;
  productPrice: number;
  slug?: string | null;
  onSaved?: (cfg: CustomizationConfig) => void;
  /** Capa + galeria do produto (fotosDoProduto) — o "Marcar a área na foto" marca numa delas. */
  fotos?: string[];
  /** Templates da galeria vinculados direto ao produto (product.template_count). */
  templateCount?: number;
  /** O vinculador da galeria mudou a contagem. */
  onTemplateCountChanged?: (count: number) => void;
};

// Lado do campo — o backend espera "front" | "back" | "middle"
// (middle = "Volta inteira": caneca/copo com arte que dá a volta).
type FieldSide = "front" | "back" | "middle";
type Posicao = "left" | "center" | "right";
type Area = { width_cm: number; height_cm: number; position: Posicao };
type PadraoDaLoja = { adjust_price: number; design_price: number };
type TipoNovo = "arte" | "texto" | "cor" | "opcao";

const NOME_DO_LADO: Record<FieldSide, string> = { front: "Frente", back: "Verso", middle: "Volta inteira" };
const NOME_DO_LADO_MIN: Record<FieldSide, string> = { front: "frente", back: "verso", middle: "volta inteira" };

const POSITIONS: Array<{ value: Posicao; label: string }> = [
  { value: "left",   label: "Esquerda" },
  { value: "center", label: "Centro"   },
  { value: "right",  label: "Direita"  },
];

const MENU_ADICIONAR: Array<{ tipo: TipoNovo; titulo: string; desc: string; glifo: keyof typeof GLIFOS }> = [
  { tipo: "arte",  titulo: "Arte da cliente", desc: "Ela envia um arquivo ou escolhe da galeria", glifo: "arte" },
  { tipo: "texto", titulo: "Texto",           desc: "Nome, frase ou data que ela digita",         glifo: "texto" },
  { tipo: "cor",   titulo: "Cor da peça",     desc: "Ela escolhe entre as cores que você tem",    glifo: "cor" },
  { tipo: "opcao", titulo: "Opção",           desc: "Tamanho, sabor, acabamento: uma lista",      glifo: "opcao" },
];

// Presets de cor de 1 toque no editor visual de paleta (19/08/2026)
const COLOR_PRESETS = [
  "#FFFFFF", "#000000", "#EF4444", "#F97316", "#FACC15",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#94A3B8",
];

// Gera value a partir do label da opção ("Azul Marinho" → azul-marinho)
function slugifyOption(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

function reais(n: number): string {
  return "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",");
}

// ────────────────────────────────────────────────────────────
// Padrões de produto novo
//
// Produto sem nenhum campo abre com o caso mais comum pronto (decisão
// 3.3 do diagnóstico): a arte da cliente na frente, obrigatória, e um
// nome opcional. A lojista confere e salva, ou ajusta o que for diferente.
// ────────────────────────────────────────────────────────────
export function sanitizeConfig(cfg: CustomizationConfig | null | undefined): CustomizationConfig {
  const base = normalizeCustomizationConfig(cfg);
  if (base.fields.length > 0) return base;
  return normalizeCustomizationConfig({
    ...base,
    fields: [
      { ...makeField("image"), required: true },
      { ...makeField("text"), label: "Nome na peça" },
    ],
  });
}

/**
 * Reaplica os ids canônicos depois de qualquer mudança estrutural.
 *
 * Adicionar, remover, reordenar ou trocar de lado muda quem é o
 * primeiro campo de cada tipo — e o id acompanha, porque é derivado do
 * tipo e da ordem. Chamar isto em todo mutator é o que impede o painel
 * de voltar a gravar id que não bate com o motor visual.
 */
function comIdsCanonicos(cfg: CustomizationConfig): CustomizationConfig {
  return { ...cfg, fields: canonicalizeIds(cfg.fields).fields };
}

/** JSON com as chaves em ordem: ligar e desligar o verso não é "alteração". */
export function jsonEstavel(v: any): string {
  if (Array.isArray(v)) return "[" + v.map(jsonEstavel).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + jsonEstavel(v[k])).join(",") + "}";
  }
  return JSON.stringify(v ?? null);
}

/** Os preços dos dois caminhos pagos, gravados nas choices de `art_service`. */
function precosDoServico(fields: CustomizationField[]): { ajuste: number; criacao: number } {
  const campo = fields.find((f) => isArtServiceField(f));
  const choices = (campo?.config?.choices || []) as Array<{ value: string; price_delta?: number }>;
  return {
    ajuste: choices.find((c) => c.value === ART_ADJUST)?.price_delta ?? 0,
    criacao: choices.find((c) => c.value === ART_DESIGNER)?.price_delta ?? 0,
  };
}

function comPrecosDoServico<T extends CustomizationConfig>(cfg: T, ajuste: number, criacao: number): T {
  return {
    ...cfg,
    fields: cfg.fields.map((f) =>
      isArtServiceField(f)
        ? { ...f, config: { ...f.config, is_art_service: true, choices: buildArtServiceChoices(ajuste, criacao) } as any }
        : f
    ),
  };
}

// ── Itens da lista "O que a cliente escolhe" ─────────────────
// Um cartão por campo, exceto a arte: `image` e `template` do mesmo lado
// viram UM cartão "Arte da cliente". O serviço de arte (e o briefing)
// ficam fora: quem os edita é o bloco 4.
type ItemDaLista =
  | { tipo: "arte"; chave: string; lado: FieldSide; campos: CustomizationField[] }
  | { tipo: "campo"; chave: string; campo: CustomizationField };

function itensDaLista(fields: CustomizationField[]): ItemDaLista[] {
  const out: ItemDaLista[] = [];
  const arteDoLado: Partial<Record<FieldSide, { campos: CustomizationField[] }>> = {};
  for (const f of fields) {
    if (isArtServiceField(f) || isArtBriefField(f)) continue;
    if (isArtSourceType(f.type)) {
      const lado = sideOf(f) as FieldSide;
      const ja = arteDoLado[lado];
      if (ja) { ja.campos.push(f); continue; }
      const item = { tipo: "arte" as const, chave: "arte:" + lado, lado, campos: [f] };
      arteDoLado[lado] = item;
      out.push(item);
      continue;
    }
    out.push({ tipo: "campo", chave: f.id, campo: f });
  }
  return out;
}

function camposDosItens(itens: ItemDaLista[]): CustomizationField[] {
  return itens.flatMap((it) => (it.tipo === "arte" ? it.campos : [it.campo]));
}

// ── Guia de medidas ─────────────────────────────────────────
// O storefront lê `customization_config.size_guide` e mostra o link "Ver
// guia de medidas" (SizeGuideModal).
export type SizeGuideShape = { file_url: string; content_type: string };

const GUIA_TIPOS_ACEITOS = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf",
];
const GUIA_MAX_MB = 15;

async function uploadSizeGuide(
  companyId: string,
  file: File
): Promise<{ url: string; content_type: string }> {
  const reader = new FileReader();
  const dataUrl: string = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
  const data = await request<{ url: string }>(
    "/companies/" + companyId + "/studio/upload-mockup",
    {
      method: "POST",
      body: {
        content_base64: dataUrl.split(",")[1],
        content_type: file.type,
        filename: file.name,
      },
    }
  );
  return { url: data.url, content_type: file.type };
}

// ── Glifos do mockup (traço, 24×24) ──────────────────────────
const GLIFOS = {
  peca: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.3 7L12 12l8.7-5 M12 22V12",
  grade: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z M3 9h18 M9 21V9",
  escolhe: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  pincel: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6 M11 13a2 2 0 100-4 2 2 0 000 4z",
  arte: "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21",
  texto: "M4 7V4h16v3 M9 20h6 M12 4v16",
  cor: "M12 22a7 7 0 007-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 007 7z",
  opcao: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  seta: "M6 9l6 6 6-6",
  cima: "M18 15l-6-6-6 6",
  lixo: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6",
  enviar: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  alerta: "M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  mais: "M12 5v14 M5 12h14",
  ok: "M20 6L9 17l-5-5",
  fechar: "M18 6L6 18 M6 6l12 12",
} as const;

function Glifo({ nome, tamanho = 16, cor, traco = 2.2 }: { nome: keyof typeof GLIFOS; tamanho?: number; cor: string; traco?: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round">
      <Path d={GLIFOS[nome]} />
    </Svg>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export function StudioPersonalizacaoPanel({
  productId, companyId, productName, productPrice, slug, onSaved, fotos,
  templateCount = 0, onTemplateCountChanged,
}: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { width: vw } = useWindowDimensions();
  const isWide = vw > 768;
  const ehWeb = Platform.OS === "web";

  const [loading, setLoading] = useState(true);
  const [isPersonalizable, setIsPersonalizable] = useState(false);
  const [config, setConfig] = useState<CustomizationConfig>(() => sanitizeConfig(null));
  const [saving, setSaving] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  // "Não salvo" = a config atual difere (JSON estável) do último config
  // carregado ou salvo. Produto novo compara com o vazio que veio do banco.
  const [salvoJson, setSalvoJson] = useState<string>("");
  // A config carregada não tinha campos e o painel aplicou os padrões.
  const [produtoNovo, setProdutoNovo] = useState(false);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showWaPreview, setShowWaPreview] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [mockupFotoAberto, setMockupFotoAberto] = useState(false);
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  // Cartões abertos: por padrão só o recém-adicionado.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSide, setSuggestSide] = useState<FieldSide>("front");
  const [suggestions, setSuggestions] = useState<Array<{ template_id: string; reason: string; score: number }>>([]);
  const [suggestChecked, setSuggestChecked] = useState<Record<string, boolean>>({});

  // ── Modelo da peça (motor visual 2D/3D — 19/08/2026) ──
  // visualKey: modelo vinculado (null = usa a foto do produto).
  // visualEpoch força remount do EnginePreview após trocar (cache já invalidado).
  const [visualKey, setVisualKey] = useState<string | null>(null);
  const [visualTemplates, setVisualTemplates] = useState<VisualTemplate[]>([]);
  const [savingVisual, setSavingVisual] = useState(false);
  const [visualEpoch, setVisualEpoch] = useState(0);
  // A lista não traz a spec: sem ela a miniatura não sabe se o 3D é
  // caneca ou camiseta. Mesmo cache da aba Aparência (key@versão).
  const specsDosModelos = useSpecsDosModelos(companyId, visualTemplates);

  // Lado desenhado na prévia.
  const [previewSide, setPreviewSide] = useState<FieldSide>("front");
  // Celular: a prévia encolhe depois de ~60 px de rolagem.
  const [compacta, setCompacta] = useState(false);
  // "Testar com a sua arte": arquivo local, nada é enviado nem salvo.
  const [arteTeste, setArteTeste] = useState<{ url: string; nome: string } | null>(null);
  const arteInputRef = useRef<any>(null);

  // ── Serviço de arte: o padrão da loja ─────────────────
  // undefined = ainda não sei (carregando ou falhou: sem regra de loja);
  // null = a loja ainda não tem padrão; objeto = o padrão.
  const [lojaPadrao, setLojaPadrao] = useState<PadraoDaLoja | null | undefined>(undefined);
  // "Mudar para toda a loja": os inputs editam o padrão, gravado no Salvar.
  const [servicoParaLoja, setServicoParaLoja] = useState(false);

  // ── Guia de medidas ────────────────────────────────────
  const [guideUploading, setGuideUploading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const guideInputRef = useRef<any>(null);

  const raizRef = useRef<any>(null);
  const previaFixaRef = useRef<any>(null);

  // ── Lados — flags do config ───────────────────────────
  const cfgAny: any = config;
  const hasBack: boolean = !!cfgAny.has_back;
  const hasMiddle: boolean = !!cfgAny.has_middle;
  const ladosAtivos: FieldSide[] = useMemo(
    () => ["front", ...(hasBack ? ["back"] : []), ...(hasMiddle ? ["middle"] : [])] as FieldSide[],
    [hasBack, hasMiddle]
  );
  const areaDoLado = (lado: FieldSide): Area => {
    const pa = lado === "back" ? cfgAny.back_print_area : lado === "middle" ? cfgAny.middle_print_area : cfgAny.print_area;
    return {
      width_cm: Number(pa?.width_cm) || 0,
      height_cm: Number(pa?.height_cm) || 0,
      position: (pa?.position as Posicao) || "center",
    };
  };
  const cobrancaDoLado = (lado: "back" | "middle"): number | undefined => {
    if (!cfgAny[lado + "_charge_enabled"]) return undefined;
    const d = Number(cfgAny[lado + "_price_delta"]);
    return Number.isFinite(d) ? d : undefined;
  };

  // Desligou o lado que estava sendo visto? Volta pra frente.
  useEffect(() => {
    if (previewSide === "back" && !hasBack) setPreviewSide("front");
    if (previewSide === "middle" && !hasMiddle) setPreviewSide("front");
  }, [previewSide, hasBack, hasMiddle]);

  // ── Serviço de arte — derive do campo art_service ────
  const artEnabled = useMemo(() => config.fields.some((f) => isArtServiceField(f)), [config.fields]);
  const { ajuste: artAdjustPrice, criacao: artDesignPrice } = useMemo(() => precosDoServico(config.fields), [config.fields]);
  const segueLoja = cfgAny.art_service_use_store_default === true;

  // ── Guia de medidas — chave de raiz do config ────────
  const sizeGuide: SizeGuideShape | null =
    cfgAny.size_guide && typeof cfgAny.size_guide === "object" && cfgAny.size_guide.file_url
      ? cfgAny.size_guide
      : null;

  const itens = useMemo(() => itensDaLista(config.fields), [config.fields]);

  const textosNormais = useMemo(
    () => config.fields.filter((f) => f.type === "text" && !isArtBriefField(f)),
    [config.fields]
  );
  const limiteLetras = Number(textosNormais[0]?.config?.max_chars) || TEXT_MAX_CHARS_PADRAO;

  const naoSalvo = useMemo(
    () => jsonEstavel(normalizeCustomizationConfig(config)) !== salvoJson,
    [config, salvoJson]
  );

  const modeloAtual = visualTemplates.find((v) => v.key === visualKey) || null;
  const eh3D = modeloAtual?.kind === "model3d";
  const campoDoTeste = campoDaArteDeTeste(config);

  // ── Load mount ─────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    studioApi.getCustomizationConfig(companyId, productId)
      .then((r) => {
        if (!mounted) return;
        const bruto = normalizeCustomizationConfig(r.config);
        const novo = bruto.fields.length === 0;
        setIsPersonalizable(!!r.is_personalizable);
        setProdutoNovo(novo);
        setSalvoJson(jsonEstavel(bruto));
        setConfig(sanitizeConfig(r.config));
        setAbertos(novo ? { "arte:front": true } : {});
      })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] load error", {
          status: e?.status, code: e?.code, message: e?.message, data: e?.data,
        });
        const status = e?.status ? `[${e.status}] ` : "";
        toast.error(`${status}${e?.data?.error || e?.message || "Erro ao carregar"}`);
        // Mesmo erro: garante fallback usável
        setConfig(sanitizeConfig(null));
        setSalvoJson(jsonEstavel(normalizeCustomizationConfig(null)));
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [companyId, productId]);

  // ── Load do padrão da loja (serviço de arte) — não bloqueia ──
  useEffect(() => {
    let mounted = true;
    Promise.resolve()
      .then(() => studioApi.getSettings(companyId))
      .then((r) => {
        if (!mounted) return;
        const d: any = r?.settings?.art_service_defaults;
        setLojaPadrao(d && typeof d === "object"
          ? { adjust_price: parseArtPrice(d.adjust_price), design_price: parseArtPrice(d.design_price) }
          : null);
      })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] settings load error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
      });
    return () => { mounted = false; };
  }, [companyId]);

  // ── Load do modelo: vínculo do produto + catálogo publicado ──
  // Não bloqueia o painel: falha aqui só deixa a lista vazia.
  useEffect(() => {
    let mounted = true;
    studioVisualApi.getProductVisualTemplate(companyId, productId)
      .then((r) => { if (mounted) setVisualKey(r.visual_template_key || null); })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] visual-template load error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
      });
    studioVisualApi.listVisualTemplates(companyId)
      .then((r) => { if (mounted) setVisualTemplates(r.templates || []); })
      .catch((e: any) => {
        console.error("[StudioPersonalizacao] visual-templates list error", {
          status: e?.status, code: e?.code, message: e?.message,
        });
      });
    return () => { mounted = false; };
  }, [companyId, productId]);

  // ── Celular (web): a prévia encolhe ao rolar ───────────
  // A rolagem é da página (o ScrollView do Estoque), não deste painel;
  // escutar `scroll` na captura pega qualquer rolador. A prévia é sticky:
  // a distância entre o topo dela e o topo do painel é quanto já rolou.
  useEffect(() => {
    if (!ehWeb || isWide || !isPersonalizable || arteTeste || typeof document === "undefined") {
      setCompacta(false);
      return;
    }
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const raiz = raizRef.current, previa = previaFixaRef.current;
      if (!raiz?.getBoundingClientRect || !previa?.getBoundingClientRect) return;
      const rolado = previa.getBoundingClientRect().top - raiz.getBoundingClientRect().top;
      // Histerese: encolhe depois de 60 px, volta abaixo de 20 px.
      setCompacta((atual) => (atual ? rolado > 20 : rolado > 60));
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    document.addEventListener("scroll", aoRolar, true);
    return () => {
      document.removeEventListener("scroll", aoRolar, true);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ehWeb, isWide, isPersonalizable, arteTeste, loading]);

  // A URL do arquivo de teste morre com o painel.
  const urlDoTeste = useRef<string | null>(null);
  useEffect(() => () => {
    if (urlDoTeste.current) try { URL.revokeObjectURL(urlDoTeste.current); } catch { /* nada */ }
  }, []);

  // ── Troca de modelo — salva na hora (padrão do toggle de loja) ──
  async function selectVisualTemplate(key: string | null) {
    if (key === visualKey || savingVisual) return;
    const prev = visualKey;
    setSavingVisual(true);
    setVisualKey(key);
    try {
      await studioVisualApi.setProductVisualTemplate(companyId, productId, key);
      invalidateProductTemplate(companyId, productId);
      setVisualEpoch((e) => e + 1);
      toast.success(key ? "Modelo vinculado ao produto" : "A loja passa a usar a foto do produto");
      onSaved?.(config);
    } catch (e: any) {
      setVisualKey(prev);
      console.error("[StudioPersonalizacao] set visual-template error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro ao vincular o modelo"}`);
    } finally {
      setSavingVisual(false);
    }
  }

  // ── Valores de exemplo da prévia ───────────────────────
  const previewValues = useMemo(() => {
    const out: Record<string, any> = {};
    for (const f of config.fields) {
      if (isArtBriefField(f)) continue;
      if (f.type === "text") {
        out[f.id] = "Helena";
      } else if (f.type === "color") {
        const colors = (f.config?.colors as string[] | undefined) || ["#FFFFFF"];
        out[f.id] = colors[0];
      } else if (f.type === "option") {
        const choices = (f.config?.choices as Array<{ value: string }> | undefined) || [];
        if (choices.length > 0) out[f.id] = choices[0].value;
      }
    }
    return out;
  }, [config]);

  // ── Interruptor "aceita personalização" ───────────────
  async function togglePersonalizable(next: boolean) {
    setTogglePending(true);
    console.log("[StudioPersonalizacao] toggle", { productId, next });
    try {
      const resp = await studioApi.togglePersonalizable(companyId, productId, next);
      setIsPersonalizable(!!resp.is_personalizable);
      toast.success(next ? "Personalização ligada" : "Personalização desligada");
    } catch (e: any) {
      console.error("[StudioPersonalizacao] toggle error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro"}`);
    } finally {
      setTogglePending(false);
    }
  }

  // ── Mutators: onde imprime ─────────────────────────────
  function patchPrintArea(patch: Partial<Area>) {
    setConfig((prev) => ({ ...prev, print_area: { ...prev.print_area, ...patch } }));
  }

  function toggleHasBack(next: boolean) {
    setConfig((prev: any) => {
      if (next) {
        const existingBack = prev.back_print_area && typeof prev.back_print_area === "object"
          ? prev.back_print_area
          : { width_cm: 10, height_cm: 10, position: "center" };
        return { ...prev, has_back: true, back_print_area: existingBack };
      }
      // Desligar: limpa back_*, força side="front" só em quem estava no
      // verso — não mexe em quem está na volta inteira.
      const { has_back, back_print_area, back_charge_enabled, back_price_delta, ...rest } = prev;
      return comIdsCanonicos({
        ...rest,
        fields: prev.fields.map((f: any) => (f.side === "back" ? { ...f, side: "front" as FieldSide } : f)),
      });
    });
  }
  function patchBackPrintArea(patch: Partial<Area>) {
    setConfig((prev: any) => {
      const current = prev.back_print_area && typeof prev.back_print_area === "object"
        ? prev.back_print_area
        : { width_cm: 10, height_cm: 10, position: "center" };
      return { ...prev, has_back: true, back_print_area: { ...current, ...patch } };
    });
  }

  function toggleHasMiddle(next: boolean) {
    setConfig((prev: any) => {
      if (next) {
        const existingMiddle = prev.middle_print_area && typeof prev.middle_print_area === "object"
          ? prev.middle_print_area
          : { width_cm: 10, height_cm: 10, position: "center" };
        return { ...prev, has_middle: true, middle_print_area: existingMiddle };
      }
      const { has_middle, middle_print_area, middle_charge_enabled, middle_price_delta, ...rest } = prev;
      return comIdsCanonicos({
        ...rest,
        fields: prev.fields.map((f: any) => (f.side === "middle" ? { ...f, side: "front" as FieldSide } : f)),
      });
    });
  }
  function patchMiddlePrintArea(patch: Partial<Area>) {
    setConfig((prev: any) => {
      const current = prev.middle_print_area && typeof prev.middle_print_area === "object"
        ? prev.middle_print_area
        : { width_cm: 10, height_cm: 10, position: "center" };
      return { ...prev, has_middle: true, middle_print_area: { ...current, ...patch } };
    });
  }
  function patchAreaDoLado(lado: FieldSide, patch: Partial<Area>) {
    if (lado === "back") patchBackPrintArea(patch);
    else if (lado === "middle") patchMiddlePrintArea(patch);
    else patchPrintArea(patch);
  }

  /**
   * "a mais R$" do verso / da volta inteira. Valor > 0 liga a cobrança;
   * vazio ou 0 desliga — o backend recusa delta ≤ 0 com a cobrança ligada.
   */
  function setCobranca(lado: "back" | "middle", valor: number) {
    setConfig((prev: any) => {
      const chaveLig = lado + "_charge_enabled";
      const chaveVal = lado + "_price_delta";
      if (valor > 0) return { ...prev, [chaveLig]: true, [chaveVal]: valor };
      const { [chaveLig]: _l, [chaveVal]: _v, ...rest } = prev;
      return rest;
    });
  }

  // ── Mutators: campos ───────────────────────────────────
  function patchField(id: string, patch: Partial<CustomizationField>) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as any) : f)),
    }));
  }
  function patchFieldConfig(id: string, configPatch: Record<string, any>) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === id ? { ...f, config: { ...(f.config || {}), ...configPatch } } : f
      ),
    }));
  }
  function setFieldSide(id: string, side: FieldSide) {
    if (side === "back" && !hasBack) { toast.error("Ligue o verso em Onde imprime"); return; }
    if (side === "middle" && !hasMiddle) { toast.error("Ligue a volta inteira em Onde imprime"); return; }
    // O lado entra no id (`text` na frente, `text_back` no verso),
    // então trocar de lado renumera.
    setConfig((prev) => comIdsCanonicos({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? ({ ...f, side } as any) : f)),
    }));
  }

  /** Move um cartão inteiro (a arte leva os dois campos juntos). */
  function moverItem(chave: string, dir: -1 | 1) {
    setConfig((prev) => {
      const lista = itensDaLista(prev.fields);
      const i = lista.findIndex((x) => x.chave === chave);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= lista.length) return prev;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      const servico = prev.fields.filter((f) => isArtServiceField(f) || isArtBriefField(f));
      // Reordenar dois campos do mesmo tipo troca quem é o primeiro —
      // e o primeiro é quem fica com o id que o motor visual procura.
      return comIdsCanonicos({ ...prev, fields: [...camposDosItens(lista), ...servico] });
    });
  }
  /** Tira um cartão inteiro (a arte tira os dois campos do lado). */
  function tirarItem(item: ItemDaLista) {
    const ids = new Set(item.tipo === "arte" ? item.campos.map((f) => f.id) : [item.campo.id]);
    setConfig((prev) => comIdsCanonicos({ ...prev, fields: prev.fields.filter((f) => !ids.has(f.id)) }));
  }

  function adicionar(tipo: TipoNovo) {
    setAddMenuOpen(false);
    let lado: FieldSide = ladosAtivos.includes(previewSide) ? previewSide : "front";
    if (tipo === "arte") {
      const comArte = new Set(config.fields.filter((f) => isArtSourceType(f.type)).map((f) => sideOf(f) as FieldSide));
      if (comArte.has(lado)) {
        const livre = ladosAtivos.find((l) => !comArte.has(l));
        if (!livre) {
          toast.error("Cada lado já tem a sua arte. Abra o cartão para mudar.");
          setAbertos({ ["arte:" + lado]: true });
          return;
        }
        lado = livre;
      }
      const novo = makeField("image", lado);
      setConfig((prev) => comIdsCanonicos({ ...prev, fields: [...prev.fields, novo] }));
      setAbertos({ ["arte:" + lado]: true });
      return;
    }
    const tipoCampo: CustomizationFieldType = tipo === "texto" ? "text" : tipo === "cor" ? "color" : "option";
    const rotulo = tipo === "texto" ? "Frase na peça" : tipo === "cor" ? "Cor da peça" : "Tamanho";
    const novo: CustomizationField = {
      ...makeField(tipoCampo, lado),
      label: rotulo,
      required: tipo !== "texto",
      ...(tipo === "texto" ? { config: { ...makeField("text").config, max_chars: limiteLetras } } : {}),
      ...(tipo === "cor" ? { config: { ...makeField("color").config, colors: ["#FFFFFF", "#000000"] } } : {}),
    } as CustomizationField;
    const ordinal = config.fields.filter((f) => f.type === tipoCampo && sideOf(f) === lado && !hasFixedId(f)).length;
    setConfig((prev) => comIdsCanonicos({ ...prev, fields: [...prev.fields, novo] }));
    setAbertos({ [canonicalFieldId(tipoCampo, lado, ordinal)]: true });
  }

  // ── Arte da cliente: o grupo imagem + template de um lado ──
  function setArtSourceRequired(side: FieldSide, next: boolean) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        isArtSourceType(f.type) && sideOf(f) === side ? { ...f, required: next } : f
      ),
    }));
  }
  /** Liga/desliga "Ela envia o arquivo" (image) ou "Escolhe da galeria" (template). Um dos dois fica. */
  function setOrigemDaArte(lado: FieldSide, tipo: "image" | "template", ligar: boolean) {
    setConfig((prev) => {
      const doLado = prev.fields.filter((f) => isArtSourceType(f.type) && sideOf(f) === lado);
      const tem = doLado.some((f) => f.type === tipo);
      if (ligar === tem) return prev;
      if (!ligar) {
        if (doLado.every((f) => f.type === tipo)) return prev;
        return comIdsCanonicos({ ...prev, fields: prev.fields.filter((f) => !(f.type === tipo && sideOf(f) === lado)) });
      }
      const rotulo = doLado[0]?.label;
      const novo = {
        ...makeField(tipo, lado),
        required: artSourceRequired(prev.fields, lado),
        ...(rotulo ? { label: rotulo } : {}),
      } as CustomizationField;
      const arr = [...prev.fields];
      const ultimo = doLado.length ? arr.lastIndexOf(doLado[doLado.length - 1]) : arr.length - 1;
      arr.splice(ultimo + 1, 0, novo);
      return comIdsCanonicos({ ...prev, fields: arr });
    });
  }
  /** O rótulo da arte é um só para o lado: grava nos dois campos. */
  function setRotuloDaArte(lado: FieldSide, rotulo: string) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (isArtSourceType(f.type) && sideOf(f) === lado ? { ...f, label: rotulo } : f)),
    }));
  }
  function setLadoDaArte(de: FieldSide, para: FieldSide) {
    if (de === para) return;
    if (config.fields.some((f) => isArtSourceType(f.type) && sideOf(f) === para)) {
      toast.error(`A ${NOME_DO_LADO_MIN[para]} já tem uma arte. Mude por lá.`);
      return;
    }
    setConfig((prev) => comIdsCanonicos({
      ...prev,
      fields: prev.fields.map((f) => (isArtSourceType(f.type) && sideOf(f) === de ? ({ ...f, side: para } as any) : f)),
    }));
    setAbertos({ ["arte:" + para]: true });
  }

  // ── Limite de letras (Avançado): vale para todo texto ──
  function setLimiteLetras(n: number) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.type === "text" && !isArtBriefField(f)
          ? { ...f, config: { ...(f.config || {}), max_chars: n > 0 ? Math.round(n) : undefined } }
          : f
      ),
    }));
  }

  // ── Serviço de arte ────────────────────────────────────
  function toggleArtService(next: boolean) {
    setServicoParaLoja(false);
    setConfig((prev: any) => {
      if (!next) {
        const { art_service_use_store_default, ...rest } = prev;
        return { ...rest, fields: prev.fields.filter((f: any) => !isArtServiceField(f) && !isArtBriefField(f)) };
      }
      if (prev.fields.some((f: any) => isArtServiceField(f))) return prev;
      const loja = lojaPadrao;
      return {
        ...prev,
        ...(loja ? { art_service_use_store_default: true } : {}),
        fields: [...prev.fields, ...makeArtServiceFields(loja ? loja.adjust_price : 0, loja ? loja.design_price : 0)],
      };
    });
  }
  function patchArtPrices(adjust: number, design: number) {
    setConfig((prev) => comPrecosDoServico(prev, adjust, design));
  }
  function mudarServicoSoNeste() {
    if (!lojaPadrao) return;
    setConfig((prev) => comPrecosDoServico({ ...prev, art_service_use_store_default: false } as any, lojaPadrao.adjust_price, lojaPadrao.design_price));
  }
  function voltarAoPadraoDaLoja() {
    if (!lojaPadrao) return;
    setServicoParaLoja(false);
    setConfig((prev) => comPrecosDoServico({ ...prev, art_service_use_store_default: true } as any, lojaPadrao.adjust_price, lojaPadrao.design_price));
  }
  function mudarServicoDaLoja() {
    if (!lojaPadrao) return;
    setServicoParaLoja(true);
    setConfig((prev) => comPrecosDoServico(prev, lojaPadrao.adjust_price, lojaPadrao.design_price));
  }

  // ── Guia de medidas ────────────────────────────────────
  async function handleGuideFileSelect(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    if (!file) return;
    if (!GUIA_TIPOS_ACEITOS.includes(file.type)) {
      setGuideError("Aceitos: PNG, JPG, WEBP ou PDF");
      return;
    }
    if (file.size > GUIA_MAX_MB * 1024 * 1024) {
      setGuideError(`Arquivo grande demais (max ${GUIA_MAX_MB} MB)`);
      return;
    }
    setGuideUploading(true);
    setGuideError(null);
    try {
      const { url, content_type } = await uploadSizeGuide(companyId, file);
      setConfig((prev) => ({ ...prev, size_guide: { file_url: url, content_type } } as any));
      toast.success("Guia de medidas enviado! Salve para publicar.");
      try { if (guideInputRef.current) guideInputRef.current.value = ""; } catch (_) {}
    } catch (e: any) {
      console.error("[StudioPersonalizacao] guide upload error", {
        status: e?.status, code: e?.code, message: e?.message,
      });
      setGuideError(e?.data?.error || e?.message || "Erro no upload do guia");
    } finally {
      setGuideUploading(false);
    }
  }
  function removeGuide() {
    setConfig((prev) => ({ ...prev, size_guide: null } as any));
    setGuideError(null);
  }

  // ── Testar com a sua arte ──────────────────────────────
  function escolheuArteDeTeste(ev: any) {
    const file: File | undefined = ev?.target?.files?.[0];
    try { ev.target.value = ""; } catch { /* nada */ }
    if (!file) return;
    if (urlDoTeste.current) try { URL.revokeObjectURL(urlDoTeste.current); } catch { /* nada */ }
    const url = URL.createObjectURL(file);
    urlDoTeste.current = url;
    setArteTeste({ url, nome: file.name });
  }
  function tirarArteDeTeste() {
    if (urlDoTeste.current) try { URL.revokeObjectURL(urlDoTeste.current); } catch { /* nada */ }
    urlDoTeste.current = null;
    setArteTeste(null);
  }

  // ── Save ───────────────────────────────────────────────
  // `base` e `mensagem`: o "Salvar posição" da marcação na foto passa a
  // config com o lado novo e grava por AQUI — mesma normalização, mesmas
  // validações, um caminho só de escrita da coluna.
  async function save(base?: CustomizationConfig, mensagem?: string): Promise<boolean> {
    let alvo: any = base ?? config;

    // Serviço de arte × padrão da loja. Só com o padrão conhecido (a
    // busca das configurações pode ter falhado: aí o produto grava como está).
    let gravarNaLoja: PadraoDaLoja | null = null;
    if (lojaPadrao !== undefined && (alvo.fields || []).some((f: any) => isArtServiceField(f))) {
      const precos = precosDoServico(alvo.fields);
      if (!base && (servicoParaLoja || lojaPadrao === null)) {
        // "Mudar para toda a loja", ou a loja ainda sem padrão: estes
        // valores viram o padrão, e o produto passa a segui-lo.
        gravarNaLoja = { adjust_price: precos.ajuste, design_price: precos.criacao };
        alvo = { ...alvo, art_service_use_store_default: true };
      } else if (alvo.art_service_use_store_default === true && lojaPadrao) {
        // Segue a loja: as choices gravadas vêm do padrão, para vitrine e
        // preço lerem o mesmo número.
        alvo = comPrecosDoServico(alvo, lojaPadrao.adjust_price, lojaPadrao.design_price);
      }
    }

    // As dimensões dos lados extras: a normalização preencheria 10×10 em
    // silêncio, e para uma medida de impressão o silêncio é pior do que o erro.
    if (alvo.has_back) {
      const bp = alvo.back_print_area;
      if (!bp || !(bp.width_cm > 0) || !(bp.height_cm > 0)) {
        toast.error("Informe a largura e a altura do verso");
        return false;
      }
      if (alvo.back_charge_enabled) {
        const bpd = Number(alvo.back_price_delta);
        if (!Number.isFinite(bpd) || bpd <= 0) {
          toast.error("Informe quanto cobrar pelo verso (maior que zero)");
          return false;
        }
      }
    }
    if (alvo.has_middle) {
      const mp = alvo.middle_print_area;
      if (!mp || !(mp.width_cm > 0) || !(mp.height_cm > 0)) {
        toast.error("Informe a largura e a altura da volta inteira");
        return false;
      }
      if (alvo.middle_charge_enabled) {
        const mpd = Number(alvo.middle_price_delta);
        if (!Number.isFinite(mpd) || mpd <= 0) {
          toast.error("Informe quanto cobrar pela volta inteira (maior que zero)");
          return false;
        }
      }
    }

    // Tudo o que se grava passa por aqui: ids canônicos, config
    // completo por tipo, obrigatoriedade coerente.
    const cfg = normalizeCustomizationConfig(alvo);
    if (!cfg.fields.length) { toast.error("Adicione 1 campo"); return false; }
    setSaving(true);
    console.log("[StudioPersonalizacao] save start", {
      productId,
      fieldsCount: cfg.fields.length,
      hasBack: !!(cfg as any).has_back,
      backChargeEnabled: !!(cfg as any).back_charge_enabled,
      hasMiddle: !!(cfg as any).has_middle,
      middleChargeEnabled: !!(cfg as any).middle_charge_enabled,
      padraoDaLoja: !!gravarNaLoja,
    });
    try {
      if (gravarNaLoja) {
        // Antes do produto: o backend propaga o padrão a quem o segue.
        await studioApi.saveSettings(companyId, { art_service_defaults: gravarNaLoja });
        setLojaPadrao(gravarNaLoja);
        setServicoParaLoja(false);
      }
      await studioApi.saveCustomizationConfig(companyId, productId, cfg);
      console.log("[StudioPersonalizacao] save OK", { productId, fieldsCount: cfg.fields.length });
      // A tela passa a mostrar o que foi gravado, não o que estava
      // digitado: a normalização pode ter renomeado ids e preenchido config.
      setConfig(cfg);
      setSalvoJson(jsonEstavel(cfg));
      setProdutoNovo(false);
      toast.success(mensagem || (gravarNaLoja ? "Salvo, e o serviço de arte virou o padrão da loja" : "Configuração salva!"));
      onSaved?.(cfg);
      return true;
    } catch (e: any) {
      console.error("[StudioPersonalizacao] save error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro"}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Sugestões IA (dentro do cartão Arte, com a galeria ligada) ──
  async function fetchSuggestions(lado: FieldSide) {
    setSuggestSide(lado);
    setSuggestOpen(true);
    setSuggestLoading(true);
    setSuggestions([]);
    setSuggestChecked({});
    console.log("[StudioPersonalizacao] suggest start", { productId });
    try {
      const resp = await studioApi.suggestTemplates(companyId, productId);
      console.log("[StudioPersonalizacao] suggest OK", { count: (resp.suggestions || []).length, fallback: !!resp.fallback });
      setSuggestions(resp.suggestions || []);
      const checked: Record<string, boolean> = {};
      (resp.suggestions || []).forEach((sg) => { checked[sg.template_id] = true; });
      setSuggestChecked(checked);
      if (resp.fallback) {
        toast.success("Sugestões geradas (modo fallback)");
      }
    } catch (e: any) {
      console.error("[StudioPersonalizacao] suggest error", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro nas sugestões"}`);
      setSuggestOpen(false);
    } finally {
      setSuggestLoading(false);
    }
  }

  function applySuggestions() {
    const selected = suggestions.filter((sg) => suggestChecked[sg.template_id]);
    if (selected.length === 0) { toast.error("Selecione ao menos 1 template"); setSuggestOpen(false); return; }
    const lado = suggestSide;
    setConfig((prev) => {
      const existing = prev.fields.find((f) => f.type === "template" && sideOf(f) === lado);
      if (existing) {
        return {
          ...prev,
          fields: prev.fields.map((f) =>
            f.id === existing.id
              ? { ...f, config: { ...(f.config || {}), suggested_template_ids: selected.map((sg) => sg.template_id) } as any }
              : f
          ),
        };
      }
      const novo = makeField("template", lado);
      return comIdsCanonicos({
        ...prev,
        fields: [
          ...prev.fields,
          { ...novo, config: { ...novo.config, suggested_template_ids: selected.map((sg) => sg.template_id) } } as any,
        ],
      });
    });
    setSuggestOpen(false);
    toast.success(`${selected.length} sugestão(ões) aplicada(s)`);
  }

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={t.primary} size="large" />
        <Text style={s.loadingTxt}>Carregando personalização...</Text>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════
  // Prévia (uma só)
  // ════════════════════════════════════════════════════════
  const tamanhoDoPalco = isWide ? 330 : 180;
  const legenda = arteTeste
    ? "Sua arte de teste"
    : visualKey || temMockupNaFoto(config) ? "Arte de exemplo" : "Sem modelo: marque a área na foto";

  const previa = (
    <View style={[s.previa, !isWide && s.previaCel]} testID="ficha-previa">
      {ladosAtivos.length > 1 && !arteTeste ? (
        <View style={s.previaLados} accessibilityRole="tablist">
          {ladosAtivos.map((l) => {
            const ativo = previewSide === l;
            return (
              <Pressable
                key={l}
                onPress={() => setPreviewSide(l)}
                style={[s.chipPeq, compacta && { minHeight: 32 }, ativo && s.chipAtivo]}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`Ver ${l === "middle" ? "a volta inteira" : "o " + NOME_DO_LADO_MIN[l]} na prévia`}
                testID={"ficha-previa-lado-" + l}
              >
                <Text style={[s.chipTxt, ativo && s.chipTxtAtivo]}>{NOME_DO_LADO[l]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {arteTeste ? (
        <EditorDeTesteDaArte
          key={arteTeste.url}
          config={config}
          productId={productId}
          productName={productName}
          slug={slug}
          fotoProduto={(fotos || [])[0] || null}
          arquivoUrl={arteTeste.url}
          size={isWide ? 330 : Math.min(320, Math.max(220, vw - 72))}
        />
      ) : (
        <View style={[s.palco, !isWide && { height: compacta ? 84 : 190 }]}>
          <View style={compacta ? { transform: [{ scale: 84 / 190 }] } : null}>
            <EnginePreview
              key={`${visualEpoch}-${visualKey || "none"}-${previewSide}`}
              config={config}
              values={previewValues}
              size={tamanhoDoPalco}
              productName={productName}
              showLabel={false}
              companyId={companyId}
              productId={productId}
              side={previewSide}
            />
          </View>
          {!compacta ? (
            <>
              <View style={[s.pilula, { left: 10 }]}>
                <Text style={s.pilulaTxt}>{legenda}</Text>
              </View>
              {eh3D || previewSide === "middle" ? (
                <View style={[s.pilula, { right: 10 }]}>
                  <Text style={s.pilulaTxt}>{previewSide === "middle" ? "↻ a arte dá a volta" : "↻ gira na loja"}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {arteTeste ? (
        <View style={s.linhaTeste} testID="ficha-teste-ativo">
          <Text style={s.linhaTesteTxt} numberOfLines={1}>
            Testando com <Text style={{ color: t.ink, fontWeight: "700" }}>{arteTeste.nome}</Text> · não é salvo
          </Text>
          <Pressable onPress={tirarArteDeTeste} style={s.btnLink} accessibilityRole="button" accessibilityLabel="Tirar a arte de teste">
            <Text style={s.btnLinkTxt}>Tirar</Text>
          </Pressable>
        </View>
      ) : null}

      {!compacta && !arteTeste && ehWeb && campoDoTeste ? (
        <Pressable
          onPress={() => { try { arteInputRef.current?.click(); } catch { /* nada */ } }}
          style={s.btnContorno}
          accessibilityRole="button"
          accessibilityLabel="Testar com a sua arte"
          testID="ficha-testar-arte"
        >
          <Glifo nome="enviar" cor={t.primary} tamanho={15} />
          <Text style={s.btnContornoTxt}>Testar com a sua arte</Text>
        </Pressable>
      ) : null}
      {ehWeb ? (
        // @ts-ignore — input nativo do navegador, escondido
        <input ref={arteInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={escolheuArteDeTeste} style={{ display: "none" }} data-testid="arquivo-de-teste" />
      ) : null}

      {!compacta ? (
        <View style={s.previaLinks}>
          {slug ? (
            <Pressable
              onPress={() => {
                if (!ehWeb) return;
                try { window.open(studioStorefrontUrl(slug), "_blank"); } catch (e) {
                  console.error("[StudioPersonalizacao] window.open failed", e);
                }
              }}
              style={s.btnLink}
              accessibilityRole="link"
              accessibilityLabel="Ver na loja"
            >
              <Text style={s.btnLinkTxt}>Ver na loja ↗</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setShowWaPreview(true)} style={s.btnLink} accessibilityRole="button" accessibilityLabel="Enviar no WhatsApp">
            <Text style={s.btnLinkTxt}>Enviar no WhatsApp</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  // ════════════════════════════════════════════════════════
  // Formulário
  // ════════════════════════════════════════════════════════
  const botaoMarcarNaFoto = (
    <Pressable
      onPress={() => setMockupFotoAberto(true)}
      style={s.btn}
      accessibilityRole="button"
      accessibilityLabel="Marcar a área na foto"
      testID="ficha-marcar-na-foto"
    >
      <Text style={s.btnTxt}>Marcar a área na foto</Text>
    </Pressable>
  );

  // ── Bloco 1 · Como a peça aparece na loja ─────────────
  const specAtual = modeloAtual ? (specsDosModelos[modeloAtual.key] ?? modeloAtual.spec) : null;
  const nomeDoModelo = visualKey ? (modeloAtual?.name || visualKey) : "Usar a foto do produto";
  const metaDoAtual = visualKey
    ? (modeloAtual ? metaDoModelo(modeloAtual, specAtual) : "Fora da lista de modelos publicados")
    : temMockupNaFoto(config) ? "Área marcada na foto" : "Você marca na foto onde a arte cai";

  const bloco1 = (
    <Bloco s={s} t={t} num="1" glifo="peca" titulo="Como a peça aparece na loja" testID="ficha-bloco-aparencia">
      <Pressable
        onPress={() => setSeletorAberto(true)}
        disabled={savingVisual}
        style={s.seletor}
        accessibilityRole="button"
        accessibilityLabel={"Modelo da peça: " + nomeDoModelo + ". Trocar"}
        testID="ficha-seletor-modelo"
      >
        <View style={s.seletorThumb}>
          <MiniaturaDoModelo template={modeloAtual} spec={specAtual} foto={visualKey ? null : (fotos || [])[0] || null} largura={60} altura={48} T={t} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.seletorNome} numberOfLines={1}>{nomeDoModelo}</Text>
          <View style={s.seletorMetaLinha}>
            {modeloAtual ? <Selo s={s} t={t} tipo={eh3D ? "3d" : "2d"} texto={eh3D ? "3D" : "2D"} /> : null}
            <Text style={s.seletorMeta} numberOfLines={1}>{metaDoAtual}</Text>
          </View>
        </View>
        {savingVisual ? <ActivityIndicator color={t.primary} size="small" /> : <Glifo nome="seta" cor={t.ink3} tamanho={18} />}
      </Pressable>
      {!visualKey ? (
        <View style={s.linhaQuebra}>
          {botaoMarcarNaFoto}
          <Text style={s.ajuda}>A arte cai na foto da peça, na luz da foto. Só vale sem um modelo escolhido.</Text>
        </View>
      ) : null}
    </Bloco>
  );

  // ── Bloco 2 · Onde imprime ─────────────────────────────
  const ligarLado = (lado: FieldSide) => {
    if (lado === "back") toggleHasBack(!hasBack);
    else if (lado === "middle") toggleHasMiddle(!hasMiddle);
  };
  const bloco2 = (
    <Bloco s={s} t={t} num="2" glifo="grade" titulo="Onde imprime" testID="ficha-bloco-lados">
      <View style={s.chips} accessibilityRole="none" accessibilityLabel="Lados que recebem impressão">
        {(["front", "back", "middle"] as FieldSide[]).map((l) => {
          const ligado = l === "front" || (l === "back" ? hasBack : hasMiddle);
          return (
            <ChipCaixa
              key={l}
              s={s}
              t={t}
              marcado={ligado}
              desabilitado={l === "front"}
              onPress={() => ligarLado(l)}
              rotulo={NOME_DO_LADO[l]}
              sub={l === "front" ? "sempre" : undefined}
              acessivel={l === "front" ? "Imprime na frente, sempre" : `Imprime ${l === "back" ? "no verso" : "na volta inteira"}`}
              testID={"ficha-chip-lado-" + l}
            />
          );
        })}
      </View>
      <View style={{ gap: 8 }}>
        {ladosAtivos.map((l) => {
          const area = areaDoLado(l);
          return (
            <View key={l} style={[s.lado, isWide && s.ladoLargo]} testID={"ficha-lado-" + l}>
              <View style={isWide ? { width: 112 } : null}>
                <Text style={s.ladoNome}>{NOME_DO_LADO[l]}</Text>
                {l === "middle" ? <Text style={s.ladoSub}>a arte dá a volta na peça</Text> : null}
              </View>
              <View style={s.medidas}>
                <EntradaDecimal
                  s={s} t={t}
                  valor={area.width_cm}
                  onMudar={(n) => patchAreaDoLado(l, { width_cm: n })}
                  estilo={s.entradaNum}
                  rotulo={`Largura ${l === "middle" ? "da volta inteira" : "do " + NOME_DO_LADO_MIN[l]} em cm`}
                  placeholder="10"
                  testID={"ficha-largura-" + l}
                />
                <Text style={s.x}>×</Text>
                <EntradaDecimal
                  s={s} t={t}
                  valor={area.height_cm}
                  onMudar={(n) => patchAreaDoLado(l, { height_cm: n })}
                  estilo={s.entradaNum}
                  rotulo={`Altura ${l === "middle" ? "da volta inteira" : "do " + NOME_DO_LADO_MIN[l]} em cm`}
                  placeholder="10"
                  testID={"ficha-altura-" + l}
                />
                <Text style={s.un}>cm</Text>
                {l !== "front" ? (
                  <View style={[s.aMais, isWide && { marginLeft: 8 }]}>
                    <Text style={s.un}>a mais</Text>
                    <View style={s.moeda}>
                      <Text style={s.moedaPrefixo}>R$</Text>
                      <EntradaDecimal
                        s={s} t={t}
                        moeda
                        valor={cobrancaDoLado(l)}
                        onMudar={(n) => setCobranca(l, n)}
                        estilo={s.entradaMoeda}
                        rotulo={`Quanto cobrar a mais ${l === "back" ? "pelo verso" : "pela volta inteira"}`}
                        placeholder="0,00"
                        testID={"ficha-amais-" + l}
                      />
                    </View>
                    <Text style={s.un}>vazio = sem cobrança</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      {/* QA 26/09: lado ligado sem campo não aparece na loja. */}
      {ladoSemCampo(config as any, "back") ? (
        <Aviso s={s} t={t} testID="verso-sem-campo" texto={AVISO_LADO_SEM_CAMPO.back} />
      ) : null}
      {ladoSemCampo(config as any, "middle") ? (
        <Aviso s={s} t={t} testID="meio-sem-campo" texto={AVISO_LADO_SEM_CAMPO.middle} />
      ) : null}
    </Bloco>
  );

  // ── Bloco 3 · O que a cliente escolhe ──────────────────
  const resumoDoItem = (item: ItemDaLista): string => {
    const partes: string[] = [];
    const lado = (item.tipo === "arte" ? item.lado : sideOf(item.campo)) as FieldSide;
    if (ladosAtivos.length > 1) partes.push(NOME_DO_LADO[lado]);
    if (item.tipo === "arte") {
      const arquivo = item.campos.some((f) => f.type === "image");
      const galeria = item.campos.some((f) => f.type === "template");
      partes.push(artSourceRequired(item.campos, lado) ? "Obrigatório" : "Opcional");
      partes.push(arquivo && galeria ? "arquivo ou galeria" : galeria ? "galeria da loja" : "envia o arquivo");
      return partes.join(" · ");
    }
    const f = item.campo;
    partes.push(f.required ? "Obrigatório" : "Opcional");
    if (f.type === "text") partes.push(`até ${Number(f.config?.max_chars) || TEXT_MAX_CHARS_PADRAO} letras`);
    if (f.type === "color") {
      const n = ((f.config?.colors as string[] | undefined) || []).length;
      const comPreco = ((f.config?.choices as any[] | undefined) || []).some((c) => (c.price_delta || 0) > 0);
      partes.push(`${n} ${n === 1 ? "cor" : "cores"}${comPreco ? " · preço por cor" : ""}`);
    }
    if (f.type === "option") {
      const ops = ((f.config?.choices as Array<{ label: string }> | undefined) || []).map((c) => c.label);
      if (ops.length) partes.push(ops.join(", "));
    }
    return partes.join(" · ");
  };

  const escolhaDeLado = (atual: FieldSide, onEscolher: (l: FieldSide) => void, testID: string) =>
    ladosAtivos.length > 1 ? (
      <View style={{ gap: 6 }}>
        <Text style={s.rotulo}>Em que lado</Text>
        <View style={s.chips} accessibilityRole="radiogroup">
          {ladosAtivos.map((l) => {
            const sel = atual === l;
            return (
              <Pressable
                key={l}
                onPress={() => onEscolher(l)}
                style={[s.chipPeq, sel && s.chipAtivo]}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={`Campo ${l === "middle" ? "na volta inteira" : l === "back" ? "no verso" : "na frente"}`}
                testID={testID + "-" + l}
              >
                <Text style={[s.chipTxt, sel && s.chipTxtAtivo]}>{NOME_DO_LADO[l]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ) : null;

  const renderItem = (item: ItemDaLista, i: number) => {
    const aberto = !!abertos[item.chave];
    const alternar = () => setAbertos((a) => ({ ...a, [item.chave]: !a[item.chave] }));
    const acoes = (
      <View style={s.acoesCampo}>
        <BotaoIcone s={s} t={t} glifo="cima" rotulo="Mover para cima" desabilitado={i === 0} onPress={() => moverItem(item.chave, -1)} />
        <BotaoIcone s={s} t={t} glifo="seta" rotulo="Mover para baixo" desabilitado={i === itens.length - 1} onPress={() => moverItem(item.chave, 1)} />
        <BotaoIcone s={s} t={t} glifo="lixo" rotulo="Tirar este campo" perigo onPress={() => tirarItem(item)} />
      </View>
    );

    if (item.tipo === "arte") {
      const lado = item.lado;
      const temArquivo = item.campos.some((f) => f.type === "image");
      const temGaleria = item.campos.some((f) => f.type === "template");
      const obrig = artSourceRequired(item.campos, lado);
      const rotuloAtual = (item.campos.find((f) => f.type === "image") || item.campos[0])?.label || "";
      return (
        <View key={item.chave} style={s.campo} testID={"ficha-campo-arte-" + lado}>
          <CabecalhoDoCampo
            s={s} t={t} glifo="arte" acento
            titulo="Arte da cliente"
            resumo={resumoDoItem(item)}
            aberto={aberto}
            onPress={alternar}
            testID={"ficha-campo-arte-" + lado + "-cab"}
          />
          {aberto ? (
            <View style={s.campoCorpo}>
              <View style={[s.duas, !isWide && s.duasCel]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rotulo}>Como aparece para a cliente</Text>
                  <TextInput
                    value={rotuloAtual}
                    onChangeText={(txt) => setRotuloDaArte(lado, txt)}
                    style={s.entrada}
                    placeholder="Sua arte"
                    placeholderTextColor={t.ink4}
                    accessibilityLabel="Como a arte aparece para a cliente"
                  />
                </View>
                <Caixa s={s} t={t} marcado={obrig} onPress={() => setArtSourceRequired(lado, !obrig)} rotulo="Obrigatório" testID={"ficha-arte-obrigatoria-" + lado} />
              </View>
              {escolhaDeLado(lado, (l) => setLadoDaArte(lado, l), "ficha-arte-lado-" + lado)}
              <View style={{ gap: 6 }}>
                <Text style={s.rotulo}>De onde vem a arte</Text>
                <View style={s.chips}>
                  <ChipCaixa
                    s={s} t={t}
                    marcado={temArquivo}
                    onPress={() => setOrigemDaArte(lado, "image", !temArquivo)}
                    rotulo="Ela envia o arquivo"
                    testID={"ficha-arte-arquivo-" + lado}
                  />
                  <ChipCaixa
                    s={s} t={t}
                    marcado={temGaleria}
                    onPress={() => setOrigemDaArte(lado, "template", !temGaleria)}
                    rotulo="Escolhe da galeria da loja"
                    testID={"ficha-arte-galeria-" + lado}
                  />
                </View>
                {temGaleria ? (
                  <View style={s.linhaQuebra}>
                    <Text style={s.un}>
                      Galeria:{" "}
                      <Text style={{ fontWeight: "800", color: t.ink2 }}>
                        {templateCount > 0
                          ? `${templateCount} ${templateCount === 1 ? "template escolhido" : "templates escolhidos"} para este produto`
                          : "todos os templates da loja"}
                      </Text>
                    </Text>
                    <Pressable onPress={() => setGaleriaAberta(true)} style={s.btnLink} accessibilityRole="button" testID="ficha-escolher-da-galeria">
                      <Text style={s.btnLinkTxt}>{templateCount > 0 ? "Mudar a escolha" : "Escolher só alguns"}</Text>
                    </Pressable>
                    <Pressable onPress={() => fetchSuggestions(lado)} style={s.btnLink} accessibilityRole="button" testID="ficha-sugerir-ia">
                      <Text style={s.btnLinkTxt}>Sugerir com IA</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Text style={s.ajuda}>
                  Se marcar os dois, vale qualquer um: arquivo ou galeria. Quem contrata a criação da arte fica dispensado.
                </Text>
              </View>
              {acoes}
            </View>
          ) : null}
        </View>
      );
    }

    const f = item.campo;
    const lado = sideOf(f) as FieldSide;
    const glifo = f.type === "text" ? "texto" : f.type === "color" ? "cor" : "opcao";
    return (
      <View key={item.chave} style={s.campo} testID={"ficha-campo-" + f.id}>
        <CabecalhoDoCampo
          s={s} t={t} glifo={glifo}
          titulo={f.label || "Sem nome"}
          resumo={resumoDoItem(item)}
          aberto={aberto}
          onPress={alternar}
          testID={"ficha-campo-" + f.id + "-cab"}
        />
        {aberto ? (
          <View style={s.campoCorpo}>
            <View style={[s.duas, !isWide && s.duasCel]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rotulo}>Como aparece para a cliente</Text>
                <TextInput
                  value={f.label}
                  onChangeText={(txt) => patchField(f.id, { label: txt })}
                  style={s.entrada}
                  placeholder="Rótulo do campo"
                  placeholderTextColor={t.ink4}
                  accessibilityLabel="Como o campo aparece para a cliente"
                />
              </View>
              <Caixa s={s} t={t} marcado={!!f.required} onPress={() => patchField(f.id, { required: !f.required })} rotulo="Obrigatório" testID={"ficha-obrigatorio-" + f.id} />
            </View>
            {escolhaDeLado(lado, (l) => setFieldSide(f.id, l), "ficha-lado-do-campo-" + f.id)}
            {f.type === "color" ? (
              <ColorPaletteEditor t={t} s={s} config={f.config} onPatchConfig={(p) => patchFieldConfig(f.id, p)} />
            ) : null}
            {f.type === "option" ? (
              <OptionChoicesEditor
                t={t} s={s}
                choices={(f.config?.choices as Choice[] | undefined) || []}
                onChange={(choices) => patchFieldConfig(f.id, { choices })}
              />
            ) : null}
            {acoes}
          </View>
        ) : null}
      </View>
    );
  };

  const bloco3 = (
    <Bloco
      s={s} t={t} num="3" glifo="escolhe" titulo="O que a cliente escolhe" testID="ficha-bloco-campos"
      direita={
        <Pressable
          onPress={() => setAddMenuOpen(true)}
          style={[s.btn, s.btnPeq]}
          accessibilityRole="button"
          accessibilityLabel="Adicionar o que a cliente escolhe"
          testID="ficha-adicionar"
        >
          <Glifo nome="mais" cor={t.ink2} tamanho={14} traco={2.6} />
          {isWide ? <Text style={s.btnTxt}>Adicionar</Text> : null}
        </Pressable>
      }
    >
      {itens.length === 0 ? (
        <Text style={s.ajuda}>Nada ainda. Adicione o que a cliente escolhe: a arte, um nome, a cor.</Text>
      ) : (
        <View style={{ gap: 8 }}>{itens.map(renderItem)}</View>
      )}
    </Bloco>
  );

  // ── Bloco 4 · Serviço de arte ──────────────────────────
  const modoServico: "resumo" | "precos" =
    lojaPadrao && segueLoja && !servicoParaLoja ? "resumo" : "precos";
  const bloco4 = (
    <Bloco
      s={s} t={t} num="4" glifo="pincel" titulo="Serviço de arte" testID="ficha-bloco-servico"
      direita={
        <Interruptor
          s={s} t={t}
          ligado={artEnabled}
          onMudar={toggleArtService}
          rotulo="Oferecer ajuste ou criação da arte"
          cor={t.accent}
          testID="ficha-servico-interruptor"
        />
      }
    >
      {artEnabled ? (
        <>
          {modoServico === "resumo" && lojaPadrao ? (
            <View style={s.linhaQuebra} testID="ficha-servico-resumo">
              <Text style={s.resumoServicoTxt}>
                Ajustar a arte da cliente <Text style={s.valor}>{reais(lojaPadrao.adjust_price)}</Text>
              </Text>
              <Text style={s.x}>·</Text>
              <Text style={s.resumoServicoTxt}>
                Criar do zero <Text style={s.valor}>{reais(lojaPadrao.design_price)}</Text>
              </Text>
              <View style={[s.tag, { backgroundColor: t.successSoft }]} testID="ficha-servico-padrao-da-loja">
                <Text style={[s.tagTxt, { color: t.successInk }]}>padrão da loja</Text>
              </View>
              <Pressable onPress={mudarServicoSoNeste} style={s.btnLink} accessibilityRole="button" testID="ficha-servico-mudar-produto">
                <Text style={s.btnLinkTxt}>Mudar só neste produto</Text>
              </Pressable>
              <Pressable onPress={mudarServicoDaLoja} style={s.btnLink} accessibilityRole="button" testID="ficha-servico-mudar-loja">
                <Text style={s.btnLinkTxt}>Mudar para toda a loja</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 8 }} testID="ficha-servico-precos">
              <View style={[s.duas, !isWide && s.duasCel]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rotulo}>Ajustar a arte (R$)</Text>
                  <EntradaDecimal
                    s={s} t={t} moeda
                    valor={artAdjustPrice}
                    onMudar={(n) => patchArtPrices(n, artDesignPrice)}
                    estilo={s.entrada}
                    rotulo="Preço para ajustar a arte da cliente"
                    placeholder="0,00"
                    testID="ficha-servico-ajuste"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rotulo}>Criar do zero (R$)</Text>
                  <EntradaDecimal
                    s={s} t={t} moeda
                    valor={artDesignPrice}
                    onMudar={(n) => patchArtPrices(artAdjustPrice, n)}
                    estilo={s.entrada}
                    rotulo="Preço para criar a arte do zero"
                    placeholder="0,00"
                    testID="ficha-servico-criacao"
                  />
                </View>
              </View>
              {servicoParaLoja ? (
                <View style={s.linhaQuebra}>
                  <Text style={s.ajuda}>Vale para todos os produtos que seguem o padrão da loja.</Text>
                  <Pressable onPress={voltarAoPadraoDaLoja} style={s.btnLink} accessibilityRole="button" accessibilityLabel="Desistir de mudar o padrão da loja">
                    <Text style={s.btnLinkTxt}>Desistir</Text>
                  </Pressable>
                </View>
              ) : lojaPadrao ? (
                <Pressable onPress={voltarAoPadraoDaLoja} style={[s.btnLink, { alignSelf: "flex-start" }]} accessibilityRole="button" testID="ficha-servico-voltar-padrao">
                  <Text style={s.btnLinkTxt}>Voltar ao padrão da loja</Text>
                </Pressable>
              ) : lojaPadrao === null ? (
                <Text style={s.ajuda} testID="ficha-servico-vira-padrao">Estes valores viram o padrão da loja.</Text>
              ) : null}
            </View>
          )}
          <Text style={s.ajuda}>Preço 0 mantém o caminho visível e sem custo. O briefing da cliente vai junto no pedido.</Text>
        </>
      ) : (
        <Text style={s.ajuda}>Desligado: a cliente envia a arte pronta.</Text>
      )}
    </Bloco>
  );

  // ── Avançado ───────────────────────────────────────────
  const tecnica = cfgAny.tecnica as any;
  const todasCentro = ladosAtivos.every((l) => areaDoLado(l).position === "center");
  const resumoAvancado = [
    "Técnica " + (tecnica ? rotuloDaTecnica(tecnica).toLowerCase() : "automática"),
    todasCentro ? "área centralizada" : "área posicionada",
    textosNormais.length ? `textos até ${limiteLetras} letras` : null,
    sizeGuide ? "com guia de medidas" : "sem guia de medidas",
  ].filter(Boolean).join(" · ");

  const avancado = (
    <View style={s.avancado} testID="ficha-avancado">
      <Pressable
        onPress={() => setAvancadoAberto((v) => !v)}
        style={s.avancadoCab}
        accessibilityRole="button"
        accessibilityState={{ expanded: avancadoAberto }}
        accessibilityLabel="Avançado"
        testID="ficha-avancado-cab"
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.campoTitulo}>Avançado</Text>
          <Text style={s.campoResumo} numberOfLines={2}>{resumoAvancado}</Text>
        </View>
        <View style={[s.seta, avancadoAberto && { transform: [{ rotate: "180deg" }] }]}>
          <Glifo nome="seta" cor={t.ink3} tamanho={18} />
        </View>
      </Pressable>
      {avancadoAberto ? (
        <View style={s.avancadoCorpo}>
          <View style={{ gap: 6 }}>
            <Text style={s.rotulo}>Técnica de impressão</Text>
            <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Técnica de impressão">
              {[{ v: null as any, rotulo: "Automática" }, ...TECNICAS.map((x) => ({ v: x.v as any, rotulo: x.rotulo }))].map((x) => {
                const sel = (tecnica || null) === x.v;
                return (
                  <Pressable
                    key={x.rotulo}
                    onPress={() => setConfig((prev) => ({ ...prev, tecnica: x.v }))}
                    style={[s.chipPeq, sel && s.chipAtivo]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    testID={"tecnica-" + (x.v || "automatica")}
                  >
                    <Text style={[s.chipTxt, sel && s.chipTxtAtivo]}>{x.rotulo}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.ajuda}>{explicacaoDaTecnica(tecnica)}</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={s.rotulo}>Posição da área na peça</Text>
            {ladosAtivos.map((l) => {
              const pos = areaDoLado(l).position;
              return (
                <View key={l} style={s.linhaQuebra}>
                  <Text style={[s.un, { minWidth: 96, fontWeight: "700", color: t.ink2 }]}>{NOME_DO_LADO[l]}</Text>
                  <View style={s.chips} accessibilityRole="radiogroup">
                    {POSITIONS.map((p) => {
                      const sel = pos === p.value;
                      return (
                        <Pressable
                          key={p.value}
                          onPress={() => patchAreaDoLado(l, { position: p.value })}
                          style={[s.chipPeq, sel && s.chipAtivo]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: sel }}
                          accessibilityLabel={`${p.label}, ${NOME_DO_LADO_MIN[l]}`}
                        >
                          <Text style={[s.chipTxt, sel && s.chipTxtAtivo]}>{p.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {textosNormais.length ? (
            <View style={{ gap: 6 }}>
              <Text style={s.rotulo}>Limite de letras nos textos</Text>
              <View style={s.linhaQuebra}>
                <EntradaDecimal
                  s={s} t={t}
                  inteiro
                  valor={limiteLetras}
                  onMudar={setLimiteLetras}
                  estilo={s.entradaNum}
                  rotulo="Limite de letras por campo de texto"
                  placeholder={String(TEXT_MAX_CHARS_PADRAO)}
                  testID="ficha-limite-letras"
                />
                <Text style={s.un}>letras por campo de texto</Text>
              </View>
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text style={s.rotulo}>Guia de medidas</Text>
            {sizeGuide ? (
              <View style={s.guidePreview}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <Icon name={sizeGuide.content_type === "application/pdf" ? "file_text" : "image"} size={16} color={t.primary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.guideFileName} numberOfLines={1}>
                      {sizeGuide.content_type === "application/pdf" ? "Guia PDF enviado" : "Imagem do guia enviada"}
                    </Text>
                    <Text style={s.guideFileType}>{sizeGuide.content_type}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {ehWeb ? (
                    <Pressable
                      onPress={() => {
                        try { window.open(sizeGuide.file_url, "_blank"); } catch (e) {
                          console.error("[StudioPersonalizacao] window.open failed", e);
                        }
                      }}
                      style={[s.btn, s.btnPeq]}
                      accessibilityRole="button"
                      accessibilityLabel="Abrir o guia de medidas"
                    >
                      <Text style={s.btnTxt}>Abrir</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={removeGuide} style={[s.btn, s.btnPeq, { borderColor: t.dangerSoft, backgroundColor: t.dangerSoft }]} accessibilityRole="button" accessibilityLabel="Remover o guia de medidas">
                    <Text style={[s.btnTxt, { color: t.danger }]}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            ) : ehWeb ? (
              // @ts-ignore — label/input nativos no web
              <label
                style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  padding: 14,
                  border: "2px dashed " + t.ink5,
                  borderRadius: 10,
                  cursor: guideUploading ? "wait" : "pointer",
                  opacity: guideUploading ? 0.6 : 1,
                } as any}
              >
                <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "700" }}>
                  {guideUploading ? "Enviando..." : "Escolher arquivo"}
                </Text>
                <Text style={{ fontSize: 12.5, color: t.ink3, textAlign: "center" }}>
                  PNG, JPG, WEBP ou PDF, até {GUIA_MAX_MB} MB. A cliente vê "Ver guia de medidas" na loja.
                </Text>
                {/* @ts-ignore */}
                <input
                  ref={guideInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleGuideFileSelect}
                  disabled={guideUploading}
                  style={{ display: "none" } as any}
                />
              </label>
            ) : (
              <Text style={s.ajuda}>Upload de guia de medidas disponível somente na versão web do Studio.</Text>
            )}
            {guideError ? <Text style={{ fontSize: 12, color: t.danger }}>{guideError}</Text> : null}
          </View>

          {visualKey ? (
            <View style={{ gap: 6 }}>
              <Text style={s.rotulo}>Mockup na foto</Text>
              <View style={s.linhaQuebra}>
                {botaoMarcarNaFoto}
                <Text style={s.ajuda}>Usado só se você tirar o modelo.</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  // ── Rodapé: status + Salvar ────────────────────────────
  const partesDoStatus = ladosAtivos.map((l) => {
    const n = itens.filter((it) => (it.tipo === "arte" ? it.lado : sideOf(it.campo)) === l).length;
    return `${NOME_DO_LADO[l]}: ${n} ${n === 1 ? "campo" : "campos"}`;
  });
  const temCampos = config.fields.length > 0;
  const salvarDesligado = saving || !naoSalvo || !temCampos;
  const rodape = (
    <View style={[s.rodape, ehWeb && (isWide ? s.rodapeFixo : s.rodapeFixoCel)]} testID="ficha-rodape">
      <View style={s.status}>
        <View style={[s.statusPonto, { backgroundColor: naoSalvo ? t.warning : t.success }]} />
        <Text style={s.statusTxt} numberOfLines={2} testID="ficha-status">
          {(naoSalvo ? "Não salvo" : "Salvo") + " · " + partesDoStatus.join(" · ")}
        </Text>
      </View>
      <Pressable
        onPress={() => { save(); }}
        disabled={salvarDesligado}
        style={[s.btnPrim, salvarDesligado && { opacity: 0.45 }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: salvarDesligado }}
        accessibilityLabel="Salvar"
        testID="ficha-salvar"
      >
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Glifo nome="ok" cor="#fff" tamanho={15} traco={2.6} />}
        <Text style={s.btnPrimTxt}>{saving ? "Salvando..." : "Salvar"}</Text>
      </Pressable>
    </View>
  );

  // ── O formulário inteiro ───────────────────────────────
  const formulario = (
    <View style={s.form}>
      <View style={s.interruptorCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.interruptorTitulo}>Este produto aceita personalização</Text>
          <Text style={s.ajuda}>
            {isPersonalizable
              ? "A cliente envia a arte e escolhe o que vai na peça."
              : "Desligado: a peça é vendida como está, sem campos na loja."}
          </Text>
        </View>
        <Interruptor
          s={s} t={t}
          ligado={isPersonalizable}
          onMudar={(v) => togglePersonalizable(v)}
          desabilitado={togglePending}
          rotulo="Este produto aceita personalização"
          cor={t.primary}
          testID="ficha-interruptor"
        />
      </View>

      {isPersonalizable ? (
        <>
          {produtoNovo ? (
            <Aviso
              s={s} t={t}
              testID="ficha-aviso-novo"
              texto="Deixamos o mais comum pronto: frente, arte da cliente e nome na peça. Confira e salve, ou ajuste o que for diferente."
            />
          ) : null}
          {bloco1}
          {bloco2}
          {bloco3}
          {bloco4}
          {avancado}
          {rodape}
        </>
      ) : null}
    </View>
  );

  // ════════════════════════════════════════════════════════
  // Layout
  // ════════════════════════════════════════════════════════
  let corpo: React.ReactNode;
  if (ehWeb) {
    // Web: a rolagem é da página. Prévia e rodapé são sticky.
    corpo = isWide ? (
      <View style={s.split}>
        {isPersonalizable ? <View style={s.colPrevia}>{previa}</View> : null}
        <View style={s.colForm}>{formulario}</View>
      </View>
    ) : (
      <View style={{ gap: 10 }}>
        {isPersonalizable ? (
          <View ref={previaFixaRef} style={arteTeste ? null : s.previaFixaCel}>{previa}</View>
        ) : null}
        {formulario}
      </View>
    );
  } else {
    // Nativo: sem sticky de CSS; a prévia é cabeçalho fixo do ScrollView.
    corpo = (
      <ScrollView
        stickyHeaderIndices={isPersonalizable && !isWide ? [0] : undefined}
        onScroll={(e) => {
          if (isWide) return;
          const y = e.nativeEvent.contentOffset.y;
          setCompacta((atual) => (atual ? y > 20 : y > 60));
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 32, gap: 10 }}
      >
        {isPersonalizable ? <View style={{ backgroundColor: t.paperCard }}>{previa}</View> : null}
        {formulario}
      </ScrollView>
    );
  }

  const folha = !isWide;

  return (
    <View style={s.container} ref={raizRef}>
      {corpo}

      {/* Seletor de modelo */}
      {seletorAberto ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSeletorAberto(false)}>
          <View style={[s.fundoModal, folha && s.fundoFolha]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSeletorAberto(false)} accessibilityLabel="Fechar a lista de modelos" />
            <View style={[s.caixaModal, folha && s.caixaFolha]} testID="ficha-lista-modelos">
              <CabecalhoDoModal s={s} t={t} titulo="Como a peça aparece na loja" onFechar={() => setSeletorAberto(false)} rotuloFechar="Fechar a lista de modelos" />
              <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 8 }}>
                {([
                  ["Modelos 3D", visualTemplates.filter((v) => v.kind === "model3d")],
                  ["Fotos de estúdio (2D)", visualTemplates.filter((v) => v.kind !== "model3d")],
                ] as Array<[string, VisualTemplate[]]>).map(([titulo, lista]) => lista.length ? (
                  <View key={titulo}>
                    <Text style={s.grupoModal}>{titulo}</Text>
                    {lista.map((vt) => (
                      <OpcaoDoModelo
                        key={vt.key}
                        s={s} t={t}
                        selecionado={visualKey === vt.key}
                        nome={vt.name}
                        meta={metaDoModelo(vt, specsDosModelos[vt.key] ?? vt.spec)}
                        tipo={vt.kind === "model3d" ? "3d" : "2d"}
                        miniatura={<MiniaturaDoModelo template={vt} spec={specsDosModelos[vt.key] ?? vt.spec} largura={52} altura={42} T={t} />}
                        onPress={() => { setSeletorAberto(false); selectVisualTemplate(vt.key); }}
                        testID={"ficha-modelo-" + vt.key}
                      />
                    ))}
                  </View>
                ) : null)}
                <Text style={s.grupoModal}>Sem modelo</Text>
                <OpcaoDoModelo
                  s={s} t={t}
                  selecionado={visualKey === null}
                  nome="Usar a foto do produto"
                  meta="Você marca na foto onde a arte cai"
                  miniatura={<MiniaturaDoModelo template={null} foto={(fotos || [])[0] || null} largura={52} altura={42} T={t} />}
                  onPress={() => { setSeletorAberto(false); selectVisualTemplate(null); }}
                  testID="ficha-modelo-nenhum"
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Menu "+ Adicionar" */}
      {addMenuOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
          <View style={[s.fundoModal, folha && s.fundoFolha]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddMenuOpen(false)} accessibilityLabel="Fechar o menu" />
            <View style={[s.caixaModal, { maxWidth: 360 }, folha && s.caixaFolha]} testID="ficha-menu-adicionar">
              <Text style={[s.grupoModal, { paddingTop: 14, paddingHorizontal: 18 }]}>O que adicionar</Text>
              <View style={{ padding: 8, paddingTop: 0 }}>
                {MENU_ADICIONAR.map((m) => (
                  <Pressable
                    key={m.tipo}
                    onPress={() => adicionar(m.tipo)}
                    style={s.opcaoMenu}
                    accessibilityRole="menuitem"
                    accessibilityLabel={m.titulo}
                    testID={"ficha-adicionar-" + m.tipo}
                  >
                    <View style={s.icCampo}><Glifo nome={m.glifo} cor={t.primary} tamanho={15} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.opcaoNome}>{m.titulo}</Text>
                      <Text style={s.opcaoMeta}>{m.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Marcar a área na foto (o editor de sempre, em modal) */}
      {mockupFotoAberto ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMockupFotoAberto(false)}>
          <View style={[s.fundoModal, folha && s.fundoCheio]}>
            <View style={[s.caixaModal, s.caixaGrande, folha && s.caixaCheia]} testID="ficha-modal-marcar-na-foto">
              <CabecalhoDoModal s={s} t={t} titulo="Marcar a área na foto" onFechar={() => setMockupFotoAberto(false)} rotuloFechar="Fechar a marcação na foto" />
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16 }}>
                <MockupNaFotoSecao
                  config={config}
                  fotos={fotos || []}
                  temModeloVinculado={!!visualKey}
                  slug={slug}
                  productId={productId}
                  salvando={saving}
                  onSalvar={(cfg) => save(cfg, "Posição salva")}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Sugestões IA */}
      {suggestOpen ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSuggestOpen(false)}>
          <View style={[s.fundoModal, folha && s.fundoFolha]}>
            <View style={[s.caixaModal, { maxWidth: 480, padding: 16, gap: 8 }, folha && s.caixaFolha]} testID="ficha-sugestoes">
              <Text style={s.tituloModal} numberOfLines={1}>Sugestões IA de templates</Text>
              {suggestLoading ? (
                <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color={t.primary} />
                  <Text style={s.ajuda}>Analisando produto...</Text>
                </View>
              ) : suggestions.length === 0 ? (
                <Text style={s.ajuda}>Nenhuma sugestão disponível.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {suggestions.map((sg) => {
                    const checked = !!suggestChecked[sg.template_id];
                    return (
                      <Pressable
                        key={sg.template_id}
                        onPress={() => setSuggestChecked((prev) => ({ ...prev, [sg.template_id]: !checked }))}
                        style={[s.suggestRow, checked && s.suggestRowActive]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <View style={[s.checkbox, checked && s.checkboxOn]}>
                          {checked ? <Glifo nome="ok" cor="#fff" tamanho={12} traco={3} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.opcaoNome}>{sg.template_id}</Text>
                          <Text style={s.opcaoMeta}>{sg.reason}</Text>
                        </View>
                        <Text style={s.score}>{Math.round((sg.score || 0) * 100)}%</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              <View style={s.modalActions}>
                <Pressable onPress={() => setSuggestOpen(false)} style={s.btn} accessibilityRole="button" accessibilityLabel="Fechar as sugestões">
                  <Text style={s.btnTxt}>Fechar</Text>
                </Pressable>
                <Pressable
                  onPress={applySuggestions}
                  disabled={suggestLoading || suggestions.length === 0}
                  style={[s.btnPrim, (suggestLoading || suggestions.length === 0) && { opacity: 0.5 }]}
                  accessibilityRole="button"
                >
                  <Text style={s.btnPrimTxt}>Aplicar selecionadas</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Escolher da galeria (a antiga aba Templates) */}
      <EscolherDaGaleriaModal
        visible={galeriaAberta}
        onClose={() => setGaleriaAberta(false)}
        productId={productId}
        companyId={companyId}
        productName={productName}
        onChanged={onTemplateCountChanged}
      />

      {/* Enviar no WhatsApp */}
      <PreviewWhatsAppModal
        visible={showWaPreview}
        onClose={() => setShowWaPreview(false)}
        product={{ id: productId, name: productName, price: productPrice }}
        shop={{ name: "Aura Studio", slug: slug || "loja" }}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Peças pequenas
// ────────────────────────────────────────────────────────────
type S = ReturnType<typeof buildStyles>;

function Bloco({
  s, t, num, glifo, titulo, direita, children, testID,
}: {
  s: S; t: StudioPalette; num: string; glifo: keyof typeof GLIFOS; titulo: string;
  direita?: React.ReactNode; children: React.ReactNode; testID?: string;
}) {
  return (
    <View style={s.cartao} testID={testID}>
      <View style={s.cartaoCab}>
        <Text style={s.num}>{num}</Text>
        <View style={s.ic}><Glifo nome={glifo} cor={t.primary} tamanho={15} /></View>
        <Text style={s.cartaoTitulo} accessibilityRole="header">{titulo}</Text>
        {direita ? <View style={{ marginLeft: "auto" as any }}>{direita}</View> : null}
      </View>
      <View style={s.cartaoCorpo}>{children}</View>
    </View>
  );
}

function Aviso({ s, t, texto, testID }: { s: S; t: StudioPalette; texto: string; testID?: string }) {
  return (
    <View style={s.aviso} accessibilityRole="alert" testID={testID}>
      <Glifo nome="alerta" cor={t.warningInk} tamanho={14} traco={2.4} />
      <Text style={s.avisoTxt}>{texto}</Text>
    </View>
  );
}

function Selo({ s, t, tipo, texto }: { s: S; t: StudioPalette; tipo: "3d" | "2d"; texto: string }) {
  return (
    <View style={[s.tag, { backgroundColor: tipo === "3d" ? t.accentSoft : t.primarySoft }]}>
      <Text style={[s.tagTxt, { color: tipo === "3d" ? t.accentInk : t.primary }]}>{texto}</Text>
    </View>
  );
}

function Interruptor({
  s, t, ligado, onMudar, rotulo, cor, desabilitado, testID,
}: {
  s: S; t: StudioPalette; ligado: boolean; onMudar: (v: boolean) => void; rotulo: string;
  cor: string; desabilitado?: boolean; testID?: string;
}) {
  return (
    <Pressable
      onPress={() => onMudar(!ligado)}
      disabled={desabilitado}
      style={[s.interruptor, desabilitado && { opacity: 0.5 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado, disabled: !!desabilitado }}
      accessibilityLabel={rotulo}
      testID={testID}
    >
      <View style={[s.trilho, { backgroundColor: ligado ? cor : t.ink5 }]}>
        <View style={[s.bolinha, ligado && { transform: [{ translateX: 20 }] }]} />
      </View>
    </Pressable>
  );
}

/** Chip-caixa de 44 px: marca + rótulo. Checkbox (lados, origem da arte). */
function ChipCaixa({
  s, t, marcado, onPress, rotulo, sub, desabilitado, acessivel, testID,
}: {
  s: S; t: StudioPalette; marcado: boolean; onPress: () => void; rotulo: string; sub?: string;
  desabilitado?: boolean; acessivel?: string; testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={[s.chip, marcado && s.chipAtivo]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado, disabled: !!desabilitado }}
      accessibilityLabel={acessivel || rotulo}
      testID={testID}
    >
      <View style={[s.marca, marcado && { backgroundColor: t.primary, borderColor: t.primary }]}>
        {marcado ? <Glifo nome="ok" cor="#fff" tamanho={11} traco={3.2} /> : null}
      </View>
      <Text style={[s.chipTxt, marcado && s.chipTxtAtivo]}>
        {rotulo}
        {sub ? <Text style={s.chipSub}>{" (" + sub + ")"}</Text> : null}
      </Text>
    </Pressable>
  );
}

function Caixa({
  s, t, marcado, onPress, rotulo, testID,
}: { s: S; t: StudioPalette; marcado: boolean; onPress: () => void; rotulo: string; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={s.caixa}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      accessibilityLabel={rotulo}
      testID={testID}
    >
      <View style={[s.checkbox, marcado && s.checkboxOn]}>
        {marcado ? <Glifo nome="ok" cor="#fff" tamanho={12} traco={3} /> : null}
      </View>
      <Text style={s.caixaTxt}>{rotulo}</Text>
    </Pressable>
  );
}

function BotaoIcone({
  s, t, glifo, rotulo, onPress, desabilitado, perigo,
}: {
  s: S; t: StudioPalette; glifo: keyof typeof GLIFOS; rotulo: string; onPress: () => void;
  desabilitado?: boolean; perigo?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      style={[s.ibtn, desabilitado && { opacity: 0.35 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desabilitado }}
      accessibilityLabel={rotulo}
    >
      <Glifo nome={glifo} cor={perigo ? t.danger : t.ink2} tamanho={16} traco={2.4} />
    </Pressable>
  );
}

function CabecalhoDoCampo({
  s, t, glifo, acento, titulo, resumo, aberto, onPress, testID,
}: {
  s: S; t: StudioPalette; glifo: keyof typeof GLIFOS; acento?: boolean; titulo: string; resumo: string;
  aberto: boolean; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={s.campoCab}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      accessibilityLabel={`${titulo}. ${resumo}`}
      testID={testID}
    >
      <View style={s.icCampo}><Glifo nome={glifo} cor={acento ? t.accentInk : t.primary} tamanho={15} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.campoTitulo} numberOfLines={1}>{titulo}</Text>
        <Text style={s.campoResumo} numberOfLines={1}>{resumo}</Text>
      </View>
      <View style={[s.seta, aberto && { transform: [{ rotate: "180deg" }] }]}>
        <Glifo nome="seta" cor={t.ink3} tamanho={18} traco={2.4} />
      </View>
    </Pressable>
  );
}

function CabecalhoDoModal({
  s, t, titulo, onFechar, rotuloFechar,
}: { s: S; t: StudioPalette; titulo: string; onFechar: () => void; rotuloFechar: string }) {
  return (
    <View style={s.cabModal}>
      <Text style={[s.tituloModal, { flex: 1 }]} accessibilityRole="header">{titulo}</Text>
      <Pressable onPress={onFechar} style={s.ibtn} accessibilityRole="button" accessibilityLabel={rotuloFechar}>
        <Glifo nome="fechar" cor={t.ink2} tamanho={18} />
      </Pressable>
    </View>
  );
}

function OpcaoDoModelo({
  s, t, selecionado, nome, meta, tipo, miniatura, onPress, testID,
}: {
  s: S; t: StudioPalette; selecionado: boolean; nome: string; meta: string; tipo?: "3d" | "2d";
  miniatura: React.ReactNode; onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.opcaoModelo, selecionado && { backgroundColor: t.primarySoft }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionado }}
      accessibilityLabel={nome}
      testID={testID}
    >
      <View style={s.opcaoThumb}>{miniatura}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.opcaoNome} numberOfLines={1}>{nome}</Text>
        <View style={s.seletorMetaLinha}>
          {tipo ? <Selo s={s} t={t} tipo={tipo} texto={tipo === "3d" ? "3D" : "2D"} /> : null}
          <Text style={s.opcaoMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
      {selecionado ? <Glifo nome="ok" cor={t.primary} tamanho={16} traco={2.6} /> : null}
    </Pressable>
  );
}

/**
 * Número com vírgula, sem brigar com a digitação: guarda o texto digitado
 * ("8," continua "8,") e só o reescreve quando o valor muda por fora.
 */
function EntradaDecimal({
  s, t, valor, onMudar, estilo, rotulo, placeholder, testID, moeda, inteiro,
}: {
  s: S; t: StudioPalette; valor: number | null | undefined; onMudar: (n: number) => void;
  estilo: any; rotulo: string; placeholder?: string; testID?: string; moeda?: boolean; inteiro?: boolean;
}) {
  const formatar = (v: number | null | undefined) =>
    v ? (moeda ? v.toFixed(2).replace(".", ",") : String(v).replace(".", ",")) : "";
  const ler = (txt: string) => (inteiro ? (parseInt(txt, 10) || 0) : parseArtPrice(txt));
  const [txt, setTxt] = useState(() => formatar(valor));
  useEffect(() => {
    if ((ler(txt) || 0) !== (Number(valor) || 0)) setTxt(formatar(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <TextInput
      value={txt}
      onChangeText={(v) => { setTxt(v); onMudar(ler(v)); }}
      keyboardType={inteiro ? "number-pad" : "decimal-pad"}
      style={estilo}
      placeholder={placeholder}
      placeholderTextColor={t.ink4}
      accessibilityLabel={rotulo}
      testID={testID}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Editores visuais de paleta e opções (19/08/2026)
//
// O price_delta continua existindo — um input de R$ por linha — e a
// forma gravada é idêntica: `colors` (o que a vitrine desenha) +
// `choices` (de onde sai o price_delta, casado pelo hex/value).
// ────────────────────────────────────────────────────────────
type Choice = { label: string; value: string; price_delta?: number };

// ── ColorPaletteEditor — swatches + preço por cor ────────────
function ColorPaletteEditor({
  t, s, config, onPatchConfig,
}: {
  t: StudioPalette;
  s: S;
  config: any;
  onPatchConfig: (p: Record<string, any>) => void;
}) {
  const [customHex, setCustomHex] = useState("#");
  const colors: string[] = (config?.colors as string[] | undefined) || [];
  const choices: Choice[] = (config?.choices as Choice[] | undefined) || [];
  const normalized = colors.map((c) => c.toUpperCase());

  function commit(nextColors: string[], nextChoices: Choice[]) {
    // choices só carrega quem tem preço — mesma forma de textoParaCor
    onPatchConfig({
      colors: nextColors,
      choices: nextChoices.filter((c) => (c.price_delta || 0) > 0),
    });
  }
  function addColor(hex: string) {
    const up = hex.toUpperCase();
    if (!isValidHex(up) || normalized.includes(up)) return;
    commit([...colors, up], choices);
  }
  function removeColor(hex: string) {
    commit(
      colors.filter((c) => c.toUpperCase() !== hex.toUpperCase()),
      choices.filter((c) => c.value.toUpperCase() !== hex.toUpperCase()),
    );
  }
  function setColorPrice(hex: string, raw: string) {
    const delta = parseArtPrice(raw);
    const rest = choices.filter((c) => c.value !== hex);
    commit(colors, delta > 0 ? [...rest, { label: hex, value: hex, price_delta: delta }] : rest);
  }
  function priceOf(hex: string): string {
    const d = choices.find((c) => c.value === hex)?.price_delta;
    return d ? String(d) : "";
  }
  function submitCustom() {
    const v = customHex.trim().toUpperCase();
    if (!isValidHex(v)) { toast.error("Cor inválida — use o formato #RRGGBB"); return; }
    addColor(v);
    setCustomHex("#");
  }

  const availablePresets = COLOR_PRESETS.filter((p) => !normalized.includes(p));

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.rotulo}>Cores · preço a mais por cor</Text>
      {colors.length === 0 ? (
        <Text style={s.ajuda}>Nenhuma cor. Adicione abaixo.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {colors.map((c) => (
            <View key={c} style={s.colorRow}>
              <View style={[s.swatch, { backgroundColor: c }]} />
              <Text style={s.colorHex}>{c.toUpperCase()}</Text>
              <View style={s.colorPriceWrap}>
                <Text style={s.colorPricePrefix}>+R$</Text>
                <TextInput
                  value={priceOf(c)}
                  onChangeText={(txt) => setColorPrice(c, txt)}
                  keyboardType="decimal-pad"
                  style={s.colorPriceInput}
                  placeholder="0"
                  placeholderTextColor={t.ink4}
                  accessibilityLabel={"A mais pela cor " + c.toUpperCase()}
                />
              </View>
              <BotaoIcone s={s} t={t} glifo="lixo" rotulo={"Tirar a cor " + c.toUpperCase()} perigo onPress={() => removeColor(c)} />
            </View>
          ))}
        </View>
      )}

      <View style={s.swatchRow}>
        {availablePresets.map((p) => (
          <Pressable key={p} onPress={() => addColor(p)} style={s.swatchBtn} accessibilityRole="button" accessibilityLabel={"Adicionar a cor " + p}>
            <View style={[s.swatch, { width: 24, height: 24, backgroundColor: p }]} />
          </Pressable>
        ))}
        {Platform.OS === "web" ? (
          // Color picker nativo do browser — 1 clique pra cor exata
          // @ts-ignore — input DOM no web
          <input
            type="color"
            value={isValidHex(customHex) ? customHex : "#888888"}
            onChange={(e: any) => setCustomHex(String(e.target.value || "").toUpperCase())}
            style={{
              width: 44, height: 44, padding: 0, border: `1.5px dashed ${t.ink4}`,
              borderRadius: 10, background: "transparent", cursor: "pointer",
            } as any}
            title="Escolher cor exata"
            aria-label="Escolher uma cor exata"
          />
        ) : (
          <TextInput
            value={customHex}
            onChangeText={setCustomHex}
            style={[s.entrada, { width: 110 }]}
            placeholder="#RRGGBB"
            placeholderTextColor={t.ink4}
            autoCapitalize="characters"
          />
        )}
        <Pressable
          onPress={submitCustom}
          style={[s.btn, s.btnPeq, !isValidHex(customHex) && { opacity: 0.5 }]}
          disabled={!isValidHex(customHex)}
          accessibilityRole="button"
          accessibilityLabel="Adicionar a cor escolhida"
        >
          <Text style={s.btnTxt}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── OptionChoicesEditor — linhas com preço + adicionar por rótulo ──
function OptionChoicesEditor({
  t, s, choices, onChange,
}: {
  t: StudioPalette;
  s: S;
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addChoice() {
    const label = draft.trim();
    if (!label) return;
    if (choices.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Essa opção já existe");
      return;
    }
    let value = slugifyOption(label) || `op-${choices.length + 1}`;
    if (choices.some((c) => c.value === value)) {
      let i = 2;
      while (choices.some((c) => c.value === `${value}-${i}`)) i++;
      value = `${value}-${i}`;
    }
    onChange([...choices, { label, value }]);
    setDraft("");
  }
  function removeChoice(value: string) {
    onChange(choices.filter((c) => c.value !== value));
  }
  function setPrice(value: string, raw: string) {
    const delta = parseArtPrice(raw);
    onChange(choices.map((c) => {
      if (c.value !== value) return c;
      const { price_delta, ...rest } = c;
      return delta > 0 ? { ...rest, price_delta: delta } : rest;
    }));
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.rotulo}>Opções · preço a mais</Text>
      {choices.length === 0 ? (
        <Text style={s.ajuda}>Nenhuma opção. Adicione abaixo (ex: P, M, G).</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {choices.map((c) => (
            <View key={c.value} style={s.colorRow}>
              <Text style={[s.colorHex, { flex: 1 }]} numberOfLines={1}>{c.label}</Text>
              <View style={s.colorPriceWrap}>
                <Text style={s.colorPricePrefix}>+R$</Text>
                <TextInput
                  value={c.price_delta ? String(c.price_delta) : ""}
                  onChangeText={(txt) => setPrice(c.value, txt)}
                  keyboardType="decimal-pad"
                  style={s.colorPriceInput}
                  placeholder="0"
                  placeholderTextColor={t.ink4}
                  accessibilityLabel={"A mais pela opção " + c.label}
                />
              </View>
              <BotaoIcone s={s} t={t} glifo="lixo" rotulo={"Tirar a opção " + c.label} perigo onPress={() => removeChoice(c.value)} />
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addChoice}
          style={[s.entrada, { flex: 1, minWidth: 140 }]}
          placeholder="Nova opção, ex.: Caixa de presente"
          placeholderTextColor={t.ink4}
          returnKeyType="done"
          blurOnSubmit={false}
          accessibilityLabel="Nova opção"
        />
        <Pressable
          onPress={addChoice}
          style={[s.btn, s.btnPeq, !draft.trim() && { opacity: 0.5 }]}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Adicionar a opção"
        >
          <Text style={s.btnTxt}>Adicionar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    container: { padding: 16, backgroundColor: t.paperCard, flex: 1 },

    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
    loadingTxt: { fontSize: 13, color: t.ink3, fontWeight: "600" },

    // Layout
    split: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
    colPrevia: { width: 380, position: "sticky" as any, top: 12, alignSelf: "flex-start" as any, zIndex: 2 },
    colForm: { flex: 1, minWidth: 0 },
    form: { gap: 12 },
    previaFixaCel: { position: "sticky" as any, top: 0, zIndex: 6 },

    // Prévia
    previa: {
      backgroundColor: t.paperCardElev,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 12,
      gap: 10,
    },
    previaCel: { padding: 8, gap: 8, boxShadow: "0 8px 24px -6px rgba(30,58,138,0.18)" as any },
    previaLados: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    palco: {
      borderRadius: 12,
      backgroundColor: t.bgSoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      minHeight: 84,
      paddingVertical: 6,
    },
    pilula: {
      position: "absolute",
      pointerEvents: "none" as any,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.paperCardElev,
      opacity: 0.9,
    },
    pilulaTxt: { fontSize: 11, color: t.ink3 },
    linhaTeste: { flexDirection: "row", alignItems: "center", gap: 8 },
    linhaTesteTxt: { flex: 1, fontSize: 12, color: t.ink3 },
    previaLinks: { flexDirection: "row", gap: 4, flexWrap: "wrap" },

    // Cartões de bloco
    cartao: {
      backgroundColor: t.paperCardElev,
      borderColor: t.ink5,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    cartaoCab: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
    num: { fontSize: 11, fontWeight: "800", color: t.accentInk, letterSpacing: 0.6 },
    ic: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: t.primaryGhost, borderWidth: 1, borderColor: t.ink5,
      alignItems: "center", justifyContent: "center",
    },
    cartaoTitulo: { fontSize: 14, fontWeight: "800", color: t.ink, letterSpacing: -0.1, flexShrink: 1 },
    cartaoCorpo: { marginTop: 12, gap: 12 },
    ajuda: { fontSize: 12.5, color: t.ink3, flexShrink: 1 },

    // Interruptor
    interruptorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: t.paperCardElev,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    interruptorTitulo: { fontSize: 14, fontWeight: "800", color: t.ink },
    interruptor: { minWidth: 52, minHeight: 44, alignItems: "center", justifyContent: "center" },
    trilho: { width: 48, height: 28, borderRadius: 999, padding: 3 },
    bolinha: {
      width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.35)" as any,
    },

    // Formulário
    rotulo: { fontSize: 11, fontWeight: "800", color: t.ink3, letterSpacing: 0.5, textTransform: "uppercase" },
    entrada: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.bgSoft,
      color: t.ink,
      fontSize: 14,
    },
    entradaNum: {
      width: 72,
      minHeight: 44,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      color: t.ink,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center" as any,
    },
    entradaMoeda: {
      width: 96,
      minHeight: 44,
      paddingLeft: 34,
      paddingRight: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      color: t.ink,
      fontSize: 14,
      fontWeight: "700",
    },
    moeda: { position: "relative", justifyContent: "center" },
    moedaPrefixo: { position: "absolute", left: 12, zIndex: 1, fontSize: 12.5, fontWeight: "700", color: t.ink3 },
    linhaQuebra: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    x: { color: t.ink4, fontWeight: "700" },
    un: { color: t.ink3, fontSize: 12.5 },
    valor: { fontWeight: "800", color: t.ink },
    duas: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
    duasCel: { flexDirection: "column", alignItems: "stretch" },

    // Chips
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    chipPeq: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      alignItems: "center",
      justifyContent: "center",
    },
    chipAtivo: { borderColor: t.primary, backgroundColor: t.primarySoft },
    chipTxt: { fontSize: 13.5, color: t.ink2, fontWeight: "700" },
    chipTxtAtivo: { color: t.primary },
    chipSub: { fontWeight: "500", color: t.ink3, fontSize: 11.5 },
    marca: {
      width: 18, height: 18, borderRadius: 5,
      borderWidth: 1.5, borderColor: t.ink4,
      alignItems: "center", justifyContent: "center",
    },

    // Onde imprime
    lado: {
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    ladoLargo: { flexDirection: "row", alignItems: "center", gap: 12 },
    ladoNome: { fontSize: 13.5, fontWeight: "800", color: t.ink },
    ladoSub: { fontSize: 11.5, color: t.ink3 },
    medidas: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 },
    aMais: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

    aviso: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: t.warningSoft,
    },
    avisoTxt: { flex: 1, fontSize: 12.5, lineHeight: 17, color: t.warningInk },

    // Seletor de modelo
    seletor: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.bgSoft,
    },
    seletorThumb: { width: 60, height: 48, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    seletorNome: { fontSize: 14, fontWeight: "800", color: t.ink },
    seletorMetaLinha: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    seletorMeta: { fontSize: 12, color: t.ink3, flexShrink: 1 },
    tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    tagTxt: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },

    // Cartões de campo
    campo: { borderWidth: 1, borderColor: t.ink5, borderRadius: 12, backgroundColor: t.bgSoft },
    campoCab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 52,
      paddingVertical: 4,
      paddingLeft: 12,
      paddingRight: 4,
      borderRadius: 12,
    },
    icCampo: {
      width: 30, height: 30, borderRadius: 9,
      backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5,
      alignItems: "center", justifyContent: "center",
    },
    campoTitulo: { fontSize: 14, fontWeight: "800", color: t.ink },
    campoResumo: { fontSize: 12, color: t.ink3 },
    seta: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    campoCorpo: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      borderStyle: "dashed" as any,
    },
    acoesCampo: {
      flexDirection: "row",
      gap: 6,
      justifyContent: "flex-end",
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      borderStyle: "dashed" as any,
      paddingTop: 8,
    },
    ibtn: {
      width: 44, height: 44, borderRadius: 10,
      borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCardElev,
      alignItems: "center", justifyContent: "center",
    },
    caixa: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44 },
    caixaTxt: { fontSize: 13.5, fontWeight: "600", color: t.ink },
    checkbox: {
      width: 20, height: 20, borderRadius: 5,
      borderWidth: 1.5, borderColor: t.ink4,
      alignItems: "center", justifyContent: "center",
    },
    checkboxOn: { backgroundColor: t.primary, borderColor: t.primary },

    // Serviço de arte
    resumoServicoTxt: { fontSize: 13.5, color: t.ink2 },

    // Avançado
    avancado: { borderWidth: 1, borderStyle: "dashed" as any, borderColor: t.ink5, borderRadius: 14 },
    avancadoCab: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
    avancadoCorpo: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, gap: 16 },
    guidePreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.bgSoft,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    guideFileName: { fontSize: 13, fontWeight: "700", color: t.ink },
    guideFileType: { fontSize: 10.5, color: t.ink4, marginTop: 1 },

    // Rodapé
    rodape: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: t.paperCardElev,
      borderWidth: 1,
      borderColor: t.ink5,
      boxShadow: "0 8px 24px -6px rgba(30,58,138,0.18)" as any,
    },
    rodapeFixo: { position: "sticky" as any, bottom: 0, zIndex: 5 },
    rodapeFixoCel: { position: "sticky" as any, bottom: 12, zIndex: 7 },
    status: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
    statusPonto: { width: 8, height: 8, borderRadius: 4 },
    statusTxt: { flex: 1, fontSize: 12.5, color: t.ink2 },

    // Botões
    btn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnPeq: { paddingHorizontal: 12, borderRadius: 9 },
    btnTxt: { fontSize: 13.5, fontWeight: "700", color: t.ink2 },
    btnPrim: {
      minHeight: 44,
      minWidth: 140,
      paddingHorizontal: 16,
      borderRadius: 11,
      backgroundColor: t.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnPrimTxt: { fontSize: 13.5, fontWeight: "800", color: "#fff" },
    btnContorno: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnContornoTxt: { fontSize: 13.5, fontWeight: "700", color: t.primary },
    btnLink: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
    btnLinkTxt: { fontSize: 12.5, fontWeight: "700", color: t.primary },

    // Paleta e opções
    swatchRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" },
    swatchBtn: {
      width: 44, height: 44, borderRadius: 10,
      borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCardElev,
      alignItems: "center", justifyContent: "center",
    },
    swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
    colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    colorHex: { fontSize: 13, fontWeight: "700", color: t.ink, minWidth: 76 },
    colorPriceWrap: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" as any },
    colorPricePrefix: { fontSize: 12, fontWeight: "700", color: t.ink3 },
    colorPriceInput: {
      width: 72,
      minHeight: 44,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCardElev,
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
      textAlign: "right" as any,
    },

    // Modais
    fundoModal: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    // Etapa 4 (05/10): folha de baixo sem margem que aperte, cantos só em cima e área segura.
    fundoFolha: { justifyContent: "flex-end", alignItems: "stretch", padding: 0 },
    fundoCheio: { padding: 0, alignItems: "stretch", justifyContent: "flex-start" },
    caixaModal: {
      width: "100%",
      maxWidth: 440,
      backgroundColor: t.paperCardElev,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.ink5,
      overflow: "hidden",
    },
    caixaFolha: {
      maxWidth: undefined, maxHeight: "92%" as any,
      borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
      borderBottomWidth: 0, ...(respiroInferior(8) as any),
    },
    caixaGrande: { maxWidth: 980, maxHeight: "92%" as any },
    caixaCheia: { maxWidth: undefined, maxHeight: undefined, flex: 1, borderRadius: 0, borderWidth: 0 },
    cabModal: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingLeft: 16,
      paddingRight: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
    },
    tituloModal: { fontSize: 15, fontWeight: "800", color: t.ink },
    grupoModal: {
      fontSize: 11, fontWeight: "800", color: t.ink3, letterSpacing: 0.5, textTransform: "uppercase",
      paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4,
    },
    opcaoModelo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 56,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    opcaoThumb: { width: 52, height: 42, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    opcaoMenu: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 52,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    opcaoNome: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    opcaoMeta: { fontSize: 12, color: t.ink3, flexShrink: 1 },

    suggestRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: t.bgSoft,
      marginVertical: 4,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    suggestRowActive: { borderColor: t.primary, backgroundColor: t.primaryGhost },
    score: { fontSize: 12, fontWeight: "800", color: t.primary },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  });
}

export default StudioPersonalizacaoPanel;
