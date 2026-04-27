// ============================================================
// AURA. — Odonto Admin Tab Wrappers (operational)
// OrçamentosTab, ConvêniosTab, CheckinTab, EsperaTab, AgendaOnlineTab
// Extracted from OdontoTabWrappers.tsx
//
// PR20 (2026-04-27):
// - Novo orçamento (Caixa) agora vai pra /dental/(clinic)/tratamentos
//   (rota /pdv não existe no shell dental, fallback caía no Dashboard)
// - AgendaOnlineTab ganhou updateConfigMut pra salvar mudanças do form
// - Acentuação corrigida em strings UI
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { OrcamentoFunnel } from "@/components/verticals/odonto/OrcamentoFunnel";
import { ConvenioManager } from "@/components/verticals/odonto/ConvenioManager";
import { TissGuideManager } from "@/components/verticals/odonto/TissGuideManager";
import { CheckinPaciente } from "@/components/verticals/odonto/CheckinPaciente";
import { ListaEsperaDental } from "@/components/verticals/odonto/ListaEsperaDental";
import { AgendaOnline, type BookingConfig as AOConfig, type BookingRequest as AOReq } from "@/components/verticals/odonto/AgendaOnline";

function useCompanyId() { return useAuthStore().company?.id; }
function Loader() { return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>; }

// CTA reutilizavel pra criar orçamento. PR20: era /pdv (rota
// inexistente no shell dental → fallback Dashboard). Agora vai
// pra /dental/(clinic)/tratamentos onde dentista monta o plano.
function NovoOrcamentoCTA() {
  return (
    <Pressable onPress={function() { router.push("/dental/(clinic)/tratamentos" as any); }} style={z.ctaBtn}>
      <Icon name="file_text" size={14} color="#fff" />
      <Text style={z.ctaText}>Novo orçamento</Text>
    </Pressable>
  );
}

export function OrçamentosTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-treatment-plans", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/treatment-plans"); },
    enabled: !!cid, staleTime: 30000,
  });
  if (isLoading) return <Loader />;
  var plans = ((data as any)?.plans) || [];
  if (plans.length === 0) {
    return (
      <View style={z.empty}>
        <Icon name="file_text" size={24} color={Colors.ink3} />
        <Text style={z.emptyText}>Nenhum orçamento criado</Text>
        <Text style={z.hintText}>Crie orçamentos pela aba Tratamentos ou pelo Hub do paciente.</Text>
        <View style={{ marginTop: 12 }}><NovoOrcamentoCTA /></View>
      </View>
    );
  }
  var funnelData = plans.map(function(p: any) {
    return { id: p.id, patient_name: p.patient_name || "", title: p.title || "Orçamento", total_amount: parseFloat(p.total_amount) || 0, status: p.status || "pending", items_done: parseInt(p.items_done) || 0, items_total: parseInt(p.items_total) || 0, created_at: p.created_at };
  });
  return (
    <View style={{ gap: 12 }}>
      <View style={z.headerRow}>
        <Text style={z.headerTitle}>{plans.length} orçamento{plans.length > 1 ? "s" : ""}</Text>
        <NovoOrcamentoCTA />
      </View>
      <OrcamentoFunnel plans={funnelData} />
    </View>
  );
}

export function ConvêniosTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-insurance", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/insurance"); },
    enabled: !!cid, staleTime: 60000,
  });
  var { data: guides } = useQuery({
    queryKey: ["dental-tiss", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/insurance/tiss"); },
    enabled: !!cid, staleTime: 60000,
  });
  if (isLoading) return <Loader />;
  var insurances = ((data as any)?.insurance) || ((data as any)?.insurances) || [];
  var tissList = ((guides as any)?.guides) || [];

  if (insurances.length === 0 && tissList.length === 0) {
    return (
      <View style={z.empty}>
        <Icon name="shield" size={24} color={Colors.ink3} />
        <Text style={z.emptyText}>Nenhum convênio cadastrado</Text>
        <Text style={z.hintText}>Cadastre convênios e tabelas TUSS para faturamento via planos de saúde.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <ConvenioManager insurances={insurances} />
      {tissList.length > 0 && <TissGuideManager guides={tissList} />}
    </View>
  );
}

export function CheckinTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-checkin", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/advanced/checkins"); },
    enabled: !!cid, staleTime: 10000,
  });
  if (isLoading) return <Loader />;
  var checkins = ((data as any)?.checkins) || [];
  var stats = (data as any)?.stats || { waiting: 0, called: 0, in_service: 0, completed: 0 };
  return <CheckinPaciente checkins={checkins} stats={stats} />;
}

export function EsperaTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-waitlist", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/advanced/waitlist"); },
    enabled: !!cid, staleTime: 15000,
  });
  if (isLoading) return <Loader />;
  var entries = ((data as any)?.entries) || [];
  return <ListaEsperaDental entries={entries} />;
}

// ────────────────────────────────────────────────────────────
// AgendaOnlineTab (W1-03 + PR20 update)
// ────────────────────────────────────────────────────────────

function buildBookingUrl(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/dental/book/${slug}`;
  }
  return `https://app.getaura.com.br/dental/book/${slug}`;
}

function mapReqStatus(beStatus: string): 'pendente' | 'confirmado' | 'recusado' {
  if (beStatus === 'aprovado') return 'confirmado';
  if (beStatus === 'rejeitado') return 'recusado';
  return 'pendente';
}

export function AgendaOnlineTab() {
  var cid = useCompanyId();
  var qc = useQueryClient();

  var { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ["dental-booking-config", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/booking/config"); },
    enabled: !!cid, staleTime: 60000,
  });

  var { data: reqsData, isLoading: loadingReqs } = useQuery({
    queryKey: ["dental-booking-requests", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/booking/requests"); },
    enabled: !!cid, staleTime: 15000,
    refetchInterval: 30000,
  });

  var configRaw = (configData as any)?.config;
  var requestsRaw = ((reqsData as any)?.requests) || [];

  var config: AOConfig | null = useMemo(function() {
    if (!configRaw) return null;
    return {
      is_active:        !!configRaw.is_active,
      slug:             configRaw.slug || '',
      welcome_msg:      configRaw.welcome_msg || '',
      slot_duration_min: configRaw.slot_duration_min || 60,
      start_hour:       configRaw.start_hour || 8,
      end_hour:         configRaw.end_hour || 18,
      available_days:   Array.isArray(configRaw.available_days) ? configRaw.available_days : [1,2,3,4,5],
      require_phone:    configRaw.require_phone !== false,
      min_advance_hours: configRaw.min_advance_hours || 2,
      max_advance_days:  configRaw.max_advance_days || 30,
    };
  }, [configRaw]);

  var requests: AOReq[] = useMemo(function() {
    return requestsRaw.map(function(r: any) {
      return {
        id:             r.id,
        patient_name:   r.patient_name,
        patient_phone:  r.patient_phone,
        patient_email:  r.patient_email,
        preferred_date: r.preferred_date,
        preferred_time: r.preferred_time,
        chief_complaint: r.chief_complaint,
        status:         mapReqStatus(r.status),
        created_at:     r.created_at,
      };
    });
  }, [requestsRaw]);

  var bookingUrl = buildBookingUrl(config?.slug);

  var toggleActiveMut = useMutation({
    mutationFn: function(active: boolean) {
      return request("/companies/" + cid + "/dental/booking/config", {
        method: "PUT", body: { is_active: active },
      });
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["dental-booking-config", cid] });
    },
    onError: function(err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível atualizar o status.");
    },
  });

  var updateConfigMut = useMutation({
    mutationFn: function(patch: Partial<AOConfig>) {
      return request("/companies/" + cid + "/dental/booking/config", {
        method: "PUT", body: patch,
      });
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["dental-booking-config", cid] });
    },
    onError: function(err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar a configuração.");
    },
  });

  var convertMut = useMutation({
    mutationFn: function(requestId: string) {
      return request("/companies/" + cid + "/dental/booking/requests/" + requestId + "/convert", {
        method: "POST", body: {},
      });
    },
    onSuccess: function() {
      Alert.alert("Confirmado", "Solicitação convertida em agendamento. Veja na aba Agenda.");
      qc.invalidateQueries({ queryKey: ["dental-booking-requests", cid] });
      qc.invalidateQueries({ queryKey: ["dental-booking-config", cid] });
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
    },
    onError: function(err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível converter a solicitação.");
    },
  });

  var rejectMut = useMutation({
    mutationFn: function(requestId: string) {
      return request("/companies/" + cid + "/dental/booking/requests/" + requestId + "/reject", {
        method: "POST", body: {},
      });
    },
    onSuccess: function() {
      qc.invalidateQueries({ queryKey: ["dental-booking-requests", cid] });
    },
    onError: function(err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível recusar a solicitação.");
    },
  });

  if (loadingConfig || loadingReqs) return <Loader />;

  function handleConfirm(requestId: string) {
    Alert.alert(
      "Confirmar agendamento?",
      "Isso vai criar um agendamento na agenda e cadastrar o paciente (se ainda não existir). Você pode editar depois pela aba Agenda.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: function() { convertMut.mutate(requestId); } },
      ]
    );
  }

  function handleReject(requestId: string) {
    Alert.alert(
      "Recusar solicitação?",
      "Esta ação é irreversível. O paciente não será notificado automaticamente.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Recusar", style: "destructive", onPress: function() { rejectMut.mutate(requestId); } },
      ]
    );
  }

  return (
    <AgendaOnline
      config={config}
      requests={requests}
      bookingUrl={bookingUrl}
      saving={updateConfigMut.isPending}
      onToggleActive={function(active) { toggleActiveMut.mutate(active); }}
      onUpdateConfig={function(patch: Partial<AOConfig>) { updateConfigMut.mutate(patch); }}
      onConfirmRequest={handleConfirm}
      onRejectRequest={handleReject}
    />
  );
}

var z = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  hintText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.violet, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  ctaText: { fontSize: 12, color: "#fff", fontWeight: "700" },
});
