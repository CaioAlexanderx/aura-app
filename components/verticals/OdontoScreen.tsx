import { useState, useMemo } from 'react';
import { View } from 'react-native';
import { VerticalShell } from '@/components/verticals/VerticalShell';
import { OdontoSubNav } from '@/components/verticals/odonto/OdontoSubNav';
import { ALL_SECTIONS, SECTION_LABELS, getSection } from '@/components/verticals/odonto/sections';
import type { VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// OdontoScreen — Orchestrator da vertical Odontologia
//
// W2-01 (24/04): reagrupamento das 16 tabs flat em 6 secoes +
// Painel. Top-level usa VerticalShell com SECTION_LABELS como
// tabs. Dentro de cada secao, OdontoSubNav renderiza chips
// horizontais pras sub-tabs internas (quando ha mais de 1).
//
// Estado:
//   sectionLabel     -> qual das 7 secoes esta ativa (Painel + 6)
//   subTabsBySection -> mapa { sectionLabel: activeSubTabId }
//                       preserva sub-tab selecionada ao trocar
//                       de secao e voltar (melhor UX)
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Odontologia',
  icon: '\uD83E\uDDB7',
  accent: '#06B6D4',
  establishment: 'Minha Clinica',
  professional: 'Dr. Nome \u2014 CRO-SP 00000',
};

export default function OdontoScreen() {
  const [sectionLabel, setSectionLabel] = useState<string>('Painel');
  const [subTabsBySection, setSubTabsBySection] = useState<Record<string, string>>({});

  const section = useMemo(() => getSection(sectionLabel), [sectionLabel]);

  // Sub-tab ativa: respeita selecao anterior ou volta pra primeira
  const activeSubTabId = useMemo(() => {
    if (!section) return null;
    const saved = subTabsBySection[sectionLabel];
    if (saved && section.tabs.some((t) => t.id === saved)) return saved;
    return section.tabs[0]?.id || null;
  }, [section, sectionLabel, subTabsBySection]);

  const activeSubTab = useMemo(
    () => section?.tabs.find((t) => t.id === activeSubTabId),
    [section, activeSubTabId]
  );

  const Component = activeSubTab?.component || (() => null);

  function handleSubTabChange(id: string) {
    setSubTabsBySection((prev) => ({ ...prev, [sectionLabel]: id }));
  }

  // Se a secao tem mais de 1 sub-tab, renderiza OdontoSubNav.
  // Senao, so o componente direto (Painel tem 1 so).
  const showSubNav = section && section.tabs.length > 1;

  return (
    <VerticalShell
      config={CONFIG}
      tabs={SECTION_LABELS}
      activeTab={sectionLabel}
      onTabChange={setSectionLabel}
      kpis={[]}
      flowSteps={[]}
      flowTitle=""
    >
      {showSubNav && activeSubTabId && (
        <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 12 }}>
          {/* Margens negativas compensam padding do contentCard do VerticalShell
              pra SubNav ocupar toda largura visual da secao */}
          <OdontoSubNav
            tabs={section!.tabs}
            activeId={activeSubTabId}
            onChange={handleSubTabChange}
          />
        </View>
      )}
      <Component />
    </VerticalShell>
  );
}
