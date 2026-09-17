import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, useWindowDimensions } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { DentalColors } from "@/constants/dental-tokens";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { dentalConfigApi, type DentalHoursValidationError } from "@/services/dentalConfigApi";
import {
  type ClinicHours,
  type ClinicDayHours,
  WEEKDAY_LABELS,
  WEEKDAYS_UTEIS,
  INTERVAL_OPTIONS,
  timeToMinutes,
  minutesToTime,
  normalizeClinicHours,
  validateClinicHours,
  hasClinicHoursErrors,
  copyDayToWeekdays,
  formatWeeklyHours,
} from "@/utils/clinicHours";

// ============================================================
// AURA. — ClinicHoursCard (Odonto)
//
// Card "Horário de funcionamento" na tela Clínica, entre
// "Cadeiras" e "Dentistas". Fonte de verdade: mockup aprovado
// (partes 1, 3 e 4). Alimenta a Agenda, o Agendamento online e
// "Agendar próxima consulta" através de GET/PUT
// /companies/:cid/dental/hours.
//
// Regras seguidas do CLAUDE.md:
// - #2 multi-CNPJ: horário é por empresa (query key inclui cid);
//   a troca de empresa é sempre global (useAuthStore.switchCompany,
//   ver CompanySwitcher) — não existe hoje uma lista "por card" de
//   empresas, então não foi criado um seletor de unidade aqui
//   (reportado na entrega, item de "o que ficou de fora").
// - #7 hover-reveal: "copiar p/ dias úteis" some por padrão só em
//   telas com mouse (matchMedia hover:hover); em touch fica sempre
//   visível.
// ============================================================

type ServerFieldError = DentalHoursValidationError;

function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      try {
        setHoverCapable(window.matchMedia("(hover: hover)").matches);
      } catch {
        setHoverCapable(false);
      }
    }
  }, []);
  return hoverCapable;
}

// Seletor de hora: <input type="time"> no web (abre a roda nativa do SO),
// steppers de 15 em 15 min no nativo (sem depender de lib de picker nova).
function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  if (Platform.OS === "web") {
    return React.createElement("input", {
      type: "time",
      step: 900,
      value,
      "aria-label": label,
      onChange: (e: any) => onChange(e.target.value || "00:00"),
      style: {
        background: "transparent",
        border: 0,
        outline: "none",
        font: "inherit",
        fontVariantNumeric: "tabular-nums",
        color: Colors.ink,
        width: 76,
        padding: "4px 0",
      },
    });
  }
  function step(delta: number) {
    onChange(minutesToTime(timeToMinutes(value) + delta));
  }
  return (
    <View style={s.timeNative}>
      <Pressable onPress={() => step(-15)} hitSlop={10} style={s.timeNativeBtn} accessibilityLabel={`${label} − 15 min`}>
        <Text style={s.timeNativeBtnText}>−</Text>
      </Pressable>
      <Text style={s.timeNativeValue}>{value}</Text>
      <Pressable onPress={() => step(15)} hitSlop={10} style={s.timeNativeBtn} accessibilityLabel={`${label} + 15 min`}>
        <Text style={s.timeNativeBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function CopyButton({ onPress, label }: { onPress: () => void; label: string }) {
  const hoverCapable = useHoverCapable();
  const [hovered, setHovered] = useState(false);
  const visible = !hoverCapable || hovered;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[s.iconBtn, { opacity: visible ? 1 : 0 }]}
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Icon name="copy" size={14} color={Colors.ink3} />
    </Pressable>
  );
}

export function ClinicHoursCard() {
  const company = useAuthStore((st) => st.company);
  const companyCount = useAuthStore((st) => st.companyCount);
  const cid = company?.id;
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const compact = width < 560;

  const { data, isLoading } = useQuery({
    queryKey: ["dental-hours", cid],
    queryFn: () => dentalConfigApi.getHours(cid as string),
    enabled: !!cid,
    staleTime: 30000,
  });

  const configured = !!data?.configured;

  const [draft, setDraft] = useState<ClinicHours | null>(null);
  const [interval, setInterval] = useState<15 | 20 | 30 | 45 | 60 | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastCopy, setLastCopy] = useState<{ from: number; before: ClinicHours } | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerFieldError[]>([]);

  useEffect(() => {
    if (!data) return;
    const base = configured ? data.hours : data.suggestion.hours;
    setDraft(normalizeClinicHours(base));
    setInterval(configured ? data.default_interval_min : data.suggestion.default_interval_min);
    setDirty(false);
    setLastCopy(null);
    setServerErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, configured]);

  const saveMut = useMutation({
    mutationFn: (body: { hours: ClinicHours; default_interval_min: typeof interval }) =>
      dentalConfigApi.saveHours(cid as string, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-hours", cid] });
      qc.invalidateQueries({ queryKey: ["dental-booking-config", cid] });
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      toast.success("Horário salvo");
    },
    onError: (err: any) => {
      const errs: ServerFieldError[] | undefined = err?.data?.errors;
      if (Array.isArray(errs) && errs.length) setServerErrors(errs);
      if (err?.data?.code === "INVALID_BUSINESS_HOURS") {
        toast.error(err?.data?.error || "Corrija os horários destacados");
      } else {
        toast.error(err?.data?.error || err?.message || "Não foi possível salvar o horário");
      }
    },
  });

  if (isLoading || !draft) {
    return (
      <View style={[s.card, { alignItems: "center", paddingVertical: 32 }]}>
        <ActivityIndicator color={Colors.violet3} />
      </View>
    );
  }

  const localErrors = validateClinicHours(draft);
  const hasErrors = hasClinicHoursErrors(draft);
  const errorsByDay = new Map<number, string[]>();
  for (const e of localErrors) {
    if (!errorsByDay.has(e.weekday)) errorsByDay.set(e.weekday, []);
    errorsByDay.get(e.weekday)!.push(e.message);
  }
  for (const e of serverErrors) {
    if (!errorsByDay.has(e.weekday)) errorsByDay.set(e.weekday, []);
    if (!errorsByDay.get(e.weekday)!.includes(e.message)) errorsByDay.get(e.weekday)!.push(e.message);
  }

  function mutateDraft(next: ClinicHours) {
    setDraft(next);
    setDirty(true);
    setServerErrors([]);
  }
  function updateDay(weekday: number, patch: Partial<ClinicDayHours>) {
    mutateDraft(draft!.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }
  function toggleOpen(weekday: number) {
    const day = draft!.find((d) => d.weekday === weekday)!;
    updateDay(weekday, { open: !day.open });
  }
  function updateShift(weekday: number, idx: number, field: "start" | "end", value: string) {
    const day = draft!.find((d) => d.weekday === weekday)!;
    updateDay(weekday, { shifts: day.shifts.map((sh, i) => (i === idx ? { ...sh, [field]: value } : sh)) });
  }
  function addShift(weekday: number) {
    const day = draft!.find((d) => d.weekday === weekday)!;
    if (day.shifts.length >= 3) return;
    const last = day.shifts[day.shifts.length - 1];
    const lastEnd = last ? timeToMinutes(last.end) : 8 * 60;
    const start = minutesToTime(Math.min(lastEnd + 60, 22 * 60));
    const end = minutesToTime(Math.min(timeToMinutes(start) + 180, 23 * 60));
    updateDay(weekday, { shifts: [...day.shifts, { start, end }] });
  }
  function removeShift(weekday: number, idx: number) {
    const day = draft!.find((d) => d.weekday === weekday)!;
    updateDay(weekday, { shifts: day.shifts.filter((_, i) => i !== idx) });
  }
  function copyToWeekdays(fromWeekday: number) {
    setLastCopy({ from: fromWeekday, before: draft! });
    mutateDraft(copyDayToWeekdays(draft!, fromWeekday));
  }
  function undoCopy() {
    if (!lastCopy) return;
    setDraft(lastCopy.before);
    setLastCopy(null);
  }
  function handleSave() {
    if (hasErrors || !cid) return;
    saveMut.mutate({ hours: draft!, default_interval_min: interval });
  }
  function resetToBase() {
    if (!data) return;
    const base = configured ? data.hours : data.suggestion.hours;
    setDraft(normalizeClinicHours(base));
    setInterval(configured ? data.default_interval_min : data.suggestion.default_interval_min);
    setDirty(false);
    setLastCopy(null);
    setServerErrors([]);
  }

  const saveDisabled = hasErrors || saveMut.isPending || (configured && !dirty);

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={s.cardTitle}>Horário de funcionamento</Text>
            {!configured && (
              <View style={s.pillNew}>
                <Text style={s.pillNewText}>Novo</Text>
              </View>
            )}
          </View>
          <Text style={s.cardSub}>
            Define as horas de atendimento na Agenda, no Agendamento online e nas sugestões de retorno.
          </Text>
          {companyCount > 1 && (
            <Text style={s.multiHint}>
              Horário da unidade ativa ({company?.name || "empresa atual"}). Para editar outra unidade, troque de
              empresa no menu.
            </Text>
          )}
        </View>
      </View>

      {!configured && (
        <View style={s.firstBox}>
          <View style={s.pillSug}>
            <Text style={s.pillSugText}>Sugestão</Text>
          </View>
          <Text style={s.firstBoxText}>
            Preenchemos segunda a sexta, das 08:00 às 18:00. Ajuste o que for diferente e salve. Até lá, a Agenda
            continua mostrando das 07h às 19h.
          </Text>
        </View>
      )}

      <View style={s.days}>
        {draft.map((day) => {
          const errs = day.open ? errorsByDay.get(day.weekday) || [] : [];
          const canCopy = day.open && WEEKDAYS_UTEIS.includes(day.weekday);
          return (
            <View key={day.weekday} style={[s.dayRow, !day.open && s.dayRowClosed, compact && s.dayRowCompact]}>
              <View style={compact ? s.dayHeadCompact : undefined}>
                <Pressable
                  onPress={() => toggleOpen(day.weekday)}
                  style={[s.switch, day.open && s.switchOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: day.open }}
                  accessibilityLabel={`${WEEKDAY_LABELS[day.weekday]} aberto`}
                  hitSlop={6}
                >
                  <View style={[s.switchThumb, day.open && s.switchThumbOn]} />
                </Pressable>
                <Text style={[s.dayName, !day.open && s.dayNameClosed]}>
                  {WEEKDAY_LABELS[day.weekday]}
                  {compact && !day.open ? <Text style={s.closedInline}> · Fechado</Text> : null}
                </Text>
                {!compact && (
                  <View style={s.dayActions}>
                    {canCopy && (
                      <CopyButton
                        onPress={() => copyToWeekdays(day.weekday)}
                        label={`Copiar ${WEEKDAY_LABELS[day.weekday]} para os dias úteis`}
                      />
                    )}
                  </View>
                )}
              </View>

              <View style={[s.shifts, compact && s.shiftsCompact]}>
                {!day.open ? (
                  !compact && <Text style={s.closedText}>Fechado</Text>
                ) : (
                  <>
                    {day.shifts.map((shift, idx) => {
                      const shiftHasErr = errs.length > 0 && localErrors.some((e) => e.weekday === day.weekday && e.shift === idx);
                      return (
                        <View key={idx} style={[s.shift, shiftHasErr && s.shiftErr, compact && s.shiftCompact]}>
                          <TimeField
                            value={shift.start}
                            onChange={(v) => updateShift(day.weekday, idx, "start", v)}
                            label={`Início do turno ${idx + 1} de ${WEEKDAY_LABELS[day.weekday]}`}
                          />
                          <Text style={s.shiftSep}>às</Text>
                          <TimeField
                            value={shift.end}
                            onChange={(v) => updateShift(day.weekday, idx, "end", v)}
                            label={`Fim do turno ${idx + 1} de ${WEEKDAY_LABELS[day.weekday]}`}
                          />
                          {day.shifts.length > 1 && (
                            <Pressable
                              onPress={() => removeShift(day.weekday, idx)}
                              style={s.iconBtn}
                              accessibilityLabel={`Remover turno ${idx + 1} de ${WEEKDAY_LABELS[day.weekday]}`}
                              hitSlop={8}
                            >
                              <Icon name="x" size={13} color={Colors.ink3} />
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                    {day.shifts.length < 3 && (
                      <Pressable onPress={() => addShift(day.weekday)} style={s.addShift} hitSlop={6}>
                        <Text style={s.addShiftText}>+ turno</Text>
                      </Pressable>
                    )}
                    {compact && canCopy && (
                      <CopyButton
                        onPress={() => copyToWeekdays(day.weekday)}
                        label={`Copiar ${WEEKDAY_LABELS[day.weekday]} para os dias úteis`}
                      />
                    )}
                  </>
                )}
              </View>
              {errs.length > 0 && (
                <View style={s.errBox}>
                  {errs.map((msg, i) => (
                    <Text key={i} style={s.errText}>
                      {msg}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {lastCopy && (
        <View style={s.inlineNote}>
          <Text style={s.inlineNoteText}>
            Horário de {WEEKDAY_LABELS[lastCopy.from].toLowerCase()} copiado para os outros dias úteis.
          </Text>
          <Pressable onPress={undoCopy} hitSlop={6}>
            <Text style={s.undoText}>Desfazer</Text>
          </Pressable>
        </View>
      )}

      <View style={s.field}>
        <Text style={s.fieldLabel}>
          Intervalo padrão entre consultas <Text style={s.fieldLabelHint}>· opcional</Text>
        </Text>
        <View style={s.chips}>
          {INTERVAL_OPTIONS.map((v) => {
            const active = interval === v;
            return (
              <Pressable
                key={v === null ? "none" : v}
                onPress={() => {
                  setInterval(v);
                  setDirty(true);
                }}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{v === null ? "Sem padrão" : `${v} min`}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>
          Usado como duração sugerida ao agendar e como tamanho dos horários do Agendamento online.
        </Text>
      </View>

      <View style={[s.cardFooter, compact && s.cardFooterCompact]}>
        <Text style={s.summary}>
          Aberto <Text style={s.summaryBold}>{formatWeeklyHours(draft)}</Text> por semana
          {hasErrors ? <Text style={s.summaryErr}> · corrija os horários em vermelho</Text> : null}
        </Text>
        <View style={[s.actions, compact && s.actionsCompact]}>
          <Pressable
            onPress={resetToBase}
            disabled={configured ? !dirty : false}
            style={[s.btnSecondary, configured && !dirty && s.btnDisabled, compact && s.btnCompact]}
          >
            <Text style={s.btnSecondaryText}>{configured ? "Descartar" : "Agora não"}</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saveDisabled}
            style={[s.btnPrimary, saveDisabled && s.btnDisabled, compact && s.btnCompact]}
          >
            {saveMut.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.btnPrimaryText}>{configured ? "Salvar alterações" : "Salvar horário"}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  cardSub: { fontSize: 11, color: Colors.ink3, marginTop: 3, lineHeight: 15 },
  multiHint: { fontSize: 10, color: Colors.ink3, marginTop: 6, fontStyle: "italic" },

  pillNew: { backgroundColor: DentalColors.cyanDim, borderWidth: 1, borderColor: DentalColors.cyanBorder, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  pillNewText: { fontSize: 10, fontWeight: "700", color: DentalColors.cyan },
  pillSug: { backgroundColor: "rgba(217,119,6,0.12)", borderWidth: 1, borderColor: "rgba(217,119,6,0.35)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  pillSugText: { fontSize: 10, fontWeight: "700", color: "#d97706" },

  firstBox: { flexDirection: "row", gap: 10, backgroundColor: "rgba(217,119,6,0.08)", borderWidth: 1, borderColor: "rgba(217,119,6,0.25)", borderRadius: 10, padding: 12, marginBottom: 12 },
  firstBoxText: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },

  days: { gap: 6 },
  dayRow: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  dayRowClosed: { backgroundColor: "transparent" },
  dayRowCompact: { flexDirection: "column", alignItems: "stretch" },
  dayHeadCompact: { flexDirection: "row", alignItems: "center", gap: 10 },

  switch: { width: 34, height: 20, borderRadius: 20, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", padding: 2 },
  switchOn: { backgroundColor: DentalColors.cyan, borderColor: DentalColors.cyan },
  switchThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.ink3 },
  switchThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },

  dayName: { fontSize: 13, fontWeight: "600", color: Colors.ink, minWidth: 64 },
  dayNameClosed: { color: Colors.ink3 },
  closedInline: { fontSize: 11, color: Colors.ink3, fontWeight: "400" },

  dayActions: { marginLeft: "auto" },

  shifts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, flex: 1 },
  shiftsCompact: { marginTop: 8 },
  shift: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  shiftCompact: { flex: 1, minWidth: "100%", justifyContent: "space-between", paddingHorizontal: 10 },
  shiftErr: { borderColor: Colors.red, backgroundColor: "rgba(220,38,38,0.06)" },
  shiftSep: { fontSize: 12, color: Colors.ink3 },

  closedText: { fontSize: 12, color: Colors.ink3 },

  addShift: { paddingHorizontal: 4, paddingVertical: 6 },
  addShiftText: { fontSize: 12, fontWeight: "600", color: DentalColors.cyan },

  errBox: { width: "100%" },
  errText: { fontSize: 11, color: Colors.red, marginTop: 2 },

  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },

  inlineNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: DentalColors.cyanDim, borderWidth: 1, borderColor: DentalColors.cyanBorder, borderRadius: 8, padding: 10, marginTop: 10 },
  inlineNoteText: { flex: 1, fontSize: 12, color: Colors.ink2 },
  undoText: { fontSize: 12, fontWeight: "700", color: DentalColors.cyan },

  field: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 6 },
  fieldLabelHint: { fontWeight: "400", color: Colors.ink3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  chipActive: { backgroundColor: DentalColors.cyanDim, borderColor: DentalColors.cyan },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  chipTextActive: { color: Colors.ink },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 6 },

  cardFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  cardFooterCompact: { flexDirection: "column", alignItems: "stretch" },
  summary: { fontSize: 12, color: Colors.ink3 },
  summaryBold: { color: Colors.ink, fontWeight: "700" },
  summaryErr: { color: Colors.red },
  actions: { flexDirection: "row", gap: 8, marginLeft: "auto" },
  actionsCompact: { marginLeft: 0 },
  btnCompact: { flex: 1, minHeight: 44 },

  btnSecondary: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  btnSecondaryText: { fontSize: 12, fontWeight: "600", color: Colors.ink },
  btnPrimary: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center", minWidth: 100 },
  btnPrimaryText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.45 },

  timeNative: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeNativeBtn: { width: 22, height: 22, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  timeNativeBtnText: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  timeNativeValue: { fontSize: 13, color: Colors.ink, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "center" },
});

export default ClinicHoursCard;
