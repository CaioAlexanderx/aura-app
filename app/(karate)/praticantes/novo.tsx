// ============================================================
// Cadastrar Praticante — Aura Karatê
//
// Wired ao POST /federation/{id}/practitioners.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView, View, Text, Alert, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, PractitionerInput, Dojo } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// ── DojoSelector — searchable dojo picker ─────────────────────
// Loads options from karateApi.listDojos and lets the user pick one.
// Consistent with the card/FormField visual language used across the app.
function DojoSelector({
  federationId,
  value,
  onSelect,
}: {
  federationId: string;
  value: string | null;
  onSelect: (dojo: Dojo) => void;
}) {
  const [query, setQuery]     = useState("");
  const [dojos, setDojos]     = useState<Dojo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const fetchDojos = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await karateApi.listDojos(federationId, { q: q || undefined, pageSize: 50 });
      setDojos(res.data);
    } catch {
      setDojos([]);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  // Load initial list on mount so user can scroll without typing
  useEffect(() => { fetchDojos(""); }, [fetchDojos]);

  function handleQueryChange(text: string) {
    setQuery(text);
    fetchDojos(text);
  }

  function handleSelect(dojo: Dojo) {
    setSelectedName(dojo.name);
    setQuery("");
    setOpen(false);
    onSelect(dojo);
  }

  return (
    <View>
      <Text style={selectorStyles.label}>
        Dojô <Text style={selectorStyles.required}>*</Text>
      </Text>

      {/* Selected value chip or search trigger */}
      <TouchableOpacity
        style={selectorStyles.trigger}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            selectorStyles.triggerText,
            !selectedName && selectorStyles.placeholder,
          ]}
          numberOfLines={1}
        >
          {selectedName ?? "Selecionar dojô..."}
        </Text>
        <Text style={selectorStyles.chevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={selectorStyles.dropdown}>
          <TextInput
            style={selectorStyles.searchInput}
            placeholder="Buscar por nome ou FPKT-NNN"
            placeholderTextColor={KarateColors.ink3}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
          />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={KarateColors.primary} />
          ) : dojos.length === 0 ? (
            <Text style={selectorStyles.emptyText}>Nenhum dojô encontrado</Text>
          ) : (
            <FlatList
              data={dojos}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={selectorStyles.option}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.6}
                >
                  <Text style={selectorStyles.optionName}>{item.name}</Text>
                  {item.fpkt_affiliation_id ? (
                    <Text style={selectorStyles.optionMeta}>{item.fpkt_affiliation_id}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function NovoPraticante() {
  const router = useRouter();
  // TODO(fase-login): federationId vir do JWT
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
      Alert.alert("Campo obrigatório", "Selecione o dojô.");
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
        <DojoSelector
          federationId={federationId}
          value={form.dojo_id ?? null}
          onSelect={(dojo) => set("dojo_id", dojo.id)}
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

const selectorStyles = StyleSheet.create({
  label:       { fontSize: 12, fontWeight: "600", color: KarateColors.ink, marginBottom: 4 } as TextStyle,
  required:    { color: KarateColors.danger ?? "#e53e3e" } as TextStyle,
  trigger:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" } as ViewStyle,
  triggerText: { flex: 1, fontSize: 14, color: KarateColors.ink } as TextStyle,
  placeholder: { color: KarateColors.ink3 } as TextStyle,
  chevron:     { fontSize: 10, color: KarateColors.ink3, marginLeft: 8 } as TextStyle,
  dropdown:    { marginTop: 4, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: "#fff", overflow: "hidden" } as ViewStyle,
  searchInput: { borderBottomWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink } as TextStyle,
  emptyText:   { textAlign: "center", color: KarateColors.ink3, paddingVertical: 16, fontSize: 13 } as TextStyle,
  option:      { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  optionName:  { fontSize: 14, color: KarateColors.ink, fontWeight: "600" } as TextStyle,
  optionMeta:  { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
});
