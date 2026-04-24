// ============================================================
// AURA. — Odonto SubNav (W2-01)
// Segmented control horizontal pras sub-tabs internas de cada secao.
// Renderiza no topo do conteudo, abaixo da sidebar principal.
// ============================================================

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import type { SubTab } from '@/components/verticals/odonto/sections';

interface OdontoSubNavProps {
  tabs: SubTab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function OdontoSubNav({ tabs, activeId, onChange }: OdontoSubNavProps) {
  // Se so tem 1 tab, nao renderiza (evita ruido visual)
  if (tabs.length <= 1) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => onChange(t.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.label}
              </Text>
              {t.badge && (
                <View style={[styles.badge, t.badge === 'novo' ? styles.badgeNovo : styles.badgeBeta]}>
                  <Text style={styles.badgeText}>{t.badge.toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeNovo: {
    backgroundColor: '#10B981',
  },
  badgeBeta: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
