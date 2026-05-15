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

type Banner = {
  kicker?: string; headline?: string; body?: string; cta?: string;
  tone?: "split" | "editorial" | "centered";
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

const DEFAULT_SERVICE_CARDS: ServiceCard[] = [
  { icon: "truck",   title: "Entrega rápida",      body: "Confirmação no WhatsApp", enabled: true },
  { icon: "pkg",     title: "Embalagem cuidadosa", body: "Pronta pra presentear",   enabled: true },
  { icon: "shield",  title: "Pagamento seguro",    body: "Pix e demais opções",     enabled: true },
  { icon: "sparkle", title: "Curadoria editada",   body: "Produtos selecionados",   enabled: true },
];

function normalizeBanners(input: any): Banner[] {
  if (!Array.isArray(input)) return DEFAULT_BANNERS;
  const arr: Banner[] = input.slice(0, 3).map((b: any) => ({
    kicker: b?.kicker || "", headline: b?.headline || "",
    body: b?.body || "", cta: b?.cta || "",
    tone: ["split", "editorial", "centered"].includes(b?.tone) ? b.tone : "split",
    tint: ["brand", "accent"].includes(b?.tint) ? b.tint : "brand",
    image_url: b?.image_url || null,
    enabled: b?.enabled !== false,
  }));
  while (arr.length < 3) arr.push({ ...DEFAULT_BANNERS[arr.length], enabled: false });
  return arr;
}

function normalizeServiceCards(input: any): ServiceCard[] {
  if (!Array.isArray(input) || !input.length) return DEFAULT_SERVICE_CARDS;
  const arr: ServiceCard[] = input.slice(0, 4).map((c: any) => ({
    icon: c?.icon || "sparkle",
    title: c?.title || "",
    body:  c?.body  || "",
    enabled: c?.enabled !== false,
  }));
  while (arr.length < 4) arr.push({ ...DEFAULT_SERVICE_CARDS[arr.length], enabled: false });
  return arr;
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
              setBanners((prev) => prev.map((b, i) => i === idx ? { ...b, image_url: res.image_url, enabled: true } : b));
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
      {banners.map((b, idx) => (
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

          <Text style={cs.fieldLabel}>Estilo do banner</Text>
          <ChipToggle options={BANNER_TONES} value={b.tone || "split"}
            onChange={(v: any) => updateBanner(idx, { tone: v })} />

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
                      updateBanner(idx, { image_url: null });
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
      ))}

      <SectionTitle title="Cards de benefícios (rodapé)" />
      <Text style={cs.hint}>
        4 cards exibidos abaixo da grade de produtos. Cada um tem ícone, título e descrição curta.
      </Text>
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

const s = StyleSheet.create({
  sideBySide: { flexDirection: "row", gap: 16, alignItems: "stretch", minHeight: 720 },
  editorSide: { width: 380, flexShrink: 0 },
  previewSide: { flex: 1 },
  editorScroll: { flex: 1 },

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

  savingPill: { position: "absolute", bottom: 16, left: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border },
  savingText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
