// ============================================================
// AnnuityStatementModal — Fase F4 · Shoji
//
// Extrato de uma anuidade (dojô ou praticante): consome GET .../payments
// (ledger karate_annuity_payments, F3) e lista as baixas — valor, data,
// forma, parcela. Mais recente primeiro (já vem ordenado do backend,
// `paid_at DESC, created_at DESC` — não reordenamos aqui).
//
// Datas: SEMPRE por regex sobre a string ISO — NUNCA `new Date(iso)` (o
// motivo, documentado na tarefa: `new Date('YYYY-MM-DD')` interpreta meia-
// noite UTC, que em horário de Brasília (UTC-3) já é o dia anterior às
// 21h — "volta um dia"). `paid_at`/`created_at` aqui são timestamptz
// completos (com hora), então o mesmo cuidado vale: extraímos ano/mês/dia/
// hora/minuto por regex direto da string, sem nunca instanciar Date.
//
// "Quem" registrou: o ledger (`created_by`) só traz o id bruto do usuário
// — este endpoint não faz o join pro nome (diferente de
// GET /financial/audit, que resolve `actor_label` server-side pra outro
// propósito). Por isso mostramos só presença/ausência de operador, não um
// nome — documentado explicitamente no PR como uma simplificação
// conhecida, não um dado inventado.
//
// Modal único (RN <Modal>), sempre aberto/fechado sozinho — AnnuitiesTable
// garante que nenhum outro modal fica montado ao mesmo tempo (armadilha
// Modal-dentro-de-Modal).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, AnnuityPaymentLedgerEntry } from "@/services/karateApi";

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  credito_cbkt: "Crédito CBKT",
  credito_exame: "Crédito exame/curso",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};
function methodLabel(m: string | null): string {
  if (!m) return "—";
  return METHOD_LABEL[m] ?? m;
}

function kindLabel(kind: string, seq: number): string {
  if (kind === "filiacao" || seq === 0) return "Filiação";
  return `Parcela ${seq}`;
}

// Regex puro sobre a string ISO — nunca `new Date(iso)` (ver comentário do
// topo do arquivo). Aceita 'YYYY-MM-DDTHH:MM' ou 'YYYY-MM-DD HH:MM' com
// qualquer sufixo de segundos/offset depois.
function fmtPaidAt(iso: string): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso || ""));
  if (!m) return { date: String(iso || "—"), time: "" };
  return { date: `${m[3]}/${m[2]}/${m[1]}`, time: `${m[4]}:${m[5]}` };
}

interface AnnuityStatementModalProps {
  visible: boolean;
  federationId: string;
  annuityId: string;
  name: string;
  onClose: () => void;
}

export function AnnuityStatementModal({ visible, federationId, annuityId, name, onClose }: AnnuityStatementModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entries, setEntries] = useState<AnnuityPaymentLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getAnnuityPayments(federationId, annuityId);
      setEntries(res.data);
      setTotal(res.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, annuityId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          <View style={styles.shead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>EXTRATO</Text>
              <Text style={styles.stitle} numberOfLines={1}>{name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar extrato" hitSlop={8}>
              <Icon name="x" size={20} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sbody}>
            {loading ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <ActivityIndicator size="small" color={P.red} />
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Não foi possível carregar o extrato agora.</Text>
                <TouchableOpacity onPress={load} accessibilityRole="button" accessibilityLabel="Tentar novamente">
                  <Text style={styles.retryLabel}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : entries.length === 0 ? (
              <View style={{ paddingVertical: 24 }}>
                <Text style={styles.emptyText}>Nenhuma baixa registrada ainda para este recebível.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.totalLine}>
                  {entries.length} {entries.length === 1 ? "baixa" : "baixas"} · total {fmtMoney(total)}
                </Text>
                <View style={{ gap: 8 }}>
                  {entries.map((e) => {
                    const when = fmtPaidAt(e.paid_at);
                    return (
                      <View key={e.id} style={styles.entryRow}>
                        <View style={styles.entryDot} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                            <Text style={styles.entryKind}>{kindLabel(e.kind, e.seq)}</Text>
                            <Text style={styles.entryAmount}>{fmtMoney(e.amount)}</Text>
                          </View>
                          <Text style={styles.entryMeta}>
                            {when.date}{when.time ? ` às ${when.time}` : ""} · {methodLabel(e.payment_method)}
                            {e.created_by ? " · registrado manualmente" : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.5)", justifyContent: "flex-end" } as ViewStyle,
  sheet: {
    backgroundColor: P.paperWarm, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    maxHeight: "85%" as any, borderWidth: 1, borderColor: C.line2, borderBottomWidth: 0,
    ...Platform.select({ web: { maxWidth: 480, alignSelf: "center", width: "100%" } as any, default: {} }),
  } as ViewStyle,
  shead: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line,
  } as ViewStyle,
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: 1.4, color: P.red, fontWeight: "600" } as TextStyle,
  stitle: { fontFamily: F.heading, fontSize: 18, color: C.ink, marginTop: 4 } as TextStyle,

  sbody: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26 } as ViewStyle,
  totalLine: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginBottom: 12 } as TextStyle,

  entryRow: { flexDirection: "row", gap: 10, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12 } as ViewStyle,
  entryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok, marginTop: 5 } as ViewStyle,
  entryKind: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  entryAmount: { fontFamily: F.mono, fontSize: 13, fontWeight: "700", color: P.ok } as TextStyle,
  entryMeta: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 3 } as TextStyle,

  errorBox: { paddingVertical: 24, alignItems: "center", gap: 10 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: C.ink2, textAlign: "center" } as TextStyle,
  retryLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.red } as TextStyle,
  emptyText: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center" } as TextStyle,
});
