import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, ActivityIndicator, Platform, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import type { CollectionRules } from "@/services/creditApi";

type Stage = { id: string; name: string; days_relative: number; template: string; channel: string; enabled: boolean };

const DEFAULT_STAGES: Stage[] = [
  { id: "d-3",  name: "Lembrete",         days_relative: -3,  template: "lembrete",   channel: "whatsapp", enabled: true },
  { id: "d-1",  name: "Confirmação",     days_relative: -1,  template: "confirmacao", channel: "whatsapp", enabled: true },
  { id: "d0",   name: "Vencimento",       days_relative: 0,   template: "vencimento",  channel: "whatsapp", enabled: true },
  { id: "d+3",  name: "Atraso (3 dias)",  days_relative: 3,   template: "atraso_1",   channel: "whatsapp", enabled: true },
  { id: "d+10", name: "Atraso (10 dias)", days_relative: 10,  template: "atraso_2",   channel: "push",     enabled: true },
  { id: "d+30", name: "Bloqueio auto",    days_relative: 30,  template: "bloqueio",   channel: "system",   enabled: true },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", push: "Notificação", system: "Sistema",
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: Colors.green, push: Colors.violet3, system: Colors.amber,
};

function dayLabel(d: number) {
  if (d < 0) return `D${d}`;
  if (d === 0) return "D0 (vencimento)";
  return `D+${d}`;
}

export default function CrediarioSettingsScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [pixKey, setPixKey] = useState("");
  const [dirty, setDirty] = useState(false);

  const rulesQ = useQuery({
    queryKey: ["credit-rules", company?.id],
    queryFn: () => creditApi.getCollectionRules(company!.id),
    enabled: !!company?.id,
  });

  useEffect(() => {
    if (!rulesQ.data) return;
    setEnabled(rulesQ.data.enabled ?? true);
    setPixKey((rulesQ.data as any).pix_key || "");
    if (Array.isArray(rulesQ.data.rules) && rulesQ.data.rules.length > 0) {
      setStages(rulesQ.data.rules as Stage[]);
    }
  }, [rulesQ.data]);

  const saveMut = useMutation({
    mutationFn: () => creditApi.updateCollectionRules(company!.id, { enabled, rules: stages, pix_key: pixKey.trim() } as any),
    onSuccess: () => {
      toast.success("Configurações salvas!");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["credit-rules", company?.id] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar"),
  });

  function toggleStage(id: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    setDirty(true);
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      {/* Header */}
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Icon name="chevron_right" size={16} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
          <Text style={st.backText}>Crediário</Text>
        </Pressable>
      </View>

      <Text style={st.pageTitle}>Configurações do Crediário</Text>
      <Text style={st.pageSubtitle}>
        Chave Pix para cobrança e régua de lembretes automáticos por parcela.
      </Text>

      {rulesQ.isLoading && (
        <View style={st.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
        </View>
      )}

      {!rulesQ.isLoading && (
        <>
          {/* Chave Pix para cobrança */}
          <Text style={st.stagesTitle}>Chave Pix para cobrança</Text>
          <View style={st.pixCard}>
            <Icon name="dollar" size={16} color={Colors.violet3} />
            <TextInput
              style={st.pixInput}
              value={pixKey}
              onChangeText={(v) => { setPixKey(v); setDirty(true); }}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              placeholderTextColor={Colors.ink3}
              autoCapitalize="none"
            />
          </View>
          <Text style={st.pixHint}>
            Essa chave entra automaticamente na mensagem de cobrança do WhatsApp, pronta para o cliente pagar.
          </Text>

          {/* Régua de cobrança */}
          <Text style={st.stagesTitle}>Régua de lembretes</Text>

          {/* Toggle global */}
          <View style={st.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleTitle}>Régua ativa</Text>
              <Text style={st.toggleDesc}>
                Quando ativa, mensagens são disparadas automaticamente conforme as etapas abaixo.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(v) => { setEnabled(v); setDirty(true); }}
              trackColor={{ false: Colors.bg4, true: Colors.violet }}
              thumbColor={enabled ? "#fff" : Colors.ink3}
            />
          </View>

          {/* Etapas */}
          <Text style={st.stagesTitle}>Etapas configuradas</Text>
          {stages.map((stage) => (
            <View key={stage.id} style={[st.stageCard, !stage.enabled && st.stageCardDisabled]}>
              <View style={st.stageLeft}>
                <View style={[st.dayBadge, !stage.enabled && { opacity: 0.4 }]}>
                  <Text style={st.dayBadgeText}>{dayLabel(stage.days_relative)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.stageName, !stage.enabled && { color: Colors.ink3 }]}>{stage.name}</Text>
                  <View style={st.stageMetaRow}>
                    <View style={[st.channelPill, { backgroundColor: (CHANNEL_COLORS[stage.channel] || Colors.ink3) + "22" }]}>
                      <Text style={[st.channelPillText, { color: CHANNEL_COLORS[stage.channel] || Colors.ink3 }]}>
                        {CHANNEL_LABELS[stage.channel] || stage.channel}
                      </Text>
                    </View>
                    <Text style={st.templateText}>{stage.template}</Text>
                  </View>
                </View>
              </View>
              <Switch
                value={stage.enabled}
                onValueChange={() => toggleStage(stage.id)}
                trackColor={{ false: Colors.bg4, true: Colors.violet }}
                thumbColor={stage.enabled ? "#fff" : Colors.ink3}
                disabled={!enabled}
              />
            </View>
          ))}

          {/* Info WhatsApp */}
          <View style={st.infoCard}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <Text style={st.infoText}>
              Disparos via WhatsApp exigem o Hub Social conectado. Etapas sem WhatsApp ativo não serão enviadas automaticamente, mas podem ser disparadas manualmente no dashboard.
            </Text>
          </View>

          {/* Save */}
          <Pressable
            onPress={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
            style={[st.saveBtn, (!dirty || saveMut.isPending) && st.saveBtnDisabled]}
          >
            {saveMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.saveBtnText}>Salvar alterações</Text>
            }
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48, maxWidth: 640, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 20 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  toggleCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 3 },
  toggleDesc: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16 },

  stagesTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 4 },
  pixCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border2 },
  pixInput: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "600", paddingVertical: 0 },
  pixHint: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16, marginTop: 8, marginBottom: 20 },

  stageCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  stageCardDisabled: { opacity: 0.6 },
  stageLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dayBadge: { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border2, minWidth: 48, alignItems: "center" },
  dayBadgeText: { fontSize: 10, fontWeight: "800", color: Colors.violet3, letterSpacing: 0.3 },
  stageName: { fontSize: 13, fontWeight: "600", color: Colors.ink, marginBottom: 4 },
  stageMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  channelPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  channelPillText: { fontSize: 9.5, fontWeight: "700" },
  templateText: { fontSize: 10.5, color: Colors.ink3 },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.amber + "33", marginBottom: 20, marginTop: 8 },
  infoText: { flex: 1, fontSize: 11.5, color: Colors.amber, lineHeight: 16 },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
