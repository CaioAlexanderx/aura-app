// ============================================================
// AURA. — PDV · Troca v2 · SplitForm
// Componente parametrizável que serve para:
//   - PaymentSplitForm: cliente paga a diferença (netAmount > 0)
//     Métodos: dinheiro | pix | cartao_credito | cartao_debito
//   - RefundSplitForm: loja devolve dinheiro (netAmount < 0)
//     Métodos: dinheiro | pix | cartao_estorno | crediario_credito | vale
//
// Ambos compartilham:
//   - Linhas {method, amount} editáveis
//   - Botão "+ Adicionar forma"
//   - Validação visual da soma vs target (✓ ok / ✗ falta R$ X)
//   - Card especial no Refund: "Crédito para próxima compra"
//     que adiciona automaticamente uma linha crediario_credito.
//
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Platform } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type {
  PaymentSplit, RefundSplit, PaymentMethod, RefundMethod,
} from "./types";
import { fmtBRL } from "./types";

const IS_WEB = Platform.OS === "web";

// ─── Method labels ────────────────────────────────────────────
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; emoji: string }> = {
  dinheiro:        { label: "Dinheiro",       emoji: "💵" },
  pix:             { label: "Pix",            emoji: "📱" },
  cartao_credito:  { label: "Cartão Crédito", emoji: "💳" },
  cartao_debito:   { label: "Cartão Débito",  emoji: "💳" },
};

const REFUND_METHOD_LABELS: Record<RefundMethod, { label: string; emoji: string }> = {
  dinheiro:           { label: "Dinheiro do caixa",      emoji: "💵" },
  pix:                { label: "Pix de estorno",          emoji: "📱" },
  cartao_estorno:     { label: "Estorno no cartão",       emoji: "💳" },
  crediario_credito:  { label: "Crédito p/ próx. compra", emoji: "🎁" },
  vale:               { label: "Vale-troca (papel)",      emoji: "🧾" },
};

// ─── Helpers compartilhados ──────────────────────────────────
function parseAmount(input: string): number {
  // Aceita "10,50" ou "10.50" — converte vírgula
  const cleaned = String(input || "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function formatAmountInput(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

// ─── PaymentSplitForm ─────────────────────────────────────────
type PaymentProps = {
  splits: PaymentSplit[];
  onChange: (next: PaymentSplit[]) => void;
  target: number; // valor a ser distribuído (netAmount > 0)
};

export function PaymentSplitForm({ splits, onChange, target }: PaymentProps) {
  const distributed = useMemo(
    () => splits.reduce((s, p) => s + (p.amount || 0), 0),
    [splits]
  );
  const remaining = parseFloat((target - distributed).toFixed(2));
  const matches = Math.abs(remaining) < 0.005;
  const overshoot = remaining < -0.005;

  function addRow() {
    onChange([
      ...splits,
      { method: "pix", amount: Math.max(0, remaining > 0 ? remaining : 0) },
    ]);
  }
  function updateRow(idx: number, patch: Partial<PaymentSplit>) {
    onChange(splits.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function removeRow(idx: number) {
    onChange(splits.filter((_, i) => i !== idx));
  }

  return (
    <View>
      <Text style={s.title}>Pagamento da diferença</Text>
      <SplitTarget target={target} distributed={distributed} matches={matches} overshoot={overshoot} />

      {splits.length === 0 && (
        <Pressable onPress={addRow} style={s.addBtn}>
          <Icon name="plus" size={13} color="#a78bfa" />
          <Text style={s.addBtnTxt}>Adicionar primeira forma</Text>
        </Pressable>
      )}

      {splits.map((p, idx) => (
        <View key={idx} style={s.row}>
          {IS_WEB ? (
            <select
              value={p.method}
              onChange={(e: any) => updateRow(idx, { method: e.target.value as PaymentMethod })}
              style={selectStyle as any}
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          ) : (
            // Native fallback: cycle method on tap
            <Pressable
              style={[s.methodChip]}
              onPress={() => {
                const keys = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
                const ci = keys.indexOf(p.method);
                updateRow(idx, { method: keys[(ci + 1) % keys.length] });
              }}
            >
              <Text style={s.methodChipTxt}>
                {PAYMENT_METHOD_LABELS[p.method].emoji} {PAYMENT_METHOD_LABELS[p.method].label}
              </Text>
            </Pressable>
          )}
          <TextInput
            style={s.amountInput as any}
            value={formatAmountInput(p.amount)}
            onChangeText={(t) => updateRow(idx, { amount: parseAmount(t) })}
            keyboardType="decimal-pad"
          />
          <Pressable onPress={() => removeRow(idx)} style={s.removeBtn}>
            <Icon name="x" size={12} color={Colors.red} />
          </Pressable>
        </View>
      ))}

      {splits.length > 0 && (
        <Pressable onPress={addRow} style={s.addBtn}>
          <Icon name="plus" size={13} color="#a78bfa" />
          <Text style={s.addBtnTxt}>Adicionar forma de pagamento</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── RefundSplitForm ──────────────────────────────────────────
type RefundProps = {
  splits: RefundSplit[];
  onChange: (next: RefundSplit[]) => void;
  target: number; // Math.abs(netAmount) — sempre positivo
};

export function RefundSplitForm({ splits, onChange, target }: RefundProps) {
  const distributed = useMemo(
    () => splits.reduce((s, p) => s + (p.amount || 0), 0),
    [splits]
  );
  const remaining = parseFloat((target - distributed).toFixed(2));
  const matches = Math.abs(remaining) < 0.005;
  const overshoot = remaining < -0.005;

  function addRow(method: RefundMethod = "pix") {
    onChange([
      ...splits,
      { method, amount: Math.max(0, remaining > 0 ? remaining : 0) },
    ]);
  }
  function updateRow(idx: number, patch: Partial<RefundSplit>) {
    onChange(splits.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function removeRow(idx: number) {
    onChange(splits.filter((_, i) => i !== idx));
  }

  const alreadyHasCredit = splits.some((p) => p.method === "crediario_credito");

  return (
    <View>
      <Text style={[s.title, { color: Colors.red }]}>Estorno ao cliente</Text>
      <SplitTarget
        target={target} distributed={distributed}
        matches={matches} overshoot={overshoot}
        labelTotal="Total a estornar" labelDistributed="Distribuído"
        accentColor={Colors.red}
      />

      {/* Atalho: crédito para próxima compra */}
      {!alreadyHasCredit && (
        <Pressable
          style={s.creditCard}
          onPress={() => addRow("crediario_credito")}
        >
          <Text style={s.creditIco}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.creditTitle}>Crédito para próxima compra</Text>
            <Text style={s.creditSub}>
              Vira saldo positivo na conta do cliente — usa em qualquer venda futura. Integra com crediário.
            </Text>
          </View>
          <Text style={s.creditAction}>Usar →</Text>
        </Pressable>
      )}

      {splits.length === 0 && (
        <Pressable onPress={() => addRow("pix")} style={s.addBtn}>
          <Icon name="plus" size={13} color="#a78bfa" />
          <Text style={s.addBtnTxt}>Adicionar primeira forma de estorno</Text>
        </Pressable>
      )}

      {splits.map((p, idx) => (
        <View key={idx} style={s.row}>
          {IS_WEB ? (
            <select
              value={p.method}
              onChange={(e: any) => updateRow(idx, { method: e.target.value as RefundMethod })}
              style={selectStyle as any}
            >
              {Object.entries(REFUND_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          ) : (
            <Pressable
              style={[s.methodChip]}
              onPress={() => {
                const keys = Object.keys(REFUND_METHOD_LABELS) as RefundMethod[];
                const ci = keys.indexOf(p.method);
                updateRow(idx, { method: keys[(ci + 1) % keys.length] });
              }}
            >
              <Text style={s.methodChipTxt}>
                {REFUND_METHOD_LABELS[p.method].emoji} {REFUND_METHOD_LABELS[p.method].label}
              </Text>
            </Pressable>
          )}
          <TextInput
            style={s.amountInput as any}
            value={formatAmountInput(p.amount)}
            onChangeText={(t) => updateRow(idx, { amount: parseAmount(t) })}
            keyboardType="decimal-pad"
          />
          <Pressable onPress={() => removeRow(idx)} style={s.removeBtn}>
            <Icon name="x" size={12} color={Colors.red} />
          </Pressable>
        </View>
      ))}

      {splits.length > 0 && (
        <Pressable onPress={() => addRow("pix")} style={s.addBtn}>
          <Icon name="plus" size={13} color="#a78bfa" />
          <Text style={s.addBtnTxt}>Adicionar forma de estorno</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── SplitTarget (validação visual da soma) ───────────────────
function SplitTarget({
  target, distributed, matches, overshoot,
  labelTotal = "Total a pagar",
  labelDistributed = "Distribuído",
  accentColor,
}: {
  target: number;
  distributed: number;
  matches: boolean;
  overshoot: boolean;
  labelTotal?: string;
  labelDistributed?: string;
  accentColor?: string;
}) {
  let color = Colors.ink3;
  let icon = "";
  if (matches) { color = "#34d399"; icon = "✓"; }
  else if (overshoot) { color = Colors.red; icon = "⚠"; }
  return (
    <Text style={[s.target, { color }]}>
      {labelTotal}: <Text style={[s.targetStrong, { color: accentColor || color }]}>
        {fmtBRL(target)}
      </Text>
      {"  ·  "}
      {labelDistributed}: <Text style={[s.targetStrong, { color }]}>
        {fmtBRL(distributed)}
      </Text>
      {icon ? " " + icon : ""}
      {!matches && !overshoot ? `  ·  faltam ${fmtBRL(target - distributed)}` : ""}
      {overshoot ? `  ·  ${fmtBRL(distributed - target)} a mais` : ""}
    </Text>
  );
}

// ─── Selector web (inline style) ──────────────────────────────
const selectStyle: any = {
  flex: 1,
  backgroundColor: IS_DARK_MODE ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.04)",
  border: "1px solid rgba(124,58,237,0.25)",
  color: Colors.ink,
  padding: "9px 11px",
  borderRadius: 9,
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
};

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  title: {
    fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 6,
  },
  target: {
    fontSize: 11, color: Colors.ink3, marginBottom: 12,
  },
  targetStrong: { fontWeight: "700" },

  row: {
    flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8,
  },
  amountInput: {
    width: 110, flexShrink: 0,
    backgroundColor: Glass.bgInput,
    borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 9, fontSize: 13, fontWeight: "600", textAlign: "right",
  },
  methodChip: {
    flex: 1, paddingVertical: 9, paddingHorizontal: 11,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    borderRadius: 9,
  },
  methodChipTxt: { color: Colors.ink, fontSize: 12 },

  removeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  addBtn: {
    marginTop: 4, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    borderRadius: 9, backgroundColor: "rgba(124,58,237,0.06)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)", borderStyle: "dashed",
  },
  addBtnTxt: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },

  // Credit shortcut card (refund only)
  creditCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, marginBottom: 12,
    backgroundColor: "rgba(167,139,250,0.08)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)",
    borderRadius: 11,
  },
  creditIco: { fontSize: 22 },
  creditTitle: { fontSize: 13, fontWeight: "700", color: "#a78bfa", marginBottom: 2 },
  creditSub: { fontSize: 11, color: Colors.ink3, lineHeight: 15 },
  creditAction: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
});

export default { PaymentSplitForm, RefundSplitForm };
