import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { couponsApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import type { CartItem } from "@/hooks/useCart";
import { DiscountSection } from "./DiscountSection";
import { PAYMENTS } from "@/hooks/useCart";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export type SlimCustomer = { id: string; name: string; phone?: string };
export type SlimEmployee = { id: string; name: string };

function CartRow({ item, onPlus, onMinus, onRemove, onSetQty }: {
  item: CartItem; onPlus: () => void; onMinus: () => void; onRemove: () => void; onSetQty: (qty: number) => void;
}) {
  const [h, sH] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const w = Platform.OS === "web";
  function startEdit() { setEditVal(String(item.qty)); setEditing(true); }
  function confirmEdit() { const v = parseInt(editVal); if (v > 0) onSetQty(v); setEditing(false); }
  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.row, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <Text style={s.unit}>{fmt(item.price)} / un</Text>
      </View>
      <View style={s.controls}>
        <Pressable onPress={onMinus} style={s.btn}><Text style={s.btnText}>-</Text></Pressable>
        {editing ? (
          <TextInput style={s.qtyInput} value={editVal} onChangeText={setEditVal} onBlur={confirmEdit} onSubmitEditing={confirmEdit} keyboardType="number-pad" autoFocus selectTextOnFocus />
        ) : (
          <Pressable onPress={startEdit}><Text style={s.qty}>{item.qty}</Text></Pressable>
        )}
        <Pressable onPress={onPlus} style={s.btn}><Text style={s.btnText}>+</Text></Pressable>
      </View>
      <Text style={s.total}>{fmt(item.price * item.qty)}</Text>
      <Pressable onPress={onRemove} style={s.removeBtn}><Text style={s.removeText}>x</Text></Pressable>
    </Pressable>
  );
}

function normalizePhone(p: string) { return p.replace(/\D/g, ""); }

export function CartPanel({
  cart, payment, setPayment, total, totalAfterCoupon, itemCount, isWide, setQty, updateQty, removeItem, finalizeSale, isProcessing,
  customers, employees,
  selectedCustomerId, selectCustomer,
  selectedEmployeeId, selectedEmployeeName, selectEmployee,
  sellerName, setSellerName, plan,
  discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
  couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
}: {
  cart: CartItem[]; payment: string; setPayment: (k: string) => void; total: number; totalAfterCoupon?: number; itemCount: number;
  isWide: boolean; setQty: (id: string, qty: number) => void; updateQty: (id: string, d: number) => void;
  removeItem: (id: string) => void; finalizeSale: () => void; isProcessing?: boolean;
  customers?: SlimCustomer[];
  employees?: SlimEmployee[];
  selectedCustomerId?: string | null;
  selectCustomer?: (id: string | null, name: string | null) => void;
  selectedEmployeeId?: string | null;
  selectedEmployeeName?: string | null;
  selectEmployee?: (id: string | null, name: string | null) => void;
  sellerName?: string;
  setSellerName?: (v: string) => void;
  plan?: string;
  discountType?: "%" | "R$";
  setDiscountType?: (t: "%" | "R$") => void;
  discountValue?: string;
  setDiscountValue?: (v: string) => void;
  manualDiscountAmount?: number;
  clearDiscount?: () => void;
  couponCode?: string;
  setCouponCode?: (v: string) => void;
  couponApplied?: { code: string; discount: number } | null;
  setCouponApplied?: (v: { code: string; discount: number } | null) => void;
  clearCoupon?: () => void;
}) {
  const { company } = useAuthStore();
  const [customerSearch, setCustomerSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showSellerInput, setShowSellerInput] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  const currentPlan = (plan || "essencial").toLowerCase();
  const isNegocioPlus = currentPlan === "negocio" || currentPlan === "expansao" || currentPlan === "personalizado";

  const matchedCustomers = customers && customerSearch.length >= 2
    ? customers.filter(c => {
        const q = customerSearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.phone ? normalizePhone(c.phone).includes(normalizePhone(customerSearch)) : false);
      }).slice(0, 6)
    : [];

  const matchedEmployees = employees && employeeSearch.length >= 1
    ? employees.filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase())).slice(0, 5)
    : (employees || []).slice(0, 8);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const selectedEmployee = employees?.find(e => e.id === selectedEmployeeId);
  const manyEmployees = (employees?.length || 0) > 5;
  const displayTotal = totalAfterCoupon ?? total;

  // Check if the typed seller name matches an existing employee
  const sellerNameTrimmed = (sellerName || "").trim();
  const sellerIsKnownEmployee = employees?.some(e => e.name.toLowerCase() === sellerNameTrimmed.toLowerCase());

  function handleSelectEmployee(id: string, name: string) {
    if (selectEmployee) selectEmployee(id, name);
    if (setSellerName) setSellerName(name);
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setShowSellerInput(false);
  }

  function handleClearSeller() {
    if (selectEmployee) selectEmployee(null, null);
    if (setSellerName) setSellerName("");
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setShowSellerInput(false);
  }

  function handleConfirmNewSeller() {
    if (!sellerNameTrimmed) return;
    setShowSellerInput(false);
    if (isNegocioPlus && !sellerIsKnownEmployee) {
      toast.info(`"${sellerNameTrimmed}" adicionada! Conclua o cadastro na Folha de Pagamento.`);
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode?.trim() || !company?.id || !setCouponApplied) return;
    setCouponLoading(true);
    try {
      const res = await couponsApi.validate(company.id, couponCode.trim(), total);
      if (res.valid) {
        setCouponApplied({ code: res.code || couponCode.trim().toUpperCase(), discount: res.discount_amount || 0 });
        toast.success(`Cupom ${res.code} aplicado! -${fmt(res.discount_amount || 0)}`);
      } else { toast.error(res.error || "Cupom invalido"); }
    } catch (err: any) { toast.error(err?.message || "Erro ao validar cupom"); }
    finally { setCouponLoading(false); }
  }

  // Display name for the active seller
  const activeSeller = selectedEmployee
    ? { name: selectedEmployee.name, isEmployee: true }
    : sellerNameTrimmed
      ? { name: sellerNameTrimmed, isEmployee: false }
      : null;

  return (
    <View style={{ padding: isWide ? 20 : 0, marginTop: isWide ? 0 : 8, flex: isWide ? 1 : undefined }}>
      {isWide ? (
        <View style={s.header}>
          <Text style={s.headerTitle}>Caixa</Text>
          {itemCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{itemCount}</Text></View>}
        </View>
      ) : itemCount > 0 ? (
        <View style={[s.header, s.mobileHeader]}>
          <Text style={s.mobileHeaderTitle}>Carrinho</Text>
          <View style={s.badge}><Text style={s.badgeText}>{itemCount} {itemCount === 1 ? "item" : "itens"}</Text></View>
        </View>
      ) : null}

      {cart.length === 0 && isWide && (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
          <Text style={{ fontSize: 32, color: Colors.ink3 }}>$</Text>
          <Text style={{ fontSize: 12, color: Colors.ink3, textAlign: "center" }}>Toque em um produto ou escaneie um codigo</Text>
        </View>
      )}

      <ScrollView style={{ maxHeight: isWide ? 240 : undefined }} showsVerticalScrollIndicator={false}>
        {cart.map(item => (
          <CartRow key={item.productId} item={item}
            onPlus={() => updateQty(item.productId, 1)}
            onMinus={() => updateQty(item.productId, -1)}
            onRemove={() => removeItem(item.productId)}
            onSetQty={(qty) => setQty(item.productId, qty)} />
        ))}
      </ScrollView>

      {cart.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={s.divider} />

          {/* Cliente */}
          {customers && selectCustomer && (
            <View style={{ marginBottom: 14 }}>
              <Text style={s.sectionLabel}>Cliente (opcional)</Text>
              {selectedCustomer ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 }}>
                    <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>{selectedCustomer.name}</Text>
                    {selectedCustomer.phone ? <Text style={{ fontSize: 10, color: Colors.ink3 }}>{selectedCustomer.phone}</Text> : null}
                  </View>
                  <Pressable onPress={() => { selectCustomer(null, null); setCustomerSearch(""); }} style={s.clearBtn}>
                    <Text style={{ color: Colors.red, fontWeight: "700", fontSize: 12 }}>x</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <TextInput style={s.searchSmall} value={customerSearch} onChangeText={setCustomerSearch} placeholder="Buscar por nome ou telefone..." placeholderTextColor={Colors.ink3} />
                  {matchedCustomers.length > 0 && (
                    <View style={s.dropdown}>
                      {matchedCustomers.map(c => (
                        <Pressable key={c.id} onPress={() => { selectCustomer(c.id, c.name); setCustomerSearch(""); }} style={s.dropdownItem}>
                          <Text style={{ fontSize: 12, color: Colors.ink, fontWeight: "500" }}>{c.name}</Text>
                          {c.phone && <Text style={{ fontSize: 10, color: Colors.ink3 }}>{c.phone}</Text>}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ══ Vendedor(a) — todos os planos ══ */}
          {setSellerName && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={s.sectionLabel}>Vendedor(a) (opcional)</Text>
                {!activeSeller && !showSellerInput && (
                  <Pressable onPress={() => setShowSellerInput(true)} style={s.addSellerBtn}>
                    <Icon name="plus" size={12} color={Colors.violet3} />
                  </Pressable>
                )}
              </View>

              {/* Seller selected — show badge */}
              {activeSeller && !showSellerInput ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 }}>
                    <Text style={{ fontSize: 13, color: Colors.violet3, fontWeight: "600" }}>{activeSeller.name}</Text>
                    {activeSeller.isEmployee && <Text style={{ fontSize: 9, color: Colors.ink3, marginTop: 1 }}>Cadastrada na Folha</Text>}
                    {!activeSeller.isEmployee && isNegocioPlus && <Text style={{ fontSize: 9, color: Colors.amber, marginTop: 1 }}>Cadastro pendente na Folha</Text>}
                  </View>
                  <Pressable onPress={handleClearSeller} style={s.clearBtn}>
                    <Text style={{ color: Colors.red, fontWeight: "700", fontSize: 12 }}>x</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Inline input — shown after clicking "+" */}
              {showSellerInput && (
                <View style={{ gap: 8 }}>
                  {/* For Negocio+: show existing employees first as chips */}
                  {isNegocioPlus && employees && employees.length > 0 && (
                    <View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingBottom: 6 }}>
                        {(manyEmployees ? matchedEmployees : employees).map(e => (
                          <Pressable key={e.id} onPress={() => handleSelectEmployee(e.id, e.name)}
                            style={[s.payChip, selectedEmployeeId === e.id && s.payChipActive]}>
                            <Text style={[s.payText, selectedEmployeeId === e.id && s.payTextActive]}>{e.name.split(" ")[0]}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <Text style={{ fontSize: 10, color: Colors.ink3, marginBottom: 4 }}>ou digite um novo nome:</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TextInput
                      style={[s.searchSmall, { flex: 1 }]}
                      value={sellerName || ""}
                      onChangeText={v => { setSellerName(v); if (selectEmployee) selectEmployee(null, null); }}
                      placeholder="Nome da vendedora..."
                      placeholderTextColor={Colors.ink3}
                      autoFocus
                      onSubmitEditing={handleConfirmNewSeller}
                    />
                    <Pressable onPress={handleConfirmNewSeller} style={[s.confirmSellerBtn, !sellerNameTrimmed && { opacity: 0.4 }]} disabled={!sellerNameTrimmed}>
                      <Icon name="check" size={14} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => { setShowSellerInput(false); handleClearSeller(); }} style={s.clearBtn}>
                      <Text style={{ color: Colors.red, fontWeight: "700", fontSize: 12 }}>x</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={s.divider} />
          <Text style={s.sectionLabel}>Pagamento</Text>
          <View style={s.payRow}>
            {PAYMENTS.map(p => (
              <Pressable key={p.key} onPress={() => setPayment(p.key)} style={[s.payChip, payment === p.key && s.payChipActive]}>
                <Text style={[s.payText, payment === p.key && s.payTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Cupom */}
          {setCouponCode && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.sectionLabel}>Cupom de desconto</Text>
              {couponApplied ? (
                <View style={s.couponApplied}>
                  <Icon name="check" size={14} color={Colors.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.couponAppliedCode}>{couponApplied.code}</Text>
                    <Text style={s.couponAppliedDiscount}>-{fmt(couponApplied.discount)}</Text>
                  </View>
                  <Pressable onPress={clearCoupon} style={s.clearBtn}>
                    <Text style={{ color: Colors.red, fontWeight: "700", fontSize: 12 }}>x</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={s.couponRow}>
                  <TextInput style={s.couponInput} value={couponCode} onChangeText={v => setCouponCode(v.toUpperCase())}
                    placeholder="Codigo do cupom" placeholderTextColor={Colors.ink3} autoCapitalize="characters" onSubmitEditing={handleApplyCoupon} />
                  <Pressable onPress={handleApplyCoupon} disabled={couponLoading || !couponCode?.trim()} style={[s.couponBtn, (!couponCode?.trim() || couponLoading) && { opacity: 0.5 }]}>
                    {couponLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.couponBtnText}>Aplicar</Text>}
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Manual discount */}
          {setDiscountType && setDiscountValue && (
            <View style={{ marginTop: 4 }}>
              <DiscountSection total={total} discountType={discountType || "%"} setDiscountType={setDiscountType}
                discountValue={discountValue || ""} setDiscountValue={setDiscountValue}
                manualDiscountAmount={manualDiscountAmount || 0} clearDiscount={clearDiscount || (() => {})} />
            </View>
          )}

          <View style={s.divider} />

          {/* Total */}
          <View style={s.totalRow}>
            <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "600" }}>Total</Text>
            <View style={{ alignItems: "flex-end" }}>
              {couponApplied && <Text style={s.totalOriginal}>{fmt(total)}</Text>}
              <Text style={{ fontSize: 24, color: Colors.green, fontWeight: "800", letterSpacing: -0.5 }}>{fmt(displayTotal)}</Text>
            </View>
          </View>
          <Pressable onPress={finalizeSale} disabled={isProcessing} style={[s.finalizeBtn, isProcessing && { opacity: 0.5 }]}>
            <Text style={s.finalizeText}>{isProcessing ? "Processando..." : "Finalizar venda"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  headerTitle: { fontSize: 16, color: Colors.ink, fontWeight: "700" },
  mobileHeader: { paddingTop: 16, paddingBottom: 4, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 12 },
  mobileHeaderTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  info: { flex: 1 }, name: { fontSize: 13, color: Colors.ink, fontWeight: "500" }, unit: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  qty: { fontSize: 14, color: Colors.ink, fontWeight: "700", minWidth: 28, textAlign: "center", paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4, backgroundColor: Colors.bg4 },
  qtyInput: { width: 44, height: 28, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.violet, textAlign: "center", fontSize: 14, color: Colors.ink, fontWeight: "700", paddingVertical: 0 },
  total: { fontSize: 13, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" },
  removeBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
  badge: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  sectionLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  payRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  payChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  payChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  payText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  payTextActive: { color: "#fff", fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  totalOriginal: { fontSize: 13, color: Colors.ink3, textDecorationLine: "line-through", marginBottom: 2 },
  finalizeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  finalizeText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  searchSmall: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: Colors.ink },
  dropdown: { backgroundColor: Colors.bg3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginTop: 4, maxHeight: 160, overflow: "hidden" },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  clearBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.red + "33" },
  addSellerBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet + "44", alignItems: "center", justifyContent: "center" },
  confirmSellerBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.ink, fontWeight: "600", letterSpacing: 1 },
  couponBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  couponBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  couponApplied: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.greenD, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.green + "33" },
  couponAppliedCode: { fontSize: 13, color: Colors.green, fontWeight: "700", letterSpacing: 1 },
  couponAppliedDiscount: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
});

export default CartPanel;
