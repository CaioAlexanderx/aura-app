import { View, Text, StyleSheet, TextInput, Pressable, Dimensions, Platform, Switch } from "react-native";
import Svg, { Path, Circle, Rect, Ellipse } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

// v2: aba Design pra cores, tipografia, cards, banners, service strip
export const TABS = ["Meu Site", "Design", "Vitrine", "Entrega", "Pedidos"];

export const COLOR_PRESETS = ["#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#0891b2", "#374151"];

export const PALETTE_PRESETS: Array<[string, string, string]> = [
  ["#3a5a47", "#c47a51", "Botânica"],
  ["#7c3aed", "#a78bfa", "Aura (violeta)"],
  ["#0a4d5c", "#e8a14b", "Atlântico"],
  ["#7a1f3a", "#e8b5a0", "Bordô"],
  ["#1a1612", "#c5a679", "Tinta"],
  ["#c47a51", "#3a5a47", "Terracota"],
];

export const ACCENT_PRESETS = ["#c47a51", "#a78bfa", "#e8a14b", "#e8b5a0", "#c5a679", "#5a8a6f", "#d76b6b", "#2e4a8c"];

export const FONT_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "classic", label: "Instrument", hint: "Serif clássica, elegante" },
  { value: "modern",  label: "Fraunces",   hint: "Serif moderna, com peso" },
  { value: "humanist", label: "DM Sans",   hint: "Sans humanista, calorosa" },
];

export const CARD_STYLES: Array<{ value: string; label: string; hint: string }> = [
  { value: "editorial",   label: "Editorial", hint: "Foto + nome serif" },
  { value: "minimal",     label: "Minimal",   hint: "Compacto, sem destaque" },
  { value: "image-heavy", label: "Imagem",    hint: "Foto cheia, info overlay" },
];

export const BANNER_TONES: Array<{ value: string; label: string }> = [
  { value: "split",     label: "Dividido" },
  { value: "editorial", label: "Editorial" },
  { value: "centered",  label: "Centrado" },
];

export const BANNER_TINTS: Array<{ value: string; label: string }> = [
  { value: "brand",  label: "Primária" },
  { value: "accent", label: "Destaque" },
];

// Ícones disponíveis para service cards (espelha ALLOWED_ICONS no backend)
export const SERVICE_ICONS: Array<{ value: string; label: string }> = [
  { value: "truck",   label: "Entrega" },
  { value: "pkg",     label: "Embalagem" },
  { value: "shield",  label: "Segurança" },
  { value: "sparkle", label: "Estrela" },
  { value: "leaf",    label: "Folha" },
  { value: "heart",   label: "Coração" },
  { value: "pix",     label: "Pix" },
  { value: "card",    label: "Cartão" },
  { value: "receipt", label: "Recibo" },
  { value: "bag",     label: "Sacola" },
  { value: "user",    label: "Cliente" },
];

// Mini SVG inline pra preview do ícone na UI do editor
export function ServiceIconPreview({ icon, size = 18, color = Colors.violet3 }: { icon: string; size?: number; color?: string }) {
  const sw = 1.6;
  switch (icon) {
    case "truck":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 16V6h12v10M15 9h4l2 4v3h-6"/>
        <Circle cx={7} cy={18} r={2}/><Circle cx={17} cy={18} r={2}/>
      </Svg>;
    case "pkg":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 7v10l9 4 9-4V7l-9-4-9 4z"/><Path d="M3 7l9 4 9-4M12 11v10"/>
      </Svg>;
    case "shield":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/>
      </Svg>;
    case "leaf":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 3c-7 0-13 4-13 12v6M21 3c0 7-4 13-12 13"/>
      </Svg>;
    case "heart":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.7A4 4 0 0119 10c0 5.5-7 10-7 10z"/>
      </Svg>;
    case "pix":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="m12 3 9 9-9 9-9-9 9-9z"/><Path d="M9 12h6M12 9v6"/>
      </Svg>;
    case "card":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={6} width={18} height={12} rx={2}/><Path d="M3 10h18M7 15h2"/>
      </Svg>;
    case "receipt":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><Path d="M9 8h6M9 12h6M9 16h4"/>
      </Svg>;
    case "bag":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M5 7h14l-1 13H6L5 7z"/><Path d="M9 7V5a3 3 0 016 0v2"/>
      </Svg>;
    case "user":
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={8} r={4}/><Path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
      </Svg>;
    case "sparkle":
    case "star":
    default:
      return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6-4.4-4.2 6-.8L12 3z"/>
      </Svg>;
  }
}

export function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={cs.field}>
      <Text style={cs.fieldLabel}>{label}</Text>
      <TextInput style={[cs.input, multiline && cs.textarea]} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={Colors.ink3} multiline={multiline} numberOfLines={multiline ? 3 : 1} />
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={cs.sectionTitle}>{title}</Text>;
}

export function ChipToggle({ options, value, onChange }: {
  options: Array<{ value: string; label: string; hint?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={cs.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)}
            style={[cs.chip, active && cs.chipActive]}>
            <Text style={[cs.chipText, active && cs.chipTextActive]}>{o.label}</Text>
            {o.hint && <Text style={[cs.chipHint, active && cs.chipHintActive]}>{o.hint}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <View style={cs.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={cs.switchLabel}>{label}</Text>
        {hint && <Text style={cs.switchHint}>{hint}</Text>}
      </View>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.violet }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: "Ativo", bg: Colors.greenD, color: Colors.green },
    pending_dns: { label: "Aguardando DNS", bg: Colors.amberD, color: Colors.amber },
    none: { label: "Sem dominio", bg: Colors.bg4, color: Colors.ink3 },
  };
  const st = map[status] || map.none;
  return <View style={[cs.badge, { backgroundColor: st.bg }]}><Text style={[cs.badgeText, { color: st.color }]}>{st.label}</Text></View>;
}

export const cs = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  sectionTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  switchLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  switchHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.border },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 12 },
  colorRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 16, flexWrap: "wrap" },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.15 }] },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  filterText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  filterTextActive: { color: Colors.violet3, fontWeight: "600" },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, minWidth: 80 },
  chipActive: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipText: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  chipTextActive: { color: Colors.violet3 },
  chipHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  chipHintActive: { color: Colors.violet3 },
});
