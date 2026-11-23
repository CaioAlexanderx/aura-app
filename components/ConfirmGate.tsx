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

  // 23/11/2026 (QA da ficha, P1): fechada, a pergunta NÃO existe. Antes ela
  // ficava no DOM com altura 0 e opacidade 0 e os botões continuavam
  // focáveis: Tab + Enter em "Sim, remover" escondido removia um pagamento
  // sem pergunta. Perde-se a animação de fechar; abrir continua animado.
  if (!visible) return null;

  return (
    <Collapsible open={visible} duration={Motion.base}>
      <View style={[s.box, { backgroundColor: bg, borderColor: c + "66" }]}>
        <Text style={[s.msg, { color: c }]}>{message}</Text>
        <View style={s.row}>
          {/* QA 23/11 (P2): sem "full" (flex:1 espremia); com base mínima e
              quebra de linha, em 320 px os dois botões empilham em vez de
              cortar "Lançar mesmo assim" / "Sim, remover". */}
          <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} style={s.cancelar} />
          <Button
            title={confirmLabel}
            variant={tone === "red" ? "danger" : "primary"}
            onPress={onConfirm}
            loading={loading}
            style={s.confirmar}
          />
        </View>
      </View>
    </Collapsible>
  );
}

const s = StyleSheet.create({
  box: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  msg: { fontSize: 13, fontWeight: "700", marginBottom: 10, lineHeight: 18 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cancelar: { flexGrow: 1, flexBasis: 110, minHeight: 44 },
  confirmar: { flexGrow: 2, flexBasis: 170, minHeight: 44 },
});

export default ConfirmGate;
