// ============================================================
// StudioTemplatesPanel — Sprint 3 (26/05/2026)
//
// Aba do drawer Estoque (Studio). Mostra templates da galeria
// vinculados a um produto especifico + permite vincular mais
// reusando a galeria global ja existente.
//
// Regras:
//   - specifically_linked=true  -> badge "Vinculado direto" + botao remover
//   - specifically_linked=false -> badge "Global da loja" (sem remover)
//   - templatesByProduct ja devolve ambos os tipos (union no backend)
//   - Modal "Vincular template" filtra a galeria por categoria e
//     esconde quem ja esta vinculado direto
//
// Props padrao { productId, companyId, productName, onChanged? }
// onChanged informa contagem total apos cada vincular/desvincular.
//
// NOTA (26/05/2026): onChanged guardado em ref pra evitar loop
// infinito quando pai passa arrow inline (recria a cada render).
// loadLinked depende so de companyId/productId.
// ============================================================
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import {
  studioApi,
  type Template,
  type TemplateCategory,
} from "@/services/studioApi";

type Props = {
  productId: string;
  companyId: string;
  productName: string;
  onChanged?: (count: number) => void;
};

type ErrShape = { status?: number; data?: any; message?: string };

function describeError(e: any): string {
  const status = e?.status ?? e?.response?.status ?? 0;
  const data = e?.data ?? e?.response?.data ?? {};
  const msg = data?.error || e?.message || "Erro desconhecido";
  return "[" + status + "] " + msg;
}

export function StudioTemplatesPanel({ productId, companyId, productName, onChanged }: Props) {
  const t = useStudioTokens();
  const router = useRouter();
  const styles = useMemo(() => buildStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);

  // Modal Vincular
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [pickerTemplates, setPickerTemplates] = useState<Template[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Ref pro onChanged — evita loop quando pai passa arrow inline
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  // ── Loader principal ─────────────────────────────────────
  const loadLinked = useCallback(async () => {
    console.log("[StudioTemplatesPanel] loadLinked start", { companyId, productId });
    try {
      const res = await studioApi.templatesByProduct(companyId, productId);
      const list = res?.templates || [];
      setLinked(list);
      console.log("[StudioTemplatesPanel] loadLinked ok", { count: list.length });
      const directCount = list.filter((x) => x.specifically_linked).length;
      onChangedRef.current?.(directCount);
    } catch (e) {
      console.error("[StudioTemplatesPanel] loadLinked error", e);
      toast.error("Falha ao carregar templates: " + describeError(e as ErrShape));
    }
  }, [companyId, productId]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await studioApi.listCategories(companyId);
      const cats = res?.categories || [];
      setCategories(cats);
      console.log("[StudioTemplatesPanel] loadCategories ok", { count: cats.length });
    } catch (e) {
      console.error("[StudioTemplatesPanel] loadCategories error", e);
    }
  }, [companyId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadLinked(), loadCategories()]);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [loadLinked, loadCategories]);

  // ── Picker (modal Vincular) ──────────────────────────────
  const refreshPickerTemplates = useCallback(async (catId: string | null) => {
    setPickerLoading(true);
    try {
      const res = await studioApi.listTemplates(companyId, catId ? { category_id: catId } : undefined);
      const all = res?.templates || [];
      setPickerTemplates(all);
      console.log("[StudioTemplatesPanel] picker templates loaded", { catId, count: all.length });
    } catch (e) {
      console.error("[StudioTemplatesPanel] refreshPickerTemplates error", e);
      toast.error("Falha ao carregar galeria: " + describeError(e as ErrShape));
    } finally {
      setPickerLoading(false);
    }
  }, [companyId]);

  const openPicker = useCallback(async () => {
    console.log("[StudioTemplatesPanel] openPicker");
    setPickerOpen(true);
    setSelectedIds(new Set());
    setPickerCategory(null);
    await refreshPickerTemplates(null);
  }, [refreshPickerTemplates]);

  const handlePickCategory = useCallback(async (catId: string | null) => {
    setPickerCategory(catId);
    await refreshPickerTemplates(catId);
  }, [refreshPickerTemplates]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const closePicker = useCallback(() => {
    if (submitting) return;
    setPickerOpen(false);
    setSelectedIds(new Set());
  }, [submitting]);

  const submitLink = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    console.log("[StudioTemplatesPanel] submitLink start", { ids });
    setSubmitting(true);
    let okCount = 0;
    let failCount = 0;
    for (const tid of ids) {
      try {
        await studioApi.linkTemplate(companyId, productId, tid, 0);
        okCount++;
      } catch (e) {
        failCount++;
        console.error("[StudioTemplatesPanel] linkTemplate error", { tid, err: e });
      }
    }
    setSubmitting(false);
    setPickerOpen(false);
    setSelectedIds(new Set());

    if (failCount > 0) {
      toast.error("Vinculados " + okCount + "/" + ids.length + " (" + failCount + " falharam)");
    } else {
      toast.success("Vinculados " + okCount + " templates a " + productName);
    }
    await loadLinked();
  }, [selectedIds, companyId, productId, productName, loadLinked]);

  const handleUnlink = useCallback(async (tpl: Template) => {
    if (!tpl.specifically_linked) return;
    console.log("[StudioTemplatesPanel] unlink", { id: tpl.id });
    try {
      await studioApi.unlinkTemplate(companyId, productId, tpl.id);
      toast.success("Template removido");
      await loadLinked();
    } catch (e) {
      console.error("[StudioTemplatesPanel] unlink error", e);
      toast.error("Falha ao remover: " + describeError(e as ErrShape));
    }
  }, [companyId, productId, loadLinked]);

  // ── Helpers ───────────────────────────────────────────────
  const directlyLinked = useMemo(() => linked.filter((x) => x.specifically_linked), [linked]);
  const globallyLinked = useMemo(() => linked.filter((x) => !x.specifically_linked), [linked]);

  const alreadyLinkedDirectIds = useMemo(
    () => new Set(directlyLinked.map((x) => x.id)),
    [directlyLinked]
  );

  const pickerVisible = useMemo(
    () => pickerTemplates.filter((p) => !alreadyLinkedDirectIds.has(p.id)),
    [pickerTemplates, alreadyLinkedDirectIds]
  );

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.wrap}>
        <StudioLoading variant="skeleton-cards" rows={4} />
      </View>
    );
  }

  // Empty global: nem vinculados nem genericos disponiveis
  const totalLinked = linked.length;
  const galleryEmptyHint = totalLinked === 0;

  if (galleryEmptyHint) {
    return (
      <View style={styles.wrap}>
        <StudioEmpty
          icon="image"
          title="Galeria vazia"
          desc="Cadastre templates na Galeria primeiro pra vincular ao produto."
          primaryCta={{
            label: "Ir pra Galeria",
            onPress: () => router.push("/studio/galeria"),
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {directlyLinked.length} {directlyLinked.length === 1 ? "template vinculado" : "templates vinculados"}
          </Text>
          {globallyLinked.length > 0 && (
            <Text style={styles.headerSub}>
              + {globallyLinked.length} {globallyLinked.length === 1 ? "global da loja" : "globais da loja"}
            </Text>
          )}
        </View>
        <Pressable onPress={openPicker} style={styles.btnPri}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={styles.btnPriTxt}>Vincular template</Text>
        </Pressable>
      </View>

      {/* Hint quando so tem global */}
      {directlyLinked.length === 0 && globallyLinked.length > 0 && (
        <View style={styles.hintCard}>
          <Icon name="info" size={16} color={t.infoInk} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hintTitle}>Nenhum template vinculado especificamente</Text>
            <Text style={styles.hintDesc}>
              Templates da loja aparecem por padrao. Vincule um especifico pra este produto se quiser destacar.
            </Text>
          </View>
          <Pressable onPress={openPicker} style={styles.btnSecSm}>
            <Text style={styles.btnSecSmTxt}>Vincular</Text>
          </Pressable>
        </View>
      )}

      {/* Grid */}
      <View style={styles.grid}>
        {linked.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            t={t}
            styles={styles}
            onRemove={() => handleUnlink(tpl)}
          />
        ))}
      </View>

      {/* Modal Vincular */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Vincular template</Text>
                <Text style={styles.modalSub}>{productName}</Text>
              </View>
              <Pressable onPress={closePicker} style={styles.modalClose} disabled={submitting}>
                <Icon name="x" size={20} color={t.ink3} />
              </Pressable>
            </View>

            {/* Filtros categoria */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              <CategoryChip
                label="Todas"
                active={!pickerCategory}
                onPress={() => handlePickCategory(null)}
                t={t}
                styles={styles}
              />
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  active={pickerCategory === c.id}
                  onPress={() => handlePickCategory(c.id)}
                  t={t}
                  styles={styles}
                />
              ))}
            </ScrollView>

            {/* Lista picker */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
              {pickerLoading ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={t.primary} />
                </View>
              ) : pickerVisible.length === 0 ? (
                <View style={{ paddingTop: 12 }}>
                  <StudioEmpty
                    icon="image"
                    title="Nenhum template disponivel"
                    desc={
                      pickerCategory
                        ? "Nenhum template nessa categoria. Tente outra ou cadastre novos."
                        : "Todos os templates ja estao vinculados ou a galeria esta vazia."
                    }
                    compact
                  />
                </View>
              ) : (
                <View style={styles.pickerGrid}>
                  {pickerVisible.map((p) => {
                    const isSel = selectedIds.has(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => toggleSelected(p.id)}
                        style={[styles.pickerCard, isSel && styles.pickerCardActive]}
                      >
                        <ThumbBox uri={p.thumb_url || p.image_url} size={88} t={t} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.pickerName} numberOfLines={2}>{p.name}</Text>
                          {p.category_name && (
                            <View style={[
                              styles.catBadge,
                              { backgroundColor: (p.category_color || t.primarySoft) + "33" },
                            ]}>
                              <Text style={[styles.catBadgeTxt, { color: p.category_color || t.primary }]}>
                                {p.category_name}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                          {isSel && <Icon name="check" size={14} color="#fff" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={closePicker}
                style={styles.btnSec}
                disabled={submitting}
              >
                <Text style={styles.btnSecTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={submitLink}
                style={[
                  styles.btnPri,
                  (selectedIds.size === 0 || submitting) && { opacity: 0.5 },
                ]}
                disabled={selectedIds.size === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPriTxt}>
                    Vincular {selectedIds.size > 0 ? selectedIds.size : ""}
                    {selectedIds.size > 0 && (selectedIds.size === 1 ? " selecionado" : " selecionados")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Subcomponentes ───────────────────────────────────────────

function TemplateCard({
  tpl,
  t,
  styles,
  onRemove,
}: {
  tpl: Template;
  t: any;
  styles: any;
  onRemove: () => void;
}) {
  const isDirect = !!tpl.specifically_linked;
  const badgeBg = isDirect ? t.successSoft : t.infoSoft;
  const badgeFg = isDirect ? t.successInk : t.infoInk;
  return (
    <View style={styles.card}>
      <ThumbBox uri={tpl.thumb_url || tpl.image_url} size={100} t={t} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.cardName} numberOfLines={2}>{tpl.name}</Text>
        {tpl.category_name && (
          <View style={[
            styles.catBadge,
            { backgroundColor: (tpl.category_color || t.primarySoft) + "33" },
          ]}>
            <Text style={[styles.catBadgeTxt, { color: tpl.category_color || t.primary }]}>
              {tpl.category_name}
            </Text>
          </View>
        )}
        <View style={[styles.statusChip, { backgroundColor: badgeBg }]}>
          <Text style={[styles.statusChipTxt, { color: badgeFg }]}>
            {isDirect ? "Vinculado direto" : "Global da loja"}
          </Text>
        </View>
      </View>
      {isDirect && (
        <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Icon name="trash-2" size={16} color={t.danger} />
        </Pressable>
      )}
    </View>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
  color,
  t,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string | null;
  t: any;
  styles: any;
}) {
  const tint = color || t.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.catChip,
        active && { backgroundColor: tint, borderColor: tint },
      ]}
    >
      <Text style={[styles.catChipTxt, active && { color: "#fff" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ThumbBox({ uri, size, t }: { uri: string | null; size: number; t: any }) {
  if (!uri) {
    return (
      <View style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: t.bgSoft,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Icon name="image" size={20} color={t.ink4} />
      </View>
    );
  }
  if (Platform.OS === "web") {
    return (
      <View
        // @ts-expect-error img tag on web
        accessible={false}
        style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", backgroundColor: t.bgSoft }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uri}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 12, backgroundColor: t.bgSoft }}
      resizeMode="cover"
    />
  );
}

// ── Styles ───────────────────────────────────────────────────

function buildStyles(t: any) {
  return StyleSheet.create({
    wrap: {
      gap: 14,
      paddingVertical: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.2,
    },
    headerSub: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 2,
    },
    btnPri: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    btnPriTxt: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
    },
    btnSec: {
      backgroundColor: "#fff",
      borderWidth: 1.5,
      borderColor: t.ink5,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    btnSecTxt: {
      color: t.ink2,
      fontSize: 13,
      fontWeight: "700",
    },
    btnSecSm: {
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: t.ink5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    btnSecSmTxt: {
      color: t.ink2,
      fontSize: 12,
      fontWeight: "700",
    },
    hintCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.infoSoft,
      borderColor: t.info,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    hintTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
    },
    hintDesc: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 2,
      lineHeight: 16,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      width: 280,
      flexDirection: "row",
      gap: 12,
      padding: 12,
      backgroundColor: t.paperCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    cardName: {
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
    },
    catBadge: {
      alignSelf: "flex-start",
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    catBadgeTxt: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    statusChip: {
      alignSelf: "flex-start",
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    statusChipTxt: {
      fontSize: 11,
      fontWeight: "700",
    },
    removeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: t.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15,23,42,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: t.paperCardElev,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "92%",
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 14,
      gap: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.3,
    },
    modalSub: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 2,
    },
    modalClose: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: t.bgSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    catRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
    },
    catChip: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: t.ink5,
    },
    catChipTxt: {
      fontSize: 12,
      fontWeight: "700",
      color: t.ink2,
    },
    pickerGrid: {
      gap: 10,
      paddingTop: 4,
    },
    pickerCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: t.paperCard,
    },
    pickerCardActive: {
      borderColor: t.primary,
      backgroundColor: t.primarySoft,
    },
    pickerName: {
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.ink5,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    modalFooter: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "flex-end",
      borderTopWidth: 1,
      borderTopColor: t.ink5,
      paddingTop: 12,
    },
  });
}

export default StudioTemplatesPanel;
