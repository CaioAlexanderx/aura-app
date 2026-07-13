// ============================================================
// GerirEquipeTecnicaModal — Aura Karatê (federação) · Shoji
//
// Gestão de papéis da equipe técnica de UM dojô, direto do detalhe do dojô
// (app/karate/(federation)/dojos/[dojoId].tsx → botão "Gerir equipe" no
// card "Equipe técnica").
//
// Estrutura/estilo seguem TransferirPraticanteModal.tsx (Modal pageSheet,
// header com título + fechar, corpo em ScrollView, footer com ação).
//
// Fluxo:
//   1. Ao abrir, lista os praticantes do dojô via karateApi.listPractitioners
//      (filtro dojo_id, já suportado pelo backend/API — sem filtro client-side).
//   2. Cada praticante mostra 4 chips de papel: Árbitro / Instrutor /
//      Examinador / Auxiliar — estado inicial vem das flags is_* do próprio
//      praticante (a listagem já retorna is_arbiter/is_instructor/is_examiner/
//      is_assistant, ver services/karateApi.ts PractitionerListItem).
//   3. Quem já está em data.technical_team (do dojô) aparece primeiro na
//      lista, com indicador "Na equipe".
//   4. Salvar é por praticante (mantém simples: 1 PATCH por linha alterada,
//      sem estado de "dirty" agregado). Desmarcar os 4 papéis passa por
//      confirmAsync (remoção da equipe = ação destrutiva).
//   5. Sucesso → toast.success + onSaved() (a tela host refaz o load() do
//      dojô, atualizando o card "Equipe técnica").
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi, PractitionerListItem } from "@/services/karateApi";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  dojoId: string;
  dojoName: string;
  /** ids dos praticantes já presentes em data.technical_team (destaque + ordenação) */
  currentTeamIds: string[];
  /** chamado após qualquer salvamento bem-sucedido — a tela host deve refazer o load() do dojô */
  onSaved: () => void;
}

type RoleKey = "is_arbiter" | "is_instructor" | "is_examiner" | "is_assistant";
const ROLES: { key: RoleKey; label: string }[] = [
  { key: "is_arbiter", label: "Árbitro" },
  { key: "is_instructor", label: "Instrutor" },
  { key: "is_examiner", label: "Examinador" },
  { key: "is_assistant", label: "Auxiliar" },
];

// Estado editável local de cada praticante — cópia das flags is_* + controle de save.
type Row = {
  id: string;
  name: string;
  registration: string;
  initial: Record<RoleKey, boolean>;
  current: Record<RoleKey, boolean>;
  saving: boolean;
};

function toRoleFlags(p: PractitionerListItem): Record<RoleKey, boolean> {
  return {
    is_arbiter: !!p.is_arbiter,
    is_instructor: !!p.is_instructor,
    is_examiner: !!p.is_examiner,
    is_assistant: !!p.is_assistant,
  };
}

function isDirty(a: Record<RoleKey, boolean>, b: Record<RoleKey, boolean>): boolean {
  return ROLES.some((r) => a[r.key] !== b[r.key]);
}

export function GerirEquipeTecnicaModal({
  visible, onClose, federationId, dojoId, dojoName, currentTeamIds, onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");

  const teamSet = useMemo(() => new Set(currentTeamIds), [currentTeamIds]);

  const load = useCallback(() => {
    if (!dojoId) return;
    setLoading(true); setErrorMsg(null);
    karateApi.listPractitioners(federationId, { dojo_id: dojoId, pageSize: 200 })
      .then((res) => {
        const list = (res.data || []).map((p) => ({
          id: p.id,
          name: p.full_name,
          registration: p.karate_registration_number,
          initial: toRoleFlags(p),
          current: toRoleFlags(p),
          saving: false,
        }));
        // Membros atuais da equipe primeiro; dentro de cada grupo, ordem alfabética.
        list.sort((a, b) => {
          const aTeam = teamSet.has(a.id) ? 0 : 1;
          const bTeam = teamSet.has(b.id) ? 0 : 1;
          if (aTeam !== bTeam) return aTeam - bTeam;
          return a.name.localeCompare(b.name, "pt-BR");
        });
        setRows(list);
      })
      .catch(() => setErrorMsg("Não foi possível carregar os praticantes do dojô."))
      .finally(() => setLoading(false));
  }, [federationId, dojoId, teamSet]);

  useEffect(() => {
    if (visible) { setQuery(""); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dojoId]);

  const toggleRole = (id: string, role: RoleKey) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, current: { ...r.current, [role]: !r.current[role] } } : r));
  };

  const saveRow = async (row: Row) => {
    if (!isDirty(row.initial, row.current) || row.saving) return;

    // Remoção total (todos os 4 papéis desmarcados) = ação destrutiva se a
    // pessoa já estava na equipe → precisa de confirmação.
    const removingAll = ROLES.every((r) => !row.current[r.key]) && ROLES.some((r) => row.initial[r.key]);
    if (removingAll) {
      const ok = await confirmAsync({
        title: "Remover da equipe técnica?",
        message: `${row.name} perderá todos os papéis técnicos (Árbitro, Instrutor, Examinador, Auxiliar) neste dojô.`,
        confirmLabel: "Remover",
        destructive: true,
      });
      if (!ok) return;
    }

    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: true } : r));
    try {
      await karateApi.updatePractitioner(federationId, row.id, {
        is_arbiter: row.current.is_arbiter,
        is_instructor: row.current.is_instructor,
        is_examiner: row.current.is_examiner,
        is_assistant: row.current.is_assistant,
      });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, initial: { ...r.current }, saving: false } : r));
      toast.success(removingAll ? `${row.name} removido(a) da equipe técnica` : `Papéis de ${row.name} atualizados`);
      onSaved();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: false } : r));
      toast.error(e?.message || "Erro ao salvar os papéis. Tente novamente.");
    }
  };

  // BUGFIX (13/07/2026) — não havia forma explícita de remover alguém da
  // equipe técnica: a única via era desmarcar manualmente os 4 chips (pouco
  // descobrível) e dependia da listagem trazer os papéis certos (ver fix no
  // backend, GET /federation/:id/practitioners). Este botão cobre o caso
  // comum (papel de verdade em algum dos 4 chips) com a mesma confirmação
  // destrutiva de saveRow. Quem está na equipe SÓ por ser o sensei
  // responsável do dojô (nenhum dos 4 papéis) não pode ser removido por
  // aqui — o vínculo mora no cadastro do dojô, não no praticante — e o
  // botão avisa isso em vez de fingir sucesso.
  const removeFromTeam = async (row: Row) => {
    if (row.saving) return;
    const hasRoleFlags = ROLES.some((r) => row.initial[r.key]);
    if (!hasRoleFlags) {
      toast.error(`${row.name} está na equipe como sensei responsável do dojô — para remover, troque o campo "Sensei responsável" em Editar dojô.`);
      return;
    }
    const ok = await confirmAsync({
      title: "Remover da equipe técnica?",
      message: `${row.name} perderá todos os papéis técnicos (${ROLES.filter((r) => row.initial[r.key]).map((r) => r.label).join(", ")}) neste dojô.`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;

    const clearedFlags: Record<RoleKey, boolean> = { is_arbiter: false, is_instructor: false, is_examiner: false, is_assistant: false };
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, current: clearedFlags, saving: true } : r));
    try {
      await karateApi.updatePractitioner(federationId, row.id, clearedFlags);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, initial: clearedFlags, current: clearedFlags, saving: false } : r));
      toast.success(`${row.name} removido(a) da equipe técnica`);
      onSaved();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: false } : r));
      toast.error(e?.message || "Erro ao remover. Tente novamente.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.registration?.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Gerir equipe técnica</Text>
            <Text style={styles.headerSub}>{dojoName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar" hitSlop={10}>
            <Icon name="x" size={24} color={KarateColors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar praticante por nome ou FPKT"
            placeholderTextColor={KarateColors.ink3}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={KarateColors.primary} />
          ) : errorMsg ? (
            <View style={styles.errBox}>
              <Icon name="alert_circle" size={15} color={KarateColors.primary} />
              <Text style={styles.errTxt}>{errorMsg}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>
              {rows.length === 0 ? "Nenhum praticante cadastrado neste dojô." : "Nenhum praticante encontrado."}
            </Text>
          ) : (
            filtered.map((row) => {
              const dirty = isDirty(row.initial, row.current);
              const inTeam = teamSet.has(row.id);
              return (
                <View key={row.id} style={[styles.card, inTeam && styles.cardInTeam]}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{row.name}</Text>
                        {inTeam ? (
                          <View style={styles.teamBadge}>
                            <Icon name="check" size={10} color={KarateColors.ok} />
                            <Text style={styles.teamBadgeTxt}>Na equipe</Text>
                          </View>
                        ) : null}
                      </View>
                      {row.registration ? <Text style={styles.reg}>{row.registration}</Text> : null}
                    </View>
                    {inTeam ? (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeFromTeam(row)}
                        disabled={row.saving}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${row.name} da equipe técnica`}
                      >
                        <Icon name="trash" size={14} color={KarateColors.danger} />
                        <Text style={styles.removeBtnTxt}>Remover</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.chipsRow}>
                    {ROLES.map((r) => {
                      const active = row.current[r.key];
                      return (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleRole(row.id, r.key)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          {active ? <Icon name="check" size={12} color="#fdf8f2" /> : null}
                          <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{r.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {dirty ? (
                    <View style={styles.saveRow}>
                      <TouchableOpacity
                        style={styles.discardBtn}
                        onPress={() => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, current: { ...r.initial } } : r))}
                        disabled={row.saving}
                      >
                        <Text style={styles.discardTxt}>Descartar</Text>
                      </TouchableOpacity>
                      <KarateButton
                        label={row.saving ? "Salvando..." : "Salvar"}
                        variant="sumi"
                        size="sm"
                        loading={row.saving}
                        onPress={() => saveRow(row)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footer}>
          <KarateButton label="Concluir" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

export default GerirEquipeTecnicaModal;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  header:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headerTitle: { fontSize: 17, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  headerSub:   { fontSize: 12.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  searchWrap:  { paddingHorizontal: 16, paddingTop: 12 } as ViewStyle,
  searchInput: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: "#fff" } as TextStyle,
  body:        { flex: 1 } as ViewStyle,
  bodyContent: { padding: 16, paddingBottom: 32, gap: 10 } as ViewStyle,
  emptyText:   { textAlign: "center", color: KarateColors.ink3, paddingVertical: 24, fontSize: 13 } as TextStyle,
  errBox:      { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm } as ViewStyle,
  errTxt:      { flex: 1, fontSize: 13, color: KarateColors.ink } as TextStyle,
  card:        { padding: 12, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, gap: 10 } as ViewStyle,
  cardInTeam:  { borderColor: KarateColors.primaryLine } as ViewStyle,
  cardHead:    { flexDirection: "row", alignItems: "flex-start" } as ViewStyle,
  nameRow:     { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  name:        { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  reg:         { fontSize: 11, color: KarateColors.ink3, marginTop: 1, fontFamily: "monospace" } as TextStyle,
  teamBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.okSoft, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 } as ViewStyle,
  teamBadgeTxt:{ fontSize: 10, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  removeBtn:   { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: KarateColors.dangerSoft } as ViewStyle,
  removeBtnTxt:{ fontSize: 11, fontWeight: "700", color: KarateColors.danger } as TextStyle,
  chipsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip:        { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipActive:  { backgroundColor: KarateColors.sumi, borderColor: KarateColors.sumi } as ViewStyle,
  chipTxt:     { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  chipTxtActive: { color: "#fdf8f2" } as TextStyle,
  saveRow:     { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  discardBtn:  { paddingVertical: 8, paddingHorizontal: 10 } as ViewStyle,
  discardTxt:  { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  footer:      { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
