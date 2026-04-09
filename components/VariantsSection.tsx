import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

type Variant = {
  id?: string;
  sku_suffix: string;
  price_override: number | null;
  stock_qty: number;
  attributes: { attribute: string; value: string }[];
};

type Props = {
  productId: string;
  productName: string;
  basePrice: number;
  variants: Variant[];
  onUpdate: () => void;
};

export function VariantsSection({ productId, productName, basePrice, variants, onUpdate }: Props) {
  const { company } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [attrName, setAttrName] = useState('Cor');
  const [attrValue, setAttrValue] = useState('');
  const [attributes, setAttributes] = useState<{ attribute: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  function addAttribute() {
    if (!attrName.trim() || !attrValue.trim()) { toast.error('Preencha nome e valor do atributo'); return; }
    setAttributes(prev => [...prev, { attribute: attrName.trim(), value: attrValue.trim() }]);
    setAttrValue('');
  }

  async function handleSave() {
    if (!company?.id || !sku.trim()) { toast.error('SKU obrigatorio'); return; }
    if (attributes.length === 0) { toast.error('Adicione pelo menos um atributo'); return; }
    setSaving(true);
    try {
      await companiesApi.createVariant(company.id, productId, {
        sku_suffix: sku.trim(),
        price_override: priceOverride ? parseFloat(priceOverride.replace(',', '.')) : null,
        stock_qty: parseInt(stockQty) || 0,
        attributes,
      });
      toast.success('Variante criada');
      setShowForm(false); setSku(''); setPriceOverride(''); setStockQty('0'); setAttributes([]);
      onUpdate();
    } catch (err: any) { toast.error(err?.message || 'Erro ao criar variante'); }
    finally { setSaving(false); }
  }

  async function handleDelete(variantId: string) {
    if (!company?.id) return;
    try {
      await companiesApi.deleteVariant(company.id, productId, variantId);
      toast.success('Variante removida');
      onUpdate();
    } catch { toast.error('Erro ao remover'); }
  }

  const ATTR_PRESETS = ['Cor', 'Tamanho', 'Material', 'Peso', 'Sabor', 'Volume'];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Variantes</Text>
        <Pressable onPress={() => setShowForm(!showForm)} style={s.addBtn}>
          <Icon name="plus" size={12} color={Colors.violet3} />
          <Text style={s.addText}>Adicionar</Text>
        </Pressable>
      </View>

      {/* Existing variants */}
      {variants.length > 0 && (
        <View style={s.list}>
          {variants.map((v, i) => (
            <View key={v.id || i} style={s.variantRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.varSku}>{v.sku_suffix}</Text>
                <Text style={s.varAttrs}>{v.attributes?.map(a => `${a.attribute}: ${a.value}`).join(' / ') || '—'}</Text>
              </View>
              <Text style={s.varPrice}>{v.price_override ? `R$ ${v.price_override.toFixed(2).replace('.', ',')}` : `R$ ${basePrice.toFixed(2).replace('.', ',')}`}</Text>
              <Text style={s.varStock}>{v.stock_qty} un</Text>
              {v.id && <Pressable onPress={() => handleDelete(v.id!)} style={s.delBtn}><Icon name="x" size={12} color={Colors.red} /></Pressable>}
            </View>
          ))}
        </View>
      )}
      {variants.length === 0 && !showForm && <Text style={s.empty}>Nenhuma variante. Adicione cores, tamanhos, etc.</Text>}

      {/* Add form */}
      {showForm && (
        <View style={s.form}>
          <View style={s.formRow}>
            <View style={{ flex: 1 }}><Text style={s.label}>SKU *</Text><TextInput style={s.input} value={sku} onChangeText={setSku} placeholder="ROSA-38" placeholderTextColor={Colors.ink3} /></View>
            <View style={{ flex: 1 }}><Text style={s.label}>Preco (override)</Text><TextInput style={s.input} value={priceOverride} onChangeText={setPriceOverride} placeholder={basePrice.toFixed(2)} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Text style={s.label}>Estoque</Text><TextInput style={s.input} value={stockQty} onChangeText={setStockQty} placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
          </View>

          <Text style={[s.label, { marginTop: 8 }]}>Atributos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
            {ATTR_PRESETS.map(p => <Pressable key={p} onPress={() => setAttrName(p)} style={[s.presetChip, attrName === p && s.presetActive]}><Text style={[s.presetText, attrName === p && { color: Colors.violet3 }]}>{p}</Text></Pressable>)}
          </ScrollView>
          <View style={s.attrRow}>
            <TextInput style={[s.input, { flex: 1 }]} value={attrName} onChangeText={setAttrName} placeholder="Atributo" placeholderTextColor={Colors.ink3} />
            <TextInput style={[s.input, { flex: 1 }]} value={attrValue} onChangeText={setAttrValue} placeholder="Valor" placeholderTextColor={Colors.ink3} onSubmitEditing={addAttribute} />
            <Pressable onPress={addAttribute} style={s.attrAddBtn}><Icon name="plus" size={14} color="#fff" /></Pressable>
          </View>
          {attributes.length > 0 && (
            <View style={s.attrList}>
              {attributes.map((a, i) => (
                <View key={i} style={s.attrChip}>
                  <Text style={s.attrChipText}>{a.attribute}: {a.value}</Text>
                  <Pressable onPress={() => setAttributes(prev => prev.filter((_, j) => j !== i))}><Icon name="x" size={10} color={Colors.ink3} /></Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={s.formActions}>
            <Pressable onPress={() => setShowForm(false)} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}><Text style={s.saveText}>{saving ? 'Salvando...' : 'Salvar variante'}</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 12, fontWeight: '600', color: Colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border2 },
  addText: { fontSize: 11, color: Colors.violet3, fontWeight: '600' },
  list: { gap: 4, marginBottom: 8 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 10 },
  varSku: { fontSize: 12, fontWeight: '600', color: Colors.ink, fontFamily: 'monospace' },
  varAttrs: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  varPrice: { fontSize: 12, color: Colors.ink, fontWeight: '600' },
  varStock: { fontSize: 11, color: Colors.ink3 },
  delBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 11, color: Colors.ink3, textAlign: 'center', paddingVertical: 12 },
  form: { backgroundColor: Colors.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  formRow: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  presetActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  presetText: { fontSize: 10, color: Colors.ink3, fontWeight: '500' },
  attrRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  attrAddBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.violet, alignItems: 'center', justifyContent: 'center' },
  attrList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  attrChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border2 },
  attrChipText: { fontSize: 10, color: Colors.violet3, fontWeight: '500' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.violet },
  saveText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});

export default VariantsSection;
