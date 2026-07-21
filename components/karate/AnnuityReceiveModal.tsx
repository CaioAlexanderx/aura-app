// ============================================================
// AnnuityReceiveModal — Fase F4 · Shoji
//
// "Folha de baixa livre" da tela do recebível (mockup v2 aprovado —
// mockup-anuidade-engine-recebivel-v2.html): valor livre, atalhos de
// valor, data, as 4 formas de pagamento do Caio, e uma PRÉVIA AO VIVO da
// distribuição FIFO.
//
// 🔴 REGRA QUE NÃO PODE SER VIOLADA: a prévia (quais parcelas o valor
// cobre, saldo depois) vem SEMPRE de POST .../receive/preview. Este
// componente NUNCA recalcula a distribuição — só renderiza
// `allocations[]`/`balance_after` da resposta do backend. O motor FIFO
// mora em karateAnnuityLedger.js (aura-backend); recalcular aqui
// reintroduziria a família de bug "duas fontes divergentes" que já
// mordeu este produto (ver PR/CLAUDE.md).
//
// Diferença deliberada do mockup: o mockup mostra um aviso "o excedente
// vira crédito do dojô" quando o valor digitado > saldo. O motor REAL
// (applyAnnuityPayment) REJEITA excedente (AMOUNT_EXCEEDS_BALANCE, 422) —
// "carteira de crédito está fora de escopo" (comentário do próprio
// backend, karateAnnuityLedger.js). Aqui mostramos o erro real do
// backend, não o texto do mockup (que era só ilustrativo).
//
// Modal único (RN <Modal>), aberto direto da linha da tabela — NUNCA de
// dentro de outro <Modal> já aberto (armadilha Modal-dentro-de-Modal no
// RN Web: renderiza atrás, vira no-op silencioso). AnnuitiesTable.tsx
// garante isso fechando qualquer outro modal antes de abrir este.
//
// Prévia ao vivo: debounce de 400ms na digitação do valor/troca de forma/
// data + guard de id de requisição (reqIdRef, mesmo padrão de
// DojosListTab.tsx/CadastralTab.tsx) — descarta resposta obsoleta se o
// operador digitar rápido (condição de corrida que já mordeu esta tela
// 2x, ver instrução da tarefa).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F,
} from "@/constants/karateTheme";
import { formatIsoToBr, maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { ApiError } from "@/services/api";
import {
  karateApi, AnnuityInstallment, AnnuityPaymentMethod, AnnuityReceiveResult,
} from "@/services/karateApi";

// Os 4 métodos de anuidade do Caio — o backend ainda aceita 'transferencia'/
// 'outro' por compatibilidade (baixas legadas), mas a UI de anuidade só
// oferece estes 4 (instrução explícita da F4).
const METHODS: { key: AnnuityPaymentMethod; label: string }[] = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito_cbkt", label: "Crédito CBKT" },
  { key: "credito_exame", label: "Crédito exame/curso" },
];

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayBr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Parser tolerante de valor em pt-BR ("1.234,56" / "300" / "300,5").
function parseAmountInput(raw: string): number {
  const cleaned = String(raw).trim().replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function fmtAmountForInput(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Label de uma parcela na prévia — 'seq===0' é a convenção do backend pra
// parcela de filiação (karateAnnuityService.js: buildAdesaoInstallment ->
// { seq: 0, kind: 'filiacao' }); usamos o próprio `kind` devolvido pela
// prévia quando presente (fonte mais direta), com o seq como reforço.
function allocationLabel(kind: string, seq: number): string {
  if (kind === "filiacao" || seq === 0) return "Filiação";
  return `Parcela ${seq}`;
}

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; code: string | null }
  | { status: "ready"; result: AnnuityReceiveResult };

export interface AnnuityReceiveModalProps {
  visible: boolean;
  federationId: string;
  annuityId: string;
  name: string;
  code: string | null;
  planLabel: string | null;
  referencePeriod: string;
  /** Agregados da MESMA linha da lista (paid_total/total do backend, F3) —
   *  só exibição do "snapshot" antes da baixa; nunca usados para calcular
   *  a distribuição (isso é sempre o preview). */
  dueTotal: number;
  paidTotal: number;
  installments: AnnuityInstallment[];
  onClose: () => void;
  onSuccess: (result: AnnuityReceiveResult) => void;
}

export function AnnuityReceiveModal({
  visible, federationId, annuityId, name, code, planLabel, referencePeriod,
  dueTotal, paidTotal, installments, onClose, onSuccess,
}: AnnuityReceiveModalProps) {
  const saldo = Math.max(0, Math.round((dueTotal - paidTotal) * 100) / 100);

  const [amountText, setAmountText] = useState("0,00");
  const [dateText, setDateText] = useState(todayBr());
  const [method, setMethod] = useState<AnnuityPaymentMethod>("pix");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [confirming, setConfirming] = useState(false);

  const reqIdRef = useRef(0);
  const operationIdRef = useRef<string>("");

  // Reset por abertura — inclui um operation_id NOVO por folha aberta (não
  // por tentativa de confirmação: um retry de rede da MESMA tentativa deve
  // reusar o mesmo operation_id pra o dedup do backend funcionar).
  useEffect(() => {
    if (visible) {
      setAmountText("0,00");
      setDateText(todayBr());
      setMethod("pix");
      setActiveChip(null);
      setPreview({ status: "idle" });
      setConfirming(false);
      operationIdRef.current = `annrecv-${annuityId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      reqIdRef.current += 1; // invalida qualquer preview pendente da abertura anterior
    }
  }, [visible, annuityId]);

  const amount = parseAmountInput(amountText);
  const paidAtIso = dateText.length === 10 ? parseBrDate(dateText) : null;

  // Atalhos de valor — sugestões de PREENCHIMENTO do campo, não a
  // distribuição (a distribuição real só aparece depois, vinda do
  // preview). "Próxima parcela" usa installments já carregadas pela lista
  // (mesma fonte da tabela) — não é uma chamada nova.
  const nextParcAmount = useMemo(() => {
    const sorted = [...installments].sort((a, b) => a.seq - b.seq);
    const next = sorted.find((i) => i.status !== "paid");
    if (!next) return 0;
    const paid = (next as any).amount_paid != null ? Number((next as any).amount_paid) : 0;
    return Math.max(0, Math.round((next.amount - paid) * 100) / 100);
  }, [installments]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; value: number }[] = [];
    if (saldo > 0) list.push({ key: "full", label: "Saldo cheio", value: saldo });
    const half = Math.round((saldo / 2) * 100) / 100;
    if (half > 0 && half < saldo) list.push({ key: "half", label: "Metade", value: half });
    if (nextParcAmount > 0 && nextParcAmount !== saldo) {
      list.push({ key: "next", label: "Próxima parcela", value: nextParcAmount });
    }
    return list;
  }, [saldo, nextParcAmount]);

  const applyChip = (key: string, value: number) => {
    setActiveChip(key);
    setAmountText(fmtAmountForInput(value));
  };

  // ── Prévia ao vivo — debounce + guard de id de requisição ───────────
  useEffect(() => {
    if (!visible) return;
    if (amount <= 0) {
      setPreview({ status: "idle" });
      return;
    }
    const myReq = ++reqIdRef.current;
    setPreview({ status: "loading" });
    const t = setTimeout(async () => {
      try {
        const result = await karateApi.previewAnnuityReceive(federationId, annuityId, {
          amount,
          payment_method: method,
          paid_at: paidAtIso || undefined,
        });
        if (myReq !== reqIdRef.current) return; // resposta obsoleta — descarta
        setPreview({ status: "ready", result });
      } catch (e) {
        if (myReq !== reqIdRef.current) return;
        const err = e as ApiError;
        const code = (err as any)?.data?.code ?? null;
        const message =
          code === "AMOUNT_EXCEEDS_BALANCE"
            ? "Valor maior que o saldo em aberto deste recebível. Ajuste o valor — não é possível gerar crédito."
            : err?.message || "Não foi possível calcular a prévia agora.";
        setPreview({ status: "error", message, code });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [visible, amount, method, paidAtIso, federationId, annuityId]);

  const handleConfirm = useCallback(async () => {
    if (amount <= 0 || preview.status !== "ready" || confirming) return;
    setConfirming(true);
    try {
      const result = await karateApi.receiveAnnuityPayment(federationId, annuityId, {
        amount,
        payment_method: method,
        paid_at: paidAtIso || undefined,
        operation_id: operationIdRef.current,
      });
      toast.success(`${fmtMoney(result.amount)} recebido — ${name.split(" ")[0]}`);
      onSuccess(result);
    } catch (e) {
      const err = e as ApiError;
      const code = (err as any)?.data?.code ?? null;
      if (code === "AMOUNT_EXCEEDS_BALANCE") {
        toast.error("O saldo mudou (outra baixa pode ter acontecido). Revise o valor.");
        setPreview({ status: "error", message: "O saldo mudou — revise o valor.", code });
      } else {
        toast.error(err?.message || "Não foi possível registrar o recebimento.");
      }
    } finally {
      setConfirming(false);
    }
  }, [amount, preview.status, confirming, federationId, annuityId, method, paidAtIso, name, onSuccess]);

  const canConfirm = amount > 0 && preview.status === "ready" && !confirming;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          <View style={styles.shead}>
            <Text style={styles.eyebrow}>RECEBER PAGAMENTO</Text>
            <Text style={styles.stitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.swho}>
              {[code, planLabel, `competência ${referencePeriod}`].filter(Boolean).join(" · ")}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.sbody} keyboardShouldPersistTaps="handled">
            <View style={styles.snap}>
              <View style={styles.snapcell}>
                <Text style={styles.snapLbl}>DEVIDO</Text>
                <Text style={styles.snapVal}>{fmtMoney(dueTotal)}</Text>
              </View>
              <View style={styles.snapcell}>
                <Text style={styles.snapLbl}>JÁ RECEBIDO</Text>
                <Text style={[styles.snapVal, { color: P.ok }]}>{fmtMoney(paidTotal)}</Text>
              </View>
              <View style={[styles.snapcell, styles.snapcellSaldo]}>
                <Text style={styles.snapLbl}>SALDO</Text>
                <Text style={[styles.snapVal, styles.snapValBold]}>{fmtMoney(saldo)}</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>VALOR RECEBIDO AGORA</Text>
            <View style={styles.amtWrap}>
              <Text style={styles.amtCur}>R$</Text>
              <TextInput
                style={styles.amtInput}
                value={amountText}
                onChangeText={(t) => { setActiveChip(null); setAmountText(t); }}
                keyboardType="decimal-pad"
                accessibilityLabel="Valor recebido agora"
              />
            </View>
            {chips.length > 0 && (
              <View style={styles.chipsRow}>
                {chips.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, activeChip === c.key && styles.chipOn]}
                    onPress={() => applyChip(c.key, c.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.label}: ${fmtMoney(c.value)}`}
                  >
                    <Text style={[styles.chipLabel, activeChip === c.key && styles.chipLabelOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.field2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>DATA</Text>
                <TextInput
                  style={styles.dtInput}
                  value={dateText}
                  onChangeText={(t) => setDateText(maskBrDate(t))}
                  placeholder="dd/mm/aaaa"
                  keyboardType="number-pad"
                  accessibilityLabel="Data do recebimento"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>FORMA</Text>
            <View style={styles.methodsRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.mchip, method === m.key && styles.mchipOn]}
                  onPress={() => setMethod(m.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: method === m.key }}
                  accessibilityLabel={`Forma de pagamento ${m.label}`}
                >
                  <Text style={[styles.mchipLabel, method === m.key && styles.mchipLabelOn]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Prévia — SEMPRE o que /receive/preview devolveu, nunca recalculada aqui. */}
            <View style={styles.preview}>
              <Text style={styles.eyebrowSmall}>PRÉVIA</Text>
              {preview.status === "idle" && (
                <Text style={styles.previewHint}>Informe um valor para ver a prévia da distribuição.</Text>
              )}
              {preview.status === "loading" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                  <ActivityIndicator size="small" color={P.red} />
                  <Text style={styles.previewHint}>Calculando…</Text>
                </View>
              )}
              {preview.status === "error" && (
                <View style={styles.warnBox}>
                  <Icon name="warning" size={13} color={P.danger} />
                  <Text style={styles.warnText}>{preview.message}</Text>
                </View>
              )}
              {preview.status === "ready" && (
                <>
                  <View style={styles.pvline}>
                    <Text style={styles.pvk}>Recebendo</Text>
                    <Text style={styles.pvv}>{fmtMoney(preview.result.total_applied)}</Text>
                  </View>
                  <View style={[styles.pvline, styles.pvlineAfter]}>
                    <Text style={styles.pvk}>Saldo depois</Text>
                    <Text style={[styles.pvv, styles.pvvAfter, preview.result.balance_after <= 0.005 && { color: P.ok }]}>
                      {preview.result.balance_after <= 0.005 ? "R$ 0,00 · quitado" : fmtMoney(preview.result.balance_after)}
                    </Text>
                  </View>
                  {preview.result.allocations.length > 0 && (
                    <View style={styles.pvsplit}>
                      <Text style={styles.pvsplitLbl}>COMO O VALOR SE DISTRIBUI (MAIS ANTIGA PRIMEIRO)</Text>
                      {preview.result.allocations.map((a) => (
                        <View key={a.installment_id} style={styles.pvparc}>
                          <View
                            style={[
                              styles.pvdot,
                              { backgroundColor: a.status_after === "paid" ? P.ok : P.warn },
                            ]}
                          />
                          <Text style={styles.pvparcTxt} numberOfLines={1}>
                            {allocationLabel(a.kind, a.seq)} · {fmtMoney(a.amount_applied)}
                          </Text>
                          <Text style={styles.pvparcDue}>
                            {a.due_date ? `venc ${formatIsoToBr(a.due_date)}` : "sem vencimento"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.sfoot}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancelar">
              <Text style={styles.btnGhostLabel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, !canConfirm && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirmar recebimento"
            >
              {confirming ? (
                <ActivityIndicator size="small" color="#fdf8f2" />
              ) : (
                <Text style={styles.btnPrimaryLabel}>Confirmar recebimento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.5)", justifyContent: "flex-end" } as ViewStyle,
  sheet: {
    backgroundColor: P.paperWarm, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    maxHeight: "92%" as any, borderWidth: 1, borderColor: C.line2, borderBottomWidth: 0,
    ...Platform.select({ web: { maxWidth: 520, alignSelf: "center", width: "100%" } as any, default: {} }),
  } as ViewStyle,

  shead: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: 1.4, color: P.red, fontWeight: "600" } as TextStyle,
  stitle: { fontFamily: F.heading, fontSize: 19, color: C.ink, marginTop: 4 } as TextStyle,
  swho: { fontFamily: F.mono, fontSize: 11.5, color: C.ink3, marginTop: 3 } as TextStyle,

  sbody: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 8, gap: 4 } as ViewStyle,

  snap: { flexDirection: "row", gap: 8, marginBottom: 16 } as ViewStyle,
  snapcell: { flex: 1, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.sm, paddingVertical: 9, paddingHorizontal: 8, alignItems: "center" } as ViewStyle,
  snapcellSaldo: { backgroundColor: P.glassHi } as ViewStyle,
  snapLbl: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.8, color: C.ink3 } as TextStyle,
  snapVal: { fontFamily: F.mono, fontSize: 14, color: C.ink, marginTop: 3, fontWeight: "500" } as TextStyle,
  snapValBold: { fontWeight: "700" } as TextStyle,

  fieldLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, color: C.ink2, marginBottom: 6, marginTop: 6 } as TextStyle,

  amtWrap: { position: "relative", marginBottom: 8, justifyContent: "center" } as ViewStyle,
  amtCur: { position: "absolute", left: 15, fontFamily: F.heading, fontSize: 18, color: C.ink3, zIndex: 1 } as TextStyle,
  amtInput: {
    fontFamily: F.mono, fontSize: 22, fontWeight: "500", paddingVertical: 12, paddingLeft: 40, paddingRight: 14,
    borderWidth: 1.5, borderColor: C.line2, borderRadius: R.lg, backgroundColor: P.glass, color: C.ink,
  } as TextStyle,

  chipsRow: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginBottom: 12 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,
  chipOn: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  chipLabel: { fontFamily: F.body, fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  chipLabelOn: { color: "#fdf8f2" } as TextStyle,

  field2: { flexDirection: "row", gap: 12, marginBottom: 4 } as ViewStyle,
  dtInput: { fontFamily: F.mono, fontSize: 14, paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, backgroundColor: P.glass, color: C.ink } as TextStyle,

  methodsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 14 } as ViewStyle,
  mchip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass } as ViewStyle,
  mchipOn: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  mchipLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  mchipLabelOn: { color: P.paperWarm } as TextStyle,

  preview: { backgroundColor: P.paper2, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, padding: 13, marginBottom: 8 } as ViewStyle,
  eyebrowSmall: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: P.red, fontWeight: "600", marginBottom: 8 } as TextStyle,
  previewHint: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: P.dangerWash, borderWidth: 1, borderColor: "rgba(161,61,51,0.32)", borderRadius: R.sm, padding: 10 } as ViewStyle,
  warnText: { flex: 1, fontFamily: F.body, fontSize: 11.5, color: P.danger, lineHeight: 16 } as TextStyle,

  pvline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 } as ViewStyle,
  pvk: { fontFamily: F.mono, fontSize: 12.5, color: C.ink2 } as TextStyle,
  pvv: { fontFamily: F.mono, fontSize: 12.5, fontWeight: "500", color: C.ink } as TextStyle,
  pvlineAfter: { borderTopWidth: 1, borderTopColor: C.line2, marginTop: 6, paddingTop: 9 } as ViewStyle,
  pvvAfter: { fontSize: 13.5, fontWeight: "700" } as TextStyle,

  pvsplit: { marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: C.line2, gap: 4 } as ViewStyle,
  pvsplitLbl: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, color: C.ink3, marginBottom: 3 } as TextStyle,
  pvparc: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  pvdot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 } as ViewStyle,
  pvparcTxt: { flex: 1, fontFamily: F.mono, fontSize: 11.5, color: C.ink2 } as TextStyle,
  pvparcDue: { fontFamily: F.mono, fontSize: 10.5, color: C.ink3 } as TextStyle,

  sfoot: { flexDirection: "row", gap: 10, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18 } as ViewStyle,
  btnGhost: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: "transparent" } as ViewStyle,
  btnGhostLabel: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: C.ink2 } as TextStyle,
  btnPrimary: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: R.md, backgroundColor: P.red } as ViewStyle,
  btnDisabled: { opacity: 0.45 } as ViewStyle,
  btnPrimaryLabel: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: "#fdf8f2" } as TextStyle,
});
