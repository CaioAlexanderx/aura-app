// ============================================================
// AURA. — Modelo dos eventos da loja (sino)
// Criado: 01/09/2026
//
// Camada de adaptação entre o feed do backend e a gaveta. Existe para que
// a chegada do contrato final de `app_notifications` (tipos `loja_*`) seja
// uma mudança LOCALIZADA neste arquivo, e não um redesenho da UI.
//
// Três responsabilidades, todas puras (sem React, sem cor literal):
//   1. CATÁLOGO  — `type` → rótulo, severidade padrão, ícone, se exige ação.
//   2. ADAPTAÇÃO — pedido do feed antigo (24h) vira evento `loja_pedido_novo`,
//      então a gaveta tem UM pipeline só e já funciona antes do backend subir.
//   3. AGRUPAMENTO — o corte "precisa de você" x informativo, o recorte por
//      dia e o colapso de vários eventos do mesmo pedido num card só.
//
// Cores saem como TOKEN ('red' | 'amber' | ...), nunca hex: quem resolve é
// o componente via useColors(), senão o modo claro quebra.
// ============================================================
// O shape do fio (StoreEvent, severidade) mora em services/notificationsApi.ts
// — este arquivo é a leitura da UI sobre ele. Import type-only, sem ciclo.
import type {
  OrderNotification, StoreEvent, NotificationSeverity,
} from '@/services/notificationsApi';

export type { StoreEvent, NotificationSeverity };

export type AccentToken = 'red' | 'amber' | 'green' | 'violet' | 'ink3';
export type EventIcon =
  | 'alerta' | 'comprovante' | 'dinheiro' | 'check' | 'sacola'
  | 'caminhao' | 'relogio' | 'caixa' | 'x' | 'sino';

export interface EventVisual {
  label:          string;             // rótulo canônico do tipo
  severity:       NotificationSeverity;
  requiresAction: boolean;
  accent:         AccentToken;
  icon:           EventIcon;
  glyph:          string;             // fallback nativo (sem SVG)
  ctaLabel?:      string;
  fallbackRoute?: string;
}

type CatalogEntry = Omit<EventVisual, 'severity'> & { severity: NotificationSeverity };

// ── Catálogo ───────────────────────────────────────────────────────────────
// `requiresAction` é o que decide o corte no topo da gaveta. Só entra aqui o
// que trava dinheiro ou pedido esperando mão humana. "Pedido entregue" é
// informação; "comprovante enviado" é trabalho parado.
const CATALOG: Record<string, CatalogEntry> = {
  loja_sem_pagamento_configurado: {
    label: 'Loja sem meio de pagamento', severity: 'critico', requiresAction: true,
    accent: 'red', icon: 'alerta', glyph: '⚠️',
    ctaLabel: 'Configurar pagamento', fallbackRoute: '/canal',
  },
  loja_comprovante_enviado: {
    label: 'Comprovante para conferir', severity: 'atencao', requiresAction: true,
    accent: 'amber', icon: 'comprovante', glyph: '🧾',
    ctaLabel: 'Conferir comprovante', fallbackRoute: '/canal',
  },
  loja_pix_expirado: {
    label: 'PIX expirou sem pagamento', severity: 'atencao', requiresAction: true,
    accent: 'amber', icon: 'relogio', glyph: '⏰',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
  loja_estoque_baixo: {
    label: 'Estoque abaixo do mínimo', severity: 'atencao', requiresAction: true,
    accent: 'amber', icon: 'caixa', glyph: '📦',
    ctaLabel: 'Ver produto', fallbackRoute: '/estoque',
  },
  loja_pedido_novo: {
    label: 'Pedido novo', severity: 'info', requiresAction: false,
    accent: 'violet', icon: 'sacola', glyph: '🛍️',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
  loja_pedido_pago: {
    label: 'Pagamento confirmado', severity: 'info', requiresAction: false,
    accent: 'green', icon: 'check', glyph: '✅',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
  loja_sinal_pago: {
    label: 'Sinal pago', severity: 'info', requiresAction: false,
    accent: 'green', icon: 'dinheiro', glyph: '💰',
    ctaLabel: 'Ver encomenda', fallbackRoute: '/canal',
  },
  loja_pedido_saiu_entrega: {
    label: 'Saiu para entrega', severity: 'info', requiresAction: false,
    accent: 'violet', icon: 'caminhao', glyph: '🚚',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
  loja_pedido_entregue: {
    label: 'Pedido entregue', severity: 'info', requiresAction: false,
    accent: 'green', icon: 'check', glyph: '✅',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
  loja_pedido_cancelado: {
    label: 'Pedido cancelado', severity: 'info', requiresAction: false,
    accent: 'ink3', icon: 'x', glyph: '✖️',
    ctaLabel: 'Ver pedido', fallbackRoute: '/canal',
  },
};

const FALLBACK: CatalogEntry = {
  label: 'Aviso da loja', severity: 'info', requiresAction: false,
  accent: 'violet', icon: 'sino', glyph: '🔔',
};

const ACCENT_BY_SEVERITY: Record<NotificationSeverity, AccentToken> = {
  critico: 'red',
  atencao: 'amber',
  info:    'violet',
};

/**
 * Resolve a aparência de um evento. A severidade do servidor VENCE a do
 * catálogo (o backend é a autoridade e pode escalar um tipo conhecido); tipo
 * desconhecido não some da gaveta — cai no fallback genérico.
 */
export function visualForEvent(ev: Pick<StoreEvent, 'type' | 'severity'>): EventVisual {
  const base     = CATALOG[ev.type] || FALLBACK;
  const severity = ev.severity || base.severity;
  const known    = !!CATALOG[ev.type];
  return {
    ...base,
    severity,
    // Crítico sempre pede mão humana, mesmo em tipo que o front ainda não
    // conhece — é o único jeito de um evento novo do backend não passar batido.
    requiresAction: severity === 'critico' ? true : (known ? base.requiresAction : severity !== 'info'),
    accent:         severity === 'info' ? base.accent : ACCENT_BY_SEVERITY[severity],
  };
}

export function severityLabel(s: NotificationSeverity): string | null {
  if (s === 'critico') return 'Crítico';
  if (s === 'atencao') return 'Ação';
  return null;   // info não ganha selo — senão todo card vira etiqueta
}

// ── Adaptação do feed antigo ───────────────────────────────────────────────
const SOURCE_LABEL: Record<string, string> = {
  canal_digital: 'Canal Digital',
  studio:        'Studio',
  pdv:           'Caixa',
};
const SOURCE_ROUTE: Record<string, string> = {
  canal_digital: '/canal',
  studio:        '/canal',
  pdv:           '/vendas',
};

export function sourceLabel(s: string): string {
  return SOURCE_LABEL[s] || 'Pedido';
}

export function fmtMoney(v?: number | null): string {
  if (v == null || Number.isNaN(Number(v))) return '';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Pedido do endpoint antigo (janela de 24h) vira evento `loja_pedido_novo`.
 * Enquanto o backend não emitir os `loja_*`, a gaveta nova já roda com isto.
 * Quando emitir, o dedupe por `entity_id` evita pedido duplicado no feed.
 */
export function ordersToEvents(orders: OrderNotification[]): StoreEvent[] {
  return (orders || []).map(o => ({
    id:           'pedido:' + o.id,
    type:         'loja_pedido_novo',
    title:        sourceLabel(o.source) + ' — Pedido #' + o.order_number,
    body:         [o.customer_name, fmtMoney(o.total)].filter(Boolean).join(' · '),
    severity:     'info' as NotificationSeverity,
    entity_id:    'pedido:' + o.id,
    entity_label: 'Pedido #' + o.order_number,
    cta_route:    SOURCE_ROUTE[o.source] || '/canal',
    created_at:   o.created_at,
    read_at:      null,
  }));
}

// ── Agrupamento ────────────────────────────────────────────────────────────
export interface FeedItem {
  key:      string;
  event:    StoreEvent;      // representante (o mais recente do grupo)
  events:   StoreEvent[];    // 1 quando não é grupo
  unread:   number;
  grouped:  boolean;
  label:    string;          // título do card
}

export interface FeedSection {
  key:   string;             // 'acoes' | '2026-09-01'
  kind:  'acao' | 'dia';
  label: string;             // 'Precisa de você' | 'Hoje' | 'Ontem' | '28/08'
  items: FeedItem[];
}

export interface Feed {
  acoes:       FeedItem[];
  dias:        FeedSection[];
  unreadCount: number;       // eventos não lidos
  actionCount: number;       // pendências abertas (dirige o selo do topo)
  total:       number;
}

function ts(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function dayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

export function dayLabel(iso: string, now: number = Date.now()): string {
  const d     = new Date(iso);
  const hoje  = new Date(now);
  const ontem = new Date(now - 86400000);
  if (dayKey(d) === dayKey(hoje))  return 'Hoje';
  if (dayKey(d) === dayKey(ontem)) return 'Ontem';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return dd + '/' + mm;
}

export function relTime(iso: string, now: number = Date.now()): string {
  const diff = (now - ts(iso)) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return Math.floor(diff / 60) + 'min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = { critico: 0, atencao: 1, info: 2 };

function mkItem(events: StoreEvent[]): FeedItem {
  const rep     = events[0];
  const grouped = events.length > 1;
  return {
    key:     grouped ? 'g:' + (rep.entity_id || rep.id) : 'e:' + rep.id,
    event:   rep,
    events,
    unread:  events.filter(e => !e.read_at).length,
    grouped,
    label:   grouped ? (rep.entity_label || visualForEvent(rep).label) : visualForEvent(rep).label,
  };
}

/**
 * Monta o feed da gaveta.
 *
 * Regras (as três que o mockup de 01/09/2026 validou):
 *  1. Pendência ABERTA (exige ação e ainda não lida) sobe para "Precisa de
 *     você", ordenada por severidade e depois por recência. Quando é lida,
 *     desce para o dia — senão a seção só cresce e vira paredão também.
 *  2. O resto é fatiado por dia (Hoje / Ontem / dd/mm).
 *  3. Dentro do dia, 2+ eventos do MESMO `entity_id` colapsam num card só.
 *     É isso que faz uma loja de 200 pedidos/dia caber na tela.
 */
export function buildFeed(events: StoreEvent[], now: number = Date.now()): Feed {
  const lista = [...(events || [])].sort((a, b) => ts(b.created_at) - ts(a.created_at));

  const pendentes: StoreEvent[] = [];
  const resto:     StoreEvent[] = [];
  for (const ev of lista) {
    const v = visualForEvent(ev);
    if (v.requiresAction && !ev.read_at) pendentes.push(ev);
    else resto.push(ev);
  }

  pendentes.sort((a, b) => {
    const ra = SEVERITY_RANK[visualForEvent(a).severity];
    const rb = SEVERITY_RANK[visualForEvent(b).severity];
    if (ra !== rb) return ra - rb;
    return ts(b.created_at) - ts(a.created_at);
  });

  // Agrupa o informativo por dia, preservando a ordem (lista já é desc).
  const porDia = new Map<string, StoreEvent[]>();
  for (const ev of resto) {
    const k = dayKey(new Date(ev.created_at));
    const arr = porDia.get(k);
    if (arr) arr.push(ev);
    else porDia.set(k, [ev]);
  }

  const dias: FeedSection[] = [];
  porDia.forEach((doDia, k) => {
    const porEntidade = new Map<string, StoreEvent[]>();
    const itens: FeedItem[] = [];
    for (const ev of doDia) {
      if (!ev.entity_id) { itens.push(mkItem([ev])); continue; }
      const arr = porEntidade.get(ev.entity_id);
      if (arr) { arr.push(ev); continue; }
      const novo: StoreEvent[] = [ev];
      porEntidade.set(ev.entity_id, novo);
      itens.push(mkItem(novo));      // placeholder — recalculado abaixo
    }
    // Recalcula os cards que viraram grupo (o array cresceu depois do push).
    const finais = itens.map(it => (it.events.length > 1 ? mkItem(it.events) : it));
    dias.push({ key: k, kind: 'dia', label: dayLabel(doDia[0].created_at, now), items: finais });
  });

  return {
    acoes:       pendentes.map(ev => mkItem([ev])),
    dias,
    unreadCount: lista.filter(e => !e.read_at).length,
    actionCount: pendentes.length,
    total:       lista.length,
  };
}

// ── Preferências ───────────────────────────────────────────────────────────
export interface PrefRow {
  type:     string;
  nome:     string;
  desc:     string;
  fixo?:    boolean;   // não desligável — trava dinheiro/pedido
  padrao:   boolean;
}
export interface PrefSection { titulo: string; linhas: PrefRow[] }

// Defaults sensatos: o que pede decisão vem ligado e travado; o que a lojista
// mesmo dispara (saiu para entrega, entregue) vem desligado, senão ela recebe
// sino do próprio clique.
export const PREF_SECTIONS: PrefSection[] = [
  {
    titulo: 'Sempre ligado',
    linhas: [
      { type: 'loja_sem_pagamento_configurado', nome: 'Loja sem meio de pagamento', desc: 'A vitrine no ar sem ninguém conseguir pagar.', fixo: true, padrao: true },
      { type: 'loja_comprovante_enviado',       nome: 'Comprovante para conferir',  desc: 'O pedido trava até você olhar o comprovante.', fixo: true, padrao: true },
    ],
  },
  {
    titulo: 'Dinheiro',
    linhas: [
      { type: 'loja_pedido_pago',  nome: 'Pagamento confirmado', desc: 'PIX, cartão ou boleto que caiu.', padrao: true },
      { type: 'loja_sinal_pago',   nome: 'Sinal pago',           desc: 'Entrada de encomenda do Studio.', padrao: true },
      { type: 'loja_pix_expirado', nome: 'PIX expirou',          desc: 'A cobrança venceu antes de o cliente pagar.', padrao: true },
    ],
  },
  {
    titulo: 'Pedidos',
    linhas: [
      { type: 'loja_pedido_novo',       nome: 'Pedido novo',       desc: 'Chegou pedido na vitrine.', padrao: true },
      { type: 'loja_pedido_saiu_entrega', nome: 'Saiu para entrega', desc: 'Em geral quem marca é você — vem desligado.', padrao: false },
      { type: 'loja_pedido_entregue',   nome: 'Pedido entregue',   desc: 'Fecha o ciclo do pedido.', padrao: false },
      { type: 'loja_pedido_cancelado',  nome: 'Pedido cancelado',  desc: 'Cliente ou você desfez a venda.', padrao: true },
    ],
  },
  {
    titulo: 'Estoque e loja',
    linhas: [
      { type: 'loja_estoque_baixo', nome: 'Estoque abaixo do mínimo', desc: 'Venda online derrubou o saldo do produto.', padrao: true },
      { type: 'app_banner',         nome: 'Novidades da Aura',        desc: 'Recursos novos e avisos do time.', padrao: true },
    ],
  },
];

export const PREF_ROWS: PrefRow[] = PREF_SECTIONS.reduce<PrefRow[]>(
  (acc, s) => acc.concat(s.linhas), []
);

export function defaultPrefs(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  PREF_ROWS.forEach(r => { out[r.type] = r.padrao; });
  return out;
}

/** Mescla o que veio do servidor sobre os defaults; tipo fixo nunca fica off. */
export function mergePrefs(remote?: Record<string, boolean> | null): Record<string, boolean> {
  const out = defaultPrefs();
  if (remote) {
    Object.keys(remote).forEach(k => { out[k] = !!remote[k]; });
  }
  PREF_ROWS.forEach(r => { if (r.fixo) out[r.type] = true; });
  return out;
}

/** Todos os avisos desligáveis estão off? (dirige o texto do estado vazio.) */
export function allMuted(prefs: Record<string, boolean>): boolean {
  const opcionais = PREF_ROWS.filter(r => !r.fixo);
  return opcionais.length > 0 && opcionais.every(r => !prefs[r.type]);
}
