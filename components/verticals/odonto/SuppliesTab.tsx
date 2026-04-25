// ============================================================
// AURA. — SuppliesTab (GAP-03)
// Estoque de Materiais Odontológicos — tab dentro de OdontoAdminTabs.
//
// Reutiliza a estrutura de produtos existente (is_dental_supply=true).
// UX espelhada no estoque geral, adaptada para contexto clínico:
//   - Categorias dentais específicas
//   - Badge de estoque baixo (vermelho)
//   - Badge de validade próxima (amarelo) e vencido (vermelho)
//   - Movimentação simplificada: entrada | saída | ajuste
//   - Form rápido de cadastro (sem price, barcode, variants)
// ============================================================

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'todos',                label: 'Todos',          icon: '📦' },
  { id: 'anestesico',          label: 'Anestésicos',    icon: '💉' },
  { id: 'resina',              label: 'Resinas',         icon: '🔵' },
  { id: 'fio',                 label: 'Fios',            icon: '🧵' },
  { id: 'broca',               label: 'Brocas',          icon: '🔩' },
  { id: 'descartavel',         label: 'Descartáveis',   icon: '🧤' },
  { id: 'material_restaurador',label: 'Restauração',     icon: '🦷' },
  { id: 'material_protecao',   label: 'Proteção',        icon: '🛡️' },
  { id: 'rx',                  label: 'Rx/Imagem',       icon: '📷' },
  { id: 'equipamento',         label: 'Equipamentos',   icon: '⚕️' },
  { id: 'outro',               label: 'Outros',          icon: '📋' },
];

const UNITS = ['un', 'cx', 'fr', 'ml', 'g', 'kg', 'L', 'par', 'rolo'];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(v?: string | null) {
  if (!v) return '—';
  try {
    // due_date style: parse as UTC date-only
    const d = new Date(v + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch { return '—'; }
}

function daysTo(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function categoryLabel(id: string) {
  return CATEGORIES.find(c => c.id === id)?.label || id;
}

// ─────────────────────────────────────────────────────────────
// Supply Card
// ─────────────────────────────────────────────────────────────
function SupplyCard({ s, companyId, onMovement }: {
  s: any;
  companyId: string;
  onMovement: (supply: any) => void;
}) {
  const days = daysTo(s.expiry_date);
  const isExpired = days !== null && days < 0;
  const isExpiringSoon = days !== null && days >= 0 && days <= 30;
  const isLowStock = s.low_stock;

  return (
    <View style={[st.card, (isExpired || isLowStock) && st.cardAlert]}>
      <View style={st.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={st.cardName} numberOfLines={1}>{s.name}</Text>
          <Text style={st.cardCategory}>{categoryLabel(s.dental_category || 'outro')}</Text>
        </View>
        <View style={st.cardBadges}>
          {isExpired && (
            <View style={[st.badge, st.badgeRed]}>
              <Text style={st.badgeText}>VENCIDO</Text>
            </View>
          )}
          {!isExpired && isExpiringSoon && (
            <View style={[st.badge, st.badgeYellow]}>
              <Text style={[st.badgeText, { color: '#92400E' }]}>
                {days === 0 ? 'VENCE HOJE' : `${days}d`}
              </Text>
            </View>
          )}
          {isLowStock && (
            <View style={[st.badge, st.badgeRed]}>
              <Text style={st.badgeText}>BAIXO</Text>
            </View>
          )}
        </View>
      </View>

      <View style={st.cardMeta}>
        <View style={st.stockRow}>
          <Text style={st.stockVal}>{Number(s.stock_qty).toFixed(0)}</Text>
          <Text style={st.stockUnit}>{s.unit || 'un'}</Text>
          {s.stock_min > 0 && (
            <Text style={st.stockMin}>/ mín {s.stock_min}</Text>
          )}
        </View>
        {s.expiry_date && (
          <Text style={[st.expiryText, isExpired && { color: '#EF4444' }, isExpiringSoon && !isExpired && { color: '#F59E0B' }]}>
            Val: {fmt(s.expiry_date)}
          </Text>
        )}
        {s.lot_number && (
          <Text style={st.lotText}>Lote: {s.lot_number}</Text>
        )}
        {s.supplier_name && (
          <Text style={st.supplierText}>📦 {s.supplier_name}</Text>
        )}
      </View>

      <TouchableOpacity onPress={() => onMovement(s)} style={st.movBtn}>
        <Text style={st.movBtnText}>+ / - Movimentar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Movement Modal
// ─────────────────────────────────────────────────────────────
function MovementModal({ supply, companyId, onClose, onDone }: {
  supply: any;
  companyId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType]       = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [qty, setQty]         = useState('');
  const [notes, setNotes]     = useState('');

  const qc = useQueryClient();
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
        `Estoque atualizado: ${data.stock_qty_prev} → ${data.stock_qty_new} ${supply.unit || 'un'}`
      );
      onDone();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível movimentar.'),
  });

  const isValid = qty.trim() !== '' && parseFloat(qty) > 0;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.movOverlay}>
        <View style={st.movCard}>
          <Text style={st.movTitle}>{supply.name}</Text>
          <Text style={st.movCurrent}>
            Estoque atual: {Number(supply.stock_qty).toFixed(0)} {supply.unit || 'un'}
          </Text>

          {/* Tipo */}
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

          <Text style={st.movLabel}>
            {type === 'ajuste' ? 'Quantidade final (valor absoluto)' : 'Quantidade'}
          </Text>
          <TextInput
            style={st.movInput}
            placeholder="Ex: 10"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={qty}
            onChangeText={setQty}
            autoFocus
          />

          <Text style={st.movLabel}>Motivo (opcional)</Text>
          <TextInput
            style={st.movInput}
            placeholder="Ex: Compra do fornecedor, Procedimento, Inventário..."
            placeholderTextColor="#475569"
            value={notes}
            onChangeText={setNotes}
          />

          <View style={st.movBtns}>
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
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// New Supply Form
// ─────────────────────────────────────────────────────────────
function NewSupplyForm({ companyId, onClose, onCreated }: {
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName]               = useState('');
  const [category, setCategory]       = useState('outro');
  const [unit, setUnit]               = useState('un');
  const [qty, setQty]                 = useState('0');
  const [minQty, setMinQty]           = useState('');
  const [costPrice, setCostPrice]     = useState('');
  const [supplier, setSupplier]       = useState('');
  const [lotNumber, setLotNumber]     = useState('');
  const [expiryDate, setExpiryDate]   = useState('');

  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      request(`/companies/${companyId}/dental/supplies`, {
        method: 'POST',
        body: {
          name:           name.trim(),
          dental_category: category,
          unit,
          stock_qty:      parseFloat(qty) || 0,
          stock_min:      minQty ? parseFloat(minQty) : 0,
          cost_price:     costPrice ? parseFloat(costPrice.replace(',', '.')) : 0,
          supplier_name:  supplier || undefined,
          lot_number:     lotNumber || undefined,
          expiry_date:    expiryDate || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dental-supplies'] });
      onCreated();
    },
    onError: (err: any) => Alert.alert('Erro', err?.message || 'Não foi possível cadastrar.'),
  });

  const catOptions = CATEGORIES.filter(c => c.id !== 'todos');

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
      <View style={st.formModal}>
        <View style={st.formHeader}>
          <Text style={st.formTitle}>Novo Material</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={st.formClose}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={st.formScroll} keyboardShouldPersistTaps="handled">

          <Text style={st.formLabel}>Nome do material *</Text>
          <TextInput
            style={st.formInput}
            placeholder="Ex: Anestésico Articaína 4% 1:100.000"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={st.formLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {catOptions.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[st.catChip, category === c.id && st.catChipActive]}
              >
                <Text style={st.catChipIcon}>{c.icon}</Text>
                <Text style={[st.catChipText, category === c.id && st.catChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={st.formLabel}>Unidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {UNITS.map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[st.unitChip, unit === u && st.unitChipActive]}
              >
                <Text style={[st.unitChipText, unit === u && st.unitChipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Qtd. inicial</Text>
              <TextInput
                style={st.formInput}
                placeholder="0"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
                value={qty}
                onChangeText={setQty}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Estoque mínimo</Text>
              <TextInput
                style={st.formInput}
                placeholder="Alerta abaixo de..."
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
                value={minQty}
                onChangeText={setMinQty}
              />
            </View>
          </View>

          <Text style={st.formLabel}>Custo unitário (R$)</Text>
          <TextInput
            style={st.formInput}
            placeholder="Ex: 12,50"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={costPrice}
            onChangeText={setCostPrice}
          />

          <Text style={st.formLabel}>Fornecedor</Text>
          <TextInput
            style={st.formInput}
            placeholder="Ex: Dental Plus, DFL..."
            placeholderTextColor="#475569"
            value={supplier}
            onChangeText={setSupplier}
          />

          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Lote</Text>
              <TextInput
                style={st.formInput}
                placeholder="Ex: L2024ABC"
                placeholderTextColor="#475569"
                value={lotNumber}
                onChangeText={setLotNumber}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.formLabel}>Validade (DD/MM/AAAA)</Text>
              <TextInput
                style={st.formInput}
                placeholder="Ex: 12/2026"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
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

// ─────────────────────────────────────────────────────────────
// Main: SuppliesTab
// ─────────────────────────────────────────────────────────────
export function SuppliesTab() {
  const cid = useAuthStore().company?.id ?? '';
  const [activeCategory, setActiveCategory] = useState('todos');
  const [search, setSearch]                 = useState('');
  const [alertFilter, setAlertFilter]       = useState<string>('');
  const [showForm, setShowForm]             = useState(false);
  const [movSupply, setMovSupply]           = useState<any | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dental-supplies', cid, activeCategory, search, alertFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (activeCategory !== 'todos') params.set('category', activeCategory);
      if (search.trim()) params.set('search', search.trim());
      if (alertFilter) params.set('alert', alertFilter);
      return request(`/companies/${cid}/dental/supplies?${params}`);
    },
    enabled: !!cid,
    staleTime: 20000,
  });

  const supplies: any[] = data?.supplies || [];
  const alerts          = data?.alerts || {};

  const totalAlerts =
    (parseInt(alerts.low_stock) || 0) +
    (parseInt(alerts.expired) || 0) +
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

      {/* Alertas rápidos */}
      {(parseInt(alerts.low_stock) > 0 || parseInt(alerts.expired) > 0 || parseInt(alerts.expiring_soon) > 0) && (
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
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={st.clearBtn}>
            <Text style={st.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtro de categorias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => { setActiveCategory(c.id); setAlertFilter(''); }}
            style={[st.catFilterChip, activeCategory === c.id && st.catFilterChipActive]}
          >
            <Text style={st.catFilterIcon}>{c.icon}</Text>
            <Text style={[st.catFilterText, activeCategory === c.id && st.catFilterTextActive]}>
              {c.label}
            </Text>
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
          <Text style={st.emptyIcon}>🦷</Text>
          <Text style={st.emptyTitle}>Nenhum material cadastrado</Text>
          <Text style={st.emptyMsg}>
            {alertFilter
              ? 'Nenhum alerta no momento.'
              : 'Cadastre anestésicos, resinas, brocas e outros insumos para controlar o estoque da clínica.'}
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
            <SupplyCard
              key={s.id}
              s={s}
              companyId={cid}
              onMovement={setMovSupply}
            />
          ))}
        </ScrollView>
      )}

      {/* Modals */}
      {showForm && (
        <NewSupplyForm
          companyId={cid}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['dental-supplies', cid] });
          }}
        />
      )}

      {movSupply && (
        <MovementModal
          supply={movSupply}
          companyId={cid}
          onClose={() => setMovSupply(null)}
          onDone={() => setMovSupply(null)}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0F172A' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerAlert: { color: '#F59E0B', fontSize: 11, marginTop: 2 },
  addBtn:      { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText:  { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  alertsRow:   { paddingHorizontal: 16, marginBottom: 8 },
  alertChip:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  alertChipRed:    { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.4)' },
  alertChipYellow: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
  alertChipActive: { borderWidth: 2 },
  alertChipText:   { color: '#EF4444', fontSize: 11, fontWeight: '600' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1E293B', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, color: '#FFFFFF', fontSize: 13 } as any,
  clearBtn:    { padding: 4 },
  clearBtnText:{ color: '#64748B', fontSize: 14 },

  catRow:      { paddingHorizontal: 16, marginBottom: 10 },
  catFilterChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  catFilterChipActive: { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  catFilterIcon:       { fontSize: 13 },
  catFilterText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  catFilterTextActive: { color: '#FFFFFF' },

  list:        { flex: 1, paddingHorizontal: 16 },
  countLabel:  { color: '#64748B', fontSize: 11, marginBottom: 8 },

  // Card
  card:        { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#334155' },
  cardAlert:   { borderColor: 'rgba(239,68,68,0.5)', borderWidth: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardName:    { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  cardCategory:{ color: '#64748B', fontSize: 11, marginTop: 2 },
  cardBadges:  { flexDirection: 'row', gap: 4 },
  badge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeRed:    { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeYellow: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeText:   { color: '#EF4444', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  cardMeta:    { gap: 2, marginBottom: 10 },
  stockRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  stockVal:    { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  stockUnit:   { color: '#94A3B8', fontSize: 13 },
  stockMin:    { color: '#475569', fontSize: 11 },
  expiryText:  { color: '#94A3B8', fontSize: 11 },
  lotText:     { color: '#475569', fontSize: 10 },
  supplierText:{ color: '#64748B', fontSize: 10 },
  movBtn:      { alignSelf: 'flex-start', backgroundColor: '#1E293B', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#8B5CF6' },
  movBtnText:  { color: '#A78BFA', fontSize: 12, fontWeight: '600' },

  // Movement modal
  movOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  movCard:     { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#334155', gap: 12 },
  movTitle:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  movCurrent:  { color: '#94A3B8', fontSize: 12 },
  typeRow:     { flexDirection: 'row', gap: 6 },
  typeChip:    { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  typeChipActive:     { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' },
  typeChipText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  typeChipTextActive: { color: '#FFFFFF' },
  movLabel:    { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  movInput:    { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  movBtns:     { gap: 8, marginTop: 4 },

  // Form modal
  formModal:   { flex: 1, backgroundColor: '#0F172A' },
  formHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  formTitle:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  formClose:   { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  formScroll:  { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  formLabel:   { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  formInput:   { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  twoCol:      { flexDirection: 'row', gap: 10 },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  catChipActive:     { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  catChipIcon:       { fontSize: 14 },
  catChipText:       { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  catChipTextActive: { color: '#FFFFFF' },
  unitChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', marginRight: 6, borderWidth: 1, borderColor: '#334155' },
  unitChipActive:     { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  unitChipText:       { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  unitChipTextActive: { color: '#FFFFFF' },
  submitBtn:   { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Shared
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText:   { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:    { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText:{ color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  emptyIcon:   { fontSize: 48, marginBottom: 8 },
  emptyTitle:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyMsg:    { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  primaryBtn:  { backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cancelBtn:   { backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cancelBtnText:{ color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});

export default SuppliesTab;
