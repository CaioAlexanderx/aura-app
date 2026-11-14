// ============================================================
// AURA. — Peças visuais do assistente da NF-e 55 (CP4, 14/11/2026).
// Campo com rótulo (amarelo quando falta), opção de rádio grande (44 px,
// sem hover), faixa de aviso e cartão. Tokens de constants/colors.ts.
// ============================================================
import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, type KeyboardTypeOptions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Faltante } from "@/services/nfe55Api";

export function Cartao({ titulo, sub, children, testID }: { titulo?: string; sub?: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={p.card} testID={testID}>
      {titulo ? <Text style={p.cardT}>{titulo}</Text> : null}
      {sub ? <Text style={p.cardS}>{sub}</Text> : null}
      {children}
    </View>
  );
}

export function Campo({
  rotulo, valor, onChange, falta, placeholder, teclado, mono, dica, testID, multiline,
}: {
  rotulo: string; valor: string; onChange: (v: string) => void; falta?: Faltante | null;
  placeholder?: string; teclado?: KeyboardTypeOptions; mono?: boolean; dica?: string; testID?: string; multiline?: boolean;
}) {
  return (
    <View style={p.fld}>
      <Text style={p.lab}>{rotulo}</Text>
      <TextInput
        testID={testID}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.ink3}
        keyboardType={teclado}
        multiline={multiline}
        style={[p.inp, mono && p.mono, multiline && { minHeight: 64, textAlignVertical: "top" as any }, falta && p.inpFalta]}
        accessibilityLabel={rotulo}
      />
      {falta ? (
        <Text style={p.hintFalta} testID={testID ? testID + "-falta" : undefined}>{falta.tipo === "invalido" ? falta.mensagem : "Falta: " + falta.mensagem}</Text>
      ) : dica ? <Text style={p.hint}>{dica}</Text> : null}
    </View>
  );
}

export function Opcao({ ligada, titulo, texto, onPress, testID, children }: {
  ligada: boolean; titulo: string; texto?: string; onPress: () => void; testID?: string; children?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[p.opt, ligada && p.optOn]} accessibilityRole="radio" accessibilityState={{ checked: ligada }} testID={testID}>
      <View style={[p.rad, ligada && p.radOn]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={p.optT}>{titulo}</Text>
        {texto ? <Text style={p.optS}>{texto}</Text> : null}
        {children}
      </View>
    </Pressable>
  );
}

export type Tom = "violeta" | "ambar" | "verde" | "vermelho";
const TONS: Record<Tom, { bg: string; borda: string; cor: string; icone: string }> = {
  violeta: { bg: Colors.violetD, borda: Colors.border2, cor: Colors.violet3, icone: "info" },
  ambar: { bg: "rgba(217,119,6,0.09)", borda: "rgba(217,119,6,0.35)", cor: Colors.amber, icone: "alert" },
  verde: { bg: "rgba(5,150,105,0.09)", borda: "rgba(5,150,105,0.3)", cor: Colors.green, icone: "check_circle" },
  vermelho: { bg: "rgba(220,38,38,0.07)", borda: "rgba(220,38,38,0.3)", cor: Colors.red, icone: "alert_circle" },
};

export function Faixa({ tom, titulo, texto, testID, children }: { tom: Tom; titulo: string; texto?: string; testID?: string; children?: React.ReactNode }) {
  const t = TONS[tom];
  return (
    <View style={[p.banner, { backgroundColor: t.bg, borderColor: t.borda }]} testID={testID}>
      <Icon name={t.icone as any} size={18} color={t.cor} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={p.bannerT}>{titulo}</Text>
        {texto ? <Text style={p.bannerS}>{texto}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <View style={[p.tot, forte && p.totBig]}>
      <Text style={[p.totL, forte && p.totBigTxt]}>{rotulo}</Text>
      <Text style={[p.totV, forte && p.totBigTxt, forte && { color: Colors.green }]}>{valor}</Text>
    </View>
  );
}

export function BotaoSec({ titulo, onPress, testID, icone, desligado }: { titulo: string; onPress: () => void; testID?: string; icone?: string; desligado?: boolean }) {
  return (
    <Pressable onPress={desligado ? undefined : onPress} style={[p.btnSec, desligado && { opacity: 0.45 }]} testID={testID} accessibilityRole="button" disabled={desligado}>
      {icone ? <Icon name={icone as any} size={14} color={Colors.violet3} /> : null}
      <Text style={p.btnSecTxt}>{titulo}</Text>
    </Pressable>
  );
}

export const p = StyleSheet.create({
  card: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, flex: 1, minWidth: 0 },
  cardT: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  cardS: { fontSize: 12.5, color: Colors.ink3, marginBottom: 12 },
  fld: { marginBottom: 12, minWidth: 0 },
  lab: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: Colors.ink3, marginBottom: 5 },
  inp: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink },
  mono: { fontFamily: "monospace" as any },
  inpFalta: { borderColor: Colors.amber, backgroundColor: "rgba(217,119,6,0.09)" },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 4 },
  hintFalta: { fontSize: 11.5, color: Colors.amber, fontWeight: "600", marginTop: 4 },
  opt: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: Colors.bg3, marginBottom: 8, minHeight: 44 },
  optOn: { borderColor: Colors.violet },
  rad: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: Colors.border2, marginTop: 2 },
  radOn: { borderWidth: 5, borderColor: Colors.violet },
  optT: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  optS: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  banner: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  bannerT: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  bannerS: { fontSize: 13, color: Colors.ink2, lineHeight: 18 },
  tot: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  totL: { fontSize: 13, color: Colors.ink2 },
  totV: { fontSize: 13, color: Colors.ink2, textAlign: "right", flexShrink: 1 },
  totBig: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 12 },
  totBigTxt: { fontSize: 17, fontWeight: "800", color: Colors.ink },
  btnSec: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  btnSecTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  grid: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  muted: { fontSize: 12.5, color: Colors.ink3 },
});
