// ============================================================
// DecidirAvisoModal — F11.3 (federação): decidir um aviso do dojô
//
// ── O QUE ESTE MODAL DECIDE ─────────────────────────────────
// Um aviso diz UMA coisa: "o sensei do dojô X não reconhece esta pessoa
// como aluno atual dele, em tal data". É um FATO RELATADO POR ELE — não
// uma constatação da federação, e NÃO significa que a pessoa parou de
// treinar: ela pode ter MUDADO DE DOJÔ (540 transferências registradas).
// Por isso a atribuição do aviso aparece no topo, com o nome do dojô e a
// data, antes de qualquer botão.
//
// ── AS TRÊS SAÍDAS, NESTA ORDEM ─────────────────────────────
//   1. Manter como está   — mais barata e reversível; tira o aviso da fila.
//   2. Registrar transferência — o caso provável quando o praticante já
//      está (ou deveria estar) em outro dojô.
//   3. Inativar           — a mais consequente, POR ÚLTIMO e sem default.
// Nenhuma opção vem pré-selecionada: inativar 4.033 pessoas por inércia
// de UI seria dano difícil de desfazer.
//
// ── O 409 QUE PROTEGE QUEM JÁ MUDOU DE LUGAR ────────────────
// Inativar/transferir é escopado pelo dojô que AVISOU. Se o praticante já
// saiu de lá, o backend recusa (PRATICANTE_JA_SAIU_DO_DOJO). Quando a
// listagem já sabe disso (`practitioner_left_dojo`), o modal avisa ANTES
// e desabilita as duas ações — e se ainda assim vier o 409, a mensagem
// traduzida (mapNoticeDecisionError) aparece aqui, nunca o erro cru.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateApi } from "@/services/karateApi";
import { RosterReviewNotice, NoticeDecisionInput } from "@/services/karateRosterReviewNoticesApi";

interface DojoOption { id: string; name: string; code: string | null }

interface Props {
  visible: boolean;
  notice: RosterReviewNotice | null;
  federationId: string;
  submitting?: boolean;
  /** Mensagem já traduzida (mapNoticeDecisionError) — nunca erro cru. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (decision: NoticeDecisionInput, note: string, destinationDojoId?: string) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function DecidirAvisoModal({
  visible, notice, federationId, submitting, error, onClose, onConfirm,
}: Props) {
  const [decision, setDecision] = useState<NoticeDecisionInput | null>(null);
  const [note, setNote] = useState("");
  const [dest, setDest] = useState<DojoOption | null>(null);
  const [query, setQuery] = useState("");
  const [dojos, setDojos] = useState<DojoOption[]>([]);
  const [loadingDojos, setLoadingDojos] = useState(false);

  useEffect(() => {
    if (visible) { setDecision(null); setNote(""); setDest(null); setQuery(""); }
  }, [visible, notice?.id]);

  const fetchDojos = useCallback(async (q: string) => {
    if (!federationId || !notice) return;
    setLoadingDojos(true);
    try {
      const res = await karateApi.listDojos(federationId, { q: q || undefined, pageSize: 50 });
      setDojos(
        (res.data || [])
          // O dojô que AVISOU nunca é destino válido (422 DESTINATION_IS_ORIGIN).
          .filter((d: any) => d.id !== notice.dojo_id)
          .map((d: any) => ({ id: d.id, name: d.name || "Dojô sem nome", code: d.fpkt_affiliation_id ?? null }))
      );
    } catch {
      setDojos([]);
    } finally {
      setLoadingDojos(false);
    }
  }, [federationId, notice]);

  // Só busca a lista de dojôs quando a transferência é escolhida — a fila
  // costuma ser decidida com "manter"/"inativar" e não precisa desse GET.
  useEffect(() => {
    if (visible && decision === "transferred" && dojos.length === 0) fetchDojos("");
  }, [visible, decision, dojos.length, fetchDojos]);

  if (!notice) return null;

  const saiu = notice.practitioner_left_dojo === true;
  const canConfirm =
    !submitting &&
    decision !== null &&
    (decision !== "transferred" || !!dest) &&
    !(saiu && decision !== "kept");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Decidir aviso</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* ── De quem é o aviso (atribuição, antes de qualquer botão) ── */}
            <View style={styles.attribution}>
              <Icon name="message" size={15} color={KarateColors.ink3} />
              <Text style={styles.attributionTxt}>
                <Text style={styles.strong}>{notice.dojo_name || "O dojô"}</Text> informou em {fmtDate(notice.reported_at)} que
                não reconhece <Text style={styles.strong}>{notice.practitioner_name || "este praticante"}</Text> como aluno atual.
                {"\n"}
                <Text style={styles.attributionNote}>
                  É o relato do sensei — não uma constatação da federação. Ele não afirma que a pessoa parou de treinar.
                </Text>
              </Text>
            </View>

            {saiu ? (
              <View style={styles.warnBox}>
                <Icon name="alert" size={15} color={KarateColors.warn} />
                <Text style={styles.warnTxt}>
                  Este praticante <Text style={styles.strong}>já não está no dojô que avisou</Text>. Provável transferência
                  já registrada. Inativar ou transferir a partir deste aviso será recusado — confira o cadastro atual
                  e, se estiver certo, escolha &quot;Manter como está&quot;.
                </Text>
              </View>
            ) : null}

            {/* ── As três decisões (manter → transferir → inativar) ── */}
            <Option
              selected={decision === "kept"}
              onPress={() => setDecision("kept")}
              icon="check_circle"
              title="Manter como está"
              desc="Você conferiu e o cadastro continua igual. Nada muda para o praticante; o aviso sai da fila."
            />
            <Option
              selected={decision === "transferred"}
              onPress={() => setDecision("transferred")}
              icon="repeat"
              title="Registrar transferência para outro dojô"
              desc="Move o praticante e grava a transferência no histórico. É o caminho quando ele mudou de dojô."
              disabled={saiu}
            />
            {decision === "transferred" ? (
              <View style={styles.destBox}>
                <Text style={styles.destLabel}>Dojô de destino</Text>
                <View style={styles.search}>
                  <Icon name="search" size={15} color={KarateColors.ink3} />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={(t) => { setQuery(t); fetchDojos(t); }}
                    placeholder="Buscar dojô por nome ou código"
                    placeholderTextColor={KarateColors.ink4}
                    accessibilityLabel="Buscar dojô de destino"
                  />
                </View>
                {loadingDojos ? (
                  <ActivityIndicator style={{ marginVertical: 10 }} color={KarateColors.primary} />
                ) : dojos.length === 0 ? (
                  <Text style={styles.destEmpty}>Nenhum dojô encontrado.</Text>
                ) : (
                  <View style={styles.destList}>
                    {dojos.slice(0, 12).map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.destRow, dest?.id === d.id && styles.destRowOn]}
                        onPress={() => setDest(d)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: dest?.id === d.id }}
                      >
                        <Text style={[styles.destName, dest?.id === d.id && styles.destNameOn]} numberOfLines={1}>{d.name}</Text>
                        {d.code ? <Text style={styles.destCode}>{d.code}</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
            <Option
              selected={decision === "inactivated"}
              onPress={() => setDecision("inactivated")}
              icon="power"
              title="Inativar o praticante"
              desc="Marca como inativo na federação. Use só depois de confirmar que ele realmente parou — o aviso do sensei, sozinho, não diz isso."
              disabled={saiu}
              danger
            />

            <View style={styles.noteWrap}>
              <Text style={styles.noteLabel}>Observação (opcional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Ex.: falei com o sensei do dojô novo, confirmado."
                placeholderTextColor={KarateColors.ink4}
                multiline
                maxLength={1000}
                accessibilityLabel="Observação da decisão"
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.danger} />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={styles.footerBtn} />
            <KarateButton
              label={submitting ? "Registrando…" : "Registrar decisão"}
              variant="sumi"
              size="md"
              loading={!!submitting}
              disabled={!canConfirm}
              onPress={() => decision && onConfirm(decision, note, dest?.id)}
              style={styles.footerBtnWide}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Option({ selected, onPress, icon, title, desc, disabled, danger }: {
  selected: boolean; onPress: () => void; icon: string; title: string; desc: string;
  disabled?: boolean; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionOn, disabled && styles.optionOff]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={title}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={11} color="#fdf8f2" /> : null}
      </View>
      <View style={styles.optionTxtWrap}>
        <View style={styles.optionTitleRow}>
          <Icon name={icon as any} size={14} color={danger ? KarateColors.danger : KarateColors.ink3} />
          <Text style={[styles.optionTitle, selected && styles.optionTitleOn]}>{title}</Text>
        </View>
        <Text style={styles.optionDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 560, maxHeight: "92%", backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  title: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  body: { maxHeight: 540 } as ViewStyle,
  bodyContent: { padding: 18, gap: 12 } as ViewStyle,

  attribution: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  attributionTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  attributionNote: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  strong: { fontWeight: "800", color: KarateColors.ink } as TextStyle,

  warnBox: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  option: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  optionOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  optionOff: { opacity: 0.45 } as ViewStyle,
  optionTxtWrap: { flex: 1 } as ViewStyle,
  optionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  optionTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  optionTitleOn: { color: KarateColors.primary } as TextStyle,
  optionDesc: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 3, lineHeight: 16 } as TextStyle,
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", marginTop: 1 } as ViewStyle,
  radioOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,

  destBox: { gap: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: KarateColors.primaryLine } as ViewStyle,
  destLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 10 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13, color: KarateColors.ink, paddingVertical: 9 } as TextStyle,
  destList: { gap: 5 } as ViewStyle,
  destRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: KarateColors.surface } as ViewStyle,
  destRowOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  destName: { flex: 1, fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  destNameOn: { color: KarateColors.primary, fontWeight: "800" } as TextStyle,
  destCode: { fontSize: 11, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  destEmpty: { fontSize: 12, color: KarateColors.ink3, paddingVertical: 6 } as TextStyle,

  noteWrap: { gap: 6 } as ViewStyle,
  noteLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  noteInput: { minHeight: 62, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.bg2, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: KarateColors.ink, textAlignVertical: "top" } as TextStyle,

  errorBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  errorTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  footerBtn: { minWidth: 100 } as ViewStyle,
  footerBtnWide: { flex: 1 } as ViewStyle,
});
