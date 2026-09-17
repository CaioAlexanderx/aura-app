// ============================================================
// AURA. — matchAllergyChips (AnamneseWizard)
//
// Pre-selecao de alergias do cadastro do paciente nos chips da
// anamnese odontologica. Cobre: match exato, acento/caixa, match
// parcial (palavra dentro de chip composto), sinonimos de "nenhuma",
// e fallback pra "Outra" quando nao bate com nenhum chip conhecido.
// ============================================================

import { matchAllergyChips } from '@/components/verticals/odonto/AnamneseWizard';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  TextInput: 'TextInput', StyleSheet: { create: (s: any) => s },
}));
jest.mock('@/constants/colors', () => ({
  Colors: { bg: '#0a0a1a', bg2: '#1a1a2e', bg3: '#141428', ink: '#fff', ink2: '#aaa', ink3: '#888', border: '#333', violet: '#7C3AED', bg4: '#222' },
}));

const CHIPS = ['Nenhuma', 'Penicilina', 'Dipirona', 'Látex', 'Anestésico (lidocaína)', 'AAS', 'Iodo', 'Níquel', 'Outra'];

describe('matchAllergyChips', () => {
  it('retorna vazio pra texto vazio/nulo', () => {
    expect(matchAllergyChips(undefined, CHIPS)).toEqual({ matched: [], hasUnmatched: false });
    expect(matchAllergyChips(null, CHIPS)).toEqual({ matched: [], hasUnmatched: false });
    expect(matchAllergyChips('', CHIPS)).toEqual({ matched: [], hasUnmatched: false });
  });

  it('casa nome exato do chip', () => {
    expect(matchAllergyChips('Penicilina', CHIPS)).toEqual({ matched: ['Penicilina'], hasUnmatched: false });
  });

  it('ignora acento e caixa', () => {
    expect(matchAllergyChips('latex', CHIPS)).toEqual({ matched: ['Látex'], hasUnmatched: false });
    expect(matchAllergyChips('NIQUEL', CHIPS)).toEqual({ matched: ['Níquel'], hasUnmatched: false });
  });

  it('casa palavra dentro de chip composto (Anestésico (lidocaína))', () => {
    expect(matchAllergyChips('lidocaina', CHIPS)).toEqual({ matched: ['Anestésico (lidocaína)'], hasUnmatched: false });
    expect(matchAllergyChips('anestesico', CHIPS)).toEqual({ matched: ['Anestésico (lidocaína)'], hasUnmatched: false });
  });

  it('casa varios itens separados por virgula', () => {
    const r = matchAllergyChips('Penicilina, Látex', CHIPS);
    expect(r.hasUnmatched).toBe(false);
    expect(new Set(r.matched)).toEqual(new Set(['Penicilina', 'Látex']));
  });

  it('reconhece sinonimos de "nenhuma" e nao gera unmatched', () => {
    expect(matchAllergyChips('Nenhuma', CHIPS)).toEqual({ matched: ['Nenhuma'], hasUnmatched: false });
    expect(matchAllergyChips('nao', CHIPS)).toEqual({ matched: ['Nenhuma'], hasUnmatched: false });
    expect(matchAllergyChips('N/A', CHIPS)).toEqual({ matched: ['Nenhuma'], hasUnmatched: false });
  });

  it('marca hasUnmatched quando o texto nao bate com nenhum chip conhecido', () => {
    const r = matchAllergyChips('Camarão', CHIPS);
    expect(r.matched).toEqual([]);
    expect(r.hasUnmatched).toBe(true);
  });

  it('mistura chip conhecido com termo desconhecido', () => {
    const r = matchAllergyChips('Penicilina, Camarão', CHIPS);
    expect(r.matched).toEqual(['Penicilina']);
    expect(r.hasUnmatched).toBe(true);
  });

  it('nao gera falso positivo pra token curto (ex: "a")', () => {
    const r = matchAllergyChips('a', CHIPS);
    expect(r.matched).toEqual([]);
    expect(r.hasUnmatched).toBe(true);
  });
});
