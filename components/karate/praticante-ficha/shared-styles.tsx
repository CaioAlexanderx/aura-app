// ============================================================
// Estilos compartilhados + subcomponentes primitivos da ficha do praticante.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================
import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";

// ── SectionTitle ─────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionH}>
      <Text style={styles.sectionTtl}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

// ── Row2 ─────────────────────────────────────────────────────
export function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}

// ── Field ─────────────────────────────────────────────────────
export function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; flex2?: boolean; bad?: boolean;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
  inputRef?: React.RefObject<TextInput>; returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }, props.flex2 && { flex: 2 }]}>
      <Text style={styles.label}>
        {props.label}
        {props.req ? <Text style={{ color: P.red }}> *</Text> : null}
        {props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}
      </Text>
      <TextInput
        ref={props.inputRef}
        style={[styles.input, props.mono && styles.mono, props.bad && styles.inputBad]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={P.ink4}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        maxLength={props.maxLength}
        accessibilityLabel={props.label}
        returnKeyType={props.returnKeyType}
        onSubmitEditing={props.onSubmitEditing}
        blurOnSubmit={props.returnKeyType === "done"}
      />
      {props.note ? (
        <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>
          {props.note}
        </Text>
      ) : null}
    </View>
  );
}

// ── Toggle ─────────────────────────────────────────────────────
export function Toggle({ label, hint, on, onPress }: { label: string; hint: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggle, on && styles.toggleOn]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.sw, on && styles.swOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── StyleSheet ────────────────────────────────────────────────
export const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  subMono: { fontFamily: F.mono, fontSize: 12, color: P.red, marginTop: 4 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  repeat: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, marginBottom: 10 } as ViewStyle,
  repeatTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink } as TextStyle,
  repeatHint: { fontFamily: F.body, fontSize: 11, color: P.ink3 } as TextStyle,

  completar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 } as ViewStyle,
  completarTtl: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink2 } as TextStyle,
  completarList: { fontFamily: F.body, fontSize: 12, color: P.ink3, flex: 1 } as TextStyle,

  sectionH: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 6 } as ViewStyle,
  sectionTtl: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  sectionRule: { height: 1, flex: 1, backgroundColor: P.redLine, opacity: 0.4 } as ViewStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  input: { fontFamily: F.body, fontSize: 14, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 11 } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  note: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 4 } as TextStyle,
  noteOk: { color: P.ok } as TextStyle,
  noteBad: { color: P.red } as TextStyle,

  cepBox: { backgroundColor: P.glass, borderWidth: 1, borderColor: P.redLine, borderRadius: R.lg, padding: 14, marginBottom: 12 } as ViewStyle,
  cepLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: P.ink, marginBottom: 7 } as TextStyle,
  cepHint: { fontWeight: "500", color: P.ink3 } as TextStyle,
  cepRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,

  lgpd: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.paper3, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4 } as ViewStyle,
  lgpdTxt: { fontFamily: F.body, fontSize: 11.5, color: P.ink2, flex: 1 } as TextStyle,

  // P6 — foto
  photoRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 } as ViewStyle,
  photoPreview: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", borderWidth: 1, borderColor: P.line2, position: "relative" } as ViewStyle,
  photoImg: { width: 72, height: 72, borderRadius: 36 } as ViewStyle,
  photoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: P.paper3, alignItems: "center", justifyContent: "center" } as ViewStyle,
  photoOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(253,248,242,0.7)", alignItems: "center", justifyContent: "center" } as ViewStyle,
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 } as ViewStyle,
  photoBtnTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink } as TextStyle,

  // P7 — responsável
  guardianNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10 } as ViewStyle,
  guardianNoteTxt: { fontFamily: F.body, fontSize: 12, color: P.ink2, flex: 1 } as TextStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  chipActive: { borderColor: P.red, backgroundColor: P.glass } as ViewStyle,
  chipTxt: { fontFamily: F.body, fontSize: 12.5, color: P.ink2 } as TextStyle,
  chipTxtActive: { color: P.red, fontWeight: "600" } as TextStyle,

  toggle: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 9 } as ViewStyle,
  toggleOn: { borderColor: P.redLine } as ViewStyle,
  sw: { width: 38, height: 22, borderRadius: 999, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line2, justifyContent: "center", padding: 2 } as ViewStyle,
  swOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  knob: { width: 16, height: 16, borderRadius: 999, backgroundColor: "#fff" } as ViewStyle,
  knobOn: { alignSelf: "flex-end" } as ViewStyle,
  toggleLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  toggleHint: { fontFamily: F.body, fontSize: 11, color: P.ink3 } as TextStyle,

  dropdown: { marginTop: 5, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, backgroundColor: P.glassHi, overflow: "hidden" } as ViewStyle,
  dropdownSearch: { fontFamily: F.body, fontSize: 13.5, color: P.ink, borderBottomWidth: 1, borderBottomColor: P.line, paddingHorizontal: 12, paddingVertical: 10 } as TextStyle,
  dropdownEmpty: { fontFamily: F.body, textAlign: "center", color: P.ink3, paddingVertical: 14, fontSize: 13 } as TextStyle,
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  dropdownName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  dropdownMeta: { fontFamily: F.mono, fontSize: 10.5, color: P.ink3, marginTop: 1 } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 12 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 140, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,

  // toast de sucesso (inline, ancorado no rodapé do card)
  toast: { position: "absolute", left: 16, right: 16, bottom: 74, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});
