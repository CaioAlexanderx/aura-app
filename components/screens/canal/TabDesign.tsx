// ============================================================
// AURA. — Canal Digital · Aba Design (v2)
// Editor lado-a-lado com preview iframe live
// • Identidade visual, tipografia, card style, dark mode
// • Announcement bar
// • Banners (até 3) com tone/tint/imagem
// • Service cards (até 4) com ícone/título/corpo
// ============================================================
import { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator,
  TextInput, Platform,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  IS_WIDE, COLOR_PRESETS, PALETTE_PRESETS, ACCENT_PRESETS,
  FONT_OPTIONS, CARD_STYLES, BANNER_TONES, BANNER_TINTS,
  SERVICE_ICONS, ServiceIconPreview,
  Field, ChipToggle, ToggleRow, SectionTitle, cs,
} from "./shared";

type BannerTone = "split" | "editorial" | "centered" | "image-clean";

type Banner = {
  kicker?: string; headline?: string; body?: string; cta?: string;
  tone?: BannerTone;
  tint?: "brand" | "accent";
  image_url?: string | null; enabled?: boolean;
};

type ServiceCard = {
  icon?: string;
  title?: string;
  body?: string;
  enabled?: boolean;
};

type Cfg = {
  primary_color?: string; accent_color?: string;
  dark_mode?: boolean; font_family?: string; card_style?: string;
  announcement_bar?: string;
  banners?: Banner[];
  service_cards?: ServiceCard[];
  is_published?: boolean; slug?: string; storefront_url?: string;
};

const BACKEND_BASE = (
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1"
).replace(/\/api\/v1\/?$/, "");

function previewUrlFor(slug?: string | null) {
  if (!slug) return null;
  return `${BACKEND_BASE}/api/v1/storefront/${encodeURIComponent(slug)}/page`;
}

const DEFAULT_BANNERS: Banner[] = [
  { kicker: "", headline: "Bem-vindo à nossa loja", body: "", cta: "Ver produtos", tone: "split",     tint: "brand",  image_url: null, enabled: true },
  { kicker: "", headline: "", body: "", cta: "", tone: "editorial", tint: "accent", image_url: null, enabled: false },
  { kicker: "", headline: "", body: "", cta: "", tone: "centered",  tint: "brand",  image_url: null, enabled: false },
];

// Rec #5 — service cards comecam vazios (opt-in via biblioteca de templates).
const DEFAULT_SERVICE_CARDS: ServiceCard[] = [];

// Templates oferecidos no empty state — 1 clique adiciona em service_cards[].
const SERVICE_CARD_TEMPLATES: { icon: string; title: string; body: string }[] = [
  { icon: "truck",  title: "Entrega rápida",        body: "Retirada ou delivery rápido" },
  { icon: "shield", title: "Pagamento seguro",      body: "Pix com confirmação" },
  { icon: "pkg",    title: "Frete grátis",          body: "Acima de um valor mínimo" },
  { icon: "heart",  title: "Atendimento WhatsApp",  body: "Resposta no mesmo dia" },
];

// Helper text dinamico por tone do banner (Rec #10).
const BANNER_TONE_HELPERS: Record<BannerTone, { title: string; body: string }> = {
  split: {
    title: "Dividido:",
    body: "texto à esquerda + arte/imagem à direita. Use headlines de 1 linha (até ~40 caracteres).",
  },
  editorial: {
    title: "Editorial:",
    body: "a headline vira uma palavra-arte gigante no fundo. Use só 1-2 palavras curtas (ex: 'Verão', 'Nova coleção').",
  },
  centered: {
    title: "Centralizado:",
    body: "todo o texto centralizado no banner. Bom pra anúncios curtos com CTA.",
  },
  "image-clean": {
    title: "Imagem + legenda:",
    body: "a imagem ocupa o quadro inteiro. Headline, descrição e botão aparecem em faixa branca logo abaixo. Recomendado quando sua imagem já tem texto/marca embutidos.",
  },
};

// Tones validos no normalize — image-clean entrou na Fase 2.
const VALID_TONES: BannerTone[] = ["split", "editorial", "centered", "image-clean"];

function normalizeBanners(input: any): Banner[] {
  if (!Array.isArray(input)) return DEFAULT_BANNERS;
  const arr: Banner[] = input.slice(0, 3).map((b: any) => {
    const rawTone = VALID_TONES.includes(b?.tone) ? (b.tone as BannerTone) : "split";
    const imageUrl = b?.image_url || null;
    // Auto-corrige legado: banner com imagem mas tone antigo (split/editorial/centered)
    // O backend ja renderiza como image-clean nesse caso — frontend espelha localmente.
    const tone: BannerTone = imageUrl ? "image-clean" : (rawTone === "image-clean" ? "split" : rawTone);
    return {
      kicker: b?.kicker || "", headline: b?.headline || "",
      body: b?.body || "", cta: b?.cta || "",
      tone,
      tint: ["brand", "accent"].includes(b?.tint) ? b.tint : "brand",
      image_url: imageUrl,
      enabled: b?.enabled !== false,
    };
  });
  while (arr.length < 3) arr.push({ ...DEFAULT_BANNERS[arr.length], enabled: false });
  return arr;
}

function normalizeServiceCards(input: any): ServiceCard[] {
  // Rec #5 — array vazio e' valido (empty state). Nao injetamos defaults.
  if (!Array.isArray(input)) return DEFAULT_SERVICE_CARDS;
  return input.slice(0, 4).map((c: any) => ({
    icon: c?.icon || "sparkle",
    title: c?.title || "",
    body:  c?.body  || "",
    enabled: c?.enabled !== false,
  }));
}

// ============================================================
// BannerLayoutPicker — grid 2x2 (mobile) ou 1x4 (desktop) com
// thumbnails CSS-puros (View posicionado, sem SVG/imagem). O 4o
// layout "image-clean" so e' selecionavel quando banner.image_url
// existe; os 3 originais ficam disabled nesse caso.
// ============================================================
function BannerLayoutThumb({ tone }: { tone: BannerTone }) {
  // Container interno do thumb — 70x40 aproximado
  if (tone === "image-clean") {
    return (
      <View style={thumb.frame}>
        {/* Top 70% — simula imagem */}
        <View style={[thumb.imageBlock, { backgroundColor: Colors.bg4 }]}>
          <View style={thumb.imageInner} />
        </View>
        {/* Bottom 30% — faixa branca com headline + cta */}
        <View style={thumb.captionBand}>
          <View style={thumb.captionLine} />
          <View style={thumb.captionDot} />
        </View>
      </View>
    );
  }
  if (tone === "split") {
    return (
      <View style={thumb.frame}>
        {/* Esquerda 60% — 2 linhas de texto */}
        <View style={thumb.splitLeft}>
          <View style={[thumb.textLine, { width: "80%" }]} />
          <View style={[thumb.textLine, { width: "55%", marginTop: 4 }]} />
        </View>
        {/* Direita 40% — circulo arte */}
        <View style={thumb.splitRight}>
          <View style={thumb.splitCircle} />
        </View>
      </View>
    );
  }
  if (tone === "editorial") {
    return (
      <View style={thumb.frame}>
        {/* Letra A gigante */}
        <Text style={thumb.editorialLetter}>A</Text>
        {/* Retangulo pequeno no canto direito-inferior */}
        <View style={thumb.editorialCorner} />
      </View>
    );
  }
  // centered
  return (
    <View style={thumb.frame}>
      <View style={thumb.centeredInner}>
        <View style={[thumb.textLine, { width: "70%" }]} />
        <View style={[thumb.textLine, { width: "45%", marginTop: 4 }]} />
        <View style={[thumb.centeredCta, { marginTop: 5 }]} />
      </View>
    </View>
  );
}

function BannerLayoutPicker({
  value, onChange, hasImage,
}: {
  value: BannerTone;
  onChange: (v: BannerTone) => void;
  hasImage: boolean;
}) {
  // Quando ha imagem, "image-clean" e' a unica selecionavel e fica auto-selecionada.
  // Os 3 originais aparecem desabilitados (visivel mas nao clicavel).
  // Quando NAO ha imagem, image-clean nao aparece de jeito nenhum.
  const baseOpts: Array<{ tone: BannerTone; label: string }> = [
    { tone: "split",       label: "Dividido" },
    { tone: "editorial",   label: "Editorial" },
    { tone: "centered",    label: "Centralizado" },
  ];
  const opts = hasImage
    ? [...baseOpts, { tone: "image-clean" as BannerTone, label: "Imagem + legenda" }]
    : baseOpts;

  return (
    <View style={pickerStyles.grid}>
      {opts.map((opt) => {
        const isImageClean = opt.tone === "image-clean";
        const active = opt.tone === value;
        const disabled = hasImage && !isImageClean;
        const Wrap: any = disabled ? View : Pressable;
        const wrapProps: any = disabled ? {} : { onPress: () => onChange(opt.tone) };
        return (
          <Wrap
            key={opt.tone}
            {...wrapProps}
            style={[
              pickerStyles.card,
              active && pickerStyles.cardActive,
              disabled && pickerStyles.cardDisabled,
            ]}
          >
            <BannerLayoutThumb tone={opt.tone} />
            <Text style={[pickerStyles.label, active && pickerStyles.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {disabled && (
              <Text style={pickerStyles.disabledHint} numberOfLines={2}>
                Disponível quando o banner é só texto, sem imagem
              </Text>
            )}
          </Wrap>
        );
      })}
    </View>
  );
}

export function TabDesign({
  config, saveConfig, isSaving,
  uploadImage, isUploadingImage,
  deleteImage,
}: {
  config: Cfg;
  saveConfig: (body: any) => Promise<any>;
  isSaving: boolean;
  uploadImage: (params: { type: any; content: string; content_type: string }) => Promise<any>;
  isUploadingImage: boolean;
  deleteImage: (type: any) => Promise<any>;
}) {
  const [primary, setPrimary]   = useState(config.primary_color || "#7c3aed");
  const [accent, setAccent]     = useState(config.accent_color  || "#a78bfa");
  const [dark, setDark]         = useState(!!config.dark_mode);
  const [font, setFont]         = useState(config.font_family   || "classic");
  const [cardStyle, setCardStyle] = useState(config.card_style  || "editorial");
  const [annBar, setAnnBar]     = useState(config.announcement_bar || "");
  const [banners, setBanners]   = useState<Banner[]>(normalizeBanners(config.banners));
  const [serviceCards, setServiceCards] = useState<ServiceCard[]>(normalizeServiceCards(config.service_cards));
  const [device, setDevice]     = useState<"desktop" | "mobile">(IS_WIDE ? "desktop" : "mobile");
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => { setPrimary(config.primary_color || "#7c3aed"); }, [config.primary_color]);
  useEffect(() => { setAccent(config.accent_color   || "#a78bfa"); }, [config.accent_color]);
  useEffect(() => { setDark(!!config.dark_mode); }, [config.dark_mode]);
  useEffect(() => { setFont(config.font_family   || "classic"); }, [config.font_family]);
  useEffect(() => { setCardStyle(config.card_style || "editorial"); }, [config.card_style]);
  useEffect(() => { setAnnBar(config.announcement_bar || ""); }, [config.announcement_bar]);
  useEffect(() => { setBanners(normalizeBanners(config.banners)); }, [JSON.stringify(config.banners)]);
  useEffect(() => { setServiceCards(normalizeServiceCards(config.service_cards)); }, [JSON.stringify(config.service_cards)]);

  const saveTimer = useRef<any>(null);
  function scheduleSave(patch: Partial<Cfg> & { banners?: Banner[]; service_cards?: ServiceCard[] }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveConfig(patch);
        setPreviewKey((k) => k + 1);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao salvar");
      }
    }, 800);
  }

  function updateBanner(idx: number, patch: Partial<Banner>) {
    setBanners((prev) => {
      const next = prev.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      scheduleSave({ banners: next });
      return next;
    });
  }

  function updateServiceCard(idx: number, patch: Partial<ServiceCard>) {
    setServiceCards((prev) => {
      const next = prev.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      scheduleSave({ service_cards: next });
      return next;
    });
  }

  function addServiceCard(card: ServiceCard) {
    setServiceCards((prev) => {
      if (prev.length >= 4) {
        toast.info("Maximo de 4 cards");
        return prev;
      }
      const next = [...prev, { ...card, enabled: true }];
      scheduleSave({ service_cards: next });
      return next;
    });
  }

  async function pickAndUploadImage(type: "logo" | `banner_${number}`) {
    if (Platform.OS !== "web") {
      toast.info("Upload de imagem disponível na versão web por enquanto");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande (máx 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        try {
          const res = await uploadImage({ type, content: base64, content_type: file.type });
          setPreviewKey((k) => k + 1);
          if (type.startsWith("banner_")) {
            const idx = parseInt(type.split("_")[1], 10);
            if (res?.image_url) {
              // Fase 2: ao subir imagem, auto-seta tone='image-clean' (backend ja renderiza assim).
              setBanners((prev) => {
                const next = prev.map((b, i) =>
                  i === idx
                    ? { ...b, image_url: res.image_url, enabled: true, tone: "image-clean" as BannerTone }
                    : b
                );
                scheduleSave({ banners: next });
                return next;
              });
            }
          }
        } catch (err: any) {
          toast.error(err?.message || "Erro no upload");
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  const previewUrl = useMemo(() => previewUrlFor(config.slug), [config.slug]);
  const wide = IS_WIDE;

  const editor = (
    <ScrollView style={s.editorScroll} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Rec #1 — header explicativo: visual mora aqui; contato/Pix ficam em Meu Site. */}
      <View style={s.tabIntro}>
        <Icon name="info" size={14} color={Colors.violet3} />
        <Text style={s.tabIntroText}>
          Aqui você define o visual da loja. Logo, contato e Pix ficam em <Text style={{ fontWeight: "700" }}>Meu Site</Text>.
        </Text>
      </View>

      <SectionTitle title="Identidade visual" />
      <View style={cs.card}>
        <Text style={cs.fieldLabel}>Cor primária</Text>
        <View style={cs.colorRow}>
          {COLOR_PRESETS.map((c) => (
            <Pressable key={c} onPress={() => { setPrimary(c); scheduleSave({ primary_color: c }); }}
              style={[cs.colorDot, { backgroundColor: c }, primary === c && cs.colorDotActive]} />
          ))}
        </View>
        <TextInput style={cs.input} value={primary}
          onChangeText={(v) => { setPrimary(v); scheduleSave({ primary_color: v }); }}
          placeholder="#7c3aed" autoCapitalize="none" />

        <Text style={[cs.fieldLabel, { marginTop: 18 }]}>Cor de destaque</Text>
        <View style={cs.colorRow}>
          {ACCENT_PRESETS.map((c) => (
            <Pressable key={c} onPress={() => { setAccent(c); scheduleSave({ accent_color: c }); }}
              style={[cs.colorDot, { backgroundColor: c }, accent === c && cs.colorDotActive]} />
          ))}
        </View>
        <TextInput style={cs.input} value={accent}
          onChangeText={(v) => { setAccent(v); scheduleSave({ accent_color: v }); }}
          placeholder="#a78bfa" autoCapitalize="none" />

        <View style={cs.divider} />
        <Text style={cs.fieldLabel}>Paletas prontas</Text>
        <View style={[cs.colorRow, { gap: 8, flexDirection: "row", flexWrap: "wrap" }]}>
          {PALETTE_PRESETS.map(([p, a, label]) => {
            const active = primary.toLowerCase() === p.toLowerCase() && accent.toLowerCase() === a.toLowerCase();
            return (
              <Pressable key={label}
                onPress={() => { setPrimary(p); setAccent(a); scheduleSave({ primary_color: p, accent_color: a }); }}
                style={[s.paletteChip, active && s.paletteChipActive]}>
                <View style={s.paletteSplit}>
                  <View style={[s.paletteHalf, { backgroundColor: p, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
                  <View style={[s.paletteHalf, { backgroundColor: a, borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
                </View>
                <Text style={[s.paletteLabel, active && { color: Colors.violet3 }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={cs.divider} />
        <ToggleRow label="Tema escuro" value={dark}
          onChange={(v) => { setDark(v); scheduleSave({ dark_mode: v }); }}
          hint="Inverte fundo e texto, mantendo a paleta" />
      </View>

      <SectionTitle title="Tipografia" />
      <View style={cs.card}>
        <Text style={cs.fieldLabel}>Fonte dos títulos</Text>
        <ChipToggle options={FONT_OPTIONS} value={font}
          onChange={(v) => { setFont(v); scheduleSave({ font_family: v }); }} />

        <Text style={[cs.fieldLabel, { marginTop: 18 }]}>Estilo dos cards de produto</Text>
        <ChipToggle options={CARD_STYLES} value={cardStyle}
          onChange={(v) => { setCardStyle(v); scheduleSave({ card_style: v }); }} />
      </View>

      <SectionTitle title="Anúncio (faixa superior)" />
      <View style={cs.card}>
        <Field label="Texto exibido no topo (desktop)" value={annBar}
          onChange={(v) => { setAnnBar(v); scheduleSave({ announcement_bar: v }); }}
          placeholder="Ex: Frete grátis acima de R$ 250" />
        <Text style={cs.hint}>Deixe vazio para esconder a faixa.</Text>
      </View>

      <SectionTitle title="Banners do topo" />
      <Text style={cs.hint}>
        Até 3 banners se alternam automaticamente no carrossel da home.
      </Text>
      {banners.map((b, idx) => {
        const toneKey = (b.tone || "split") as BannerTone;
        const toneHelper = BANNER_TONE_HELPERS[toneKey] || BANNER_TONE_HELPERS.split;
        const hasImage = !!b.image_url;
        return (
        <View key={idx} style={cs.card}>
          <View style={s.bannerHead}>
            <Text style={s.bannerTitle}>Banner {idx + 1}</Text>
            <ToggleRow label="Ativo" value={!!b.enabled}
              onChange={(v) => updateBanner(idx, { enabled: v })} />
          </View>

          <Field label="Kicker (linha curta acima do título)" value={b.kicker || ""}
            onChange={(v) => updateBanner(idx, { kicker: v })}
            placeholder="Ex: Outono · 2026" />
          <Field label="Título principal" value={b.headline || ""}
            onChange={(v) => updateBanner(idx, { headline: v })}
            placeholder="Ex: Para a casa que respira" />
          <Field label="Corpo (descrição)" value={b.body || ""}
            onChange={(v) => updateBanner(idx, { body: v })}
            placeholder="Texto curto explicando" multiline />
          <Field label="Botão (CTA)" value={b.cta || ""}
            onChange={(v) => updateBanner(idx, { cta: v })}
            placeholder="Ex: Ver coleção" />

          <Text style={cs.fieldLabel}>Layout do banner</Text>
          {/* Fase 2 — picker visual de 4 thumbs (3 quando sem imagem). Auto-lock em image-clean quando ha b.image_url. */}
          <BannerLayoutPicker
            value={toneKey}
            hasImage={hasImage}
            onChange={(v) => updateBanner(idx, { tone: v })}
          />

          {/* Rec #10 — helper text dinamico por tone */}
          <View style={s.toneHelper}>
            <Text style={s.toneHelperText}>
              <Text style={s.toneHelperTitle}>{toneHelper.title}</Text>{" "}
              {toneHelper.body}
            </Text>
          </View>

          <Text style={[cs.fieldLabel, { marginTop: 14 }]}>Cor de fundo</Text>
          <ChipToggle options={BANNER_TINTS} value={b.tint || "brand"}
            onChange={(v: any) => updateBanner(idx, { tint: v })} />

          <View style={cs.divider} />
          <Text style={cs.fieldLabel}>Imagem de fundo (opcional)</Text>
          {b.image_url ? (
            <View style={s.imagePreview}>
              <Image source={{ uri: b.image_url }} style={s.imageThumb} resizeMode="cover" />
              <View style={{ flex: 1, gap: 6 }}>
                <Pressable style={s.smallBtn} onPress={() => pickAndUploadImage(`banner_${idx}` as any)}>
                  <Icon name="upload" size={14} color={Colors.violet3} />
                  <Text style={s.smallBtnText}>Trocar</Text>
                </Pressable>
                <Pressable style={[s.smallBtn, s.smallBtnDanger]}
                  onPress={async () => {
                    try {
                      await deleteImage(`banner_${idx}` as any);
                      // Fase 2: ao remover imagem, restaura tone='split' (default original).
                      updateBanner(idx, { image_url: null, tone: "split" });
                    } catch (err: any) { toast.error(err?.message); }
                  }}>
                  <Icon name="trash" size={14} color="#dc2626" />
                  <Text style={[s.smallBtnText, { color: "#dc2626" }]}>Remover</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={s.uploadDrop} onPress={() => pickAndUploadImage(`banner_${idx}` as any)}
              disabled={isUploadingImage}>
              {isUploadingImage ? <ActivityIndicator color={Colors.violet} /> : (
                <>
                  <Icon name="image" size={20} color={Colors.ink3} />
                  <Text style={s.uploadText}>Adicionar imagem</Text>
                  <Text style={s.uploadHint}>JPG, PNG ou WebP · até 5 MB</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
        );
      })}

      <SectionTitle title="Cards de benefícios (rodapé)" />
      <Text style={cs.hint}>
        Cards curtos exibidos abaixo da grade de produtos. Até 4, cada um com ícone, título e descrição.
      </Text>

      {/* Rec #5 — empty state com biblioteca de templates */}
      {serviceCards.length === 0 ? (
        <View style={s.svcEmpty}>
          <View style={s.svcEmptyIcon}>
            <View style={s.svcEmptySquare} />
            <View style={s.svcEmptySquare} />
            <View style={s.svcEmptySquare} />
            <View style={s.svcEmptySquare} />
          </View>
          <Text style={s.svcEmptyTitle}>Nenhum card configurado</Text>
          <Text style={s.svcEmptyHint}>Escolha um modelo abaixo ou crie um do zero</Text>

          <View style={s.svcTemplateGrid}>
            {SERVICE_CARD_TEMPLATES.map((tpl) => (
              <Pressable key={tpl.title} style={s.svcTemplateCard}
                onPress={() => addServiceCard(tpl)}>
                <View style={s.svcTemplateIcon}>
                  <ServiceIconPreview icon={tpl.icon} size={20} color={Colors.violet3} />
                </View>
                <Text style={s.svcTemplateTitle}>{tpl.title}</Text>
                <Text style={s.svcTemplateBody} numberOfLines={2}>{tpl.body}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={s.svcEmptyBtn}
            onPress={() => addServiceCard({ icon: "sparkle", title: "", body: "" })}>
            <Icon name="plus" size={14} color={Colors.violet3} />
            <Text style={s.svcEmptyBtnText}>Criar do zero</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {serviceCards.map((c, idx) => (
            <View key={idx} style={cs.card}>
              <View style={s.bannerHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={s.svcIconChip}>
                    <ServiceIconPreview icon={c.icon || "sparkle"} size={18} />
                  </View>
                  <Text style={s.bannerTitle}>Card {idx + 1}</Text>
                </View>
                <ToggleRow label="Ativo" value={!!c.enabled}
                  onChange={(v) => updateServiceCard(idx, { enabled: v })} />
              </View>
              <Field label="Título" value={c.title || ""}
                onChange={(v) => updateServiceCard(idx, { title: v })}
                placeholder="Ex: Entrega rápida" />
              <Field label="Descrição" value={c.body || ""}
                onChange={(v) => updateServiceCard(idx, { body: v })}
                placeholder="Ex: Confirmação no WhatsApp" />
              <Text style={cs.fieldLabel}>Ícone</Text>
              <View style={s.iconGrid}>
                {SERVICE_ICONS.map((opt) => {
                  const active = opt.value === (c.icon || "sparkle");
                  return (
                    <Pressable key={opt.value}
                      onPress={() => updateServiceCard(idx, { icon: opt.value })}
                      style={[s.iconChip, active && s.iconChipActive]}>
                      <ServiceIconPreview icon={opt.value} size={20}
                        color={active ? Colors.violet3 : Colors.ink} />
                      <Text style={[s.iconChipLabel, active && { color: Colors.violet3, fontWeight: "600" }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {serviceCards.length < 4 && (
            <Pressable style={s.svcAddBtn}
              onPress={() => addServiceCard({ icon: "sparkle", title: "", body: "" })}>
              <Icon name="plus" size={14} color={Colors.violet3} />
              <Text style={s.svcAddBtnText}>Adicionar card ({serviceCards.length}/4)</Text>
            </Pressable>
          )}
        </>
      )}

      {!config.is_published && (
        <View style={[cs.infoCard, { marginTop: 16 }]}>
          <Icon name="info" size={16} color={Colors.amber} />
          <Text style={cs.infoText}>
            Sua loja ainda não está publicada. Vá em <Text style={{ fontWeight: "700" }}>Meu Site</Text> e
            ative a publicação para que clientes possam acessar.
          </Text>
        </View>
      )}

      {isSaving && (
        <View style={s.savingPill}>
          <ActivityIndicator size="small" color={Colors.violet} />
          <Text style={s.savingText}>Salvando…</Text>
        </View>
      )}
    </ScrollView>
  );

  const preview = (
    <View style={s.previewWrap}>
      <View style={s.previewBar}>
        <View style={s.deviceToggle}>
          <Pressable onPress={() => setDevice("desktop")}
            style={[s.deviceBtn, device === "desktop" && s.deviceBtnActive]}>
            <Icon name="monitor" size={14} color={device === "desktop" ? Colors.violet3 : Colors.ink3} />
            <Text style={[s.deviceText, device === "desktop" && { color: Colors.violet3 }]}>Desktop</Text>
          </Pressable>
          <Pressable onPress={() => setDevice("mobile")}
            style={[s.deviceBtn, device === "mobile" && s.deviceBtnActive]}>
            <Icon name="smartphone" size={14} color={device === "mobile" ? Colors.violet3 : Colors.ink3} />
            <Text style={[s.deviceText, device === "mobile" && { color: Colors.violet3 }]}>Mobile</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setPreviewKey((k) => k + 1)} style={s.refreshBtn}>
          <Icon name="refresh" size={14} color={Colors.ink3} />
          <Text style={s.refreshText}>Atualizar</Text>
        </Pressable>
      </View>
      <View style={[s.previewFrame, device === "mobile" && s.previewFrameMobile]}>
        {previewUrl && Platform.OS === "web" ? (
          // @ts-ignore
          <iframe
            key={previewKey}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{
              width: "100%", height: "100%", border: 0,
              borderRadius: device === "mobile" ? 28 : 8,
              background: "#fff",
            }}
            title="Preview da loja"
          />
        ) : (
          <View style={s.previewEmpty}>
            <Icon name="globe" size={28} color={Colors.ink3} />
            <Text style={s.previewEmptyText}>
              {previewUrl
                ? "Preview disponível na versão web"
                : "Publique sua loja na aba Meu Site para ver o preview aqui"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (!wide) {
    return (
      <View style={{ flex: 1 }}>
        {editor}
        {previewUrl && Platform.OS === "web" && (
          <View style={{ height: 540 }}>{preview}</View>
        )}
      </View>
    );
  }

  return (
    <View style={s.sideBySide}>
      <View style={s.editorSide}>{editor}</View>
      <View style={s.previewSide}>{preview}</View>
    </View>
  );
}

// ============================================================
// Estilos do BannerLayoutPicker (Fase 2)
// ============================================================
const pickerStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  card: {
    // 2x2 em mobile (cada card ~48%), 1x4 em desktop (~23%).
    width: IS_WIDE ? "23%" : "48%",
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
    padding: 8,
    alignItems: "center",
    gap: 6,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: Colors.violet,
    backgroundColor: Colors.violetD,
    padding: 7, // compensa borda extra pra nao "pular" 1px
  },
  cardDisabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 11,
    color: Colors.ink,
    fontWeight: "600",
    textAlign: "center",
  },
  labelActive: {
    color: Colors.violet3,
  },
  disabledHint: {
    fontSize: 9,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 12,
  },
});

// Schematics CSS-puros pros 4 layouts. Cada thumb fica num frame ~70x40px.
const thumb = StyleSheet.create({
  frame: {
    width: 72,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    position: "relative",
  },
  // image-clean: top 70% imagem + bottom 30% caption band
  imageBlock: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "70%",
  },
  imageInner: {
    position: "absolute",
    top: "30%", left: "20%", right: "20%", bottom: "20%",
    backgroundColor: Colors.violetD,
    borderRadius: 2,
  },
  captionBand: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "30%",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  captionLine: {
    height: 2,
    width: 26,
    backgroundColor: Colors.ink3,
    borderRadius: 1,
  },
  captionDot: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.violet,
  },
  // split: esquerda 60% texto + direita 40% circulo
  splitLeft: {
    position: "absolute",
    top: 0, bottom: 0, left: 0,
    width: "60%",
    paddingHorizontal: 5,
    justifyContent: "center",
  },
  splitRight: {
    position: "absolute",
    top: 0, bottom: 0, right: 0,
    width: "40%",
    alignItems: "center",
    justifyContent: "center",
  },
  splitCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.violet,
    opacity: 0.55,
  },
  textLine: {
    height: 2.5,
    backgroundColor: Colors.ink3,
    borderRadius: 1,
  },
  // editorial: letra A gigante + retangulo pequeno no canto
  editorialLetter: {
    position: "absolute",
    top: -4,
    left: 2,
    fontSize: 38,
    fontWeight: "700",
    fontStyle: "italic",
    color: Colors.violet,
    opacity: 0.35,
    // serif fallback
    fontFamily: Platform.OS === "web" ? "Georgia, serif" : undefined,
  },
  editorialCorner: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 22,
    height: 4,
    borderRadius: 1,
    backgroundColor: Colors.ink3,
  },
  // centered: 2 linhas centralizadas + cta
  centeredInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  centeredCta: {
    width: 18,
    height: 5,
    borderRadius: 2,
    backgroundColor: Colors.violet,
  },
});

const s = StyleSheet.create({
  sideBySide: { flexDirection: "row", gap: 16, alignItems: "stretch", minHeight: 720 },
  editorSide: { width: 380, flexShrink: 0 },
  previewSide: { flex: 1 },
  editorScroll: { flex: 1 },

  // Rec #1 — header explicativo da tab
  tabIntro: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.violetD,
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, marginBottom: 12,
  },
  tabIntroText: { flex: 1, fontSize: 12, color: Colors.violet3, lineHeight: 17 },

  previewWrap: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", padding: 12 },
  previewBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 10, gap: 8 },
  deviceToggle: { flexDirection: "row", backgroundColor: Colors.bg4, borderRadius: 10, padding: 3, gap: 2 },
  deviceBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deviceBtnActive: { backgroundColor: Colors.violetD },
  deviceText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  refreshText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  previewFrame: { flex: 1, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden" },
  previewFrameMobile: { alignSelf: "center", width: 390, maxWidth: "100%", borderRadius: 28, borderWidth: 8, borderColor: "#1a1a2e" },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  previewEmptyText: { fontSize: 12, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 280 },

  paletteChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  paletteChipActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  paletteSplit: { flexDirection: "row", width: 28, height: 16, borderRadius: 8, overflow: "hidden" },
  paletteHalf: { flex: 1, height: "100%" },
  paletteLabel: { fontSize: 11, color: Colors.ink, fontWeight: "600" },

  bannerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  bannerTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },

  // Rec #10 — helper text por tone
  toneHelper: {
    backgroundColor: Colors.violetD,
    borderLeftWidth: 3, borderLeftColor: Colors.violet,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 6, marginTop: 8,
  },
  toneHelperText: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  toneHelperTitle: { fontWeight: "700", color: Colors.violet3 },

  imagePreview: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  imageThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: Colors.bg4 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border },
  smallBtnDanger: { backgroundColor: "rgba(220,38,38,0.06)" },
  smallBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  uploadDrop: { borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed", padding: 20, alignItems: "center", gap: 6, backgroundColor: Colors.bg4 },
  uploadText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  uploadHint: { fontSize: 11, color: Colors.ink3 },

  svcIconChip: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  iconChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  iconChipActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  iconChipLabel: { fontSize: 11, color: Colors.ink, fontWeight: "500" },

  // Rec #5 — empty state de service cards
  svcEmpty: {
    borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed",
    backgroundColor: Colors.bg4,
    padding: 20, alignItems: "center",
  },
  svcEmptyIcon: {
    width: 44, height: 44,
    flexDirection: "row", flexWrap: "wrap",
    gap: 3, marginBottom: 12, alignItems: "center", justifyContent: "center",
  },
  svcEmptySquare: { width: 18, height: 18, borderRadius: 4, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border },
  svcEmptyTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  svcEmptyHint: { fontSize: 12, color: Colors.ink3, marginBottom: 16, textAlign: "center" },
  svcTemplateGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, marginBottom: 14, width: "100%",
  },
  svcTemplateCard: {
    width: "48%", minWidth: 140,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg3,
    padding: 12, gap: 6,
  },
  svcTemplateIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  svcTemplateTitle: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  svcTemplateBody: { fontSize: 10, color: Colors.ink3, lineHeight: 14 },
  svcEmptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border,
  },
  svcEmptyBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  svcAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed",
    marginTop: 4,
  },
  svcAddBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },

  savingPill: { position: "absolute", bottom: 16, left: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border },
  savingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
