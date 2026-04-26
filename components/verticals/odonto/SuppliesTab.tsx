// AURA. — SuppliesTab (GAP-03) — orchestrator
// Estoque de Materiais Odontológicos.
// Decomposição: supplyUtils + SupplyCard + SupplyMovementModal + SupplyForm

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { CATEGORIES } from './supplyUtils';
import { SupplyCard } from './SupplyCard';
import { SupplyMovementModal } from './SupplyMovementModal';
import { SupplyForm } from './SupplyForm';

export function SuppliesTab() {
  const cid = useAuthStore().company?.id ?? '';
  const qc  = useQueryClient();

  const [activeCategory, setActiveCategory] = useState('todos');
  const [search,         setSearch]         = useState('');
  const [alertFilter,    setAlertFilter]    = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [movSupply,      setMovSupply]      = useState<any | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dental-supplies', cid, activeCategory, search, alertFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (activeCategory !== 'todos') params.set('category', activeCategory);
      if (search.trim())              params.set('search', search.trim());
      if (alertFilter)                params.set('alert', alertFilter);
      return request(`/companies/${cid}/dental/supplies?${params}`);
    },
    enabled: !!cid,
    staleTime: 20000,
  });

  const supplies: any[] = data?.supplies || [];
  const alerts          = data?.alerts   || {};
  const totalAlerts =
    (parseInt(alerts.low_stock)     || 0) +
    (parseInt(alerts.expired)       || 0) +
    (parseInt(alerts.expiring_soon) || 0);

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>Materiais</Text>
          {totalAlerts > 0 && (
            <Text style={st.headerAlert}>⚠️ {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
          <Text style={st.addBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Alertas rápidos clicáveis */}
      {totalAlerts > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.alertsRow}>
          {parseInt(alerts.expired) > 0 && (
            <TouchableOpacity
              onPress={() => setAlertFilter(alertFilter === 'expired' ? '' : 'expired')}
              style={[st.alertChip, st.alertChipRed, alertFilter === 'expired' && st.alertChipActive]}
            >
              <Text style={st.alertChipText}>🚫 {alerts.expired} vencido{alerts.expired !== '1' ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          {parseInt(alerts.low_stock) > 0 && (
            <TouchableOpacity
              onPress={() => setAlertFilter(alertFilter === 'low_stock' ? '' : 'low_stock')}
              style={[st.alertChip, st.alertChipRed, alertFilter === 'low_stock' && st.alertChipActive]}
            >
              <Text style={st.alertChipText}>📉 {alerts.low_stock} baixo estoque</Text>
            </TouchableOpacity>
          )}
          {parseInt(alerts.expiring_soon) > 0 && (
            <TouchableOpacity
              onPress={() => setAlertFilter(alertFilter === 'expiring' ? '' : 'expiring')}
              style={[st.alertChip, st.alertChipYellow, alertFilter === 'expiring' && st.alertChipActive]}
            >
              <Text style={[st.alertChipText, { color: '#92400E' }]}>⏳ {alerts.expiring_soon} vencendo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Busca */}
      <View style={st.searchWrap}>
        <TextInput
          style={st.searchInput}
          placeholder="Buscar material..."
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} style={st.clearBtn}>
            <Text style={st.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro de categorias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => { setActiveCategory(c.id); setAlertFilter(''); }}
            style={[st.catChip, activeCategory === c.id && st.catChipActive]}
          >
            <Text style={st.catChipIcon}>{c.icon}</Text>
            <Text style={[st.catChipText, activeCategory === c.id && st.catChipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {isLoading ? (
        <View style={st.center}><ActivityIndicator color="#8B5CF6" /></View>
      ) : error ? (
        <View style={st.center}>
          <Text style={st.errorText}>Erro ao carregar materiais</Text>
          <TouchableOpacity onPress={() => refetch()} style={st.retryBtn}>
            <Text style={st.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : supplies.length === 0 ? (
        <View style={st.center}>
          <Text style={{ fontSize: 48 }}>🦷</Text>
          <Text style={st.emptyTitle}>Nenhum material cadastrado</Text>
          <Text style={st.emptyMsg}>
            {alertFilter
              ? 'Nenhum alerta no momento.'
              : 'Cadastre anestésicos, resinas, brocas e outros insumos da clínica.'}
          </Text>
          {!alertFilter && (
            <TouchableOpacity onPress={() => setShowForm(true)} style={st.addBtn}>
              <Text style={st.addBtnText}>+ Cadastrar primeiro material</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={st.list} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={st.countLabel}>{supplies.length} material{supplies.length !== 1 ? 'is' : ''}</Text>
          {supplies.map(s => (
            <SupplyCard key={s.id} s={s} onMovement={setMovSupply} />
          ))}
        </ScrollView>
      )}

      {showForm && (
        <SupplyForm
          companyId={cid}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['dental-supplies', cid] }); }}
        />
      )}
      {movSupply && (
        <SupplyMovementModal
          supply={movSupply}
          companyId={cid}
          onClose={() => setMovSupply(null)}
          onDone={()  => setMovSupply(null)}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0F172A' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerAlert:   { color: '#F59E0B', fontSize: 11, marginTop: 2 },
  addBtn:        { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText:    { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  alertsRow:     { paddingHorizontal: 16, marginBottom: 8 },
  alertChip:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  alertChipRed:    { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.4)' },
  alertChipYellow: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
  alertChipActive: { borderWidth: 2 },
  alertChipText:   { color: '#EF4444', fontSize: 11, fontWeight: '600' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12 },
  searchInput:   { flex: 1, paddingVertical: 10, color: '#FFFFFF', fontSize: 13 } as any,
  clearBtn:      { padding: 4 },
  clearBtnText:  { color: '#64748B', fontSize: 14 },
  catRow:        { paddingHorizontal: 16, marginBottom: 10 },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  catChipActive:     { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  catChipIcon:       { fontSize: 13 },
  catChipText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  catChipTextActive: { color: '#FFFFFF' },
  list:          { flex: 1, paddingHorizontal: 16 },
  countLabel:    { color: '#64748B', fontSize: 11, marginBottom: 8 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText:     { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:      { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText:  { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  emptyTitle:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  emptyMsg:      { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
});

export default SuppliesTab;
