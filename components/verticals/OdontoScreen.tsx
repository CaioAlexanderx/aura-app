import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerticalShell, VerticalRow, VerticalEmpty } from '@/components/verticals/VerticalShell';
import { DentalFunnel } from '@/components/verticals/odonto/DentalFunnel';
import { BillingDashboard } from '@/components/verticals/odonto/BillingDashboard';
import { RepasseDentista } from '@/components/verticals/odonto/RepasseDentista';
import type { KPI, FlowStep, VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// OdontoScreen — Orchestrator for the Odontologia vertical
// Uses VerticalShell + wires all odonto components
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Odontologia',
  icon: '\uD83E\uDDB7',
  accent: '#06B6D4',
  establishment: 'Minha Clinica',
  professional: 'Dr. Nome — CRO-SP 00000',
};

const TABS = ['Agenda', 'Pacientes', 'Funil', 'Odontograma', 'Orcamentos', 'Prontuario', 'Cobrancas', 'Repasses', 'Convenios', 'Check-in', 'Espera'];

// Tabs with custom components (rendered directly, not via VerticalShell content)
const CUSTOM_TABS = ['Funil', 'Cobrancas', 'Repasses'];

const SCREEN_DATA: Record<string, { kpis: KPI[]; flow: { title: string; steps: FlowStep[] }; actionLabel: string; rows: any[]; emptyIcon: string; emptyTitle: string; emptySubtitle: string }> = {
  Agenda: {
    kpis: [{ value: '0', label: 'Hoje', color: '#06B6D4' }, { value: '0', label: 'Confirmados', color: '#10B981' }, { value: '0', label: 'Pendentes', color: '#F59E0B' }, { value: '0', label: 'Faltou', color: '#EF4444' }],
    flow: { title: 'Fluxo do paciente', steps: [{ label: 'Agendamento' }, { label: 'Check-in' }, { label: 'Anamnese' }, { label: 'Odontograma' }, { label: 'Orcamento' }, { label: 'Tratamento' }, { label: 'Pagamento' }, { label: 'Recall' }] },
    actionLabel: '+ Agendar', rows: [],
    emptyIcon: '\uD83D\uDCC5', emptyTitle: 'Nenhum agendamento hoje', emptySubtitle: 'Agende o primeiro paciente para comecar.',
  },
  Pacientes: {
    kpis: [{ value: '0', label: 'Total', color: '#06B6D4' }, { value: '0', label: 'Em tratamento', color: '#10B981' }, { value: '0', label: 'Retorno pendente', color: '#F59E0B' }, { value: '0', label: 'Orcamento aberto', color: '#7C3AED' }],
    flow: { title: 'Jornada do paciente', steps: [{ label: 'Captacao' }, { label: '1a consulta' }, { label: 'Diagnostico' }, { label: 'Orcamento' }, { label: 'Aprovacao' }, { label: 'Tratamento' }, { label: 'Alta/recall' }] },
    actionLabel: '+ Paciente', rows: [],
    emptyIcon: '\uD83D\uDC64', emptyTitle: 'Nenhum paciente cadastrado', emptySubtitle: 'Cadastre o primeiro paciente com consentimento LGPD.',
  },
  Odontograma: {
    kpis: [{ value: '32', label: 'Dentes', color: '#06B6D4' }, { value: '0', label: 'Com carie', color: '#EF4444' }, { value: '0', label: 'Restaurados', color: '#10B981' }, { value: '0', label: 'Planejados', color: '#F59E0B' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Selecionar dente' }, { label: 'Escolher face' }, { label: 'Definir status' }, { label: 'Vincular proc.' }, { label: 'Salvar' }] },
    actionLabel: '', rows: [],
    emptyIcon: '\uD83E\uDDB7', emptyTitle: 'Selecione um paciente', emptySubtitle: 'Escolha um paciente na aba Pacientes para visualizar o odontograma.',
  },
  Orcamentos: {
    kpis: [{ value: 'R$ 0', label: 'Pipeline', color: '#06B6D4' }, { value: '0', label: 'Pendentes', color: '#F59E0B' }, { value: '0', label: 'Aprovados', color: '#10B981' }, { value: 'R$ 0', label: 'Em tratamento', color: '#7C3AED' }],
    flow: { title: 'Funil', steps: [{ label: 'Criar' }, { label: 'Enviar WhatsApp' }, { label: 'Negociar' }, { label: 'Aprovar' }, { label: 'Parcelar' }, { label: 'Acompanhar' }] },
    actionLabel: '+ Orcamento', rows: [],
    emptyIcon: '\uD83D\uDCCB', emptyTitle: 'Nenhum orcamento', emptySubtitle: 'Crie o primeiro orcamento digital com procedimentos e parcelas.',
  },
  Prontuario: {
    kpis: [{ value: '0', label: 'Consultas', color: '#06B6D4' }, { value: 'R$ 0', label: 'Investido', color: '#10B981' }, { value: '-', label: 'Tempo paciente', color: '#F59E0B' }, { value: '0', label: 'Documentos', color: '#7C3AED' }],
    flow: { title: 'Timeline', steps: [{ label: 'Consulta' }, { label: 'Procedimento' }, { label: 'Receita' }, { label: 'Imagem' }, { label: 'Evolucao' }] },
    actionLabel: '+ Receita', rows: [],
    emptyIcon: '\uD83D\uDCC4', emptyTitle: 'Prontuario vazio', emptySubtitle: 'Selecione um paciente para ver o historico completo.',
  },
  Convenios: {
    kpis: [{ value: '0', label: 'Convenios', color: '#06B6D4' }, { value: '0', label: 'Procedimentos', color: '#10B981' }, { value: '0', label: 'Guias TISS', color: '#F59E0B' }, { value: 'R$ 0', label: 'A receber', color: '#7C3AED' }],
    flow: { title: 'Fluxo TISS', steps: [{ label: 'Cadastrar convenio' }, { label: 'Tabela TUSS' }, { label: 'Criar guia' }, { label: 'Enviar' }, { label: 'Autorizar' }, { label: 'Executar' }] },
    actionLabel: '+ Convenio', rows: [],
    emptyIcon: '\uD83C\uDFE5', emptyTitle: 'Nenhum convenio cadastrado', emptySubtitle: 'Cadastre convenios e vincule a tabela TUSS para gerar guias.',
  },
  'Check-in': {
    kpis: [{ value: '0', label: 'Aguardando', color: '#06B6D4' }, { value: '0', label: 'Chamados', color: '#F59E0B' }, { value: '0', label: 'Em atend.', color: '#10B981' }, { value: '0', label: 'Concluidos', color: '#9CA3AF' }],
    flow: { title: 'Status', steps: [{ label: 'Chegou' }, { label: 'Chamar' }, { label: 'Atender' }, { label: 'Concluir' }] },
    actionLabel: '+ Check-in', rows: [],
    emptyIcon: '\u2705', emptyTitle: 'Nenhum check-in hoje', emptySubtitle: 'Pacientes fazem check-in por QR code ou manualmente na recepcao.',
  },
  Espera: {
    kpis: [{ value: '0', label: 'Na fila', color: '#06B6D4' }, { value: '0', label: 'Urgentes', color: '#EF4444' }, { value: '0', label: 'Notificados', color: '#F59E0B' }, { value: '0', label: 'Agendados', color: '#10B981' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Adicionar' }, { label: 'Aguardar vaga' }, { label: 'Notificar' }, { label: 'Agendar' }] },
    actionLabel: '+ Adicionar', rows: [],
    emptyIcon: '\u23F3', emptyTitle: 'Lista vazia', emptySubtitle: 'Adicione pacientes que aguardam vaga para encaixe automatico.',
  },
};

export default function OdontoScreen() {
  const [tab, setTab] = useState('Agenda');

  // Custom tabs render their own components directly
  if (tab === 'Funil') {
    return (
      <VerticalShell config={CONFIG} tabs={TABS} activeTab={tab} onTabChange={setTab}
        kpis={[]} flowSteps={[]} flowTitle="">
        <DentalFunnel />
      </VerticalShell>
    );
  }

  if (tab === 'Cobrancas') {
    return (
      <VerticalShell config={CONFIG} tabs={TABS} activeTab={tab} onTabChange={setTab}
        kpis={[]} flowSteps={[]} flowTitle="">
        <BillingDashboard />
      </VerticalShell>
    );
  }

  if (tab === 'Repasses') {
    return (
      <VerticalShell config={CONFIG} tabs={TABS} activeTab={tab} onTabChange={setTab}
        kpis={[]} flowSteps={[]} flowTitle="">
        <RepasseDentista />
      </VerticalShell>
    );
  }

  const data = SCREEN_DATA[tab] || SCREEN_DATA.Agenda;

  return (
    <VerticalShell
      config={CONFIG}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      kpis={data.kpis}
      flowSteps={data.flow.steps}
      flowTitle={data.flow.title}
      actionLabel={data.actionLabel || undefined}
      onAction={data.actionLabel ? () => { /* TODO: open modal */ } : undefined}
    >
      {data.rows.length > 0 ? (
        data.rows.map((row: any, i: number) => (
          <VerticalRow key={i} {...row} />
        ))
      ) : (
        <VerticalEmpty
          icon={data.emptyIcon}
          title={data.emptyTitle}
          subtitle={data.emptySubtitle}
          accent={CONFIG.accent}
          actionLabel={data.actionLabel || undefined}
          onAction={data.actionLabel ? () => {} : undefined}
        />
      )}
    </VerticalShell>
  );
}
