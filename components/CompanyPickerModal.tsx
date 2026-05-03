// MULTICNPJ Sessao 1: modal reutilizavel pra escolher empresa.
//
// Usado pelo <RequireCompanyScope /> e por outras telas que precisam de
// scope especifico ad-hoc. Memoriza ultima escolha por contexto em
// sessionStorage (chave: aura_picker_last_<userId>_<context>).
//
// Uso:
//   <CompanyPickerModal
//     visible={open}
//     context="pdv"
//     actionLabel="abrir o caixa"
//     onPick={(companyId) => { ... }}
//     onCancel={() => setOpen(false)}
//   />

import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const SS_KEY_PREFIX = "aura_picker_last_";

function getKey(userId: string, context: string) {
  return `${SS_KEY_PREFIX}${userId}_${context}`;
}

export function getRememberedCompanyId(userId: string, context: string): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(getKey(userId, context));
  } catch {
    return null;
  }
}

export function setRememberedCompanyId(userId: string, context: string, companyId: string) {
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(getKey(userId, context), companyId);
  } catch {}
}

export function clearRememberedCompanyId(userId: string, context: string) {
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(getKey(userId, context));
  } catch {}
}

export function CompanyPickerModal({
  visible,
  context,
  actionLabel,
  onPick,
  onCancel,
}: {
  visible: boolean;
  context: string;
  actionLabel: string;
  onPick: (companyId: string) => void;
  onCancel?: () => void;
}) {
  const { user, availableCompanies, switching } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user?.id) return;
    const remembered = getRememberedCompanyId(user.id, context);
    const exists = remembered && availableCompanies.some((c) => c.id === remembered);
    if (exists) {
      setSelectedId(remembered);
    } else if (availableCompanies.length > 0) {
      const primary = availableCompanies.find((c: any) => c.is_primary);
      setSelectedId((primary || availableCompanies[0]).id);
    }
  }, [visible, context, user?.id, availableCompanies]);

  function handleConfirm() {
    if (!selectedId || !user?.id) return;
    setRememberedCompanyId(user.id, context, selectedId);
    onPick(selectedId);
  }

  function handleForget() {
    if (!user?.id) return;
    clearRememberedCompanyId(user.id, context);
    const fallback =
      availableCompanies.find((c: any) => c.is_primary)?.id ||
      availableCompanies[0]?.id ||
      null;
    setSelectedId(fallback);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Selecionar empresa</Text>
          <Text style={s.desc}>
            Para {actionLabel}, escolha em qual empresa você está operando agora. Você pode trocar a qualquer momento pelo seletor de empresa no canto superior.
          </Text>

          <ScrollView style={s.list} contentContainerStyle={{ gap: 6 }}>
            {availableCompanies.map((c: any) => {
              const isSelected = selectedId === c.id;
              const displayName = c.legal_name || c.trade_name || c.name || "Empresa";
              const cnpj = c.cnpj || null;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedId(c.id)}
                  style={[s.item, isSelected && s.itemSelected]}
                >
                  <View style={[s.radio, isSelected && s.radioSelected]}>
                    {isSelected && <View style={s.radioDot} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.itemName} numberOfLines={1}>{displayName}</Text>
                    {cnpj && <Text style={s.itemMeta}>CNPJ {cnpj}</Text>}
                    {c.is_current && <Text style={s.itemCurrent}>Empresa atual</Text>}
                  </View>
                  {c.is_primary && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>Principal</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={handleForget} style={s.forgetBtn}>
            <Text style={s.forgetBtnText}>Editar — sempre perguntar para esta ação</Text>
          </Pressable>

          <View style={s.actions}>
            {onCancel && (
              <Pressable onPress={onCancel} style={s.cancelBtn}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleConfirm}
              disabled={!selectedId || switching}
              style={[s.confirmBtn, (!selectedId || switching) && { opacity: 0.5 }]}
            >
              <Text style={s.confirmBtnText}>{switching ? "Trocando..." : "Continuar"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20,
  },
  card: {
    backgroundColor: Colors.bg2, borderRadius: 16, padding: 24, width: "100%", maxWidth: 480,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: Colors.ink, marginBottom: 6 },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 16 },
  list: { maxHeight: 320, marginBottom: 12 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bg3, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemSelected: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: Colors.violet },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  itemMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  itemCurrent: { fontSize: 10, color: Colors.violet3, marginTop: 2, fontWeight: "600" },
  primaryBadge: {
    backgroundColor: Colors.violetD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border2,
  },
  primaryBadgeText: { fontSize: 9, color: Colors.violet3, fontWeight: "700" },
  forgetBtn: { paddingVertical: 8, alignSelf: "flex-start" },
  forgetBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600", textDecorationLine: "underline" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  confirmBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center" },
  confirmBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default CompanyPickerModal;
