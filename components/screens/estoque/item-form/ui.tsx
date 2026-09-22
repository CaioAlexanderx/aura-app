// ============================================================
// AURA. — Cadastro de item (aberto) · peças visuais compartilhadas
//
// Campo, Chip, Nota, StoreNote, Entrada, MiniBtn e a Secao — o cartão de
// cabeçalho fino que substituiu a sanfona do wizard. Tudo derivado do
// mockup v4 (Aura/mockup_cadastro_item_v4_aberto.html).
//
// Não existe mais AccordionCard: no formulário aberto NADA fecha. O que
// era "abrir o cartão pra ver" virou "olhar" — e o selo no cabeçalho de
// cada seção diz, sem abrir nada, o que ainda falta.
// ============================================================
import type { ReactNode } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Selo } from "./types";

export const IS_WEB = Platform.OS === "web";

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

// Aviso âmbar "isto vai para a sua loja online". 22/09/2026 (perfil de
// cadastro): `lojaOnline={false}` tira a frase da loja online e deixa só
// o texto — o Matcon não fala em loja online nas fotos.
export function StoreNote({ texto, lojaOnline = true }: { texto: string; lojaOnline?: boolean }) {
  return (
    <Nota tom="amber" icon="shopping_bag">
      {lojaOnline ? (
        <Text style={s.notaTxt}>
          <Text style={s.notaForte}>Vai para a sua loja online.</Text> {texto}
        </Text>
      ) : (
        <Text style={s.notaTxt}>{texto}</Text>
      )}
    </Nota>
  );
}

// ── opção de rádio ──────────────────────────────────────────
// Um cartão com bolinha. `descricao` (opcional) é a linha pequena de baixo.
// Sempre um botão à vista: nada depende de hover.
export function Radio({
  ativo, titulo, descricao, onPress,
}: {
  ativo: boolean;
  titulo: string;
  descricao?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[fr.rd, ativo && fr.rdAtivo]} accessibilityLabel={titulo}>
      <View style={[fr.rad, ativo && fr.radAtivo]}>{ativo ? <View style={fr.radDot} /> : null}</View>
      {descricao ? (
        <View style={{ flexShrink: 1 }}>
          <Text style={[fr.rdTxt, ativo && { fontWeight: "700" }]}>{titulo}</Text>
          <Text style={fr.rdDesc}>{descricao}</Text>
        </View>
      ) : (
        <Text style={[fr.rdTxt, ativo && { fontWeight: "700" }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

// ── seção aberta ────────────────────────────────────────────
// Cabeçalho fino (ícone, título, selo) e o corpo sempre à vista. Nada
// desmonta, nada colapsa: no formulário aberto o custo de "ver" é zero.
export function Secao({
  icon, titulo, selo, children, style,
}: {
  icon: string;
  titulo: string;
  selo?: Selo;
  children: ReactNode;
  style?: any;
}) {
  return (
    <View style={[s.sec, style]}>
      <View style={s.secHead}>
        <View style={s.secIco}><Icon name={icon as any} size={14} color={Colors.violet3} /></View>
        <Text style={s.secTitulo} numberOfLines={1}>{titulo}</Text>
        {selo ? (
          <View style={[
            s.selo,
            selo.tom === "ok" && s.seloOk,
            selo.tom === "rec" && s.seloRec,
            selo.tom === "err" && s.seloErr,
          ]}>
            <Text
              style={[
                s.seloTxt,
                selo.tom === "ok" && { color: Colors.green },
                selo.tom === "rec" && { color: Colors.amber },
                selo.tom === "err" && { color: Colors.red },
              ]}
              numberOfLines={1}
            >
              {selo.texto}
            </Text>
          </View>
        ) : null}
      </View>
      {children}
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
  campo: { marginBottom: 12 },
  rotuloRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  rotulo: { fontSize: 11.5, color: Colors.ink3, fontWeight: "600", letterSpacing: 0.2 },
  rotuloOpt: { fontSize: 11, color: Colors.ink3, fontWeight: "500", opacity: 0.85 },
  input: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13.5, color: Colors.ink,
  },
  inputGrande: { fontSize: 15, paddingVertical: 12, fontWeight: "500" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 5, lineHeight: 15 },
  link: { color: Colors.violet3, fontWeight: "700" },
  linha2: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
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
  sec: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg4, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14,
  },
  secHead: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  secIco: {
    width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  secTitulo: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "700" },
  selo: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, flexShrink: 0,
  },
  seloOk: { backgroundColor: Colors.greenD, borderColor: "rgba(52,211,153,0.3)" },
  seloRec: { backgroundColor: Colors.amberD, borderColor: "rgba(251,191,36,0.35)" },
  seloErr: { backgroundColor: Colors.redD, borderColor: "rgba(248,113,113,0.35)" },
  seloTxt: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3, color: Colors.ink3, textTransform: "uppercase" },
  mini: {
    borderRadius: 8, paddingHorizontal: 12, justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  miniOff: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  miniTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

// 22/09/2026 (Matcon M0, perfil de cadastro) — a "frase com número
// editável no meio" (docs/mockups/matcon-modulo.html): uma linha que se lê
// como português, não um formulário. "Compro por", "Tenho … em estoque",
// "Cada m² pesa …". E as opções de rádio.
export const fr = {
  frase: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6 },
  fraseTxt: { fontSize: 13, color: Colors.ink2 },
  fraseMono: { fontSize: 11.5, color: Colors.ink3, fontFamily: IS_WEB ? ("monospace" as const) : undefined },
  fraseChip: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet,
  },
  fraseChipTxt: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.violet3 },
  fraseInput: {
    width: 70, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, textAlign: "center" as const,
  },
  radios: { flexDirection: "row" as const, gap: 6 },
  rd: {
    flex: 1, flexDirection: "row" as const, gap: 8, alignItems: "center" as const,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: Colors.bg3, borderWidth: 1.5, borderColor: Colors.border,
  },
  rdAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  rdTxt: { fontSize: 12.5, color: Colors.ink, flexShrink: 1 },
  rdDesc: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  rad: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  radAtivo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  radDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
};

export default s;
