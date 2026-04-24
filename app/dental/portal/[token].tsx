// ============================================================
// AURA. — Portal do Paciente (PUBLICO, sem login)
// URL: /dental/portal/:token
// Backend: GET  /api/v1/dental-portal/:token
//          POST /api/v1/dental-portal/:token/confirm/:aid
//
// O token e gerado pelo dentista em /dental/portal/generate/:patientId
// com validade padrao de 30 dias. AuthGuard em app/_layout.tsx deixa
// rota /dental/* passar livre.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Nao podemos usar o services/api aqui — ele manda Authorization header
// e intercepta 401 pra deslogar. Precisamos de um fetch cru.
const BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "https://aura-backend-production-f805.up.railway.app/api/v1";

async function fetchPortal(token: string) {
  const r = await fetch(`${BASE_URL}/dental-portal/${encodeURIComponent(token)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err: any = new Error(data?.error || "Erro ao carregar");
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function confirmApp(token: string, aid: string) {
  const r = await fetch(`${BASE_URL}/dental-portal/${encodeURIComponent(token)}/confirm/${encodeURIComponent(aid)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "Erro ao confirmar");
  return data;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  agendado:       { label: "Agendada",       color: "#06B6D4", bg: "rgba(6,182,212,0.14)" },
  confirmado:     { label: "Confirmada",     color: "#10B981", bg: "rgba(16,185,129,0.14)" },
  em_atendimento: { label: "Em atendimento", color: "#F59E0B", bg: "rgba(245,158,11,0.14)" },
  concluido:      { label: "Concluida",      color: "#10B981", bg: "rgba(16,185,129,0.14)" },
  cancelado:      { label: "Cancelada",      color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" },
  faltou:         { label: "Nao compareceu", color: "#EF4444", bg: "rgba(239,68,68,0.14)" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return { date, time };
}

function formatDateOnly(iso: string) {
  // due_date vem como 'YYYY-MM-DD' sem timezone — tratar como UTC pra nao deslocar
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

const fmt = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function PatientPortalPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : (token || "");
  const qc = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal", tokenStr],
    queryFn: () => fetchPortal(tokenStr),
    enabled: !!tokenStr,
    staleTime: 60000,
    retry: 1,
  });

  const confirmMut = useMutation({
    mutationFn: (aid: string) => confirmApp(tokenStr, aid),
    onMutate: (aid) => { setConfirmingId(aid); setConfirmError(null); },
    onSettled: () => { setConfirmingId(null); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portal", tokenStr] }); },
    onError: (e: any) => { setConfirmError(e?.message || "Erro ao confirmar"); },
  });

  const portal = (data as any) || {};
  const patient = portal.patient || {};
  const clinic = portal.clinic || {};
  const appointments = portal.appointments || [];
  const plans = portal.treatment_plans || [];
  const payments = portal.payments || [];
  const documents = portal.documents || [];

  const overdue = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return payments.filter((p: any) => {
      if (!p.due_date) return false;
      return new Date(p.due_date) < today;
    });
  }, [payments]);

  // Loading
  if (isLoading) {
    return (
      <View style={s.container}>
        <View style={s.loaderBox}><ActivityIndicator color="#6d28d9" size="large" /></View>
      </View>
    );
  }

  // Token invalido ou expirado
  if (error) {
    const status = (error as any).status;
    const isExpired = status === 410;
    return (
      <View style={s.container}>
        <View style={s.errorBox}>
          <Text style={s.errorIcon}>{isExpired ? "\u23F0" : "\u26A0\uFE0F"}</Text>
          <Text style={s.errorTitle}>{isExpired ? "Link expirado" : "Link invalido"}</Text>
          <Text style={s.errorText}>
            {isExpired
              ? "Este link do portal expirou. Entre em contato com a clinica para receber um novo."
              : "Este link nao e valido. Verifique se voce copiou o endereco corretamente ou solicite um novo a clinica."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.clinicName}>{clinic.name || "Clinica Odontologica"}</Text>
        <Text style={s.patientName}>Ola, {patient.name || "paciente"}</Text>
        <Text style={s.patientContact}>
          Este e o seu portal. Acompanhe suas consultas, tratamentos e documentos.
        </Text>
      </View>

      {/* Consultas */}
      <Text style={s.sectionTitle}>Suas consultas</Text>
      {appointments.length === 0 && (
        <View style={s.emptyCard}><Text style={s.emptyText}>Voce nao tem consultas agendadas.</Text></View>
      )}
      {appointments.map((a: any) => {
        const meta = STATUS_META[a.status] || STATUS_META.agendado;
        const { date, time } = formatDateTime(a.date);
        const canConfirm = a.status === "agendado";
        const isConfirming = confirmingId === a.id;
        return (
          <View key={a.id} style={s.apptCard}>
            <View style={s.apptHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.apptDate}>{date}</Text>
                <Text style={s.apptTime}>as {time} \u2022 {a.duration || 60}min</Text>
              </View>
              <View style={[s.badge, { backgroundColor: meta.bg }]}>
                <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            {a.complaint && <Text style={s.apptComplaint}>{a.complaint}</Text>}
            {canConfirm && (
              <Pressable
                onPress={() => confirmMut.mutate(a.id)}
                style={[s.confirmBtn, isConfirming && { opacity: 0.6 }]}
                disabled={isConfirming}
              >
                {isConfirming
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmBtnText}>Confirmar minha presenca</Text>}
              </Pressable>
            )}
          </View>
        );
      })}
      {confirmError && <Text style={s.errorInline}>{confirmError}</Text>}

      {/* Planos de tratamento */}
      {plans.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Tratamentos</Text>
          {plans.map((p: any) => {
            const progress = p.total_items > 0 ? Math.round((p.done / p.total_items) * 100) : 0;
            return (
              <View key={p.id} style={s.planCard}>
                <View style={s.planHead}>
                  <Text style={s.planTitle}>{p.title || "Plano de tratamento"}</Text>
                  <Text style={s.planValue}>{fmt(p.total)}</Text>
                </View>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={s.planProgress}>
                  {p.done} de {p.total_items} procedimentos ({progress}%)
                </Text>
              </View>
            );
          })}
        </>
      )}

      {/* Parcelas */}
      {payments.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Parcelas em aberto</Text>
          {overdue.length > 0 && (
            <View style={s.alertCard}>
              <Text style={s.alertText}>
                Voce tem {overdue.length} parcela{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""}.
                Entre em contato com a clinica para regularizar.
              </Text>
            </View>
          )}
          {payments.map((p: any) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isOverdue = p.due_date && new Date(p.due_date) < today;
            return (
              <View key={p.id} style={s.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.paymentDate}>
                    Vence em {formatDateOnly(p.due_date)}
                  </Text>
                  {isOverdue && <Text style={s.overdueTag}>VENCIDA</Text>}
                </View>
                <Text style={s.paymentAmount}>{fmt(p.amount)}</Text>
              </View>
            );
          })}
        </>
      )}

      {/* Documentos */}
      {documents.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Documentos</Text>
          {documents.map((d: any) => (
            <View key={d.id} style={s.docCard}>
              <Text style={s.docType}>{d.doc_type === "receituario" ? "Receita" : d.doc_type === "atestado" ? "Atestado" : d.doc_type}</Text>
              <Text style={s.docContent} numberOfLines={3}>{d.content}</Text>
              <Text style={s.docDate}>
                Emitido em {d.issued_at ? formatDateTime(d.issued_at).date : "-"}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Rodape */}
      <View style={s.footer}>
        <Text style={s.footerText}>Portal do paciente \u2022 Aura.</Text>
        <Text style={s.footerTextSmall}>
          Em caso de duvidas, entre em contato diretamente com a clinica.
        </Text>
      </View>
    </ScrollView>
  );
}

const PAGE_BG = "#0a0a1a";
const CARD_BG = "#151528";
const CARD_BORDER = "#2a2a44";
const INK = "#ffffff";
const INK_MUTED = "#9ca3af";
const VIOLET = "#8b5cf6";
const VIOLET_BG = "rgba(139,92,246,0.12)";
const GREEN = "#10B981";

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: PAGE_BG },
  content:      { padding: 20, paddingBottom: 60, maxWidth: 720, alignSelf: "center", width: "100%" },

  loaderBox:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 60 },
  errorBox:     { alignItems: "center", gap: 12, paddingVertical: 60, paddingHorizontal: 20, maxWidth: 480, alignSelf: "center" },
  errorIcon:    { fontSize: 42 },
  errorTitle:   { fontSize: 20, fontWeight: "700", color: INK, textAlign: "center" },
  errorText:    { fontSize: 13, color: INK_MUTED, textAlign: "center", lineHeight: 20 },
  errorInline:  { fontSize: 12, color: "#EF4444", textAlign: "center", marginTop: 8 },

  header:       { alignItems: "center", paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: CARD_BORDER, marginBottom: 20 },
  clinicName:   { fontSize: 12, color: VIOLET, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  patientName:  { fontSize: 22, fontWeight: "700", color: INK, marginTop: 8 },
  patientContact:{ fontSize: 12, color: INK_MUTED, marginTop: 4, textAlign: "center", maxWidth: 360 },

  sectionTitle: { fontSize: 11, fontWeight: "700", color: INK_MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },

  emptyCard:    { backgroundColor: CARD_BG, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: CARD_BORDER, alignItems: "center" },
  emptyText:    { fontSize: 13, color: INK_MUTED },

  apptCard:     { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: CARD_BORDER, marginBottom: 10, gap: 8 },
  apptHead:     { flexDirection: "row", alignItems: "center", gap: 10 },
  apptDate:     { fontSize: 15, fontWeight: "700", color: INK, textTransform: "capitalize" as any },
  apptTime:     { fontSize: 12, color: INK_MUTED, marginTop: 2 },
  apptComplaint:{ fontSize: 12, color: INK_MUTED, fontStyle: "italic" },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText:    { fontSize: 10, fontWeight: "700" },
  confirmBtn:   { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 11, alignItems: "center", marginTop: 4 },
  confirmBtnText:{ color: "#fff", fontSize: 13, fontWeight: "700" },

  planCard:     { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: CARD_BORDER, marginBottom: 10, gap: 8 },
  planHead:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planTitle:    { fontSize: 14, fontWeight: "600", color: INK, flex: 1 },
  planValue:    { fontSize: 14, fontWeight: "700", color: GREEN },
  progressBar:  { height: 6, backgroundColor: CARD_BORDER, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: VIOLET },
  planProgress: { fontSize: 11, color: INK_MUTED },

  alertCard:    { backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#EF4444", marginBottom: 10 },
  alertText:    { fontSize: 12, color: "#FCA5A5", lineHeight: 18 },

  paymentRow:   { flexDirection: "row", alignItems: "center", backgroundColor: CARD_BG, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: CARD_BORDER, marginBottom: 6 },
  paymentDate:  { fontSize: 13, color: INK, fontWeight: "500" },
  paymentAmount:{ fontSize: 14, color: GREEN, fontWeight: "700" },
  overdueTag:   { fontSize: 9, color: "#EF4444", fontWeight: "700", marginTop: 2, letterSpacing: 0.5 },

  docCard:      { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: CARD_BORDER, marginBottom: 10, gap: 6 },
  docType:      { fontSize: 11, color: VIOLET, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  docContent:   { fontSize: 12, color: INK, lineHeight: 18 },
  docDate:      { fontSize: 10, color: INK_MUTED },

  footer:       { marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: CARD_BORDER, alignItems: "center", gap: 4 },
  footerText:   { fontSize: 11, color: INK_MUTED, fontWeight: "600" },
  footerTextSmall:{ fontSize: 10, color: INK_MUTED, textAlign: "center", maxWidth: 320 },
});
