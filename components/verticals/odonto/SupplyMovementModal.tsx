// AURA. — SupplyMovementModal (GAP-03)
// Modal de movimentação: entrada | saída | ajuste.

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';

interface Props {
  supply:    any;
  companyId: string;
  onClose:   () => void;
  onDone:    () => void;
}

export function SupplyMovementModal({ supply, companyId, onClose, onDone }: Props) {
  const [type,  setType]  = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [qty,   setQty]   = useState('');
  const [notes, setNotes] = useState('');

  const qc  = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/supplies/${supply.id}/movement`, {
        method: 'POST',
        body: { type, quantity: parseFloat(qty), notes: notes || undefined },
      }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['dental-supplies'] });
      Alert.alert(
        'Movimentação registrada',
        `Estoque: ${data.stock_qty_prev} → ${data.stock_qty_new} ${supply.unit || 'un'}`
      );
      onDone();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível movimentar.'),
  });

  const isValid = qty.trim() !== '' && parseFloat(qty) > 0;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.card}>
          <Text style={st.title}>{supply.name}</Text>
          <Text style={st.current}>
            Estoque atual: {Number(supply.stock_qty).toFixed(0)} {supply.unit || 'un'}
          </Text>

          <View style={st.typeRow}>
            {(['entrada', 'saida', 'ajuste'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={[st.typeChip, type === t && st.typeChipActive]}
              >
                <Text style={[st.typeChipText, type === t && st.typeChipTextActive]}>
                  {t === 'entrada' ? '⬆️ Entrada' : t === 'saida' ? '⬇️ Saída' : '⚖️ Ajuste'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>
            {type === 'ajuste' ? 'Quantidade final (absoluto)' : 'Quantidade'}
          </Text>
          <TextInput
            style={st.input}
            placeholder="Ex: 10"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={qty}
            onChangeText={setQty}
            autoFocus
          />

          <Text style={st.label}>Motivo (opcional)</Text>
          <TextInput
            style={st.input}
            placeholder="Ex: Compra, Procedimento, Inventário..."
            placeholderTextColor="#475569"
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            onPress={() => mut.mutate()}
            disabled={!isValid || mut.isPending}
            style={[st.primaryBtn, (!isValid || mut.isPending) && { opacity: 0.5 }]}
          >
            {mut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={st.primaryBtnText}>Confirmar</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.cancelBtn}>
            <Text style={st.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:              { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#334155', gap: 12 },
  title:             { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  current:           { color: '#94A3B8', fontSize: 12 },
  typeRow:           { flexDirection: 'row', gap: 6 },
  typeChip:          { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  typeChipActive:    { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  typeChipText:      { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  typeChipTextActive:{ color: '#FFFFFF' },
  label:             { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input:             { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  primaryBtn:        { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText:    { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cancelBtn:         { backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cancelBtnText:     { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});
