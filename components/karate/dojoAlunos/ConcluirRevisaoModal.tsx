// ============================================================
// ConcluirRevisaoModal — F11.3 (dojô): fechar a revisão do plantel
//
// ── ⚠️ A REGRA QUE ESTE MODAL EXISTE PARA PROTEGER ──────────
// Concluir a revisão NÃO INATIVA NINGUÉM. Ela envia AVISOS para a
// federação — "não reconheço esta pessoa como aluno atual" — e é a
// federação quem decide entre inativar, transferir ou manter (a pessoa
// pode ter MUDADO DE DOJÔ). Este modal é o último lugar onde o sensei lê
// o que vai acontecer, então é aqui que a frase precisa ser exata: em
// nenhum ponto ele diz "inativar", "excluir" ou "remover".
//
// ── O PENDENTE NUNCA VIRA "NÃO RECONHECIDO" POR OMISSÃO ─────
// Se ainda houver praticante SEM MARCAÇÃO, o backend recusa a conclusão
// (409 REVISAO_INCOMPLETA) até receber uma `pending_policy` explícita.
// Aqui isso vira uma escolha com TRÊS saídas e NENHUM default marcado:
//   • voltar e marcar os que faltam (cancelar);
//   • declarar que os restantes treinam com ele  → 'recognized';
//   • declarar que os restantes não são alunos dele → 'not_recognized'.
// O botão de confirmar fica desabilitado até ele escolher. "Não revisado"
// e "não reconhecido" são estados diferentes — e a diferença entre eles é
// um aviso a mais (ou a menos) na mesa da federação.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { RosterSummary, RosterPendingPolicy } from "@/services/karateDojoRosterReviewApi";

interface Props {
  visible: boolean;
  summary: RosterSummary;
  submitting?: boolean;
  /** Mensagem já traduzida (mapRosterReviewError) — nunca erro cru. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (pendingPolicy?: RosterPendingPolicy) => void;
}

export function ConcluirRevisaoModal({
  visible, summary, submitting, error, onCancel, onConfirm,
}: Props) {
  // SEM default: a política do pendente é uma escolha explícita, não uma
  // caixinha já marcada que o sensei confirma sem ler.
  const [policy, setPolicy] = useState<RosterPendingPolicy | null>(null);

  useEffect(() => {
    if (visible) setPolicy(null);
  }, [visible]);

  const pending = summary.pending;
  const hasPending = pending > 0;
  // Quantos avisos a federação vai receber COM a escolha atual — o número
  // muda na tela conforme ele escolhe, antes de confirmar.
  const avisos = summary.not_recognized + (hasPending && policy === "not_recognized" ? pending : 0);
  const canConfirm = !submitting && (!hasPending || policy !== null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Concluir revisão do plantel</Text>
            <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Os números, sem eufemismo */}
            <View style={styles.numbers}>
              <NumberCell label="No plantel" value={summary.inherited_total} />
              <NumberCell label="Treinam aqui" value={summary.recognized} tone="ok" />
              <NumberCell label="Não reconheço" value={summary.not_recognized} tone="warn" />
              <NumberCell label="Sem marcação" value={pending} tone={hasPending ? "warn" : "neutral"} />
            </View>

            {/* ⚠️ O que a conclusão FAZ e o que ela NÃO faz. */}
            <View style={styles.explain}>
              <Text style={styles.explainTitle}>O que acontece ao concluir</Text>
              <Bullet icon="send">
                A federação recebe <Text style={styles.strong}>um aviso por praticante que você não reconheceu</Text>,
                dizendo que ele não é seu aluno atual.
              </Bullet>
              <Bullet icon="shield">
                <Text style={styles.strong}>Ninguém é inativado nem excluído.</Text> O cadastro dos praticantes na
                federação continua exatamente como está.
              </Bullet>
              <Bullet icon="repeat">
                Quem decide é a federação: ela pode registrar uma transferência (se a pessoa mudou de dojô),
                inativar ou manter.
              </Bullet>
            </View>

            {/* Pendentes: escolha explícita, sem default */}
            {hasPending && (
              <View style={styles.pendingBox}>
                <View style={styles.pendingHead}>
                  <Icon name="alert" size={16} color={KarateColors.warn} />
                  <Text style={styles.pendingTitle}>
                    {pending} {pending === 1 ? "praticante ainda sem marcação" : "praticantes ainda sem marcação"}
                  </Text>
                </View>
                <Text style={styles.pendingSub}>
                  &quot;Sem marcação&quot; não é &quot;não reconheço&quot;. Diga o que fazer com {pending === 1 ? "ele" : "eles"} —
                  ou volte e marque um a um.
                </Text>

                <PolicyOption
                  selected={policy === "recognized"}
                  onPress={() => setPolicy("recognized")}
                  title={`Todos ${pending === 1 ? "o restante treina" : "os restantes treinam"} comigo`}
                  desc="Nenhum aviso é gerado por eles."
                />
                <PolicyOption
                  selected={policy === "not_recognized"}
                  onPress={() => setPolicy("not_recognized")}
                  title={`Não reconheço ${pending === 1 ? "o restante" : "os restantes"} como ${pending === 1 ? "meu aluno" : "meus alunos"}`}
                  desc={`Vira aviso para a federação conferir — mais ${pending} ${pending === 1 ? "aviso" : "avisos"}.`}
                />
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={onCancel}
                  accessibilityRole="button"
                >
                  <Icon name="arrow_left" size={13} color={KarateColors.primary} />
                  <Text style={styles.backLinkTxt}>Voltar e marcar quem falta</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Prévia do efeito, com a política já escolhida */}
            <View style={styles.preview}>
              <Icon name="info" size={15} color={KarateColors.ink3} />
              <Text style={styles.previewTxt}>
                {avisos === 0
                  ? "Nenhum aviso será enviado — você reconheceu todo o plantel."
                  : `A federação vai receber ${avisos} ${avisos === 1 ? "aviso" : "avisos"} para conferir.`}
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert_circle" size={15} color={KarateColors.danger} />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onCancel} style={styles.footerBtn} />
            <KarateButton
              label={submitting ? "Enviando…" : "Concluir e avisar a federação"}
              variant="sumi"
              size="md"
              loading={!!submitting}
              disabled={!canConfirm}
              onPress={() => onConfirm(hasPending ? (policy ?? undefined) : undefined)}
              style={styles.footerBtnWide}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NumberCell({ label, value, tone = "neutral" }: {
  label: string; value: number; tone?: "ok" | "warn" | "neutral";
}) {
  const color =
    tone === "ok" ? KarateColors.ok : tone === "warn" ? KarateColors.warn : KarateColors.ink;
  return (
    <View style={styles.numCell}>
      <Text style={[styles.numVal, { color }]}>{value}</Text>
      <Text style={styles.numLabel}>{label}</Text>
    </View>
  );
}

function Bullet({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Icon name={icon as any} size={14} color={KarateColors.ink3} />
      <Text style={styles.bulletTxt}>{children}</Text>
    </View>
  );
}

function PolicyOption({ selected, onPress, title, desc }: {
  selected: boolean; onPress: () => void; title: string; desc: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={11} color="#fdf8f2" /> : null}
      </View>
      <View style={styles.optionTxtWrap}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleOn]}>{title}</Text>
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
  body: { maxHeight: 520 } as ViewStyle,
  bodyContent: { padding: 18, gap: 14 } as ViewStyle,

  numbers: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  numCell: { flexGrow: 1, flexBasis: 110, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, paddingVertical: 10, paddingHorizontal: 12 } as ViewStyle,
  numVal: { fontSize: 20, fontWeight: "800", fontFamily: "monospace" } as TextStyle,
  numLabel: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  explain: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  explainTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  bullet: { flexDirection: "row", gap: 8, alignItems: "flex-start" } as ViewStyle,
  bulletTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  strong: { fontWeight: "800", color: KarateColors.ink } as TextStyle,

  pendingBox: { backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  pendingHead: { flexDirection: "row", alignItems: "center", gap: 7 } as ViewStyle,
  pendingTitle: { flex: 1, fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  pendingSub: { fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,

  option: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  optionOn: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  optionTxtWrap: { flex: 1 } as ViewStyle,
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", marginTop: 1 } as ViewStyle,
  radioOn: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  optionTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  optionTitleOn: { color: KarateColors.primary } as TextStyle,
  optionDesc: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2, lineHeight: 16 } as TextStyle,

  backLink: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 } as ViewStyle,
  backLinkTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  preview: { flexDirection: "row", gap: 8, alignItems: "flex-start" } as ViewStyle,
  previewTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  errorBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  errorTxt: { flex: 1, fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  footerBtn: { minWidth: 100 } as ViewStyle,
  footerBtnWide: { flex: 1 } as ViewStyle,
});
