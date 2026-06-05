// ============================================================
// AURA STUDIO · Estoque (tela master nativa — refactor inline 26/05/2026)
//
// PIVOT 26/05/2026 — Feedback do cliente: "Produtos e Estoque tinham que
// conversar e ser a mesma coisa, na mesma tela". O drawer lateral 540px
// com 4 tabs (Básico/Personalização/Ficha/Templates) ainda dava sensação
// de "tela secundária separada".
//
// Solução: REMOVER o drawer/modal lateral. Click numa linha de produto
// expande INLINE (mesma página, scroll-down) toda a configuração em
// seções accordion:
//
//   ▾ DADOS BÁSICOS       (expandida por default)
//   ▸ PERSONALIZAÇÃO      (StudioPersonalizacaoPanel embeddado)
//   ▸ FICHA TÉCNICA       (StudioFichaTecnicaPanel embeddado)
//   ▸ TEMPLATES VINCULADOS (StudioTemplatesPanel embeddado)
//
// Cada seção: header com icon ▾/▸ + título + chip indicador
// (OK / Incompleto / Vazio). Após salvar, mostra check verde.
//
// Lista master continua igual no topo (quando nenhum produto está
// expandido). Botão "Voltar pra lista" no topo da expansão retorna
// pro grid.
//
// "Novo produto" abre StudioNewProductWizard (Sprint 4) — sem mudança.
//
// Deep-links:
//   ?action=novo-produto      → abre wizard automaticamente no mount
//   ?action=edit-product&id=<pid> → expande produto correspondente
//     inline (mesma ação de clicar na lista). Se os produtos ainda não
//     carregaram no mount, o expand é aplicado após o load() via ref.
//     Param consumido via router.replace para não reabrir em re-renders.
//
// Convenções (não negociar):
//   - useStudioTokens() de @/contexts/StudioThemeMode
//   - useMemo(() => buildStyles(t), [t])
//   - StudioPalette type
//   - toast com erro REAL ([status] data.error || message)
//
// 05/06/2026 (#4): filtro por categoria de produto
//   - variant="board" já estava correto (scroll fix não necessário)
//   - studioApi.listProductCategories carregado junto com produtos
//   - chips de categoria abaixo dos chips personalizable/não-personalizable
//   - filtragem por product.category === categoria.name (texto)
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Image, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { ProductQualityScore, calculateProductScore } from "@/components/studio/ProductQualityScore";
import StudioPersonalizacaoPanel from "@/components/studio/StudioPersonalizacaoPanel";
import StudioFichaTecnicaPanel from "@/components/studio/StudioFichaTecnicaPanel";
import StudioTemplatesPanel from "@/components/studio/StudioTemplatesPanel";
import StudioNewProductWizard from "@/components/studio/StudioNewProductWizard";
import { Icon } from "@/components/Icon";
import { request } from "@/services/api";
import { studioApi } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { toast } from "@/components/Toast";
import { pickFileWeb, fileToBase64Web, uploadStudioMockup } from "@/services/studioUploadApi";

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
  category?: string | null;
};

type SectionKey = "basico" | "personalizacao" | "ficha" | "templates";
type FilterKey = "all" | "personalizable" | "nonpersonalizable";

type SectionStatus = "ok" | "partial" | "empty";

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

  // 27/05/2026: alinhar com caixa.tsx + StudioShell + configuracoes — auth.company.id
  // (não user.company_id, que está undefined em algumas contas Studio que loga
  // via member em vez de owner direto). PDV funcionava porque já usava esse padrão.
  const auth = useAuthStore();
  const cid = ((auth.company as any)?.id as string | undefined) || "";

  const { config: dcConfig } = useDigitalChannel();

  // Lista
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<StudioProduct[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  // Filtro por categoria (#4)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null); // null = "Todas"

  // Inline expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // ── Deep-link params ──────────────────────────────────────────────────────
  // Captura action + id para tratar tanto ?action=novo-produto quanto
  // ?action=edit-product&id=<pid> no mesmo useEffect de mount.
  const params = useLocalSearchParams<{ action?: string; id?: string }>();
  const router = useRouter();

  // Ref para expand pendente: quando edit-product chega antes do load()
  // terminar, guardamos o id aqui e aplicamos após products ser populado.
  const pendingExpandIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (params.action === "novo-produto") {
      setWizardOpen(true);
      // Consome o param para não reabrir em re-renders
      router.replace("/studio/estoque" as any);
    } else if (params.action === "edit-product" && params.id) {
      const targetId = params.id;
      // Consome o param imediatamente para não reabrir em re-renders
      router.replace("/studio/estoque" as any);
      // Se produtos já carregados: expande direto (mesma ação de clicar na lista)
      // Se ainda carregando: salva na ref para aplicar após load()
      setProducts((current) => {
        const found = current.find((p) => p.id === targetId);
        if (found) {
          setExpandedId(targetId);
        } else {
          // Produtos ainda não carregados — pendingExpandIdRef será lido no useEffect de products
          pendingExpandIdRef.current = targetId;
        }
        return current; // sem mutação
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aplica expand pendente após products carregar ─────────────────────────
  // Quando edit-product chega e produtos ainda estavam vazios no mount,
  // este efeito aplica o expand assim que a lista é populada.
  useEffect(() => {
    if (!loading && pendingExpandIdRef.current) {
      const targetId = pendingExpandIdRef.current;
      pendingExpandIdRef.current = null;
      const found = products.find((p) => p.id === targetId);
      if (found) {
        setExpandedId(targetId);
      } else {
        // Produto não encontrado na lista (inativo ou de outra empresa):
        // fallback silencioso — permanece na lista sem expansão.
        console.warn("[StudioEstoque] edit-product: produto não encontrado na lista, id=", targetId);
      }
    }
  }, [loading, products]);

  // ── Loader ───────────────────────────────────────────────
  const load = useCallback(async () => {
    // Defensivo: cid vazio (auth hidratando) → liberar skeleton em vez de travar
    // Bug 26/05/2026: setLoading inicial=true + early return SEM setLoading(false)
    // = skeleton infinito quando user.company_id chega vazio na 1ª render
    if (!cid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Carrega produtos e categorias em paralelo (#4)
      const [r, catResult] = await Promise.all([
        request<any>(`/companies/${cid}/studio/products?include_non_personalizable=true&limit=500`, {
          method: "GET",
          retry: 1,
          timeout: 15000,
        }),
        studioApi.listProductCategories(cid).catch(() => null),
      ]);

      // Produtos
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
        category: p.category || null,
      })));

      // Categorias (#4)
      if (catResult?.categories) {
        setCategories(catResult.categories.map((c: any) => ({
          id: String(c.id),
          name: String(c.name || ""),
          color: c.color || null,
        })));
      }
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
      // Filtro por categoria (#4): compara texto do campo category
      if (categoryFilter !== null && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, categoryFilter, search]);

  const expandedProduct = useMemo(
    () => (expandedId ? products.find((p) => p.id === expandedId) || null : null),
    [expandedId, products],
  );

  // ── Refresh de um produto após patch em subpanel ─────────
  const refreshExpanded = useCallback(async () => {
    if (!expandedId) return;
    try {
      const r = await request<any>(`/companies/${cid}/products/${expandedId}`, {
        method: "GET", retry: 1, timeout: 10000,
      });
      const fresh: Partial<StudioProduct> = {
        id: String(r.id),
        name: String(r.name || ""),
        price: Number(r.price) || 0,
        stock_qty: r.stock_qty ?? null,
        description: r.description ?? null,
        image_url: r.image_url ?? null,
        is_personalizable: !!r.is_personalizable,
        customization_config: r.customization_config || null,
        template_count: Number(r.template_count) || 0,
        extra_images_count: Number(r.extra_images_count) || 0,
        category: r.category || null,
      };
      setProducts((prev) => prev.map((p) => (p.id === expandedId ? { ...p, ...fresh } : p)));
    } catch (e) {
      console.warn("[StudioEstoque.refreshExpanded]", e);
    }
  }, [cid, expandedId]);

  // ── Header right slot ────────────────────────────────────
  const headerRight = expandedProduct ? null : (
    <Pressable onPress={() => setWizardOpen(true)} style={s.btnPri}>
      <Icon name="plus" size={14} color="#fff" />
      <Text style={s.btnPriTxt}>Novo produto</Text>
    </Pressable>
  );

  return (
    <StudioScreen variant="board" scroll={false} padded={false}>
      <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        {expandedProduct ? (
          <ProductExpanded
            product={expandedProduct}
            companyId={cid}
            slug={dcConfig?.slug || null}
            t={t}
            s={s}
            onBack={() => setExpandedId(null)}
            onProductPatched={(patch) => {
              setProducts((prev) => prev.map((x) => (x.id === expandedProduct.id ? { ...x, ...patch } : x)));
            }}
            onSubpanelChanged={refreshExpanded}
          />
        ) : (
          <>
            <StudioPageHeader
              eyebrow="ESTÚDIO · PRODUTOS & ESTOQUE"
              title="Catálogo Studio"
              subtitle="Click num produto pra abrir tudo: dados básicos, personalização, ficha técnica e templates — na mesma tela."
              rightSlot={headerRight}
            />

            {/* Filtros personalizable */}
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

            {/* Filtro por categoria (#4) — só exibe se existirem categorias */}
            {categories.length > 0 && (
              <View style={s.categoryRow}>
                <Pressable
                  onPress={() => setCategoryFilter(null)}
                  style={[s.filterChip, categoryFilter === null && s.filterChipActive]}
                >
                  <Text style={[s.filterChipTxt, categoryFilter === null && s.filterChipTxtActive]}>
                    Todas
                  </Text>
                </Pressable>
                {categories.map((c) => {
                  const active = categoryFilter === c.name;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryFilter(active ? null : c.name)}
                      style={[s.filterChip, active && s.filterChipActive]}
                    >
                      {c.color ? (
                        <View style={[s.catDot, { backgroundColor: c.color }]} />
                      ) : null}
                      <Text style={[s.filterChipTxt, active && s.filterChipTxtActive]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Lista */}
            {loading ? (
              <StudioLoading variant="skeleton-list" rows={5} />
            ) : products.length === 0 ? (
              <StudioEmpty
                icon="package"
                title="Catalogo vazio"
                desc="Cadastre seu primeiro produto pra comecar a vender."
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
                  onPress: () => { setFilter("all"); setSearch(""); setCategoryFilter(null); },
                }}
                compact
              />
            ) : (
              <View style={s.list}>
                {visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    t={t}
                    s={s}
                    onPress={() => setExpandedId(p.id)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

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
    </StudioScreen>
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
              <Text style={[s.tinyChipTxt, { color: t.primary }]}>Personalizavel</Text>
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
          {product.category ? (
            <View style={[s.tinyChip, { backgroundColor: t.bgSoft }]}>
              <Icon name="tag" size={10} color={t.ink3} />
              <Text style={[s.tinyChipTxt, { color: t.ink3 }]}>{product.category}</Text>
            </View>
          ) : null}
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
// ProductExpanded — produto expandido inline (mesma tela)
// Sticky header + 4 seções accordion
// ───────────────────────────────────────────────────────────
function ProductExpanded({
  product, companyId, slug, t, s,
  onBack, onProductPatched, onSubpanelChanged,
}: {
  product: StudioProduct;
  companyId: string;
  slug: string | null;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
  onBack: () => void;
  onProductPatched: (patch: Partial<StudioProduct>) => void;
  onSubpanelChanged: () => void;
}) {
  // Seções: estado de expansão + status (ok/partial/empty)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    basico: true,
    personalizacao: false,
    ficha: false,
    templates: false,
  });
  const [savedFlash, setSavedFlash] = useState<Partial<Record<SectionKey, boolean>>>({});

  const toggle = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Status de cada seção
  const basicoStatus: SectionStatus = useMemo(() => {
    const hasName = (product.name || "").trim().length >= 2;
    const hasPrice = (product.price || 0) > 0;
    const hasDesc = !!(product.description && product.description.trim());
    const hasImage = !!product.image_url;
    const filled = [hasName, hasPrice, hasDesc, hasImage].filter(Boolean).length;
    if (filled === 4) return "ok";
    if (filled >= 2) return "partial";
    return "empty";
  }, [product.name, product.price, product.description, product.image_url]);

  const personalizacaoStatus: SectionStatus = useMemo(() => {
    if (!product.is_personalizable) return "empty";
    const cfg = product.customization_config;
    const hasZones = Array.isArray(cfg?.zones) && cfg.zones.length > 0;
    return hasZones ? "ok" : "partial";
  }, [product.is_personalizable, product.customization_config]);

  const templatesStatus: SectionStatus = useMemo(() => {
    const c = product.template_count || 0;
    if (c >= 3) return "ok";
    if (c >= 1) return "partial";
    return "empty";
  }, [product.template_count]);

  // Ficha técnica: não temos o campo no row, então sinalizamos como "abrir pra ver"
  const fichaStatus: SectionStatus = "partial";

  const score = useMemo(() => calculateProductScore(product as any), [product]);
  const personalizableChip = product.is_personalizable;
  const templateChipQty = product.template_count || 0;

  const flashSaved = (key: SectionKey) => {
    setSavedFlash((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavedFlash((prev) => ({ ...prev, [key]: false }));
    }, 2500);
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Toolbar: voltar */}
      <View style={s.expandedToolbar}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Icon name="arrow-left" size={14} color={t.ink2} />
          <Text style={s.backBtnTxt}>Voltar pra lista</Text>
        </Pressable>
      </View>

      {/* Sticky header do produto */}
      <View style={s.expandedHeader}>
        <View style={s.expandedThumbWrap}>
          {product.image_url ? (
            Platform.OS === "web" ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={product.image_url}
                alt=""
                style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover" }}
              />
            ) : (
              <Image source={{ uri: product.image_url }} style={s.expandedThumb} />
            )
          ) : (
            <View style={[s.expandedThumb, s.rowThumbEmpty]}>
              <Icon name="image" size={24} color={t.ink4} />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={s.expandedName} numberOfLines={2}>{product.name}</Text>
          <View style={s.expandedMetaRow}>
            <Text style={s.expandedPrice}>
              R$ {(product.price || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2, maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={s.rowDot}>·</Text>
            <Text style={s.expandedQty}>
              {product.stock_qty != null ? `${product.stock_qty} un em estoque` : "Estoque nao informado"}
            </Text>
          </View>
          <View style={s.expandedChipsRow}>
            {personalizableChip && (
              <View style={[s.tinyChip, { backgroundColor: t.primarySoft }]}>
                <Icon name="sparkles" size={10} color={t.primary} />
                <Text style={[s.tinyChipTxt, { color: t.primary }]}>Personalizavel</Text>
              </View>
            )}
            {templateChipQty > 0 && (
              <View style={[s.tinyChip, { backgroundColor: t.accentSoft || t.bgSoft }]}>
                <Icon name="image" size={10} color={t.accent} />
                <Text style={[s.tinyChipTxt, { color: t.accent }]}>
                  {templateChipQty} template{templateChipQty > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Qualidade do cadastro — checklist acionável do que falta melhorar */}
      <ProductQualityScore product={product as any} />

      {/* Seção 1 — Dados básicos */}
      <SectionCard
        title="Dados basicos"
        icon="edit"
        status={basicoStatus}
        open={openSections.basico}
        savedFlash={!!savedFlash.basico}
        onToggle={() => toggle("basico")}
        t={t}
        s={s}
      >
        <BasicoForm
          product={product}
          companyId={companyId}
          t={t}
          s={s}
          onPatched={(patch) => {
            onProductPatched(patch);
            flashSaved("basico");
          }}
        />
      </SectionCard>

      {/* Seção 2 — Personalização */}
      <SectionCard
        title="Personalizacao"
        icon="sparkles"
        status={personalizacaoStatus}
        open={openSections.personalizacao}
        savedFlash={!!savedFlash.personalizacao}
        onToggle={() => toggle("personalizacao")}
        t={t}
        s={s}
      >
        <StudioPersonalizacaoPanel
          productId={product.id}
          companyId={companyId}
          productName={product.name}
          productPrice={product.price}
          slug={slug}
          onSaved={() => { onSubpanelChanged(); flashSaved("personalizacao"); }}
        />
      </SectionCard>

      {/* Seção 3 — Ficha técnica */}
      <SectionCard
        title="Ficha tecnica"
        icon="clipboard"
        status={fichaStatus}
        open={openSections.ficha}
        savedFlash={!!savedFlash.ficha}
        onToggle={() => toggle("ficha")}
        t={t}
        s={s}
      >
        <StudioFichaTecnicaPanel
          productId={product.id}
          companyId={companyId}
          productName={product.name}
          productPrice={product.price}
          onSaved={() => { onSubpanelChanged(); flashSaved("ficha"); }}
        />
      </SectionCard>

      {/* Seção 4 — Templates vinculados */}
      <SectionCard
        title="Templates vinculados"
        icon="image"
        status={templatesStatus}
        open={openSections.templates}
        savedFlash={!!savedFlash.templates}
        onToggle={() => toggle("templates")}
        t={t}
        s={s}
      >
        <StudioTemplatesPanel
          productId={product.id}
          companyId={companyId}
          productName={product.name}
          onChanged={() => { onSubpanelChanged(); flashSaved("templates"); }}
        />
      </SectionCard>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// SectionCard — card accordion reusável
// ───────────────────────────────────────────────────────────
function SectionCard({
  title, icon, status, open, savedFlash, onToggle, children, t, s,
}: {
  title: string;
  icon: string;
  status: SectionStatus;
  open: boolean;
  savedFlash: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  t: StudioPalette;
  s: ReturnType<typeof buildStyles>;
}) {
  const statusMeta = useMemo(() => {
    if (savedFlash) {
      return { label: "Salvo agora", bg: t.successSoft || "#d1fae5", fg: t.success || "#059669", icon: "check" };
    }
    switch (status) {
      case "ok":      return { label: "Completo",   bg: t.successSoft || "#d1fae5", fg: t.success || "#059669", icon: "check" };
      case "partial": return { label: "Incompleto", bg: t.warningSoft || "#fef3c7", fg: t.warning || "#b45309", icon: "alert-triangle" };
      case "empty":
      default:        return { label: "Vazio",      bg: t.bgSoft,                   fg: t.ink3,                 icon: "circle" };
    }
  }, [status, savedFlash, t]);

  return (
    <View style={s.sectionCard}>
      <Pressable onPress={onToggle} style={s.sectionHeader}>
        <View style={s.sectionHeaderLeft}>
          <View style={s.sectionIconWrap}>
            <Icon name={icon as any} size={14} color={t.primary} />
          </View>
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        <View style={s.sectionHeaderRight}>
          <View style={[s.statusChip, { backgroundColor: statusMeta.bg }]}>
            <Icon name={statusMeta.icon as any} size={10} color={statusMeta.fg} />
            <Text style={[s.statusChipTxt, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
          </View>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={t.ink2} />
        </View>
      </Pressable>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// BasicoForm — form inline (PATCH /products/:pid)
// ───────────────────────────────────────────────────────────
function BasicoForm({
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
  const [localImage, setLocalImage] = useState(product.image_url || null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Resync se trocar de produto
  useEffect(() => {
    setName(product.name);
    setPrice(String(product.price || ""));
    setQty(product.stock_qty != null ? String(product.stock_qty) : "");
    setDescription(product.description || "");
    setLocalImage(product.image_url || null);
  }, [product.id]);

  async function uploadImage() {
    if (!companyId || Platform.OS !== "web") {
      toast.error("Upload disponivel apenas na versao web");
      return;
    }
    const file = await pickFileWeb("image/*");
    if (!file) return;
    setUploadingImg(true);
    try {
      const { base64, content_type } = await fileToBase64Web(file);
      const r = await uploadStudioMockup(companyId, {
        content_base64: base64,
        content_type,
        kind: "product",
      });
      await request<any>(`/companies/${companyId}/products/${product.id}`, {
        method: "PATCH",
        body: { image_url: r.url },
        retry: 0,
        timeout: 12000,
      });
      setLocalImage(r.url);
      onPatched({ image_url: r.url });
      toast.success("Imagem carregada com sucesso");
    } catch (e: any) {
      const status = e?.status ? `[${e.status}] ` : "";
      toast.error(`${status}${e?.data?.error || e?.message || "Falha ao carregar imagem"}`);
    } finally {
      setUploadingImg(false);
    }
  }

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) { toast.error("Nome precisa ter ao menos 2 caracteres"); return; }
    const priceNum = parseFloat(price.replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) { toast.error("Preco invalido"); return; }
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
      toast.success("Alteracoes salvas");
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
    <View style={{ gap: 14 }}>
      {/* Foto do produto */}
      <View style={s.field}>
        <Text style={s.fieldLabel}>Foto do produto</Text>
        <View style={s.imgUploadRow}>
          <View style={s.imgThumbWrap}>
            {localImage ? (
              Platform.OS === "web" ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={localImage} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover" }} />
              ) : (
                <Image source={{ uri: localImage }} style={s.imgThumb} />
              )
            ) : (
              <View style={[s.imgThumb, s.imgThumbEmpty]}>
                <Icon name="image" size={22} color={t.ink4} />
              </View>
            )}
          </View>
          <Pressable
            onPress={uploadImage}
            disabled={uploadingImg || saving}
            style={[s.btnSec, (uploadingImg || saving) && { opacity: 0.5 }]}
          >
            {uploadingImg ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <>
                <Icon name="upload" size={13} color={t.primary} />
                <Text style={s.btnSecTxt}>
                  {localImage ? "Trocar foto" : "Enviar foto"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

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
          <Text style={s.fieldLabel}>Preco (R$)</Text>
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
        <Text style={s.fieldLabel}>Descricao</Text>
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
            <Text style={s.btnPriTxt}>Salvar alteracoes</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 24, paddingBottom: 80, gap: 18, maxWidth: 1440, alignSelf: "center", width: "100%" },

    // CTA primário
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

    // CTA secundário (upload)
    btnSec: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.primarySoft,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.primary,
    },
    btnSecTxt: { color: t.primary, fontSize: 13, fontWeight: "700" },

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
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
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

    // Filtro por categoria (#4)
    categoryRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center",
    },
    catDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

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

    // Expandido
    expandedToolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
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
    backBtnTxt: { fontSize: 12, color: t.ink2, fontWeight: "700" },

    expandedHeader: {
      flexDirection: "row",
      gap: 14,
      padding: 16,
      backgroundColor: t.paperCardElev,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      ...(Platform.OS === "web"
        ? ({ position: "sticky", top: 0, zIndex: 10 } as any)
        : null),
    },
    expandedThumbWrap: { width: 72, height: 72 },
    expandedThumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: t.bgSoft },
    expandedName: { fontSize: 18, color: t.ink, fontWeight: "800", letterSpacing: -0.3 },
    expandedMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    expandedPrice: { fontSize: 14, color: t.ink2, fontWeight: "800" },
    expandedQty: { fontSize: 13, color: t.ink3, fontWeight: "600" },
    expandedChipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },

    // Section card (accordion)
    sectionCard: {
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
      overflow: "hidden",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    sectionIconWrap: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: t.primarySoft,
      alignItems: "center", justifyContent: "center",
    },
    sectionTitle: { fontSize: 15, color: t.ink, fontWeight: "800", letterSpacing: -0.1 },
    sectionHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusChipTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
    sectionBody: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      backgroundColor: t.bg,
    },

    // Form
    field: { gap: 6 },
    fieldLabel: {
      fontSize: 11,
      color: t.ink3,
      fontWeight: "700",
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

    // Upload de imagem
    imgUploadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    imgThumbWrap: { width: 72, height: 72 },
    imgThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: t.bgSoft },
    imgThumbEmpty: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.ink5,
      borderStyle: "dashed" as any,
    },
  });
}
