// ============================================================
// PlanoFormModal — criar/editar plano de mensalidade (F3a)
//
// Valor com máscara de moeda (utils/masks maskCurrency/unmaskNumber —
// convenção compartilhada do app, não uma máscara local nova). Dia de
// vencimento 1–28 por TextInput numérico (chip 1..28 explodiria a UI;
// o teto em 28 evita o problema de mês curto/fevereiro).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { karateDojoBillingApi, DojoBillingPlan } from "@/services/karateDojoBillingApi";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { isValidDueDay, mapBillingError } from "./helpers";

interface Props {
  visible: boolean;
  federationId: string;
  plan: DojoBillingPlan | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanoFormModal({ visible, federationId, plan, onClose, onSaved }: Props) {
  const isEdit = !!plan;
  const [name, setName] = useState("");
  const [amountMasked, setAmountMasked] = useState("0,00");
  const [dueDay, setDueDay] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [dueDayErr, setDueDayErr] = useState<string | null>(null);
  const [generalErr, setGeneralErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNameErr(null); setAmountErr(null); setDueDayErr(null); setGeneralErr(null);
    if (plan) {
      setName(plan.name);
      setAmountMasked(maskCurrency(String(Math.round(plan.amount * 100))));
      setDueDay(String(plan.due_day));
      setActive(plan.active);
    } else {
      setName("");
      setAmountMasked("0,00");
      setDueDay("");
      setActive(true);
    }
  }, [visible, plan]);

  const validate = (): boolean => {
    let ok = true;
    if (!name.trim()) { setNameErr("Informe o nome do plano."); ok = false; } else setNameErr(null);
    const amount = parseInt(unmaskNumber(amountMasked) || "0", 10) / 100;
    if (!(amount > 0)) { setAmountErr("Informe um valor maior que zero."); ok = false; } else setAmountErr(null);
    const day = parseInt(dueDay, 10);
    if (!isValidDueDay(day)) { setDueDayErr("Dia de vencimento entre 1 e 28."); ok = false; } else setDueDayErr(null);
    return ok;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setGeneralErr(null);
    const amount = parseInt(unmaskNumber(amountMasked) || "0", 10) / 100;
    const day = parseInt(dueDay, 10);
    try {
      if (isEdit && plan) {
        await karateDojoBillingApi.updatePlan(federationId, plan.id, {
          name: name.trim(),
          amount,
          due_day: day,
          active,
        });
      } else {
        await karateDojoBillingApi.createPlan(federationId, {
          name: name.trim(),
          amount,
          due_day: day,
        });
      }
      onSaved();
    } catch (e: any) {
      const mapped = mapBillingError(e);
      if (mapped.code === "VALIDATION_ERROR" && /valor|amount/i.test(mapped.message)) setAmountErr(mapped.message);
      else if (mapped.code === "VALIDATION_ERROR" && /dia|due_day/i.test(mapped.message)) setDueDayErr(mapped.message);
      else setGeneralErr(mapped.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <Text style={s.title}>{isEdit ? "Editar plano" : "Novo plano"}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <FormField label="Nome do plano" required value={name} onChangeText={setName} placeholder="Mensalidade padrão" error={nameErr ?? undefined} />

            <FormField
              label="Valor (R$)"
              required
              value={amountMasked}
              onChangeText={(v) => setAmountMasked(maskCurrency(v))}
              keyboardType="decimal-pad"
              placeholder="0,00"
              error={amountErr ?? undefined}
            />

            <FormField
              label="Dia de vencimento (1–28)"
              required
              value={dueDay}
              onChangeText={(v) => setDueDay(v.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              placeholder="10"
              error={dueDayErr ?? undefined}
            />

            {isEdit && (
              <View>
                <Text style={s.lbl}>Situação</Text>
                <View style={s.chips}>
                  <TouchableOpacity
                    style={[s.chip, active && s.chipOn]}
                    onPress={() => setActive(true)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtOn]}>Ativo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.chip, !active && s.chipOn]}
                    onPress={() => setActive(false)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: !active }}
                  >
                    <Text style={[s.chipTxt, !active && s.chipTxtOn]}>Inativo</Text>
                  </TouchableOpacity>
                </View>
                {!active && <Text style={s.hint}>Planos inativos somem da lista de assinatura de novos alunos, mas quem já assina continua.</Text>}
              </View>
            )}

            {!!generalErr && <Text style={s.err}>{generalErr}</Text>}

            <View style={s.actions}>
              <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={onClose} style={{ flex: 1 }} />
              <KarateButton label="Salvar plano" variant="sumi" size="sm" onPress={save} loading={saving} style={{ flex: 2 }} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 440, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  title: { fontSize: 15.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  lbl: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 6, lineHeight: 15 } as TextStyle,
  err: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  actions: { flexDirection: "row", gap: 8, marginTop: 4 } as ViewStyle,
});
