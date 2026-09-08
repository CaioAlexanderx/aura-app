// ============================================================
// AURA. — Cadastro de item (wizard) · peças visuais compartilhadas
//
// Campo, Chip, Nota, StoreNote, AccordionCard e a folha de estilo que
// os três passos usam. Tudo derivado do mockup v3.
// ============================================================
import type { ReactNode } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { ChipStatus, SaveState } from "./types";

export const IS_WEB = Platform.OS === "web";

export function rotuloSalvando(st: SaveState): string {
  return st === "busy" ? "Salvando…" : st === "done" ? "✓ Salvo" : "";
}

// ── campo com rótulo ────────────────────────────────────────
export function Campo({
  label, required, optional, children, style,
}: {
  label: string;
  required?: boolean;
  optional?: string;
  children: ReactNode;
  style?: any;
}) {
  return (
    <View style={[s.campo, style]}>
      <View style={s.rotuloRow}>
        <Text style={s.rotulo}>
          {label}
          {required ? <Text style={{ color: Colors.red }}> *</Text> : null}
        </Text>
        {optional ? <Text style={s.rotuloOpt}>{optional}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ── chip clicável ───────────────────────────────────────────
export function Chip({
  label, active, onPress, dashed, icon, swatch, onRemove, removeLabel,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  dashed?: boolean;
  icon?: string;
  swatch?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <View style={[s.chip, active && s.chipAtivo, dashed && s.chipTracejado]}>
      <Pressable onPress={onPress} style={s.chipMain} accessibilityLabel={label}>
        {swatch ? <View style={[s.swatch, { backgroundColor: swatch }]} /> : null}
        {icon ? <Icon name={icon as any} size={12} color={active || dashed ? Colors.violet3 : Colors.ink3} /> : null}
        <Text style={[s.chipTxt, active && s.chipTxtAtivo, dashed && s.chipTxtAtivo]}>{label}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={removeLabel || ("Remover " + label)}>
          <Text style={s.chipRm}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── notas ───────────────────────────────────────────────────
export function Nota({ children, tom = "violet", icon = "info" }: { children: ReactNode; tom?: "violet" | "amber"; icon?: string }) {
  const amber = tom === "amber";
  return (
    <View style={[s.nota, amber && s.notaAmbar]}>
      <Icon name={icon as any} size={14} color={amber ? Colors.amber : Colors.violet3} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// Aviso âmbar "isto vai para a sua loja online".
export function StoreNote({ texto }: { texto: string }) {
  return (
    <Nota tom="amber" icon="shopping_bag">
      <Text style={s.notaTxt}>
        <Text style={s.notaForte}>Vai para a sua loja online.</Text> {texto}
      </Text>
    </Nota>
  );
}

// ── cartão sanfona do passo 3 ───────────────────────────────
// O conteúdo NUNCA desmonta: alternamos `display` pra que abrir/fechar
// não remonte a ScrollView nem zere o scroll (e pra que a grade de
// variações não recarregue a cada toque).
export function AccordionCard({
  icon, titulo, subtitulo, status, aberto, onToggle, saveState, children, narrow,
}: {
  icon: string;
  titulo: string;
  subtitulo: string;
  status: ChipStatus;
  aberto: boolean;
  onToggle: () => void;
  saveState?: SaveState;
  children: ReactNode;
  narrow?: boolean;
}) {
  const salvando = rotuloSalvando(saveState || null);
  return (
    <View style={s.acc}>
      <Pressable onPress={onToggle} style={s.accHead} accessibilityLabel={titulo}>
        <View style={s.accIco}><Icon name={icon as any} size={15} color={Colors.violet3} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.accTitulo}>{titulo}</Text>
          {!narrow && <Text style={s.accSub} numberOfLines={1}>{subtitulo}</Text>}
        </View>
        {salvando ? (
          <Text style={[s.accSalvo, saveState === "busy" && { color: Colors.ink3 }]}>{salvando}</Text>
        ) : null}
        <View style={[s.accSt, status.tom === "ok" && s.accStOk, status.tom === "rec" && s.accStRec]}>
          <Text
            style={[
              s.accStTxt,
              status.tom === "ok" && { color: Colors.green },
              status.tom === "rec" && { color: Colors.amber },
            ]}
            numberOfLines={1}
          >
            {status.texto}
          </Text>
        </View>
        <Icon name={aberto ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
      </Pressable>
      <View style={[s.accBody, !aberto && ({ display: "none" } as any)]}>{children}</View>
    </View>
  );
}

// ── input padrão ────────────────────────────────────────────
export function Entrada(props: any) {
  const { style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={Colors.ink3}
      {...rest}
      style={[s.input, IS_WEB ? ({ outlineStyle: "none" } as any) : null, style]}
    />
  );
}

export function MiniBtn({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[s.mini, disabled && s.miniOff]}>
      <Text style={[s.miniTxt, disabled && { color: Colors.ink3 }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  campo: { marginBottom: 14 },
  rotuloRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  rotulo: { fontSize: 11.5, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.2 },
  rotuloOpt: { fontSize: 11, color: Colors.ink3, fontWeight: "500", opacity: 0.85 },
  input: {
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13.5, color: Colors.ink,
  },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 5, lineHeight: 15 },
  link: { color: Colors.violet3, fontWeight: "700" },
  linha2: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border,
  },
  chipMain: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipTracejado: { borderStyle: "dashed" as any, borderColor: Colors.border2 },
  chipTxt: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTxtAtivo: { color: Colors.violet3, fontWeight: "700" },
  chipRm: { fontSize: 14, color: Colors.ink3, lineHeight: 15, paddingHorizontal: 2 },
  swatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  nota: {
    flexDirection: "row", gap: 9, alignItems: "flex-start",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  notaAmbar: { backgroundColor: Colors.amberD, borderColor: "rgba(251,191,36,0.35)" },
  notaTxt: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  notaForte: { color: Colors.ink, fontWeight: "700" },
  acc: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg4, marginBottom: 10, overflow: "hidden",
  },
  accHead: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  accIco: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  accTitulo: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" },
  accSub: { fontSize: 11.5, color: Colors.ink3, marginTop: 1 },
  accSalvo: { fontSize: 11, fontWeight: "700", color: Colors.green },
  accSt: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, flexShrink: 0,
  },
  accStOk: { backgroundColor: Colors.greenD, borderColor: "rgba(52,211,153,0.3)" },
  accStRec: { backgroundColor: Colors.amberD, borderColor: "rgba(251,191,36,0.35)" },
  accStTxt: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3, color: Colors.ink3, textTransform: "uppercase" },
  accBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  mini: {
    borderRadius: 8, paddingHorizontal: 12, justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  miniOff: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  miniTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

export default s;
