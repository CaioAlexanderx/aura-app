import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useProducts } from "@/hooks/useProducts";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";
import { hexToName } from "@/utils/colorNames";

// ============================================================
// AURA. — Picker pra adicionar produto numa venda existente (EXTRA C)
//
// Renderiza dentro do SaleDetailsSection. Fluxo:
//   1. Cliente clica "+ Adicionar produto"
//   2. Aparece campo de busca de produto + qty
//   3. Click num resultado:
//      - sem variantes: chama addItem(product_id, qty) direto
//      - com variantes: mostra picker de variantes
//   4. Picker fechado depois do sucesso
//
// Props:
//   - onAdd(body): callback que executa a mutation
//   - isAdding: flag de loading
//   - onCancel: callback pra fechar o picker
// ============================================================

var fmtPrice = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ","); };

type AddItemBody = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price?: number;
  product_name_snapshot?: string;
};

export function AddItemPicker({
  onAdd, isAdding, onCancel,
}: {
  onAdd: (body: AddItemBody) => Promise<{ ok: boolean; new_sale_total: number; new_tx_amount: number }>;
  isAdding: boolean;
  onCancel: () => void;
}) {
  const { products } = useProducts();
  const { company } = useAuthStore();
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState("1");
  const [variantPending, setVariantPending] = useState<any>(null);
  const [variantOptions, setVariantOptions] = useState<any[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);

  const filtered = search.length >= 2
    ? products.filter(function(p) { return p.name.toLowerCase().includes(search.toLowerCase()); }).slice(0, 6)
    : [];

  const parsedQty = Math.max(1, parseInt(qty) || 1);

  async function handleSelectProduct(product: any) {
    if (product.has_variants) {
      // Carrega variantes
      setVariantPending(product);
      setVariantLoading(true);
      try {
        const res = await companiesApi.variants(company!.id, product.id);
        const active = (res.variants || []).filter(function(v: any) { return v.is_active !== false; });
        setVariantOptions(active);
      } catch {
        setVariantOptions([]);
        toast.error("Erro ao carregar variantes");
      } finally {
        setVariantLoading(false);
      }
    } else {
      // Sem variantes — adiciona direto
      await doAdd(product, null);
    }
  }

  async function handleSelectVariant(variant: any) {
    if (!variantPending) return;
    await doAdd(variantPending, variant);
  }

  async function doAdd(product: any, variant: any | null) {
    const stockToCheck = variant
      ? parseFloat(variant.stock_qty || 0)
      : parseFloat(product.stock || product.stock_qty || 0);

    if (stockToCheck < parsedQty) {
      toast.error("Estoque insuficiente: disponivel " + stockToCheck + " un");
      return;
    }

    const attrs = variant?.attributes || [];
    const variantLabel = attrs
      .map(function(a: any) { return /^#[0-9a-fA-F]{6}$/.test(a.value) ? hexToName(a.value) : a.value; })
      .filter(Boolean).join(" \u00b7 ") || variant?.sku_suffix || "";

    const displayName = variant ? product.name + " (" + variantLabel + ")" : product.name;
    const effectivePrice = variant?.price_override
      ? parseFloat(variant.price_override)
      : product.price;

    try {
      const result = await onAdd({
        product_id: product.id,
        variant_id: variant?.id || null,
        quantity: parsedQty,
        unit_price: effectivePrice,
        product_name_snapshot: displayName,
      });
      if (result.ok) {
        toast.success(displayName + " adicionado. Novo total: " + fmtPrice(result.new_sale_total));
        // Reset state pra adicionar outro
        setSearch("");
        setQty("1");
        setVariantPending(null);
        setVariantOptions([]);
      }
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Erro ao adicionar item");
    }
  }

  function handleCancelVariant() {
    setVariantPending(null);
    setVariantOptions([]);
  }

  return (
    <View style={s.box}>
      <View style={s.header}>
        <Icon name="plus" size={12} color={Colors.violet3} />
        <Text style={s.title}>Adicionar produto</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}>
          <Text style={s.closeText}>x</Text>
        </Pressable>
      </View>

      {!variantPending && (
        <>
          <View style={s.searchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Buscar produto</Text>
              <TextInput
                style={s.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Digite ao menos 2 letras..."
                placeholderTextColor={Colors.ink3}
                autoFocus
              />
            </View>
            <View style={{ width: 70 }}>
              <Text style={s.label}>Qtd</Text>
              <TextInput
                style={[s.input, { textAlign: "center" }]}
                value={qty}
                onChangeText={setQty}
                placeholder="1"
                placeholderTextColor={Colors.ink3}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {filtered.length > 0 && (
            <View style={s.results}>
              {filtered.map(function(p) {
                const stock = parseFloat(p.stock || p.stock_qty || 0);
                const lowStock = stock < parsedQty;
                return (
                  <Pressable
                    key={p.id}
                    onPress={function() { handleSelectProduct(p); }}
                    disabled={isAdding}
                    style={[s.resultRow, isAdding && { opacity: 0.5 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultName} numberOfLines={1}>{p.name}</Text>
                      <Text style={[s.resultMeta, lowStock && { color: Colors.red }]}>
                        {fmtPrice(p.price)} {"\u00b7"} {stock} un{p.has_variants ? " \u00b7 Variantes" : ""}
                        {lowStock && " (estoque baixo)"}
                      </Text>
                    </View>
                    {p.color && /^#/.test(p.color) && (
                      <View style={[s.resultColor, { backgroundColor: p.color }]} />
                    )}
                    <Icon name="plus" size={12} color={Colors.violet3} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {search.length >= 2 && filtered.length === 0 && (
            <Text style={s.empty}>Nenhum produto encontrado pra "{search}"</Text>
          )}
        </>
      )}

      {variantPending && (
        <View style={s.variantBlock}>
          <View style={s.variantHeader}>
            <Text style={s.variantTitle} numberOfLines={1}>
              Variante de "{variantPending.name}"
            </Text>
            <Pressable onPress={handleCancelVariant}>
              <Text style={s.variantCancel}>Voltar</Text>
            </Pressable>
          </View>
          {variantLoading && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={s.loadingText}>Carregando variantes...</Text>
            </View>
          )}
          {!variantLoading && variantOptions.length === 0 && (
            <Text style={s.empty}>Nenhuma variante encontrada</Text>
          )}
          {!variantLoading && variantOptions.map(function(v: any) {
            const attrs = v.attributes || [];
            const label = attrs
              .map(function(a: any) { return /^#[0-9a-fA-F]{6}$/.test(a.value) ? hexToName(a.value) : a.value; })
              .filter(Boolean).join(" \u00b7 ") || v.sku_suffix || "Variante";
            const stock = parseFloat(v.stock_qty || 0);
            const lowStock = stock < parsedQty;
            const hex = attrs.find(function(a: any) { return /^#/.test(a.value); })?.value;
            return (
              <Pressable
                key={v.id}
                onPress={function() { handleSelectVariant(v); }}
                disabled={isAdding || lowStock}
                style={[s.variantRow, (isAdding || lowStock) && { opacity: 0.5 }]}
              >
                {hex && <View style={[s.variantColor, { backgroundColor: hex }]} />}
                <Text style={s.variantLabel}>{label}</Text>
                <Text style={[s.variantStock, lowStock && { color: Colors.red }]}>
                  {stock} un
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isAdding && (
        <View style={s.savingBar}>
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={s.savingText}>Adicionando...</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 12, color: Colors.violet3, fontWeight: "700", flex: 1, textTransform: "uppercase", letterSpacing: 0.4 },
  closeBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 12, color: Colors.ink3, fontWeight: "700" },

  searchRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  label: { fontSize: 9, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.ink },

  results: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  resultMeta: { fontSize: 10.5, color: Colors.ink3, marginTop: 2 },
  resultColor: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },

  empty: { fontSize: 11, color: Colors.ink3, fontStyle: "italic", textAlign: "center", padding: 12 },

  variantBlock: { backgroundColor: Colors.bg4, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
  variantHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  variantTitle: { fontSize: 11, color: Colors.ink, fontWeight: "700", flex: 1 },
  variantCancel: { fontSize: 11, color: Colors.red, fontWeight: "600" },
  variantRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 6, backgroundColor: Colors.bg3, marginBottom: 4 },
  variantColor: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  variantLabel: { flex: 1, fontSize: 11, color: Colors.ink, fontWeight: "600" },
  variantStock: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  loadingText: { fontSize: 11, color: Colors.ink3 },
  savingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, paddingVertical: 8, backgroundColor: Colors.violetD, borderRadius: 6 },
  savingText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
});

export default AddItemPicker;
