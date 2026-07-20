// ============================================================
// AlunoAssinaturaSection — seção "Mensalidade" da ficha do aluno (F3a)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// NUNCA modal aninhado; isto é um bloco inline dentro do modal existente,
// mesmo racional do GuardianPicker que já expande dentro do form).
//
// Sem assinatura: escolher plano (chips) OU valor/vencimento
// personalizados + pagador (aluno ou responsável via GuardianPicker,
// já pré-preenchido com o responsável cadastrado do aluno quando existe).
// Com assinatura: mostra plano/valor/vencimento/pagador + Cancelar
// (confirmação inline, mesmo padrão do resto da ficha).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import {
  karateDojoBillingApi, DojoBillingPlan, DojoSubscriptionListItem,
} from "@/services/karateDojoBillingApi";
import { DojoStudent, DojoStudentGuardianRef } from "@/services/karateDojoStudentsApi";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { fmtBRL, isValidDueDay, mapBillingError } from "@/components/karate/dojoMensalidades/helpers";
import { GuardianPicker } from "./GuardianPicker";

interface Props {
  federationId: string;
  student: DojoStudent;
  onChanged?: () => void;
}

export function AlunoAssinaturaSection({ federationId, student, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [plans, setPlans] = useState<DojoBillingPlan[]>([]);
  const [sub, setSub] = useState<DojoSubscriptionListItem | null>(null);

  const [form, setForm] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [customize, setCustomize] = useState(false);
  const [amountMasked, setAmountMasked] = useState("0,00");
  const [dueDay, setDueDay] = useState("");
  const [payerIsGuardian, setPayerIsGuardian] = useState(false);
  const [guardian, setGuardian] = useState<DojoStudentGuardianRef | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const [plansRes, subsRes] = await Promise.all([
        karateDojoBillingApi.listPlans(federationId),
        karateDojoBillingApi.listSubscriptions(federationId),
      ]);
      setPlans((plansRes.data ?? []).filter((p) => p.active));
      const mine = (subsRes.data ?? []).find((s) => s.student_id === student.id && !s.canceled_at) ?? null;
      setSub(mine);
    } catch (e: any) {
      setLoadErr(mapBillingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId, student.id]);

  useEffect(() => { load(); }, [load]);

  const openForm = () => {
    setPlanId(null);
    setCustomize(false);
    setAmountMasked("0,00");
    setDueDay("");
    setPayerIsGuardian(false);
    setGuardian(student.guardian);
    setSaveErr(null);
    setForm(true);
  };

  const pickPlan = (p: DojoBillingPlan) => {
    setPlanId(planId === p.id ? null : p.id);
    setAmountMasked(maskCurrency(String(Math.round(p.amount * 100))));
    setDueDay(String(p.due_day));
  };

  const submit = async () => {
    const usingPlan = !!planId && !customize;
    let amount: number | undefined;
    let day: number | undefined;
    if (!usingPlan) {
      amount = parseInt(unmaskNumber(amountMasked) || "0", 10) / 100;
      day = parseInt(dueDay, 10);
      if (!(amount > 0)) { setSaveErr("Informe um valor maior que zero."); return; }
      if (!isValidDueDay(day)) { setSaveErr("Dia de vencimento entre 1 e 28."); return; }
    }
    if (!planId && !usingPlan && !(amount! > 0)) { setSaveErr("Escolha um plano ou informe valor e vencimento."); return; }
    if (payerIsGuardian && !guardian) { setSaveErr("Escolha o responsável que vai pagar, ou volte pra \"Aluno\"."); return; }

    setSaving(true);
    setSaveErr(null);
    try {
      await karateDojoBillingApi.subscribeStudent(federationId, student.id, {
        plan_id: planId ?? undefined,
        amount,
        due_day: day,
        payer_guardian_id: payerIsGuardian ? guardian?.id ?? undefined : undefined,
      });
      setForm(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      setSaveErr(mapBillingError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await karateDojoBillingApi.cancelSubscription(federationId, student.id);
      setCancelConfirm(false);
      await load();
      onChanged?.();
    } catch {
      // silencioso — a seção fica como está, usuário pode tentar de novo
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Mensalidade</Text>

      {loading && (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator size="small" color={KarateColors.primary} />
        </View>
      )}

      {!loading && loadErr && <Text style={styles.hint}>{loadErr}</Text>}

      {!loading && !loadErr && sub && (
        <View style={{ gap: 6 }}>
          <Text style={styles.infoLine}>
            Plano: <Text style={styles.infoStrong}>{plans.find((p) => p.id === sub.plan_id)?.name ?? "Personalizado"}</Text>
          </Text>
          <Text style={styles.infoLine}>Valor: <Text style={styles.infoStrong}>{fmtBRL(sub.amount)}</Text> · vence dia {sub.due_day}</Text>
          <Text style={styles.infoLine}>
            Pagador: <Text style={styles.infoStrong}>{sub.guardian?.full_name ?? sub.student.full_name}</Text>
          </Text>

          {!cancelConfirm ? (
            <KarateButton label="Cancelar assinatura" variant="ghost" size="sm" onPress={() => setCancelConfirm(true)} style={{ alignSelf: "flex-start", marginTop: 4 }} />
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTxt}>
                Cancelar a assinatura de {student.full_name}? As cobranças já geradas continuam valendo; só o mês seguinte deixa de ser gerado.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KarateButton label="Voltar" variant="ghost" size="sm" onPress={() => setCancelConfirm(false)} style={{ flex: 1 }} />
                <KarateButton label="Cancelar assinatura" variant="primary" size="sm" onPress={doCancel} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      )}

      {!loading && !loadErr && !sub && !form && (
        <View>
          <Text style={styles.hint}>Este aluno ainda não tem mensalidade configurada.</Text>
          <KarateButton label="Assinar plano" variant="sumi" size="sm" onPress={openForm} style={{ alignSelf: "flex-start", marginTop: 6 }} />
        </View>
      )}

      {!loading && !loadErr && !sub && form && (
        <View style={{ gap: 10, marginTop: 4 }}>
          {plans.length > 0 && (
            <View>
              <Text style={styles.label}>Plano</Text>
              <View style={styles.chips}>
                {plans.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, planId === p.id && styles.chipOn]}
                    onPress={() => pickPlan(p)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: planId === p.id }}
                  >
                    <Text style={[styles.chipTxt, planId === p.id && styles.chipTxtOn]}>{p.name} · {fmtBRL(p.amount)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {planId && (
            <TouchableOpacity onPress={() => setCustomize(!customize)} accessibilityRole="button">
              <Text style={styles.linkTxt}>{customize ? "Usar valor do plano" : "Personalizar valor e vencimento"}</Text>
            </TouchableOpacity>
          )}

          {(!planId || customize) && (
            <>
              <FormField
                label="Valor (R$)"
                required
                value={amountMasked}
                onChangeText={(v) => setAmountMasked(maskCurrency(v))}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
              <FormField
                label="Dia de vencimento (1–28)"
                required
                value={dueDay}
                onChangeText={(v) => setDueDay(v.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="10"
              />
            </>
          )}

          <View>
            <Text style={styles.label}>Quem paga</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !payerIsGuardian && styles.chipOn]}
                onPress={() => setPayerIsGuardian(false)}
                accessibilityRole="radio"
                accessibilityState={{ checked: !payerIsGuardian }}
              >
                <Text style={[styles.chipTxt, !payerIsGuardian && styles.chipTxtOn]}>O aluno</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, payerIsGuardian && styles.chipOn]}
                onPress={() => setPayerIsGuardian(true)}
                accessibilityRole="radio"
                accessibilityState={{ checked: payerIsGuardian }}
              >
                <Text style={[styles.chipTxt, payerIsGuardian && styles.chipTxtOn]}>Responsável</Text>
              </TouchableOpacity>
            </View>
          </View>

          {payerIsGuardian && (
            <GuardianPicker federationId={federationId} value={guardian} onChange={setGuardian} />
          )}

          {!!saveErr && <Text style={styles.err}>{saveErr}</Text>}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setForm(false)} style={{ flex: 1 }} />
            <KarateButton label="Assinar" variant="sumi" size="sm" onPress={submit} loading={saving} style={{ flex: 2 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  infoLine: { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
  infoStrong: { fontWeight: "700", color: KarateColors.ink } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  linkTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  confirmBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, padding: 10, backgroundColor: KarateColors.glass2, marginTop: 4 } as ViewStyle,
  confirmTxt: { fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
});
