// ============================================================
// AURA. — Odonto Admin Tab Wrappers (operational)
// OrcamentosTab, ConveniosTab, CheckinTab, EsperaTab, AgendaOnlineTab
// Extracted from OdontoTabWrappers.tsx
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

// D-FIX #5: CTA reutilizavel pra criar orcamento pelo Caixa.
// Redireciona pra aba /pdv onde o dentista adiciona produtos/procedimentos
// ao carrinho e clica em "Orcamento" pra gerar o PDF.
function NovoOrcamentoCTA() {
  return (
    <Pressable onPress={function() { router.push("/pdv"); }} style={z.ctaBtn}>
      <Icon name="file_text" size={14} color="#fff" />
      <Text style={z.ctaText}>Novo orcamento (Caixa)</Text>
    </Pressable>
  );
}

export function OrcamentosTab() {
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
        <Text style={z.emptyText}>Nenhum orcamento criado</Text>
        <Text style={z.hintText}>Crie orcamentos pelo Caixa ou pelas abas Pacientes / Odontograma.</Text>
        <View style={{ marginTop: 12 }}><NovoOrcamentoCTA /></View>
      </View>
    );
  }
  var funnelData = plans.map(function(p: any) {
    return { id: p.id, patient_name: p.patient_name || "", title: p.title || "Orcamento", total_amount: parseFloat(p.total_amount) || 0, status: p.status || "pending", items_done: parseInt(p.items_done) || 0, items_total: parseInt(p.items_total) || 0, created_at: p.created_at };
  });
  return (
    <View style={{ gap: 12 }}>
      <View style={z.headerRow}>
        <Text style={z.headerTitle}>{plans.length} orcamento{plans.length > 1 ? "s" : ""}</Text>
        <NovoOrcamentoCTA />
      </View>
      <OrcamentoFunnel plans={funnelData} />
    </View>
  );
}

export function ConveniosTab() {
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
  // BUG #8 fix: backend retorna { insurance: rows } (singular), frontend
  // estava lendo `insurances` (plural) -> sempre vazio -> tela em branco.
  // Tambem aceita `insurances` por compatibilidade caso o backend mude.
  var insurances = ((data as any)?.insurance) || ((data as any)?.insurances) || [];
  var tissList = ((guides as any)?.guides) || [];

  if (insurances.length === 0 && tissList.length === 0) {
    return (
      <View style={z.empty}>
        <Icon name="shield" size={24} color={Colors.ink3} />
        <Text style={z.emptyText}>Nenhum convenio cadastrado</Text>
        <Text style={z.hintText}>Cadastre convenios e tabelas TUSS para faturamento via planos de saude.</Text>
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
// AgendaOnlineTab (W1-03)
// ────────────────────────────────────────────────────────────
//
// Conecta o componente AgendaOnline.tsx aos endpoints do
// dentalBookingAdmin.js. Faz toda a normalizacao necessaria:
//
// - Backend usa status pendente|aprovado|rejeitado
//   FE original espera pendente|confirmado|recusado
//   -> map nos dois sentidos
//
// - bookingUrl montado a partir de window.location.origin no web
//   ou fallback https://app.getaura.com.br no nativo
//
// - Toggle ativar/desativar = PUT { is_active }
// - Convert = POST /booking/requests/:rid/convert (sem body extra,
//   backend usa preferred_date+time da propria request, duration
//   default 60min, sem practitioner_id)
// - Reject = POST /booking/requests/:rid/reject
// ────────────────────────────────────────────────────────────

function buildBookingUrl(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/dental/book/${slug}`;
  }
  return `https://app.getaura.com.br/dental/book/${slug}`;
}

// Backend status -> componente status
function mapReqStatus(beStatus: string): 'pendente' | 'confirmado' | 'recusado' {
  if (beStatus === 'aprovado') return 'confirmado';
  if (beStatus === 'rejeitado') return 'recusado';
  return 'pendente';
}

export function AgendaOnlineTab() {
  var cid = useCompanyId();
  var qc = useQueryClient();

  // Config (cria default no GET se nao existir)
  var { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ["dental-booking-config", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/booking/config"); },
    enabled: !!cid, staleTime: 60000,
  });

  // Requests (todos os status, ordenados pendentes primeiro)
  var { data: reqsData, isLoading: loadingReqs } = useQuery({
    queryKey: ["dental-booking-requests", cid],
    queryFn: function() { return request("/companies/" + cid + "/dental/booking/requests"); },
    enabled: !!cid, staleTime: 15000,
    refetchInterval: 30000,  // polling a cada 30s pra trazer requests novos
  });

  var configRaw = (configData as any)?.config;
  var requestsRaw = ((reqsData as any)?.requests) || [];

  // Normaliza config pro shape do componente AgendaOnline
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

  // Normaliza requests pro shape do componente
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

  // ── Mutations ──
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
      Alert.alert("Erro", err?.message || "Nao foi possivel atualizar o status.");
    },
  });

  var convertMut = useMutation({
    mutationFn: function(requestId: string) {
      return request("/companies/" + cid + "/dental/booking/requests/" + requestId + "/convert", {
        method: "POST", body: {},
      });
    },
    onSuccess: function() {
      Alert.alert("Confirmado", "Solicitacao convertida em agendamento. Veja na aba Agenda.");
      qc.invalidateQueries({ queryKey: ["dental-booking-requests", cid] });
      qc.invalidateQueries({ queryKey: ["dental-booking-config", cid] });  // booked_slots muda
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });  // agenda da aba Agenda
    },
    onError: function(err: any) {
      Alert.alert("Erro", err?.message || "Nao foi possivel converter a solicitacao.");
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
      Alert.alert("Erro", err?.message || "Nao foi possivel recusar a solicitacao.");
    },
  });

  if (loadingConfig || loadingReqs) return <Loader />;

  // Confirmacao antes de converter (cria appointment + paciente, irreversivel)
  function handleConfirm(requestId: string) {
    Alert.alert(
      "Confirmar agendamento?",
      "Isso vai criar um agendamento na agenda e cadastrar o paciente (se ainda nao existir). Voce pode editar depois pela aba Agenda.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: function() { convertMut.mutate(requestId); } },
      ]
    );
  }

  function handleReject(requestId: string) {
    Alert.alert(
      "Recusar solicitacao?",
      "Esta acao e irreversivel. O paciente nao sera notificado automaticamente.",
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
      onToggleActive={function(active) { toggleActiveMut.mutate(active); }}
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
