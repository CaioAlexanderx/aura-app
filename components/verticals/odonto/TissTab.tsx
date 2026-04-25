// ============================================================
// AURA. — W2-02: Wrapper TissTab pra encaixar no OdontoSubNav
//
// O OdontoSubNav espera um Component sem props. TissDashboard
// e um Modal full-screen com prop `visible`. Este wrapper renderiza
// um botao centralizado "Abrir TISS" que abre o dashboard.
//
// Decidi por wrapper ao inves de inline porque:
// 1. TissDashboard tem state/modais proprios (CatalogPicker,
//    GuideForm, BatchForm) que nao fazem sentido dentro do shell
//    do OdontoScreen (ja tem header + sub-nav + scroll).
// 2. Manter TissDashboard como Modal preserva a UX mobile-first
//    de tela cheia.
// 3. Card de entrada da uma intro melhor (5 convenios pre-cadastrados,
//    o que faz, etc) sem precisar mostrar tudo de cara.
// ============================================================

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Icon } from '@/components/Icon';
import { TissDashboard } from '@/components/verticals/odonto/TissDashboard';

export function TissTab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.heroIcon}>
          <Icon name="briefcase" size={36} color="#a78bfa" />
        </View>
        <Text style={s.title}>Faturamento TISS 4.01</Text>
        <Text style={s.subtitle}>
          Cadastre conv\u00eanios, gere guias TISS oficiais e fa\u00e7a o faturamento
          mensal em lote.
        </Text>

        <View style={s.featureCard}>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>5 conv\u00eanios pr\u00e9-cadastrados (Bradesco, Amil, SulAm\u00e9rica, Unimed)</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>4 tipos de guia (Consulta, SP/SADT, Honor\u00e1rio, Interna\u00e7\u00e3o)</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Gera\u00e7\u00e3o de XML TISS 4.01.00 oficial ANS</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Lotes de faturamento mensal com hash MD5</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Reconcilia\u00e7\u00e3o de pagamentos via XML de retorno</Text>
          </View>
        </View>

        <Pressable onPress={() => setOpen(true)} style={s.btnPrimary}>
          <Icon name="arrow_right" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Abrir gest\u00e3o TISS</Text>
        </Pressable>

        <Text style={s.help}>
          O sistema legado de conv\u00eanios continua dispon\u00edvel na tab "Conv\u00eanios" para
          compatibilidade. O TISS \u00e9 o m\u00f3dulo novo (W2-02) com suporte completo
          ao padr\u00e3o ANS para faturamento.
        </Text>
      </ScrollView>

      <TissDashboard visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 14, alignItems: 'center' },

  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
    marginTop: 12, marginBottom: 4,
  },
  title: {
    color: Colors.ink || '#FFFFFF',
    fontSize: 18, fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.ink3 || '#94A3B8',
    fontSize: 13, textAlign: 'center', lineHeight: 19,
    maxWidth: 360, marginBottom: 8,
  },

  featureCard: {
    backgroundColor: Colors.bg3 || '#1E293B',
    borderRadius: 12, padding: 14, gap: 8,
    borderWidth: 0.5, borderColor: Colors.border || '#334155',
    width: '100%', maxWidth: 480,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  featureText: {
    color: Colors.ink || '#CBD5E1',
    fontSize: 12, flex: 1, lineHeight: 18,
  },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10,
    backgroundColor: '#7c3aed',
    minWidth: 220, marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  help: {
    color: Colors.ink3 || '#64748B',
    fontSize: 11, textAlign: 'center', lineHeight: 17,
    maxWidth: 360, marginTop: 12, fontStyle: 'italic',
  },
});

export default TissTab;
