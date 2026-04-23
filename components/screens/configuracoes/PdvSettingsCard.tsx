import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { Card } from "@/components/screens/configuracoes/shared";

// ============================================================
// AURA. — Configuracoes do Caixa (PDV) por empresa
//
// Toggles:
//   - Obrigar identificacao do cliente em toda venda
//   - Obrigar identificacao da vendedora em toda venda
//
// Persistido em companies.pdv_settings (jsonb).
// Quando ativo, o PDV bloqueia finalizacao da venda sem o campo.
// ============================================================

const DEFAULT: PdvSettings = { require_customer: false, require_seller: false };

export function PdvSettingsCard() {
  const { company } = useAuthStore();
  const [settings, setSettings] = useState<PdvSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(function() {
    if (!company?.id) return;
    let cancelled = false;
    pdvSettingsApi
      .get(company.id)
      .then(function(res) {
        if (!cancelled) {
          setSettings(res.settings || DEFAULT);
          setLoading(false);
        }
      })
      .catch(function() {
        if (!cancelled) setLoading(false);
      });
    return function() { cancelled = true; };
  }, [company?.id]);

  async function toggle(key: keyof PdvSettings, value: boolean) {
    if (!company?.id || saving) return;
    const next: PdvSettings = { ...settings, [key]: value };
    // Optimistic update
    setSettings(next);
    setSaving(true);
    try {
      const res = await pdvSettingsApi.save(company.id, next);
      setSettings(res.settings);
    } catch (err: any) {
      // Reverte
      setSettings(settings);
      toast.error(err?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Carregando configuracoes...</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={s.header}>
        <View style={s.iconBox}>
          <Icon name="cart" size={16} color={Colors.violet3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Politicas do Caixa</Text>
          <Text style={s.desc}>Defina o que eh obrigatorio em cada venda</Text>
        </View>
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar cliente</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem selecionar cliente</Text>
        </View>
        <Switch
          value={settings.require_customer}
          onValueChange={function(v) { toggle("require_customer", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={settings.require_customer ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar vendedora</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem informar quem vendeu</Text>
        </View>
        <Switch
          value={settings.require_seller}
          onValueChange={function(v) { toggle("require_seller", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={settings.require_seller ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      {saving && (
        <View style={s.savingHint}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.savingText}>Salvando...</Text>
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  desc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  savingHint: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  savingText: { fontSize: 11, color: Colors.ink3 },
});

export default PdvSettingsCard;
