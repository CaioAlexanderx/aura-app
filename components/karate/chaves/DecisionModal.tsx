// ============================================================
// AURA KARATÊ — Chaves: COMO a luta foi decidida (P1, migration 296)
//
// A súmula do ginásio registra o método, não só o vencedor: Ippon,
// Hantei (com as bandeiras dos 5 árbitros), Kettei-Sen (prorrogação),
// Sai-Shiai, decisão do árbitro central, W.O., Kiken. Este modal aparece
// no lançamento do resultado quando a categoria tem plano de fases —
// e é opcional: "Só o vencedor" mantém o fluxo antigo.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, Modal, Pressable, TouchableOpacity, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { DecisionMethod, MatchDecision, DECISION_LABEL } from "@/services/karateCompetitionP1Api";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Nome dos dois lados, para rotular as bandeiras. */
  akaName: string;
  shiroName: string;
  /** Qual lado venceu (o modal só registra COMO). */
  winnerSide: "aka" | "shiro" | null;
  initial?: MatchDecision | null;
  onConfirm: (decision: MatchDecision | null) => void;
}

const METHODS: DecisionMethod[] = ["ippon", "wazari", "hantei", "kettei_sen", "sai_shiai", "central", "wo", "kiken"];
const FLAG_OPTIONS = [0, 1, 2, 3, 4, 5];

export function DecisionModal({
  visible, onClose, akaName, shiroName, winnerSide, initial, onConfirm,
}: Props) {
  const [method, setMethod] = useState<DecisionMethod | null>(null);
  const [votesAka, setVotesAka] = useState<number | null>(null);
  const [votesShiro, setVotesShiro] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setMethod(initial?.method || null);
    setVotesAka(initial?.votes_aka ?? null);
    setVotesShiro(initial?.votes_shiro ?? null);
    setNote(initial?.note || "");
  }, [visible, initial]);

  const needsFlags = method === "hantei";

  const confirm = () => {
    if (!method) { onConfirm(null); onClose(); return; }
    const decision: MatchDecision = { method };
    if (needsFlags) {
      if (votesAka != null) decision.votes_aka = votesAka;
      if (votesShiro != null) decision.votes_shiro = votesShiro;
    }
    if (note.trim()) decision.note = note.trim();
    onConfirm(decision);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Como foi decidida?</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                Vencedor: {winnerSide === "aka" ? akaName : winnerSide === "shiro" ? shiroName : "—"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="x" size={20} color={C.ink3} /></TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <View style={s.chipRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.chip, method === m && s.chipOn]}
                  onPress={() => setMethod(method === m ? null : m)}
                >
                  <Text style={[s.chipTxt, method === m && s.chipTxtOn]}>{DECISION_LABEL[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {needsFlags && (
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Bandeiras (5 árbitros)</Text>
                <FlagRow name={akaName} value={votesAka} onChange={setVotesAka} tone={C.primary} />
                <FlagRow name={shiroName} value={votesShiro} onChange={setVotesShiro} tone={C.ink2} />
              </View>
            )}

            <View style={{ gap: 5 }}>
              <Text style={s.label}>Observação (opcional)</Text>
              <TextInput
                style={s.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Ex.: empate na prorrogação"
                placeholderTextColor={C.ink4}
              />
            </View>
          </View>

          <View style={s.footer}>
            <KarateButton label="Só o vencedor" variant="ghost" size="md" onPress={() => { onConfirm(null); onClose(); }} />
            <KarateButton label="Registrar" variant="sumi" size="md" onPress={confirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FlagRow({ name, value, onChange, tone }: {
  name: string; value: number | null; onChange: (v: number | null) => void; tone: string;
}) {
  return (
    <View style={s.flagRow}>
      <Text style={s.flagName} numberOfLines={1}>{name}</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {FLAG_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.flag, value === n && { backgroundColor: tone, borderColor: tone }]}
            onPress={() => onChange(value === n ? null : n)}
            accessibilityRole="button"
            accessibilityLabel={`${n} bandeiras para ${name}`}
          >
            <Text style={[s.flagTxt, value === n && { color: "#fdf8f2" }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 480, backgroundColor: C.surface, borderRadius: R.xl, overflow: "hidden", borderWidth: 1, borderColor: C.border2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 17, color: C.ink } as TextStyle,
  subtitle: { fontSize: 12, color: C.ink3, marginTop: 1 } as TextStyle,
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase", color: C.ink3 } as TextStyle,
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 11, paddingVertical: 5 } as ViewStyle,
  chipOn: { backgroundColor: C.primary, borderColor: C.primary } as ViewStyle,
  chipTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  chipTxtOn: { color: "#fdf8f2", fontWeight: "700" } as TextStyle,
  flagRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  flagName: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  flag: { width: 30, height: 30, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center", backgroundColor: C.glassHi } as ViewStyle,
  flagTxt: { fontSize: 12.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  noteInput: { fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi } as TextStyle,
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 10, padding: 13, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
});
