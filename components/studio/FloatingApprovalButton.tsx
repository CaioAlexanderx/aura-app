/**
 * FloatingApprovalButton — item #2 da análise UX/UI.
 *
 * Atalho global pra "Solicitar aprovação ao cliente" sem ter que entrar manualmente
 * na coluna KDS. Aparece em todas as telas Studio (montado no shell) e leva direto
 * à tela de Produção filtrada por "Aguardando arte", abrindo o ApprovalRequestModal
 * automaticamente assim que o lojista clica em um card.
 *
 * Mantemos a UX simples: sem fetch direto aqui (evita acoplar a hook de company).
 * Toda a lógica de listar pedidos vive em /studio/producao.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Send } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { StudioColors } from '../../constants/studio-tokens';

export function FloatingApprovalButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Esconde nas telas onde o botão duplica ação visível (produção e aprovação pública).
  if (pathname?.includes('/studio/producao')) return null;
  if (pathname?.startsWith('/aprovacao/')) return null;

  return (
    <Pressable
      onPress={() => router.push('/studio/producao?intent=approval' as any)}
      style={styles.fab}
      accessibilityLabel="Solicitar aprovação de arte ao cliente"
    >
      <View style={[styles.fabInner, { backgroundColor: StudioColors.accent }]}>
        <Send size={22} color="#fff" />
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
