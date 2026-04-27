import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Switch } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-11: AgendaOnline — Online booking management
// Admin view: booking config (editavel) + pending requests
// PR20 (2026-04-27): config editavel com form persistente,
// suporta janela 0-23h (24h) e ajuste de dias/intervalo/antecedencia.
// ============================================================

export interface BookingConfig {
  is_active: boolean;
  slug: string;
  welcome_msg: string;
  slot_duration_min: number;
  start_hour: number;
  end_hour: number;
  available_days: number[];
  require_phone: boolean;
  min_advance_hours: number;
  max_advance_days: number;
}

export interface BookingRequest {
  id: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  preferred_date: string;
  preferred_time: string;
  chief_complaint?: string;
  status: "pendente" | "confirmado" | "recusado";
  created_at: string;
}

interface Props {
  config: BookingConfig | null;
  requests: BookingRequest[];
  bookingUrl?: string;
  saving?: boolean;
  onToggleActive?: (active: boolean) => void;
  onUpdateConfig?: (config: Partial<BookingConfig>) => void;
  onConfirmRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90];

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pendente:   { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Pendente" },
  confirmado: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Confirmado" },
  recusado:   { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Recusado" },
};

function clampHour(n: number, min = 0, max = 23): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function AgendaOnline({ config, requests, bookingUrl, saving, onToggleActive, onUpdateConfig, onConfirmRequest, onRejectRequest }: Props) {
  const pending = requests.filter(r => r.status === "pendente");

  const [draft, setDraft] = useState<BookingConfig | null>(config);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(config);
    setDirty(false);
  }, [
    config?.slot_duration_min, config?.start_hour, config?.end_hour,
    config?.min_advance_hours, config?.max_advance_days,
    config?.require_phone, config?.welcome_msg,
    JSON.stringify(config?.available_days || []),
  ]);

  function update<K extends keyof BookingConfig>(k: K, v: BookingConfig[K]) {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
    setDirty(true);
  }

  function toggleDay(idx: number) {
    if (!draft) return;
    const set = new Set(draft.available_days);
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    setDraft({ ...draft, available_days: Array.from(set).sort() });
    setDirty(true);
  }

  function save() {
    if (!draft || !onUpdateConfig) return;
    onUpdateConfig({
      welcome_msg: draft.welcome_msg,
      slot_duration_min: draft.slot_duration_min,
      start_hour: clampHour(draft.start_hour, 0, 23),
      end_hour: clampHour(draft.end_hour, 1, 24),
      available_days: draft.available_days,
      require_phone: draft.require_phone,
      min_advance_hours: Math.max(0, draft.min_advance_hours || 0),
      max_advance_days: Math.max(1, draft.max_advance_days || 30),
    });
  }

  function reset() {
    setDraft(config);
    setDirty(false);
  }

  return (
    <View style={s.container}>
      <View style={s.statusCard}>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: config?.is_active ? "#10B981" : "#EF4444" }]} />
          <Text style={s.statusText}>
            Agendamento online {config?.is_active ? "ativo" : "desativado"}
          </Text>
          {onToggleActive && (
            <Pressable
              onPress={() => onToggleActive(!config?.is_active)}
              style={[s.toggleBtn, config?.is_active ? { borderColor: "#EF4444" } : { borderColor: "#10B981" }]}
            >
              <Text style={[s.toggleText, config?.is_active ? { color: "#EF4444" } : { color: "#10B981" }]}>
                {config?.is_active ? "Desativar" : "Ativar"}
              </Text>
            </Pressable>
          )}
        </View>
        {bookingUrl && config?.is_active && (
          <View style={s.linkBox}>
            <Text style={s.linkLabel}>Link para pacientes:</Text>
            <Text style={s.linkUrl}>{bookingUrl}</Text>
          </View>
        )}
      </View>

      {draft && (
        <View style={s.configCard}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={s.title}>Configuração</Text>
            {dirty && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable onPress={reset} style={[s.btn, s.btnGhost]} disabled={saving}>
                  <Text style={s.btnText}>Descartar</Text>
                </Pressable>
                <Pressable onPress={save} style={[s.btn, s.btnPrimary]} disabled={saving}>
                  <Text style={[s.btnText, { color: "#fff" }]}>{saving ? "Salvando..." : "Salvar"}</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={s.configLabel}>Mensagem de boas-vindas</Text>
            <TextInput
              value={draft.welcome_msg}
              onChangeText={(v) => update("welcome_msg", v)}
              placeholder="Ex: Agende sua consulta odontológica online"
              placeholderTextColor={Colors.ink3 || "#888"}
              multiline
              style={s.input}
            />
          </View>

          <View style={s.formGrid}>
            <View style={s.formItem}>
              <Text style={s.configLabel}>Intervalo entre slots (min)</Text>
              <View style={s.chipRow}>
                {SLOT_OPTIONS.map((m) => (
                  <Pressable key={m} onPress={() => update("slot_duration_min", m)}
                    style={[s.chip, draft.slot_duration_min === m && s.chipActive]}>
                    <Text style={[s.chipText, draft.slot_duration_min === m && s.chipTextActive]}>{m}min</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.formItem}>
              <Text style={s.configLabel}>Hora início (0-23)</Text>
              <TextInput
                value={String(draft.start_hour)}
                onChangeText={(v) => update("start_hour", clampHour(parseInt(v) || 0, 0, 23))}
                keyboardType="numeric" maxLength={2}
                style={[s.input, { width: 80 }]}
              />
            </View>

            <View style={s.formItem}>
              <Text style={s.configLabel}>Hora fim (1-24)</Text>
              <TextInput
                value={String(draft.end_hour)}
                onChangeText={(v) => update("end_hour", clampHour(parseInt(v) || 0, 1, 24))}
                keyboardType="numeric" maxLength={2}
                style={[s.input, { width: 80 }]}
              />
              <Text style={s.hintText}>
                {draft.end_hour - draft.start_hour <= 0
                  ? "⚠ Hora fim precisa ser maior que início"
                  : draft.end_hour - draft.start_hour >= 23
                    ? "Janela 24h ativa"
                    : `Janela: ${draft.end_hour - draft.start_hour}h`}
              </Text>
            </View>

            <View style={s.formItem}>
              <Text style={s.configLabel}>Antecedência mínima (h)</Text>
              <TextInput
                value={String(draft.min_advance_hours)}
                onChangeText={(v) => update("min_advance_hours", Math.max(0, parseInt(v) || 0))}
                keyboardType="numeric" maxLength={3}
                style={[s.input, { width: 80 }]}
              />
            </View>

            <View style={s.formItem}>
              <Text style={s.configLabel}>Antecedência máxima (dias)</Text>
              <TextInput
                value={String(draft.max_advance_days)}
                onChangeText={(v) => update("max_advance_days", Math.max(1, parseInt(v) || 1))}
                keyboardType="numeric" maxLength={3}
                style={[s.input, { width: 80 }]}
              />
            </View>
          </View>

          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.configLabel, { marginBottom: 0 }]}>Telefone obrigatório</Text>
              <Text style={s.hintText}>Recomendado pra confirmações por WhatsApp.</Text>
            </View>
            <Switch
              value={draft.require_phone}
              onValueChange={(v) => update("require_phone", v)}
              trackColor={{ false: Colors.border || "#333", true: "#06B6D4" }}
            />
          </View>

          <Text style={[s.configLabel, { marginTop: 8 }]}>Dias disponíveis</Text>
          <View style={s.daysRow}>
            {DAYS.map((d, i) => {
              const active = draft.available_days.includes(i);
              return (
                <Pressable key={i} onPress={() => toggleDay(i)} style={[s.dayChip, active && s.dayChipActive]}>
                  <Text style={[s.dayText, active && s.dayTextActive]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={s.requestsSection}>
        <Text style={s.title}>Solicitações ({pending.length} pendentes)</Text>
        {requests.map(req => {
          const st = STATUS_MAP[req.status] || STATUS_MAP.pendente;
          return (
            <View key={req.id} style={s.reqCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.reqName}>{req.patient_name}</Text>
                <Text style={s.reqDate}>
                  {new Date(req.preferred_date).toLocaleDateString("pt-BR")} às {req.preferred_time}
                </Text>
                {req.patient_phone && <Text style={s.reqPhone}>{req.patient_phone}</Text>}
                {req.chief_complaint && <Text style={s.reqComplaint}>{req.chief_complaint}</Text>}
              </View>
              <View style={[s.reqBadge, { backgroundColor: st.bg }]}>
                <Text style={[s.reqBadgeText, { color: st.color }]}>{st.label}</Text>
              </View>
              {req.status === "pendente" && (
                <View style={s.reqActions}>
                  {onConfirmRequest && <Pressable onPress={() => onConfirmRequest(req.id)} style={[s.reqBtn, { borderColor: "#10B981" }]}><Text style={[s.reqBtnText, { color: "#10B981" }]}>Confirmar</Text></Pressable>}
                  {onRejectRequest && <Pressable onPress={() => onRejectRequest(req.id)} style={[s.reqBtn, { borderColor: "#EF4444" }]}><Text style={[s.reqBtnText, { color: "#EF4444" }]}>Recusar</Text></Pressable>}
                </View>
              )}
            </View>
          );
        })}
        {requests.length === 0 && <Text style={s.emptyText}>Nenhuma solicitação recebida.</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  statusCard: { padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff", flex: 1 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 0.5 },
  toggleText: { fontSize: 11, fontWeight: "600" },
  linkBox: { backgroundColor: "rgba(6,182,212,0.06)", borderRadius: 8, padding: 10, gap: 4 },
  linkLabel: { fontSize: 10, color: Colors.ink3 || "#888" },
  linkUrl: { fontSize: 12, color: "#06B6D4", fontWeight: "500", fontFamily: "monospace" },
  configCard: { padding: 14, borderRadius: 12, backgroundColor: Colors.bg2 || "#1a1a2e", borderWidth: 0.5, borderColor: Colors.border || "#333", gap: 8 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink || "#fff" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 6 },
  formItem: { gap: 4, minWidth: 140 },
  configLabel: { fontSize: 10, color: Colors.ink3 || "#888", textTransform: "uppercase", fontWeight: "600", marginBottom: 4 },
  hintText: { fontSize: 9, color: Colors.ink3 || "#888", marginTop: 2 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: Colors.border || "#333", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    color: Colors.ink || "#fff", fontSize: 13,
  },
  chipRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border || "#333" },
  chipActive: { backgroundColor: "rgba(6,182,212,0.12)", borderColor: "#06B6D4" },
  chipText: { fontSize: 11, color: Colors.ink3 || "#888", fontWeight: "600" },
  chipTextActive: { color: "#06B6D4" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 8, marginTop: 6 },
  daysRow: { flexDirection: "row", gap: 4, marginTop: 4, flexWrap: "wrap" },
  dayChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border || "#333" },
  dayChipActive: { backgroundColor: "rgba(6,182,212,0.12)", borderColor: "#06B6D4" },
  dayText: { fontSize: 11, color: Colors.ink3 || "#888" },
  dayTextActive: { color: "#06B6D4", fontWeight: "600" },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: Colors.border || "#333" },
  btnPrimary: { backgroundColor: "#06B6D4", borderColor: "#06B6D4" },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { fontSize: 11, fontWeight: "600", color: Colors.ink || "#fff" },
  requestsSection: { gap: 8 },
  reqCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, backgroundColor: Colors.bg2 || "#1a1a2e",
    borderWidth: 0.5, borderColor: Colors.border || "#333",
  },
  reqName: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  reqDate: { fontSize: 12, color: "#06B6D4", marginTop: 2 },
  reqPhone: { fontSize: 11, color: Colors.ink2 || "#aaa", marginTop: 1 },
  reqComplaint: { fontSize: 11, color: Colors.ink3 || "#888", fontStyle: "italic", marginTop: 2 },
  reqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reqBadgeText: { fontSize: 10, fontWeight: "600" },
  reqActions: { gap: 4 },
  reqBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 },
  reqBtnText: { fontSize: 10, fontWeight: "600" },
  emptyText: { fontSize: 12, color: Colors.ink3 || "#888", textAlign: "center", paddingVertical: 16 },
});

export default AgendaOnline;
