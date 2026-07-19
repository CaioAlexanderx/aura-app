// ============================================================
// AlunosList — F2 (aba "Meus alunos")
//
// Pirâmide por faixa (summary do backend, só ativos), busca + filtros
// status/faixa (client-side: a lista vem inteira, ≤1000) e as linhas.
// Presentational — dados e modais vivem no MeusAlunosTab.
//
// Regra da casa: dado faltante é NEUTRO (idade/CPF ausentes não viram
// alerta). A única sinalização é menor de 18 sem responsável (LGPD) —
// e mesmo assim discreta, no mesmo tom do resto da meta-linha.
// ============================================================
import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { DojoStudent, DojoStudentsSummary } from "@/services/karateDojoStudentsApi";
import { beltViewFor, maskCpf, onlyDigits } from "./helpers";

type StatusFilter = "all" | "active" | "inactive";

interface Props {
  students: DojoStudent[];
  summary: DojoStudentsSummary | null;
  loading: boolean;
  error: boolean;
  schemaPending: boolean;
  onRetry: () => void;
  onOpenStudent: (s: DojoStudent) => void;
  onNew: () => void;
  onImport: () => void;
}

export function AlunosList({
  students, summary, loading, error, schemaPending,
  onRetry, onOpenStudent, onNew, onImport,
}: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [belt, setBelt] = useState<string | null>(null);

  // Pirâmide: faixa mais alta primeiro (belt_order desc; sem ordem → fim).
  const piramide = useMemo(() => {
    const rows = (summary?.by_belt ?? []).filter((b) => b.count > 0);
    return [...rows].sort((a, b) => (b.belt_order ?? -1) - (a.belt_order ?? -1));
  }, [summary]);
  const maxP = Math.max(1, ...piramide.map((b) => b.count));

  const beltOptions = useMemo(() => {
    const seen = new Map<string, true>();
    for (const s of students) seen.set(s.belt_label ?? "Sem faixa", true);
    return Array.from(seen.keys());
  }, [students]);

  const qDigits = onlyDigits(q);
  const list = students.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (belt && (s.belt_label ?? "Sem faixa") !== belt) return false;
    if (q.trim()) {
      const byName = s.full_name.toLowerCase().includes(q.trim().toLowerCase());
      const byCpf = qDigits.length >= 3 && (s.cpf ?? "").includes(qDigits);
      if (!byName && !byCpf) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <Icon name="alert-circle" size={28} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>Não foi possível carregar os alunos.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryTxt}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (schemaPending) {
    return (
      <View style={styles.stateBox}>
        <Icon name="information-circle-outline" size={28} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>O cadastro de alunos ainda não está disponível.</Text>
        <Text style={styles.stateSub}>O servidor ainda não aplicou a atualização (migration 242). Tente de novo mais tarde.</Text>
      </View>
    );
  }

  if (students.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Icon name="people-outline" size={30} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>Nenhum aluno cadastrado ainda.</Text>
        <Text style={styles.stateSub}>
          Este é o registro próprio do seu dojô — independente da federação. Cadastre um a um ou importe a sua planilha de uma vez.
        </Text>
        <View style={styles.emptyBtns}>
          <KarateButton label="Cadastrar primeiro aluno" variant="sumi" size="md" onPress={onNew} />
          <KarateButton label="Importar planilha" variant="secondary" size="md" onPress={onImport} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {summary && piramide.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Faixas dos alunos</Text>
          <Text style={styles.cardSub}>
            {summary.active} ativo{summary.active === 1 ? "" : "s"} · {summary.inactive} inativo{summary.inactive === 1 ? "" : "s"} — a pirâmide conta só os ativos
          </Text>
          <View style={{ gap: 7, marginTop: 8 }}>
            {piramide.map((b) => {
              const v = beltViewFor(b.belt_label);
              return (
                <View key={b.belt_label ?? "sem-faixa"} style={styles.pyRow}>
                  <Text style={styles.pyLabel} numberOfLines={1}>{v.label}</Text>
                  <View style={styles.pyTrack}>
                    <View style={[styles.pyBar, { width: `${(b.count / maxP) * 100}%`, backgroundColor: v.color }]} />
                  </View>
                  <Text style={styles.pyNum}>{b.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.search}>
        <Icon name="search" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nome ou CPF"
          placeholderTextColor={KarateColors.ink4}
        />
      </View>

      <View style={styles.filters}>
        {([["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]] as [StatusFilter, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.chipBtn, status === key && styles.chipBtnOn]}
            onPress={() => setStatus(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: status === key }}
          >
            <Text style={[styles.chipBtnTxt, status === key && styles.chipBtnTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {beltOptions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beltFilters}>
          <TouchableOpacity
            style={[styles.chipBtn, !belt && styles.chipBtnOn]}
            onPress={() => setBelt(null)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipBtnTxt, !belt && styles.chipBtnTxtOn]}>Todas as faixas</Text>
          </TouchableOpacity>
          {beltOptions.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.chipBtn, belt === b && styles.chipBtnOn]}
              onPress={() => setBelt(belt === b ? null : b)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipBtnTxt, belt === b && styles.chipBtnTxtOn]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {list.map((s) => {
        const v = beltViewFor(s.belt_label);
        const minor = s.age != null && s.age < 18;
        return (
          <TouchableOpacity
            key={s.id}
            style={styles.row}
            onPress={() => onOpenStudent(s)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ficha de ${s.full_name}`}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nome} numberOfLines={1}>{s.full_name}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {s.age != null ? `${s.age} anos` : "Idade não informada"}
                {s.cpf ? ` · CPF ${maskCpf(s.cpf)}` : ""}
                {minor && s.guardian?.full_name ? ` · Resp.: ${s.guardian.full_name}` : ""}
                {minor && !s.guardian ? " · Sem responsável" : ""}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: v.color }]}>
              <Text style={[styles.chipTxt, { color: v.textColor }]}>{v.label}</Text>
            </View>
            <View style={[styles.status, s.status === "active" ? styles.statusOk : styles.statusPend]}>
              <Icon
                name={s.status === "active" ? "checkmark-circle" : "close-circle"}
                size={13}
                color={s.status === "active" ? KarateColors.ok : KarateColors.ink3}
              />
              <Text style={[styles.statusTxt, { color: s.status === "active" ? KarateColors.ok : KarateColors.ink3 }]}>
                {s.status === "active" ? "Ativo" : "Inativo"}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={KarateColors.ink4} />
          </TouchableOpacity>
        );
      })}

      {list.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="search" size={22} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum aluno com esses filtros.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 340, lineHeight: 17 } as TextStyle,
  emptyBtns: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, justifyContent: "center" } as ViewStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  pyRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  pyLabel: { width: 92, fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  pyTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  pyBar: { height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  pyNum: { width: 24, textAlign: "right", fontSize: 12, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,

  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, paddingVertical: 11 } as TextStyle,

  filters: { flexDirection: "row", gap: 8 } as ViewStyle,
  beltFilters: { flexDirection: "row", gap: 8, paddingRight: 8 } as ViewStyle,
  chipBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipBtnOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipBtnTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipBtnTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  nome: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  chipTxt: { fontSize: 11, fontWeight: "800" } as TextStyle,
  status: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  statusOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  statusPend: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
});
