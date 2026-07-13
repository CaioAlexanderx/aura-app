// ============================================================
// GerirEquipeTecnicaModal — Aura Karatê (federação) · Shoji
//
// Gestão de papéis da equipe técnica de UM dojô, direto do detalhe do dojô
// (app/karate/(federation)/dojos/[dojoId].tsx → botão "Gerir equipe" no
// card "Equipe técnica").
//
// REDESIGN (13/07/2026) — o modal estava fora do padrão Shoji: <Modal
// pageSheet> tela cheia com fonte solta (sem F.heading/F.body), chips
// genéricos e tamanho destoante dos demais modais da federação. Trocado
// pelo padrão consolidado dos modais de referência (DojoFichaModal,
// RedistribuirPraticantesModal, VoidBatchModal, CampaignWizard): modal
// transparente + card centrado via ModalPop, header em relevo com selo
// 空 + título serifado, corpo rolável, footer fixo — e Chip do kit Shoji
// pros 4 papéis (em vez de TouchableOpacity cru).
//
// ⚠️ BUG REAL ENCONTRADO E CORRIGIDO NESTE REDESIGN — confirmAsync
// invisível: a versão anterior usava confirmAsync (components/karate/
// ConfirmDialog.tsx) tanto no botão "Remover" (PR #560) quanto ao
// desmarcar os 4 papéis manualmente. ConfirmHost é montado UMA VEZ no
// layout da federação (app/karate/(federation)/_layout.tsx), ou seja o
// portal do seu <Modal> nasce ANTES deste modal existir. Quando este
// modal abre (mais tarde) e chama confirmAsync, o <Modal> do ConfirmHost
// é reaproveitado mas seu portal continua "atrás" do portal deste modal
// no RN Web — o diálogo de confirmação nunca aparecia, "Remover" parecia
// não fazer nada (mesma armadilha documentada em dojos/[dojoId].tsx,
// excluirDefinitivo, e em RedistribuirPraticantesModal). Corrigido
// substituindo por uma etapa de confirmação INLINE no próprio card da
// linha (stage "confirming" em vez de um 2º <Modal>) — sem confirmAsync
// neste arquivo.
//
// Fluxo:
//   1. Ao abrir, lista os praticantes do dojô via karateApi.listPractitioners
//      (filtro dojo_id, já suportado pelo backend/API — sem filtro client-side).
//   2. Cada praticante mostra 4 chips de papel: Instrutor / Examinador /
//      Árbitro / Auxiliar — estado inicial vem das flags is_* do próprio
//      praticante (a listagem já retorna is_arbiter/is_instructor/is_examiner/
//      is_assistant, ver services/karateApi.ts PractitionerListItem).
//   3. Quem já está em data.technical_team (do dojô) aparece primeiro na
//      lista, com indicador "Na equipe" (ShojiBadge, ícone+texto).
//   4. Salvar é por praticante (1 PATCH por linha alterada). Remoção total
//      (via botão "Remover" do cabeçalho da linha OU via desmarcar os 4
//      chips manualmente) passa pela etapa de confirmação inline — ambas
//      convergem na mesma função (requestRemoval/confirmRemoval), então
//      não existem dois caminhos com comportamento diferente.
//   5. Exceção: quem está na equipe só por ser o SENSEI responsável do
//      dojô (nenhuma das 4 flags marcada) não pode ser removido por aqui
//      — o vínculo vive no cadastro do dojô (sensei_practitioner_id), não
//      no praticante. Em vez de mostrar o botão Remover e falhar depois
//      do clique, a linha exibe uma nota explicando isso (clareza
//      proativa, não erro reativo).
//   6. Sucesso → toast.success + onSaved() (a tela host refaz o load() do
//      dojô, atualizando o card "Equipe técnica").
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, Pressable,
  useWindowDimensions, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ModalPop } from "@/components/karate/anim/ModalPop";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Chip, SearchField, ShojiBadge } from "@/components/karate/shoji";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, PractitionerListItem } from "@/services/karateApi";
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

type RoleKey = "is_instructor" | "is_examiner" | "is_arbiter" | "is_assistant";
const ROLES: { key: RoleKey; label: string }[] = [
  { key: "is_instructor", label: "Instrutor" },
  { key: "is_examiner", label: "Examinador" },
  { key: "is_arbiter", label: "Árbitro" },
  { key: "is_assistant", label: "Auxiliar" },
];
const CLEARED_FLAGS: Record<RoleKey, boolean> = {
  is_instructor: false, is_examiner: false, is_arbiter: false, is_assistant: false,
};

// Estado editável local de cada praticante — cópia das flags is_* + controle
// de save + estágio de confirmação inline de remoção (ver nota grande no
// topo do arquivo sobre por que não é confirmAsync).
type Row = {
  id: string;
  name: string;
  registration: string;
  initial: Record<RoleKey, boolean>;
  current: Record<RoleKey, boolean>;
  saving: boolean;
  confirming: boolean;
  /** snapshot de `current` no momento em que "Remover" foi acionado — restaurado em "Voltar" */
  snapshot: Record<RoleKey, boolean> | null;
  removeErr: string | null;
};

function toRoleFlags(p: PractitionerListItem): Record<RoleKey, boolean> {
  return {
    is_instructor: !!p.is_instructor,
    is_examiner: !!p.is_examiner,
    is_arbiter: !!p.is_arbiter,
    is_assistant: !!p.is_assistant,
  };
}

function isDirty(a: Record<RoleKey, boolean>, b: Record<RoleKey, boolean>): boolean {
  return ROLES.some((r) => a[r.key] !== b[r.key]);
}

function hasAnyRole(flags: Record<RoleKey, boolean>): boolean {
  return ROLES.some((r) => flags[r.key]);
}

function activeRoleLabels(flags: Record<RoleKey, boolean>): string {
  return ROLES.filter((r) => flags[r.key]).map((r) => r.label).join(", ");
}

export function GerirEquipeTecnicaModal({
  visible, onClose, federationId, dojoId, dojoName, currentTeamIds, onSaved,
}: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(640, width - 24);

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
        const list: Row[] = (res.data || []).map((p) => ({
          id: p.id,
          name: p.full_name,
          registration: p.karate_registration_number,
          initial: toRoleFlags(p),
          current: toRoleFlags(p),
          saving: false,
          confirming: false,
          snapshot: null,
          removeErr: null,
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

  const discardEdits = (id: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, current: { ...r.initial } } : r));
  };

  // Ação NÃO destrutiva (adicionar/trocar papéis) — salva direto, sem
  // confirmação. Se o resultado zerar os 4 papéis (removingAll), redireciona
  // pra etapa de confirmação em vez de aplicar — a UI já evita chegar aqui
  // nesse caso (ver TeamRow), isto é só uma trava de segurança.
  const saveRow = async (row: Row) => {
    if (row.saving || !isDirty(row.initial, row.current)) return;
    const removingAll = !hasAnyRole(row.current) && hasAnyRole(row.initial);
    if (removingAll) { requestRemoval(row); return; }

    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: true } : r));
    try {
      await karateApi.updatePractitioner(federationId, row.id, {
        is_instructor: row.current.is_instructor,
        is_examiner: row.current.is_examiner,
        is_arbiter: row.current.is_arbiter,
        is_assistant: row.current.is_assistant,
      });
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, initial: { ...r.current }, saving: false } : r));
      toast.success(`Papéis de ${row.name} atualizados`);
      onSaved();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: false } : r));
      toast.error(e?.message || "Erro ao salvar os papéis. Tente novamente.");
    }
  };

  // Abre a etapa de confirmação INLINE (dentro do próprio card — ver nota
  // grande no topo do arquivo). Único ponto de entrada pra "vai remover
  // tudo", seja pelo botão "Remover" do cabeçalho ou por desmarcar os 4
  // chips manualmente — os dois caminhos terminam aqui.
  const requestRemoval = (row: Row) => {
    if (row.saving) return;
    setRows((prev) => prev.map((r) => r.id === row.id
      ? { ...r, snapshot: r.current, current: CLEARED_FLAGS, confirming: true, removeErr: null }
      : r));
  };

  const cancelRemoval = (row: Row) => {
    if (row.saving) return;
    setRows((prev) => prev.map((r) => r.id === row.id
      ? { ...r, current: r.snapshot ?? r.initial, snapshot: null, confirming: false, removeErr: null }
      : r));
  };

  const confirmRemoval = async (row: Row) => {
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: true, removeErr: null } : r));
    try {
      await karateApi.updatePractitioner(federationId, row.id, CLEARED_FLAGS);
      setRows((prev) => prev.map((r) => r.id === row.id
        ? { ...r, initial: CLEARED_FLAGS, current: CLEARED_FLAGS, snapshot: null, saving: false, confirming: false }
        : r));
      toast.success(`${row.name} removido(a) da equipe técnica`);
      onSaved();
    } catch (e: any) {
      setRows((prev) => prev.map((r) => r.id === row.id
        ? { ...r, saving: false, removeErr: e?.message || "Erro ao remover. Tente novamente." }
        : r));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.registration?.toLowerCase().includes(q));
  }, [rows, query]);

  const anySaving = rows.some((r) => r.saving);
  const teamCount = currentTeamIds.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !anySaving && onClose()}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !anySaving && onClose()} />
        <ModalPop visible={visible} style={[st.modalCard, { width: cardW }]}>
          <View style={st.head}>
            <View style={{ flex: 1 }}>
              <Text style={st.eyebrow}>空  FPKT · Equipe técnica</Text>
              <Text style={st.title}>{dojoName}<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={st.sub}>
                {teamCount} {teamCount === 1 ? "pessoa" : "pessoas"} na equipe · toque nos papéis pra ajustar
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => !anySaving && onClose()}
              disabled={anySaving}
              hitSlop={10}
              style={st.close}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Icon name="x" size={20} color={C.ink2} />
            </TouchableOpacity>
          </View>

          <View style={st.searchWrap}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar praticante por nome ou FPKT"
            />
          </View>

          <ScrollView style={st.body} contentContainerStyle={st.bodyContent} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={{ gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={st.skelCard}>
                    <Skeleton width="55%" height={14} />
                    <Skeleton width="30%" height={10} style={{ marginTop: 7 } as any} />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                      {[0, 1, 2, 3].map((j) => (
                        <Skeleton key={j} width={70} height={26} radius={999} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : errorMsg ? (
              <KarateErrorState message={errorMsg} onRetry={load} style={{ paddingVertical: 32 } as any} />
            ) : filtered.length === 0 ? (
              rows.length === 0 ? (
                <KarateEmptyState
                  icon="users"
                  title="Nenhum praticante cadastrado neste dojô."
                  style={{ paddingVertical: 32 } as any}
                />
              ) : (
                <KarateEmptyState
                  icon="search"
                  title="Nenhum praticante encontrado"
                  subtitle={`Nada bate com "${query}".`}
                  style={{ paddingVertical: 32 } as any}
                />
              )
            ) : (
              <View style={{ gap: 10 }}>
                {filtered.map((row) => (
                  <TeamRow
                    key={row.id}
                    row={row}
                    inTeam={teamSet.has(row.id)}
                    onToggleRole={toggleRole}
                    onDiscard={discardEdits}
                    onSave={saveRow}
                    onRequestRemoval={requestRemoval}
                    onCancelRemoval={cancelRemoval}
                    onConfirmRemoval={confirmRemoval}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          <View style={st.footer}>
            <KarateButton label="Concluir" variant="ghost" size="md" onPress={() => !anySaving && onClose()} disabled={anySaving} style={{ flex: 1 }} />
          </View>
        </ModalPop>
      </View>
    </Modal>
  );
}

// ── TeamRow — um card por praticante. Dois estágios: edição normal (chips +
// Salvar/Descartar) e confirmação inline de remoção (confirming=true). Nunca
// um segundo <Modal> (ver nota grande no topo do arquivo). ──────────────
function TeamRow({ row, inTeam, onToggleRole, onDiscard, onSave, onRequestRemoval, onCancelRemoval, onConfirmRemoval }: {
  row: Row;
  inTeam: boolean;
  onToggleRole: (id: string, role: RoleKey) => void;
  onDiscard: (id: string) => void;
  onSave: (row: Row) => void;
  onRequestRemoval: (row: Row) => void;
  onCancelRemoval: (row: Row) => void;
  onConfirmRemoval: (row: Row) => void;
}) {
  const dirty = isDirty(row.initial, row.current);
  const removingAll = dirty && !hasAnyRole(row.current) && hasAnyRole(row.initial);
  const removableHere = hasAnyRole(row.initial);
  const senseiOnly = inTeam && !removableHere;

  if (row.confirming) {
    return (
      <View style={[st.card, st.cardConfirm]}>
        <View style={st.confirmHead}>
          <Icon name="trash" size={15} color={P.red} />
          <Text style={st.confirmTitle}>Remover {row.name} da equipe técnica?</Text>
        </View>
        <Text style={st.confirmMsg}>
          {row.name} perderá todos os papéis técnicos ({activeRoleLabels(row.initial) || "nenhum papel restante"}) neste dojô.
          Dá pra readicionar os papéis depois, se for engano.
        </Text>
        {row.removeErr ? (
          <View style={st.errBox}>
            <Icon name="alert_circle" size={14} color={P.red} />
            <Text style={st.errTxt}>{row.removeErr}</Text>
          </View>
        ) : null}
        <View style={st.confirmActions}>
          <KarateButton
            label="Voltar"
            variant="ghost"
            size="sm"
            disabled={row.saving}
            onPress={() => onCancelRemoval(row)}
            style={{ flex: 1 }}
          />
          <KarateButton
            label={row.saving ? "Removendo..." : row.removeErr ? "Tentar novamente" : "Confirmar remoção"}
            variant="primary"
            size="sm"
            loading={row.saving}
            onPress={() => onConfirmRemoval(row)}
            style={{ flex: 1.6 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[st.card, inTeam && st.cardInTeam]}>
      <View style={st.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={st.nameRow}>
            <Text style={st.name}>{row.name}</Text>
            {inTeam ? <ShojiBadge status="ok" label="Na equipe" /> : null}
          </View>
          {row.registration ? <Text style={st.reg}>{row.registration}</Text> : null}
        </View>
        {inTeam && removableHere ? (
          <TouchableOpacity
            style={st.removeBtn}
            onPress={() => onRequestRemoval(row)}
            disabled={row.saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${row.name} da equipe técnica`}
          >
            <Icon name="trash" size={13} color={P.red} />
            <Text style={st.removeBtnTxt}>Remover</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {senseiOnly ? (
        <View style={st.senseiNote}>
          <Icon name="shield" size={13} color={C.ink3} />
          <Text style={st.senseiNoteTxt}>
            Na equipe como sensei responsável do dojô — esse vínculo vive no cadastro do dojô (não pode ser removido por aqui).
          </Text>
        </View>
      ) : null}

      <View style={st.chipsRow}>
        {ROLES.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            icon="check"
            active={row.current[r.key]}
            onPress={() => onToggleRole(row.id, r.key)}
            accessibilityLabel={`${r.label} — ${row.current[r.key] ? "papel ativo, toque pra remover" : "papel inativo, toque pra adicionar"}`}
          />
        ))}
      </View>

      {dirty ? (
        <View style={st.saveRow}>
          <TouchableOpacity
            style={st.discardBtn}
            onPress={() => onDiscard(row.id)}
            disabled={row.saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Descartar alterações"
          >
            <Text style={st.discardTxt}>Descartar</Text>
          </TouchableOpacity>
          <KarateButton
            label={row.saving ? "Salvando..." : removingAll ? "Remover" : "Salvar"}
            variant={removingAll ? "primary" : "sumi"}
            size="sm"
            loading={row.saving}
            onPress={() => removingAll ? onRequestRemoval(row) : onSave(row)}
          />
        </View>
      ) : null}
    </View>
  );
}

export default GerirEquipeTecnicaModal;

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  modalCard: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "88%", borderWidth: 1, borderColor: P.line2, flexDirection: "column" } as ViewStyle,

  head:   { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow:{ fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title:  { fontFamily: F.heading, fontSize: 22, color: P.ink, marginTop: 2 } as TextStyle,
  sub:    { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  close:  { padding: 4, borderRadius: 999 } as ViewStyle,

  searchWrap: { paddingHorizontal: 20, paddingTop: 14 } as ViewStyle,

  body:        { flex: 1, minHeight: 0 } as ViewStyle,
  bodyContent: { padding: 20, paddingBottom: 24 } as ViewStyle,

  skelCard: { padding: 14, backgroundColor: P.glass2, borderRadius: R.lg, borderWidth: 1, borderColor: P.line } as ViewStyle,

  // Card de linha (um praticante). Também reaproveitado (com cardConfirm)
  // pela etapa de confirmação inline de remoção — mesmo card, conteúdo troca.
  card:       { padding: 13, backgroundColor: P.paperWarm, borderRadius: R.lg, borderWidth: 1, borderColor: P.line2, gap: 10 } as ViewStyle,
  cardInTeam: { borderColor: P.redLine } as ViewStyle,

  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  nameRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as ViewStyle,
  name:     { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  reg:      { fontFamily: F.mono, fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,

  removeBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: P.dangerWash, borderWidth: 1, borderColor: P.redLine } as ViewStyle,
  removeBtnTxt: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.red } as TextStyle,

  senseiNote:    { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line, borderRadius: R.md, padding: 10 } as ViewStyle,
  senseiNoteTxt: { flex: 1, fontFamily: F.body, fontSize: 11.5, lineHeight: 16, color: P.ink3 } as TextStyle,

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,

  saveRow:    { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, paddingTop: 4, marginTop: 2, borderTopWidth: 1, borderTopColor: P.line } as ViewStyle,
  discardBtn: { paddingVertical: 8, paddingHorizontal: 10 } as ViewStyle,
  discardTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink3 } as TextStyle,

  footer: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,

  // Etapa de confirmação inline de remoção (mesmo tom de excluirDefinitivo
  // em dojos/[dojoId].tsx — vermelho contido, não um alarme total).
  cardConfirm:    { borderColor: P.redLine, backgroundColor: P.redWash, gap: 10 } as ViewStyle,
  confirmHead:    { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  confirmTitle:   { fontFamily: F.heading, fontSize: 15, color: P.ink } as TextStyle,
  confirmMsg:     { fontFamily: F.body, fontSize: 12.5, lineHeight: 18, color: P.ink2 } as TextStyle,
  confirmActions: { flexDirection: "row", gap: 8 } as ViewStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 10, padding: 10 } as ViewStyle,
  errTxt: { flex: 1, fontFamily: F.body, fontSize: 12, color: P.red2 } as TextStyle,
});
