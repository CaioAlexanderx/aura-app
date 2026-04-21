import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { Colors } from '@/constants/colors';
import { PageHeader } from '@/components/PageHeader';
import OdontoScreen from '@/components/verticals/OdontoScreen';
import BarberScreen from '@/components/verticals/BarberScreen';
import FoodScreen from '@/components/verticals/FoodScreen';

// ============================================================
// Vertical Tab — Routes to the correct vertical module screen
// Activated via Gestao Aura toggle per company
// ============================================================

// TODO: Replace with real hook
function useActiveVertical(): string | null {
  // In production: fetch from /companies/:id/modules and return active vertical
  const [vertical, setVertical] = useState<string | null>('odonto');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aura_active_vertical');
      if (stored) setVertical(stored);
      const handler = () => {
        const v = localStorage.getItem('aura_active_vertical');
        setVertical(v);
      };
      window.addEventListener('storage', handler);
      window.addEventListener('aura-vertical-change', handler);
      return () => { window.removeEventListener('storage', handler); window.removeEventListener('aura-vertical-change', handler); };
    }
  }, []);
  return vertical;
}

export default function VerticalTab() {
  const activeVertical = useActiveVertical();

  const verticalNames: Record<string, string> = {
    odonto: 'Odontologia',
    barber: 'Barbearia / Salao',
    food: 'Food Service',
    estetica: 'Estetica',
    pet: 'Pet Shop',
    academia: 'Academia',
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <PageHeader
        title={activeVertical ? verticalNames[activeVertical] || 'Modulo Vertical' : 'Modulo Vertical'}
        subtitle={activeVertical ? 'Funcionalidades especializadas do seu segmento' : 'Ative um modulo vertical na Gestao Aura'}
      />

      {activeVertical === 'odonto' && <OdontoScreen />}
      {activeVertical === 'barber' && <BarberScreen />}
      {activeVertical === 'food' && <FoodScreen />}

      {!activeVertical && (
        <View style={s.noVertical}>
          <Text style={s.noIcon}>\uD83D\uDD12</Text>
          <Text style={s.noTitle}>Nenhum modulo vertical ativo</Text>
          <Text style={s.noText}>Modulos verticais sao ativados pela equipe Aura no setup do seu negocio. Disponiveis: Odontologia, Barbearia/Salao, Food Service, Estetica, Pet Shop e mais.</Text>
          <Text style={s.noContact}>Entre em contato com seu Analista de Negocios para ativar.</Text>
        </View>
      )}

      {activeVertical && !['odonto', 'barber', 'food'].includes(activeVertical) && (
        <View style={s.noVertical}>
          <Text style={s.noIcon}>\uD83D\uDEA7</Text>
          <Text style={s.noTitle}>Modulo em desenvolvimento</Text>
          <Text style={s.noText}>O modulo {verticalNames[activeVertical] || activeVertical} esta sendo preparado. Em breve estara disponivel para uso.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg || '#0a0a1a' },
  container: { padding: 20, paddingBottom: 40, gap: 16, maxWidth: 900, alignSelf: 'center', width: '100%' },
  noVertical: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  noIcon: { fontSize: 48 },
  noTitle: { fontSize: 18, fontWeight: '700', color: Colors.ink || '#fff' },
  noText: { fontSize: 13, color: Colors.ink3 || '#888', textAlign: 'center', maxWidth: 360, lineHeight: 20 },
  noContact: { fontSize: 12, color: Colors.violet3 || '#a78bfa', fontWeight: '500', marginTop: 8 },
});
