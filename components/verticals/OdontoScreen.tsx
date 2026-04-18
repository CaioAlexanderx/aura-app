import { useState } from 'react';
import { View } from 'react-native';
import { VerticalShell } from '@/components/verticals/VerticalShell';
import { DentalFunnel } from '@/components/verticals/odonto/DentalFunnel';
import { BillingDashboard } from '@/components/verticals/odonto/BillingDashboard';
import { RepasseDentista } from '@/components/verticals/odonto/RepasseDentista';
import { AutomationConfig } from '@/components/verticals/odonto/AutomationConfig';
import { OdontoDashboard } from '@/components/verticals/odonto/OdontoDashboard';
import { AgendaTab, PacientesTab, OdontogramaTab, ProntuarioTab } from '@/components/verticals/odonto/OdontoClinicTabs';
import { OrcamentosTab, ConveniosTab, CheckinTab, EsperaTab } from '@/components/verticals/odonto/OdontoAdminTabs';
import type { VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// OdontoScreen — Orchestrator for the Odontologia vertical
// ALL 13 tabs wired to real API-connected components
// Tab wrappers split into OdontoClinicTabs + OdontoAdminTabs
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Odontologia',
  icon: '\uD83E\uDDB7',
  accent: '#06B6D4',
  establishment: 'Minha Clinica',
  professional: 'Dr. Nome — CRO-SP 00000',
};

const TABS = [
  'Dashboard', 'Agenda', 'Pacientes', 'Funil', 'Odontograma',
  'Orcamentos', 'Prontuario', 'Cobrancas', 'Repasses',
  'Automacoes', 'Convenios', 'Check-in', 'Espera',
];

const TAB_COMPONENTS: Record<string, React.FC> = {
  Dashboard:   OdontoDashboard,
  Agenda:      AgendaTab,
  Pacientes:   PacientesTab,
  Funil:       DentalFunnel,
  Odontograma: OdontogramaTab,
  Orcamentos:  OrcamentosTab,
  Prontuario:  ProntuarioTab,
  Cobrancas:   BillingDashboard,
  Repasses:    RepasseDentista,
  Automacoes:  AutomationConfig,
  Convenios:   ConveniosTab,
  'Check-in':  CheckinTab,
  Espera:      EsperaTab,
};

export default function OdontoScreen() {
  const [tab, setTab] = useState('Dashboard');
  const Component = TAB_COMPONENTS[tab] || OdontoDashboard;

  return (
    <VerticalShell
      config={CONFIG}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      kpis={[]}
      flowSteps={[]}
      flowTitle=""
    >
      <Component />
    </VerticalShell>
  );
}
