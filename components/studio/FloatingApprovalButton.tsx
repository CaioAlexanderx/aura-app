/**
 * FloatingApprovalButton — item #2 da análise UX/UI.
 * Atalho global pra "Solicitar aprovação ao cliente" sem ter que ir até a coluna
 * KDS específica. Aparece em todas as telas Studio (montado no shell) e abre o
 * mesmo wizard ApprovalRequestModal — mas pede pra o lojista escolher antes
 * qual pedido (ou criar avulso).
 *
 * Apenas FAB; lógica de seleção fica num bottom-sheet leve.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Send, X, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StudioColors, StudioGradients } from '../../constants/studio-tokens';
import { labelStudioStatus } from '../../constants/studio-status';
import { studioApi } from '../../services/studioApi';

type StudioOrderListItem = {
  id: string;
  order_number?: string;
  customer_name?: string;
  production_status: string;
};

export function FloatingApprovalButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<StudioOrderListItem[]>([]);
  const [q, setQ] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Lista pedidos que tipicamente esperam aprovação
      const list = await studioApi.listOrders({ status: 'pending_art', days: 30 });
      setOrders((list || []) as StudioOrderListItem[]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = orders.filter((o) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      (o.order_number || '').toLowerCase().includes(needle) ||
      (o.customer_name || '').toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.fab}
        accessibilityLabel="Solicitar aprovação de arte ao cliente"
      >
        <View style={[styles.fabInner, { backgroundColor: StudioColors.accent }]}>
          <Send size={22} color="#fff" />
        </View>
        <Text style={styles.fabLabel}>Aprovar arte</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pra qual pedido?</Text>
            <Pressable onPress={() => setOpen(false)}>
              <X size={20} color={StudioColors.ink3} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Search size={16} color={StudioColors.ink3} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar nº pedido ou cliente"
              placeholderTextColor={StudioColors.ink3}
              style={styles.search}
            />
          </View>
          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={StudioColors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nenhum pedido esperando aprovação</Text>
              <Text style={styles.emptyBody}>Quando um pedido entrar em "Aguardando arte" ele aparece aqui.</Text>
            </View>
          ) : (
            <View style={{ maxHeight: 360 }}>
              {filtered.map((o) => (
                <Pressable
                  key={o.id}
                  style={styles.item}
                  onPress={() => {
                    setOpen(false);
                    router.push(`/studio/pedidos/${o.id}` as any);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>#{o.order_number || o.id.slice(0, 6)} — {o.customer_name || 'Cliente'}</Text>
                    <Text style={styles.itemSub}>{labelStudioStatus(o.production_status)}</Text>
                  </View>
                  <Send size={16} color={StudioColors.accent} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    alignItems: 'center',
    zIndex: 80,
    gap: 4,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabLabel: {
    color: StudioColors.ink2 ?? StudioColors.ink3,
    fontSize: 11,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: StudioColors.paperCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: StudioColors.ink5 ?? '#CBD5E1',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  title: { fontSize: 16, fontWeight: '800', color: StudioColors.ink1 ?? '#0F172A' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: StudioColors.paper,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: StudioColors.ink5 ?? '#E2E8F0',
    marginVertical: 8,
  },
  search: {
    flex: 1,
    paddingVertical: 8,
    color: StudioColors.ink1 ?? '#0F172A',
    fontSize: 13,
  },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontWeight: '700', color: StudioColors.ink1 ?? '#0F172A' },
  emptyBody: { color: StudioColors.ink3, fontSize: 12, marginTop: 4, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: StudioColors.ink5 ?? '#E2E8F0',
  },
  itemTitle: { fontWeight: '700', color: StudioColors.ink1 ?? '#0F172A', fontSize: 13 },
  itemSub: { color: StudioColors.ink3, fontSize: 12, marginTop: 2 },
});

export default FloatingApprovalButton;
