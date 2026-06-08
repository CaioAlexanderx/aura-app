// ============================================================
// Cadastrar Dojô — Aura Karatê
//
// Wired ao endpoint POST /federation/{id}/dojos.
// ============================================================
import React, { useState } from "react";
import {
  ScrollView, View, Text, Alert,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, DojoInput } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

export default function NovoDojo() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<DojoInput>>({
    affiliation_model: "annual",
  });

  const set = (key: keyof DojoInput, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  async function handleSave() {
    if (!form.name?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o nome do dojô.");
      return;
    }
    setSaving(true);
    try {
      await karateApi.createDojo(federationId, form as DojoInput);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro ao salvar", e?.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Novo Dojô</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Identificação</Text>
        <FormField
          label="Nome do Dojô" required
          value={form.name ?? ""}
          onChangeText={(v) => set("name", v)}
          placeholder="Ex: Dojô Shotokan"
        />
        <FormField
          label="Região"
          value={form.region ?? ""}
          onChangeText={(v) => set("region", v)}
          placeholder="Ex: São Paulo"
        />
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
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  pageTitle:    { fontSize: 20, fontWeight: "800", color: KarateColors.ink, marginBottom: 4 } as TextStyle,
  card:         { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 12 } as ViewStyle,
  sectionLabel: { fontSize: 10, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase" } as TextStyle,
  saveBtn:      { marginTop: 8 } as ViewStyle,
});
