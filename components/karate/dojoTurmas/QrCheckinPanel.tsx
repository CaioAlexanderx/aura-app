// ============================================================
// QrCheckinPanel — check-in por QR na chamada (F4; F9: QR único do
// dojô + janela de tolerância)
//
// Sem câmera (sem dependência nova): TextInput autofocus estilo
// "scanner" — o leitor de QR físico (USB/Bluetooth, comum em recepções)
// digita no campo como um teclado e Enter dispara o check-in. Colar o
// token manualmente também funciona. Visível só quando
// settings.qr_checkin_enabled (checado por app/karate/(dojo)/turmas.tsx).
//
// QA 27/07 (item 4): o campo só limpava depois de SUCESSO — com leitor
// físico, um erro (ex.: NOT_ENROLLED) deixava o texto no campo e o
// próximo bipe concatenava em cima, gerando erro em cascata. O campo
// limpa SEMPRE (sucesso ou erro) e o foco volta pro input em qualquer
// desfecho — ISSO NÃO MUDA no F9.
//
// F9 — dois formatos de QR chegam pelo MESMO campo:
//   • QR pessoal do aluno — já identifica o aluno, funciona como sempre.
//   • QR único do dojô — o backend responde 422 STUDENT_ID_REQUIRED
//     (sem aluno embutido no token). O painel guarda o token EM ESTADO
//     (nunca no campo visível, que já limpou) e mostra um campo "ID do
//     aluno" pra reenviar o mesmo check-in com o aluno informado.
// Em qualquer um dos dois formatos, se houver 2+ turmas dentro da
// janela de tolerância, o backend responde 409 AMBIGUOUS_CLASS com as
// candidatas — o painel mostra os botões e reenvia com class_id
// explícito assim que o operador escolher (o componente NUNCA escolhe
// sozinho, só repassa a decisão de quem bipou/está na recepção).
// ============================================================
import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoClassesApi, DojoCheckinResult, DojoCheckinCandidate } from "@/services/karateDojoClassesApi";
import { mapClassesError } from "./helpers";

interface Props {
  federationId: string;
}

export function QrCheckinPanel({ federationId }: Props) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DojoCheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // F9 — token pendente de resolução (QR único sem aluno, ou ambiguidade
  // de turma). NUNCA fica no campo visível — esse já limpou.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [studentIdNeeded, setStudentIdNeeded] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [candidates, setCandidates] = useState<DojoCheckinCandidate[] | null>(null);
  const studentInputRef = useRef<TextInput>(null);

  function resetPending() {
    setPendingToken(null);
    setStudentIdNeeded(false);
    setStudentIdInput("");
    setCandidates(null);
  }

  // Núcleo compartilhado pelos 3 gatilhos (bipe novo, confirmar aluno,
  // escolher turma candidata) — trata os DOIS desfechos "preciso de mais
  // informação" (STUDENT_ID_REQUIRED, AMBIGUOUS_CLASS) sem nunca decidir
  // por conta própria.
  async function runCheckin(opts: { token: string; studentId?: string; classId?: string }) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await karateDojoClassesApi.checkin(federationId, opts.token, opts.classId, opts.studentId);
      setResult(res);
      resetPending();
    } catch (e: any) {
      const mapped = mapClassesError(e);
      if (mapped.code === "STUDENT_ID_REQUIRED") {
        setPendingToken(opts.token);
        setStudentIdNeeded(true);
        setCandidates(null);
        setTimeout(() => studentInputRef.current?.focus(), 0);
      } else if (mapped.code === "AMBIGUOUS_CLASS" && Array.isArray(e?.data?.candidates) && e.data.candidates.length) {
        setPendingToken(opts.token);
        setCandidates(e.data.candidates);
        setStudentIdNeeded(false);
      } else {
        resetPending();
        setError(mapped.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doCheckin() {
    const t = token.trim();
    if (!t || busy) return;
    try {
      await runCheckin({ token: t });
    } finally {
      // Limpa SEMPRE (sucesso ou erro) — senão o próximo bipe do leitor
      // físico concatena em cima do texto anterior e gera erro em cascata.
      setToken("");
      if (Platform.OS === "web") inputRef.current?.focus();
    }
  }

  async function confirmStudentId() {
    const sid = studentIdInput.trim();
    if (!sid || !pendingToken || busy) return;
    await runCheckin({ token: pendingToken, studentId: sid });
  }

  async function pickCandidate(classId: string) {
    if (!pendingToken || busy) return;
    // Se o token pendente era o QR único, studentIdInput já foi informado
    // antes de chegar à ambiguidade — reenvia junto (omitido se vazio, ex.:
    // ambiguidade vinda do QR pessoal, que já identifica o aluno sozinho).
    await runCheckin({ token: pendingToken, classId, studentId: studentIdInput.trim() || undefined });
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="qr_code" size={16} color={KarateColors.primary} />
        <Text style={styles.title}>Check-in por QR</Text>
      </View>
      <Text style={styles.sub}>
        Aponte o leitor de QR (ou cole o código) no campo abaixo e pressione Enter. Cada aluno tem um QR próprio na ficha dele — ou use o QR único do dojô (em Configurações) e informe o aluno quando pedido.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={token}
          onChangeText={setToken}
          onSubmitEditing={doCheckin}
          placeholder="Aguardando leitura…"
          placeholderTextColor={KarateColors.ink4}
          autoFocus={Platform.OS === "web"}
          blurOnSubmit={false}
          accessibilityLabel="Código do QR"
        />
        <TouchableOpacity
          style={[styles.goBtn, (busy || !token.trim()) && styles.goBtnDisabled]}
          onPress={doCheckin}
          disabled={busy || !token.trim()}
          accessibilityRole="button"
          accessibilityLabel="Confirmar check-in"
        >
          {busy ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Icon name="check" size={16} color="#fdf8f2" />}
        </TouchableOpacity>
      </View>

      {studentIdNeeded && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTxt}>Esse é o QR único do dojô — informe o aluno para confirmar a presença.</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={studentInputRef}
              style={styles.input}
              value={studentIdInput}
              onChangeText={setStudentIdInput}
              onSubmitEditing={confirmStudentId}
              placeholder="ID do aluno"
              placeholderTextColor={KarateColors.ink4}
              accessibilityLabel="ID do aluno"
            />
            <TouchableOpacity
              style={[styles.goBtn, (busy || !studentIdInput.trim()) && styles.goBtnDisabled]}
              onPress={confirmStudentId}
              disabled={busy || !studentIdInput.trim()}
              accessibilityRole="button"
              accessibilityLabel="Confirmar aluno"
            >
              {busy ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Icon name="check" size={16} color="#fdf8f2" />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!candidates && candidates.length > 0 && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTxt}>Mais de uma turma possível agora — escolha qual:</Text>
          {candidates.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.candidateBtn}
              onPress={() => pickCandidate(c.id)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Escolher turma ${c.name}`}
            >
              <Text style={styles.candidateTxt}>{c.name}</Text>
              {!!(c.start_time || c.end_time) && (
                <Text style={styles.candidateMeta}>{[c.start_time, c.end_time].filter(Boolean).join(" – ")}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!error && (
        <View style={[styles.resultBox, styles.resultErr]}>
          <Icon name="alert" size={16} color={KarateColors.danger} />
          <Text style={styles.resultErrTxt}>{error}</Text>
        </View>
      )}

      {!!result && (
        <View style={[styles.resultBox, styles.resultOk]}>
          <Icon name={result.already_checked ? "info" : "check_circle"} size={20} color={KarateColors.ok} />
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName}>{result.student.full_name}</Text>
            <Text style={styles.resultMeta}>
              {[result.student.belt_label, result.class.name].filter(Boolean).join(" · ")}
            </Text>
            {result.already_checked && <Text style={styles.resultAlready}>Check-in já registrado hoje.</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.primaryLine, padding: 14, gap: 8 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  title: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sub: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  inputRow: { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,
  input: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: KarateColors.border,
    borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: KarateColors.ink,
  } as TextStyle,
  goBtn: { width: 44, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.ink, alignItems: "center", justifyContent: "center" } as ViewStyle,
  goBtnDisabled: { opacity: 0.4 } as ViewStyle,
  pendingBox: { gap: 6, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, padding: 10 } as ViewStyle,
  pendingTxt: { fontSize: 12.5, color: KarateColors.ink2, fontWeight: "600" } as TextStyle,
  candidateBtn: { backgroundColor: "#fff", borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingVertical: 10, paddingHorizontal: 12 } as ViewStyle,
  candidateTxt: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  candidateMeta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  resultBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: KarateRadius.sm, borderWidth: 1, padding: 10 } as ViewStyle,
  resultOk: { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.okLine } as ViewStyle,
  resultErr: { backgroundColor: KarateColors.dangerSoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  resultErrTxt: { flex: 1, fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  resultName: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  resultMeta: { fontSize: 12, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  resultAlready: { fontSize: 11.5, color: KarateColors.warn, marginTop: 2, fontWeight: "600" } as TextStyle,
});
