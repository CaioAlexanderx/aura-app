import { useMemo, useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

type FieldType = "text" | "image" | "template" | "color" | "option" | string;

type CustomizationField = {
  type?: FieldType;
  label?: string;
  required?: boolean;
};

type PrintArea = {
  width_cm?: number;
  height_cm?: number;
  position?: string;
};

type CustomizationConfig = {
  print_area?: PrintArea;
  fields?: CustomizationField[];
} | null;

type ProductRow = {
  id: string;
  name: string;
  price: number;
  is_personalizable?: boolean;
  customization_config?: CustomizationConfig;
  image_url?: string | null;
  category_name?: string | null;
  studio_storefront_visible?: boolean;
};

function formatBRL(value: number) {
  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  template: "Template",
  color: "Cor",
  option: "Opção",
};

function fieldTypeLabel(t?: string) {
  if (!t) return "Campo";
  return FIELD_TYPE_LABELS[t] || t;
}

export function TabStudioConfigurador() {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // Use the Studio-specific endpoint — the generic /products endpoint filters
      // by vertical=varejo internally and returns an empty list for Studio accounts.
      const r: any = await request(`/companies/${company.id}/studio/products?include_non_personalizable=true&limit=500`, {
        method: "GET",
        retry: 1,
        timeout: 15000,
      });
      const list: ProductRow[] = Array.isArray(r) ? r : (r?.products || r?.items || []);
      setProducts(
        list
          .filter((p) => !!p?.is_personalizable)
          .map((p) => ({ ...p, studio_storefront_visible: p.studio_storefront_visible !== false })),
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Visibilidade na Loja Virtual (toggle por item) ────
  // Espelha o Estoque Studio: otimista + rollback, persiste via PATCH /products.
  const toggleStorefrontVisible = useCallback(
    async (productId: string, next: boolean) => {
      if (!company?.id) return;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, studio_storefront_visible: next } : p)),
      );
      try {
        await request<any>(`/companies/${company.id}/products/${productId}`, {
          method: "PATCH",
          body: { studio_storefront_visible: next },
          retry: 0,
          timeout: 10000,
        });
        toast.success(next ? "Item visível na Loja Virtual" : "Item oculto da Loja Virtual");
      } catch (e: any) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, studio_storefront_visible: !next } : p)),
        );
        const status = e?.status ? `[${e.status}] ` : "";
        toast.error(`${status}${e?.data?.error || e?.message || "Erro ao atualizar visibilidade"}`);
      }
    },
    [company?.id],
  );

  const goEdit = useCallback(() => {
    router.push("/studio/produtos");
  }, [router]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={styles.loadingText}>Carregando produtos personalizáveis…</Text>
      </View>
    );
  }

  if (!products.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Icon name="sparkles" size={32} color={t.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhum produto personalizável</Text>
        <Text style={styles.emptySubtitle}>
          Marque produtos como personalizáveis no catálogo para que apareçam aqui e na sua Loja Digital com o configurador Studio.
        </Text>
        <Pressable onPress={goEdit} style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
          <Icon name="add" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Marcar produtos como personalizáveis</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Produtos personalizáveis na sua Loja Digital</Text>
          <Text style={styles.headerSubtitle}>
            {products.length} {products.length === 1 ? "produto" : "produtos"} disponível{products.length === 1 ? "" : "is"} para o configurador
          </Text>
        </View>
        <Pressable onPress={goEdit} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}>
          <Icon name="settings" size={16} color={t.primary} />
          <Text style={styles.secondaryBtnText}>Gerenciar catálogo</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {products.map((p) => {
          const cfg = p.customization_config || {};
          const print = cfg.print_area || {};
          const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
          const w = typeof print.width_cm === "number" ? print.width_cm : null;
          const h = typeof print.height_cm === "number" ? print.height_cm : null;
          const pos = print.position || null;
          const hidden = p.studio_storefront_visible === false;

          return (
            <View key={p.id} style={[styles.card, hidden && styles.cardHidden]}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.cardPrice}>{formatBRL(Number(p.price) || 0)}</Text>
                  {hidden ? (
                    <View style={styles.hiddenChip}>
                      <Icon name="eye_off" size={10} color={t.ink3} />
                      <Text style={styles.hiddenChipText}>Oculto na loja</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.headRight}>
                  <View style={styles.badge}>
                    <Icon name="sparkles" size={12} color={t.primary} />
                    <Text style={styles.badgeText}>Personalizável</Text>
                  </View>
                  <Pressable
                    onPress={() => toggleStorefrontVisible(p.id, hidden)}
                    hitSlop={8}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={hidden ? "Mostrar na Loja Virtual" : "Ocultar da Loja Virtual"}
                  >
                    <Icon name={hidden ? "eye_off" : "eye"} size={18} color={hidden ? t.ink4 : t.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Área de impressão</Text>
                {w && h ? (
                  <View style={styles.printRow}>
                    <View style={styles.printChip}>
                      <Icon name="resize" size={12} color={t.primary} />
                      <Text style={styles.printChipText}>{w} × {h} cm</Text>
                    </View>
                    {pos ? (
                      <View style={styles.printChip}>
                        <Icon name="location" size={12} color={t.primary} />
                        <Text style={styles.printChipText}>{pos}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.muted}>Não configurada</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Campos {fields.length ? `(${fields.length})` : ""}
                </Text>
                {fields.length ? (
                  <View style={styles.chipsWrap}>
                    {fields.slice(0, 6).map((f, idx) => (
                      <View key={idx} style={styles.chip}>
                        <Text style={styles.chipText}>{fieldTypeLabel(f?.type)}</Text>
                      </View>
                    ))}
                    {fields.length > 6 ? (
                      <View style={[styles.chip, styles.chipMore]}>
                        <Text style={styles.chipText}>+{fields.length - 6}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.muted}>Nenhum campo configurado</Text>
                )}
              </View>

              <View style={styles.visRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.visLabel}>Mostrar na Loja Virtual</Text>
                  <Text style={styles.visHint}>
                    {hidden
                      ? "Oculto: não aparece na vitrine pública."
                      : "Visível: aparece na vitrine pública pros clientes."}
                  </Text>
                </View>
                <Switch
                  value={!hidden}
                  onValueChange={(v) => toggleStorefrontVisible(p.id, v)}
                  trackColor={{ true: t.primary, false: t.ink5 }}
                  thumbColor="#fff"
                />
              </View>

              <Pressable
                onPress={goEdit}
                style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
              >
                <Icon name="create" size={16} color="#fff" />
                <Text style={styles.editBtnText}>Editar configuração</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 16,
  },
  loadingWrap: {
    paddingVertical: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: t.ink3,
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: t.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: t.ink3,
    textAlign: "center",
    maxWidth: 480,
    lineHeight: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: t.ink,
  },
  headerSubtitle: {
    fontSize: 13,
    color: t.ink3,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: 320,
    maxWidth: 480,
    backgroundColor: t.paperCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.ink5,
    padding: 16,
    gap: 12,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: t.ink,
  },
  cardPrice: {
    fontSize: 13,
    color: t.ink3,
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: t.primary,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: t.ink3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  printRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  printChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  printChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: t.primary,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  chipMore: {
    backgroundColor: "transparent",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: t.primary,
  },
  muted: {
    fontSize: 12,
    color: t.ink3,
    fontStyle: "italic",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.primary,
    marginTop: 4,
  },
  editBtnPressed: {
    opacity: 0.85,
  },
  editBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: t.primary,
    marginTop: 8,
  },
  primaryBtnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: t.primaryGhost,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  secondaryBtnPressed: {
    opacity: 0.85,
  },
  secondaryBtnText: {
    color: t.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  cardHidden: {
    opacity: 0.6,
  },
  headRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  eyeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  hiddenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: t.bgSoft,
  },
  hiddenChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: t.ink3,
  },
  visRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: t.ink5,
  },
  visLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink,
  },
  visHint: {
    fontSize: 11,
    color: t.ink3,
    lineHeight: 15,
  },
});
