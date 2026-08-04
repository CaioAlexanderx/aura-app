// ============================================================
// CriarExameKyuModal — Aura Karatê (dojô) · F10
//
// Passo 1 do exame de faixa do dojô: só os dados do EXAME (data,
// título, examinador, observações) — POST /dojo/graduation-exams cria o
// rascunho ('draft'), sem alunos ainda. A escolha de alunos e o
// lançamento por aluno (quesitos/resultado/faixa) acontecem na ficha do
// exame (app/karate/(dojo)/graduacao/[examId].tsx), pra onde este modal
// navega assim que o exame é criado.
//
// Mesmo DNA visual de components/karate/dojoEventos/CriarEventoDojoModal.tsx
// (header com selo 空, máscara dd/mm/aaaa, CTA sumi full-width) — não é
// reuso direto porque o domínio é outro (karate_dojo_belt_exams, não
// karate_dojo_events) e os campos não batem (aqui não tem local/taxa/
// vagas; tem examinador).
// ============================================================
import React, { useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput, Pressable,
  StyleSheet, useWindowDimensions, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { parseBrDate } from "@/components/inputs/DateInput";
import { karateDojoBeltExamApi, DojoBeltExam } from "@/services/karateDojoBeltExamApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  onCreated: (exam: DojoBeltExam) => void;
}

const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

export function CriarExameKyuModal({ visible, onClose, federationId, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(560, width - 24);

  const [examDate, setExamDate] = useState("");
  const [title, setTitle] = useState("");
  const [examinerName, setExaminerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateBad = examDate.length === 10 && parseBrDate(examDate) === null;

  const resetAndClose = () => {
    setExamDate(""); setTitle(""); setExaminerName(""); setNotes("");
    setLoading(false); setError(null);
    onClose();
  };

  const handleCreate = async () => {
    const iso = parseBrDate(examDate);
    if (!iso) {
      setError("Informe uma data válida (dd/mm/aaaa).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const exam = await karateDojoBeltExamApi.createExam(federationId, {
        exam_date: iso,
        title: title.trim() || undefined,
        examiner_name: examinerName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      resetAndClose();
      onCreated(exam);
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível criar o exame. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={resetAndClose} />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  Seu dojô · Exame de faixa</Text>
              <Text style={styles.title}>Novo exame<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>
                Você gradua até Marrom 1º kyu. Faixa preta é exclusiva da banca da federação. Os alunos e o
                lançamento por aluno vêm no próximo passo.
              </Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10} style={styles.close} accessibilityLabel="Fechar modal">
              <Icon name="x" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBanner}>
                <Icon name="alert_circle" size={15} color={P.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Field label="Data do exame" req hint="dd/mm/aaaa" mono value={examDate}
              onChangeText={(v) => setExamDate(maskDate(v))} keyboardType="numeric" maxLength={10}
              placeholder="dd/mm/aaaa" bad={dateBad} autoFocus
              note={dateBad ? "Data inválida. Use dd/mm/aaaa." : undefined} />
            <Field label="Título" hint="opcional" value={title} onChangeText={setTitle}
              placeholder="Ex.: Exame de faixa · Ago/2026" />
            <Field label="Examinador" hint="opcional" value={examinerName} onChangeText={setExaminerName}
              placeholder="Nome do sensei examinador" />
            <Field label="Observações" hint="opcional" value={notes} onChangeText={setNotes}
              placeholder="Detalhes do exame" multiline />
          </ScrollView>

          <View style={styles.footer}>
            <KarateButton
              label={loading ? "Criando..." : "Criar exame e escolher alunos"}
              variant="sumi" size="md" loading={loading} onPress={handleCreate} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; bad?: boolean; note?: string;
  keyboardType?: any; maxLength?: number; autoFocus?: boolean; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <View style={[styles.inputWrap, props.bad && styles.inputBad, props.multiline && styles.inputWrapMultiline]}>
        <TextInput
          style={[styles.input, props.mono && styles.mono, props.multiline && styles.inputMultiline]}
          value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
          placeholderTextColor={P.ink4} keyboardType={props.keyboardType}
          maxLength={props.maxLength} autoFocus={props.autoFocus}
          multiline={props.multiline} numberOfLines={props.multiline ? 3 : undefined}
        />
      </View>
      {props.note ? <Text style={styles.noteBad}>{props.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 6, lineHeight: 18 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  body: { padding: 20, paddingTop: 16, gap: 12 } as ViewStyle,

  field: { marginBottom: 4 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12 } as ViewStyle,
  inputWrapMultiline: { alignItems: "flex-start", paddingVertical: 8 } as ViewStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, paddingVertical: 11, outlineStyle: "none" as any } as TextStyle,
  inputMultiline: { paddingVertical: 0, textAlignVertical: "top" as any, minHeight: 60 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  noteBad: { fontFamily: F.body, fontSize: 11, color: P.red, marginTop: 4 } as TextStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
});
