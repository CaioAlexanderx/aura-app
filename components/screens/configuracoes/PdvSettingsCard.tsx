import { useState } from "react";
import { View, Text, StyleSheet, Switch, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { Card } from "@/components/screens/configuracoes/shared";

// ============================================================
// AURA. — Configurações do Caixa (PDV) por empresa
//
// Toggles:
//   - Obrigar identificação do cliente em toda venda
//   - Obrigar identificação da vendedora em toda venda
//   - Ativar módulo de Abertura/Fechamento de Caixa
//   - Ativar Crediário (fiado por cliente) — 09/05/2026
//
// Persistido em companies.pdv_settings (jsonb).
// ============================================================

export function PdvSettingsCard() {
  const { company } = useAuthStore();
  const { settings: serverSettings, isLoading, invalidate } = usePdvSettings();
  const [pendingSettings, setPendingSettings] = useState<PdvSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // Usa pendingSettings durante save (optimistic), senao usa o do server
  const display = pendingSettings || serverSettings;

  async function toggle(key: keyof PdvSettings, value: boolean) {
    if (!company?.id || saving) return;
    const next: PdvSettings = { ...display, [key]: value };
    setPendingSettings(next);
    setSaving(true);
    try {
      await pdvSettingsApi.save(company.id, next);
      invalidate(); // forca React Query a re-buscar (sincroniza com backend)
      setPendingSettings(null);
    } catch (err: any) {
      setPendingSettings(null); // reverte
      toast.error(err?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet3} size="small" />
          <Text style={s.loadingText}>Carregando configurações...</Text>
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
          <Text style={s.title}>Políticas do Caixa</Text>
          <Text style={s.desc}>Defina o que é obrigatório em cada venda e quais funcionalidades sua loja usa</Text>
        </View>
      </View>

      {/* Toggle: identificar cliente */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar cliente</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem selecionar cliente</Text>
        </View>
        <Switch
          value={display.require_customer}
          onValueChange={function(v) { toggle("require_customer", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.require_customer ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* Toggle: identificar vendedora */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Identificar vendedora</Text>
          <Text style={s.rowDesc}>Bloqueia finalizar venda sem informar quem vendeu</Text>
        </View>
        <Switch
          value={display.require_seller}
          onValueChange={function(v) { toggle("require_seller", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.require_seller ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      <View style={s.divider} />

      {/* Toggle: módulo de caixa */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Módulo de caixa</Text>
          <Text style={s.rowDesc}>Habilita abertura e fechamento de caixa por turno</Text>
        </View>
        <Switch
          value={display.caixa_enabled}
          onValueChange={function(v) { toggle("caixa_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.caixa_enabled ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      {/* Link para a tela de caixa — visivel apenas quando habilitado */}
      {display.caixa_enabled && (
        <Pressable onPress={function() { router.push("/caixa"); }} style={s.caixaLink}>
          <Icon name="receipt" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Gerenciar caixa</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}

      <View style={s.divider} />

      {/* 09/05/2026: Toggle Crediário (fiado) */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Crediário (fiado)</Text>
          <Text style={s.rowDesc}>Permite vender no fiado e registrar pagamento posterior pelo cadastro do cliente</Text>
        </View>
        <Switch
          value={display.crediario_enabled}
          onValueChange={function(v) { toggle("crediario_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.crediario_enabled ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

      {/* Link para a lista de saldos — visivel apenas quando habilitado */}
      {display.crediario_enabled && (
        <Pressable onPress={function() { router.push("/clientes?tab=crediario" as any); }} style={s.caixaLink}>
          <Icon name="users" size={14} color={Colors.violet3} />
          <Text style={s.caixaLinkText}>Ver clientes com saldo</Text>
          <Icon name="chevron_right" size={14} color={Colors.ink3} />
        </Pressable>
      )}

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
  loadingBox:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox:     { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  title:       { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  desc:        { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  row:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowLabel:    { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowDesc:     { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  caixaLink:   {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  caixaLinkText: { flex: 1, fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  savingHint:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  savingText:  { fontSize: 11, color: Colors.ink3 },
});

export default PdvSettingsCard;
