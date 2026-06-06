// ============================================================
// Cadastrar Praticante — Aura Karatê
//
// Wired ao POST /federation/{id}/practitioners.
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
import { karateApi, PractitionerInput } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

export default function NovoPraticante() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PractitionerInput>>({
    is_student: true,
    is_arbiter: false,
    is_instructor: false,
    is_examiner: false,
  });

  const set = (key: keyof PractitionerInput, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  async function handleSave() {
    if (!form.full_name?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o nome completo.");
      return;
    }
    if (!form.dojo_id?.trim()) {
      Alert.alert("Campo obrigatório", "Informe o ID do dojô.");
      return;
    }
    setSaving(true);
    try {
      await karateApi.createPractitioner(federationId, form as PractitionerInput);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro ao salvar", e?.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Novo Praticante</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Identificação</Text>
        <FormField
          label="Nome Completo" required
          value={form.full_name ?? ""}
          onChangeText={(v) => set("full_name", v)}
          placeholder="Ex: Carlos Eduardo Silva"
        />
        <FormField
          label="CPF"
          value={form.cpf ?? ""}
          onChangeText={(v) => set("cpf", v)}
          keyboardType="numeric"
          placeholder="000.000.000-00"
        />
        <FormField
          label="RG"
          value={form.rg ?? ""}
          onChangeText={(v) => set("rg", v)}
          placeholder="00.000.000-0"
        />
        <FormField
          label="Data de Nascimento"
          value={form.birth_date ?? ""}
          onChangeText={(v) => set("birth_date", v)}
          placeholder="AAAA-MM-DD"
          hint="Obrigatório para menores — responsável legal LGPD Art. 14"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Contato</Text>
        <FormField
          label="E-mail"
          value={form.email ?? ""}
          onChangeText={(v) => set("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="praticante@email.com"
        />
        <FormField
          label="Telefone"
          value={form.phone ?? ""}
          onChangeText={(v) => set("phone", v)}
          keyboardType="phone-pad"
          placeholder="11 9 9999-0000"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Dojô e Funções</Text>
        <FormField
          label="ID do Dojô" required
          value={form.dojo_id ?? ""}
          onChangeText={(v) => set("dojo_id", v)}
          placeholder="UUID do dojô"
          hint="TODO: selector de dojô com busca"
        />
      </View>

      <KarateButton
        label={saving ? "Salvando..." : "Cadastrar Praticante"}
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
