import { useState } from 'react';
import { View } from 'react-native';
import { VerticalShell, VerticalRow, VerticalEmpty } from '@/components/verticals/VerticalShell';
import type { KPI, FlowStep, VerticalConfig } from '@/components/verticals/VerticalShell';

// ============================================================
// FoodScreen — Orchestrator for the Food Service vertical
// ============================================================

const CONFIG: VerticalConfig = {
  name: 'Food Service',
  icon: '\uD83C\uDF7D\uFE0F',
  accent: '#EF4444',
  establishment: 'Meu Restaurante',
  professional: '12 mesas — Cozinha ativa',
};

const TABS = ['Mesas', 'Pedidos', 'Cardapio', 'Delivery', 'iFood', 'Agendamento', 'NFC-e', 'Garcom'];

const SCREEN_DATA: Record<string, { kpis: KPI[]; flow: { title: string; steps: FlowStep[] }; actionLabel: string; emptyIcon: string; emptyTitle: string; emptySubtitle: string }> = {
  Mesas: {
    kpis: [{ value: '0/12', label: 'Ocupadas', color: '#EF4444' }, { value: 'R$ 0', label: 'Faturamento hora', color: '#10B981' }, { value: '0', label: 'Pedidos cozinha', color: '#F59E0B' }, { value: '0min', label: 'Tempo medio', color: '#06B6D4' }],
    flow: { title: 'Fluxo do atendimento', steps: [{ label: 'Abrir mesa' }, { label: 'Anotar pedido' }, { label: 'Cozinha prepara' }, { label: 'Servir' }, { label: 'Conta' }, { label: 'Pagamento' }, { label: 'Fechar mesa' }] },
    actionLabel: '+ Abrir mesa',
    emptyIcon: '\uD83C\uDF7D\uFE0F', emptyTitle: 'Nenhuma mesa aberta', emptySubtitle: 'Abra uma mesa para comecar o atendimento.',
  },
  Pedidos: {
    kpis: [{ value: '0', label: 'Na cozinha', color: '#EF4444' }, { value: '0', label: 'Prontos', color: '#10B981' }, { value: '0min', label: 'Tempo medio', color: '#F59E0B' }, { value: '0', label: 'Atrasados', color: '#7C3AED' }],
    flow: { title: 'Fluxo do pedido', steps: [{ label: 'Anotar' }, { label: 'Enviar cozinha' }, { label: 'Preparar' }, { label: 'Pronto' }, { label: 'Servir' }, { label: 'Concluir' }] },
    actionLabel: '+ Pedido',
    emptyIcon: '\uD83D\uDCDD', emptyTitle: 'Sem pedidos ativos', emptySubtitle: 'Pedidos aparecem aqui quando enviados para a cozinha.',
  },
  Cardapio: {
    kpis: [{ value: '0', label: 'Itens ativos', color: '#EF4444' }, { value: '0', label: 'Categorias', color: '#06B6D4' }, { value: 'R$ 0', label: 'Ticket medio', color: '#10B981' }, { value: '0', label: 'Esgotados', color: '#F59E0B' }],
    flow: { title: 'Gestao', steps: [{ label: 'Cadastrar item' }, { label: 'Preco' }, { label: 'Foto' }, { label: 'Estoque' }, { label: 'Ativar' }] },
    actionLabel: '+ Item',
    emptyIcon: '\uD83D\uDCD6', emptyTitle: 'Cardapio vazio', emptySubtitle: 'Cadastre os itens do cardapio com preco, foto e estoque.',
  },
  Delivery: {
    kpis: [{ value: '0', label: 'Ativos', color: '#EF4444' }, { value: '0', label: 'Em rota', color: '#F59E0B' }, { value: 'R$ 0', label: 'Receita delivery', color: '#10B981' }, { value: '0min', label: 'Tempo medio', color: '#06B6D4' }],
    flow: { title: 'Fluxo delivery', steps: [{ label: 'Pedido' }, { label: 'Cozinha' }, { label: 'Embalar' }, { label: 'Despachar' }, { label: 'Em rota' }, { label: 'Entregue' }] },
    actionLabel: '+ Pedido delivery',
    emptyIcon: '\uD83D\uDEF5', emptyTitle: 'Sem deliveries ativos', emptySubtitle: 'Pedidos de delivery aparecem aqui quando recebidos.',
  },
  iFood: {
    kpis: [{ value: '0', label: 'Pedidos hoje', color: '#EF4444' }, { value: 'R$ 0', label: 'Receita', color: '#10B981' }, { value: 'R$ 0', label: 'Taxa iFood', color: '#F59E0B' }, { value: 'R$ 0', label: 'Receita liquida', color: '#06B6D4' }],
    flow: { title: 'Integracao', steps: [{ label: 'Conectar conta' }, { label: 'Sincronizar cardapio' }, { label: 'Receber pedidos' }, { label: 'Preparar' }, { label: 'Despachar' }] },
    actionLabel: 'Conectar iFood',
    emptyIcon: '\uD83D\uDCF1', emptyTitle: 'iFood nao conectado', emptySubtitle: 'Conecte sua conta iFood para receber pedidos automaticamente.',
  },
  Agendamento: {
    kpis: [{ value: '0', label: 'Reservas hoje', color: '#EF4444' }, { value: '0', label: 'Confirmadas', color: '#10B981' }, { value: '0', label: 'Capacidade restante', color: '#06B6D4' }, { value: '0', label: 'Pendentes', color: '#F59E0B' }],
    flow: { title: 'Fluxo', steps: [{ label: 'Cliente reserva' }, { label: 'Confirmar' }, { label: 'Alocar mesa' }, { label: 'Check-in' }] },
    actionLabel: '+ Reserva',
    emptyIcon: '\uD83D\uDCC6', emptyTitle: 'Sem reservas', emptySubtitle: 'Reservas de mesas aparecem aqui quando confirmadas.',
  },
  'NFC-e': {
    kpis: [{ value: '0', label: 'Autorizadas', color: '#10B981' }, { value: 'R$ 0', label: 'Valor total', color: '#EF4444' }, { value: '0', label: 'Canceladas', color: '#9CA3AF' }, { value: '0', label: 'Total', color: '#06B6D4' }],
    flow: { title: 'Fluxo NFC-e', steps: [{ label: 'Configurar CSC' }, { label: 'Fechar conta' }, { label: 'Emitir cupom' }, { label: 'Imprimir' }] },
    actionLabel: '+ Emitir NFC-e',
    emptyIcon: '\uD83E\uDDFE', emptyTitle: 'Nenhuma NFC-e emitida', emptySubtitle: 'Configure o certificado digital para emitir cupons fiscais.',
  },
  Garcom: {
    kpis: [{ value: 'Inativo', label: 'Status', color: '#9CA3AF' }, { value: '0', label: 'Pedidos via QR', color: '#EF4444' }, { value: '0', label: 'Mesas ativas', color: '#10B981' }, { value: 'R$ 0', label: 'Receita QR', color: '#06B6D4' }],
    flow: { title: 'Fluxo', steps: [{ label: 'QR na mesa' }, { label: 'Cliente escaneia' }, { label: 'Ve cardapio' }, { label: 'Faz pedido' }, { label: 'Cozinha recebe' }] },
    actionLabel: 'Ativar',
    emptyIcon: '\uD83D\uDCF2', emptyTitle: 'Garcom digital inativo', emptySubtitle: 'Ative para que clientes facam pedidos pelo QR code na mesa.',
  },
};

export default function FoodScreen() {
  const [tab, setTab] = useState('Mesas');
  const data = SCREEN_DATA[tab] || SCREEN_DATA.Mesas;

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
