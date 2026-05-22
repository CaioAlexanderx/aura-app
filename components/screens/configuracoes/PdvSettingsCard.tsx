import { useState } from "react";
import { View, Text, StyleSheet, Switch, ActivityIndicator, Pressable, TextInput, Platform } from "react-native";
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
//   - Modal de troco em venda dinheiro — 12/05/2026
//   - Restaurante (Fase 7): NFC-e manual, comanda auto-print, taxa servico
//
// Persistido em companies.pdv_settings (jsonb).
// ============================================================

export function PdvSettingsCard() {
  const { company } = useAuthStore();
  const { settings: serverSettings, isLoading, invalidate } = usePdvSettings();
  const [pendingSettings, setPendingSettings] = useState<PdvSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [feeInput, setFeeInput] = useState<string>("");

  // Usa pendingSettings durante save (optimistic), senao usa o do server
  const display = pendingSettings || serverSettings;
  const isFoodVertical = (company as any)?.vertical_active === "food";

  async function toggle(key: keyof PdvSettings, value: boolean | number) {
    if (!company?.id || saving) return;
    const next: PdvSettings = { ...display, [key]: value } as PdvSettings;
    setPendingSettings(next);
    setSaving(true);
    try {
      await pdvSettingsApi.save(company.id, next);
      invalidate();
      setPendingSettings(null);
    } catch (err: any) {
      setPendingSettings(null);
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

      {/* 12/05/2026: Toggle modal de troco em venda dinheiro */}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Modal de troco em dinheiro</Text>
          <Text style={s.rowDesc}>Ao finalizar venda em dinheiro, abre um auxílio para calcular o troco (single ou parcela dinheiro em multi-pagamento)</Text>
        </View>
        <Switch
          value={display.cash_tender_modal_enabled !== false}
          onValueChange={function(v) { toggle("cash_tender_modal_enabled", v); }}
          trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
          thumbColor={display.cash_tender_modal_enabled !== false ? Colors.violet : Colors.ink3}
          disabled={saving}
        />
      </View>

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

      {/* Fase 7 (Restaurante): so aparece se vertical_active === "food" */}
      {isFoodVertical && (
        <>
          <View style={s.restaurantHeader}>
            <Text style={s.restaurantHeaderText}>🍽️  RESTAURANTE</Text>
          </View>

          {/* NFC-e manual */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Emitir NFC-e ao fechar mesa</Text>
              <Text style={s.rowDesc}>Mostra um botão no fechamento da mesa pra gerar cupom fiscal (NFC-e). Recurso do plano Negócio+.</Text>
            </View>
            <Switch
              value={display.food_nfce_manual_enabled === true}
              onValueChange={function(v) { toggle("food_nfce_manual_enabled", v); }}
              trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
              thumbColor={display.food_nfce_manual_enabled === true ? Colors.violet : Colors.ink3}
              disabled={saving}
            />
          </View>

          <View style={s.divider} />

          {/* Comanda auto-print */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Imprimir comanda automaticamente</Text>
              <Text style={s.rowDesc}>Ao confirmar um pedido, manda a comanda 80mm pra impressora da cozinha (apenas no navegador desktop).</Text>
            </View>
            <Switch
              value={display.food_comanda_print_enabled === true}
              onValueChange={function(v) { toggle("food_comanda_print_enabled", v); }}
              trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
              thumbColor={display.food_comanda_print_enabled === true ? Colors.violet : Colors.ink3}
              disabled={saving}
            />
          </View>

          {Platform.OS !== "web" && display.food_comanda_print_enabled && (
            <View style={s.warnBox}>
              <Icon name="info" size={11} color={Colors.amber} />
              <Text style={s.warnText}>Auto-impressão só funciona no navegador desktop. No iPad/celular, gerencie comandas manualmente pelo KDS.</Text>
            </View>
          )}

          <View style={s.divider} />

          {/* Taxa de servico */}
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Taxa de serviço padrão</Text>
              <Text style={s.rowDesc}>Sugestão de gorjeta calculada sobre o subtotal da comanda. 0 = desativada. Aparece como linha separada no fechamento.</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <TextInput
                  value={feeInput || String(display.service_fee_pct ?? "")}
                  onChangeText={setFeeInput}
                  onBlur={() => {
                    const n = Math.max(0, Math.min(30, Number((feeInput || "").replace(/[^\d.]/g, "")) || 0));
                    setFeeInput("");
                    if (n !== Number(display.service_fee_pct || 0)) {
                      toggle("service_fee_pct" as keyof PdvSettings, n);
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.ink4}
                  style={s.feeInput}
                />
                <Text style={{ color: Colors.ink3, fontSize: 13, fontWeight: "700" }}>%</Text>
                <Text style={{ color: Colors.ink4, fontSize: 11, marginLeft: 4 }}>(0–30)</Text>
              </View>
            </View>
          </View>
        </>
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
  // Fase 7 — Restaurante
  restaurantHeader: {
    marginTop: 12, marginBottom: 6,
    paddingTop: 12, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  restaurantHeaderText: {
    fontSize: 10, color: Colors.red, fontWeight: "800",
    letterSpacing: 1,
  },
  feeInput: {
    backgroundColor: Colors.bg3, color: Colors.ink,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
    fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "center",
  },
  warnBox: {
    flexDirection: "row", gap: 6, alignItems: "flex-start",
    backgroundColor: Colors.amberD || "rgba(245,158,11,0.1)", padding: 8, borderRadius: 6,
    borderLeftWidth: 2, borderLeftColor: Colors.amber, marginTop: 4,
  },
  warnText: { fontSize: 10, color: Colors.amber, flex: 1, lineHeight: 14 },
});

export default PdvSettingsCard;
