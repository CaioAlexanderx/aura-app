/**
 * FloatingApprovalButton — item #2 da análise UX/UI.
 *
 * 25/05 hotfix: substituído `Send` do lucide-react-native pelo Icon canônico.
 * lucide não é dep do projeto e quebrava o build CF Pages.
 *
 * 26/05 fix UX: antes renderizava em TODAS as rotas /studio/* (com 2
 * exclusões só: /studio/producao e /aprovacao/). Isso aparecia em
 * galeria, insumos, financeiro, configurações, etc — sem conexão
 * nenhuma com o conteúdo da página, e ainda por cima EMPILHAVA com
 * o StudioFab (que tem posição idêntica: bottom 24-28, right 20-24).
 *
 * Passou para ALLOWLIST: só aparece em /studio/pedidos (o Hub agregador
 * onde "ver pedidos aguardando arte" faz sentido contextual). Também
 * reposicionado para bottom: 96 para nunca sobrepor o StudioFab da
 * rota — quando ambos coexistem, ficam empilhados verticalmente em
 * vez de sobrescritos.
 *
 * Atalho leva pra Produção com filtro `intent=approval` que abre a
 * coluna "Aguardando aprovação" do KDS.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Icon } from '@/components/Icon';
import { StudioColors } from '../../constants/studio-tokens';

// Allowlist: só rotas onde o atalho "Aprovar arte" tem contexto claro.
// Hoje só o Hub de Pedidos. Adicionar /studio aqui no futuro se virar
// dashboard com KPI "X aguardando aprovação".
const ALLOWED_PATHS = [
  '/studio/pedidos',
];

function shouldShow(pathname: string | null): boolean {
  if (!pathname) return false;
  return ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function FloatingApprovalButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (!shouldShow(pathname)) return null;

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
    // 96 = 24 (StudioFab bottom) + 56 (StudioFab height) + 16 gap.
    // Garante que NUNCA sobrepõe o StudioFab da rota.
    bottom: 96,
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
