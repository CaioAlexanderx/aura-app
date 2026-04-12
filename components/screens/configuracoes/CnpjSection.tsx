import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { onboardingApi, companiesApi } from "@/services/api";
import { maskCNPJ } from "@/utils/masks";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { Card, fmtCNPJ, regimeLabel, sh } from "./shared";

type CnpjPreview = { name: string; address: string } | null;

type Props = {
  cnpj: string;
  taxRegime: string;
  onCnpjSaved: (cnpj: string, preview: CnpjPreview) => void;
};

export function CnpjSection({ cnpj, taxRegime, onCnpjSaved }: Props) {
  const { company, isDemo } = useAuthStore();
  const [cnpjInput,   setCnpjInput]   = useState("");
  const [cnpjSaving,  setCnpjSaving]  = useState(false);
  const [cnpjLooking, setCnpjLooking] = useState(false);
  const [cnpjPreview, setCnpjPreview] = useState<CnpjPreview>(null);
  const [lookupError, setLookupError] = useState(false);

  const cnpjInputNums  = cnpjInput.replace(/\D/g, "");
  const cnpjInputValid = cnpjInputNums.length === 14;

  async function lookupCNPJ(nums: string) {
    if (nums.length !== 14) { setCnpjPreview(null); setLookupError(false); return; }
    setCnpjLooking(true); setCnpjPreview(null); setLookupError(false);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`);
      if (!res.ok) throw new Error("not found");
      const d = await res.json();
      const name = d.nome_fantasia || d.razao_social || "";
      const parts = [
        d.logradouro, d.numero, d.complemento, d.bairro,
        d.municipio ? `${d.municipio}/${d.uf}` : d.uf,
        d.cep ? `CEP ${d.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
      ].filter(Boolean);
      setCnpjPreview({ name, address: parts.join(", ") });
    } catch {
      setCnpjPreview(null);
      setLookupError(true);
    } finally { setCnpjLooking(false); }
  }

  function handleCnpjInputChange(v: string) {
    const masked = maskCNPJ(v);
    setCnpjInput(masked);
    const nums = masked.replace(/\D/g, "");
    if (nums.length === 14) lookupCNPJ(nums);
    else { setCnpjPreview(null); setLookupError(false); }
  }

  async function handleSaveCnpj() {
    if (!cnpjInputValid || !company?.id || isDemo) return;
    setCnpjSaving(true);
    try {
      await onboardingApi.stepCnpj(company.id, cnpjInputNums);

      // BUGFIX #2: Persist auto-filled data to backend immediately
      if (cnpjPreview) {
        try {
          const body: any = {};
          if (cnpjPreview.name) body.trade_name = cnpjPreview.name;
          if (cnpjPreview.address) body.address = cnpjPreview.address;
          if (Object.keys(body).length > 0) {
            await companiesApi.updateProfile(company.id, body);
          }
        } catch {} // non-blocking — CNPJ is already saved
      }

      onCnpjSaved(cnpjInputNums, cnpjPreview);
      setCnpjInput(""); setCnpjPreview(null); setLookupError(false);
      toast.success("CNPJ salvo!" + (cnpjPreview ? " Dados preenchidos automaticamente." : ""));
    } catch (err: any) {
      toast.error(err?.message || "CNPJ invalido ou nao encontrado na Receita Federal");
    } finally { setCnpjSaving(false); }
  }

  // Already has CNPJ — read-only display
  if (cnpj) {
    return (
      <Card style={{ paddingTop: 0, paddingBottom: 0 }}>
        <View style={s.registraisRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.regLabel}>CNPJ</Text>
            <Text style={s.regValue}>{fmtCNPJ(cnpj)}</Text>
          </View>
          <View style={s.regDivider} />
          <View style={{ flex: 1 }}>
            <Text style={s.regLabel}>Regime</Text>
            <Text style={s.regValue}>{regimeLabel(taxRegime) || "\u2014"}</Text>
          </View>
          <Icon name="lock" size={14} color={Colors.ink3} />
        </View>
        <View style={s.regNote}>
          <Text style={s.regNoteText}>Para alterar CNPJ ou regime, contate o suporte da Aura.</Text>
        </View>
      </Card>
    );
  }

  // No CNPJ — editable input
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon name="alert" size={14} color={Colors.amber} />
        <Text style={{ fontSize: 12, color: Colors.amber, fontWeight: "600" }}>CNPJ nao informado</Text>
      </View>

      <Text style={sh.fieldLabel}>Seu CNPJ</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1, position: "relative" as any }}>
          <TextInput
            style={[sh.input, cnpjInput && !cnpjInputValid && sh.inputError, { paddingRight: cnpjLooking ? 40 : 14 }]}
            value={cnpjInput} onChangeText={handleCnpjInputChange}
            placeholder="00.000.000/0001-00" placeholderTextColor={Colors.ink3}
            keyboardType="number-pad" maxLength={18}
          />
          {cnpjLooking && (
            <View style={{ position: "absolute" as any, right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
              <ActivityIndicator size="small" color={Colors.violet3} />
            </View>
          )}
        </View>
        <Pressable onPress={handleSaveCnpj} disabled={!cnpjInputValid || cnpjSaving || cnpjLooking}
          style={[s.cnpjBtn, (!cnpjInputValid || cnpjSaving || cnpjLooking) && { opacity: 0.5 }]}>
          {cnpjSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.cnpjBtnText}>Confirmar</Text>}
        </Pressable>
      </View>

      {cnpjPreview && (
        <View style={s.previewCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon name="check" size={13} color={Colors.green} />
            <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>Empresa encontrada na Receita Federal</Text>
          </View>
          <Text style={s.previewName} numberOfLines={1}>{cnpjPreview.name}</Text>
          {cnpjPreview.address ? <Text style={s.previewAddr} numberOfLines={2}>{cnpjPreview.address}</Text> : null}
          <Text style={[sh.fieldHint, { marginTop: 6 }]}>Ao confirmar, nome e endereco serao preenchidos automaticamente.</Text>
        </View>
      )}

      {lookupError && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="info" size={13} color={Colors.ink3} />
          <Text style={sh.fieldHint}>CNPJ nao encontrado na BrasilAPI. Voce pode salvar mesmo assim.</Text>
        </View>
      )}

      {cnpjInput && !cnpjInputValid && <Text style={sh.fieldError}>CNPJ deve ter 14 digitos</Text>}
    </Card>
  );
}

const s = StyleSheet.create({
  registraisRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 12 },
  regLabel:       { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  regValue:       { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  regDivider:     { width: 1, height: 36, backgroundColor: Colors.border },
  regNote:        { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 10 },
  regNoteText:    { fontSize: 11, color: Colors.ink3 },
  cnpjBtn:        { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", minWidth: 100 },
  cnpjBtnText:    { fontSize: 13, color: "#fff", fontWeight: "700" },
  previewCard:    { backgroundColor: Colors.greenD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.green + "44", marginBottom: 8 },
  previewName:    { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  previewAddr:    { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
});
