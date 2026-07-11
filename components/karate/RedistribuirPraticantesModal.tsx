// ============================================================
// RedistribuirPraticantesModal — Aura Karatê (federação) · Shoji
//
// Alternativa a "Inativar todos" ao inativar um dojô: decide, praticante a
// praticante, entre TRANSFERIR para outro dojô ou INATIVAR (default). Ações
// em massa no topo agilizam o caso comum (mover todos para um dojô só).
// Ao confirmar, chama POST redistribute com as decisões + inactivate_dojo:
// true — o backend aplica tudo numa chamada só (ver services/karateApi.ts,
// contrato programado em paralelo pelo backend).
//
// Estrutura/estilo seguem GerirEquipeTecnicaModal.tsx (Modal pageSheet,
// header com título + fechar, corpo em ScrollView, footer com ação).
//
// Ação irreversível → confirmAsync mostrando a contagem de transferências e
// inativações antes de disparar o POST (regra do time: ações irreversíveis
// SEMPRE com confirmação explícita mostrando a contagem).
// ============================================================
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Pressable,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { karateApi, Dojo, DojoMemberStanding, RedistributeAction, RedistributeDecision } from "@/services/karateApi";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  dojoId: string;
  dojoName: string;
  /** Praticantes ATIVOS deste dojô — a tela host já busca via getDojoMembersStanding. */
  practitioners: DojoMemberStanding[];
  /** Chamado após o redistribute ter sucesso — a tela host recarrega o dojô/roster e fecha os dois modais. */
  onSuccess: () => void;
}

type Choice = { action: RedistributeAction; destinationId: string | null; destinationName: string | null };
const INACTIVATE_CHOICE: Choice = { action: "inactivate", destinationId: null, destinationName: null };

export function RedistribuirPraticantesModal({
  visible, onClose, federationId, dojoId, dojoName, practitioners, onSuccess,
}: Props) {
  // Estado por praticante — default "Inativar" (mesmo comportamento de hoje).
  const [decisions, setDecisions] = useState<Record<string, Choice>>({});
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [dojosLoading, setDojosLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Picker: null (fechado) | "ALL" (ação em massa) | student_id (linha)
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const initial: Record<string, Choice> = {};
    practitioners.forEach((p) => { initial[p.student_id] = INACTIVATE_CHOICE; });
    setDecisions(initial);
  }, [visible, practitioners]);

  useEffect(() => {
    if (!visible || !federationId) return;
    setDojosLoading(true);
    karateApi.listDojos(federationId, { status: "active", pageSize: 300 })
      .then((res) => setDojos((res.data || []).filter((d) => d.id !== dojoId)))
      .catch(() => setDojos([]))
      .finally(() => setDojosLoading(false));
  }, [visible, federationId, dojoId]);

  const applyChoice = useCallback((choice: Choice) => {
    if (pickerFor === "ALL") {
      setDecisions((prev) => {
        const next: Record<string, Choice> = {};
        Object.keys(prev).forEach((id) => { next[id] = choice; });
        return next;
      });
    } else if (pickerFor) {
      setDecisions((prev) => ({ ...prev, [pickerFor]: choice }));
    }
    setPickerFor(null);
  }, [pickerFor]);

  const transferCount = useMemo(() => Object.values(decisions).filter((d) => d.action === "transfer").length, [decisions]);
  const inactivateCount = useMemo(() => Object.values(decisions).filter((d) => d.action === "inactivate").length, [decisions]);

  const confirmAndSubmit = useCallback(async () => {
    if (busy || practitioners.length === 0) return;
    const msg = transferCount > 0 && inactivateCount > 0
      ? `${transferCount} praticante${transferCount === 1 ? "" : "s"} será${transferCount === 1 ? "" : "ão"} transferido${transferCount === 1 ? "" : "s"} e ${inactivateCount} será${inactivateCount === 1 ? "" : "ão"} inativado${inactivateCount === 1 ? "" : "s"}. O dojô "${dojoName}" será inativado. Esta ação não pode ser desfeita.`
      : transferCount > 0
        ? `${transferCount} praticante${transferCount === 1 ? "" : "s"} será${transferCount === 1 ? "" : "ão"} transferido${transferCount === 1 ? "" : "s"} para outro dojô. O dojô "${dojoName}" será inativado. Esta ação não pode ser desfeita.`
        : `${inactivateCount} praticante${inactivateCount === 1 ? "" : "s"} será${inactivateCount === 1 ? "" : "ão"} inativado${inactivateCount === 1 ? "" : "s"} junto com o dojô "${dojoName}". Esta ação não pode ser desfeita.`;

    const ok = await confirmAsync({
      title: "Confirmar redistribuição?",
      message: msg,
      confirmLabel: "Redistribuir e inativar dojô",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const payload: RedistributeDecision[] = practitioners.map((p) => {
        const d = decisions[p.student_id] || INACTIVATE_CHOICE;
        return d.action === "transfer"
          ? { student_id: p.student_id, action: "transfer", destination_dojo_id: d.destinationId! }
          : { student_id: p.student_id, action: "inactivate" };
      });
      await karateApi.redistributeDojo(federationId, dojoId, { decisions: payload, inactivate_dojo: true });
      toast.success("Praticantes redistribuídos e dojô inativado");
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível redistribuir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [busy, practitioners, decisions, transferCount, inactivateCount, dojoName, federationId, dojoId, onSuccess]);

  const pickerTitle = pickerFor === "ALL"
    ? "Transferir todos para…"
    : "Destino do praticante";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !busy && onClose()}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Redistribuir praticantes</Text>
            <Text style={styles.headerSub}>{dojoName} · o dojô será inativado ao confirmar</Text>
          </View>
          <TouchableOpacity onPress={() => !busy && onClose()} accessibilityLabel="Fechar" hitSlop={10}>
            <Icon name="x" size={24} color={P.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.massActions}>
          <TouchableOpacity
            style={styles.massBtn}
            disabled={busy || dojos.length === 0}
            onPress={() => setPickerFor("ALL")}
            accessibilityRole="button"
          >
            <Icon name="arrow-forward" size={13} color={P.ink} />
            <Text style={styles.massBtnTxt}>Transferir todos para…</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.massBtn}
            disabled={busy}
            onPress={() => setDecisions((prev) => {
              const next: Record<string, Choice> = {};
              Object.keys(prev).forEach((id) => { next[id] = INACTIVATE_CHOICE; });
              return next;
            })}
            accessibilityRole="button"
          >
            <Icon name="power" size={13} color={P.red} />
            <Text style={styles.massBtnTxt}>Inativar todos</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {practitioners.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum praticante ativo neste dojô — pode inativar direto.</Text>
          ) : (
            practitioners.map((p) => {
              const choice = decisions[p.student_id] || INACTIVATE_CHOICE;
              return (
                <View key={p.student_id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{p.full_name}</Text>
                    <Text style={styles.rowReg} numberOfLines={1}>
                      {p.karate_registration_number || "Sem matrícula"}
                    </Text>
                  </View>
                  {p.belt_level ? <BeltBadge beltLevel={p.belt_level} beltName={p.belt_name || undefined} /> : null}
                  <TouchableOpacity
                    style={[styles.destBtn, choice.action === "transfer" && styles.destBtnTransfer]}
                    disabled={busy}
                    onPress={() => setPickerFor(p.student_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Destino de ${p.full_name}`}
                  >
                    {choice.action === "transfer" ? (
                      <Icon name="arrow-forward" size={12} color={P.ok ?? "#2d8a4e"} />
                    ) : (
                      <Icon name="power" size={12} color={P.red} />
                    )}
                    <Text style={[styles.destBtnTxt, choice.action === "transfer" && styles.destBtnTxtTransfer]} numberOfLines={1}>
                      {choice.action === "transfer" ? choice.destinationName : "Inativar"}
                    </Text>
                    <Icon name="chevron_down" size={12} color={P.ink3} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerSummaryTxt}>
              {transferCount} transferência{transferCount === 1 ? "" : "s"} · {inactivateCount} inativação{inactivateCount === 1 ? "" : "ões"}
            </Text>
          </View>
          <View style={styles.footerBtns}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
            <KarateButton
              label={busy ? "Redistribuindo..." : "Redistribuir e inativar dojô"}
              variant="primary"
              size="md"
              loading={busy}
              disabled={busy || practitioners.length === 0}
              onPress={confirmAndSubmit}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>

      <DestinationPickerModal
        visible={!!pickerFor}
        onClose={() => setPickerFor(null)}
        dojos={dojos}
        dojosLoading={dojosLoading}
        onPick={applyChoice}
        title={pickerTitle}
      />
    </Modal>
  );
}

export default RedistribuirPraticantesModal;

// ── Picker de destino compartilhado (linha individual e ação em massa) ────
// "Inativar" ou um dos dojôs de destino, com busca — mesmo padrão do
// DojoSelectSection (components/karate/praticante-ficha), num modal pequeno
// para não brigar com o scroll da tabela.
function DestinationPickerModal({
  visible, onClose, dojos, dojosLoading, onPick, title,
}: {
  visible: boolean;
  onClose: () => void;
  dojos: Dojo[];
  dojosLoading: boolean;
  onPick: (choice: Choice) => void;
  title: string;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { if (visible) setQ(""); }, [visible]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return dojos;
    return dojos.filter((d) => d.name.toLowerCase().includes(term));
  }, [dojos, q]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={pickerStyles.card}>
          <Text style={pickerStyles.title}>{title}</Text>

          <TouchableOpacity
            style={pickerStyles.inactivateOption}
            onPress={() => onPick(INACTIVATE_CHOICE)}
            accessibilityRole="button"
          >
            <Icon name="power" size={14} color={P.red} />
            <Text style={pickerStyles.inactivateTxt}>Inativar</Text>
          </TouchableOpacity>

          <TextInput
            style={pickerStyles.search}
            placeholder="Buscar dojô por nome"
            placeholderTextColor={P.ink4}
            value={q}
            onChangeText={setQ}
            autoFocus
            accessibilityLabel="Buscar dojô de destino"
          />

          {dojosLoading ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={P.red} />
          ) : filtered.length === 0 ? (
            <Text style={pickerStyles.empty}>Nenhum dojô encontrado</Text>
          ) : (
            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
              {filtered.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={pickerStyles.item}
                  onPress={() => onPick({ action: "transfer", destinationId: d.id, destinationName: d.name })}
                  accessibilityRole="button"
                >
                  <Icon name="arrow-forward" size={13} color={P.ink2} />
                  <Text style={pickerStyles.itemTxt} numberOfLines={1}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose}>
            <Text style={pickerStyles.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.paperWarm } as ViewStyle,
  header:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  headerTitle: { fontFamily: F.heading, fontSize: 19, color: P.ink } as TextStyle,
  headerSub:   { fontFamily: F.body, fontSize: 12.5, color: P.ink3, marginTop: 2 } as TextStyle,

  massActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, flexWrap: "wrap" } as ViewStyle,
  massBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  massBtnTxt:  { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.ink } as TextStyle,

  body:        { flex: 1, marginTop: 8 } as ViewStyle,
  bodyContent: { paddingHorizontal: 16, paddingBottom: 24 } as ViewStyle,
  emptyText:   { textAlign: "center", color: P.ink3, paddingVertical: 24, fontSize: 13, fontFamily: F.body } as TextStyle,

  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.line, flexWrap: "wrap" } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  rowReg:  { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,

  destBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2, minWidth: 118, maxWidth: 200 } as ViewStyle,
  destBtnTransfer: { borderColor: "#b7e0c2", backgroundColor: "#f0faf2" } as ViewStyle,
  destBtnTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: P.red } as TextStyle,
  destBtnTxtTransfer: { color: P.ok ?? "#2d8a4e" } as TextStyle,

  footer:         { padding: 16, borderTopWidth: 1, borderTopColor: P.line, gap: 10 } as ViewStyle,
  footerSummary:  { alignItems: "center" } as ViewStyle,
  footerSummaryTxt: { fontFamily: F.body, fontSize: 12, color: P.ink2, fontWeight: "600" } as TextStyle,
  footerBtns:     { flexDirection: "row", gap: 8 } as ViewStyle,
});

const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, borderWidth: 1, borderColor: P.line2, padding: 18, width: "100%", maxWidth: 380 } as ViewStyle,
  title: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.ink, marginBottom: 10 } as TextStyle,
  inactivateOption: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: "#e3c3bd", backgroundColor: "#fbf1ef", marginBottom: 10 } as ViewStyle,
  inactivateTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.red } as TextStyle,
  search: { fontFamily: F.body, fontSize: 13.5, color: P.ink, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 } as TextStyle,
  empty: { fontFamily: F.body, fontSize: 12.5, color: P.ink3, textAlign: "center", paddingVertical: 16 } as TextStyle,
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: P.line } as ViewStyle,
  itemTxt: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: P.ink } as TextStyle,
  cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 8 } as ViewStyle,
  cancelTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink2 } as TextStyle,
});
