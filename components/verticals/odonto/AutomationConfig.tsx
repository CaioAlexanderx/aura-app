import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

export function AutomationConfig() {
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [tab, setTab] = useState<'config'|'log'>('config');

  var { data: configData, isLoading: loadingCfg } = useQuery({
    queryKey: ["dental-auto-config", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/automation/config"); },
    enabled: !!company?.id, staleTime: 30000,
  });

  var { data: logData, isLoading: loadingLog } = useQuery({
    queryKey: ["dental-auto-log", company?.id],
    queryFn: function() { return request("/companies/" + company!.id + "/dental/automation/log?limit=30"); },
    enabled: !!company?.id && tab === 'log', staleTime: 15000,
  });

  var saveMut = useMutation({
    mutationFn: function(body: any) { return request("/companies/" + company!.id + "/dental/automation/config", { method: "PUT", body: body }); },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-auto-config"] }); toast.success("Configuracao salva!"); },
  });

  var triggerMut = useMutation({
    mutationFn: function(type: string) { return request("/companies/" + company!.id + "/dental/automation/" + type, { method: "POST", body: {} }); },
    onSuccess: function(res: any) { qc.invalidateQueries({ queryKey: ["dental-auto-log"] }); var r = res as any; toast.success((r.triggered || r.patients_found || 0) + " mensagem(ns) gerada(s)"); },
    onError: function() { toast.error("Erro ao disparar"); },
  });

  var cfg = (configData as any)?.config || {};

  function toggleField(field: string, value: boolean) {
    saveMut.mutate({ [field]: value });
  }

  var TYPE_LABELS: Record<string, { label: string; color: string }> = {
    confirm_24h: { label: "Confirmacao", color: "#06b6d4" },
    remind_2h: { label: "Lembrete", color: Colors.violet3 },
    recall: { label: "Recall", color: Colors.amber },
    satisfaction: { label: "Satisfacao", color: Colors.green },
    billing_reminder: { label: "Cobranca", color: Colors.red },
  };

  return (
    <View>
      <View style={z.tabRow}>
        <Pressable onPress={function() { setTab('config'); }} style={[z.tabBtn, tab === 'config' && z.tabBtnActive]}><Text style={[z.tabText, tab === 'config' && z.tabTextActive]}>Configuracao</Text></Pressable>
        <Pressable onPress={function() { setTab('log'); }} style={[z.tabBtn, tab === 'log' && z.tabBtnActive]}><Text style={[z.tabText, tab === 'log' && z.tabTextActive]}>Historico</Text></Pressable>
      </View>

      {tab === 'config' && (
        <View style={z.configList}>
          {loadingCfg && <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} />}
          {!loadingCfg && (
            <>
              <View style={z.configItem}>
                <View style={{ flex: 1 }}>
                  <Text style={z.configLabel}>Confirmacao automatica</Text>
                  <Text style={z.configHint}>Envia WhatsApp {cfg.confirm_hours_before || 24}h antes da consulta</Text>
                </View>
                <Switch value={cfg.confirm_enabled !== false} onValueChange={function(v) { toggleField('confirm_enabled', v); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
              </View>
              <View style={z.configItem}>
                <View style={{ flex: 1 }}>
                  <Text style={z.configLabel}>Lembrete 2h antes</Text>
                  <Text style={z.configHint}>Lembrete rapido antes da consulta</Text>
                </View>
                <Switch value={cfg.remind_enabled !== false} onValueChange={function(v) { toggleField('remind_enabled', v); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
              </View>
              <View style={z.configItem}>
                <View style={{ flex: 1 }}>
                  <Text style={z.configLabel}>Recall automatico</Text>
                  <Text style={z.configHint}>Lembrete apos {cfg.recall_days || 180} dias sem visita</Text>
                </View>
                <Switch value={cfg.recall_enabled !== false} onValueChange={function(v) { toggleField('recall_enabled', v); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
              </View>
              <View style={z.configItem}>
                <View style={{ flex: 1 }}>
                  <Text style={z.configLabel}>Pesquisa de satisfacao</Text>
                  <Text style={z.configHint}>Envia {cfg.satisfaction_hours_after || 24}h apos a consulta</Text>
                </View>
                <Switch value={cfg.satisfaction_enabled !== false} onValueChange={function(v) { toggleField('satisfaction_enabled', v); }} trackColor={{ true: Colors.green, false: Colors.bg4 }} thumbColor="#fff" />
              </View>

              <Text style={z.sectionTitle}>Disparar manualmente</Text>
              <View style={z.triggerRow}>
                <Pressable onPress={function() { triggerMut.mutate('trigger'); }} style={z.triggerBtn} disabled={triggerMut.isPending}>
                  <Icon name="send" size={14} color={Colors.violet3} />
                  <Text style={z.triggerText}>Confirmacoes 24h</Text>
                </Pressable>
                <Pressable onPress={function() { triggerMut.mutate('recall'); }} style={z.triggerBtn} disabled={triggerMut.isPending}>
                  <Icon name="refresh" size={14} color={Colors.amber} />
                  <Text style={z.triggerText}>Recall</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {tab === 'log' && (
        <View style={z.logList}>
          {loadingLog && <ActivityIndicator color={Colors.violet3} style={{ padding: 20 }} />}
          {!loadingLog && ((logData as any)?.log || []).length === 0 && (
            <View style={z.empty}><Icon name="mail" size={24} color={Colors.ink3} /><Text style={z.emptyText}>Nenhuma automacao disparada ainda</Text></View>
          )}
          {!loadingLog && ((logData as any)?.log || []).map(function(l: any) {
            var t = TYPE_LABELS[l.type] || { label: l.type, color: Colors.ink3 };
            return (
              <View key={l.id} style={z.logItem}>
                <View style={[z.logDot, { backgroundColor: t.color }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[z.logType, { color: t.color }]}>{t.label}</Text>
                    <Text style={z.logName}>{l.patient_name || ""}</Text>
                  </View>
                  <Text style={z.logMsg} numberOfLines={2}>{l.message}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={z.logTime}>{l.sent_at ? new Date(l.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}</Text>
                  <Text style={[z.logStatus, l.status === 'responded' && { color: Colors.green }]}>{l.status}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

var z = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  configList: { gap: 3 },
  configItem: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 12 },
  configLabel: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  configHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginTop: 16, marginBottom: 8 },
  triggerRow: { flexDirection: "row", gap: 8 },
  triggerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border2 },
  triggerText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  logList: { gap: 4 },
  logItem: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  logType: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  logName: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  logMsg: { fontSize: 10, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  logTime: { fontSize: 9, color: Colors.ink3 },
  logStatus: { fontSize: 9, fontWeight: "600", color: Colors.ink3, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 30, gap: 6 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
});

export default AutomationConfig;
