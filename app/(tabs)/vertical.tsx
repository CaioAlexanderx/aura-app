import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { Colors } from '@/constants/colors';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/stores/auth';
import OdontoScreen from '@/components/verticals/OdontoScreen';
import BarberScreen from '@/components/verticals/BarberScreen';
import FoodScreen from '@/components/verticals/FoodScreen';

// ============================================================
// Vertical Tab — Roteia para a tela da vertical ativa.
// Fonte da verdade: company.vertical_active (vem do /auth/me + login).
// Ativacao feita pelo admin via Gestao Aura > Clientes > slide-over.
// ============================================================

// Labels das 6 verticais. Apenas 3 tem tela implementada;
// as outras (estetica, pet, academia) mostram placeholder
// "modulo em desenvolvimento".
const VERTICAL_NAMES: Record<string, string> = {
  odonto: 'Odontologia',
  barber: 'Barbearia / Salao',
  food: 'Food Service',
  estetica: 'Estetica',
  pet: 'Pet Shop',
  academia: 'Academia',
};

const READY_VERTICALS = ['odonto', 'barber', 'food'];

export default function VerticalTab() {
  const { company } = useAuthStore();
  // company.vertical_active vem do backend — typed no LoginResponse,
  // mas cast pra 'as any' pra evitar problema com declaracao de tipo em
  // arquivos que ainda referenciam o shape antigo do store.
  const activeVertical = (company as any)?.vertical_active ?? null;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <PageHeader
        title={activeVertical ? VERTICAL_NAMES[activeVertical] || 'Modulo Vertical' : 'Modulo Vertical'}
        subtitle={activeVertical ? 'Funcionalidades especializadas do seu segmento' : 'Ative um modulo vertical pela equipe Aura'}
      />

      {activeVertical === 'odonto' && <OdontoScreen />}
      {activeVertical === 'barber' && <BarberScreen />}
      {activeVertical === 'food' && <FoodScreen />}

      {!activeVertical && (
        <View style={s.noVertical}>
          <Text style={s.noIcon}>\uD83D\uDD12</Text>
          <Text style={s.noTitle}>Nenhum modulo vertical ativo</Text>
          <Text style={s.noText}>Modulos verticais sao ativados pela equipe Aura no setup do seu negocio. Disponiveis: Odontologia, Barbearia/Salao, Food Service, Estetica, Pet Shop e Academia.</Text>
          <Text style={s.noContact}>Entre em contato com seu Analista de Negocios para ativar.</Text>
        </View>
      )}

      {activeVertical && !READY_VERTICALS.includes(activeVertical) && (
        <View style={s.noVertical}>
          <Text style={s.noIcon}>\uD83D\uDEA7</Text>
          <Text style={s.noTitle}>Modulo em desenvolvimento</Text>
          <Text style={s.noText}>O modulo {VERTICAL_NAMES[activeVertical] || activeVertical} esta sendo preparado. Em breve estara disponivel para uso.</Text>
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
