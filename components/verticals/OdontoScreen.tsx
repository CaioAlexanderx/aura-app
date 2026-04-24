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
import { DentalSettings } from '@/components/verticals/odonto/DentalSettings';
import { LabTab } from '@/components/verticals/odonto/LabTab';
import { RetornoTab } from '@/components/verticals/odonto/RetornoTab';
import type { VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// OdontoScreen — Orchestrator for the Odontologia vertical
// 16 tabs wired to real API-connected components.
// ODT-15 (23/04): +2 tabs "Laboratorio" e "Retorno" da Camada 4b.
//   - Laboratorio: pedidos a laboratorios externos (proteses/trabalhos)
//   - Retorno: recall de pacientes + historico de faltas (2 sub-tabs)
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Odontologia',
  icon: '\uD83E\uDDB7',
  accent: '#06B6D4',
  establishment: 'Minha Clinica',
  professional: 'Dr. Nome \u2014 CRO-SP 00000',
};

const TABS = [
  'Dashboard', 'Agenda', 'Pacientes', 'Funil', 'Odontograma',
  'Orcamentos', 'Prontuario', 'Cobrancas', 'Repasses', 'Laboratorio',
  'Automacoes', 'Retorno', 'Convenios', 'Check-in', 'Espera', 'Configuracoes',
];

const TAB_COMPONENTS: Record<string, React.FC> = {
  Dashboard:      OdontoDashboard,
  Agenda:         AgendaTab,
  Pacientes:      PacientesTab,
  Funil:          DentalFunnel,
  Odontograma:    OdontogramaTab,
  Orcamentos:     OrcamentosTab,
  Prontuario:     ProntuarioTab,
  Cobrancas:      BillingDashboard,
  Repasses:       RepasseDentista,
  Laboratorio:    LabTab,
  Automacoes:     AutomationConfig,
  Retorno:        RetornoTab,
  Convenios:      ConveniosTab,
  'Check-in':     CheckinTab,
  Espera:         EsperaTab,
  Configuracoes:  DentalSettings,
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
