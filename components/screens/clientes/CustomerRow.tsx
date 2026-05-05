import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { creditApi } from "@/services/creditApi";
import type { Customer } from "./types";
import { fmt, getStatus } from "./types";

function Tag({ tag }: { tag: string }) {
  const m: Record<string, { b: string; f: string }> = {
    VIP: { b: Colors.violetD, f: Colors.violet3 }, Frequente: { b: Colors.greenD, f: Colors.green },
    Novo: { b: Colors.amberD, f: Colors.amber }, Inativo: { b: Colors.redD, f: Colors.red },
    Devendo: { b: "rgba(251,146,60,0.18)", f: "#f97316" },
  };
  const c = m[tag] || { b: Colors.bg4, f: Colors.ink3 };
  return <View style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.b }}><Text style={{ fontSize: 9, fontWeight: "600", color: c.f, letterSpacing: 0.3 }}>{tag}</Text></View>;
}

function Stars({ r }: { r: number | null }) {
  if (r == null) return <Text style={{ fontSize: 10, color: Colors.ink3 }}>Sem avaliacao</Text>;
  return <View style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <Text key={i} style={{ fontSize: 12, color: i <= r ? Colors.amber : Colors.ink3 }}>*</Text>)}</View>;
}

export function CustomerRow({
  c, expanded, onToggle, onDelete, onEdit,
  isSelected, onSelect,
  showCompanyBadge,
}: {
  c: Customer;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (c: Customer) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // MULTICNPJ Onda 2.3: mostra badge da loja onde foi cadastrado.
  // FE passa true so quando companyCount > 1 (multi-CNPJ ativo).
  showCompanyBadge?: boolean;
}) {
  const [h, sH] = useState(false);
  const [busy, setBusy] = useState(false);
  const w = Platform.OS === "web";
  const tags = getStatus(c);
  const showBadge = showCompanyBadge && c.company_name;
  const hasCredit = (c.creditBalance || 0) > 0;
  const qc = useQueryClient();
  const { company } = useAuthStore();

  // Receber pagamento — MVP via window.prompt (web). Em mobile a UX e parecida,
  // mas falla pra browser-only por ora. Modal completo vira numa V2 quando o
  // fluxo estiver validado pelo Davi.
  async function handleReceivePayment() {
    if (!hasCredit) return;
    // Crediario e por (cliente, empresa) — usar a empresa onde o cliente
    // foi cadastrado (que e onde o saldo existe), nao a current.
    const targetCompanyId = c.company_id || company?.id;
    if (!targetCompanyId) {
      toast.error("Empresa do cliente nao identificada");
      return;
    }
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      toast.error("Receber pagamento disponivel apenas no navegador");
      return;
    }
    const raw = window.prompt(
      `Receber pagamento de ${c.name}\n` +
      `Saldo em aberto: ${fmt(c.creditBalance)}\n\n` +
      `Quanto recebeu? (R$)`,
      c.creditBalance.toFixed(2).replace(".", ",")
    );
    if (raw === null) return;
    const cleaned = String(raw).replace(",", ".").replace(/[^\d.]/g, "");
    const amount = parseFloat(cleaned);
    if (!isFinite(amount) || amount <= 0) {
      toast.error("Valor invalido");
      return;
    }
    if (amount > c.creditBalance + 0.01) {
      const ok = window.confirm(
        `O valor recebido (${fmt(amount)}) e maior que o saldo em aberto (${fmt(c.creditBalance)}).\n\n` +
        `Isso vai gerar credito a favor do cliente. Confirmar?`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await creditApi.receivePayment(targetCompanyId, c.id, { amount });
      toast.success(`Pagamento registrado. Novo saldo: ${fmt(res.new_balance)}`);
      // Invalida lista de clientes (tem credit_balance) + saldos de credit
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["credit-balances"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar pagamento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Pressable
        onPress={() => onSelect ? onSelect(c.id) : onToggle()}
        onHoverIn={w ? () => sH(true) : undefined}
        onHoverOut={w ? () => sH(false) : undefined}
        style={[s.row, h && { backgroundColor: Colors.bg4 }, isSelected && { backgroundColor: Colors.violetD }, w && { transition: "background-color 0.15s ease" } as any]}
      >
        {onSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
            {isSelected && <Text style={s.checkmark}>✓</Text>}
          </View>
        )}
        <View style={s.left}>
          <View style={s.avatar}><Text style={s.avatarText}>{c.name.charAt(0)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{c.name}</Text>
            <View style={s.metaRow}>
              <Text style={s.meta} numberOfLines={1}>
                {c.phone}{c.instagram ? " / " + c.instagram : ""}
              </Text>
              {showBadge && (
                <View style={s.companyBadge}>
                  <Text style={s.companyBadgeText} numberOfLines={1}>{c.company_name}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {!onSelect && (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={s.spent}>{fmt(c.totalSpent)}</Text>
            {hasCredit && (
              <View style={s.openBadge}>
                <Text style={s.openBadgeText}>Em aberto: {fmt(c.creditBalance)}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 4 }}>{tags.slice(0, 2).map(t => <Tag key={t} tag={t} />)}</View>
          </View>
        )}
      </Pressable>
      {expanded && !onSelect && (
        <View style={s.detail}>
          <View style={s.detailGrid}>
            {[["E-mail", c.email], ["Telefone", c.phone], ["Aniversario", c.birthday], ["Instagram", c.instagram || "---"], ["Primeira visita", c.firstVisit], ["Ultima compra", c.lastPurchase], ["Total gasto", fmt(c.totalSpent)], ["Visitas", String(c.visits)]].map(([l, v]) =>
              <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={[s.detailValue, l === "Total gasto" && { color: Colors.green }, l === "Instagram" && { color: Colors.violet3 }]}>{v}</Text></View>
            )}
            <View style={s.detailItem}><Text style={s.detailLabel}>Avaliacao</Text><Stars r={c.rating} /></View>
            {/* MULTICNPJ Onda 2.3: empresa onde foi cadastrado (so se multi-CNPJ) */}
            {showBadge && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Cadastrado em</Text>
                <Text style={[s.detailValue, { color: Colors.violet3 }]} numberOfLines={1}>{c.company_name}</Text>
              </View>
            )}
            {/* Crediario: saldo em aberto */}
            {hasCredit && (
              <View style={s.detailItem}>
                <Text style={s.detailLabel}>Saldo em aberto</Text>
                <Text style={[s.detailValue, { color: "#f97316" }]}>{fmt(c.creditBalance)}</Text>
              </View>
            )}
          </View>
          {c.notes ? <Text style={s.notes}>{c.notes}</Text> : null}
          <View style={s.detailTags}><Text style={s.detailTagsLabel}>Status</Text><View style={{ flexDirection: "row", gap: 6 }}>{tags.map(t => <Tag key={t} tag={t} />)}</View></View>
          <View style={s.actions}>
            {hasCredit && (
              <Pressable
                onPress={handleReceivePayment}
                disabled={busy}
                style={[s.receiveBtn, busy && { opacity: 0.5 }]}
              >
                <Text style={s.receiveText}>
                  {busy ? "Registrando..." : "Receber pagamento"}
                </Text>
              </Pressable>
            )}
            {["Enviar WhatsApp", "Pedir avaliacao", "Ver historico"].map(a =>
              <Pressable key={a} style={s.actionBtn}><Text style={s.actionText}>{a}</Text></Pressable>
            )}
            {onEdit && <Pressable onPress={() => onEdit(c)} style={s.editBtn}><Text style={s.editText}>Editar cliente</Text></Pressable>}
            {onDelete && <Pressable onPress={() => onDelete(c.id)} style={s.deleteBtn}><Text style={s.deleteText}>Excluir cliente</Text></Pressable>}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkmark: { fontSize: 13, color: "#fff", fontWeight: "700", lineHeight: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  avatarText: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  meta: { fontSize: 11, color: Colors.ink3, flexShrink: 1 },
  // MULTICNPJ Onda 2.3: badge da loja
  companyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    maxWidth: 160,
  },
  companyBadgeText: {
    fontSize: 9.5,
    color: Colors.violet3,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  spent: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  // Crediario: badge laranja "Em aberto: R$ X"
  openBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(251,146,60,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.4)",
  },
  openBadgeText: {
    fontSize: 10,
    color: "#f97316",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 16, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 6, gap: 3 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  notes: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  detailTags: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  detailTagsLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: "wrap" },
  actionBtn: { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  actionText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  // Botao "Receber pagamento" — destaque laranja, mesmo tom do badge
  receiveBtn: {
    backgroundColor: "rgba(251,146,60,0.16)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.5)",
  },
  receiveText: { fontSize: 11, color: "#f97316", fontWeight: "700" },
  editBtn: { backgroundColor: Colors.amberD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.amber + "33" },
  editText: { fontSize: 11, color: Colors.amber, fontWeight: "600" },
  deleteBtn: { backgroundColor: Colors.redD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.red + "33" },
  deleteText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
});

export default CustomerRow;
