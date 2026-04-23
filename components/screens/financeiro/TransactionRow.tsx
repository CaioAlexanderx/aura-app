import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Transaction } from "./types";
import { fmt } from "./types";

function formatDate(item: Transaction): string {
  const due = (item as any).due_date;
  if (due) {
    try {
      return new Date(due).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "UTC",
      });
    } catch {}
  }
  const created = (item as any).created_at;
  if (created) {
    try {
      return new Date(created).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "America/Sao_Paulo",
      });
    } catch {}
  }
  return item.date || "---";
}

// Fallback pra transacoes antigas sem payment_method nativo no banco
function extractPayment(desc: string): string | null {
  var match = desc.match(/\((pix|cartao|debito|dinheiro|credito)\)\s*$/i);
  if (match) {
    var m = match[1].toLowerCase();
    if (m === "pix") return "Pix";
    if (m === "cartao" || m === "credito") return "Cartao";
    if (m === "debito") return "Debito";
    if (m === "dinheiro") return "Dinheiro";
  }
  return null;
}

// Mapeia payment_method nativo (vem do backend) para label + cores
var PAYMENT_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pix:      { label: "PIX",      bg: "#00968822",   text: "#009688" },
  cash:     { label: "Dinheiro", bg: Colors.greenD, text: Colors.green },
  credit:   { label: "Cartao",   bg: Colors.violetD, text: Colors.violet3 },
  debit:    { label: "Debito",   bg: Colors.amberD || "#f59e0b22", text: Colors.amber || "#f59e0b" },
  voucher:  { label: "Voucher",  bg: Colors.bg4,    text: Colors.ink3 },
  transfer: { label: "Transf.",  bg: Colors.bg4,    text: Colors.ink3 },
  boleto:   { label: "Boleto",   bg: Colors.bg4,    text: Colors.ink3 },
};

// Fallback colors pra extractPayment (legado)
var paymentColors: Record<string, { bg: string; text: string }> = {
  "Pix": { bg: "#00968822", text: "#009688" },
  "Cartao": { bg: Colors.violetD, text: Colors.violet3 },
  "Debito": { bg: Colors.amberD || "#f59e0b22", text: Colors.amber || "#f59e0b" },
  "Dinheiro": { bg: Colors.greenD, text: Colors.green },
};

export function TransactionRow({ item, onDelete, onEdit }: { item: Transaction; onDelete?: (id: string) => void; onEdit?: (tx: Transaction) => void }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const isIncome = item.type === "income";
  const sourceLabel = item.source === "pdv" ? "PDV" : item.source === "folha" ? "Folha" : item.source === "lote" ? "Lote" : "";
  const dateStr = formatDate(item);
  const isPending = item.status === "pending";

  // PRIORIDADE: usa payment_method nativo (campo novo). Se nao existir,
  // cai no fallback regex pra transacoes antigas.
  const nativePay = (item as any).payment_method ? PAYMENT_LABELS[(item as any).payment_method.toLowerCase()] : null;
  const legacyPay = !nativePay ? extractPayment(item.desc) : null;
  const legacyPc = legacyPay ? paymentColors[legacyPay] : null;

  const paymentLabel = nativePay?.label || legacyPay;
  const paymentBg = nativePay?.bg || legacyPc?.bg;
  const paymentText = nativePay?.text || legacyPc?.text;

  const employeeName = (item as any).employee_name;

  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      onPress={onEdit ? () => onEdit(item) : undefined}
      style={[s.row, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease", cursor: onEdit ? "pointer" : "default" } as any]}>
      <View style={s.left}>
        <View style={[s.dot, { backgroundColor: isIncome ? Colors.green : Colors.red }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.desc} numberOfLines={1}>{item.desc}</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>
              {dateStr} / {item.category}{sourceLabel ? " / " + sourceLabel : ""}{isPending ? " / Pendente" : ""}
            </Text>
            {paymentLabel && paymentBg && paymentText && (
              <View style={[s.payBadge, { backgroundColor: paymentBg }]}>
                <Text style={[s.payText, { color: paymentText }]}>{paymentLabel}</Text>
              </View>
            )}
            {employeeName && (
              <View style={s.empBadge}>
                <Icon name="user_plus" size={9} color={Colors.ink3} />
                <Text style={s.empText} numberOfLines={1}>{employeeName}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: isIncome ? Colors.green : Colors.red }]}>
          {isIncome ? "+" : "-"}{fmt(item.amount)}
        </Text>
        {onEdit && (
          <Pressable onPress={(e) => { e.stopPropagation?.(); onEdit(item); }} style={s.editBtn} hitSlop={8}>
            <Icon name="edit" size={12} color={Colors.violet3} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable onPress={(e) => { e.stopPropagation?.(); onDelete(item.id); }} style={s.deleteBtn} hitSlop={8}>
            <Text style={s.deleteText}>x</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  desc: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  meta: { fontSize: 11, color: Colors.ink3 },
  payBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  payText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  empBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.bg4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, maxWidth: 130 },
  empText: { fontSize: 9.5, color: Colors.ink3, fontWeight: "600" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  amount: { fontSize: 14, fontWeight: "600" },
  editBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  deleteText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
});

export default TransactionRow;
