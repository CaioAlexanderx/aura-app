// ============================================================
// ConfirmGate — Aura · padrão único de confirmação sensível
// (F1 do redesign Crediário; spec §2.5)
//
// Substitui os 3 padrões divergentes (Sim/Não inline, banner âmbar
// ad-hoc, nota miúda sob o botão). Banner âmbar 2-step com slide-down
// animado: CTA → gate com resumo → Sim, confirmar / Cancelar.
//
// Uso:
//   <ConfirmGate
//     visible={gateOpen}
//     message={`Confirmar recebimento de ${fmt(v)} em ${metodo}?`}
//     onConfirm={apply} onCancel={() => setGateOpen(false)}
//     loading={submitting}
//   />
// ============================================================
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { Collapsible } from "@/components/anim";
import { Button } from "@/components/Button";
import { Motion } from "@/constants/motion";

interface ConfirmGateProps {
  visible:       boolean;
  message:       string;
  onConfirm:     () => void;
  onCancel:      () => void;
  confirmLabel?: string;
  cancelLabel?:  string;
  loading?:      boolean;
  /** "amber" (padrão, ações sensíveis) | "red" (destrutivas: devolução, bloqueio). */
  tone?:         "amber" | "red";
}

export function ConfirmGate({
  visible, message, onConfirm, onCancel,
  confirmLabel = "Sim, confirmar", cancelLabel = "Cancelar",
  loading, tone = "amber",
}: ConfirmGateProps) {
  const c = tone === "red" ? Colors.red : Colors.amber;
  const bg = tone === "red" ? Colors.redD : Colors.amberD;

  return (
    <Collapsible open={visible} duration={Motion.base}>
      <View style={[s.box, { backgroundColor: bg, borderColor: c + "66" }]}>
        <Text style={[s.msg, { color: c }]}>{message}</Text>
        <View style={s.row}>
          <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} full />
          <Button
            title={confirmLabel}
            variant={tone === "red" ? "danger" : "primary"}
            onPress={onConfirm}
            loading={loading}
            full
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </Collapsible>
  );
}

const s = StyleSheet.create({
  box: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  msg: { fontSize: 13, fontWeight: "700", marginBottom: 10, lineHeight: 18 },
  row: { flexDirection: "row", gap: 8 },
});

export default ConfirmGate;
