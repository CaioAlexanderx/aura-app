// ============================================================
// AURA STUDIO · /studio/configuracoes/marketplace
//
// Sub-onda Marketplaces S-1 (25/05/2026):
// Tela admin pra ajustar handling_time + ver preview do anúncio
// Studio-aware que será publicado quando o core ML/Shopee adapter
// estiver pronto (Fases 1-2 do BACKLOG_MARKETPLACE_INTEGRATIONS).
//
// Consome:
//  - GET /studio/products (lista personalizáveis pra escolher)
//  - GET /studio/marketplace-listings/preview/:pid?platform=...
//  - PATCH /studio/marketplace-settings { marketplace_handling_days }
//  - GET /studio/settings (carrega valor atual)
// ============================================================
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type MarketplaceListingPreview, type MarketplacePlatform } from "@/services/studioApi";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

type PersonalizableProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
};

const PLATFORMS: Array<{ key: MarketplacePlatform; label: string; color: string }> = [
  { key: "mercado_livre", label: "Mercado Livre", color: "#FFE600" },
  { key: "shopee",        label: "Shopee",        color: "#EE4D2D" },
];

export default function StudioMarketplaceAdmin() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const cid = company?.id;

  // Settings
  const [handlingDays, setHandlingDays] = useState<number>(7);
  const [handlingDraft, setHandlingDraft] = useState<string>("7");
  const [savingHandling, setSavingHandling] = useState(false);

  // Produtos personalizáveis
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<PersonalizableProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Preview
  const [platform, setPlatform] = useState<MarketplacePlatform>("mercado_livre");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<MarketplaceListingPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Carrega settings + lista de produtos personalizáveis
  useEffect(() => {
    if (!cid) return;
    studioApi.getSettings(cid).then((res) => {
      const days = (res.settings && (res.settings as any).marketplace_handling_days) || 7;
      setHandlingDays(days);
      setHandlingDraft(String(days));
    }).catch(() => {});

    setLoadingProducts(true);
    request<{ products: PersonalizableProduct[] }>("/companies/" + cid + "/studio/products", { method: "GET" })
      .then((data) => {
        setProducts(data.products || []);
        if (data.products && data.products.length > 0) {
          setSelectedProductId(data.products[0].id);
        }
      })
      .catch((e) => toast.error(e?.message || "Erro ao carregar produtos"))
      .finally(() => setLoadingProducts(false));
  }, [cid]);

  // Carrega preview quando produto/plataforma muda
  const loadPreview = useCallback(async () => {
    if (!cid || !selectedProductId) return;
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await studioApi.getMarketplaceListingPreview(cid, selectedProductId, platform);
      setPreview(data);
    } catch (e: any) {
      setPreview(null);
      setPreviewError(e?.message || "Erro ao gerar preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [cid, selectedProductId, platform]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function saveHandlingDays() {
    if (!cid) return;
    const n = parseInt(handlingDraft, 10);
    if (!Number.isFinite(n) || n < 1 || n > 60) {
      toast.error("Informe um número de 1 a 60 dias");
      return;
    }
    setSavingHandling(true);
    try {
      await studioApi.saveMarketplaceHandlingDays(cid, n);
      setHandlingDays(n);
      toast.success("✨ Prazo de produção salvo");
      // recarrega preview com novo handling
      loadPreview();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSavingHandling(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>VENDAS · MARKETPLACES STUDIO</Text>
          <Text style={s.title}>Anúncios em ML e Shopee</Text>
          <Text style={s.sub}>
            Configure o prazo de produção e veja como o anúncio Studio-aware vai ficar quando o core marketplace estiver ativo. Hoje é preview-only — pedidos reais começam quando a integração ML/Shopee for liberada.
          </Text>
        </View>
        <Pressable
          style={s.backBtn}
          onPress={() => router.push("/studio" as any)}
        >
          <Icon name="arrow-left" size={14} color={t.ink2} />
          <Text style={s.backTxt}>Voltar</Text>
        </Pressable>
      </View>

      {/* ── Card: Settings ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Prazo de produção (handling time)</Text>
        <Text style={s.sectionHelp}>
          Quantos dias úteis você precisa pra coletar a personalização do cliente, fazer a arte, produzir e despachar.
          Esse valor é enviado pro ML (sale_terms.MANUFACTURING_TIME) e pra Shopee (pre_order.days_to_ship).
        </Text>
        <View style={s.handlingRow}>
          <View style={s.handlingInputWrap}>
            <TextInput
              value={handlingDraft}
              onChangeText={setHandlingDraft}
              keyboardType="number-pad"
              style={s.handlingInput}
              placeholder="7"
            />
            <Text style={s.handlingUnit}>dias úteis</Text>
          </View>
          <Pressable
            onPress={saveHandlingDays}
            disabled={savingHandling || handlingDraft === String(handlingDays)}
            style={[
              s.saveBtn,
              {
                opacity: savingHandling || handlingDraft === String(handlingDays) ? 0.4 : 1,
              },
            ]}
          >
            <Text style={s.saveBtnTxt}>{savingHandling ? "Salvando..." : "Salvar"}</Text>
          </Pressable>
        </View>
        <Text style={s.handlingHint}>
          Atual: <Text style={{ fontWeight: "800", color: t.primary }}>{handlingDays} dias</Text>
          {" · "}
          Sugestão pra estúdios pequenos: 5–10 dias. Bulk events ou personalização complexa: 10–15.
        </Text>
      </View>

      {/* ── Card: Preview do anúncio ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Preview do anúncio</Text>
        <Text style={s.sectionHelp}>
          Veja como o anúncio do produto personalizado vai aparecer quando publicado.
          O payload exato (JSON) está abaixo pra inspeção.
        </Text>

        {/* Seletor de plataforma */}
        <View style={s.tabs}>
          {PLATFORMS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPlatform(p.key)}
              style={[
                s.tab,
                platform === p.key && { backgroundColor: p.color, borderColor: p.color },
              ]}
            >
              <Text style={[s.tabTxt, platform === p.key && { color: "#1a1a1a", fontWeight: "800" }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Seletor de produto */}
        <Text style={s.label}>Produto personalizável</Text>
        {loadingProducts ? (
          <ActivityIndicator size="small" color={t.primary} />
        ) : products.length === 0 ? (
          <View style={s.emptyMini}>
            <Text style={s.emptyMiniTxt}>
              Nenhum produto personalizável cadastrado. Marque "É personalizável" em produtos do Studio antes.
            </Text>
            <Pressable
              onPress={() => router.push("/studio/produtos" as any)}
              style={[s.emptyBtnMini, { backgroundColor: t.primary }]}
            >
              <Text style={s.emptyBtnMiniTxt}>Ir pra Produtos</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedProductId(p.id)}
                style={[
                  s.productChip,
                  selectedProductId === p.id && { backgroundColor: t.primarySoft, borderColor: t.primary },
                ]}
              >
                <Text style={[s.productChipTxt, selectedProductId === p.id && { color: t.primary, fontWeight: "800" }]}>
                  {p.name}
                </Text>
                <Text style={s.productChipPrice}>R$ {p.price.toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Preview */}
        {selectedProduct && (
          <View style={s.previewBox}>
            {loadingPreview ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color={t.primary} />
              </View>
            ) : previewError ? (
              <View style={s.errorBox}>
                <Icon name="alert-circle" size={20} color="#991B1B" />
                <Text style={s.errorTxt}>{previewError}</Text>
              </View>
            ) : preview ? (
              <>
                <View style={s.previewHead}>
                  <Text style={s.previewProductName}>{preview.product_name}</Text>
                  <View style={s.handlingBadge}>
                    <Icon name="clock" size={11} color={t.primary} />
                    <Text style={s.handlingBadgeTxt}>{preview.handling_time_days} dias úteis</Text>
                  </View>
                </View>

                {/* Resumo simulado do anúncio */}
                {platform === "mercado_livre" && (
                  <View style={s.mockAd}>
                    <Text style={s.mockAdLabel}>TÍTULO</Text>
                    <Text style={s.mockAdTitle}>{preview.payload.title}</Text>
                    <Text style={s.mockAdLabel}>DESCRIÇÃO (gerada automaticamente)</Text>
                    <Text style={s.mockAdDesc}>{preview.payload?.description?.plain_text}</Text>
                    <View style={s.mockAdMeta}>
                      <Text style={s.mockAdMetaItem}>💰 R$ {Number(preview.payload.price).toFixed(2)}</Text>
                      <Text style={s.mockAdMetaItem}>📦 Modo: {preview.payload.listing_type_id}</Text>
                      <Text style={s.mockAdMetaItem}>🏷 {preview.payload.condition}</Text>
                    </View>
                  </View>
                )}
                {platform === "shopee" && (
                  <View style={s.mockAd}>
                    <Text style={s.mockAdLabel}>NOME DO ITEM</Text>
                    <Text style={s.mockAdTitle}>{preview.payload.item_name}</Text>
                    <Text style={s.mockAdLabel}>DESCRIÇÃO (gerada automaticamente)</Text>
                    <Text style={s.mockAdDesc}>{preview.payload.description}</Text>
                    <View style={s.mockAdMeta}>
                      <Text style={s.mockAdMetaItem}>💰 R$ {Number(preview.payload.price_info?.[0]?.original_price || 0).toFixed(2)}</Text>
                      <Text style={s.mockAdMetaItem}>⏳ Pré-venda: {preview.payload.pre_order?.days_to_ship} dias</Text>
                    </View>
                  </View>
                )}

                <Text style={s.note}>
                  <Icon name="info" size={11} color={t.ink3} /> {preview.note}
                </Text>

                {/* Payload técnico */}
                <Pressable
                  onPress={() => {/* poderia expandir/collapse — por ora sempre exibe */}}
                  style={s.payloadHead}
                >
                  <Text style={s.payloadHeadTxt}>Payload técnico (JSON)</Text>
                </Pressable>
                <View style={s.codeBlock}>
                  <Text style={s.code} selectable>
                    {JSON.stringify(preview.payload, null, 2)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        )}
      </View>

      {/* ── Card: Status do core adapter ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Status da integração</Text>
        <View style={s.statusCard}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={s.statusLabel}>Core ML adapter</Text>
            <Text style={s.statusValue}>Em backlog (Fases 1-2 do roadmap de marketplaces)</Text>
          </View>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={s.statusLabel}>Core Shopee adapter</Text>
            <Text style={s.statusValue}>Em backlog (Fase 2)</Text>
          </View>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: "#10B981" }]} />
            <Text style={s.statusLabel}>Schema Studio (S-0)</Text>
            <Text style={s.statusValue}>Migrado · awaiting_customization disponível no Fluxo de Produção</Text>
          </View>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: "#10B981" }]} />
            <Text style={s.statusLabel}>Payload Studio (S-1)</Text>
            <Text style={s.statusValue}>Pronto · handling_time + descrição auto-gerada</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 28, paddingTop: 24, paddingBottom: 16, gap: 16, flexWrap: "wrap",
  },
  eyebrow: { fontSize: 11, color: t.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: t.ink3, marginTop: 4, maxWidth: 620, lineHeight: 19 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
  },
  backTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "600" },

  section: {
    marginHorizontal: 28, marginTop: 8, marginBottom: 16,
    padding: 20, gap: 8,
    backgroundColor: t.paperCard, borderRadius: 18,
    borderWidth: 1, borderColor: t.ink5,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
  sectionHelp: { fontSize: 12.5, color: t.ink3, lineHeight: 18 },

  handlingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" },
  handlingInputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: t.paperCardElev,
  },
  handlingInput: {
    width: 60, fontSize: 16, fontWeight: "800", color: t.ink, padding: 4,
  },
  handlingUnit: { fontSize: 12, color: t.ink3, marginLeft: 4 },
  saveBtn: {
    backgroundColor: t.primary,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  handlingHint: { fontSize: 11.5, color: t.ink3, marginTop: 6 },

  tabs: { flexDirection: "row", gap: 8, marginTop: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev,
  },
  tabTxt: { fontSize: 12.5, color: t.ink2, fontWeight: "700" },

  label: { fontSize: 11.5, color: t.ink3, fontWeight: "700", textTransform: "uppercase", marginTop: 12, letterSpacing: 0.5 },

  productChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
    minWidth: 140,
  },
  productChipTxt: { fontSize: 12.5, color: t.ink, fontWeight: "700" },
  productChipPrice: { fontSize: 11, color: t.ink3, marginTop: 2 },

  emptyMini: { padding: 14, alignItems: "center", gap: 8, marginTop: 6 },
  emptyMiniTxt: { fontSize: 12, color: t.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 },
  emptyBtnMini: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 4,
  },
  emptyBtnMiniTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },

  previewBox: { marginTop: 16, gap: 12 },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  previewProductName: { fontSize: 15, fontWeight: "800", color: t.ink, flex: 1 },
  handlingBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: t.primarySoft,
  },
  handlingBadgeTxt: { fontSize: 11, color: t.primary, fontWeight: "800" },

  mockAd: {
    backgroundColor: t.paperCardElev,
    borderRadius: 12, padding: 14, gap: 6,
    borderWidth: 1, borderColor: t.ink5,
  },
  mockAdLabel: { fontSize: 10, color: t.ink4, fontWeight: "800", letterSpacing: 0.5 },
  mockAdTitle: { fontSize: 14, color: t.ink, fontWeight: "700", marginBottom: 6 },
  mockAdDesc: { fontSize: 12, color: t.ink2, lineHeight: 17, marginBottom: 6 },
  mockAdMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 4 },
  mockAdMetaItem: { fontSize: 11, color: t.ink3, fontWeight: "600" },

  note: { fontSize: 11, color: t.ink3, fontStyle: "italic" },

  payloadHead: { paddingVertical: 6 },
  payloadHeadTxt: { fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  codeBlock: {
    backgroundColor: "#0F172A", borderRadius: 10, padding: 14,
    maxHeight: 360,
  },
  code: {
    color: "#E2E8F0",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
  },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEE2E2", padding: 12, borderRadius: 10,
  },
  errorTxt: { color: "#991B1B", fontSize: 12, fontWeight: "600", flex: 1 },

  statusCard: { gap: 8, marginTop: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12.5, color: t.ink, fontWeight: "700", minWidth: 160 },
  statusValue: { fontSize: 12, color: t.ink3, flex: 1 },
});
