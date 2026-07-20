// ============================================================
// TurmaDetalhe — matrícula + chamada da turma (F4)
//
// Modal grande com duas abas:
//   • Alunos   — matriculados na turma + remover + "Matricular aluno"
//     (picker buscável dos alunos ATIVOS do dojô, filtrando quem já
//     está matriculado; erros 409/422 amigáveis).
//   • Chamada  — data (default hoje, navegação tz-safe), aviso suave se
//     o weekday da data não bate com os dias da turma, lista com toggle
//     3-estados (não marcado/presente/ausente), contador, atalhos
//     "todos presentes"/"limpar" e Salvar (PUT em lote).
//
// Todos os pickers/painéis são INLINE (nunca modal aninhado — RN-web).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { toast } from "@/components/Toast";
import {
  karateDojoClassesApi, DojoClass, DojoClassStudent, DojoAttendanceRow,
} from "@/services/karateDojoClassesApi";
import { karateDojoStudentsApi, DojoStudent } from "@/services/karateDojoStudentsApi";
import { beltViewFor } from "@/components/karate/dojoAlunos/helpers";
import {
  fmtDateLongBR, mapClassesError, shiftISODate, todayISO, weekdayOfISO,
} from "./helpers";

type TabKey = "alunos" | "chamada";

interface Props {
  visible: boolean;
  federationId: string;
  turma: DojoClass | null;
  onClose: () => void;
  onChanged: () => void;
}

export function TurmaDetalhe({ visible, federationId, turma, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<TabKey>("alunos");

  useEffect(() => {
    if (visible) setTab("alunos");
  }, [visible, turma?.id]);

  if (!turma) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.headTitle} numberOfLines={1}>{turma.name}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.closeBtn}>
              <Icon name="close" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {([["alunos", "Alunos"], ["chamada", "Chamada"]] as [TabKey, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.tab, tab === key && styles.tabOn]}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
              >
                <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexShrink: 1 }}>
            {tab === "alunos" ? (
              <AlunosTab federationId={federationId} turma={turma} onChanged={onChanged} />
            ) : (
              <ChamadaTab federationId={federationId} turma={turma} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AlunosTab({ federationId, turma, onChanged }: { federationId: string; turma: DojoClass; onChanged: () => void }) {
  const [students, setStudents] = useState<DojoClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<DojoStudent[] | null>(null);
  const [candidatesFailed, setCandidatesFailed] = useState(false);
  const [q, setQ] = useState("");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [pickerErr, setPickerErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await karateDojoClassesApi.listClassStudents(federationId, turma.id);
      setStudents(res.data ?? []);
    } catch (e: any) {
      setError(mapClassesError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId, turma.id]);

  useEffect(() => { load(); }, [load]);

  const loadCandidates = useCallback(async () => {
    try {
      const res = await karateDojoStudentsApi.listStudents(federationId, { status: "active" });
      setCandidates(res.data ?? []);
      setCandidatesFailed(false);
    } catch {
      setCandidatesFailed(true);
    }
  }, [federationId]);

  useEffect(() => {
    if (pickerOpen && candidates === null) loadCandidates();
  }, [pickerOpen, candidates, loadCandidates]);

  const enrolledIds = useMemo(() => new Set(students.map((s) => s.student_id)), [students]);

  const pickList = (candidates ?? []).filter((s) => {
    if (enrolledIds.has(s.id)) return false;
    if (q.trim() && !s.full_name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  const enroll = async (studentId: string) => {
    setEnrollingId(studentId);
    setPickerErr(null);
    try {
      await karateDojoClassesApi.enrollStudent(federationId, turma.id, studentId);
      await load();
      onChanged();
      setQ("");
    } catch (e: any) {
      setPickerErr(mapClassesError(e).message);
    } finally {
      setEnrollingId(null);
    }
  };

  const remove = async (studentId: string) => {
    setRemovingId(studentId);
    try {
      await karateDojoClassesApi.unenrollStudent(federationId, turma.id, studentId);
      await load();
      onChanged();
      setConfirmRemoveId(null);
    } catch (e: any) {
      toast.error(mapClassesError(e).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
      {loading && (
        <View style={styles.stateBox}><ActivityIndicator size="large" color={KarateColors.primary} /></View>
      )}

      {!loading && !!error && (
        <View style={styles.stateBox}>
          <Icon name="alert" size={24} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <>
          {students.length === 0 ? (
            <View style={styles.stateBox}>
              <Icon name="users" size={24} color={KarateColors.ink3} />
              <Text style={styles.stateTxt}>Nenhum aluno matriculado nesta turma ainda.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {students.map((s) => {
                const belt = beltViewFor(s.belt_label);
                return (
                  <View key={s.student_id} style={styles.studentRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.studentName} numberOfLines={1}>{s.full_name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <View style={[styles.beltChip, { backgroundColor: belt.color }]}>
                          <Text style={[styles.beltChipTxt, { color: belt.textColor }]}>{belt.label}</Text>
                        </View>
                        {s.status === "inactive" && <Text style={styles.inactiveHint}>inativo no dojô</Text>}
                      </View>
                    </View>
                    {confirmRemoveId === s.student_id ? (
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setConfirmRemoveId(null)} />
                        <KarateButton
                          label="Remover"
                          variant="primary"
                          size="sm"
                          loading={removingId === s.student_id}
                          onPress={() => remove(s.student_id)}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.rmBtn}
                        onPress={() => setConfirmRemoveId(s.student_id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${s.full_name} da turma`}
                      >
                        <Icon name="x" size={14} color={KarateColors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {!pickerOpen ? (
            <TouchableOpacity style={styles.pickBtn} onPress={() => setPickerOpen(true)} accessibilityRole="button">
              <Icon name="user-plus" size={15} color={KarateColors.primary} />
              <Text style={styles.pickBtnTxt}>Matricular aluno</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.panel}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.panelTitle}>Matricular aluno</Text>
                <TouchableOpacity onPress={() => { setPickerOpen(false); setQ(""); setPickerErr(null); }} accessibilityRole="button" accessibilityLabel="Fechar">
                  <Icon name="x" size={14} color={KarateColors.ink3} />
                </TouchableOpacity>
              </View>

              {candidatesFailed ? (
                <TouchableOpacity onPress={loadCandidates} accessibilityRole="button">
                  <Text style={styles.err}>Não foi possível carregar os alunos. Tocar para tentar de novo.</Text>
                </TouchableOpacity>
              ) : candidates === null ? (
                <ActivityIndicator size="small" color={KarateColors.primary} />
              ) : (
                <>
                  <View style={styles.search}>
                    <Icon name="search" size={14} color={KarateColors.ink3} />
                    <TextInput
                      style={styles.searchInput}
                      value={q}
                      onChangeText={setQ}
                      placeholder="Buscar aluno ativo"
                      placeholderTextColor={KarateColors.ink4}
                    />
                  </View>
                  {!!pickerErr && <Text style={styles.err}>{pickerErr}</Text>}
                  <ScrollView style={{ maxHeight: 220 }}>
                    {pickList.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.candRow}
                        onPress={() => enroll(s.id)}
                        disabled={enrollingId === s.id}
                        accessibilityRole="button"
                      >
                        <Text style={styles.candName} numberOfLines={1}>{s.full_name}</Text>
                        {enrollingId === s.id ? (
                          <ActivityIndicator size="small" color={KarateColors.primary} />
                        ) : (
                          <Icon name="plus" size={14} color={KarateColors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                    {pickList.length === 0 && (
                      <Text style={styles.err}>
                        {(candidates ?? []).length === 0 ? "Nenhum aluno ativo cadastrado no dojô." : "Nenhum aluno disponível com esse nome."}
                      </Text>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ChamadaTab({ federationId, turma }: { federationId: string; turma: DojoClass }) {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DojoAttendanceRow[]>([]);
  const [local, setLocal] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveOk(false);
    try {
      const res = await karateDojoClassesApi.getAttendance(federationId, turma.id, date);
      setRows(res.data ?? []);
      const map: Record<string, boolean | null> = {};
      for (const r of res.data ?? []) map[r.student_id] = r.present;
      setLocal(map);
    } catch (e: any) {
      setError(mapClassesError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId, turma.id, date]);

  useEffect(() => { load(); }, [load]);

  const weekdayMismatch = !(turma.weekdays || []).includes(weekdayOfISO(date));
  const presentCount = Object.values(local).filter((v) => v === true).length;

  const cycle = (studentId: string) => {
    setSaveOk(false);
    setLocal((prev) => {
      const cur = prev[studentId] ?? null;
      const next = cur === null ? true : cur === true ? false : null;
      return { ...prev, [studentId]: next };
    });
  };

  const markAll = (value: boolean | null) => {
    setSaveOk(false);
    const map: Record<string, boolean | null> = {};
    for (const r of rows) map[r.student_id] = value;
    setLocal(map);
  };

  const save = async () => {
    const records = Object.entries(local)
      .filter(([, v]) => v !== null)
      .map(([student_id, present]) => ({ student_id, present: present as boolean }));
    if (records.length === 0) return;
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      await karateDojoClassesApi.saveAttendance(federationId, turma.id, date, records);
      setSaveOk(true);
    } catch (e: any) {
      setSaveErr(mapClassesError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setDate((d) => shiftISODate(d, -1))} accessibilityRole="button" accessibilityLabel="Dia anterior">
          <Icon name="chevron-left" size={16} color={KarateColors.ink2} />
        </TouchableOpacity>
        <View style={styles.dateBox}>
          <Icon name="calendar" size={14} color={KarateColors.ink3} />
          <Text style={styles.dateTxt}>{fmtDateLongBR(date)}</Text>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={() => setDate((d) => shiftISODate(d, 1))} accessibilityRole="button" accessibilityLabel="Dia seguinte">
          <Icon name="chevron-right" size={16} color={KarateColors.ink2} />
        </TouchableOpacity>
        {date !== todayISO() && (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setDate(todayISO())} accessibilityRole="button">
            <Text style={styles.todayTxt}>Hoje</Text>
          </TouchableOpacity>
        )}
      </View>

      {weekdayMismatch && (
        <View style={styles.warnBanner}>
          <Icon name="alert" size={14} color={KarateColors.warn} />
          <Text style={styles.warnTxt}>Essa data não é um dos dias normais desta turma — a chamada pode ser feita mesmo assim.</Text>
        </View>
      )}

      {loading && (
        <View style={styles.stateBox}><ActivityIndicator size="large" color={KarateColors.primary} /></View>
      )}

      {!loading && !!error && (
        <View style={styles.stateBox}>
          <Icon name="alert" size={24} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && rows.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="users" size={24} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum aluno matriculado nesta turma.</Text>
        </View>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <View style={styles.attHeadRow}>
            <Text style={styles.attCounter}>{presentCount} de {rows.length} presentes</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => markAll(true)} accessibilityRole="button">
                <Text style={styles.quickTxt}>Todos presentes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => markAll(null)} accessibilityRole="button">
                <Text style={styles.quickTxt}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {rows.map((r) => {
              const belt = beltViewFor(r.belt_label);
              const value = local[r.student_id] ?? null;
              const label = value === true ? "Presente" : value === false ? "Ausente" : "Não marcado";
              const bg = value === true ? KarateColors.okSoft : value === false ? KarateColors.dangerSoft : KarateColors.bg2;
              const border = value === true ? KarateColors.okLine : value === false ? KarateColors.primaryLine : KarateColors.border2;
              const txtColor = value === true ? KarateColors.ok : value === false ? KarateColors.danger : KarateColors.ink3;
              return (
                <View key={r.student_id} style={styles.attRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.studentName} numberOfLines={1}>{r.full_name}</Text>
                    <View style={[styles.beltChip, { backgroundColor: belt.color, marginTop: 3, alignSelf: "flex-start" }]}>
                      <Text style={[styles.beltChipTxt, { color: belt.textColor }]}>{belt.label}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: bg, borderColor: border }]}
                    onPress={() => cycle(r.student_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.full_name}: ${label}. Toque para alternar.`}
                  >
                    {value === true && <Icon name="check_circle" size={16} color={KarateColors.ok} />}
                    {value === false && <Icon name="x" size={16} color={KarateColors.danger} />}
                    {value === null && <View style={styles.toggleDot} />}
                    <Text style={[styles.toggleTxt, { color: txtColor }]}>{label}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {!!saveErr && <Text style={styles.err}>{saveErr}</Text>}
          {saveOk && !saveErr && <Text style={styles.savedTxt}>Chamada salva.</Text>}

          <KarateButton
            label={saving ? "Salvando…" : "Salvar chamada"}
            variant="sumi"
            size="md"
            loading={saving}
            onPress={save}
            style={{ marginTop: 6 }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 640, maxHeight: "92%", backgroundColor: "#fdf8f2", borderRadius: 16, overflow: "hidden" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderTopLeftRadius: KarateRadius.sm, borderTopRightRadius: KarateRadius.sm, borderBottomWidth: 2, borderBottomColor: "transparent" } as ViewStyle,
  tabOn: { borderBottomColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  tabTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  tabTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  body: { padding: 16, gap: 12 } as ViewStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  studentName: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  beltChip: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  beltChipTxt: { fontSize: 10, fontWeight: "800" } as TextStyle,
  inactiveHint: { fontSize: 10.5, color: KarateColors.ink3, fontStyle: "italic" } as TextStyle,
  rmBtn: { width: 30, height: 30, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.dangerSoft } as ViewStyle,

  pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.sm, paddingVertical: 11 } as ViewStyle,
  pickBtnTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  panel: { gap: 8, backgroundColor: KarateColors.glass2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  panelTitle: { fontSize: 12.5, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  search: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 10 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13, color: KarateColors.ink, paddingVertical: 8 } as TextStyle,
  candRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  candName: { flex: 1, fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  savedTxt: { fontSize: 12, color: KarateColors.ok, fontWeight: "700" } as TextStyle,

  dateNav: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  navBtn: { width: 32, height: 32, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  dateBox: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, flex: 1, justifyContent: "center" } as ViewStyle,
  dateTxt: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  todayBtn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  todayTxt: { fontSize: 11.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  warnBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.warn, padding: 10 } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12, color: KarateColors.warn, lineHeight: 16, fontWeight: "600" } as TextStyle,

  attHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } as ViewStyle,
  attCounter: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  quickBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  quickTxt: { fontSize: 11.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,

  attRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, minWidth: 118, justifyContent: "center" } as ViewStyle,
  toggleTxt: { fontSize: 12, fontWeight: "700" } as TextStyle,
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: KarateColors.ink4 } as ViewStyle,
});
