/**
 * FloatingApprovalButton — item #2 da análise UX/UI.
 *
 * 25/05 hotfix: substituído `Send` do lucide-react-native pelo Icon canônico.
 * lucide não é dep do projeto e quebrava o build CF Pages.
 *
 * Atalho global pra "Solicitar aprovação ao cliente" sem ter que entrar manualmente
 * na coluna KDS. Leva direto à tela de Produção filtrada por intent=approval.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Icon } from '@/components/Icon';
import { StudioColors } from '../../constants/studio-tokens';

export function FloatingApprovalButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname?.includes('/studio/producao')) return null;
  if (pathname?.startsWith('/aprovacao/')) return null;

  return (
    <Pressable
      onPress={() => router.push('/studio/producao?intent=approval' as any)}
      style={styles.fab}
      accessibilityLabel="Solicitar aprovação de arte ao cliente"
    >
      <View style={[styles.fabInner, { backgroundColor: StudioColors.accent }]}>
        <Icon name="message" size={22} color="#fff" />
      </View>
      <Text style={styles.fabLabel}>Aprovar arte</Text>
    </Pressable>
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
    color: (StudioColors as any).ink2 ?? StudioColors.ink3,
    fontSize: 11,
    fontWeight: '600',
  },
});

export default FloatingApprovalButton;
