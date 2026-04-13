import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Switch, ActivityIndicator, Dimensions } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { couponsApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
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
  const sc = !coupon.is_active || expired || exhausted ? Colors.red : Colors.green;
  const sl = !coupon.is_active ? "Inativo" : expired ? "Expirado" : exhausted ? "Esgotado" : "Ativo";
  return (
    <View style={z.card}>
      <View style={z.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={z.cardCode}>{coupon.code}</Text>
          {coupon.description ? <Text style={z.cardDesc}>{coupon.description}</Text> : null}
        </View>
        <View style={[z.badge, { backgroundColor: sc + "18" }]}><Text style={[z.badgeText, { color: sc }]}>{sl}</Text></View>
      </View>
      <View style={z.cardDetails}>
        <View style={z.detailItem}>
          <Text style={z.detailLabel}>Desconto</Text>
          <Text style={z.detailValue}>{coupon.discount_type === "percent" ? `${coupon.discount_value}%` : fmt(coupon.discount_value)}</Text>
        </View>
        <View style={z.detailItem}>
          <Text style={z.detailLabel}>Usos</Text>
          <Text style={z.detailValue}>{coupon.current_uses}{coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}</Text>
        </View>
        {coupon.min_order_value > 0 && <View style={z.detailItem}><Text style={z.detailLabel}>Min.</Text><Text style={z.detailValue}>{fmt(coupon.min_order_value)}</Text></View>}
        {coupon.expires_at && <View style={z.detailItem}><Text style={z.detailLabel}>Validade</Text><Text style={[z.detailValue, expired && { color: Colors.red }]}>{new Date(coupon.expires_at).toLocaleDateString("pt-BR")}</Text></View>}
      </View>
      <View style={z.cardActions}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Switch value={coupon.is_active} onValueChange={onToggle} trackColor={{ false: Colors.bg4, true: Colors.green + "66" }} thumbColor={coupon.is_active ? Colors.green : Colors.ink3} />
          <Text style={{ fontSize: 11, color: Colors.ink3 }}>{coupon.is_active ? "Ativo" : "Inativo"}</Text>
        </View>
        <Pressable onPress={onDelete} style={z.delBtn}><Icon name="x" size={12} color={Colors.red} /><Text style={z.delBtnText}>Excluir</Text></Pressable>
      </View>
    </View>
  );
}

function CreateForm({ onSave, onCancel }: { onSave: (d: any) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [dtype, setDtype] = useState<"percent" | "fixed">("percent");
  const [dval, setDval] = useState("");
  const [minOrd, setMinOrd] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expDays, setExpDays] = useState("");

  function save() {
    if (!code.trim()) { toast.error("Codigo obrigatorio"); return; }
    if (!dval.trim() || parseFloat(dval) <= 0) { toast.error("Valor do desconto obrigatorio"); return; }
    if (dtype === "percent" && parseFloat(dval) > 100) { toast.error("Max 100%"); return; }
    const data: any = { code: code.trim().toUpperCase(), description: desc.trim() || undefined, discount_type: dtype, discount_value: parseFloat(dval.replace(",", ".")), min_order_value: minOrd ? parseFloat(minOrd.replace(",", ".")) : 0, max_uses: maxUses ? parseInt(maxUses) : undefined };
    if (expDays && parseInt(expDays) > 0) { const d = new Date(); d.setDate(d.getDate() + parseInt(expDays)); data.expires_at = d.toISOString(); }
    onSave(data);
  }

  return (
    <View style={z.form}>
      <Text style={z.formTitle}>Novo cupom</Text>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Codigo *</Text><TextInput style={z.fInput} value={code} onChangeText={v => setCode(v.toUpperCase())} placeholder="DESCONTO10" placeholderTextColor={Colors.ink3} autoCapitalize="characters" /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Descricao</Text><TextInput style={z.fInput} value={desc} onChangeText={setDesc} placeholder="Lancamento..." placeholderTextColor={Colors.ink3} /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={z.fLabel}>Tipo</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable onPress={() => setDtype("percent")} style={[z.chip, dtype === "percent" && z.chipActive]}><Text style={[z.chipText, dtype === "percent" && z.chipTextActive]}>% Percentual</Text></Pressable>
            <Pressable onPress={() => setDtype("fixed")} style={[z.chip, dtype === "fixed" && z.chipActive]}><Text style={[z.chipText, dtype === "fixed" && z.chipTextActive]}>R$ Fixo</Text></Pressable>
          </View>
        </View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Valor *</Text><TextInput style={z.fInput} value={dval} onChangeText={setDval} placeholder={dtype === "percent" ? "10" : "15,00"} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Pedido min. (R$)</Text><TextInput style={z.fInput} value={minOrd} onChangeText={setMinOrd} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Limite de usos</Text><TextInput style={z.fInput} value={maxUses} onChangeText={setMaxUses} placeholder="Ilimitado" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Validade (dias)</Text><TextInput style={z.fInput} value={expDays} onChangeText={setExpDays} placeholder="Sem prazo" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
      </View>
      <View style={z.formFooter}>
        <Pressable onPress={onCancel} style={z.cancelBtn}><Text style={z.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={save} style={z.saveBtn}><Text style={z.saveText}>Criar cupom</Text></Pressable>
      </View>
    </View>
  );
}

export function TabCupons() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [delTarget, setDelTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["coupons", company?.id], queryFn: () => couponsApi.list(company!.id), enabled: !!company?.id && !isDemo, staleTime: 15000 });
  const coupons: Coupon[] = data?.coupons || [];
  const createMut = useMutation({ mutationFn: (body: any) => couponsApi.create(company!.id, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons", company?.id] }); setShowForm(false); toast.success("Cupom criado!"); }, onError: (e: any) => toast.error(e?.message || "Erro") });
  const toggleMut = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => couponsApi.update(company!.id, id, { is_active: active }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons", company?.id] }) });
  const delMut = useMutation({ mutationFn: (id: string) => couponsApi.remove(company!.id, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons", company?.id] }); toast.success("Cupom excluido"); }, onError: (e: any) => toast.error(e?.message || "Erro") });

  const active = coupons.filter(c => c.is_active).length;
  const totalUses = coupons.reduce((s, c) => s + c.current_uses, 0);

  return (
    <View>
      {/* KPIs */}
      <View style={z.kpiRow}>
        <View style={z.kpi}><Text style={z.kpiVal}>{coupons.length}</Text><Text style={z.kpiLabel}>Total</Text></View>
        <View style={z.kpi}><Text style={[z.kpiVal, { color: Colors.green }]}>{active}</Text><Text style={z.kpiLabel}>Ativos</Text></View>
        <View style={z.kpi}><Text style={[z.kpiVal, { color: Colors.violet3 }]}>{totalUses}</Text><Text style={z.kpiLabel}>Usos</Text></View>
      </View>

      {!showForm && (
        <Pressable onPress={() => setShowForm(true)} style={z.addBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={z.addBtnText}>Criar cupom</Text>
        </Pressable>
      )}

      {showForm && <CreateForm onSave={d => createMut.mutate(d)} onCancel={() => setShowForm(false)} />}

      {isLoading && <View style={{ alignItems: "center", paddingVertical: 30 }}><ActivityIndicator color={Colors.violet3} /></View>}

      {!isLoading && coupons.length === 0 && !showForm && (
        <EmptyState icon="star" iconColor={Colors.violet3} title="Nenhum cupom criado" subtitle="Crie cupons de desconto para oferecer aos seus clientes no caixa." actionLabel="Criar primeiro cupom" onAction={() => setShowForm(true)} />
      )}

      {coupons.length > 0 && (
        <View style={{ gap: 10, marginTop: 8 }}>
          {coupons.map(c => <CouponCard key={c.id} coupon={c} onToggle={() => toggleMut.mutate({ id: c.id, active: !c.is_active })} onDelete={() => setDelTarget(c.id)} />)}
        </View>
      )}

      <ConfirmDialog visible={!!delTarget} title="Excluir cupom?" message="Esta acao nao pode ser desfeita." confirmLabel="Excluir" destructive
        onConfirm={() => { if (delTarget) { delMut.mutate(delTarget); setDelTarget(null); } }} onCancel={() => setDelTarget(null)} />
    </View>
  );
}

const z = StyleSheet.create({
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kpiVal: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  kpiLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  addBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  cardCode: { fontSize: 15, fontWeight: "800", color: Colors.ink, letterSpacing: 1 },
  cardDesc: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cardDetails: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 10 },
  detailItem: { gap: 2 },
  detailLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  cardActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33" },
  delBtnText: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  form: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0, marginBottom: 4 },
  fLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  fInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  chip: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  formFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  saveText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default TabCupons;
