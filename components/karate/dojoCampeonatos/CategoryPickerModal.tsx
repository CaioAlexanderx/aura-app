// ============================================================
// AURA DOJÔ — Campeonatos: seletor de CATEGORIAS (modal)
//
// Reutilizado pelo carrinho da delegação em dois modos:
//   mode="individual" → categorias de prova individual (atleta)
//   mode="team"       → categorias de equipe (team_kata/team_kumite)
//
// Agrupa por divisão (Principal / Aspirantes) e mostra grupo, faixa
// etária, sexo e corte de graduação — os metadados que o técnico usa
// para decidir. Seleção múltipla; confirmação devolve os ids.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import {
  EnrollmentCategory, MODALITY_LABEL, isTeamModality,
} from "@/services/karateDelegationsApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  categories: EnrollmentCategory[];
  mode: "individual" | "team";
  initialSelected: string[];
  onConfirm: (categoryIds: string[]) => void;
}

const SEX_LABEL: Record<EnrollmentCategory["sex"], string> = { M: "Masc", F: "Fem", mixed: "Misto" };

function categoryMeta(cat: EnrollmentCategory): string {
  const parts: string[] = [MODALITY_LABEL[cat.modality]];
  if (cat.min_age != null || cat.max_age != null) {
    if (cat.min_age != null && cat.max_age != null) parts.push(`${cat.min_age}–${cat.max_age} anos`);
    else if (cat.max_age != null) parts.push(`até ${cat.max_age} anos`);
    else parts.push(`${cat.min_age}+ anos`);
  }
  parts.push(SEX_LABEL[cat.sex]);
  if (cat.belt_min || cat.belt_max) {
    if (cat.belt_min && cat.belt_max) parts.push(`${cat.belt_min}–${cat.belt_max}`);
    else if (cat.belt_min) parts.push(`a partir de ${cat.belt_min}`);
    else parts.push(`até ${cat.belt_max}`);
  }
  return parts.join(" · ");
}

export function CategoryPickerModal({
  visible, onClose, title, subtitle, categories, mode, initialSelected, onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  useEffect(() => {
    if (visible) setSelected(new Set(initialSelected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const eligible = useMemo(
    () => categories.filter((c) => (mode === "team" ? isTeamModality(c.modality) : !isTeamModality(c.modality))),
    [categories, mode]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" size={20} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: 14, gap: 6 }}>
            {eligible.length === 0 ? (
              <Text style={s.empty}>
                {mode === "team"
                  ? "Este campeonato não tem categorias de equipe."
                  : "Este campeonato não tem categorias individuais."}
              </Text>
            ) : (
              eligible.map((cat) => {
                const on = selected.has(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.catRow, on && s.catRowOn]}
                    onPress={() => toggle(cat.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={[s.check, on && s.checkOn]}>
                      {on ? <Icon name="check" size={12} color="#fdf8f2" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={s.catName}>{cat.name}</Text>
                        {cat.group_label ? (
                          <View style={s.groupChip}><Text style={s.groupChipTxt}>{cat.group_label}</Text></View>
                        ) : null}
                      </View>
                      <Text style={s.catMeta}>{categoryMeta(cat)}</Text>
                    </View>
                    <Text style={s.catCount}>{cat.entry_count} inscritos</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={s.footer}>
            <Text style={s.footerCount}>
              {selected.size} categoria{selected.size === 1 ? "" : "s"} selecionada{selected.size === 1 ? "" : "s"}
            </Text>
            <KarateButton
              label="Confirmar"
              variant="sumi"
              size="md"
              onPress={() => { onConfirm([...selected]); onClose(); }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 560, backgroundColor: C.surface, borderRadius: R.xl, overflow: "hidden", borderWidth: 1, borderColor: C.border2, maxHeight: "92%" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 17, color: C.ink } as TextStyle,
  subtitle: { fontSize: 12, color: C.ink3, marginTop: 1 } as TextStyle,
  empty: { fontSize: 13, color: C.ink3, textAlign: "center", paddingVertical: 24 } as TextStyle,
  divisionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, backgroundColor: C.surface } as ViewStyle,
  catRowOn: { borderColor: C.primaryLine, backgroundColor: C.primarySoft } as ViewStyle,
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border2, alignItems: "center", justifyContent: "center", backgroundColor: C.surface } as ViewStyle,
  checkOn: { backgroundColor: C.primary, borderColor: C.primary } as ViewStyle,
  catName: { fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  groupChip: { borderRadius: 999, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 7, paddingVertical: 1 } as ViewStyle,
  groupChipTxt: { fontSize: 10, fontWeight: "700", color: C.ink2 } as TextStyle,
  catMeta: { fontSize: 11.5, color: C.ink3, marginTop: 1 } as TextStyle,
  catCount: { fontSize: 11, color: C.ink3 } as TextStyle,
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 13, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
  footerCount: { fontSize: 12.5, color: C.ink2 } as TextStyle,
});
