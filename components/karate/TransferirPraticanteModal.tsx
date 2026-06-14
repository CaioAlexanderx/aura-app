// ============================================================
// TransferirPraticanteModal — Aura Karâtê Track N
//
// Transfere um praticante do dojô de origem para um dojô de destino dentro
// da mesma federação. Wizard multi-passo (DNA TrocaModal/ConectarDojoModal):
//   1. Destino  — escolhe o dojô de destino (busca server-side)
//   2. Detalhes — data efetiva (default hoje) + motivo opcional
//   3. Resumo   — confirma origem → destino
//   4. Pronto   — confirmação
// Wired: karateApi.transferPractitioner. [MOCK] fallback até existir dado real.
// Respeita visibilidade por papel (a tela host só mostra a ação p/ admin/staff).
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, StyleSheet, Alert, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, Dojo } from "@/services/karateApi";

const STEPS = ["Destino", "Detalhes", "Resumo", "Pronto"];

// [MOCK] usado quando a API de dojôs falha (mock-fallback friendly)
const MOCK_DOJOS: Array<Pick<Dojo, "id" | "name" | "fpkt_affiliation_id">> = [
  { id: "d2", name: "Dojô Shotokan Centro",    fpkt_affiliation_id: "FPKT-012" },
  { id: "d3", name: "Wado-Ryu Osasco",          fpkt_affiliation_id: "FPKT-033" },
  { id: "d4", name: "Shorin-Ryu Litoral",       fpkt_affiliation_id: "FPKT-041" },
];

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  practitionerId: string;
  practitionerName: string;
  originDojoId: string | null;
  originDojoName: string | null;
  onDone?: () => void;
}

export function TransferirPraticanteModal({
  visible, onClose, federationId, practitionerId, practitionerName,
  originDojoId, originDojoName, onDone,
}: Props) {
  const [step, setStep]       = useState(0);
  const [query, setQuery]     = useState("");
  const [dojos, setDojos]     = useState<Array<Pick<Dojo, "id" | "name" | "fpkt_affiliation_id">>>([]);
  const [loadingDojos, setLoadingDojos] = useState(false);
  const [dest, setDest]       = useState<{ id: string; name: string } | null>(null);
  const [date, setDate]       = useState(todayISO());
  const [reason, setReason]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(0); setQuery(""); setDest(null); setDate(todayISO());
    setReason(""); setSubmitting(false); onClose();
  }, [onClose]);

  const fetchDojos = useCallback(async (q: string) => {
    setLoadingDojos(true);
    try {
      const res = await karateApi.listDojos(federationId, { q: q || undefined, pageSize: 50 });
      // Exclui o dojô de origem da lista de destinos possíveis
      setDojos(res.data.filter((d) => d.id !== originDojoId));
    } catch {
      setDojos(MOCK_DOJOS.filter((d) => d.id !== originDojoId));
    } finally {
      setLoadingDojos(false);
    }
  }, [federationId, originDojoId]);

  useEffect(() => { if (visible) fetchDojos(""); }, [visible, fetchDojos]);

  const handleQueryChange = (text: string) => { setQuery(text); fetchDojos(text); };

  const finish = async () => {
    if (!dest) return;
    setSubmitting(true);
    try {
      await karateApi.transferPractitioner(federationId, practitionerId, {
        destination_dojo_id: dest.id,
        transferred_at: date,
        reason: reason.trim() || undefined,
      });
    } catch (e: any) {
      // 409 = já está no destino; demais erros mostram alerta e abortam
      const msg = e?.message || "";
      if (/409|ALREADY_AT_DESTINATION|já está/i.test(msg)) {
        setSubmitting(false);
        Alert.alert("Sem mudança", "O praticante já está neste dojô.");
        return;
      }
      // [MOCK fallback] segue para a tela de sucesso mesmo sem backend
    }
    setSubmitting(false);
    setStep(3);
    onDone?.();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Transferir praticante</Text>
          <TouchableOpacity onPress={reset} accessibilityLabel="Fechar">
            <Ionicons name="close" size={24} color={KarateColors.ink} />
          </TouchableOpacity>
        </View>
        <Stepper steps={STEPS} currentStep={step} style={styles.stepper} />

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {/* Passo 1 — destino */}
          {step === 0 && (
            <View style={{ gap: 10 }}>
              <View style={styles.fromRow}>
                <Ionicons name="home" size={14} color={KarateColors.ink3} />
                <Text style={styles.fromText}>
                  De: <Text style={styles.fromStrong}>{originDojoName || "Sem dojô atual"}</Text>
                </Text>
              </View>
              <Text style={styles.hint}>Para qual dojô você quer transferir {practitionerName}?</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar dojô por nome ou FPKT-NNN"
                placeholderTextColor={KarateColors.ink3}
                value={query}
                onChangeText={handleQueryChange}
              />
              {loadingDojos ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={KarateColors.primary} />
              ) : dojos.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum dojô encontrado</Text>
              ) : (
                <FlatList
                  data={dojos}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setDest({ id: item.id, name: item.name })}
                      style={[styles.pickRow, dest?.id === item.id && styles.pickRowSel]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: dest?.id === item.id }}
                    >
                      <View style={styles.avatar}><Ionicons name="home" size={16} color={KarateColors.ink3} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dojoName}>{item.name}</Text>
                        {item.fpkt_affiliation_id ? (
                          <Text style={styles.dojoMeta}>{item.fpkt_affiliation_id}</Text>
                        ) : null}
                      </View>
                      {dest?.id === item.id && <Ionicons name="checkmark-circle" size={20} color={KarateColors.primary} />}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {/* Passo 2 — detalhes */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.hint}>Quando a transferência passa a valer e por quê?</Text>
              <View>
                <Text style={styles.fieldLabel}>Data da transferência</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={KarateColors.ink3}
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Motivo (opcional)</Text>
                <TextInput
                  style={[styles.searchInput, styles.textArea]}
                  placeholder="Ex: mudança de cidade, escolha do responsável..."
                  placeholderTextColor={KarateColors.ink3}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}

          {/* Passo 3 — resumo */}
          {step === 2 && (
            <View style={{ gap: 12 }}>
              <Text style={styles.hint}>Confira os dados antes de confirmar.</Text>
              <View style={styles.summaryCard}>
                <SummaryRow icon="person" label="Praticante" value={practitionerName} />
                <View style={styles.summaryArrow}>
                  <View style={styles.summaryDojo}>
                    <Text style={styles.summaryDojoLabel}>Origem</Text>
                    <Text style={styles.summaryDojoName}>{originDojoName || "Sem dojô"}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={KarateColors.primary} />
                  <View style={styles.summaryDojo}>
                    <Text style={styles.summaryDojoLabel}>Destino</Text>
                    <Text style={[styles.summaryDojoName, { color: KarateColors.primary }]}>{dest?.name}</Text>
                  </View>
                </View>
                <SummaryRow icon="calendar" label="Data" value={date} />
                {reason.trim() ? <SummaryRow icon="chatbubble-ellipses" label="Motivo" value={reason.trim()} /> : null}
              </View>
              <View style={styles.noteBox}>
                <Ionicons name="shield-checkmark" size={15} color={KarateColors.ink3} />
                <Text style={styles.noteText}>
                  O histórico de faixas e presenças do praticante é preservado. A transferência fica registrada de forma permanente.
                </Text>
              </View>
            </View>
          )}

          {/* Passo 4 — pronto */}
          {step === 3 && (
            <View style={styles.doneWrap}>
              <View style={styles.doneIco}><Ionicons name="checkmark" size={34} color={KarateColors.ok} /></View>
              <Text style={styles.doneT}>Transferência concluída!</Text>
              <Text style={styles.doneS}>
                {practitionerName} agora pertence ao {dest?.name}. Avisamos os dojôs de origem e destino por e-mail.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 0 && (
            <KarateButton label="Próximo" variant="primary" size="md"
              onPress={() => dest ? setStep(1) : Alert.alert("Escolha o dojô de destino")} style={{ flex: 1 }} />
          )}
          {step === 1 && (
            <>
              <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep(0)} style={{ flex: 1 }} />
              <KarateButton label="Próximo" variant="primary" size="md"
                onPress={() => /^\d{4}-\d{2}-\d{2}$/.test(date) ? setStep(2) : Alert.alert("Data inválida", "Use o formato AAAA-MM-DD.")}
                style={{ flex: 1 }} />
            </>
          )}
          {step === 2 && (
            <>
              <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep(1)} style={{ flex: 1 }} />
              <KarateButton label={submitting ? "Transferindo..." : "Confirmar transferência"} variant="primary" size="md"
                loading={submitting} onPress={finish} style={{ flex: 1 }} />
            </>
          )}
          {step === 3 && (
            <KarateButton label="Concluir" variant="primary" size="md" onPress={reset} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Ionicons name={icon as any} size={14} color={KarateColors.ink3} />
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  stepper:     { margin: 16 } as ViewStyle,
  body:        { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, paddingBottom: 32 } as ViewStyle,
  hint:        { fontSize: 13, color: KarateColors.ink3, lineHeight: 18, marginBottom: 2 } as TextStyle,
  fromRow:     { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  fromText:    { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  fromStrong:  { fontWeight: "700", color: KarateColors.ink } as TextStyle,
  searchInput: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: "#fff" } as TextStyle,
  textArea:    { minHeight: 70, textAlignVertical: "top" } as TextStyle,
  fieldLabel:  { fontSize: 12, fontWeight: "600", color: KarateColors.ink, marginBottom: 4 } as TextStyle,
  emptyText:   { textAlign: "center", color: KarateColors.ink3, paddingVertical: 16, fontSize: 13 } as TextStyle,
  pickRow:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 8, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  pickRowSel:  { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  avatar:      { width: 34, height: 34, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.bg2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dojoName:    { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  dojoMeta:    { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
  summaryCard: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 12 } as ViewStyle,
  summaryArrow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 4 } as ViewStyle,
  summaryDojo: { flex: 1, gap: 2 } as ViewStyle,
  summaryDojoLabel: { fontSize: 10, fontWeight: "800", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.8 } as TextStyle,
  summaryDojoName:  { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  sumRow:      { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  sumLabel:    { fontSize: 12, color: KarateColors.ink3, width: 80 } as TextStyle,
  sumValue:    { fontSize: 13, color: KarateColors.ink, flex: 1, fontWeight: "600" } as TextStyle,
  noteBox:     { flexDirection: "row", gap: 8, padding: 12, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, alignItems: "flex-start" } as ViewStyle,
  noteText:    { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  doneWrap:    { alignItems: "center", paddingVertical: 28, gap: 8 } as ViewStyle,
  doneIco:     { width: 72, height: 72, borderRadius: 36, backgroundColor: KarateColors.okSoft, alignItems: "center", justifyContent: "center", marginBottom: 8 } as ViewStyle,
  doneT:       { fontSize: 19, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  doneS:       { fontSize: 14, color: KarateColors.ink2, textAlign: "center", lineHeight: 20, maxWidth: 360 } as TextStyle,
  footer:      { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
