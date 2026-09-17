import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { DentalColors } from "@/constants/dental-tokens";
import { formatDateOnlyBR } from "@/utils/dateOnly";
import {
  type ClinicHours,
  WEEKDAY_SHORT,
  WEEKDAYS_UTEIS,
  timeToMinutes,
  minutesToTime,
  clipShiftsToWindow,
} from "@/utils/clinicHours";

// ============================================================
// D-11: AgendaOnline — Online booking management
// Admin view: booking config (editavel) + pending requests
// PR20 (2026-04-27): config editavel com form persistente,
// suporta janela 0-23h (24h) e ajuste de dias/intervalo/antecedencia.
//
// Item 2 (horário da clínica): "Hora início" / "Hora fim" /
// "Dias disponíveis" soltos saíram. Agora: "Usar horário da
// clínica" (padrão ligado, herda e só restringe) com prévia em
// barras por dia. Quando `effective.source === "legacy"` (clínica
// ainda não salvou horário em /hours), mostra aviso + mantém os
// campos antigos (start_hour/end_hour/available_days) funcionando.
// ============================================================

export type OnlineWindow = { from: string; to: string; days: number[] }; // days: weekday 1=seg..7=dom

export interface BookingConfig {
  is_active: boolean;
  slug: string;
  welcome_msg: string;
  require_phone: boolean;
  min_advance_hours: number;
  max_advance_days: number;
  use_clinic_hours: boolean;
  online_window: OnlineWindow | null;
  slot_duration_custom: number | null; // null = segue intervalo padrão da clínica
  // Campos legados — só usados quando effective.source === "legacy"
  start_hour: number;
  end_hour: number;
  available_days: number[]; // 0=domingo (legado)
}

export interface BookingEffective {
  source: "clinic" | "window" | "legacy";
  clinic_hours_configured: boolean;
  slot_duration_min: number;
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
  effective: BookingEffective | null;
  clinicHours: ClinicHours;
  requests: BookingRequest[];
  bookingUrl?: string;
  saving?: boolean;
  onToggleActive?: (active: boolean) => void;
  onUpdateConfig?: (config: Partial<BookingConfig>) => void;
  onGotoClinicHours?: () => void;
  onConfirmRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // legado, 0=domingo
const AXIS_START = 7 * 60, AXIS_END = 19 * 60;

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pendente:   { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", label: "Pendente" },
  confirmado: { bg: "rgba(16,185,129,0.12)", color: "#10B981", label: "Confirmado" },
  recusado:   { bg: "rgba(239,68,68,0.12)",  color: "#EF4444", label: "Recusado" },
};

function clampHour(n: number, min = 0, max = 23): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// Menor abertura e maior fechamento da semana (usado pra avisar quando a
// janela online ultrapassa o horário real da clínica).
function clinicBounds(clinicHours: ClinicHours): { minOpen: number; maxClose: number } | null {
  let minOpen = 24 * 60, maxClose = 0, any = false;
  for (const day of clinicHours) {
    if (!day.open) continue;
    for (const sh of day.shifts) {
      any = true;
      minOpen = Math.min(minOpen, timeToMinutes(sh.start));
      maxClose = Math.max(maxClose, timeToMinutes(sh.end));
    }
  }
  return any ? { minOpen, maxClose } : null;
}

function DayBars({
  clinicHours,
  windowFrom,
  windowTo,
  onlineDays,
}: {
  clinicHours: ClinicHours;
  windowFrom: number | null; // null = sem restrição (usa a clínica inteira)
  windowTo: number | null;
  onlineDays: number[] | null; // weekdays 1..7, null = todos que a clínica abre
}) {
  const pct = (m: number) => `${(((m - AXIS_START) / (AXIS_END - AXIS_START)) * 100).toFixed(2)}%`;
  const wpct = (a: number, b: number) => `${(((b - a) / (AXIS_END - AXIS_START)) * 100).toFixed(2)}%`;
  return (
    <View style={{ marginTop: 10 }}>
      {clinicHours.map((day) => {
        if (!day.open) return null;
        const online = onlineDays === null || onlineDays.includes(day.weekday);
        const from = windowFrom ?? 0;
        const to = windowTo ?? 24 * 60;
        const offered = online ? clipShiftsToWindow(day.shifts, from, to) : [];
        return (
          <View key={day.weekday} style={s.roLine}>
            <Text style={s.roDay}>{WEEKDAY_SHORT[day.weekday]}</Text>
            <View style={s.bar}>
              {day.shifts.map((sh, i) => {
                const a = Math.max(timeToMinutes(sh.start), AXIS_START);
                const b = Math.min(timeToMinutes(sh.end), AXIS_END);
                if (b <= a) return null;
                return <View key={i} style={[s.barClinic, { left: pct(a), width: wpct(a, b) }]} />;
              })}
              {offered.map((r, i) => {
                const a = Math.max(r.start, AXIS_START);
                const b = Math.min(r.end, AXIS_END);
                if (b <= a) return null;
                return <View key={i} style={[s.barOnline, { left: pct(a), width: wpct(a, b) }]} />;
              })}
            </View>
          </View>
        );
      })}
      <View style={s.axisRow}>
        <Text style={s.axisLabel}>07h</Text>
        <Text style={s.axisLabel}>10h</Text>
        <Text style={s.axisLabel}>13h</Text>
        <Text style={s.axisLabel}>16h</Text>
        <Text style={s.axisLabel}>19h</Text>
      </View>
    </View>
  );
}

export function AgendaOnline({
  config, effective, clinicHours, requests, bookingUrl, saving,
  onToggleActive, onUpdateConfig, onGotoClinicHours, onConfirmRequest, onRejectRequest,
}: Props) {
  const pending = requests.filter(r => r.status === "pendente");

  const [draft, setDraft] = useState<BookingConfig | null>(config);
  const [dirty, setDirty] = useState(false);
  const [preset, setPreset] = useState<"manha" | "tarde" | "custom">("custom");

  useEffect(() => {
    setDraft(config);
    setDirty(false);
  }, [
    config?.welcome_msg, config?.require_phone, config?.min_advance_hours, config?.max_advance_days,
    config?.use_clinic_hours, config?.slot_duration_custom,
    JSON.stringify(config?.online_window || null),
    config?.start_hour, config?.end_hour, JSON.stringify(config?.available_days || []),
  ]);

  const isLegacy = effective?.source === "legacy";

  function update<K extends keyof BookingConfig>(k: K, v: BookingConfig[K]) {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
    setDirty(true);
  }

  function updateWindow(patch: Partial<OnlineWindow>) {
    if (!draft) return;
    const base: OnlineWindow = draft.online_window || { from: "08:00", to: "18:00", days: WEEKDAYS_UTEIS };
    setDraft({ ...draft, online_window: { ...base, ...patch } });
    setDirty(true);
  }

  function toggleOnlineDay(weekday: number) {
    if (!draft) return;
    const base: OnlineWindow = draft.online_window || { from: "08:00", to: "18:00", days: WEEKDAYS_UTEIS };
    const set = new Set(base.days);
    if (set.has(weekday)) set.delete(weekday); else set.add(weekday);
    updateWindow({ days: Array.from(set).sort((a, b) => a - b) });
  }

  function toggleLegacyDay(idx: number) {
    if (!draft) return;
    const set = new Set(draft.available_days);
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    setDraft({ ...draft, available_days: Array.from(set).sort() });
    setDirty(true);
  }

  function applyPreset(p: "manha" | "tarde" | "custom") {
    setPreset(p);
    if (p === "manha") updateWindow({ from: "08:00", to: "12:00" });
    else if (p === "tarde") updateWindow({ from: "13:00", to: "18:00" });
  }

  function save() {
    if (!draft || !onUpdateConfig) return;
    if (isLegacy) {
      onUpdateConfig({
        welcome_msg: draft.welcome_msg,
        start_hour: clampHour(draft.start_hour, 0, 23),
        end_hour: clampHour(draft.end_hour, 1, 24),
        available_days: draft.available_days,
        require_phone: draft.require_phone,
        min_advance_hours: Math.max(0, draft.min_advance_hours || 0),
        max_advance_days: Math.max(1, draft.max_advance_days || 30),
      } as any);
      return;
    }
    onUpdateConfig({
      welcome_msg: draft.welcome_msg,
      use_clinic_hours: draft.use_clinic_hours,
      online_window: draft.use_clinic_hours ? null : draft.online_window,
      slot_duration_min: draft.slot_duration_custom,
      require_phone: draft.require_phone,
      min_advance_hours: Math.max(0, draft.min_advance_hours || 0),
      max_advance_days: Math.max(1, draft.max_advance_days || 30),
    } as any);
  }

  function reset() {
    setDraft(config);
    setDirty(false);
  }

  const bounds = clinicBounds(clinicHours);
  const win = draft?.online_window;
  const winFrom = win ? timeToMinutes(win.from) : null;
  const winTo = win ? timeToMinutes(win.to) : null;
  const exceedsClinic =
    !!bounds && winFrom !== null && winTo !== null && (winFrom < bounds.minOpen || winTo > bounds.maxClose);
  const invalidWindow = winFrom !== null && winTo !== null && winTo <= winFrom;

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
                <Pressable onPress={save} style={[s.btn, s.btnPrimary]} disabled={saving || (!isLegacy && invalidWindow)}>
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

          {isLegacy && (
            <View style={s.legacyWarn}>
              <Text style={s.legacyWarnText}>
                A clínica ainda não salvou um horário de funcionamento. Enquanto isso, o Agendamento online usa os
                campos antigos abaixo.{" "}
                {onGotoClinicHours && (
                  <Text onPress={onGotoClinicHours} style={s.legacyWarnLink}>
                    Configurar horário da clínica
                  </Text>
                )}
              </Text>
            </View>
          )}

          {isLegacy ? (
            <>
              <View style={s.formGrid}>
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
                      : `Janela: ${draft.end_hour - draft.start_hour}h`}
                  </Text>
                </View>
              </View>
              <Text style={[s.configLabel, { marginTop: 8 }]}>Dias disponíveis</Text>
              <View style={s.daysRow}>
                {DAYS.map((d, i) => {
                  const active = draft.available_days.includes(i);
                  return (
                    <Pressable key={i} onPress={() => toggleLegacyDay(i)} style={[s.dayChip, active && s.dayChipActive]}>
                      <Text style={[s.dayText, active && s.dayTextActive]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={s.srcRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.srcTitle}>Usar horário da clínica</Text>
                  <Text style={s.srcSub}>
                    {draft.use_clinic_hours
                      ? "Mesmos dias e turnos do horário de funcionamento"
                      : "Desligado: você escolhe uma janela menor (nunca maior que a clínica)"}
                  </Text>
                </View>
                <Switch
                  value={draft.use_clinic_hours}
                  onValueChange={(v) => update("use_clinic_hours", v)}
                  trackColor={{ false: Colors.border || "#333", true: DentalColors.cyan }}
                />
              </View>

              {!draft.use_clinic_hours && (
                <View style={{ marginTop: 12 }}>
                  <Text style={s.configLabel}>Janela online</Text>
                  <View style={s.chipRow}>
                    {(["manha", "tarde", "custom"] as const).map((p) => (
                      <Pressable key={p} onPress={() => applyPreset(p)} style={[s.chip, preset === p && s.chipActive]}>
                        <Text style={[s.chipText, preset === p && s.chipTextActive]}>
                          {p === "manha" ? "Só manhã" : p === "tarde" ? "Só tarde" : "Personalizado"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.rangeRow}>
                    <Text style={s.rangeLabel}>Das</Text>
                    <TextInput
                      value={win?.from || "08:00"}
                      onChangeText={(v) => { setPreset("custom"); updateWindow({ from: v }); }}
                      placeholder="08:00"
                      style={s.rangeInput}
                    />
                    <Text style={s.rangeLabel}>às</Text>
                    <TextInput
                      value={win?.to || "18:00"}
                      onChangeText={(v) => { setPreset("custom"); updateWindow({ to: v }); }}
                      placeholder="18:00"
                      style={s.rangeInput}
                    />
                  </View>
                  {invalidWindow && <Text style={s.warnTextRed}>O fim precisa ser depois do início.</Text>}
                  {!invalidWindow && exceedsClinic && bounds && (
                    <Text style={s.warnText}>
                      A parte fora do horário da clínica ({minutesToTime(bounds.minOpen)}–{minutesToTime(bounds.maxClose)}) não será oferecida.
                    </Text>
                  )}

                  <Text style={[s.configLabel, { marginTop: 10 }]}>
                    Dias online <Text style={s.hintInline}>· só aparecem os dias em que a clínica abre</Text>
                  </Text>
                  <View style={s.daysRow}>
                    {clinicHours.filter((d) => d.open).map((d) => {
                      const active = (win?.days || WEEKDAYS_UTEIS).includes(d.weekday);
                      return (
                        <Pressable key={d.weekday} onPress={() => toggleOnlineDay(d.weekday)} style={[s.dayChip, active && s.dayChipActive]}>
                          <Text style={[s.dayText, active && s.dayTextActive]}>{WEEKDAY_SHORT[d.weekday]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <DayBars
                clinicHours={clinicHours}
                windowFrom={draft.use_clinic_hours ? null : winFrom}
                windowTo={draft.use_clinic_hours ? null : winTo}
                onlineDays={draft.use_clinic_hours ? null : (win?.days || WEEKDAYS_UTEIS)}
              />
              <Text style={s.hintText}>Contorno = clínica aberta · preenchido = oferecido online</Text>
              {onGotoClinicHours && (
                <Pressable onPress={onGotoClinicHours} style={{ marginTop: 8 }}>
                  <Text style={s.linkBtnText}>Editar horário da clínica</Text>
                </Pressable>
              )}

              <View style={[s.formItem, { marginTop: 14 }]}>
                <Text style={s.configLabel}>Duração de cada horário</Text>
                <View style={s.chipRow}>
                  <Pressable
                    onPress={() => update("slot_duration_custom", null)}
                    style={[s.chip, draft.slot_duration_custom === null && s.chipActive]}
                  >
                    <Text style={[s.chipText, draft.slot_duration_custom === null && s.chipTextActive]}>
                      Padrão da clínica{effective ? ` (${effective.slot_duration_min} min)` : ""}
                    </Text>
                  </Pressable>
                  {[30, 45, 60].map((m) => (
                    <Pressable key={m} onPress={() => update("slot_duration_custom", m)} style={[s.chip, draft.slot_duration_custom === m && s.chipActive]}>
                      <Text style={[s.chipText, draft.slot_duration_custom === m && s.chipTextActive]}>{m}min</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

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

          <View style={s.formGrid}>
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
                  {formatDateOnlyBR(req.preferred_date, "—")} às {req.preferred_time}
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
  hintText: { fontSize: 9, color: Colors.ink3 || "#888", marginTop: 6 },
  hintInline: { textTransform: "none", fontWeight: "400" },
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

  srcRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: Colors.border || "#333", borderRadius: 10, padding: 10 },
  srcTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  srcSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  rangeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  rangeLabel: { fontSize: 12, color: Colors.ink2 },
  rangeInput: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: Colors.border || "#333", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: Colors.ink, minWidth: 64 },
  warnText: { fontSize: 11, color: "#d97706", marginTop: 6 },
  warnTextRed: { fontSize: 11, color: Colors.red, marginTop: 6, fontWeight: "600" },

  roLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  roDay: { width: 30, fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  bar: { flex: 1, height: 14, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: Colors.border, position: "relative" },
  barClinic: { position: "absolute", top: 0, bottom: 0, borderWidth: 1, borderColor: "rgba(6,182,212,0.3)", borderRadius: 3 },
  barOnline: { position: "absolute", top: 2, bottom: 2, backgroundColor: "#06B6D4", borderRadius: 2, opacity: 0.85 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, paddingLeft: 38 },
  axisLabel: { fontSize: 9, color: Colors.ink3 },

  legacyWarn: { backgroundColor: "rgba(217,119,6,0.08)", borderWidth: 1, borderColor: "rgba(217,119,6,0.3)", borderRadius: 8, padding: 10, marginBottom: 8 },
  legacyWarnText: { fontSize: 11, color: Colors.ink2, lineHeight: 16 },
  legacyWarnLink: { fontSize: 11, color: "#06B6D4", fontWeight: "700" },
  linkBtnText: { fontSize: 12, color: "#06B6D4", fontWeight: "600" },

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
