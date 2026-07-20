// ============================================================
// QrCheckinPanel — check-in por QR na chamada (F4)
//
// Sem câmera (sem dependência nova): TextInput autofocus estilo
// "scanner" — o leitor de QR físico (USB/Bluetooth, comum em recepções)
// digita no campo como um teclado e Enter dispara o check-in. Colar o
// token manualmente também funciona. Visível só quando
// settings.qr_checkin_enabled (checado por app/karate/(dojo)/turmas.tsx).
// ============================================================
import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { karateDojoClassesApi, DojoCheckinResult } from "@/services/karateDojoClassesApi";
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

  async function doCheckin() {
    const t = token.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await karateDojoClassesApi.checkin(federationId, t);
      setResult(res);
      setToken("");
    } catch (e: any) {
      setError(mapClassesError(e).message);
    } finally {
      setBusy(false);
      if (Platform.OS === "web") inputRef.current?.focus();
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="qr_code" size={16} color={KarateColors.primary} />
        <Text style={styles.title}>Check-in por QR</Text>
      </View>
      <Text style={styles.sub}>
        Aponte o leitor de QR (ou cole o código) no campo abaixo e pressione Enter. Cada aluno tem um QR próprio na ficha dele.
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
          accessibilityLabel="Código do QR do aluno"
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
  resultBox: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: KarateRadius.sm, borderWidth: 1, padding: 10 } as ViewStyle,
  resultOk: { backgroundColor: KarateColors.okSoft, borderColor: KarateColors.okLine } as ViewStyle,
  resultErr: { backgroundColor: KarateColors.dangerSoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  resultErrTxt: { flex: 1, fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  resultName: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  resultMeta: { fontSize: 12, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  resultAlready: { fontSize: 11.5, color: KarateColors.warn, marginTop: 2, fontWeight: "600" } as TextStyle,
});
