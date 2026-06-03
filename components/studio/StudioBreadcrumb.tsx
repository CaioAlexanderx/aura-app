/**
 * StudioBreadcrumb — item #5 da análise UX/UI.
 * Helper sticky pra navegação contextual em telas profundas (composição, detalhe pedido).
 *
 * 25/05 hotfix: substituído lucide-react-native pelo Icon canônico do Aura.
 *               lucide não é dependência do projeto e quebrava o build CF Pages.
 *
 * 02/06/2026 (Shell clareza): sem mudança estrutural. Tokens t.ink3 e t.primary
 * já passam WCAG AA (≥4.5:1) — auditado, nenhum ajuste de cor necessário.
 *
 * Uso:
 *   <StudioBreadcrumb
 *     items={[
 *       { label: 'Estúdio', href: '/studio' },
 *       { label: 'Catálogo', href: '/studio/estoque' },
 *       { label: 'Caneca branca' }, // sem href = atual
 *     ]}
 *   />
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import type { StudioPalette } from '../../constants/studio-tokens';
import { useStudioTokens } from '@/contexts/StudioThemeMode';

export type StudioBreadcrumbItem = { label: string; href?: string };

export function StudioBreadcrumb({ items, sticky = true }: { items: StudioBreadcrumbItem[]; sticky?: boolean }) {
  const router = useRouter();
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  return (
    <View
      style={[
        styles.bar,
        sticky && Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as any) : null,
      ]}
    >
      {items.map((it, idx) => {
        const last = idx === items.length - 1;
        return (
          <View key={`${it.label}-${idx}`} style={styles.row}>
            {idx > 0 ? (
              <View style={{ marginHorizontal: 4 }}>
                <Icon name="chevron_right" size={14} color={t.ink3} />
              </View>
            ) : null}
            {it.href && !last ? (
              <Pressable onPress={() => router.push(it.href as any)}>
                <Text style={styles.link}>{it.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.text, last && styles.current]}>{it.label}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: t.ink5,
    zIndex: 50,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: {
    // t.primary (#1E3A8A light, #3B82F6 dark) — ambos ≥4.5:1 sobre paperCard
    color: t.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  text: {
    // t.ink3 (#5E6A7A light, #94A3B8 dark) — 5.1:1 light, 5.7:1 dark ✓ AA
    color: t.ink3,
    fontSize: 13,
  },
  current: {
    color: t.ink,
    fontWeight: '700',
  },
  });
}

export default StudioBreadcrumb;
