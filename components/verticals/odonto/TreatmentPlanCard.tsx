import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-02: TreatmentPlanCard (Orcamento Odontologico)
// Displays treatment plan with items, totals, installments
// ============================================================

export interface PlanItem {
  id?: string;
  procedure_id?: string;
  procedure_name: string;
  tooth_number?: number | null;
  face?: string;
  price: number;
  status?: string;
  notes?: string;
}

export interface Installment {
  id?: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status?: string;
  paid_at?: string;
}

export interface TreatmentPlan {
  id?: string;
  plan_number?: string;
  patient_name?: string;
  status: string;
  items: PlanItem[];
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  total: number;
  installments?: Installment[];
  notes?: string;
  valid_until?: string;
  created_at?: string;
}

interface TreatmentPlanCardProps {
  plan: TreatmentPlan;
  onApprove?: () => void;
  onSendWhatsApp?: () => void;
  onGeneratePDF?: () => void;
  onGenerateInstallments?: (count: number) => void;
  onStatusChange?: (status: string) => void;
  compact?: boolean;
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  rascunho:       { label: "Rascunho",       bg: "rgba(156,163,175,0.12)", color: "#6B7280" },
  enviado:        { label: "Enviado",        bg: "rgba(6,182,212,0.12)",   color: "#06B6D4" },
  negociando:     { label: "Negociando",     bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  aprovado:       { label: "Aprovado",       bg: "rgba(16,185,129,0.12)",  color: "#10B981" },
  em_tratamento:  { label: "Em tratamento",  bg: "rgba(124,58,237,0.12)",  color: "#7C3AED" },
  concluido:      { label: "Concluido",      bg: "rgba(16,185,129,0.12)",  color: "#10B981" },
  recusado:       { label: "Recusado",       bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
  cancelado:      { label: "Cancelado",      bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
};

export function TreatmentPlanCard({
  plan, onApprove, onSendWhatsApp, onGeneratePDF,
  onGenerateInstallments, onStatusChange, compact = false,
}: TreatmentPlanCardProps) {
  const [showInstallments, setShowInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const statusInfo = STATUS_MAP[plan.status] || STATUS_MAP.rascunho;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.headerRow}>
            <Text style={s.planNumber}>{plan.plan_number || "Novo orcamento"}</Text>
            <View style={[s.badge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[s.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>
          {plan.patient_name && (
            <Text style={s.patientName}>Paciente: {plan.patient_name}</Text>
          )}
          {plan.created_at && (
            <Text style={s.date}>Criado em {new Date(plan.created_at).toLocaleDateString("pt-BR")}</Text>
          )}
        </View>
      </View>

      {/* Items table */}
      {!compact && (
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 1 }]}>Procedimento</Text>
            <Text style={[s.th, { width: 45 }]}>Dente</Text>
            <Text style={[s.th, { width: 80, textAlign: "right" }]}>Valor</Text>
          </View>
          {plan.items.map((item, i) => (
            <View key={item.id || i} style={s.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.procedure_name}</Text>
                {item.notes && <Text style={s.itemNotes}>{item.notes}</Text>}
              </View>
              <Text style={s.itemTooth}>{item.tooth_number || "\u2014"}</Text>
              <Text style={s.itemPrice}>R$ {Number(item.price).toFixed(2).replace(".", ",")}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Totals */}
      <View style={s.totalsSection}>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>{plan.items.length} procedimento(s)</Text>
          {plan.discount_pct > 0 && (
            <Text style={s.discountText}>
              Desconto {plan.discount_pct}%: -R$ {Number(plan.discount_amount).toFixed(2).replace(".", ",")}
            </Text>
          )}
        </View>
        <View style={s.totalRow}>
          {plan.discount_pct > 0 && (
            <Text style={s.subtotalStrike}>
              R$ {Number(plan.subtotal).toFixed(2).replace(".", ",")}
            </Text>
          )}
          <Text style={s.totalValue}>
            R$ {Number(plan.total).toFixed(2).replace(".", ",")}
          </Text>
        </View>
      </View>

      {/* Installments */}
      {plan.installments && plan.installments.length > 0 && (
        <Pressable onPress={() => setShowInstallments(!showInstallments)} style={s.installmentsToggle}>
          <Text style={s.installmentsLabel}>
            {plan.installments.length}x de R$ {Number(plan.installments[0].amount).toFixed(2).replace(".", ",")}
          </Text>
          <Text style={s.chevron}>{showInstallments ? "\u25B2" : "\u25BC"}</Text>
        </Pressable>
      )}

      {showInstallments && plan.installments && (
        <View style={s.installmentsList}>
          {plan.installments.map(inst => (
            <View key={inst.installment_number} style={s.instRow}>
              <Text style={s.instNum}>{inst.installment_number}\u00AA</Text>
              <Text style={s.instDate}>
                {new Date(inst.due_date).toLocaleDateString("pt-BR")}
              </Text>
              <Text style={s.instAmount}>
                R$ {Number(inst.amount).toFixed(2).replace(".", ",")}
              </Text>
              <View style={[
                s.instBadge,
                { backgroundColor: inst.status === "pago" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" },
              ]}>
                <Text style={[
                  s.instBadgeText,
                  { color: inst.status === "pago" ? "#10B981" : "#F59E0B" },
                ]}>
                  {inst.status === "pago" ? "Pago" : "Pendente"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      {!compact && (
        <View style={s.actions}>
          {plan.status !== "aprovado" && plan.status !== "em_tratamento" && plan.status !== "concluido" && onApprove && (
            <Pressable onPress={onApprove} style={s.btnPrimary}>
              <Text style={s.btnPrimaryText}>Aprovar</Text>
            </Pressable>
          )}
          {onSendWhatsApp && (
            <Pressable onPress={onSendWhatsApp} style={s.btnOutline}>
              <Text style={s.btnOutlineText}>WhatsApp</Text>
            </Pressable>
          )}
          {onGeneratePDF && (
            <Pressable onPress={onGeneratePDF} style={s.btnOutline}>
              <Text style={s.btnOutlineText}>PDF</Text>
            </Pressable>
          )}
          {onGenerateInstallments && plan.status === "aprovado" && (
            <View style={s.installmentInput}>
              <TextInput
                value={installmentCount}
                onChangeText={setInstallmentCount}
                style={s.instInput}
                keyboardType="numeric"
                maxLength={2}
              />
              <Pressable
                onPress={() => onGenerateInstallments(parseInt(installmentCount) || 1)}
                style={s.btnOutline}
              >
                <Text style={s.btnOutlineText}>Parcelar</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Funnel component ──────────────────────────────────────

export interface FunnelData {
  status: string;
  count: number;
  total_value: number;
}

export function TreatmentPlanFunnel({ data }: { data: FunnelData[] }) {
  const order = ["enviado", "negociando", "aprovado", "em_tratamento", "concluido", "recusado"];
  const sorted = order.map(s => data.find(d => d.status === s)).filter(Boolean) as FunnelData[];
  const maxCount = Math.max(...sorted.map(d => d.count), 1);

  return (
    <View style={s.funnelContainer}>
      <Text style={s.funnelTitle}>Funil de orcamentos</Text>
      <View style={s.funnelBarRow}>
        {sorted.map(d => {
          const info = STATUS_MAP[d.status] || STATUS_MAP.rascunho;
          return (
            <View key={d.status} style={[s.funnelSegment, { flex: d.count / maxCount }]}>
              <View style={[s.funnelBar, { backgroundColor: info.color }]} />
            </View>
          );
        })}
      </View>
      <View style={s.funnelLabels}>
        {sorted.map(d => {
          const info = STATUS_MAP[d.status] || STATUS_MAP.rascunho;
          return (
            <Text key={d.status} style={s.funnelLabel}>
              <Text style={{ color: info.color, fontWeight: "600" }}>{d.count}</Text>
              {" "}{info.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3 || "#1a1a2e",
    borderRadius: 14, borderWidth: 0.5,
    borderColor: Colors.border || "#333",
    padding: 16, gap: 12,
  },
  header: { flexDirection: "row", gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planNumber: { fontSize: 15, fontWeight: "700", color: Colors.ink || "#fff" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  patientName: { fontSize: 13, color: Colors.ink2 || "#aaa", marginTop: 2 },
  date: { fontSize: 11, color: Colors.ink3 || "#666", marginTop: 2 },

  // Table
  table: { gap: 0 },
  tableHeader: {
    flexDirection: "row", paddingBottom: 6, marginBottom: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border || "#333",
  },
  th: { fontSize: 11, color: Colors.ink3 || "#666", fontWeight: "600" },
  tableRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border || "#222",
  },
  itemName: { fontSize: 13, fontWeight: "500", color: Colors.ink || "#fff" },
  itemNotes: { fontSize: 11, color: Colors.ink3 || "#666", marginTop: 1 },
  itemTooth: { width: 45, fontSize: 12, color: Colors.ink2 || "#aaa", textAlign: "center" },
  itemPrice: { width: 80, fontSize: 13, fontWeight: "500", color: Colors.ink || "#fff", textAlign: "right" },

  // Totals
  totalsSection: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border || "#333",
  },
  totalRow: { gap: 2 },
  totalLabel: { fontSize: 12, color: Colors.ink3 || "#666" },
  discountText: { fontSize: 11, color: Colors.ink3 || "#666" },
  subtotalStrike: {
    fontSize: 11, color: Colors.ink3 || "#666",
    textDecorationLine: "line-through",
  },
  totalValue: {
    fontSize: 20, fontWeight: "700", color: "#06B6D4",
  },

  // Installments
  installmentsToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: "rgba(6,182,212,0.06)",
  },
  installmentsLabel: { fontSize: 13, color: "#06B6D4", fontWeight: "500" },
  chevron: { fontSize: 10, color: "#06B6D4" },
  installmentsList: { gap: 4 },
  instRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  instNum: { fontSize: 12, fontWeight: "600", color: Colors.ink2 || "#aaa", width: 24 },
  instDate: { fontSize: 12, color: Colors.ink2 || "#aaa", flex: 1 },
  instAmount: { fontSize: 12, fontWeight: "500", color: Colors.ink || "#fff", width: 80, textAlign: "right" },
  instBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  instBadgeText: { fontSize: 9, fontWeight: "600" },

  // Actions
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btnPrimary: {
    backgroundColor: "#06B6D4", borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnOutline: {
    borderWidth: 0.5, borderColor: "#06B6D4", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  btnOutlineText: { color: "#06B6D4", fontSize: 12, fontWeight: "500" },
  installmentInput: { flexDirection: "row", alignItems: "center", gap: 4 },
  instInput: {
    width: 36, height: 32, borderRadius: 6, borderWidth: 0.5,
    borderColor: Colors.border || "#333", textAlign: "center",
    color: Colors.ink || "#fff", fontSize: 13,
  },

  // Funnel
  funnelContainer: { gap: 8 },
  funnelTitle: { fontSize: 14, fontWeight: "600", color: Colors.ink || "#fff" },
  funnelBarRow: { flexDirection: "row", gap: 3, height: 6 },
  funnelSegment: { overflow: "hidden" },
  funnelBar: { height: 6, borderRadius: 3 },
  funnelLabels: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  funnelLabel: { fontSize: 11, color: Colors.ink2 || "#aaa" },
});

export default TreatmentPlanCard;
