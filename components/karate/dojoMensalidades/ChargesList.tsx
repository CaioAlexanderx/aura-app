// ============================================================
// ChargesList — lista de cobranças do mês (F3a)
//
// Busca por aluno + filtro de status (client-side — a lista já vem
// filtrada por competência do backend). Linha: aluno, responsável
// (quando houver), valor, vencimento, badge de status. Ações por linha:
// Pix, Confirmar pagamento, Cancelar — cedidas pelo pai (CobrancasTab)
// via callback, que também é dono dos modais (irmãos, nunca aninhados).
// ============================================================
import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { DojoCharge, DojoChargeStatus } from "@/services/karateDojoBillingApi";
import { chargeStatusView, fmtBRL, fmtDateBR } from "./helpers";

type StatusFilter = "all" | DojoChargeStatus;

const STATUS_TABS: [StatusFilter, string][] = [
  ["all", "Todas"],
  ["pending", "Pendentes"],
  ["overdue", "Vencidas"],
  ["paid", "Pagas"],
  ["cancelled", "Canceladas"],
];

interface Props {
  charges: DojoCharge[];
  onOpenPix: (charge: DojoCharge) => void;
  onOpenConfirm: (charge: DojoCharge) => void;
  onOpenCancel: (charge: DojoCharge) => void;
}

export function ChargesList({ charges, onOpenPix, onOpenConfirm, onOpenCancel }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const list = useMemo(() => {
    return charges.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (q.trim()) {
        const hay = `${c.student.full_name} ${c.guardian?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [charges, q, status]);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.search}>
        <Icon name="search" size={16} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por aluno ou responsável"
          placeholderTextColor={KarateColors.ink4}
        />
      </View>

      <View style={styles.filters}>
        {STATUS_TABS.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.chipBtn, status === key && styles.chipBtnOn]}
            onPress={() => setStatus(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: status === key }}
          >
            <Text style={[styles.chipBtnTxt, status === key && styles.chipBtnTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {list.map((c) => {
        const sv = chargeStatusView(c.status);
        const canPix = c.status === "pending" || c.status === "overdue";
        const canConfirm = c.status === "pending" || c.status === "overdue";
        const canCancel = c.status === "pending" || c.status === "overdue";
        return (
          <View key={c.id} style={styles.row}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={styles.nome} numberOfLines={1}>{c.student.full_name}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {c.guardian ? `Resp.: ${c.guardian.full_name}` : "Sem responsável — cobra do aluno"}
              </Text>
            </View>

            <View style={styles.valorBox}>
              <Text style={styles.valor}>{fmtBRL(c.amount)}</Text>
              <Text style={styles.venc}>Vence {fmtDateBR(c.due_date)}</Text>
            </View>

            <View style={[styles.statusChip, { backgroundColor: sv.bg }]}>
              <Icon name={sv.icon as any} size={12} color={sv.color} />
              <Text style={[styles.statusTxt, { color: sv.color }]}>{sv.label}</Text>
            </View>

            <View style={styles.actions}>
              {canPix && (
                <TouchableOpacity style={styles.actBtn} onPress={() => onOpenPix(c)} accessibilityRole="button" accessibilityLabel="Cobrar por Pix">
                  <Icon name="qr_code" size={15} color={KarateColors.primary} />
                </TouchableOpacity>
              )}
              {canConfirm && (
                <TouchableOpacity style={styles.actBtn} onPress={() => onOpenConfirm(c)} accessibilityRole="button" accessibilityLabel="Confirmar pagamento">
                  <Icon name="check" size={15} color={KarateColors.ok} />
                </TouchableOpacity>
              )}
              {canCancel && (
                <TouchableOpacity style={styles.actBtn} onPress={() => onOpenCancel(c)} accessibilityRole="button" accessibilityLabel="Cancelar cobrança">
                  <Icon name="x" size={15} color={KarateColors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {list.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="search" size={20} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhuma cobrança com esses filtros.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, paddingVertical: 11 } as TextStyle,
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chipBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipBtnOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipBtnTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipBtnTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  row: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12,
  } as ViewStyle,
  nome: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  valorBox: { alignItems: "flex-end", minWidth: 96 } as ViewStyle,
  valor: { fontSize: 13.5, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  venc: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  actions: { flexDirection: "row", gap: 6 } as ViewStyle,
  actBtn: {
    width: 30, height: 30, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border,
  } as ViewStyle,

  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 30 } as ViewStyle,
  stateTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
});
