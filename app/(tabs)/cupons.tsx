import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { couponsApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const fmt = (n: number) => `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Coupon = {
  id: string; code: string; description: string | null;
  discount_type: "percent" | "fixed"; discount_value: number;
  min_order_value: number; max_uses: number | null; current_uses: number;
  is_active: boolean; expires_at: string | null; created_at: string;
};

function CouponCard({ coupon, onToggle, onDelete }: { coupon: Coupon; onToggle: () => void; onDelete: () => void }) {
  const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
  const exhausted = coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses;
  const statusColor = !coupon.is_active || expired || exhausted ? Colors.red : Colors.green;
  const statusLabel = !coupon.is_active ? "Inativo" : expired ? "Expirado" : exhausted ? "Esgotado" : "Ativo";
  return (
    <View style={z.couponCard}>
      <View style={z.couponHeader}>
        <View style={{ flex: 1 }}>
          <Text style={z.couponCode}>{coupon.code}</Text>
          {coupon.description ? <Text style={z.couponDesc}>{coupon.description}</Text> : null}
        </View>
        <View style={[z.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <Text style={[z.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={z.couponDetails}>
        <View style={z.detailItem}>
          <Text style={z.detailLabel}>Desconto</Text>
          <Text style={z.detailValue}>
            {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : fmt(coupon.discount_value)}
          </Text>
        </View>
        <View style={z.detailItem}>
          <Text style={z.detailLabel}>Usos</Text>
          <Text style={z.detailValue}>
            {coupon.current_uses}{coupon.max_uses !== null ? ` / ${coupon.max_uses}` : " (ilimitado)"}
          </Text>
        </View>
        {coupon.min_order_value > 0 && (
          <View style={z.detailItem}>
            <Text style={z.detailLabel}>Pedido min.</Text>
            <Text style={z.detailValue}>{fmt(coupon.min_order_value)}</Text>
          </View>
        )}
        {coupon.expires_at && (
          <View style={z.detailItem}>
            <Text style={z.detailLabel}>Validade</Text>
            <Text style={[z.detailValue, expired && { color: Colors.red }]}>
              {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
            </Text>
          </View>
        )}
      </View>
      <View style={z.couponActions}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Switch value={coupon.is_active} onValueChange={onToggle}
            trackColor={{ false: Colors.bg4, true: Colors.green + "66" }}
            thumbColor={coupon.is_active ? Colors.green : Colors.ink3} />
          <Text style={{ fontSize: 11, color: Colors.ink3 }}>{coupon.is_active ? "Ativo" : "Inativo"}</Text>
        </View>
        <Pressable onPress={onDelete} style={z.deleteBtn}>
          <Icon name="x" size={12} color={Colors.red} />
          <Text style={z.deleteBtnText}>Excluir</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CreateCouponForm({ onSave, onCancel }: { onSave: (data: any) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresIn, setExpiresIn] = useState(""); // days from now

  function handleSave() {
    if (!code.trim()) { toast.error("Codigo obrigatorio"); return; }
    if (!discountValue.trim() || parseFloat(discountValue) <= 0) { toast.error("Valor do desconto obrigatorio"); return; }
    if (discountType === "percent" && parseFloat(discountValue) > 100) { toast.error("Desconto percentual max 100%"); return; }
    const data: any = {
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discount_type: discountType,
      discount_value: parseFloat(discountValue.replace(",", ".")),
      min_order_value: minOrder ? parseFloat(minOrder.replace(",", ".")) : 0,
      max_uses: maxUses ? parseInt(maxUses) : undefined,
    };
    if (expiresIn && parseInt(expiresIn) > 0) {
      const d = new Date(); d.setDate(d.getDate() + parseInt(expiresIn));
      data.expires_at = d.toISOString();
    }
    onSave(data);
  }

  return (
    <View style={z.formCard}>
      <Text style={z.formTitle}>Novo cupom</Text>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Codigo *</Text>
          <TextInput style={z.formInput} value={code} onChangeText={v => setCode(v.toUpperCase())} placeholder="DESCONTO10" placeholderTextColor={Colors.ink3} autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Descricao</Text>
          <TextInput style={z.formInput} value={description} onChangeText={setDescription} placeholder="Lancamento..." placeholderTextColor={Colors.ink3} />
        </View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Tipo de desconto</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={() => setDiscountType("percent")} style={[z.typeChip, discountType === "percent" && z.typeChipActive]}>
              <Text style={[z.typeChipText, discountType === "percent" && z.typeChipTextActive]}>Percentual (%)</Text>
            </Pressable>
            <Pressable onPress={() => setDiscountType("fixed")} style={[z.typeChip, discountType === "fixed" && z.typeChipActive]}>
              <Text style={[z.typeChipText, discountType === "fixed" && z.typeChipTextActive]}>Valor fixo (R$)</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Valor do desconto *</Text>
          <TextInput style={z.formInput} value={discountValue} onChangeText={setDiscountValue} placeholder={discountType === "percent" ? "10" : "15,00"} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Pedido minimo (R$)</Text>
          <TextInput style={z.formInput} value={minOrder} onChangeText={setMinOrder} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Limite de usos</Text>
          <TextInput style={z.formInput} value={maxUses} onChangeText={setMaxUses} placeholder="Ilimitado" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={z.formLabel}>Validade (dias)</Text>
          <TextInput style={z.formInput} value={expiresIn} onChangeText={setExpiresIn} placeholder="Sem prazo" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
        </View>
      </View>
      <View style={z.formFooter}>
        <Pressable onPress={onCancel} style={z.formCancelBtn}><Text style={z.formCancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={z.formSaveBtn}><Text style={z.formSaveText}>Criar cupom</Text></Pressable>
      </View>
    </View>
  );
}

export default function CuponsScreen() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coupons", company?.id],
    queryFn: () => couponsApi.list(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 15000,
  });
  const coupons: Coupon[] = data?.coupons || [];

  const createMut = useMutation({
    mutationFn: (body: any) => couponsApi.create(company!.id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons", company?.id] }); setShowForm(false); toast.success("Cupom criado!"); },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar cupom"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => couponsApi.update(company!.id, id, { is_active: active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons", company?.id] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => couponsApi.remove(company!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons", company?.id] }); toast.success("Cupom excluido"); },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const active = coupons.filter(c => c.is_active);
  const inactive = coupons.filter(c => !c.is_active);
  const totalUses = coupons.reduce((s, c) => s + c.current_uses, 0);

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.content}>
      <PageHeader title="Cupons" />
      <Text style={z.subtitle}>Gerencie cupons de desconto para o PDV</Text>

      {/* KPIs */}
      <View style={z.kpiRow}>
        <View style={z.kpi}>
          <Text style={z.kpiValue}>{coupons.length}</Text>
          <Text style={z.kpiLabel}>Total</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.green }]}>{active.length}</Text>
          <Text style={z.kpiLabel}>Ativos</Text>
        </View>
        <View style={z.kpi}>
          <Text style={[z.kpiValue, { color: Colors.violet3 }]}>{totalUses}</Text>
          <Text style={z.kpiLabel}>Usos totais</Text>
        </View>
      </View>

      {!showForm && (
        <Pressable onPress={() => setShowForm(true)} style={z.addBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={z.addBtnText}>Criar cupom</Text>
        </Pressable>
      )}

      {showForm && <CreateCouponForm onSave={d => createMut.mutate(d)} onCancel={() => setShowForm(false)} />}

      {isLoading && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={Colors.violet3} />
        </View>
      )}

      {!isLoading && coupons.length === 0 && !showForm && (
        <EmptyState
          icon="star"
          iconColor={Colors.violet3}
          title="Nenhum cupom criado"
          subtitle="Crie cupons de desconto para oferecer aos seus clientes no caixa."
          actionLabel="Criar primeiro cupom"
          onAction={() => setShowForm(true)}
        />
      )}

      {coupons.length > 0 && (
        <View style={{ gap: 10, marginTop: 8 }}>
          {coupons.map(c => (
            <CouponCard
              key={c.id}
              coupon={c}
              onToggle={() => toggleMut.mutate({ id: c.id, active: !c.is_active })}
              onDelete={() => setDeleteTarget(c.id)}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Excluir cupom?"
        message="Esta acao nao pode ser desfeita. O cupom sera removido permanentemente."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 720, alignSelf: "center", width: "100%" },
  subtitle: { fontSize: 13, color: Colors.ink3, marginBottom: 20, marginTop: -8 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiValue: { fontSize: 24, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, marginBottom: 16 },
  addBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  // Coupon card
  couponCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  couponHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  couponCode: { fontSize: 16, fontWeight: "800", color: Colors.ink, letterSpacing: 1 },
  couponDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },
  couponDetails: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 12 },
  detailItem: { gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  couponActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33" },
  deleteBtnText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  // Form
  formCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 16 },
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0, marginBottom: 4 },
  formLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  typeChipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  typeChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  typeChipTextActive: { color: Colors.violet3, fontWeight: "600" },
  formFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  formCancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  formCancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  formSaveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  formSaveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
