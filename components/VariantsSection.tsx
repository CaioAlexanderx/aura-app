import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, ActivityIndicator } from "react-native";
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

const PRESET_COLORS = [
  { label: "Preto", hex: "#000000" }, { label: "Branco", hex: "#ffffff" },
  { label: "Vermelho", hex: "#ef4444" }, { label: "Azul", hex: "#3b82f6" },
  { label: "Verde", hex: "#22c55e" }, { label: "Rosa", hex: "#ec4899" },
  { label: "Roxo", hex: "#8b5cf6" }, { label: "Amarelo", hex: "#eab308" },
  { label: "Laranja", hex: "#f97316" }, { label: "Marrom", hex: "#92400e" },
];

const ATTR_PRESETS = ["Cor", "Tamanho", "Material", "Peso", "Sabor", "Volume"];

export function VariantsSection({ productId, productName, basePrice, variants, onUpdate }: Props) {
  const { company } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [attrName, setAttrName] = useState('Cor');
  const [attrValue, setAttrValue] = useState('');
  const [attrHex, setAttrHex] = useState('');
  const [attributes, setAttributes] = useState<{ attribute: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const isColorAttr = attrName.toLowerCase() === 'cor';

  function addAttribute() {
    if (!attrName.trim() || !attrValue.trim()) { toast.error('Preencha nome e valor'); return; }
    const val = isColorAttr && attrHex ? `${attrValue.trim()} (${attrHex})` : attrValue.trim();
    setAttributes(prev => [...prev, { attribute: attrName.trim(), value: val }]);
    setAttrValue(''); setAttrHex('');
  }

  function selectPresetColor(c: { label: string; hex: string }) {
    setAttrValue(c.label);
    setAttrHex(c.hex);
  }

  function openCustomColor() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'color'; input.value = attrHex || '#6d28d9';
    input.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(input);
    input.addEventListener('change', (e: any) => {
      setAttrHex(e.target.value);
      if (!attrValue.trim()) setAttrValue('Personalizada');
      document.body.removeChild(input);
    });
    input.addEventListener('blur', () => { try { document.body.removeChild(input); } catch {} });
    input.click();
  }

  async function handleSave() {
    if (!company?.id) { toast.error('Sessao expirada'); return; }
    setSaving(true);
    try {
      await companiesApi.createVariant(company.id, productId, {
        sku_suffix: '',
        price_override: price ? parseFloat(price.replace(',', '.')) : null,
        stock_qty: parseInt(stockQty) || 0,
        attributes,
      });
      toast.success('Variante criada');
      setShowForm(false); setPrice(''); setStockQty('0'); setAttributes([]);
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

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // Extrai hex embutido no valor (ex: "Preto (#000000)") e retorna { clean, hex }
  function parseAttrValue(rawVal: string): { clean: string; hex: string | null } {
    const raw = String(rawVal || '');
    const hexMatch = raw.match(/#[0-9a-f]{6}/i);
    const clean = raw.replace(/\s*\(#[0-9a-f]{6}\)/i, '').trim();
    return { clean: clean || raw, hex: hexMatch ? hexMatch[0] : null };
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Variantes</Text>
          <Text style={s.hint}>Cores, tamanhos ou qualquer variacao do produto</Text>
        </View>
        <Pressable onPress={() => setShowForm(!showForm)} style={s.addBtn}>
          <Icon name="plus" size={12} color={Colors.violet3} />
          <Text style={s.addText}>{showForm ? 'Cancelar' : 'Adicionar'}</Text>
        </Pressable>
      </View>

      {/* Existing variants */}
      {variants.length > 0 && (
        <View style={s.list}>
          {variants.map((v, i) => {
            const hasAttrs = v.attributes && v.attributes.length > 0;
            return (
              <View key={v.id || i} style={s.variantRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {hasAttrs ? (
                    <View style={s.varAttrsRow}>
                      {v.attributes.map((a, idx) => {
                        const { clean, hex } = parseAttrValue(a.value);
                        return (
                          <View key={idx} style={s.varAttrChip}>
                            <Text style={s.varAttrKey}>{a.attribute}:</Text>
                            {hex ? <View style={[s.varAttrDot, { backgroundColor: hex }]} /> : null}
                            <Text style={s.varAttrVal}>{clean}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={s.varLabel}>{v.sku_suffix}</Text>
                  )}
                  <Text style={s.varSku}>SKU: {v.sku_suffix}</Text>
                </View>
                <Text style={s.varPrice}>{v.price_override ? fmt(v.price_override) : fmt(basePrice)}</Text>
                <Text style={s.varStock}>{v.stock_qty} un</Text>
                {v.id && (
                  <Pressable onPress={() => handleDelete(v.id!)} style={s.delBtn} hitSlop={6}>
                    <Icon name="x" size={12} color={Colors.red} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
      {variants.length === 0 && !showForm && <Text style={s.empty}>Nenhuma variante cadastrada.</Text>}

      {/* Add form — simplified */}
      {showForm && (
        <View style={s.form}>
          {/* Price + Stock in one row */}
          <View style={s.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Preco desta variante</Text>
              <TextInput style={s.input} value={price} onChangeText={setPrice}
                placeholder={basePrice.toFixed(2)} placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
              <Text style={s.fieldHint}>Deixe vazio para usar o preco base ({fmt(basePrice)})</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Estoque</Text>
              <TextInput style={s.input} value={stockQty} onChangeText={setStockQty}
                placeholder="0" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
            </View>
          </View>

          {/* Attributes */}
          <Text style={[s.label, { marginTop: 12 }]}>Caracteristicas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 4, marginBottom: 8, paddingRight: 20 }}>
            {ATTR_PRESETS.map(p => (
              <Pressable key={p} onPress={() => setAttrName(p)}
                style={[s.presetChip, attrName === p && s.presetActive]}>
                <Text style={[s.presetText, attrName === p && { color: Colors.violet3 }]}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.attrRow}>
            <TextInput style={[s.input, { flex: 1, minWidth: 80 }]} value={attrName}
              onChangeText={setAttrName} placeholder="Nome" placeholderTextColor={Colors.ink3} />
            <TextInput style={[s.input, { flex: 1.5 }]} value={attrValue}
              onChangeText={setAttrValue} placeholder={isColorAttr ? 'Ex: Azul' : 'Valor'}
              placeholderTextColor={Colors.ink3} onSubmitEditing={addAttribute} />
            <Pressable onPress={addAttribute} style={s.attrAddBtn}>
              <Icon name="plus" size={14} color="#fff" />
            </Pressable>
          </View>

          {/* Color picker for Cor attribute */}
          {isColorAttr && (
            <View style={s.colorSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingRight: 20 }}>
                {PRESET_COLORS.map(c => (
                  <Pressable key={c.hex} onPress={() => selectPresetColor(c)}
                    style={[s.colorSwatch, { backgroundColor: c.hex },
                      attrHex === c.hex && { borderColor: Colors.violet, borderWidth: 3 },
                      c.hex === '#ffffff' && { borderWidth: 1.5, borderColor: Colors.border }]}>
                    {attrHex === c.hex && c.hex !== '#000000' && <Icon name="check" size={10} color={c.hex === '#ffffff' ? Colors.violet : '#fff'} />}
                    {attrHex === c.hex && c.hex === '#000000' && <Icon name="check" size={10} color="#fff" />}
                  </Pressable>
                ))}
                <Pressable onPress={openCustomColor} style={s.customColorBtn}>
                  <Text style={s.customColorText}>+</Text>
                </Pressable>
              </ScrollView>
              {attrHex && (
                <View style={s.hexDisplay}>
                  <View style={[s.hexSwatch, { backgroundColor: attrHex }]} />
                  <Text style={s.hexText}>{attrHex}</Text>
                </View>
              )}
            </View>
          )}

          {/* Added attributes */}
          {attributes.length > 0 && (
            <View style={s.attrList}>
              {attributes.map((a, i) => (
                <View key={i} style={s.attrChip}>
                  <Text style={s.attrChipText}>{a.attribute}: {a.value}</Text>
                  <Pressable onPress={() => setAttributes(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                    <Icon name="x" size={10} color={Colors.ink3} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={s.formActions}>
            <Pressable onPress={() => setShowForm(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveText}>Salvar variante</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg4, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.ink },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border2 },
  addText: { fontSize: 11, color: Colors.violet3, fontWeight: '600' },
  list: { gap: 4, marginBottom: 8 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 10 },
  varLabel: { fontSize: 12, fontWeight: '600', color: Colors.ink },
  varSku: { fontSize: 9, color: Colors.ink3, marginTop: 3, fontFamily: 'monospace' as any },
  varAttrsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  varAttrChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  varAttrKey: { fontSize: 9, fontWeight: '700', color: Colors.ink3, textTransform: 'uppercase' as any, letterSpacing: 0.3 },
  varAttrDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  varAttrVal: { fontSize: 11, fontWeight: '600', color: Colors.ink },
  varPrice: { fontSize: 12, color: Colors.green, fontWeight: '600' },
  varStock: { fontSize: 11, color: Colors.ink3, minWidth: 40, textAlign: 'right' },
  delBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 11, color: Colors.ink3, textAlign: 'center', paddingVertical: 12 },
  form: { backgroundColor: Colors.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  formRow: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: '600', marginBottom: 4 },
  fieldHint: { fontSize: 9, color: Colors.ink3, marginTop: 2, fontStyle: 'italic' as any },
  input: { backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.ink, borderWidth: 1, borderColor: Colors.border },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  presetActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  presetText: { fontSize: 10, color: Colors.ink3, fontWeight: '500' },
  attrRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  attrAddBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.violet, alignItems: 'center', justifyContent: 'center' },
  colorSection: { marginBottom: 8 },
  colorSwatch: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  customColorBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border2, borderStyle: 'dashed' as any, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg4 },
  customColorText: { fontSize: 16, color: Colors.violet3, fontWeight: '600' },
  hexDisplay: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  hexSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
  hexText: { fontSize: 10, color: Colors.ink3, fontFamily: 'monospace' as any },
  attrList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  attrChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border2 },
  attrChipText: { fontSize: 10, color: Colors.violet3, fontWeight: '500' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.violet, minWidth: 110, alignItems: 'center' },
  saveText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});

export default VariantsSection;
