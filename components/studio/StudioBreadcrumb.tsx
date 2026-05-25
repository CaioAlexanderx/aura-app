/**
 * StudioBreadcrumb — item #5 da análise UX/UI.
 * Helper sticky pra navegação contextual em telas profundas (composição, detalhe pedido).
 *
 * Uso:
 *   <StudioBreadcrumb
 *     items={[
 *       { label: 'Estúdio', href: '/studio' },
 *       { label: 'Produtos', href: '/studio/produtos' },
 *       { label: 'Caneca branca' }, // sem href = atual
 *     ]}
 *   />
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StudioColors } from '../../constants/studio-tokens';

export type StudioBreadcrumbItem = { label: string; href?: string };

export function StudioBreadcrumb({ items, sticky = true }: { items: StudioBreadcrumbItem[]; sticky?: boolean }) {
  const router = useRouter();
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
            {idx > 0 ? <ChevronRight size={14} color={StudioColors.ink3} style={{ marginHorizontal: 4 }} /> : null}
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: StudioColors.paperCard,
    borderBottomWidth: 1,
    borderBottomColor: StudioColors.ink5 ?? '#E2E8F0',
    zIndex: 50,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: {
    color: StudioColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  text: {
    color: StudioColors.ink3,
    fontSize: 13,
  },
  current: {
    color: StudioColors.ink1 ?? '#0F172A',
    fontWeight: '700',
  },
});

export default StudioBreadcrumb;
