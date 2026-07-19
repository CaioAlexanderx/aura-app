// ============================================================
// AlunoFichaModal — ficha do aluno do dojô (F2; seção Mensalidade F3a)
//
// Dados + responsável + ações: Editar (delega pro AlunoFormModal via
// onEdit), Inativar/Reativar (PATCH status) e Excluir (DELETE real na
// F2 — o aviso deixa claro que é definitivo; quando a F3 criar
// cobranças o backend passa a responder 409 HAS_HISTORY).
//
// F3a: seção "Mensalidade" (AlunoAssinaturaSection) — assinar plano,
// ver assinatura ativa, cancelar. Sub-componente inline (nunca modal
// aninhado — mesmo racional do GuardianPicker já usado aqui dentro).
//
// Confirmações INLINE dentro do próprio modal (mesmo padrão askConfirm
// da tela de carteirinhas) — o ConfirmHost global não está montado no
// grupo (dojo), então nada de confirmAsync aqui.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { karateDojoStudentsApi, DojoStudent } from "@/services/karateDojoStudentsApi";
import { beltViewFor, isoToBR, maskCpf, mapStudentSaveError } from "./helpers";
import { AlunoAssinaturaSection } from "./AlunoAssinaturaSection";

interface Props {
  visible: boolean;
  federationId: string;
  /** Seed vindo da lista; a ficha refaz o GET pra vir completa (guardian c/ cpf/email). */
  student: DojoStudent | null;
  onClose: () => void;
  onEdit: (s: DojoStudent) => void;
  onChanged: () => void;
}

const SEX_LABEL: Record<string, string> = { M: "Masculino", F: "Feminino", other: "Outro" };

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

export function AlunoFichaModal({ visible, federationId, student, onClose, onEdit, onChanged }: Props) {
  const [full, setFull] = useState<DojoStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<null | "inactivate" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    setErr(null);
    try {
      setFull(await karateDojoStudentsApi.getStudent(federationId, student.id));
    } catch {
      setFull(student); // GET falhou → a ficha cai no dado da lista
    } finally {
      setLoading(false);
    }
  }, [federationId, student]);

  useEffect(() => {
    if (visible) {
      setFull(null);
      setConfirm(null);
      setErr(null);
      load();
    }
  }, [visible, load]);

  const s = full ?? student;

  const setStatus = async (status: "active" | "inactive") => {
    if (!s) return;
    setBusy(true);
    setErr(null);
    try {
      const upd = await karateDojoStudentsApi.updateStudent(federationId, s.id, { status });
      setFull(upd);
      setConfirm(null);
      onChanged();
    } catch (e: any) {
      setErr(mapStudentSaveError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!s) return;
    setBusy(true);
    setErr(null);
    try {
      await karateDojoStudentsApi.deleteStudent(federationId, s.id);
      onChanged();
      onClose();
    } catch (e: any) {
      setErr(mapStudentSaveError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const belt = s ? beltViewFor(s.belt_label) : null;
  const minor = s?.age != null && s.age < 18;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.headTitle} numberOfLines={1}>{s?.full_name ?? "Ficha do aluno"}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.closeBtn}>
              <Icon name="close" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          {!s || loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={KarateColors.primary} />
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
              <View style={styles.badges}>
                {belt && (
                  <View style={[styles.chip, { backgroundColor: belt.color }]}>
                    <Text style={[styles.chipTxt, { color: belt.textColor }]}>{belt.label}</Text>
                  </View>
                )}
                <View style={[styles.statusChip, s.status === "active" ? styles.statusOk : styles.statusOff]}>
                  <Icon
                    name={s.status === "active" ? "checkmark-circle" : "close-circle"}
                    size={13}
                    color={s.status === "active" ? KarateColors.ok : KarateColors.ink3}
                  />
                  <Text style={[styles.statusTxt, { color: s.status === "active" ? KarateColors.ok : KarateColors.ink3 }]}>
                    {s.status === "active" ? "Ativo" : "Inativo"}
                  </Text>
                </View>
              </View>

              <InfoRow label="Nascimento" value={s.birth_date ? `${isoToBR(s.birth_date)}${s.age != null ? ` · ${s.age} anos` : ""}` : null} />
              <InfoRow label="CPF" value={s.cpf ? maskCpf(s.cpf) : null} />
              <InfoRow label="Sexo" value={s.sex ? SEX_LABEL[s.sex] ?? s.sex : null} />
              <InfoRow label="Telefone" value={s.phone} />
              <InfoRow label="E-mail" value={s.email} />
              <InfoRow label="Início no dojô" value={s.enrolled_at ? isoToBR(s.enrolled_at) : null} />
              <InfoRow label="Consentimento LGPD" value={s.consent_lgpd ? "Registrado" : "Não registrado"} />
              {!!s.notes && <InfoRow label="Observações" value={s.notes} />}

              <View style={styles.guardianBox}>
                <Text style={styles.guardianTitle}>Responsável{minor ? " · obrigatório (menor de 18)" : ""}</Text>
                {s.guardian ? (
                  <>
                    <Text style={styles.guardianName}>{s.guardian.full_name ?? "—"}</Text>
                    <Text style={styles.guardianMeta}>
                      {[
                        s.guardian.relationship,
                        s.guardian.phone,
                        s.guardian.cpf ? `CPF ${maskCpf(s.guardian.cpf)}` : null,
                        s.guardian.email ?? null,
                      ].filter(Boolean).join(" · ") || "Sem contato informado"}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.guardianMeta}>{minor ? "Nenhum responsável vinculado — vincule pelo Editar." : "Nenhum responsável vinculado."}</Text>
                )}
              </View>

              <AlunoAssinaturaSection federationId={federationId} student={s} onChanged={onChanged} />

              {!!err && <Text style={styles.err}>{err}</Text>}

              {confirm === null && (
                <View style={styles.actions}>
                  <KarateButton label="Editar" variant="sumi" size="md" onPress={() => onEdit(s)} style={{ flex: 1 }} />
                  {s.status === "active" ? (
                    <KarateButton label="Inativar" variant="secondary" size="md" onPress={() => setConfirm("inactivate")} style={{ flex: 1 }} />
                  ) : (
                    <KarateButton label="Reativar" variant="secondary" size="md" onPress={() => setStatus("active")} loading={busy} style={{ flex: 1 }} />
                  )}
                  <KarateButton label="Excluir" variant="ghost" size="md" onPress={() => setConfirm("delete")} style={{ flex: 1 }} />
                </View>
              )}

              {confirm === "inactivate" && (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmTxt}>
                    Inativar {s.full_name}? O aluno sai da pirâmide de faixas e das listas de ativos, mas o cadastro fica guardado — dá para reativar quando quiser.
                  </Text>
                  <View style={styles.actions}>
                    <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                    <KarateButton label="Inativar aluno" variant="sumi" size="sm" onPress={() => setStatus("inactive")} loading={busy} style={{ flex: 1 }} />
                  </View>
                </View>
              )}

              {confirm === "delete" && (
                <View style={[styles.confirmBox, styles.confirmBoxDanger]}>
                  <Text style={styles.confirmTxt}>
                    Excluir é definitivo: o cadastro de {s.full_name} some do dojô e não tem como recuperar. Se a ideia é só pausar, prefira Inativar.
                  </Text>
                  <View style={styles.actions}>
                    <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                    <KarateButton label="Excluir definitivamente" variant="primary" size="sm" onPress={doDelete} loading={busy} style={{ flex: 1 }} />
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 560, maxHeight: "92%", backgroundColor: "#fdf8f2", borderRadius: 16, overflow: "hidden" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  stateBox: { alignItems: "center", justifyContent: "center", paddingVertical: 48 } as ViewStyle,
  body: { padding: 16, gap: 10 } as ViewStyle,
  badges: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 } as ViewStyle,
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  chipTxt: { fontSize: 11, fontWeight: "800" } as TextStyle,
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  statusOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  statusOff: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  infoLabel: { width: 130, fontSize: 12, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  infoValue: { flex: 1, fontSize: 13, color: KarateColors.ink, lineHeight: 18 } as TextStyle,
  guardianBox: { gap: 3, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  guardianTitle: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  guardianName: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  guardianMeta: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  err: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  actions: { flexDirection: "row", gap: 8, marginTop: 6 } as ViewStyle,
  confirmBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.glass2, marginTop: 6 } as ViewStyle,
  confirmBoxDanger: { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.dangerSoft } as ViewStyle,
  confirmTxt: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
});
