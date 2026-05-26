// ============================================================
// AURA STUDIO · Estoque (tela master nativa — Sprints 1-4 integradas)
//
// 26/05/2026 — Integração final pós-Sprints 1-4.
// Antes: delegação 1:1 ao EstoqueScreen do varejo. Limitação: forçava
// o cliente Studio a sair do contexto pra configurar personalização,
// ficha técnica e templates.
//
// Agora: tela nativa com lista de produtos + drawer/modal de 4 tabs:
//   Básico         — nome, preço, qty, descrição (PATCH inline)
//   Personalização — embed StudioPersonalizacaoPanel  (Sprint 1)
//   Ficha técnica  — embed StudioFichaTecnicaPanel    (Sprint 2)
//   Templates      — embed StudioTemplatesPanel       (Sprint 3)
//
// "Novo produto" no header abre StudioNewProductWizard (Sprint 4).
//
// Layout do drawer:
//   - Desktop (vw > 1024): lateral direito 540px slide-in
//   - Mobile/tablet: full screen modal
//
// Convenções (não negociar):
//   - useStudioTokens() de @/contexts/StudioThemeMode
//   - useMemo(() => buildStyles(t), [t])
//   - toast com erro REAL ([status] data.error || message)
// ============================================================
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, useWindowDimensions, Image, Platform,
} from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { ProductQualityScore, calculateProductScore } from "@/components/studio/ProductQualityScore";
import StudioPersonalizacaoPanel from "@/components/studio/StudioPersonalizacaoPanel";
import StudioFichaTecnicaPanel from "@/components/studio/StudioFichaTecnicaPanel";
import StudioTemplatesPanel from "@/components/studio/StudioTemplatesPanel";
import StudioNewProductWizard from "@/components/studio/StudioNewProductWizard";
import { Icon } from "@/components/Icon";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { toast } from "@/components/Toast";

// ───────────────────────────────────────────────────────────
// Tipos
// ───────────────────────────────────────────────────────────
type StudioProduct = {
  id: string;
  name: string;
  price: number;
  stock_qty?: number | null;
  description?: string | null;
  image_url?: string | null;
  is_personalizable?: boolean;
  customization_config?: any;
  template_count?: number;
  extra_images_count?: number;
};

type TabKey = "basico" | "personalizacao" | "ficha" | "templates";
type FilterKey = "all" | "personalizable" | "nonpersonalizable";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "basico",         label: "Básico",         icon: "edit-2"  },
  { key: "personalizacao", label: "Personalização", icon: "sparkles" },
  { key: "ficha",          label: "Ficha técnica",  icon: "layers"  },
  { key: "templates",      label: "Templates",      icon: "image"   },
];

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all",                label: "Todos"              },
  { key: "personalizable",     label: "Personalizáveis"     },
  { key: "nonpersonalizable",  label: "Não personalizáveis" },
];

// ───────────────────────────────────────────────────────────
// Tela
// ───────────────────────────────────────────────────────────
export default function StudioEstoque() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const { width: vw } = useWindowDimensions();
  const isWide = vw > 1024;

  const { user } = useAuthStore();
  const cid = String(user?.company_id || "");

  const { config: dcConfig } = useDigitalChannel();

  // Lista
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  // Drawer
  const [selected, setSelected] = useState<StudioProduct | null>(null);
  const [tab, setTab] = useState<TabKey>("basico");

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // ── Loader ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const r = await request<any>(`/companies/${cid}/products?limit=500`, {
        method: "GET",
        retry: 1,
        timeout: 15000,
      });
      const list: StudioProduct[] = Array.isArray(r)
        ? r
        : Array.isArray(r?.products)
          ? r.products
          : Array.isArray(r?.items)
            ? r.items
            : [];
      setProducts(list.map((p: any) => ({
        id: String(p.id),
        name: String(p.name || ""),
        price: Number(p.price) || 0,
        stock_qty: p.stock_qty ?? null,
        description: p.description || null,
        image_url: p.image_url || null,
        is_personalizable: !!p.is_personalizable,
        customization_config: p.customization_config || null,
        template_count: Number(p.template_count) || 0,
        extra_images_count: Number(p.extra_images_count) || 0,
      })));
    } catch (e: any) {
      const status = e?.status ? `[${e.status}] ` : "";
      console.error("[StudioEstoque.load]", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      toast.error(`${status}${e?.data?.error || e?.message || "Erro ao carregar produtos"}`);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Filtro/search ────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "personalizable" && !p.is_personalizable) return false;
      if (filter === "nonpersonalizable" && p.is_personalizable) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, search]);

  // ── Abrir drawer ─────────────────────────────────────────
  const openProduct = useCallback((p: StudioProduct) => {
    setSelected(p);
    setTab("basico");
  }, []);

  const closeDrawer = useCallback(() => {
    setSelected(null);
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await request<any>(`/companies/${cid}/products/${selected.id}`, {
        method: "GET", retry: 1, timeout: 10000,
      });
      const fresh: StudioProduct = {
        id: String(r.id),
        name: String(r.name || selected.name),
        price: Number(r.price) || selected.price,
        stock_qty: r.stock_qty ?? selected.stock_qty,
        description: r.description ?? selected.description,
        image_url: r.image_url ?? selected.image_url,
        is_personalizable: !!r.is_personalizable,
        customization_config: r.customization_config || null,
        template_count: Number(r.template_count) || 0,
        extra_images_count: Number(r.extra_images_count) || 0,
      };
      setSelected(fresh);
      setProducts((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
    } catch (e) {
      console.warn("[StudioEstoque.refreshSelected]", e);
    }
  }, [cid, selected]);

  // ── Header right slot ────────────────────────────────────
  const headerRight = (
    <Pressable onPress={() => setWizardOpen(true)} style={s.btnPri}>
      <Icon name="plus" size={14} color="#fff" />
      <Text style={s.btnPriTxt}>Novo produto</Text>
    </Pressable>
  );

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <StudioPageHeader
          eyebrow="ESTÚDIO · ESTOQUE"
          title="Produtos"
          subtitle="Cadastre, configure personalização, monte ficha técnica e vincule templates."
          rightSlot={headerRight}
        />

        {/* Filtros */}
        <View style={s.filtersRow}>
          <View style={s.chipsRow}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[s.filterChip, active && s.filterChipActive]}
                >
                  <Text style={[s.filterChipTxt, active && s.filterChipTxtActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={s.searchWrap}>
            <Icon name="search" size={14} color={t.ink3} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar produto..."
              placeholderTextColor={t.ink4}
              style={s.searchInput}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={6}>
                <Icon name="x" size={14} color={t.ink3} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Lista */}
        {loading ? (
          <StudioLoading variant="skeleton-list" rows={5} />
        ) : products.length === 0 ? (
          <StudioEmpty
            icon="package"
            title="Catálogo vazio"
            desc="Cadastre seu primeiro produto pra começar a vender."
            primaryCta={{
              label: "Cadastrar produto",
              onPress: () => setWizardOpen(true),
            }}
          />
        ) : visible.length === 0 ? (
          <StudioEmpty
            icon="search"
            title="Nada encontrado"
            desc="Ajuste o filtro ou a busca pra ver mais produtos."
            primaryCta={{
              label: "Limpar filtros",
              onPress: () => { setFilter("all"); setSearch(""); },
            }}
            compact
          />
        ) : (
          <View style={s.list}>
            {visible.map((p) => (
              <ProductRow key={p.id} product={p} t={t} s={s} onPress={() => openProduct(p)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Drawer / Modal */}
      {selected && (
        <ProductDrawer
          product={selected}
          companyId={cid}
          slug={dcConfig?.slug || null}
          isWide={isWide}
          tab={tab}
          setTab={setTab}
          t={t}
          s={s}
          onClose={closeDrawer}
          onProductPatched={(patch) => {
            setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
            setProducts((prev) => prev.map((x) => (x.id === selected.id ? { ...x, ...patch } : x)));
          }}
          onSubpanelChanged={refreshSelected}
        />
      )}

      {/* Wizard novo produto */}
      <StudioNewProductWizard
        visible={wizardOpen}
        companyId={cid}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          load();
        }}
      />
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// ProductRow — linha de produto na lista
// ───────────────────────────────────────────────────────────
function ProductRow({
  product, onPress, t, s,
}: {
  product: StudioProduct;
  onPress: () => void;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
}) {
  const score = useMemo(() => calculateProductScore(product as any), [product]);
  const priceStr = `R$ ${(product.price || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
  const qtyStr = product.stock_qty != null ? `${product.stock_qty} un` : "—";

  return (
    <Pressable onPress={onPress} style={s.row}>
      {/* Foto */}
      <View style={s.rowThumbWrap}>
        {product.image_url ? (
          Platform.OS === "web" ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img
              src={product.image_url}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }}
            />
          ) : (
            <Image source={{ uri: product.image_url }} style={s.rowThumb} />
          )
        ) : (
          <View style={[s.rowThumb, s.rowThumbEmpty]}>
            <Icon name="image" size={18} color={t.ink4} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.rowInfo}>
        <Text style={s.rowName} numberOfLines={1}>{product.name}</Text>
        <View style={s.rowMetaRow}>
          <Text style={s.rowPrice}>{priceStr}</Text>
          <Text style={s.rowDot}>·</Text>
          <Text style={s.rowQty}>{qtyStr}</Text>
        </View>

        {/* Chips */}
        <View style={s.rowChipsRow}>
          {product.is_personalizable && (
            <View style={[s.tinyChip, { backgroundColor: t.primarySoft }]}>
              <Icon name="sparkles" size={10} color={t.primary} />
              <Text style={[s.tinyChipTxt, { color: t.primary }]}>Personalizável</Text>
            </View>
          )}
          {(product.template_count || 0) > 0 && (
            <View style={[s.tinyChip, { backgroundColor: t.accentSoft || t.bgSoft }]}>
              <Icon name="image" size={10} color={t.accent} />
              <Text style={[s.tinyChipTxt, { color: t.accent }]}>
                {product.template_count} template{(product.template_count || 0) > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Score + chevron */}
      <View style={s.rowRight}>
        <ProductQualityScore product={product as any} badgeOnly />
        <Icon name="chevron-right" size={16} color={t.ink3} />
      </View>
    </Pressable>
  );
}

// ───────────────────────────────────────────────────────────
// ProductDrawer — drawer/modal com 4 tabs
// ───────────────────────────────────────────────────────────
function ProductDrawer({
  product, companyId, slug, isWide, tab, setTab, t, s,
  onClose, onProductPatched, onSubpanelChanged,
}: {
  product: StudioProduct;
  companyId: string;
  slug: string | null;
  isWide: boolean;
  tab: TabKey;
  setTab: (k: TabKey) => void;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  onClose: () => void;
  onProductPatched: (patch: Partial<StudioProduct>) => void;
  onSubpanelChanged: () => void;
}) {
  const content = (
    <View style={[s.drawer, isWide && s.drawerWide]}>
      {/* Header */}
      <View style={s.drawerHeader}>
        <View style={s.drawerThumbWrap}>
          {product.image_url ? (
            Platform.OS === "web" ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={product.image_url}
                alt=""
                style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              <Image source={{ uri: product.image_url }} style={s.drawerThumb} />
            )
          ) : (
            <View style={[s.drawerThumb, s.rowThumbEmpty]}>
              <Icon name="image" size={22} color={t.ink4} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.drawerName} numberOfLines={2}>{product.name}</Text>
          <Text style={s.drawerPrice}>
            R$ {(product.price || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2, maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <ProductQualityScore product={product as any} badgeOnly />
          <Pressable onPress={onClose} style={s.drawerCloseBtn} hitSlop={8}>
            <Icon name="x" size={18} color={t.ink2} />
          </Pressable>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabBar}
      >
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={[s.tabBtn, active && s.tabBtnActive]}
            >
              <Icon name={tb.icon as any} size={12} color={active ? t.primary : t.ink3} />
              <Text style={[s.tabBtnTxt, active && s.tabBtnTxtActive]}>{tb.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <View style={s.tabContent}>
        {tab === "basico" && (
          <BasicoTab
            product={product}
            companyId={companyId}
            t={t}
            s={s}
            onPatched={onProductPatched}
          />
        )}
        {tab === "personalizacao" && (
          <StudioPersonalizacaoPanel
            productId={product.id}
            companyId={companyId}
            productName={product.name}
            productPrice={product.price}
            slug={slug}
            onSaved={() => onSubpanelChanged()}
          />
        )}
        {tab === "ficha" && (
          <StudioFichaTecnicaPanel
            productId={product.id}
            companyId={companyId}
            productName={product.name}
            productPrice={product.price}
            onSaved={() => onSubpanelChanged()}
          />
        )}
        {tab === "templates" && (
          <StudioTemplatesPanel
            productId={product.id}
            companyId={companyId}
            productName={product.name}
            onChanged={() => onSubpanelChanged()}
          />
        )}
      </View>
    </View>
  );

  if (isWide) {
    // Desktop: overlay lateral direito
    return (
      <View style={s.drawerOverlay}>
        <Pressable style={s.drawerBackdrop} onPress={onClose} />
        {content}
      </View>
    );
  }

  // Mobile/tablet: full screen modal
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.mobileModal}>
        {content}
      </View>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────
// BasicoTab — form simplificado (PATCH /products/:pid)
// ───────────────────────────────────────────────────────────
function BasicoTab({
  product, companyId, t, s, onPatched,
}: {
  product: StudioProduct;
  companyId: string;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  onPatched: (patch: Partial<StudioProduct>) => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price || ""));
  const [qty, setQty] = useState(product.stock_qty != null ? String(product.stock_qty) : "");
  const [description, setDescription] = useState(product.description || "");
  const [saving, setSaving] = useState(false);

  // Resync se trocar de produto
  useEffect(() => {
    setName(product.name);
    setPrice(String(product.price || ""));
    setQty(product.stock_qty != null ? String(product.stock_qty) : "");
    setDescription(product.description || "");
  }, [product.id]);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) { toast.error("Nome precisa ter ao menos 2 caracteres"); return; }
    const priceNum = parseFloat(price.replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) { toast.error("Preço inválido"); return; }
    const body: Record<string, any> = {
      name: trimmed,
      price: priceNum,
      description: description.trim() || null,
    };
    if (qty.trim() !== "") {
      const qNum = parseInt(qty.replace(/\D/g, ""), 10);
      if (Number.isFinite(qNum)) body.stock_qty = qNum;
    }
    setSaving(true);
    console.log("[StudioEstoque.basico.save]", { productId: product.id, body });
    try {
      await request<any>(`/companies/${companyId}/products/${product.id}`, {
        method: "PATCH",
        body,
        retry: 0,
        timeout: 12000,
      });
      toast.success("Alterações salvas");
      onPatched({
        name: trimmed,
        price: priceNum,
        stock_qty: body.stock_qty ?? product.stock_qty,
        description: body.description,
      });
    } catch (e: any) {
      console.error("[StudioEstoque.basico.save error]", {
        status: e?.status, code: e?.code, message: e?.message, data: e?.data,
      });
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Erro ao salvar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={s.field}>
        <Text style={s.fieldLabel}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={s.input}
          placeholder="Nome do produto"
          placeholderTextColor={t.ink4}
        />
      </View>

      <View style={s.row2}>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.fieldLabel}>Preço (R$)</Text>
          <TextInput
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, ""))}
            style={s.input}
            placeholder="0,00"
            placeholderTextColor={t.ink4}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.fieldLabel}>Estoque</Text>
          <TextInput
            value={qty}
            onChangeText={(v) => setQty(v.replace(/\D/g, ""))}
            style={s.input}
            placeholder="0"
            placeholderTextColor={t.ink4}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.fieldLabel}>Descrição</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[s.input, { minHeight: 90, textAlignVertical: "top" }]}
          placeholder="Detalhes que ajudam o cliente a decidir"
          placeholderTextColor={t.ink4}
          multiline
        />
      </View>

      <Pressable
        onPress={save}
        disabled={saving}
        style={[s.btnPri, saving && { opacity: 0.5 }, { justifyContent: "center" }]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="check" size={14} color="#fff" />
            <Text style={s.btnPriTxt}>Salvar alterações</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ───────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 24, paddingBottom: 80, gap: 18 },

    // Header CTA
    btnPri: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },

    // Filtros
    filtersRow: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
    },
    chipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    filterChipActive: { backgroundColor: t.primarySoft, borderColor: t.primary },
    filterChipTxt: { fontSize: 12, color: t.ink2, fontWeight: "700" },
    filterChipTxtActive: { color: t.primary },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5,
      borderColor: t.ink5,
      borderRadius: 10,
      minWidth: 220,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: t.ink,
      padding: 0,
    },

    // Lista
    list: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      backgroundColor: t.paperCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    rowThumbWrap: { width: 48, height: 48 },
    rowThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: t.bgSoft },
    rowThumbEmpty: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.bgSoft,
    },
    rowInfo: { flex: 1, gap: 4, minWidth: 0 },
    rowName: { fontSize: 14, color: t.ink, fontWeight: "700" },
    rowMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowPrice: { fontSize: 12, color: t.ink2, fontWeight: "700" },
    rowDot: { fontSize: 12, color: t.ink4 },
    rowQty: { fontSize: 12, color: t.ink3, fontWeight: "600" },
    rowChipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
    tinyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    tinyChipTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },

    // Drawer (desktop overlay)
    drawerOverlay: {
      position: "absolute" as any,
      top: 0, right: 0, bottom: 0, left: 0,
      flexDirection: "row",
      zIndex: 5000,
    },
    drawerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.45)",
    },
    drawer: {
      width: "100%",
      height: "100%",
      backgroundColor: t.bg,
      flexDirection: "column",
    },
    drawerWide: {
      width: 540,
      borderLeftWidth: 1,
      borderLeftColor: t.ink5,
      ...(Platform.OS === "web"
        ? ({ boxShadow: "-12px 0 28px rgba(15,23,42,0.18)" } as any)
        : { elevation: 16 }),
    },
    mobileModal: { flex: 1, backgroundColor: t.bg },

    drawerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
      backgroundColor: t.paperCardElev,
    },
    drawerThumbWrap: { width: 64, height: 64 },
    drawerThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: t.bgSoft },
    drawerName: { fontSize: 16, color: t.ink, fontWeight: "800", letterSpacing: -0.2 },
    drawerPrice: { fontSize: 13, color: t.ink2, fontWeight: "700", marginTop: 4 },
    drawerCloseBtn: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: t.bgSoft,
      alignItems: "center", justifyContent: "center",
    },

    tabBar: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
      backgroundColor: t.bg,
    },
    tabBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5,
      borderColor: t.ink5,
    },
    tabBtnActive: {
      backgroundColor: t.primarySoft,
      borderColor: t.primary,
    },
    tabBtnTxt: { fontSize: 12, color: t.ink3, fontWeight: "700" },
    tabBtnTxtActive: { color: t.primary },

    tabContent: { flex: 1 },

    // Form (Basico)
    field: { gap: 6 },
    fieldLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: t.paperCardElev,
      borderWidth: 1.5,
      borderColor: t.ink5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: t.ink,
    },
    row2: { flexDirection: "row", gap: 10 },
  });
}
