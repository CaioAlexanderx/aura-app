import { useState } from 'react';
import { View } from 'react-native';
import { VerticalShell, VerticalRow, VerticalEmpty } from '@/components/verticals/VerticalShell';
import type { KPI, FlowStep, VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// BarberScreen — Orchestrator for the Barber/Salao vertical
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Barbearia / Salao',
  icon: '\u2702\uFE0F',
  accent: '#F59E0B',
  establishment: 'Meu Salao',
  professional: '4 profissionais ativos',
};

const TABS = ['Agenda', 'Fila', 'Comissoes', 'Caixa', 'Pacotes', 'Gift cards', 'Fidelidade', 'Agenda online'];

const SCREEN_DATA: Record<string, { kpis: KPI[]; flow: { title: string; steps: FlowStep[] }; actionLabel: string; emptyIcon: string; emptyTitle: string; emptySubtitle: string }> = {
  Agenda: {
    kpis: [{ value: '0', label: 'Agendados', color: '#F59E0B' }, { value: '0', label: 'Confirmados', color: '#10B981' }, { value: 'R$ 0', label: 'Receita prevista', color: '#06B6D4' }, { value: '0', label: 'Na fila', color: '#7C3AED' }],
    flow: { title: 'Fluxo do atendimento', steps: [{ label: 'Agendar' }, { label: 'Check fila' }, { label: 'Chamar' }, { label: 'Atender' }, { label: 'Finalizar' }, { label: 'Pagamento' }, { label: 'Comissao' }] },
    actionLabel: '+ Agendar',
    emptyIcon: '\uD83D\uDCC5', emptyTitle: 'Nenhum agendamento', emptySubtitle: 'Agende o primeiro cliente ou adicione na fila de espera.',
  },
  Fila: {
    kpis: [{ value: '0', label: 'Na fila', color: '#F59E0B' }, { value: '~0min', label: 'Tempo estimado', color: '#06B6D4' }, { value: '0', label: 'Atendidos hoje', color: '#10B981' }, { value: '-', label: 'Proximo disp.', color: '#7C3AED' }],
    flow: { title: 'Fluxo da fila', steps: [{ label: 'Entrar' }, { label: 'Aguardar' }, { label: 'Chamar' }, { label: 'Atender' }, { label: 'Concluir' }] },
    actionLabel: '+ Fila',
    emptyIcon: '\uD83D\uDE4B', emptyTitle: 'Fila vazia', emptySubtitle: 'Adicione clientes walk-in na fila de espera.',
  },
  Comissoes: {
    kpis: [{ value: 'R$ 0', label: 'Receita bruta', color: '#F59E0B' }, { value: 'R$ 0', label: 'Comissoes', color: '#10B981' }, { value: 'R$ 0', label: 'Cota salao', color: '#7C3AED' }, { value: '0%', label: 'Media', color: '#06B6D4' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Atendimento' }, { label: 'Calcular %' }, { label: 'Acumular' }, { label: 'Gerar folha' }, { label: 'NFS-e parceiro' }, { label: 'Pagamento' }] },
    actionLabel: 'Exportar folha',
    emptyIcon: '\uD83D\uDCB0', emptyTitle: 'Sem comissoes no periodo', emptySubtitle: 'Comissoes sao calculadas automaticamente a cada atendimento.',
  },
  Caixa: {
    kpis: [{ value: 'R$ 0', label: 'Entradas', color: '#10B981' }, { value: 'R$ 0', label: 'Saidas', color: '#EF4444' }, { value: 'R$ 0', label: 'Gorjetas', color: '#F59E0B' }, { value: 'R$ 0', label: 'Saldo', color: '#06B6D4' }],
    flow: { title: 'Fluxo do caixa', steps: [{ label: 'Abertura' }, { label: 'Recebimentos' }, { label: 'Gorjeta' }, { label: 'Sangria' }, { label: 'Fechamento' }] },
    actionLabel: 'Abrir caixa',
    emptyIcon: '\uD83D\uDCB3', emptyTitle: 'Caixa nao aberto', emptySubtitle: 'Abra o caixa do dia para registrar movimentacoes.',
  },
  Pacotes: {
    kpis: [{ value: '0', label: 'Pacotes ativos', color: '#F59E0B' }, { value: '0', label: 'Vendidos', color: '#10B981' }, { value: 'R$ 0', label: 'MRR Clube', color: '#06B6D4' }, { value: '0', label: 'Assinantes', color: '#7C3AED' }],
    flow: { title: 'Tipos', steps: [{ label: 'Pacote servicos' }, { label: 'Clube mensal' }, { label: 'Gift card' }] },
    actionLabel: '+ Pacote',
    emptyIcon: '\uD83C\uDF81', emptyTitle: 'Sem pacotes', emptySubtitle: 'Crie pacotes de servicos com desconto para fidelizar clientes.',
  },
  'Gift cards': {
    kpis: [{ value: '0', label: 'Ativos', color: '#F59E0B' }, { value: 'R$ 0', label: 'Saldo total', color: '#10B981' }, { value: 'R$ 0', label: 'Vendidos', color: '#06B6D4' }, { value: '0', label: 'Usados', color: '#9CA3AF' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Criar' }, { label: 'Vender' }, { label: 'Presentear' }, { label: 'Resgatar' }] },
    actionLabel: '+ Gift card',
    emptyIcon: '\uD83C\uDF9F\uFE0F', emptyTitle: 'Sem gift cards', emptySubtitle: 'Crie vales-presente com codigo unico para seus clientes.',
  },
  Fidelidade: {
    kpis: [{ value: 'Inativo', label: 'Status', color: '#9CA3AF' }, { value: '0', label: 'Participantes', color: '#F59E0B' }, { value: '0', label: 'Pontos emitidos', color: '#10B981' }, { value: '0', label: 'Resgates', color: '#7C3AED' }],
    flow: { title: 'Como funciona', steps: [{ label: 'Cliente gasta' }, { label: 'Ganha pontos' }, { label: 'Acumula' }, { label: 'Resgata desconto' }] },
    actionLabel: 'Configurar',
    emptyIcon: '\u2B50', emptyTitle: 'Programa inativo', emptySubtitle: 'Ative o programa de fidelidade para recompensar clientes fieis.',
  },
  'Agenda online': {
    kpis: [{ value: 'Inativo', label: 'Status', color: '#9CA3AF' }, { value: '0', label: 'Solicitacoes', color: '#F59E0B' }, { value: '0', label: 'Confirmadas', color: '#10B981' }, { value: '-', label: 'Link', color: '#06B6D4' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Cliente acessa link' }, { label: 'Escolhe servico' }, { label: 'Escolhe horario' }, { label: 'Solicita' }, { label: 'Voce confirma' }] },
    actionLabel: 'Ativar',
    emptyIcon: '\uD83C\uDF10', emptyTitle: 'Agenda online desativada', emptySubtitle: 'Ative para que clientes agendem direto pelo link.',
  },
};

export default function BarberScreen() {
  const [tab, setTab] = useState('Agenda');
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
      onAction={() => {}}
    >
      <VerticalEmpty
        icon={data.emptyIcon}
        title={data.emptyTitle}
        subtitle={data.emptySubtitle}
        accent={CONFIG.accent}
        actionLabel={data.actionLabel || undefined}
        onAction={() => {}}
      />
    </VerticalShell>
  );
}
