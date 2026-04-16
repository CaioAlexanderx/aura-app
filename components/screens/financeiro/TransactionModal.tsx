import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { INCOME_CATS, EXPENSE_CATS } from "./types";
import type { Transaction } from "./types";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { Icon } from "@/components/Icon";
import { useProducts } from "@/hooks/useProducts";
import { useAuthStore } from "@/stores/auth";
import { pdvApi, companiesApi, employeesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { PAYMENTS } from "@/hooks/useCart";

var isWeb = Platform.OS === "web";

function maskDate(v: string): string {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length >= 5) return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}

function dateToISO(br: string): string | null {
  var parts = br.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return null;
  var day = parseInt(parts[0]); var month = parseInt(parts[1]); var year = parseInt(parts[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2099) return null;
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function isoToBR(iso: string): string {
  try {
    var isDueDate = iso.length === 10;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: isDueDate ? "UTC" : "America/Sao_Paulo" });
  } catch { return todayBR(); }
}

function todayBR(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

function amountToMask(n: number): string {
  return maskCurrency(String(Math.round(n * 100)));
}

var fmtPrice = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };

type SaleItem = { cartKey: string; productId: string; variantId?: string; name: string; price: number; qty: number };

export function TransactionModal({ visible, onClose, onSave, onSaleCreated, editTransaction }: {
  visible: boolean; onClose: () => void;
  onSave: (body: { type: string; amount: number; description: string; category: string; due_date?: string }) => void;
  onSaleCreated?: () => void;
  editTransaction?: Transaction | null;
}) {
  var isEditing = !!editTransaction;
  var [txType, setTxType] = useState<"income" | "expense" | "sale">("income");
  var [mode, setMode] = useState<"unit" | "batch">("unit");
  var [amount, setAmount] = useState("");
  var [desc, setDesc] = useState("");
  var [category, setCategory] = useState("");
  var [dateStr, setDateStr] = useState(todayBR());
  var [batchText, setBatchText] = useState("");
  var [saving, setSaving] = useState(false);
  var isIncome = txType === "income";
  var isSale = txType === "sale";
  var cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  var { products } = useProducts();
  var { company } = useAuthStore();
  var qc = useQueryClient();
  var [saleSearch, setSaleSearch] = useState("");
  var [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  var [salePayment, setSalePayment] = useState("pix");
  var [saleSaving, setSaleSaving] = useState(false);
  var [variantPending, setVariantPending] = useState<any>(null);
  var [variantOptions, setVariantOptions] = useState<any[]>([]);
  var [variantLoading, setVariantLoading] = useState(false);

  var [custSearch, setCustSearch] = useState("");
  var [custId, setCustId] = useState<string | null>(null);
  var [custName, setCustName] = useState<string | null>(null);
  var [custOpen, setCustOpen] = useState(false);
  var [empSearch, setEmpSearch] = useState("");
  var [empId, setEmpId] = useState<string | null>(null);
  var [empName, setEmpName] = useState<string | null>(null);
  var [empOpen, setEmpOpen] = useState(false);

  var { data: custData } = useQuery({ queryKey: ["customers", company?.id], queryFn: function() { return companiesApi.customers(company!.id); }, enabled: !!company?.id && isSale, staleTime: 120_000 });
  var { data: empData } = useQuery({ queryKey: ["employees", company?.id], queryFn: function() { return employeesApi.list(company!.id); }, enabled: !!company?.id && isSale, staleTime: 120_000 });
  var allCustomers: any[] = custData?.customers || custData?.data || [];
  var allEmployees: any[] = empData?.employees || empData?.data || [];
  var filteredCustomers = useMemo(function() { if (!custSearch || custSearch.length < 2) return allCustomers.slice(0, 6); var q = custSearch.toLowerCase(); return allCustomers.filter(function(c: any) { return (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q); }).slice(0, 8); }, [allCustomers, custSearch]);
  var filteredEmployees = useMemo(function() { if (!empSearch || empSearch.length < 1) return allEmployees.slice(0, 6); var q = empSearch.toLowerCase(); return allEmployees.filter(function(e: any) { return (e.name || e.full_name || "").toLowerCase().includes(q); }).slice(0, 8); }, [allEmployees, empSearch]);

  var saleTotal = saleItems.reduce(function(s, i) { return s + i.price * i.qty; }, 0);

  // F-01: pre-fill form when editing
  useEffect(function() {
    if (editTransaction) {
      setTxType(editTransaction.type === "expense" ? "expense" : "income");
      setAmount(amountToMask(editTransaction.amount));
      setDesc(editTransaction.desc || "");
      setCategory(editTransaction.category || "");
      var raw = (editTransaction as any).due_date || (editTransaction as any).created_at;
      if (raw) setDateStr(isoToBR(raw));
      setMode("unit");
    }
  }, [editTransaction]);

  function reset() {
    setAmount(""); setDesc(""); setCategory(""); setDateStr(todayBR()); setBatchText(""); setMode("unit"); setSaving(false);
    setSaleSearch(""); setSaleItems([]); setSalePayment("pix"); setVariantPending(null); setVariantOptions([]);
    setCustSearch(""); setCustId(null); setCustName(null); setCustOpen(false);
    setEmpSearch(""); setEmpId(null); setEmpName(null); setEmpOpen(false);
  }

  function parseAmount(masked: string): number { var nums = unmaskNumber(masked); return nums ? parseInt(nums) / 100 : 0; }

  // F-01: save (create or update)
  async function handleSaveUnit() {
    var val = parseAmount(amount);
    if (!val || val <= 0) { toast.error("Informe um valor valido"); return; }
    if (!desc.trim()) { toast.error("Informe uma descricao"); return; }
    var dueDate: string | undefined;
    if (dateStr.trim()) { var iso = dateToISO(dateStr); if (!iso) { toast.error("Data invalida. Use DD/MM/AAAA"); return; } dueDate = iso; }

    if (isEditing && company?.id) {
      setSaving(true);
      try {
        await companiesApi.updateTransaction(company.id, editTransaction!.id, { type: txType, amount: val, description: desc.trim(), category: category || cats[0], due_date: dueDate });
        qc.invalidateQueries({ queryKey: ["transactions", company.id] });
        qc.invalidateQueries({ queryKey: ["dashboard", company.id] });
        qc.invalidateQueries({ queryKey: ["dre", company.id] });
        toast.success("Lancamento atualizado!");
        reset(); onClose();
      } catch (err: any) { toast.error(err?.message || "Erro ao atualizar"); }
      finally { setSaving(false); }
    } else {
      onSave({ type: txType, amount: val, description: desc.trim(), category: category || cats[0], due_date: dueDate });
      reset(); onClose();
    }
  }

  function handleSaveBatch() {
    var lines = batchText.trim().split("\n").filter(function(l) { return l.trim(); });
    if (lines.length === 0) { toast.error("Nenhum lancamento"); return; }
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(";").map(function(s) { return s.trim(); });
      if (parts.length < 2) continue;
      var val = parseFloat(parts[1].replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!val || val <= 0) continue;
      var batchDate: string | undefined;
      if (parts[3]) { var iso = dateToISO(parts[3]); if (iso) batchDate = iso; }
      onSave({ type: txType, amount: val, description: parts[0], category: parts[2] || cats[0], due_date: batchDate });
      count++;
    }
    if (count === 0) { toast.error("Formato invalido. Use: descricao;valor;categoria;data"); return; }
    toast.success(count + " lancamentos adicionados");
    reset(); onClose();
  }

  var saleFiltered = products.filter(function(p) { if (!saleSearch || saleSearch.length < 2) return false; return p.name.toLowerCase().includes(saleSearch.toLowerCase()); }).slice(0, 8);

  function handleAddSaleProduct(product: any) {
    if (product.has_variants) {
      setVariantPending(product); setVariantLoading(true);
      companiesApi.variants(company!.id, product.id).then(function(res) { setVariantOptions((res.variants || []).filter(function(v: any) { return v.is_active !== false; })); }).catch(function() { setVariantOptions([]); }).finally(function() { setVariantLoading(false); });
    } else { addSaleItem(product.id, null, product.name, product.price); setSaleSearch(""); }
  }
  function handleSelectVariant(v: any) {
    if (!variantPending) return;
    var attrs = v.attributes || [];
    var label = attrs.map(function(a: any) { if (/^#[0-9a-fA-F]{6}$/.test(a.value)) return hexToName(a.value); return a.value; }).filter(Boolean).join(" \u00b7 ") || v.sku_suffix || "Variante";
    var price = v.price_override ? parseFloat(v.price_override) : variantPending.price;
    addSaleItem(variantPending.id, v.id, variantPending.name + " (" + label + ")", price);
    setVariantPending(null); setVariantOptions([]); setSaleSearch("");
  }
  function addSaleItem(productId: string, variantId: string | null, name: string, price: number) {
    var key = variantId ? productId + "__" + variantId : productId;
    setSaleItems(function(prev) { var existing = prev.find(function(i) { return i.cartKey === key; }); if (existing) return prev.map(function(i) { return i.cartKey === key ? { ...i, qty: i.qty + 1 } : i; }); return [...prev, { cartKey: key, productId: productId, variantId: variantId || undefined, name: name, price: price, qty: 1 }]; });
  }
  function removeSaleItem(key: string) { setSaleItems(function(prev) { return prev.filter(function(i) { return i.cartKey !== key; }); }); }
  function updateSaleQty(key: string, delta: number) { setSaleItems(function(prev) { return prev.map(function(i) { if (i.cartKey !== key) return i; var nq = i.qty + delta; return nq > 0 ? { ...i, qty: nq } : i; }); }); }

  async function handleSaveSale() {
    if (saleItems.length === 0) { toast.error("Adicione pelo menos um produto"); return; }
    var iso = dateToISO(dateStr); if (!iso) { toast.error("Data invalida. Use DD/MM/AAAA"); return; }
    if (!company?.id) return; setSaleSaving(true);
    try {
      await pdvApi.createSale(company.id, { items: saleItems.map(function(i) { return { product_id: i.productId, variant_id: i.variantId || undefined, quantity: i.qty, unit_price: i.price, product_name_snapshot: i.name }; }), payment_method: salePayment, sale_date: iso, customer_id: custId || undefined, employee_id: empId || undefined });
      toast.success("Venda retroativa registrada!");
      qc.invalidateQueries({ queryKey: ["products", company.id] }); qc.invalidateQueries({ queryKey: ["transactions", company.id] }); qc.invalidateQueries({ queryKey: ["dashboard", company.id] }); qc.invalidateQueries({ queryKey: ["customers", company.id] }); qc.invalidateQueries({ queryKey: ["employees", company.id] });
      onSaleCreated?.(); reset(); onClose();
    } catch (err: any) { toast.error(err?.message || "Erro ao registrar venda"); } finally { setSaleSaving(false); }
  }

  if (!visible) return null;

  return (
    <View style={s.overlay}>
      <View style={[s.modal, isSale && { maxWidth: 540 }]}>
        <View style={s.header}>
          <Text style={s.title}>{isEditing ? "Editar lancamento" : "Novo lancamento"}</Text>
          <Pressable onPress={function() { reset(); onClose(); }} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
        </View>

        {/* Tipo: sem Venda quando editando */}
        <View style={s.toggleRow}>
          <Pressable onPress={function() { setTxType("income"); }} style={[s.toggleBtn, isIncome && { backgroundColor: Colors.greenD, borderColor: Colors.green }]}><Text style={[s.toggleText, isIncome && { color: Colors.green }]}>Receita</Text></Pressable>
          <Pressable onPress={function() { setTxType("expense"); }} style={[s.toggleBtn, !isIncome && !isSale && { backgroundColor: Colors.redD, borderColor: Colors.red }]}><Text style={[s.toggleText, !isIncome && !isSale && { color: Colors.red }]}>Despesa</Text></Pressable>
          {!isEditing && <Pressable onPress={function() { setTxType("sale"); }} style={[s.toggleBtn, isSale && { backgroundColor: Colors.violetD, borderColor: Colors.violet }]}><Text style={[s.toggleText, isSale && { color: Colors.violet3 }]}>Venda</Text></Pressable>}
        </View>

        {/* === RECEITA / DESPESA === */}
        {!isSale && (
          <>
            {!isEditing && <View style={s.modeRow}>{(["unit", "batch"] as const).map(function(m) { return <Pressable key={m} onPress={function() { setMode(m); }} style={[s.modeBtn, mode === m && s.modeBtnActive]}><Text style={[s.modeText, mode === m && s.modeTextActive]}>{m === "unit" ? "Unitario" : "Lote"}</Text></Pressable>; })}</View>}
            {(mode === "unit" || isEditing) ? (
              <View style={s.form}>
                <View style={s.rowFields}>
                  <View style={{ flex: 1 }}><Text style={s.label}>Valor (R$)</Text><TextInput style={s.input} value={amount} onChangeText={function(v) { setAmount(maskCurrency(v)); }} placeholder="R$ 0,00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
                  <View style={{ width: 130 }}><Text style={s.label}>Data</Text><TextInput style={s.input} value={dateStr} onChangeText={function(v) { setDateStr(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} /></View>
                </View>
                <Text style={s.label}>Descricao</Text>
                <TextInput style={s.input} value={desc} onChangeText={setDesc} placeholder="Ex: Venda cliente Maria" placeholderTextColor={Colors.ink3} />
                <Text style={s.label}>Categoria</Text>
                <View style={s.catGrid}>{cats.map(function(cat) { return <Pressable key={cat} onPress={function() { setCategory(cat); }} style={[s.catBtn, category === cat && s.catBtnActive]}><Text style={[s.catText, category === cat && s.catTextActive]}>{cat}</Text></Pressable>; })}</View>
                {!isEditing && <View style={s.dateHint}><Icon name="info" size={11} color={Colors.ink3} /><Text style={s.dateHintText}>Altere a data para lancar retroativamente. Padrao: hoje.</Text></View>}
                <Pressable onPress={handleSaveUnit} disabled={saving} style={[s.saveBtn, { backgroundColor: isEditing ? Colors.violet : (isIncome ? Colors.green : Colors.red), opacity: saving ? 0.6 : 1 }]}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{isEditing ? "Salvar alteracoes" : (isIncome ? "Lancar receita" : "Lancar despesa")}</Text>}
                </Pressable>
              </View>
            ) : (
              <View style={s.form}>
                <Text style={s.label}>Lancamentos em lote</Text>
                <Text style={s.hint}>Uma linha por lancamento: descricao;valor;categoria;data (opcional)</Text>
                <TextInput style={[s.input, { minHeight: 120, textAlignVertical: "top" }]} value={batchText} onChangeText={setBatchText} placeholder={"Venda A;150,00;Vendas;10/04/2026\nAluguel;1200,00;Fixas"} placeholderTextColor={Colors.ink3} multiline numberOfLines={6} />
                <Pressable onPress={handleSaveBatch} style={[s.saveBtn, { backgroundColor: isIncome ? Colors.green : Colors.red }]}><Text style={s.saveBtnText}>Lancar em lote</Text></Pressable>
              </View>
            )}
          </>
        )}

        {/* === VENDA RETROATIVA === */}
        {isSale && !isEditing && (
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={s.form}>
            <Text style={s.hint}>Registre uma venda que ja aconteceu. O estoque sera descontado e o lancamento criado na data informada.</Text>
            <View style={s.rowFields}>
              <View style={{ width: 130 }}><Text style={s.label}>Data da venda</Text><TextInput style={s.input} value={dateStr} onChangeText={function(v) { setDateStr(maskDate(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} /></View>
              <View style={{ flex: 1 }}><Text style={s.label}>Pagamento</Text><View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>{PAYMENTS.map(function(p) { return <Pressable key={p.key} onPress={function() { setSalePayment(p.key); }} style={[s.catBtn, salePayment === p.key && s.catBtnActive]}><Text style={[s.catText, salePayment === p.key && s.catTextActive]}>{p.label}</Text></Pressable>; })}</View></View>
            </View>
            <View style={{ zIndex: 20 }}><Text style={s.label}>Cliente (opcional)</Text>{custId ? (<View style={s.selectedChip}><Icon name="user" size={12} color={Colors.violet3} /><Text style={s.selectedChipText} numberOfLines={1}>{custName}</Text><Pressable onPress={function() { setCustId(null); setCustName(null); setCustSearch(""); }} style={s.chipRemove}><Text style={s.chipRemoveText}>x</Text></Pressable></View>) : (<View><TextInput style={s.input} value={custSearch} onChangeText={function(v) { setCustSearch(v); setCustOpen(true); }} onFocus={function() { setCustOpen(true); }} placeholder="Buscar cliente..." placeholderTextColor={Colors.ink3} />{custOpen && filteredCustomers.length > 0 && (<View style={s.dropdown}>{filteredCustomers.map(function(c: any) { return (<Pressable key={c.id} onPress={function() { setCustId(c.id); setCustName(c.name); setCustSearch(""); setCustOpen(false); }} style={s.dropdownRow}><Text style={s.srName} numberOfLines={1}>{c.name}</Text>{c.phone ? <Text style={s.srMeta}>{c.phone}</Text> : null}</Pressable>); })}</View>)}</View>)}</View>
            <View style={{ zIndex: 10 }}><Text style={s.label}>Vendedor(a) (opcional)</Text>{empId ? (<View style={s.selectedChip}><Icon name="user" size={12} color={Colors.violet3} /><Text style={s.selectedChipText} numberOfLines={1}>{empName}</Text><Pressable onPress={function() { setEmpId(null); setEmpName(null); setEmpSearch(""); }} style={s.chipRemove}><Text style={s.chipRemoveText}>x</Text></Pressable></View>) : (<View><TextInput style={s.input} value={empSearch} onChangeText={function(v) { setEmpSearch(v); setEmpOpen(true); }} onFocus={function() { setEmpOpen(true); }} placeholder="Buscar vendedor(a)..." placeholderTextColor={Colors.ink3} />{empOpen && filteredEmployees.length > 0 && (<View style={s.dropdown}>{filteredEmployees.map(function(e: any) { var eName = e.name || e.full_name || "Sem nome"; return (<Pressable key={e.id} onPress={function() { setEmpId(e.id); setEmpName(eName); setEmpSearch(""); setEmpOpen(false); }} style={s.dropdownRow}><Text style={s.srName} numberOfLines={1}>{eName}</Text>{e.role ? <Text style={s.srMeta}>{e.role}</Text> : null}</Pressable>); })}</View>)}</View>)}</View>
            <Text style={s.label}>Produto</Text>
            <TextInput style={s.input} value={saleSearch} onChangeText={setSaleSearch} placeholder="Buscar produto por nome..." placeholderTextColor={Colors.ink3} />
            {saleFiltered.length > 0 && !variantPending && (<View style={s.searchResults}>{saleFiltered.map(function(p) { return (<Pressable key={p.id} onPress={function() { handleAddSaleProduct(p); }} style={s.searchResultRow}><View style={{ flex: 1 }}><Text style={s.srName} numberOfLines={1}>{p.name}</Text><Text style={s.srMeta}>{fmtPrice(p.price)} {"\u00b7"} {p.stock} un{p.has_variants ? " \u00b7 Variantes" : ""}</Text></View>{p.color && /^#/.test(p.color) && <View style={[s.srColor, { backgroundColor: p.color }]} />}</Pressable>); })}</View>)}
            {variantPending && (<View style={s.variantBlock}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><Text style={s.variantTitle}>Selecione a variante de "{variantPending.name}"</Text><Pressable onPress={function() { setVariantPending(null); setVariantOptions([]); }}><Text style={{ fontSize: 12, color: Colors.red }}>Cancelar</Text></Pressable></View>{variantLoading ? (<ActivityIndicator color={Colors.violet3} />) : variantOptions.length === 0 ? (<Text style={s.hint}>Nenhuma variante encontrada</Text>) : (<View style={{ gap: 6 }}>{variantOptions.map(function(v: any) { var attrs = v.attributes || []; var label = attrs.map(function(a: any) { return /^#[0-9a-fA-F]{6}$/.test(a.value) ? hexToName(a.value) : a.value; }).filter(Boolean).join(" \u00b7 ") || v.sku_suffix; var stock = parseInt(v.stock_qty) || 0; var hex = attrs.find(function(a: any) { return /^#/.test(a.value); })?.value; return (<Pressable key={v.id} onPress={function() { handleSelectVariant(v); }} style={s.variantOption}>{hex && <View style={[s.srColor, { backgroundColor: hex, width: 20, height: 20 }]} />}<Text style={s.srName}>{label}</Text><Text style={s.srMeta}>{stock} un</Text></Pressable>); })}</View>)}</View>)}
            {saleItems.length > 0 && (<View style={s.miniCart}><Text style={s.label}>Itens da venda</Text>{saleItems.map(function(item) { return (<View key={item.cartKey} style={s.miniCartRow}><View style={{ flex: 1 }}><Text style={s.srName} numberOfLines={1}>{item.name}</Text><Text style={s.srMeta}>{fmtPrice(item.price)} x {item.qty} = {fmtPrice(item.price * item.qty)}</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Pressable onPress={function() { updateSaleQty(item.cartKey, -1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>-</Text></Pressable><Text style={s.qtyText}>{item.qty}</Text><Pressable onPress={function() { updateSaleQty(item.cartKey, 1); }} style={s.qtyBtn}><Text style={s.qtyBtnText}>+</Text></Pressable><Pressable onPress={function() { removeSaleItem(item.cartKey); }} style={s.removeBtn}><Text style={s.removeText}>x</Text></Pressable></View></View>); })}<View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}><Text style={{ fontSize: 14, fontWeight: "600", color: Colors.ink }}>Total</Text><Text style={{ fontSize: 16, fontWeight: "800", color: Colors.green }}>{fmtPrice(saleTotal)}</Text></View></View>)}
            <Pressable onPress={handleSaveSale} disabled={saleSaving || saleItems.length === 0} style={[s.saveBtn, { backgroundColor: Colors.violet, opacity: saleSaving || saleItems.length === 0 ? 0.5 : 1 }]}>{saleSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Registrar venda retroativa</Text>}</Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  overlay: { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 28, maxWidth: 480, width: "90%", borderWidth: 1, borderColor: Colors.border2, maxHeight: "90%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  toggleText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bg4 },
  modeBtnActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.violet },
  modeText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  modeTextActive: { color: Colors.violet3 },
  form: { gap: 12 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 10.5, color: Colors.ink3, fontStyle: "italic", lineHeight: 15 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  rowFields: { flexDirection: "row", gap: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  catBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  catText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  catTextActive: { color: Colors.violet3, fontWeight: "600" },
  dateHint: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  dateHintText: { fontSize: 10, color: Colors.ink3 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  searchResults: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: "hidden" },
  searchResultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  srName: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  srMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  srColor: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  variantBlock: { backgroundColor: Colors.violetD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border2 },
  variantTitle: { fontSize: 12, color: Colors.violet3, fontWeight: "700", flex: 1 },
  variantOption: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  miniCart: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  miniCartRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  qtyText: { fontSize: 13, color: Colors.ink, fontWeight: "700", minWidth: 20, textAlign: "center" },
  removeBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  removeText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
  selectedChip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.violet },
  selectedChipText: { flex: 1, fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  chipRemove: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  chipRemoveText: { fontSize: 11, color: Colors.ink3, fontWeight: "700" },
  dropdown: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, marginTop: 4, maxHeight: 180, overflow: "hidden" },
  dropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
});

export default TransactionModal;
