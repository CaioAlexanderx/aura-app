// ============================================================
// TurmasList — turmas do dojô (F4)
//
// Cards (nome, dias da semana como chips, horário, modalidade, nº de
// alunos, badge inativa). Dono da lista de turmas + do TurmaFormModal
// (criar/editar) e do TurmaDetalhe (matrícula + chamada) — todos
// irmãos, nunca modal aninhado (RN-web). Sem TouchableOpacity aninhado:
// o card é uma View simples com uma linha de ações (Abrir/Editar).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateDojoClassesApi, DojoClass } from "@/services/karateDojoClassesApi";
import { mapClassesError, timeRangeLabel, WEEKDAY_SHORT, WEEKDAY_LONG } from "./helpers";
import { TurmaFormModal } from "./TurmaFormModal";
import { TurmaDetalhe } from "./TurmaDetalhe";

interface Props {
  federationId: string;
}

export function TurmasList({ federationId }: Props) {
  const [classes, setClasses] = useState<DojoClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaPending, setSchemaPending] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formClass, setFormClass] = useState<DojoClass | null>(null);
  const [detailClass, setDetailClass] = useState<DojoClass | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSchemaPending(false);
    try {
      const res = await karateDojoClassesApi.listClasses(federationId);
      setClasses(res.data ?? []);
      setSchemaPending(res.schema_pending === true);
    } catch (e: any) {
      const mapped = mapClassesError(e);
      if (mapped.code === "SCHEMA_PENDING") setSchemaPending(true);
      else setError(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  if (schemaPending) {
    return (
      <View style={styles.stateBox}>
        <Icon name="clock" size={26} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>Turmas ainda não estão disponíveis neste ambiente.</Text>
        <Text style={styles.stateSub}>Uma atualização está pendente no servidor. Tente novamente mais tarde.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <Icon name="alert" size={26} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
          <Text style={styles.retryTxt}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {classes.length > 0 && (
        <View style={styles.actionsRow}>
          <KarateButton label="Nova turma" variant="sumi" size="sm" onPress={() => { setFormClass(null); setFormOpen(true); }} />
        </View>
      )}

      {classes.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="dumbbell" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhuma turma cadastrada ainda.</Text>
          <Text style={styles.stateSub}>Crie uma turma (ex.: "Infantil", Seg/Qua/Sex às 18h) para começar a fazer chamada.</Text>
          <KarateButton label="Criar primeira turma" variant="sumi" size="md" onPress={() => { setFormClass(null); setFormOpen(true); }} style={{ marginTop: 4 }} />
        </View>
      )}

      <View style={styles.grid}>
        {classes.map((c) => {
          const time = timeRangeLabel(c.start_time, c.end_time);
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>{c.name}</Text>
                {!c.active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveTxt}>Inativa</Text>
                  </View>
                )}
              </View>

              <View style={styles.chipsRow}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on = (c.weekdays || []).includes(d);
                  return (
                    <View key={d} style={[styles.dayChip, on && styles.dayChipOn]} accessibilityLabel={WEEKDAY_LONG[d]}>
                      <Text style={[styles.dayChipTxt, on && styles.dayChipTxtOn]}>{WEEKDAY_SHORT[d]}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.metaRow}>
                {!!time && (
                  <View style={styles.metaItem}>
                    <Icon name="clock" size={12} color={KarateColors.ink3} />
                    <Text style={styles.metaTxt}>{time}</Text>
                  </View>
                )}
                {!!c.modality && (
                  <View style={styles.metaItem}>
                    <Icon name="dumbbell" size={12} color={KarateColors.ink3} />
                    <Text style={styles.metaTxt} numberOfLines={1}>{c.modality}</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Icon name="users" size={12} color={KarateColors.ink3} />
                  <Text style={styles.metaTxt}>{c.students_count} aluno{c.students_count === 1 ? "" : "s"}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editIconBtn}
                  onPress={() => { setFormClass(c); setFormOpen(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${c.name}`}
                >
                  <Icon name="edit" size={14} color={KarateColors.ink2} />
                </TouchableOpacity>
                <KarateButton label="Abrir turma" variant="secondary" size="sm" onPress={() => setDetailClass(c)} style={{ flex: 1 }} />
              </View>
            </View>
          );
        })}
      </View>

      <TurmaFormModal
        visible={formOpen}
        federationId={federationId}
        turma={formClass}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setFormClass(null); load(); }}
      />

      <TurmaDetalhe
        visible={!!detailClass}
        federationId={federationId}
        turma={detailClass}
        onClose={() => setDetailClass(null)}
        onChanged={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 380, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  actionsRow: { flexDirection: "row", justifyContent: "flex-end" } as ViewStyle,
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  card: {
    flexGrow: 1, flexBasis: 280, maxWidth: 380,
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10,
  } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  inactiveBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: KarateColors.bg2 } as ViewStyle,
  inactiveTxt: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  chipsRow: { flexDirection: "row", gap: 5 } as ViewStyle,
  dayChip: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2 } as ViewStyle,
  dayChipOn: { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  dayChipTxt: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ink4 } as TextStyle,
  dayChipTxtOn: { color: KarateColors.primary } as TextStyle,

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  metaTxt: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,

  cardActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 } as ViewStyle,
  editIconBtn: { width: 34, height: 34, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
});
