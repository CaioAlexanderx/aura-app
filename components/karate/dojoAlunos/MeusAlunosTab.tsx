// ============================================================
// MeusAlunosTab — aba "Meus alunos" da tela Alunos (F2)
//
// Dono do estado: carrega a lista (com summary) UMA vez e filtra
// client-side no AlunosList (≤1000 alunos — sem paginação na F2);
// orquestra os 3 modais (form, ficha, importação), todos irmãos —
// nunca modal dentro de modal (RN-web).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, StyleSheet, ViewStyle } from "react-native";
import { KarateColors } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentsSummary,
} from "@/services/karateDojoStudentsApi";
import { AlunosList } from "./AlunosList";
import { AlunoFormModal } from "./AlunoFormModal";
import { AlunoFichaModal } from "./AlunoFichaModal";
import { ImportAlunosModal } from "./ImportAlunosModal";

export function MeusAlunosTab() {
  const { federationId } = useKarateFederation();
  const [students, setStudents] = useState<DojoStudent[]>([]);
  const [summary, setSummary] = useState<DojoStudentsSummary | null>(null);
  const [schemaPending, setSchemaPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formStudent, setFormStudent] = useState<DojoStudent | null>(null);
  const [fichaStudent, setFichaStudent] = useState<DojoStudent | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateDojoStudentsApi.listStudents(federationId, { summary: true });
      setStudents(res.data ?? []);
      setSummary(res.summary ?? null);
      setSchemaPending(res.schema_pending === true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!federationId) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {students.length > 0 && !loading && (
        <View style={styles.actionsRow}>
          <KarateButton label="Importar planilha" variant="secondary" size="sm" onPress={() => setImportOpen(true)} />
          <KarateButton
            label="Novo aluno"
            variant="sumi"
            size="sm"
            onPress={() => {
              setFormStudent(null);
              setFormOpen(true);
            }}
          />
        </View>
      )}

      <AlunosList
        students={students}
        summary={summary}
        loading={loading}
        error={error}
        schemaPending={schemaPending}
        onRetry={load}
        onOpenStudent={(s) => setFichaStudent(s)}
        onNew={() => {
          setFormStudent(null);
          setFormOpen(true);
        }}
        onImport={() => setImportOpen(true)}
      />

      <AlunoFormModal
        visible={formOpen}
        federationId={federationId}
        student={formStudent}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setFormStudent(null);
          setFichaStudent(null);
          load();
        }}
      />
      <AlunoFichaModal
        visible={!!fichaStudent}
        federationId={federationId}
        student={fichaStudent}
        onClose={() => setFichaStudent(null)}
        onEdit={(s) => {
          setFichaStudent(null);
          setFormStudent(s);
          setFormOpen(true);
        }}
        onChanged={load}
      />
      <ImportAlunosModal
        visible={importOpen}
        federationId={federationId}
        onClose={() => setImportOpen(false)}
        onDone={load}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 } as ViewStyle,
});
