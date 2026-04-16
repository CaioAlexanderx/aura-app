// ============================================================
// AURA. -- VariantPickerModal
// Modal para selecionar variante de um produto (cor/tamanho/etc)
// Usado no PDV (Fase C) e na Venda retroativa (TransactionModal).
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { hexToName } from "@/utils/colorNames";

export type VariantChoice = {
  id: string;
  label: string;
  price: number;
  stock: number;
  barcode?: string;
};

var isWeb = Platform.OS === "web";

function getLabel(v: any): string {
  var attrs = v.attributes || [];
  var parts: string[] = [];
  for (var a of attrs) {
    if (!a.value) continue;
    // Se o valor parece um hex, converte pra nome
    if (/^#[0-9a-fA-F]{6}$/.test(a.value)) parts.push(hexToName(a.value));
    else parts.push(a.value);
  }
  return parts.join(" \u00b7 ") || v.sku_suffix || "Variante";
}

function getColor(v: any): string | null {
  var attrs = v.attributes || [];
  for (var a of attrs) {
    if (/^#[0-9a-fA-F]{6}$/.test(a.value)) return a.value;
  }
  return null;
}

export function VariantPickerModal({ visible, product, onSelect, onClose }: {
  visible: boolean;
  product: { id: string; name: string; price: number } | null;
  onSelect: (variant: VariantChoice) => void;
  onClose: () => void;
}) {
  var { company } = useAuthStore();
  var [variants, setVariants] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);

  useEffect(function() {
    if (!visible || !product || !company?.id) { setVariants([]); return; }
    setLoading(true);
    companiesApi.variants(company.id, product.id)
      .then(function(res) { setVariants(res.variants || []); })
      .catch(function() { setVariants([]); })
      .finally(function() { setLoading(false); });
  }, [visible, product?.id, company?.id]);

  if (!visible || !product) return null;

  var activeVariants = variants.filter(function(v: any) { return v.is_active !== false; });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Qual variante?</Text>
            <Pressable onPress={onClose} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
          </View>
          <Text style={s.productName} numberOfLines={1}>{product.name}</Text>

          {loading ? (
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <ActivityIndicator color={Colors.violet3} />
            </View>
          ) : activeVariants.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={s.empty}>Nenhuma variante ativa encontrada</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
              {activeVariants.map(function(v: any) {
                var label = getLabel(v);
                var effectivePrice = v.price_override ? parseFloat(v.price_override) : product.price;
                var stock = parseInt(v.stock_qty) || 0;
                var hex = getColor(v);
                return (
                  <Pressable key={v.id} onPress={function() { onSelect({ id: v.id, label: label, price: effectivePrice, stock: stock, barcode: v.barcode }); }}
                    style={[s.variantRow, isWeb && { cursor: "pointer", transition: "all 0.15s ease" } as any]}>
                    {hex && <View style={[s.colorDot, { backgroundColor: hex }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.variantLabel}>{label}</Text>
                      <Text style={s.variantMeta}>
                        R$ {effectivePrice.toFixed(2).replace(".", ",")} \u00b7 {stock} un
                        {v.barcode ? " \u00b7 ..." + String(v.barcode).slice(-4) : ""}
                      </Text>
                    </View>
                    <View style={[s.stockBadge, stock < 3 && { backgroundColor: Colors.redD }]}>
                      <Text style={[s.stockText, stock < 3 && { color: Colors.red }]}>{stock}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

var s = StyleSheet.create({
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 200 },
  sheet: { backgroundColor: Colors.bg3, borderRadius: 20, maxWidth: 440, width: "90%", borderWidth: 1, borderColor: Colors.border2, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  productName: { fontSize: 13, color: Colors.ink3, paddingHorizontal: 20, marginBottom: 8 },
  empty: { fontSize: 13, color: Colors.ink3 },
  variantRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  variantLabel: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  variantMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  stockBadge: {
    backgroundColor: Colors.violetD, borderRadius: 8,
    minWidth: 32, height: 32, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  stockText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

export default VariantPickerModal;
