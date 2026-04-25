// ============================================================
// AURA. — Odonto Sections (W2-01 + W2-02 TISS + W2-03 NFS-e)
// Reagrupa 16 tabs flat em 6 secoes com sub-tabs internas.
// Estrutura referenciada pelo OdontoScreen + OdontoSubNav.
// ============================================================

import type { ComponentType } from 'react';
import { OdontoDashboard } from '@/components/verticals/odonto/OdontoDashboard';
import { AgendaTab, PacientesTab, OdontogramaTab, ProntuarioTab } from '@/components/verticals/odonto/OdontoClinicTabs';
import { OrcamentosTab, ConveniosTab, CheckinTab, EsperaTab, AgendaOnlineTab } from '@/components/verticals/odonto/OdontoAdminTabs';
import { DentalFunnel } from '@/components/verticals/odonto/DentalFunnel';
import { BillingDashboard } from '@/components/verticals/odonto/BillingDashboard';
import { RepasseDentista } from '@/components/verticals/odonto/RepasseDentista';
import { LabTab } from '@/components/verticals/odonto/LabTab';
import { AutomationConfig } from '@/components/verticals/odonto/AutomationConfig';
import { RetornoTab } from '@/components/verticals/odonto/RetornoTab';
import { DentalSettings } from '@/components/verticals/odonto/DentalSettings';
import { TissTab } from '@/components/verticals/odonto/TissTab';
import { NfseTab } from '@/components/verticals/odonto/NfseTab';

export interface SubTab {
  id: string;
  label: string;
  component: ComponentType<any>;
  /** Marca tabs novas/destacadas */
  badge?: 'novo' | 'beta';
}

export interface Section {
  id: string;
  label: string;
  icon: string;
  tabs: SubTab[];
}

// Painel solto fora das 6 secoes — volta a homepage do modulo
export const HOME_SECTION: Section = {
  id: 'painel',
  label: 'Painel',
  icon: '\uD83D\uDCCA',
  tabs: [
    { id: 'dashboard', label: 'Visao geral', component: OdontoDashboard },
  ],
};

export const SECTIONS: Section[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    icon: '\uD83D\uDCC5',
    tabs: [
      { id: 'agenda-dia', label: 'Hoje e proximos', component: AgendaTab },
      { id: 'agenda-online', label: 'Agendamento online', component: AgendaOnlineTab, badge: 'novo' },
    ],
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    icon: '\uD83D\uDC65',
    tabs: [
      { id: 'lista', label: 'Lista', component: PacientesTab },
      { id: 'funil', label: 'Funil de leads', component: DentalFunnel },
      { id: 'espera', label: 'Lista de espera', component: EsperaTab },
      { id: 'checkin', label: 'Check-in', component: CheckinTab },
    ],
  },
  {
    id: 'clinica',
    label: 'Clinica',
    icon: '\uD83E\uDDB7',
    tabs: [
      { id: 'odontograma', label: 'Odontograma', component: OdontogramaTab },
      { id: 'prontuario', label: 'Prontuario', component: ProntuarioTab },
      // ANAMNESE / PERIOGRAMA / FICHAS / IMAGENS = dentro do PatientHub (W1-01/02)
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: '\uD83D\uDCB0',
    tabs: [
      { id: 'orcamentos', label: 'Orcamentos', component: OrcamentosTab },
      { id: 'cobrancas', label: 'Cobrancas', component: BillingDashboard },
      { id: 'nfse', label: 'NFS-e', component: NfseTab, badge: 'novo' }, // W2-03
      { id: 'tiss', label: 'TISS', component: TissTab, badge: 'novo' }, // W2-02
      { id: 'repasses', label: 'Repasses', component: RepasseDentista },
      { id: 'convenios', label: 'Convenios (legado)', component: ConveniosTab },
      { id: 'laboratorio', label: 'Laboratorio', component: LabTab },
    ],
  },
  {
    id: 'engajamento',
    label: 'Engajamento',
    icon: '\uD83D\uDCAC',
    tabs: [
      { id: 'automacoes', label: 'Automacoes', component: AutomationConfig },
      { id: 'retorno', label: 'Retorno e recall', component: RetornoTab, badge: 'novo' },
      // futuro W3-02: marketing / indicacoes
    ],
  },
  {
    id: 'config',
    label: 'Configuracoes',
    icon: '\u2699\uFE0F',
    tabs: [
      { id: 'clinica-config', label: 'Clinica e cadeiras', component: DentalSettings },
      // futuro: procedimentos, horarios
    ],
  },
];

export const ALL_SECTIONS: Section[] = [HOME_SECTION, ...SECTIONS];

/** Nomes dos labels pra alimentar o VerticalShell.tabs */
export const SECTION_LABELS: string[] = ALL_SECTIONS.map((s) => s.label);

export function getSection(label: string): Section | undefined {
  return ALL_SECTIONS.find((s) => s.label === label);
}
