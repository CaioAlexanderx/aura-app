// ============================================================
// Cadastrar Dojô — Aura Karatê
//
// Wired ao endpoint POST /federation/{id}/dojos.
// Campo "Região" é dropdown das regiões canônicas (KARATE_REGIONS) — sem
// "Outra…"/texto livre (removido em 13/07/2026, mesmo contrato que
// DojoFichaModal: as 10 regiões cobrem 100% do vocabulário real da
// federação, ver constants/karateRegions.ts).
// ============================================================
import React, { useState } from "react";
import {
  ScrollView, View, Text, Alert, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius, ShojiPalette as P, KarateFonts as F } from "@/constants/karateTheme";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { Icon } from "@/components/Icon";
import { karateApi, DojoInput } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { KARATE_REGIONS } from "@/constants/karateRegions";

export default function NovoDojo() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<DojoInput>>({
    affiliation_model: "annual",
  });

  // Região: valor do picker (uma das KARATE_REGIONS).
  const [regionPick, setRegionPick] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);

  const regionLabel = regionPick || "Selecionar região…";

  // Resolve o valor final de região para envio
  function resolveRegion(): string | undefined {
    return regionPick || undefined;
  }

  const set = (key: keyof DojoInput, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  async function handleSave() {
    if (!form.name?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o nome do dojô.");
      return;
    }
    setSaving(true);
    try {
      const body: DojoInput & { region?: string } = {
        ...(form as DojoInput),
        region: resolveRegion(),
      };
      await karateApi.createDojo(federationId, body as DojoInput);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro ao salvar", e?.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Novo Dojô</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Identificação</Text>
        <FormField
          label="Nome do Dojô" required
          value={form.name ?? ""}
          onChangeText={(v) => set("name", v)}
          placeholder="Ex: Dojô Shotokan"
        />

        {/* Região — dropdown canônico (mesmo padrão do DojoFichaModal) */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Região</Text>
          <TouchableOpacity
            style={styles.dropBtn}
            onPress={() => setRegionOpen((o) => !o)}
            activeOpacity={0.8}
            accessibilityLabel="Selecionar região"
            accessibilityRole="button"
          >
            <Text style={[styles.dropBtnTxt, !regionPick && styles.dropBtnPlaceholder]} numberOfLines={1}>
              {regionLabel}
            </Text>
            <Icon name={regionOpen ? "chevron-up" : "chevron-down"} size={16} color={KarateColors.ink3} />
          </TouchableOpacity>

          {/* Lista de opções inline */}
          {regionOpen && (
            <View style={styles.dropList}>
              {KARATE_REGIONS.map((r) => {
                const selected = regionPick === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.dropItem, selected && styles.dropItemOn]}
                    onPress={() => {
                      setRegionPick(r);
                      setRegionOpen(false);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="menuitem"
                    accessibilityLabel={r}
                  >
                    <Text style={[styles.dropItemTxt, selected && styles.dropItemTxtOn]}>{r}</Text>
                    {selected && <Icon name="check" size={14} color={KarateColors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <FormField
          label="Ano de Fundação"
          value={form.dojo_founded_year ? String(form.dojo_founded_year) : ""}
          onChangeText={(v) => set("dojo_founded_year" as any, v)}
          keyboardType="numeric"
          placeholder="Ex: 2005"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Contato</Text>
        <FormField
          label="Telefone"
          value={form.phone ?? ""}
          onChangeText={(v) => set("phone", v)}
          keyboardType="phone-pad"
          placeholder="Ex: 11 99999-0000"
        />
        <FormField
          label="E-mail"
          value={form.email ?? ""}
          onChangeText={(v) => set("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="sensei@dojo.com"
        />
        <FormField
          label="Endereço"
          value={form.address ?? ""}
          onChangeText={(v) => set("address", v)}
          placeholder="Rua, número, bairro"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Filiação</Text>
        <FormField
          label="CNPJ"
          value={form.cnpj ?? ""}
          onChangeText={(v) => set("cnpj", v)}
          keyboardType="numeric"
          placeholder="00.000.000/0001-00 (opcional)"
          hint="Deixe vazio para dojôs informais (CPF do sensei)"
        />
        <FormField
          label="CPF do Sensei"
          value={form.sensei_cpf ?? ""}
          onChangeText={(v) => set("sensei_cpf", v)}
          keyboardType="numeric"
          placeholder="000.000.000-00 (opcional)"
        />
      </View>

      <KarateButton
        label={saving ? "Salvando..." : "Cadastrar Dojô"}
        onPress={handleSave}
        loading={saving}
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:       { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  pageTitle:     { fontSize: 20, fontWeight: "800", color: KarateColors.ink, marginBottom: 4 } as TextStyle,
  card:          { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 12 } as ViewStyle,
  sectionLabel:  { fontSize: 10, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase" } as TextStyle,
  saveBtn:       { marginTop: 8 } as ViewStyle,

  // Região — dropdown
  fieldWrapper:     { gap: 4 } as ViewStyle,
  fieldLabel:       { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, letterSpacing: 0.2 } as TextStyle,
  dropBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderWidth: 1.5, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44 } as ViewStyle,
  dropBtnTxt:       { fontFamily: F.body, fontSize: 14, color: KarateColors.ink, flex: 1 } as TextStyle,
  dropBtnPlaceholder: { color: KarateColors.ink4 } as TextStyle,
  dropList:         { marginTop: 4, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, overflow: "hidden", zIndex: 100 } as ViewStyle,
  dropItem:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  dropItemOn:       { backgroundColor: P.redWash } as ViewStyle,
  dropItemTxt:      { fontFamily: F.body, fontSize: 14, color: KarateColors.ink2 } as TextStyle,
  dropItemTxtOn:    { color: KarateColors.ink, fontWeight: "600" } as TextStyle,
});
