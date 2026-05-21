// ─── SaveViewModal ───────────────────────────────────────────────────────────
// Modal pra salvar os filtros atuais como uma nova lente (saved view).
// Tambem aceita editar via prop `editView` (opcional).
// ============================================================================

import { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ScrollView, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { LeadView } from "@/services/crmApi";
import type { LeadListFilters } from "../shared/types";
import { localToViewFilters } from "../shared/types";

const COLOR_PRESETS = [
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#eab308", // amarelo
  "#10b981", // verde
  "#0891b2", // ciano
  "#3b82f6", // azul
  "#a855f7", // roxo
  "#ec4899", // rosa
];

const ICON_PRESETS = [
  "calendar", "flame", "alert", "users",
  "phone", "star", "filter", "trending-up",
];

type Props = {
  visible: boolean;
  onClose: () => void;
  filters: LeadListFilters;
  activeFilterCount: number;
  editView?: LeadView | null;
  onSave: (body: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    is_pinned?: boolean;
    filters: Record<string, any>;
  }) => Promise<any> | void;
  isSaving?: boolean;
};

export function SaveViewModal({
  visible, onClose, filters, activeFilterCount, editView, onSave, isSaving,
}: Props) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon]               = useState<string>("filter");
  const [color, setColor]             = useState<string>(COLOR_PRESETS[0]);
  const [isPinned, setIsPinned]       = useState(true);

  // Reset / preenche ao abrir
  useEffect(() => {
    if (!visible) return;
    if (editView) {
      setName(editView.name);
      setDescription(editView.description || "");
      setIcon(editView.icon || "filter");
      setColor(editView.color || COLOR_PRESETS[0]);
      setIsPinned(editView.is_pinned);
    } else {
      setName("");
      setDescription("");
      setIcon("filter");
      setColor(COLOR_PRESETS[0]);
      setIsPinned(true);
    }
  }, [visible, editView]);

  async function handleSave() {
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      color,
      is_pinned: isPinned,
      // Em edicao, se a view e system, o backend ignora filters; envia mesmo assim
      // pq pra editView !system o usuario pode estar atualizando o snapshot.
      filters: editView ? (editView.filters || {}) : localToViewFilters(filters),
    });
  }

  const isEdit = !!editView;
  const isSystem = !!editView?.is_system;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.modal} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{isEdit ? "Editar lente" : "Salvar como lente"}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={18} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 500 }}>
            {isSystem && (
              <View style={s.systemBanner}>
                <Icon name="info" size={12} color={Colors.amber} />
                <Text style={s.systemBannerText}>
                  Esta e uma lente do sistema. So pode editar fixacao e ordem.
                </Text>
              </View>
            )}

            {/* Nome */}
            <Text style={s.fieldLabel}>Nome</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Reativacao Q3"
              placeholderTextColor={Colors.ink3}
              style={s.input}
              editable={!isSystem}
              maxLength={60}
            />

            {/* Descricao */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Descricao (opcional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Pra que serve essa lente"
              placeholderTextColor={Colors.ink3}
              style={[s.input, { height: 60, textAlignVertical: "top" }]}
              multiline
              editable={!isSystem}
              maxLength={200}
            />

            {/* Cor */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Cor</Text>
            <View style={s.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => !isSystem && setColor(c)}
                  style={[
                    s.colorSwatch,
                    { backgroundColor: c },
                    color === c && s.colorSwatchActive,
                  ]}
                >
                  {color === c && <Icon name="check" size={12} color="#fff" />}
                </Pressable>
              ))}
            </View>

            {/* Icone */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Icone</Text>
            <View style={s.iconRow}>
              {ICON_PRESETS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => !isSystem && setIcon(ic)}
                  style={[
                    s.iconBtn,
                    icon === ic && { borderColor: color, backgroundColor: color + "18" },
                  ]}
                >
                  <Icon name={ic as any} size={16} color={icon === ic ? color : Colors.ink} />
                </Pressable>
              ))}
            </View>

            {/* Pinar */}
            <View style={[s.row, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Fixar no topo</Text>
                <Text style={s.toggleHint}>Aparece como chip rapido na lista</Text>
              </View>
              <Switch
                value={isPinned}
                onValueChange={setIsPinned}
                trackColor={{ false: Colors.border, true: color }}
                thumbColor="#fff"
              />
            </View>

            {/* Info dos filtros incluidos */}
            {!isEdit && (
              <View style={s.filtersInfo}>
                <Icon name="filter" size={12} color={Colors.violet3} />
                <Text style={s.filtersInfoText}>
                  {activeFilterCount} {activeFilterCount === 1 ? "filtro incluido" : "filtros incluidos"}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Acoes */}
          <View style={s.actions}>
            <Pressable onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!name.trim() || isSaving}
              style={[
                s.btn,
                { backgroundColor: color },
                (!name.trim() || isSaving) && { opacity: 0.5 },
              ]}
            >
              <Text style={s.btnPrimaryText}>{isSaving ? "Salvando..." : (isEdit ? "Salvar" : "Criar lente")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: Colors.bg2,
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.ink,
  },
  systemBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.amber + "15",
    borderColor: Colors.amber + "44",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  systemBannerText: {
    fontSize: 11,
    color: Colors.amber,
    fontWeight: "600",
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: Colors.ink3,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.bg4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.ink,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: "#fff",
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleLabel: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "600",
  },
  toggleHint: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 2,
  },
  filtersInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.violetD,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 14,
  },
  filtersInfoText: {
    fontSize: 11,
    color: Colors.violet3,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnGhost: {
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnGhostText: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "700",
  },
  btnPrimaryText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "800",
  },
});
