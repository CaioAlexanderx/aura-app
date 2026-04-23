import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, ActivityIndicator, Modal, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  useSidebarLayout,
  mergeLayoutWithCurrent,
  type NavSection,
} from "@/hooks/useSidebarLayout";
import type { SidebarLayoutItem } from "@/services/api";

// ============================================================
// AURA. — Editor de Sidebar (modal)
//
// Permite cliente customizar a sidebar:
//  ⬆⬇ reordenar (setas, funciona desktop + mobile)
//  👁 esconder/mostrar items individuais
//  📁 mover entre secoes (escolher de dropdown)
//  ↺ restaurar padrao do sistema
//
// Persiste no backend (/auth/sidebar-layout) via useSidebarLayout.
// ============================================================

var isWeb = Platform.OS === "web";

type Props = {
  visible: boolean;
  onClose: () => void;
  // baseNav = NAV ja filtrado por plano/staff/vertical, do _layout.tsx.
  // Vamos usar como referencia pra mostrar items disponiveis no editor.
  baseNav: NavSection[];
};

export function SidebarEditor({ visible, onClose, baseNav }: Props) {
  var { layout, save, isSaving } = useSidebarLayout();
  var [items, setItems] = useState<SidebarLayoutItem[]>([]);
  var [moveTargetIdx, setMoveTargetIdx] = useState<number | null>(null);

  // Lista de secoes disponiveis (do nav padrao + secoes ja existentes no layout)
  var availableSections = useMemo(function() {
    var s = new Set<string>();
    for (var i = 0; i < baseNav.length; i++) s.add(baseNav[i].s);
    for (var k = 0; k < items.length; k++) s.add(items[k].section);
    return Array.from(s);
  }, [baseNav, items]);

  // Mapa: route -> { label, icon } pro editor renderizar
  var itemMeta = useMemo(function() {
    var m = new Map<string, { label: string; icon: string }>();
    for (var i = 0; i < baseNav.length; i++) {
      for (var j = 0; j < baseNav[i].i.length; j++) {
        var it = baseNav[i].i[j];
        m.set(it.r, { label: it.l, icon: it.ic });
      }
    }
    return m;
  }, [baseNav]);

  // Inicializa items ao abrir o modal
  useEffect(function() {
    if (!visible) return;
    setItems(mergeLayoutWithCurrent(layout, baseNav));
    setMoveTargetIdx(null);
  }, [visible, layout, baseNav]);

  // Agrupa items por secao mantendo a ordem global
  var itemsBySection = useMemo(function() {
    var grouped: Record<string, Array<{ item: SidebarLayoutItem; globalIdx: number }>> = {};
    var sectionOrder: string[] = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!grouped[it.section]) {
        grouped[it.section] = [];
        sectionOrder.push(it.section);
      }
      grouped[it.section].push({ item: it, globalIdx: i });
    }
    return { grouped: grouped, sectionOrder: sectionOrder };
  }, [items]);

  function moveUp(globalIdx: number) {
    if (globalIdx === 0) return;
    var copy = [...items];
    var tmp = copy[globalIdx];
    copy[globalIdx] = copy[globalIdx - 1];
    copy[globalIdx - 1] = tmp;
    setItems(copy);
  }

  function moveDown(globalIdx: number) {
    if (globalIdx >= items.length - 1) return;
    var copy = [...items];
    var tmp = copy[globalIdx];
    copy[globalIdx] = copy[globalIdx + 1];
    copy[globalIdx + 1] = tmp;
    setItems(copy);
  }

  function toggleHidden(globalIdx: number) {
    var copy = [...items];
    copy[globalIdx] = { ...copy[globalIdx], hidden: !copy[globalIdx].hidden };
    setItems(copy);
  }

  function moveToSection(globalIdx: number, newSection: string) {
    var copy = [...items];
    copy[globalIdx] = { ...copy[globalIdx], section: newSection };
    setItems(copy);
    setMoveTargetIdx(null);
  }

  async function handleSave() {
    try {
      await save({ version: 1, items: items });
      toast.success("Menu personalizado salvo");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao salvar");
    }
  }

  async function handleReset() {
    try {
      await save(null);
      toast.success("Menu restaurado ao padrao");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "Erro ao restaurar");
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Personalizar menu</Text>
              <Text style={s.subtitle}>Reordene com as setas, esconda o que nao usa, ou mova entre secoes</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}><Icon name="x" size={18} color={Colors.ink3} /></Pressable>
          </View>

          {/* Lista editavel */}
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {itemsBySection.sectionOrder.map(function(sectionName) {
              var sectionItems = itemsBySection.grouped[sectionName];
              return (
                <View key={sectionName} style={s.sectionBlock}>
                  <Text style={s.sectionLabel}>{sectionName.toUpperCase()}</Text>
                  {sectionItems.map(function(entry) {
                    var meta = itemMeta.get(entry.item.key) || { label: entry.item.key, icon: "menu" };
                    var isFirst = entry.globalIdx === 0;
                    var isLast = entry.globalIdx === items.length - 1;
                    var isMoving = moveTargetIdx === entry.globalIdx;
                    return (
                      <View key={entry.item.key} style={[s.itemRow, entry.item.hidden && s.itemRowHidden]}>
                        {/* Setas de reordenacao */}
                        <View style={s.arrows}>
                          <Pressable
                            onPress={function() { moveUp(entry.globalIdx); }}
                            disabled={isFirst}
                            style={[s.arrowBtn, isFirst && s.arrowBtnDisabled]}
                          >
                            <Icon name="chevron_up" size={14} color={isFirst ? Colors.ink3 + "55" : Colors.ink} />
                          </Pressable>
                          <Pressable
                            onPress={function() { moveDown(entry.globalIdx); }}
                            disabled={isLast}
                            style={[s.arrowBtn, isLast && s.arrowBtnDisabled]}
                          >
                            <Icon name="chevron_down" size={14} color={isLast ? Colors.ink3 + "55" : Colors.ink} />
                          </Pressable>
                        </View>

                        {/* Icone + Label */}
                        <View style={s.itemIcon}>
                          <Icon name={meta.icon as any} size={14} color={entry.item.hidden ? Colors.ink3 + "88" : Colors.violet3} />
                        </View>
                        <Text style={[s.itemLabel, entry.item.hidden && s.itemLabelHidden]} numberOfLines={1}>
                          {meta.label}
                        </Text>

                        {/* Botao "mover para outra secao" */}
                        <Pressable
                          onPress={function() { setMoveTargetIdx(isMoving ? null : entry.globalIdx); }}
                          style={[s.actionBtn, isMoving && s.actionBtnActive]}
                          {...(isWeb ? { title: "Mover para outra secao" } : {})}
                        >
                          <Icon name="grid" size={12} color={isMoving ? Colors.violet3 : Colors.ink3} />
                        </Pressable>

                        {/* Toggle visibilidade */}
                        <Switch
                          value={!entry.item.hidden}
                          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
                          thumbColor={!entry.item.hidden ? Colors.violet : Colors.ink3}
                          onValueChange={function() { toggleHidden(entry.globalIdx); }}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Popover de "mover para secao" — aparece quando moveTargetIdx != null */}
            {moveTargetIdx !== null && items[moveTargetIdx] && (
              <View style={s.movePopover}>
                <Text style={s.moveTitle}>Mover "{itemMeta.get(items[moveTargetIdx].key)?.label}" para:</Text>
                <View style={s.moveOptions}>
                  {availableSections.map(function(sec) {
                    var current = items[moveTargetIdx!].section === sec;
                    return (
                      <Pressable
                        key={sec}
                        onPress={function() { moveToSection(moveTargetIdx!, sec); }}
                        disabled={current}
                        style={[s.moveOption, current && s.moveOptionActive]}
                      >
                        <Text style={[s.moveOptionText, current && { color: Colors.violet3 }]}>{sec}</Text>
                        {current && <Text style={s.moveOptionMeta}>atual</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Pressable onPress={handleReset} disabled={isSaving} style={s.resetBtn}>
              <Icon name="refresh" size={12} color={Colors.ink3} />
              <Text style={s.resetText}>Restaurar padrao</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} disabled={isSaving} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={isSaving} style={s.saveBtn}>
              {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Salvar</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

var s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: Colors.bg2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  title: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 4, lineHeight: 15 },
  closeBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  sectionBlock: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 },
  sectionLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg3,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemRowHidden: { opacity: 0.55 },
  arrows: { flexDirection: "column", gap: 2 },
  arrowBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  arrowBtnDisabled: { opacity: 0.4 },
  itemIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  itemLabel: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemLabelHidden: { color: Colors.ink3, textDecorationLine: "line-through" },
  actionBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  actionBtnActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  movePopover: {
    margin: 14,
    padding: 14,
    backgroundColor: Colors.violetD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  moveTitle: { fontSize: 12, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  moveOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  moveOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  moveOptionActive: { backgroundColor: Colors.violet + "18", borderColor: Colors.violet },
  moveOptionText: { fontSize: 11, color: Colors.ink, fontWeight: "600" },
  moveOptionMeta: { fontSize: 9, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  cancelText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  saveBtn: {
    minWidth: 90,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});

export default SidebarEditor;
