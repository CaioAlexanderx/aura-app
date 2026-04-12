import { View, Text, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export const PLANS: Record<string, { label: string; price: string }> = {
  essencial:     { label: "Essencial",     price: "R$ 89/mes"    },
  negocio:       { label: "Negocio",       price: "R$ 199/mes"   },
  expansao:      { label: "Expansao",      price: "R$ 299/mes"   },
  personalizado: { label: "Personalizado", price: "Sob consulta" },
};

export const CONFIG_KEY = "aura_config";
export const AURA_WHATSAPP = "https://wa.me/5512991234567";
export const AURA_EMAIL    = "contato@getaura.com.br";

export function regimeLabel(raw: string): string {
  const v = (raw || "").toLowerCase();
  if (v === "mei") return "MEI";
  if (v === "simples" || v === "simples_nacional") return "Simples Nacional";
  if (v === "lucro_presumido") return "Lucro Presumido";
  if (v === "lucro_real") return "Lucro Real";
  return "";
}

export function fmtCNPJ(raw: string): string {
  const n = (raw || "").replace(/\D/g, "");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return raw || "";
}

export function validateEmail(v: string): string | null {
  if (!v.trim()) return "E-mail e obrigatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return "Formato invalido";
  return null;
}

export function validatePhone(v: string): string | null {
  if (!v.trim()) return null;
  const nums = v.replace(/\D/g, "");
  if (nums.length < 10 || nums.length > 11) return "Telefone invalido";
  return null;
}

export function syncProfileCache(data: { companyName: string; cnpj: string; email: string; phone: string; address: string }) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CONFIG_KEY, JSON.stringify(data)); } catch {}
}

export type ProfileField = { label: string; ok: boolean };

// Shared UI atoms
export function SectionTitle({ title }: { title: string }) {
  return <Text style={sh.sectionTitle}>{title}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[sh.card, style]}>{children}</View>;
}

export function EditField({ label, value, onChange, placeholder, keyboardType, error, hint, autoCapitalize, multiline, editable }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; error?: string | null;
  hint?: string; autoCapitalize?: any; multiline?: boolean; editable?: boolean;
}) {
  return (
    <View style={sh.fieldWrap}>
      <Text style={sh.fieldLabel}>{label}</Text>
      <TextInput
        style={[sh.input, error ? sh.inputError : null, multiline && sh.textarea, editable === false && sh.inputReadonly]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={Colors.ink3} keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "sentences"} multiline={multiline}
        numberOfLines={multiline ? 2 : 1} editable={editable !== false}
      />
      {error && <Text style={sh.fieldError}>{error}</Text>}
      {hint && !error && <Text style={sh.fieldHint}>{hint}</Text>}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={sh.infoRow}>
      <Text style={sh.infoLabel}>{label}</Text>
      <Text style={sh.infoValue}>{value || "\u2014"}</Text>
    </View>
  );
}

export const sh = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 24, marginBottom: 8 },
  card:         { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, marginBottom: 4 },
  fieldWrap:    { marginBottom: 14 },
  fieldLabel:   { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:        { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  inputError:   { borderColor: Colors.red },
  inputReadonly: { opacity: 0.6 },
  textarea:     { minHeight: 60, textAlignVertical: "top" },
  fieldError:   { fontSize: 11, color: Colors.red, marginTop: 5 },
  fieldHint:    { fontSize: 11, color: Colors.ink3, marginTop: 5 },
  fieldDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11 },
  infoLabel:    { fontSize: 13, color: Colors.ink3 },
  infoValue:    { fontSize: 13, color: Colors.ink, fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },
});
