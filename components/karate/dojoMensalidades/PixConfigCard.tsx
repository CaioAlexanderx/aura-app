// ============================================================
// PixConfigCard — configuração da chave Pix de recebimento do dojô (F3a)
//
// Usado em DOIS lugares:
//   • topo da tela Mensalidades, como BANNER — só aparece quando
//     pix_configured=false (alwaysShow=false, default), avisando que
//     é preciso configurar antes de gerar cobranças por Pix.
//   • Configurações, como CARD fixo "Recebimento Pix" (alwaysShow=true)
//     — sempre visível, mostra a chave mascarada quando já configurada.
//
// GET/PUT /federation/:id/dojo/billing/config. Chave nunca aparece em
// texto puro depois de salva (só pix_key_masked do backend).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import {
  karateDojoBillingApi, DojoBillingConfig, PIX_KEY_TYPE_OPTIONS,
} from "@/services/karateDojoBillingApi";
import { mapBillingError } from "./helpers";

interface Props {
  federationId: string;
  /** true = card fixo (Configurações); false = banner só quando não configurado (Mensalidades). */
  alwaysShow?: boolean;
  onConfigured?: () => void;
}

export function PixConfigCard({ federationId, alwaysShow = false, onConfigured }: Props) {
  const [config, setConfig] = useState<DojoBillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [keyType, setKeyType] = useState("cpf");
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setFailed(null);
    try {
      const res = await karateDojoBillingApi.getConfig(federationId);
      setConfig(res);
    } catch (e: any) {
      setFailed(mapBillingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!keyValue.trim()) {
      setSaveErr("Informe a chave Pix.");
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await karateDojoBillingApi.updateConfig(federationId, {
        pix_key: keyValue.trim(),
        pix_key_type: keyType,
      });
      setConfig(res);
      setEditing(false);
      setKeyValue("");
      onConfigured?.();
    } catch (e: any) {
      setSaveErr(mapBillingError(e).message);
    } finally {
      setSaving(false);
    }
  };

  // Banner (Mensalidades): não renderiza nada enquanto carrega, se falhou
  // (degrade silencioso — a tela segue funcionando sem o aviso) ou se já
  // está configurado.
  if (!alwaysShow) {
    if (loading || failed || config?.pix_configured) return null;
  }

  if (alwaysShow && loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={KarateColors.primary} />
      </View>
    );
  }

  if (alwaysShow && failed) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recebimento Pix</Text>
        <Text style={styles.errTxt}>{failed}</Text>
        <TouchableOpacity onPress={load} accessibilityRole="button" style={{ marginTop: 6 }}>
          <Text style={styles.retryTxt}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const configured = !!config?.pix_configured;

  return (
    <View style={[styles.card, !configured && styles.cardWarn]}>
      <View style={styles.head}>
        <Icon name={configured ? "wallet" : "alert"} size={16} color={configured ? KarateColors.primary : KarateColors.warn} />
        <Text style={styles.cardTitle}>Recebimento Pix</Text>
      </View>

      {configured && !editing && (
        <>
          <Text style={styles.cardSub}>
            Chave {config?.pix_key_type ? `(${config.pix_key_type})` : ""}: <Text style={styles.keyTxt}>{config?.pix_key_masked}</Text>
          </Text>
          <TouchableOpacity onPress={() => { setEditing(true); setKeyValue(""); }} accessibilityRole="button" style={{ marginTop: 4 }}>
            <Text style={styles.retryTxt}>Alterar chave</Text>
          </TouchableOpacity>
        </>
      )}

      {!configured && !editing && (
        <>
          <Text style={styles.cardSub}>
            Configure a chave Pix do dojô para gerar cobranças de mensalidade com Pix copia-e-cola.
          </Text>
          <KarateButton
            label="Configurar chave Pix"
            variant="secondary"
            size="sm"
            onPress={() => setEditing(true)}
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          />
        </>
      )}

      {editing && (
        <View style={{ gap: 10, marginTop: 8 }}>
          <View>
            <Text style={styles.label}>Tipo de chave</Text>
            <View style={styles.chips}>
              {PIX_KEY_TYPE_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, keyType === o.key && styles.chipOn]}
                  onPress={() => setKeyType(o.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: keyType === o.key }}
                >
                  <Text style={[styles.chipTxt, keyType === o.key && styles.chipTxtOn]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <FormField
            label="Chave Pix"
            value={keyValue}
            onChangeText={setKeyValue}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
            autoCapitalize="none"
            error={saveErr ?? undefined}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => { setEditing(false); setSaveErr(null); }} style={{ flex: 1 }} />
            <KarateButton label="Salvar chave" variant="sumi" size="sm" onPress={save} loading={saving} style={{ flex: 2 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14,
  } as ViewStyle,
  cardWarn: { borderColor: KarateColors.warn, backgroundColor: KarateColors.warnSoft } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 6, lineHeight: 18 } as TextStyle,
  keyTxt: { fontWeight: "700", color: KarateColors.ink } as TextStyle,
  errTxt: { fontSize: 12.5, color: KarateColors.danger, marginTop: 6 } as TextStyle,
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, letterSpacing: 0.2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});
