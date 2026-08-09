// ============================================================
// MeusAlunosTab — aba "Meus alunos" da tela Alunos (F2)
//
// Dono do estado: carrega a lista (com summary) e filtra client-side no
// AlunosList; orquestra os 3 modais (form, ficha, importação), todos
// irmãos — nunca modal dentro de modal (RN-web).
//
// QA prod 30/07 (item 1, regressão): o backend agora pagina (default
// 100, máximo 500 — Aura-backend#429). Pedimos o teto de uma vez
// (DOJO_STUDENTS_MAX_LIMIT) e repassamos `count` (total sem paginação)
// pro AlunosList, que avisa quando `count` > alunos carregados — sem
// paginação de verdade ainda, mas sem esconder aluno em silêncio.
//
// F11 (09/08/2026 — migration 274): filtro por tag é a PRIMEIRA exceção
// ao "carrega uma vez e filtra local" acima — tags não vêm embutidas no
// DojoStudent, então `tagFilter` entra como parâmetro `?tag_id=` do
// próprio listStudents (round-trip novo a cada troca de tag, igual
// status/q/belt fariam se o backend os recebesse — aqui o backend
// recebe de fato). `tags` (catálogo do dojô pra desenhar o filtro) é
// carregado à parte, uma vez, e não precisa re-buscar a cada troca de
// aluno filtrado.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, StyleSheet, ViewStyle } from "react-native";
import { KarateColors } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentsSummary, DOJO_STUDENTS_MAX_LIMIT,
} from "@/services/karateDojoStudentsApi";
import { karateDojoTagsApi, DojoTag } from "@/services/karateDojoTagsApi";
import { AlunosList } from "./AlunosList";
import { AlunoFormModal } from "./AlunoFormModal";
import { AlunoFichaModal } from "./AlunoFichaModal";
import { ImportAlunosModal } from "./ImportAlunosModal";

export function MeusAlunosTab() {
  const { federationId } = useKarateFederation();
  const [students, setStudents] = useState<DojoStudent[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<DojoStudentsSummary | null>(null);
  const [schemaPending, setSchemaPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // F11: catálogo de tags do dojô (pro filtro) + tag selecionada.
  const [tags, setTags] = useState<DojoTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formStudent, setFormStudent] = useState<DojoStudent | null>(null);
  const [fichaStudent, setFichaStudent] = useState<DojoStudent | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateDojoStudentsApi.listStudents(federationId, {
        summary: true,
        limit: DOJO_STUDENTS_MAX_LIMIT,
        // F11: server-side — ausente/null = sem filtro (todos os alunos).
        tag_id: tagFilter ?? undefined,
      });
      const data = res.data ?? [];
      setStudents(data);
      setCount(typeof res.count === "number" ? res.count : data.length);
      setSummary(res.summary ?? null);
      setSchemaPending(res.schema_pending === true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, tagFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // F11: catálogo de tags — carregado à parte (não depende de tagFilter,
  // só de federationId), pra não refazer o GET de tags a cada troca de
  // seleção no filtro. Falha ao listar esconde o filtro (dado faltante ≠
  // pendência) — nunca trava a lista de alunos.
  useEffect(() => {
    if (!federationId) return;
    karateDojoTagsApi.listTags(federationId)
      .then((r) => setTags(r.data ?? []))
      .catch(() => setTags([]));
  }, [federationId]);

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
        count={count}
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
        tags={tags}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
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
