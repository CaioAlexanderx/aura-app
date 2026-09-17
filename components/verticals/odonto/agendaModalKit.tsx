// ============================================================
// AURA. — Peças comuns dos modais da agenda odonto (mockup 16/09/2026)
//
// - AgendaModalFrame: diálogo centrado no desktop, folha de baixo no
//   celular (< 768 px), com alça e rodapé fixo.
// - AgendaBtn: botões do mockup (primary/outline/danger/wa/ghost); na
//   folha usam 48 px de altura (toque confortável).
// - MessagePreview: prévia da mensagem ancorada abaixo do botão que a
//   abriu (seta), com "Abrir no WhatsApp" e "Copiar texto".
// - StatusBadge: selo com a cor de constants/dentalStatus.
// Tema claro/escuro via DentalColors + IS_DARK_MODE.
// ============================================================
import { ReactNode, useState } from "react";
import {
  Modal, View, Text, Pressable, ActivityIndicator, Platform, ScrollView,
  StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { IS_DARK_MODE } from "@/constants/colors";
import { DentalColors } from "@/constants/dental-tokens";
import { dentalStatus } from "@/constants/dentalStatus";

export const SHEET_BREAKPOINT = 768;

/** Paleta dos modais (tokens do mockup sobre DentalColors). */
export const AC = {
  ...DentalColors,
  modal: IS_DARK_MODE ? "#0b161d" : "#ffffff",
  bg3: IS_DARK_MODE ? "#101c24" : "#f0f1f6",
  border2: IS_DARK_MODE ? "rgba(255,255,255,0.16)" : "rgba(24,23,43,0.18)",
  cyanInk: IS_DARK_MODE ? "#22d3ee" : "#0e7490",
  priBg: IS_DARK_MODE ? "#06B6D4" : "#0891B2",
  priInk: IS_DARK_MODE ? "#03171d" : "#ffffff",
  redInk: IS_DARK_MODE ? "#f87171" : "#b91c1c",
  redBg: IS_DARK_MODE ? "rgba(239,68,68,0.13)" : "rgba(220,38,38,0.10)",
  redBorder: IS_DARK_MODE ? "rgba(239,68,68,0.40)" : "rgba(220,38,38,0.38)",
  wa: IS_DARK_MODE ? "#25D366" : "#16a34a",
  waInk: IS_DARK_MODE ? "#4ade80" : "#15803d",
  waBg: IS_DARK_MODE ? "rgba(37,211,102,0.08)" : "rgba(22,163,74,0.08)",
  waBorder: IS_DARK_MODE ? "rgba(37,211,102,0.45)" : "rgba(22,163,74,0.45)",
  amberInk: IS_DARK_MODE ? "#fcd34d" : "#92400e",
  amberBg: IS_DARK_MODE ? "rgba(251,191,36,0.11)" : "rgba(217,119,6,0.11)",
  amberBorder: IS_DARK_MODE ? "rgba(251,191,36,0.55)" : "rgba(217,119,6,0.55)",
  bubble: IS_DARK_MODE ? "#144d37" : "#dcf8c6",
  bubbleInk: IS_DARK_MODE ? "#e7fbe9" : "#10281a",
  backdrop: IS_DARK_MODE ? "rgba(2,8,12,0.62)" : "rgba(24,23,43,0.34)",
  confirmed: IS_DARK_MODE ? "#10B981" : "#059669",
};

/** true quando a tela é de celular: detalhe/editar/cancelar viram folha de baixo. */
export function useIsSheet(): boolean {
  const { width } = useWindowDimensions();
  return width < SHEET_BREAKPOINT;
}

const webBlur = Platform.OS === "web" ? ({ backdropFilter: "blur(1.5px)", WebkitBackdropFilter: "blur(1.5px)" } as any) : {};

export function AgendaModalFrame({
  visible, onClose, sheet, header, children, footer, testID, maxWidth = 520, banner,
}: {
  visible: boolean;
  onClose: () => void;
  sheet: boolean;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
  maxWidth?: number;
  /** Faixa entre o cabeçalho e o corpo (ex.: alergia). */
  banner?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType={sheet ? "slide" : "fade"} onRequestClose={onClose}>
      <View style={[f.root, sheet ? f.rootSheet : f.rootDialog]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: AC.backdrop }, webBlur]} onPress={onClose} accessibilityLabel="Fechar" />
        <View
          testID={testID}
          style={[f.card, sheet ? f.cardSheet : [f.cardDialog, { maxWidth }]]}
          accessibilityViewIsModal
        >
          {sheet && <View style={f.grab} />}
          {header}
          {banner}
          <ScrollView style={f.scroll} contentContainerStyle={sheet ? f.bodySheet : f.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={[f.foot, sheet && f.footSheet]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

type BtnVariant = "primary" | "outline" | "danger" | "wa" | "waSolid" | "ghost";

export function AgendaBtn({
  label, onPress, variant = "outline", icon, loading, disabled, large, small, testID, style, accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  large?: boolean;
  small?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const v = BTN[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[b.base, small && b.small, large && b.large, v.box, disabled && b.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.ink} />
      ) : icon ? (
        <Icon name={icon} size={small ? 13 : large ? 17 : 15} color={v.ink} />
      ) : null}
      <Text style={[b.text, small && b.textSmall, large && b.textLarge, { color: v.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const BTN: Record<BtnVariant, { box: ViewStyle; ink: string }> = {
  primary: { box: { backgroundColor: AC.priBg, borderColor: AC.priBg }, ink: AC.priInk },
  outline: { box: { backgroundColor: "transparent", borderColor: AC.border2 }, ink: AC.ink },
  danger: { box: { backgroundColor: AC.redBg, borderColor: AC.redBorder }, ink: AC.redInk },
  wa: { box: { backgroundColor: AC.waBg, borderColor: AC.waBorder }, ink: AC.waInk },
  waSolid: { box: { backgroundColor: AC.wa, borderColor: AC.wa }, ink: "#04210f" },
  ghost: { box: { backgroundColor: "transparent", borderColor: "transparent" }, ink: AC.ink2 },
};

export function StatusBadge({ status, onPress, expanded, testID, chevron }: {
  status: string; onPress?: () => void; expanded?: boolean; testID?: string; chevron?: boolean;
}) {
  const st = dentalStatus(status);
  const body = (
    <>
      <View style={[sb.dot, st.dashed ? { borderWidth: 2, borderStyle: "dashed", borderColor: st.color } : { backgroundColor: st.color }]} />
      <Text style={[sb.text, { color: st.color }]}>{st.label}</Text>
      {chevron && <Icon name={expanded ? "chevron_up" : "chevron_down"} size={13} color={st.color} />}
    </>
  );
  const style = [sb.pill, { backgroundColor: st.bg, borderColor: st.color + "73" }];
  if (!onPress) return <View testID={testID} style={style}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${st.label}. Tocar para mudar`}
      accessibilityState={{ expanded: !!expanded }}
    >
      {body}
    </Pressable>
  );
}

/** Copia texto no web; devolve false quando não há área de transferência. */
export function copyText(text: string): boolean {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  return false;
}

export const canCopy = Platform.OS === "web";

/** Botão "Copiar" que vira "Copiado" por 1,4 s. */
export function CopyButton({ text, label = "Copiar texto", testID }: { text: string; label?: string; testID?: string }) {
  const [done, setDone] = useState(false);
  if (!canCopy) return null;
  return (
    <AgendaBtn
      testID={testID}
      small
      variant="ghost"
      icon={done ? "check" : "copy"}
      label={done ? "Copiado" : label}
      onPress={() => {
        if (copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }
      }}
    />
  );
}

/** Caixa ancorada (com seta) logo abaixo do botão que a abriu. */
export function AnchoredBox({ title, children, caretLeft = 26, testID }: {
  title?: string; children: ReactNode; caretLeft?: number | string; testID?: string;
}) {
  return (
    <View testID={testID} style={an.box}>
      <View style={[an.caret, { left: caretLeft as any }]} />
      {title ? <Text style={an.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function MessageBubble({ text }: { text: string }) {
  return (
    <View style={an.bubble}>
      <Text style={an.bubbleText}>{text}</Text>
    </View>
  );
}

export function Hint({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[an.hint, style]}>{children}</Text>;
}

export function FieldLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return <Text style={[an.label, first && { marginTop: 4 }]}>{children}</Text>;
}

export function Chip({ label, on, onPress, testID, fixed }: {
  label: string; on?: boolean; onPress?: () => void; testID?: string; fixed?: boolean;
}) {
  const style = [ch.chip, on && ch.on];
  const text = <Text style={[ch.text, on && ch.textOn]}>{label}</Text>;
  if (fixed || !onPress) return <View testID={testID} style={style}>{text}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
    >
      {text}
    </Pressable>
  );
}

export function CheckRow({ label, value, onChange, testID }: {
  label: string; value: boolean; onChange: (v: boolean) => void; testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      style={ch.check}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View style={[ch.box, value && ch.boxOn]}>{value && <Icon name="check" size={12} color={AC.priInk} />}</View>
      <Text style={ch.checkText}>{label}</Text>
    </Pressable>
  );
}

const f = StyleSheet.create({
  root: { flex: 1 },
  rootDialog: { alignItems: "center", justifyContent: "flex-start", paddingTop: "7%" as any, paddingHorizontal: 16 },
  rootSheet: { justifyContent: "flex-end" },
  card: { backgroundColor: AC.modal, borderWidth: 1, borderColor: AC.border2, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 20 }, elevation: 12 },
  cardDialog: { width: "100%", borderRadius: 20, maxHeight: "86%" as any },
  cardSheet: { width: "100%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomWidth: 0, maxHeight: "94%" as any },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: AC.border2, alignSelf: "center", marginTop: 8 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18 },
  bodySheet: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: AC.border },
  footSheet: { flexDirection: "column", alignItems: "stretch", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22 },
});

const b = StyleSheet.create({
  base: { minHeight: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  small: { minHeight: 30, paddingHorizontal: 10, borderRadius: 8 },
  large: { minHeight: 48, borderRadius: 12 },
  disabled: { opacity: 0.4 },
  text: { fontSize: 13, fontWeight: "600" },
  textSmall: { fontSize: 12 },
  textLarge: { fontSize: 15 },
});

const sb = StyleSheet.create({
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingLeft: 8, paddingRight: 10, paddingVertical: 4, minHeight: 28 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  text: { fontSize: 12, fontWeight: "700" },
});

const an = StyleSheet.create({
  box: { position: "relative", marginTop: 10, borderWidth: 1, borderColor: AC.border2, backgroundColor: AC.bg3, borderRadius: 12, padding: 12 },
  caret: { position: "absolute", top: -7, width: 12, height: 12, backgroundColor: AC.bg3, borderLeftWidth: 1, borderTopWidth: 1, borderColor: AC.border2, transform: [{ rotate: "45deg" }] },
  title: { fontSize: 12, color: AC.ink2, fontWeight: "600", marginBottom: 8 },
  bubble: { backgroundColor: AC.bubble, borderRadius: 10, borderBottomLeftRadius: 2, paddingHorizontal: 11, paddingVertical: 9 },
  bubbleText: { color: AC.bubbleInk, fontSize: 13, lineHeight: 19 },
  hint: { fontSize: 11.5, color: AC.ink3, marginTop: 5 },
  label: { fontSize: 12, fontWeight: "600", color: AC.ink2, letterSpacing: 0.2, marginTop: 14, marginBottom: 5 },
});

const ch = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: AC.border2, backgroundColor: AC.bg3, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, minHeight: 36, justifyContent: "center" },
  on: { backgroundColor: AC.cyanDim, borderColor: AC.cyan },
  text: { fontSize: 13, fontWeight: "600", color: AC.ink },
  textOn: { color: AC.cyanInk },
  check: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, minHeight: 32 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: AC.border2, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: AC.priBg, borderColor: AC.priBg },
  checkText: { fontSize: 13, color: AC.ink, flexShrink: 1 },
});
