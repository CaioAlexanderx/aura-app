import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

// ============================================================
// AURA. — CashChangeModal
//
// 09/05/2026: Modal de troco para venda em DINHEIRO (single-payment).
// 12/05/2026: ganhou prop `totalLabel` (split-mode).
// NÃO persiste cash_tendered — auxílio operacional.
//
// 15/05/2026 (Davi Calçados): fix botão "Confirmar venda" invisível em
// monitores 13/14 (1366×768) com Windows scale 125%. Estrutura nova:
// header + body com ScrollView interna + actions sticky fora do scroll.
// modal ganha maxHeight: '92vh'; paddings tighten pra cobrir 600px de
// altura útil mesmo após chrome do browser. Funciona até 1024×600.
// ============================================================

type Props = {
  visible: boolean;
  total: number;
  totalLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function fmt(v: number): string {
  if (!isFinite(v)) v = 0;
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function buildQuickValues(total: number): number[] {
  if (!isFinite(total) || total <= 0) return [];
  const set = new Set<number>();
  const steps = [5, 10, 20, 50, 100];
  for (const step of steps) {
    const next = Math.ceil((total + 0.01) / step) * step;
    if (next > total && next - total <= step * 4) set.add(next);
  }
  const arr = Array.from(set).sort((a, b) => a - b);
  const base = arr[0] ?? Math.ceil(total / 10) * 10 + 10;
  while (arr.length < 4) {
    const last = arr[arr.length - 1] ?? base;
    arr.push(last + 50);
  }
  return arr.slice(0, 4);
}

function parseCash(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,.\-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

export function CashChangeModal(props: Props) {
  const { visible, total, totalLabel, onCancel, onConfirm } = props;
  const [paidStr, setPaidStr] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(function() {
    if (visible) {
      setPaidStr(total.toFixed(2).replace(".", ","));
      const t = setTimeout(function() {
        if (inputRef.current && Platform.OS === "web") {
          try { (inputRef.current as any).focus?.(); (inputRef.current as any).select?.(); } catch {}
        }
      }, 50);
      return function() { clearTimeout(t); };
    }
  }, [visible, total]);

  const paid = useMemo(function() { return parseCash(paidStr); }, [paidStr]);
  const change = useMemo(function() { return Math.max(0, paid - total); }, [paid, total]);
  const insufficient = paid > 0 && paid < total;
  const ready = paid >= total && total > 0;

  const quicks = useMemo(function() { return buildQuickValues(total); }, [total]);

  function handleQuick(v: number) {
    setPaidStr(v.toFixed(2).replace(".", ","));
  }

  function handleConfirm() {
    if (!ready) return;
    onConfirm();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.modal}>
          {/* HEADER — sticky no topo */}
          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Icon name="dollar" size={18} color={Colors.violet3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Troco · Pagamento em Dinheiro</Text>
              <Text style={s.sub}>Informe o valor recebido do cliente</Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Icon name="x" size={18} color={Colors.ink3} />
            </Pressable>
          </View>

          {/* BODY — ScrollView interna; conteúdo central rola se necessário */}
          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{totalLabel || "Valor da venda"}</Text>
              <Text style={s.totalValue}>{fmt(total)}</Text>
            </View>

            <Text style={s.inputLabel}>Valor pago pelo cliente</Text>
            <TextInput
              ref={inputRef}
              value={paidStr}
              onChangeText={setPaidStr}
              keyboardType={Platform.OS === "web" ? "default" : "decimal-pad"}
              inputMode="decimal"
              placeholder="0,00"
              placeholderTextColor={Colors.ink3}
              style={s.input}
              selectTextOnFocus
            />

            <View style={s.quicks}>
              {quicks.map(function(v) {
                return (
                  <Pressable key={v} onPress={function() { handleQuick(v); }} style={s.quickBtn}>
                    <Text style={s.quickText}>{fmt(v)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {ready && (
              <View style={s.changeBox}>
                <Text style={s.changeLabel}>Troco a devolver</Text>
                <Text style={s.changeValue}>{fmt(change)}</Text>
              </View>
            )}

            {insufficient && (
              <View style={s.warnBox}>
                <Icon name="alert" size={14} color={Colors.red} />
                <Text style={s.warnText}>
                  Valor abaixo do total. Faltam <Text style={{ fontWeight: "700" }}>{fmt(total - paid)}</Text>.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* ACTIONS — sticky no rodapé, FORA do ScrollView. Sempre visível. */}
          <View style={s.actions}>
            <Pressable onPress={onCancel} style={s.btnSecondary}>
              <Text style={s.btnSecondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[s.btnPrimary, !ready && s.btnPrimaryDisabled]}
              disabled={!ready}
            >
              <Text style={[s.btnPrimaryText, !ready && { color: "rgba(255,255,255,0.55)" }]}>
                Confirmar venda
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  // maxHeight 92vh + flex column → body ScrollView ocupa o resto, actions
  // fica sticky em baixo. Em 1366×768 @125% (768/1.25=614px) sobra ~565px
  // utilizáveis; com ~120px de header+actions, ainda há 440px+ pro body.
  modal: {
    width: "100%", maxWidth: 460,
    maxHeight: "92vh" as any,
    backgroundColor: Colors.bg2,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40,
    display: "flex" as any, flexDirection: "column" as any,
    overflow: "hidden" as any,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  body: { flexShrink: 1, flexGrow: 0 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.border, marginBottom: 12,
  },
  totalLabel: { fontSize: 13, color: Colors.ink3 },
  totalValue: { fontSize: 20, fontWeight: "700", color: Colors.ink },

  inputLabel: { fontSize: 11, color: Colors.ink3, marginTop: 2, marginBottom: 6 },
  input: {
    width: "100%", paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border2,
    color: Colors.ink, fontSize: 22, fontWeight: "600",
    textAlign: "right",
  },
  quicks: { flexDirection: "row", gap: 6, marginTop: 10 },
  quickBtn: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 4,
    backgroundColor: Colors.bg4, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  quickText: { fontSize: 12, color: Colors.ink, fontWeight: "500" },

  changeBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.greenD, borderColor: Colors.green,
    borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    marginTop: 10,
  },
  changeLabel: { fontSize: 12, fontWeight: "600", color: Colors.green },
  changeValue: { fontSize: 20, fontWeight: "700", color: Colors.green },

  warnBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.redD, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, marginTop: 10,
  },
  warnText: { fontSize: 12, color: Colors.red, flex: 1 },

  // Actions sticky — fora da ScrollView. Sempre visível.
  actions: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  btnSecondary: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.bg4,
    borderWidth: 1, borderColor: Colors.border2, alignItems: "center",
  },
  btnSecondaryText: { fontSize: 13, fontWeight: "500", color: Colors.ink },
  btnPrimary: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.violet, alignItems: "center",
  },
  btnPrimaryDisabled: { backgroundColor: Colors.violetD },
  btnPrimaryText: { fontSize: 13, fontWeight: "600", color: "#fff" },
});

export default CashChangeModal;
