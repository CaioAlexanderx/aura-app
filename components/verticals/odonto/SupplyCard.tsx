// AURA. — SupplyCard (GAP-03)
// Card individual de material odontológico com badges de alerta.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fmt, daysTo, categoryLabel } from './supplyUtils';

interface Props {
  s: any;
  onMovement: (supply: any) => void;
}

export function SupplyCard({ s, onMovement }: Props) {
  const days           = daysTo(s.expiry_date);
  const isExpired      = days !== null && days < 0;
  const isExpiringSoon = days !== null && days >= 0 && days <= 30;
  const isLowStock     = s.low_stock;

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
          {s.stock_min > 0 && <Text style={st.stockMin}>/ mín {s.stock_min}</Text>}
        </View>
        {s.expiry_date && (
          <Text style={[
            st.expiryText,
            isExpired && { color: '#EF4444' },
            isExpiringSoon && !isExpired && { color: '#F59E0B' },
          ]}>
            Val: {fmt(s.expiry_date)}
          </Text>
        )}
        {s.lot_number    && <Text style={st.lotText}>Lote: {s.lot_number}</Text>}
        {s.supplier_name && <Text style={st.supplierText}>📦 {s.supplier_name}</Text>}
      </View>

      <TouchableOpacity onPress={() => onMovement(s)} style={st.movBtn}>
        <Text style={st.movBtnText}>+ / - Movimentar</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
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
  movBtn:      { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#8B5CF6' },
  movBtnText:  { color: '#A78BFA', fontSize: 12, fontWeight: '600' },
});
