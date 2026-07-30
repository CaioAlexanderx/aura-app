// ============================================================
// SelecionarAlunosModal — seletor multi-seleção reutilizável (F5b) entre
// "Inscrever alunos" (eventos/cursos) e "Enviar candidatos" (exame de
// faixa). Busca + seleção múltipla; SÓ aluno FEDERADO pode ser
// selecionado (regra de ouro da fase) — não federado aparece desabilitado
// com dica + atalho para a tela de Alunos (federar lá).
//
// Sem <Modal>-dentro-de-<Modal>: esta é a ÚNICA modal do fluxo (o
// resultado do lote é renderizado depois, inline na tela, via
// ResultadoLoteCard — mesmo racional documentado em conexao.tsx/
// AlunoFederacaoSection.tsx).
//
// StyleSheet: todos os top-level são objetos (WeakMap safe).
//
// QA prod 30/07 (item 1): busca os alunos ATIVOS pra oferecer na
// inscrição em lote — sem `limit`, o backend paginado (Aura-backend#429)
// só devolvia os 100 primeiros, e um dojô grande não conseguia
// selecionar quem ficasse de fora. Pede o teto (DOJO_STUDENTS_MAX_LIMIT).
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoStudentsApi, DojoStudent, DOJO_STUDENTS_MAX_LIMIT } from "@/services/karateDojoStudentsApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  busy: boolean;
  onSubmit: (studentIds: string[]) => void;
}

export function SelecionarAlunosModal({
  visible, onClose, federationId, title, subtitle, ctaLabel, busy, onSubmit,
}: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<DojoStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !federationId) return;
    setSelected(new Set());
    setQuery("");
    setLoading(true);
    karateDojoStudentsApi
      .listStudents(federationId, { status: "active", limit: DOJO_STUDENTS_MAX_LIMIT })
      .then((res) => setStudents(res.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [visible, federationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const goToFicha = () => {
    onClose();
    router.push("/karate/(dojo)/alunos" as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          <View style={st.head}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{title}</Text>
              {!!subtitle && <Text style={st.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={busy ? undefined : onClose} accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={st.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar aluno pelo nome"
            placeholderTextColor={KarateColors.ink4}
            accessibilityLabel="Buscar aluno"
          />

          <ScrollView style={st.list}>
            {loading ? (
              <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 20 }} />
            ) : filtered.length === 0 ? (
              <Text style={st.emptyTxt}>Nenhum aluno encontrado.</Text>
            ) : (
              filtered.map((s) => {
                const on = selected.has(s.id);
                const disabled = !s.federated;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[st.row, disabled && st.rowDisabled]}
                    onPress={disabled ? undefined : () => toggle(s.id)}
                    disabled={disabled}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled }}
                  >
                    <View style={[st.checkbox, on && st.checkboxOn, disabled && st.checkboxDisabled]}>
                      {on && <Icon name="check" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, disabled && st.rowNameDisabled]}>{s.full_name}</Text>
                      {disabled ? (
                        <TouchableOpacity onPress={goToFicha} accessibilityRole="button">
                          <Text style={st.rowHint}>Precisa ser federado — ver ficha</Text>
                        </TouchableOpacity>
                      ) : (
                        !!s.belt_label && <Text style={st.rowSub}>{s.belt_label}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <View style={st.footer}>
            <Text style={st.selCount}>{selected.size} selecionado{selected.size === 1 ? "" : "s"}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={st.cancelBtn} onPress={busy ? undefined : onClose} accessibilityRole="button">
                <Text style={st.cancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.ctaBtn, (busy || selected.size === 0) && st.ctaBtnDisabled]}
                onPress={busy || selected.size === 0 ? undefined : () => onSubmit(Array.from(selected))}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={st.ctaTxt}>{ctaLabel} ({selected.size})</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 460, maxHeight: "84%", backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 18, gap: 12 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } as ViewStyle,
  title: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  subtitle: { fontSize: 12, color: KarateColors.ink3, marginTop: 3, lineHeight: 17 } as TextStyle,
  search: { fontSize: 13, color: KarateColors.ink, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 9 } as any,
  list: { maxHeight: 320 } as ViewStyle,
  emptyTxt: { fontSize: 12.5, color: KarateColors.ink3, textAlign: "center", paddingVertical: 20 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  rowDisabled: { opacity: 0.55 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  checkboxDisabled: { borderColor: KarateColors.border } as ViewStyle,
  rowName: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  rowNameDisabled: { color: KarateColors.ink3 } as TextStyle,
  rowSub: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  rowHint: { fontSize: 11.5, color: KarateColors.primary, fontWeight: "700", marginTop: 2 } as TextStyle,
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  selCount: { fontSize: 12, color: KarateColors.ink3, fontWeight: "600" } as TextStyle,
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 12 } as ViewStyle,
  cancelTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  ctaBtn: { backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 16, minWidth: 120, alignItems: "center", justifyContent: "center" } as ViewStyle,
  ctaBtnDisabled: { opacity: 0.5 } as ViewStyle,
  ctaTxt: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
