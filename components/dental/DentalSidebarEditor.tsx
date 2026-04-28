import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Modal, Platform } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  useDentalSidebarLayout,
  mergeLayoutWithCurrentDental,
  type DentalSidebarLayoutItem,
  type DentalNavSection,
} from "@/hooks/useDentalSidebarLayout";

// ============================================================
// DentalSidebarEditor — modal de reorder/hide pros items da sidebar
// dental. Equivalente ao SidebarEditor do Aura Negocio mas com cyan
// e backed por localStorage (useDentalSidebarLayout).
// ============================================================

const isWeb = Platform.OS === "web";

interface Props {
  visible: boolean;
  onClose: () => void;
  baseNav: DentalNavSection[]; // nav original (sem aplicar custom)
}

export function DentalSidebarEditor({ visible, onClose, baseNav }: Props) {
  const { layout, save } = useDentalSidebarLayout();
  const [items, setItems] = useState<DentalSidebarLayoutItem[]>([]);
  const [moveTargetIdx, setMoveTargetIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    for (const sec of baseNav) set.add(sec.label);
    for (const it of items) set.add(it.section);
    return Array.from(set);
  }, [baseNav, items]);

  const itemMeta = useMemo(() => {
    const m = new Map<string, { label: string; icon: string }>();
    for (const sec of baseNav) {
      for (const it of sec.items) m.set(it.route, { label: it.label, icon: it.icon });
    }
    return m;
  }, [baseNav]);

  useEffect(() => {
    if (!visible) return;
    setItems(mergeLayoutWithCurrentDental(layout, baseNav));
    setMoveTargetIdx(null);
  }, [visible, layout, baseNav]);

  const itemsBySection = useMemo(() => {
    const grouped: Record<string, Array<{ item: DentalSidebarLayoutItem; globalIdx: number }>> = {};
    const order: string[] = [];
    items.forEach((it, idx) => {
      if (!grouped[it.section]) {
        grouped[it.section] = [];
        order.push(it.section);
      }
      grouped[it.section].push({ item: it, globalIdx: idx });
    });
    return { grouped, order };
  }, [items]);

  function moveUp(globalIdx: number) {
    if (globalIdx === 0) return;
    const copy = [...items];
    [copy[globalIdx - 1], copy[globalIdx]] = [copy[globalIdx], copy[globalIdx - 1]];
    setItems(copy);
  }
  function moveDown(globalIdx: number) {
    if (globalIdx >= items.length - 1) return;
    const copy = [...items];
    [copy[globalIdx], copy[globalIdx + 1]] = [copy[globalIdx + 1], copy[globalIdx]];
    setItems(copy);
  }
  function toggleHidden(globalIdx: number) {
    const copy = [...items];
    copy[globalIdx] = { ...copy[globalIdx], hidden: !copy[globalIdx].hidden };
    setItems(copy);
  }
  function moveToSection(globalIdx: number, newSection: string) {
    const copy = [...items];
    copy[globalIdx] = { ...copy[globalIdx], section: newSection };
    setItems(copy);
    setMoveTargetIdx(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ version: 1, items });
      toast.success("Menu personalizado salvo");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await save(null);
      toast.success("Menu restaurado ao padrao");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao restaurar");
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Personalizar menu</Text>
              <Text style={s.subtitle}>Reordene com as setas, esconda o que nao usa, ou mova entre secoes</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}><Icon name="x" size={18} color={DentalColors.ink3} /></Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {itemsBySection.order.map((sectionName) => {
              const sectionItems = itemsBySection.grouped[sectionName];
              return (
                <View key={sectionName} style={s.sectionBlock}>
                  <Text style={s.sectionLabel}>{sectionName.toUpperCase()}</Text>
                  {sectionItems.map((entry) => {
                    const meta = itemMeta.get(entry.item.key) || { label: entry.item.key, icon: "menu" };
                    const isFirst = entry.globalIdx === 0;
                    const isLast = entry.globalIdx === items.length - 1;
                    const isMoving = moveTargetIdx === entry.globalIdx;
                    return (
                      <View key={entry.item.key} style={[s.itemRow, entry.item.hidden && s.itemRowHidden]}>
                        <View style={s.arrows}>
                          <Pressable onPress={() => moveUp(entry.globalIdx)} disabled={isFirst} style={[s.arrowBtn, isFirst && s.arrowBtnDisabled]}>
                            <Icon name="chevron_up" size={14} color={isFirst ? DentalColors.ink3 + "55" : DentalColors.ink} />
                          </Pressable>
                          <Pressable onPress={() => moveDown(entry.globalIdx)} disabled={isLast} style={[s.arrowBtn, isLast && s.arrowBtnDisabled]}>
                            <Icon name="chevron_down" size={14} color={isLast ? DentalColors.ink3 + "55" : DentalColors.ink} />
                          </Pressable>
                        </View>
                        <View style={s.itemIcon}>
                          <Icon name={meta.icon as any} size={14} color={entry.item.hidden ? DentalColors.ink3 + "88" : DentalColors.cyan} />
                        </View>
                        <Text style={[s.itemLabel, entry.item.hidden && s.itemLabelHidden]} numberOfLines={1}>
                          {meta.label}
                        </Text>
                        <Pressable
                          onPress={() => setMoveTargetIdx(isMoving ? null : entry.globalIdx)}
                          style={[s.actionBtn, isMoving && s.actionBtnActive]}
                          {...(isWeb ? { title: "Mover para outra secao" } : {})}
                        >
                          <Icon name="grid" size={12} color={isMoving ? DentalColors.cyan : DentalColors.ink3} />
                        </Pressable>
                        <Switch
                          value={!entry.item.hidden}
                          trackColor={{ false: "rgba(255,255,255,0.12)", true: DentalColors.cyan + "66" }}
                          thumbColor={!entry.item.hidden ? DentalColors.cyan : DentalColors.ink3}
                          onValueChange={() => toggleHidden(entry.globalIdx)}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {moveTargetIdx !== null && items[moveTargetIdx] && (
              <View style={s.movePopover}>
                <Text style={s.moveTitle}>Mover "{itemMeta.get(items[moveTargetIdx].key)?.label}" para:</Text>
                <View style={s.moveOptions}>
                  {availableSections.map((sec) => {
                    const current = items[moveTargetIdx!].section === sec;
                    return (
                      <Pressable
                        key={sec}
                        onPress={() => moveToSection(moveTargetIdx!, sec)}
                        disabled={current}
                        style={[s.moveOption, current && s.moveOptionActive]}
                      >
                        <Text style={[s.moveOptionText, current && { color: DentalColors.cyan }]}>{sec}</Text>
                        {current && <Text style={s.moveOptionMeta}>atual</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={handleReset} disabled={saving} style={s.resetBtn}>
              <Icon name="refresh" size={12} color={DentalColors.ink3} />
              <Text style={s.resetText}>Restaurar padrao</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} disabled={saving} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={s.saveBtn}>
              <Text style={s.saveText}>{saving ? "Salvando..." : "Salvar"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 520, backgroundColor: DentalColors.bg2, borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: DentalColors.border, gap: 12 },
  title: { fontSize: 16, fontWeight: "800", color: DentalColors.ink },
  subtitle: { fontSize: 11, color: DentalColors.ink3, marginTop: 4, lineHeight: 15 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  sectionBlock: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 },
  sectionLabel: { fontSize: 9, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 4 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 4, borderWidth: 1, borderColor: DentalColors.border,
  },
  itemRowHidden: { opacity: 0.55 },
  arrows: { flexDirection: "column", gap: 2 },
  arrowBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  arrowBtnDisabled: { opacity: 0.4 },
  itemIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: DentalColors.cyanDim, alignItems: "center", justifyContent: "center" },
  itemLabel: { flex: 1, fontSize: 13, color: DentalColors.ink, fontWeight: "600" },
  itemLabelHidden: { color: DentalColors.ink3, textDecorationLine: "line-through" },
  actionBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  actionBtnActive: { backgroundColor: DentalColors.cyanDim, borderWidth: 1, borderColor: DentalColors.cyanBorder },
  movePopover: { margin: 14, padding: 14, backgroundColor: DentalColors.cyanDim, borderRadius: 12, borderWidth: 1, borderColor: DentalColors.cyanBorder },
  moveTitle: { fontSize: 12, color: DentalColors.ink, fontWeight: "700", marginBottom: 10 },
  moveOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  moveOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: DentalColors.border, flexDirection: "row", alignItems: "center", gap: 6 },
  moveOptionActive: { backgroundColor: DentalColors.cyan + "18", borderColor: DentalColors.cyan },
  moveOptionText: { fontSize: 11, color: DentalColors.ink, fontWeight: "600" },
  moveOptionMeta: { fontSize: 9, color: DentalColors.cyan, fontWeight: "700", textTransform: "uppercase" },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: DentalColors.border },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: DentalColors.border },
  resetText: { fontSize: 11, color: DentalColors.ink3, fontWeight: "600" },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  cancelText: { fontSize: 12, color: DentalColors.ink3, fontWeight: "600" },
  saveBtn: { minWidth: 90, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: DentalColors.cyan, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default DentalSidebarEditor;
