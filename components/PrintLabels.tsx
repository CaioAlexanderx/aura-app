import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { generatePrintHTML } from "@/utils/codeGen";
import { toast } from "@/components/Toast";
import type { Product } from "@/components/screens/estoque/types";

type Props = {
  products: Product[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function PrintLabels({ products, selectedIds, onSelectionChange }: Props) {
  const [labelType, setLabelType] = useState<'barcode' | 'qr'>('barcode');
  const isWeb = Platform.OS === 'web';

  function toggleSelect(id: string) {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(i => i !== id)
        : [...selectedIds, id]
    );
  }

  function selectAll() {
    const withCode = products.filter(p => p.barcode || p.code).map(p => p.id);
    onSelectionChange(selectedIds.length === withCode.length ? [] : withCode);
  }

  function handlePrint() {
    if (!isWeb || selectedIds.length === 0) { toast.error('Selecione pelo menos um produto'); return; }
    const selected = products
      .filter(p => selectedIds.includes(p.id) && (p.barcode || p.code))
      .map(p => ({ name: p.name, code: p.barcode || p.code, price: p.price, type: labelType }));
    if (selected.length === 0) { toast.error('Produtos selecionados nao possuem codigo'); return; }
    const html = generatePrintHTML(selected);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    toast.success(`${selected.length} etiqueta(s) enviada(s) para impressao`);
  }

  const productsWithCode = products.filter(p => p.barcode || p.code);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Imprimir etiquetas</Text>
        <View style={s.typeToggle}>
          <Pressable onPress={() => setLabelType('barcode')} style={[s.typeBtn, labelType === 'barcode' && s.typeBtnActive]}>
            <Text style={[s.typeText, labelType === 'barcode' && s.typeTextActive]}>Codigo de barras</Text>
          </Pressable>
          <Pressable onPress={() => setLabelType('qr')} style={[s.typeBtn, labelType === 'qr' && s.typeBtnActive]}>
            <Text style={[s.typeText, labelType === 'qr' && s.typeTextActive]}>QR Code</Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={selectAll} style={s.selectAllBtn}>
        <Icon name="check" size={12} color={selectedIds.length === productsWithCode.length ? Colors.violet3 : Colors.ink3} />
        <Text style={s.selectAllText}>
          {selectedIds.length === productsWithCode.length ? 'Desmarcar todos' : `Selecionar todos (${productsWithCode.length})`}
        </Text>
      </Pressable>

      <View style={s.list}>
        {productsWithCode.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggleSelect(p.id)} style={[s.item, selected && s.itemSelected]}>
              <View style={[s.checkbox, selected && s.checkboxSelected]}>
                {selected && <Icon name="check" size={10} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.itemCode}>{p.barcode || p.code}</Text>
              </View>
              <Text style={s.itemPrice}>R$ {p.price.toFixed(2).replace('.', ',')}</Text>
            </Pressable>
          );
        })}
        {productsWithCode.length === 0 && (
          <Text style={s.emptyText}>Nenhum produto com codigo cadastrado</Text>
        )}
      </View>

      <Pressable onPress={handlePrint} style={[s.printBtn, selectedIds.length === 0 && { opacity: 0.5 }]} disabled={selectedIds.length === 0}>
        <Icon name="file_text" size={16} color="#fff" />
        <Text style={s.printBtnText}>Imprimir {selectedIds.length} etiqueta(s)</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  typeToggle: { flexDirection: 'row', gap: 4, backgroundColor: Colors.bg, borderRadius: 8, padding: 3 },
  typeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  typeBtnActive: { backgroundColor: Colors.violet },
  typeText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
  selectAllText: { fontSize: 12, color: Colors.ink3, fontWeight: '500' },
  list: { gap: 4, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: Colors.bg },
  itemSelected: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: '500' },
  itemCode: { fontSize: 10, color: Colors.ink3, marginTop: 1, fontFamily: 'monospace' },
  itemPrice: { fontSize: 13, color: Colors.ink, fontWeight: '700' },
  emptyText: { fontSize: 12, color: Colors.ink3, textAlign: 'center', paddingVertical: 16 },
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13 },
  printBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

export default PrintLabels;
