// ============================================================
// EditarExameInfoModal — Aura Karatê (federação)
//
// Modal "Editar informações" para exame/curso: título, data, local e
// faixa alvo (quando aplicável). Segue o padrão visual/estrutural de
// CriarExameModal (card centrado, campos com Field, footer com botões)
// e usa karateApi.updateBeltExam (PATCH /belt-exams/:examId), o mesmo
// endpoint que a tela de detalhe já usa para status/registration_fields.
//
// Tornar todos os eventos editáveis (info + banner) — parte "info" do
// exame/curso. O torneio segue o mesmo espírito em EditarTorneioInfoModal
// (karateCompetitionsApi.patchCompetition).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, useWindowDimensions, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { parseBrDate } from "@/components/inputs/DateInput";
import { karateApi, BeltExam } from "@/services/karateApi";

interface Props {
  visible: boolean;
  exam: BeltExam | null;
  federationId: string;
  onClose: () => void;
  onSaved: (updated: BeltExam) => void;
}

const onlyD = (v: string) => (v || "").replace(/\D/g, "");

// dd/mm/aaaa parcial enquanto digita (validação real é via parseBrDate)
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

// "YYYY-MM-DD" (ou ISO completo) -> "dd/mm/aaaa" para exibição inicial
function isoToBr(iso?: string | null): string {
  if (!iso) return "";
  const datePart = String(iso).slice(0, 10);
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function EditarExameInfoModal({ visible, exam, federationId, onClose, onSaved }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(520, width - 24);

  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [location, setLocation] = useState("");
  const [targetBelt, setTargetBelt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurso = exam?.exam_type === "curso";

  // Preenche o formulário sempre que o modal abre para um exame.
  useEffect(() => {
    if (!visible || !exam) return;
    setTitle(exam.title ?? "");
    setExamDate(isoToBr(exam.exam_date));
    setLocation(exam.location ?? "");
    setTargetBelt(exam.target_belt ?? "");
    setError(null);
    setSaving(false);
  }, [visible, exam]);

  const dateBad = examDate.length === 10 && parseBrDate(examDate) === null;

  if (!visible || !exam) return null;

  const handleSave = async () => {
    const iso = parseBrDate(examDate);
    if (!title.trim() || !iso || !location.trim()) {
      setError("Preencha título, uma data válida (dd/mm/aaaa) e o local.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        exam_date: iso,
        location: location.trim(),
      };
      if (!isCurso) body.target_belt = targetBelt.trim();
      const updated = await karateApi.updateBeltExam(federationId, exam.id, body as any);
      onSaved({ ...exam, ...updated });
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{isCurso ? "CURSO" : "EXAME"}</Text>
              <Text style={styles.title}>Editar informações</Text>
              <Text style={styles.sub}>Ajuste os dados básicos do evento.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Fechar" hitSlop={8}>
              <Icon name="close" size={20} color={P.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBanner}>
                <Icon name="alert_circle" size={14} color={P.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Título<Text style={{ color: P.red }}> *</Text></Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex.: Exame de Faixa Preta 2026"
                  placeholderTextColor={P.ink4}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Data<Text style={{ color: P.red }}> *</Text></Text>
                <View style={[styles.inputWrap, dateBad && styles.inputBad]}>
                  <TextInput
                    style={[styles.input, styles.mono]}
                    value={examDate}
                    onChangeText={(v) => setExamDate(maskDate(v))}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={P.ink4}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                {dateBad ? <Text style={styles.noteBad}>Data inválida.</Text> : null}
              </View>
              {!isCurso && (
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Faixa alvo</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={targetBelt}
                      onChangeText={setTargetBelt}
                      placeholder="Ex.: preta"
                      placeholderTextColor={P.ink4}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Local<Text style={{ color: P.red }}> *</Text></Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Ex.: Dojô Central"
                  placeholderTextColor={P.ink4}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} disabled={saving} />
            <KarateButton
              label={saving ? "Salvando..." : "Salvar alterações"}
              variant="primary"
              size="md"
              loading={saving}
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 22, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  bodyContent: { padding: 20, paddingTop: 14, gap: 4 } as ViewStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12 } as ViewStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, paddingVertical: 11, outlineStyle: "none" as any } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  noteBad: { fontFamily: F.body, fontSize: 11, color: P.red, marginTop: 4 } as TextStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginBottom: 6 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
});
