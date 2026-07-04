// ============================================================
// AURA. — components/screens/nfe/EmissorConfigForm.tsx
//
// Jul/2026: seletor de emissor da NFC-e (Sessão 4 do projeto
// "NFC-e emissão própria"). A Nuvem Fiscal encerra em 30/07 — a
// engine própria (direto na SEFAZ-SP) já roda em produção no
// backend, com fallback automático e transparente pra Nuvem Fiscal
// quando a emissão própria falha.
//
// Só renderiza quando já existe nfce_config (config != null) —
// setup inicial (certificado/CSC/série/ambiente) continua sendo
// feito à parte; esta seção só decide QUAL emissor a empresa usa.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { nfceApi, type NfceConfig } from "@/services/nfceApi";
import { ns } from "./shared";

type Provider = "nuvemfiscal" | "sefaz_sp";

export function EmissorConfigForm({ companyId, config }: { companyId: string; config: NfceConfig }) {
  const qc = useQueryClient();

  const [provider, setProvider] = useState<Provider>(config.provider || "nuvemfiscal");
  const [serieSefazSp, setSerieSefazSp] = useState(String(config.serie_sefaz_sp ?? 2));

  // Re-hidrata se o config do servidor mudar (ex: outra aba/dispositivo salvou).
  useEffect(() => {
    setProvider(config.provider || "nuvemfiscal");
    setSerieSefazSp(String(config.serie_sefaz_sp ?? 2));
  }, [config.provider, config.serie_sefaz_sp]);

  const dirty =
    provider !== (config.provider || "nuvemfiscal") ||
    (provider === "sefaz_sp" && Number(serieSefazSp) !== Number(config.serie_sefaz_sp ?? 2));

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof nfceApi.saveConfig>[1] = { provider };
      if (provider === "sefaz_sp") {
        body.serie_sefaz_sp = Number(serieSefazSp) || 2;
      }
      return nfceApi.saveConfig(companyId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nfce-config", companyId] });
      toast.success("Emissor da NFC-e atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar o emissor"),
  });

  return (
    <View style={ns.formCard}>
      <Text style={ns.formTitle}>Emissor da NFC-e</Text>
      <Text style={ns.formHint}>
        Escolha quem emite suas notas. A Nuvem Fiscal encerra em 30/07 — recomendamos
        migrar para a Emissão Aura assim que possível.
      </Text>

      <View style={{ gap: 10 }}>
        <ProviderCard
          selected={provider === "nuvemfiscal"}
          title="Nuvem Fiscal"
          subtitle="Gateway atual — encerra em 30/07"
          onPress={() => setProvider("nuvemfiscal")}
        />
        <ProviderCard
          selected={provider === "sefaz_sp"}
          title="Emissão Aura (beta)"
          subtitle="Direto na SEFAZ-SP, com fallback automático para a Nuvem Fiscal se algo falhar"
          onPress={() => setProvider("sefaz_sp")}
        />
      </View>

      {provider === "sefaz_sp" && (
        <View style={{ marginTop: 12 }}>
          <Text style={ns.fLabel}>Série da emissão própria</Text>
          <TextInput
            style={[ns.fInput, { maxWidth: 160 }]}
            value={serieSefazSp}
            onChangeText={v => setSerieSefazSp(v.replace(/\D/g, ""))}
            placeholder="2"
            placeholderTextColor={Colors.ink3}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            Série separada da Nuvem Fiscal (série {config.serie_nfce}) — as numerações nunca se cruzam.
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => saveMut.mutate()}
        disabled={!dirty || saveMut.isPending}
        style={[ns.emitBtn, (!dirty || saveMut.isPending) && { opacity: 0.5 }]}
      >
        {saveMut.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={ns.emitBtnText}>Salvar emissor</Text>}
      </Pressable>
    </View>
  );
}

function ProviderCard({ selected, title, subtitle, onPress }: {
  selected: boolean; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <Icon name="check" size={12} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.bg4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardSelected: {
    borderColor: Colors.violet3 + "88",
    backgroundColor: Colors.violetD,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, marginTop: 1,
    borderWidth: 1.5, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  cardSubtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 6, lineHeight: 15 },
});

export default EmissorConfigForm;
