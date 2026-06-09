// ============================================================
// ConectarDojoModal — Aura Karatê Fase 5 (DESIGN-22)
//
// 2 jeitos de conectar (linguagem simples, sem tecniquês):
//   "O dojô usa o Aura Karatê" (native) → envia convite; liga sozinho
//   "O dojô não usa sistema"  (manual)  → a federação cuida de tudo
// Wired: karateConnectionsApi.createConnection. [MOCK] fallback.
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateConnectionsApi, Via } from "@/services/karateConnectionsApi";

const STEPS = ["Dojô", "Como conecta", "Pronto"];

// [MOCK] dojôs ainda sem conexão
const MOCK_UNLINKED = [
  { id: "u1", name: "Wado-Ryu Osasco", code: "FPKT-033" },
  { id: "u2", name: "Dojô Sankukai", code: "FPKT-029" },
  { id: "u3", name: "Shorin-Ryu Litoral", code: "FPKT-041" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  onDone?: () => void;
}

export function ConectarDojoModal({ visible, onClose, federationId, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dojo, setDojo] = useState<{ id: string; name: string; code: string } | null>(null);
  const [via, setVia] = useState<Via | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setStep(0); setDojo(null); setVia(null); setLoading(false); onClose(); };

  const finish = async () => {
    if (!dojo || !via) return;
    setLoading(true);
    try {
      await karateConnectionsApi.createConnection(federationId, { dojo_id: dojo.id, via });
    } catch { /* [MOCK fallback] */ }
    setLoading(false);
    setStep(2);
    onDone?.();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Conectar dojô</Text>
          <TouchableOpacity onPress={reset} accessibilityLabel="Fechar"><Ionicons name="close" size={24} color={KarateColors.ink} /></TouchableOpacity>
        </View>
        <Stepper steps={STEPS} currentStep={step} style={styles.stepper} />

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Passo 1 — qual dojô */}
          {step === 0 && (
            <View style={{ gap: 10 }}>
              <Text style={styles.hint}>Qual dojô você quer conectar?</Text>
              {MOCK_UNLINKED.map((d) => (
                <TouchableOpacity key={d.id} onPress={() => setDojo(d)}
                  style={[styles.pickRow, dojo?.id === d.id && styles.pickRowSel]}
                  accessibilityRole="radio" accessibilityState={{ checked: dojo?.id === d.id }}>
                  <View style={styles.avatar}><Ionicons name="home" size={16} color={KarateColors.ink3} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dojoName}>{d.name}</Text>
                    <Text style={styles.dojoMeta}>{d.code}</Text>
                  </View>
                  {dojo?.id === d.id && <Ionicons name="checkmark-circle" size={20} color={KarateColors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Passo 2 — como conecta (2 opções) */}
          {step === 1 && (
            <View style={{ gap: 12 }}>
              <Text style={styles.hint}>Como o {dojo?.name} vai se conectar à federação? Isso define o que chega aqui sozinho.</Text>
              <TouchableOpacity onPress={() => setVia("native")} style={[styles.viaCard, via === "native" && styles.viaCardSel]}>
                <View style={styles.viaTop}>
                  <Ionicons name="sync-circle" size={22} color={KarateColors.primary} />
                  <Text style={styles.viaTitle}>O dojô usa o Aura Karatê</Text>
                  {via === "native" && <Ionicons name="checkmark-circle" size={20} color={KarateColors.primary} />}
                </View>
                <Text style={styles.viaDesc}>Tudo se atualiza sozinho: alunos, faixas, presenças e pagamentos chegam aqui automaticamente. É só o dojô aceitar o convite.</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setVia("manual")} style={[styles.viaCard, via === "manual" && styles.viaCardSel]}>
                <View style={styles.viaTop}>
                  <Ionicons name="shield-checkmark" size={22} color={KarateColors.ink3} />
                  <Text style={styles.viaTitle}>O dojô não usa nenhum sistema</Text>
                  {via === "manual" && <Ionicons name="checkmark-circle" size={20} color={KarateColors.primary} />}
                </View>
                <Text style={styles.viaDesc}>A federação cadastra e cuida de tudo. O sensei recebe um acesso para acompanhar os alunos e um convite para usar o Aura.</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Passo 3 — pronto */}
          {step === 2 && (
            <View style={styles.doneWrap}>
              <View style={styles.doneIco}><Ionicons name="checkmark" size={34} color={KarateColors.ok} /></View>
              {via === "native" ? (
                <>
                  <Text style={styles.doneT}>Convite enviado!</Text>
                  <Text style={styles.doneS}>Avisamos o {dojo?.name}. Assim que o sensei aceitar no Aura Karatê, tudo passa a se atualizar sozinho.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.doneT}>Dojô conectado!</Text>
                  <Text style={styles.doneS}>O {dojo?.name} agora é cuidado pela federação. Você pode cadastrar os alunos e acompanhar tudo por aqui.</Text>
                </>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 0 && (
            <KarateButton label="Próximo" variant="primary" size="md" onPress={() => dojo ? setStep(1) : Alert.alert("Escolha um dojô")} style={{ flex: 1 }} />
          )}
          {step === 1 && (
            <>
              <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep(0)} style={{ flex: 1 }} />
              <KarateButton label={loading ? "Conectando..." : "Conectar"} variant="primary" size="md" loading={loading} onPress={() => via ? finish() : Alert.alert("Escolha como o dojô conecta")} style={{ flex: 1 }} />
            </>
          )}
          {step === 2 && (
            <KarateButton label="Concluir" variant="primary" size="md" onPress={reset} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stepper: { margin: 16 } as ViewStyle,
  body: { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, paddingBottom: 32 } as ViewStyle,
  hint: { fontSize: 13, color: KarateColors.ink3, lineHeight: 18, marginBottom: 2 } as TextStyle,
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  pickRowSel: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  avatar: { width: 34, height: 34, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dojoName: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  dojoMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
  viaCard: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1.5, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  viaCardSel: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  viaTop: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  viaTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  viaDesc: { fontSize: 13, color: KarateColors.ink2, lineHeight: 19 } as TextStyle,
  doneWrap: { alignItems: "center", paddingVertical: 28, gap: 8 } as ViewStyle,
  doneIco: { width: 72, height: 72, borderRadius: 36, backgroundColor: KarateColors.okSoft, alignItems: "center", justifyContent: "center", marginBottom: 8 } as ViewStyle,
  doneT: { fontSize: 19, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  doneS: { fontSize: 14, color: KarateColors.ink2, textAlign: "center", lineHeight: 20, maxWidth: 360 } as TextStyle,
  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
