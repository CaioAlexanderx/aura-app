// ============================================================
// AlunoTurmaSection — seção "Turma" da ficha do aluno (F9)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// NUNCA modal aninhado; bloco inline dentro do modal existente, mesmo
// racional de AlunoAssinaturaSection/AlunoFederacaoSection, que já
// expandem dentro da ficha).
//
// Antes desta seção, matricular um aluno numa turma só era possível
// indo até Turmas > (turma) > aba Alunos (TurmaDetalhe.tsx). Pedido do
// Caio (03/08/2026): fazer isso "de dentro da ficha do aluno" também —
// esta seção mostra em quais turmas o aluno já está e permite
// matricular/desmatricular sem sair da ficha, usando os MESMOS
// endpoints que TurmaDetalhe já consome (karateDojoClassesApi). Nenhum
// endpoint novo.
//
// Não existe (nem foi criado) um GET "turmas do aluno" — a lista é
// montada combinando GET .../classes (turmas ATIVAS do dojô) + GET
// .../classes/:id/students (o mesmo roster que TurmaDetalhe usa),
// filtrando pelo id deste aluno em cada turma. Dojôs têm poucas turmas
// (tipicamente < 20), então o custo de N chamadas em paralelo é
// aceitável — trocar isso por um endpoint dedicado é trabalho de
// backend fora do escopo desta ficha.
//
// Distinção de propósito (pedido do Caio, F9): "turma é onde ele
// treina; plano é como ele paga" — título e subtítulo deixam isso
// explícito, ao lado da seção Mensalidade (AlunoAssinaturaSection).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateDojoClassesApi, DojoClass } from "@/services/karateDojoClassesApi";
import { DojoStudent } from "@/services/karateDojoStudentsApi";
import { mapClassesError } from "@/components/karate/dojoTurmas/helpers";

interface Props {
  federationId: string;
  student: DojoStudent;
  onChanged?: () => void;
}

interface EnrolledInfo {
  classId: string;
  className: string;
}

export function AlunoTurmaSection({ federationId, student, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [allClasses, setAllClasses] = useState<DojoClass[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledInfo[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [picker, setPicker] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [pickerErr, setPickerErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await karateDojoClassesApi.listClasses(federationId);
      const active = (res.data ?? []).filter((c) => c.active);
      setAllClasses(active);
      // Não existe GET "turmas do aluno" — monta combinando o roster de
      // cada turma ativa (mesmo endpoint que TurmaDetalhe.tsx já usa).
      const rosters = await Promise.all(
        active.map((c) =>
          karateDojoClassesApi.listClassStudents(federationId, c.id).then(
            (r) => ({ classId: c.id, className: c.name, has: (r.data ?? []).some((s) => s.student_id === student.id) }),
            () => ({ classId: c.id, className: c.name, has: false })
          )
        )
      );
      setEnrolled(rosters.filter((r) => r.has).map((r) => ({ classId: r.classId, className: r.className })));
    } catch (e: any) {
      setLoadErr(mapClassesError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId, student.id]);

  useEffect(() => { load(); }, [load]);

  const enrolledIds = new Set(enrolled.map((e) => e.classId));
  const available = allClasses.filter((c) => !enrolledIds.has(c.id));

  const enroll = async (classId: string) => {
    setEnrollingId(classId);
    setPickerErr(null);
    try {
      await karateDojoClassesApi.enrollStudent(federationId, classId, student.id);
      await load();
      onChanged?.();
    } catch (e: any) {
      setPickerErr(mapClassesError(e).message);
    } finally {
      setEnrollingId(null);
    }
  };

  const remove = async (classId: string) => {
    setRemovingId(classId);
    try {
      await karateDojoClassesApi.unenrollStudent(federationId, classId, student.id);
      await load();
      onChanged?.();
      setConfirmRemoveId(null);
    } catch (e: any) {
      setLoadErr(mapClassesError(e).message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Turma</Text>
      <Text style={styles.subtitle}>Onde o aluno treina — não confundir com a Mensalidade (como ele paga), logo abaixo.</Text>

      {loading && (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!loading && !!loadErr && <Text style={styles.hint}>{loadErr}</Text>}

      {!loading && !loadErr && (
        <View style={{ gap: 8 }}>
          {enrolled.length === 0 ? (
            <Text style={styles.hint}>Este aluno ainda não está matriculado em nenhuma turma.</Text>
          ) : (
            enrolled.map((e) => (
              <View key={e.classId} style={styles.classRow}>
                <Text style={styles.className} numberOfLines={1}>{e.className}</Text>
                {confirmRemoveId === e.classId ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setConfirmRemoveId(null)} />
                    <KarateButton
                      label="Remover"
                      variant="primary"
                      size="sm"
                      loading={removingId === e.classId}
                      onPress={() => remove(e.classId)}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.rmBtn}
                    onPress={() => setConfirmRemoveId(e.classId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover da turma ${e.className}`}
                  >
                    <Icon name="x" size={14} color={KarateColors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {!picker ? (
            available.length > 0 && (
              <KarateButton
                label="Matricular em turma"
                variant="sumi"
                size="sm"
                onPress={() => setPicker(true)}
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              />
            )
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Escolha a turma</Text>
              <View style={styles.chips}>
                {available.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.chip}
                    onPress={() => enroll(c.id)}
                    disabled={enrollingId === c.id}
                    accessibilityRole="button"
                  >
                    {enrollingId === c.id ? (
                      <ActivityIndicator size="small" color={KarateColors.primary} />
                    ) : (
                      <Text style={styles.chipTxt}>{c.name}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {!!pickerErr && <Text style={styles.err}>{pickerErr}</Text>}
              <KarateButton
                label="Fechar"
                variant="ghost"
                size="sm"
                onPress={() => { setPicker(false); setPickerErr(null); }}
                style={{ alignSelf: "flex-start" }}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  subtitle: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16 } as TextStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  classRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 8 } as ViewStyle,
  className: { flex: 1, fontSize: 12.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  rmBtn: { width: 26, height: 26, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.dangerSoft } as ViewStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
});
