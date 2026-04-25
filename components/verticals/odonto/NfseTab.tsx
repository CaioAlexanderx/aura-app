// ============================================================
// AURA. — W2-03: Wrapper NfseTab pra encaixar no OdontoSubNav
//
// Mesmo padrao do TissTab. NfseDashboard e um Modal full-screen
// que precisa de prop visible. Este wrapper renderiza um card
// de entrada (hero + features + botao) que abre o dashboard.
//
// IMPORTANTE: o NfseDashboard fica em components/nfse/ (cross-vertical).
// Este wrapper TissTab/NfseTab acopla ele ao menu Odonto.
// Outras verticals (barber/food) podem reusar o mesmo padrao
// criando wrappers proprios.
// ============================================================

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { Icon } from '@/components/Icon';
import { NfseDashboard } from '@/components/nfse/NfseDashboard';

export function NfseTab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.heroIcon}>
          <Icon name="file_text" size={36} color="#a78bfa" />
        </View>
        <Text style={s.title}>Notas Fiscais de Servico</Text>
        <Text style={s.subtitle}>
          Emita NFS-e diretamente pelo Aura. Provider integrado, calculo
          automatico de ISS, PDF/XML pra entregar ao cliente.
        </Text>

        <View style={s.featureCard}>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Provider Nuvem Fiscal (cobertura nacional)</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Calculo automatico de ISS conforme aliquota local</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Suporte a Simples Nacional + regime normal</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>API key cifrada AES-256-GCM no banco</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Cancelamento e reconsulta de status</Text>
          </View>
          <View style={s.featureRow}>
            <Icon name="check" size={14} color="#10B981" />
            <Text style={s.featureText}>Modo homologacao gratuito pra testar</Text>
          </View>
        </View>

        <Pressable onPress={() => setOpen(true)} style={s.btnPrimary}>
          <Icon name="arrow_right" size={14} color="#fff" />
          <Text style={s.btnPrimaryText}>Abrir gestao NFS-e</Text>
        </Pressable>

        <Text style={s.help}>
          A primeira vez que abrir, voce sera direcionado pro setup pra cadastrar
          a chave do Nuvem Fiscal e os dados fiscais da clinica (Inscricao Municipal,
          codigo de servico, aliquota ISS).
        </Text>
      </ScrollView>

      <NfseDashboard visible={open} onClose={() => setOpen(false)} />
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

export default NfseTab;
