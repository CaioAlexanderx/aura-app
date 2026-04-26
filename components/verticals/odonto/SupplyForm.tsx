// AURA. — SupplyForm (GAP-03)
// Formulário de cadastro de novo material odontológico.
// Simplificado: sem price, barcode, variants do PDV.

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { CATEGORIES, UNITS } from './supplyUtils';

interface Props {
  companyId: string;
  onClose:   () => void;
  onCreated: () => void;
}

export function SupplyForm({ companyId, onClose, onCreated }: Props) {
  const [name,       setName]       = useState('');
  const [category,   setCategory]   = useState('outro');
  const [unit,       setUnit]       = useState('un');
  const [qty,        setQty]        = useState('0');
  const [minQty,     setMinQty]     = useState('');
  const [costPrice,  setCostPrice]  = useState('');
  const [supplier,   setSupplier]   = useState('');
  const [lotNumber,  setLotNumber]  = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const qc  = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/supplies`, {
        method: 'POST',
        body: {
          name:            name.trim(),
          dental_category: category,
          unit,
          stock_qty:       parseFloat(qty) || 0,
          stock_min:       minQty ? parseFloat(minQty) : 0,
          cost_price:      costPrice ? parseFloat(costPrice.replace(',', '.')) : 0,
          supplier_name:   supplier   || undefined,
          lot_number:      lotNumber  || undefined,
          expiry_date:     expiryDate || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-supplies', companyId] });
      onCreated();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível cadastrar.'),
  });

  const catOptions = CATEGORIES.filter(c => c.id !== 'todos');

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={st.modal}>
        <View style={st.header}>
          <Text style={st.title}>Novo Material</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={st.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled">
          <Text style={st.label}>Nome do material *</Text>
          <TextInput
            style={st.input}
            placeholder="Ex: Anestésico Articaína 4% 1:100.000"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={st.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {catOptions.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[st.catChip, category === c.id && st.catChipActive]}
              >
                <Text style={st.catIcon}>{c.icon}</Text>
                <Text style={[st.catText, category === c.id && st.catTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.label}>Unidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {UNITS.map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[st.unitChip, unit === u && st.unitChipActive]}
              >
                <Text style={[st.unitText, unit === u && st.unitTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Qtd. inicial</Text>
              <TextInput style={st.input} placeholder="0" placeholderTextColor="#475569" keyboardType="decimal-pad" value={qty} onChangeText={setQty} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Estoque mínimo</Text>
              <TextInput style={st.input} placeholder="Alerta abaixo de..." placeholderTextColor="#475569" keyboardType="decimal-pad" value={minQty} onChangeText={setMinQty} />
            </View>
          </View>

          <Text style={st.label}>Custo unitário (R$)</Text>
          <TextInput style={st.input} placeholder="Ex: 12,50" placeholderTextColor="#475569" keyboardType="decimal-pad" value={costPrice} onChangeText={setCostPrice} />

          <Text style={st.label}>Fornecedor</Text>
          <TextInput style={st.input} placeholder="Ex: Dental Plus, DFL..." placeholderTextColor="#475569" value={supplier} onChangeText={setSupplier} />

          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Lote</Text>
              <TextInput style={st.input} placeholder="Ex: L2024ABC" placeholderTextColor="#475569" value={lotNumber} onChangeText={setLotNumber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Validade</Text>
              <TextInput style={st.input} placeholder="Ex: 12/2026" placeholderTextColor="#475569" keyboardType="numeric" value={expiryDate} onChangeText={setExpiryDate} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => mut.mutate()}
            disabled={!name.trim() || mut.isPending}
            style={[st.submitBtn, (!name.trim() || mut.isPending) && { opacity: 0.5 }]}
          >
            {mut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.submitBtnText}>Cadastrar Material</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modal:         { flex: 1, backgroundColor: '#0F172A' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  title:         { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelText:    { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  scroll:        { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  label:         { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:         { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  twoCol:        { flexDirection: 'row', gap: 10 },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  catChipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  catIcon:       { fontSize: 14 },
  catText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  catTextActive: { color: '#FFFFFF' },
  unitChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 6, borderWidth: 1, borderColor: '#334155' },
  unitChipActive:{ backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  unitText:      { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  unitTextActive:{ color: '#FFFFFF' },
  submitBtn:     { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
