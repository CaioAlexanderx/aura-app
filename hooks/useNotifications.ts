// ============================================================
// AURA. — Hook de notificações com polling 30s
// Criado: 13/06/2026
//
// 17/06/2026 — Regras de alerta (não invasivo):
//   1. Glow só quando há item NÃO VISTO (hasUnseen).
//   2. Ao abrir o sino (markSeen), o alerta some e NÃO volta —
//      o estado "visto" é persistido em localStorage, então
//      refresh/nova sessão não re-alertam. O banner continua no
//      drawer (não é removido), só deixa de gerar alerta.
//   3. Banner só some por ação explícita: X (markBannerRead) ou
//      "Marcar tudo lido" (markAllRead), ou quando expira no backend.
//
// 01/09/2026 — eventos da loja online (`loja_*`).
//   Duas noções de "lido" convivem, de propósito:
//   • `seen` (localStorage) — só dirige o GLOW/badge do sino. É a regra de
//     17/06 acima e não mudou.
//   • `read_at` (servidor) — dirige a gaveta: o que ainda pede ação fica no
//     topo, o ponto de não-lido no card, e "Marcar tudo lido".
//   Se as duas fossem a mesma coisa, abrir o sino uma vez limparia a fila de
//   pendências sem ninguém ter resolvido nada.
//
//   Os pedidos do feed antigo (janela de 24h) são convertidos em eventos
//   `loja_pedido_novo`, então a gaveta tem um pipeline só e já funciona
//   antes de o backend emitir os `loja_*`.
// ============================================================
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import {
  notificationsApi,
  NotificationsResponse,
  StoreEvent,
} from '@/services/notificationsApi';
import {
  ordersToEvents, buildFeed, mergePrefs, defaultPrefs, allMuted,
} from '@/components/notificationEventModel';

const POLL_INTERVAL = 30_000; // 30 segundos
const ORDER_ALERT_WINDOW = 2 * 60 * 60 * 1000; // pedido "novo" alerta por 2h
const SEEN_KEY = 'aura:notif-seen-v1';

const EMPTY: NotificationsResponse = { banners: [], orders: [], events: [], unread_count: 0 };

function loadSeen(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SEEN_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    }
  } catch (_) { /* storage indisponível */ }
  return new Set();
}

function persistSeen(set: Set<string>) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
    }
  } catch (_) { /* storage indisponível */ }
}

export function useNotifications() {
  const company   = useAuthStore(s => s.company);
  const companyId = (company as any)?.id as string | undefined;

  const [data, setData] = useState<NotificationsResponse>(EMPTY);
  // Ids já "vistos" (alerta) — persistido pra não re-alertar em nova sessão.
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  // Marcados como lidos localmente (otimista) enquanto o POST não volta.
  const [readLocal, setReadLocal] = useState<Set<string>>(() => new Set());

  const [prefs, setPrefs]             = useState<Record<string, boolean>>(() => defaultPrefs());
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const prefsFetched                  = useRef(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await notificationsApi.list(companyId);
      setData({ ...res });
    } catch (_) {
      // silent — polling não deve crashar a UI
    }
  }, [companyId]);

  const startPolling = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
  }, [fetchNotifications]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    startPolling();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        fetchNotifications();
        startPolling();
      } else if (next === 'background' || next === 'inactive') {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Eventos do servidor + pedidos antigos convertidos. Um pedido que já tem
  // evento próprio não entra duas vezes (dedupe por entity_id).
  const events = useMemo<StoreEvent[]>(() => {
    const doServidor = data.events || [];
    const jaNoFeed = new Set(doServidor.map(e => e.entity_id).filter(Boolean) as string[]);
    const dePedidos = ordersToEvents(data.orders).filter(e => !jaNoFeed.has(e.entity_id!));
    const todos = [...doServidor, ...dePedidos];
    // Aplica o "lido" otimista por cima do que o servidor devolveu.
    return readLocal.size === 0
      ? todos
      : todos.map(e => (readLocal.has(e.id) && !e.read_at ? { ...e, read_at: 'local' } : e));
  }, [data.events, data.orders, readLocal]);

  const feed = useMemo(() => buildFeed(events), [events]);

  // Itens não vistos -> dirigem o glow. Banner: conta enquanto não visto.
  // Evento: conta se não lido, não visto e recente (<2h) — ou se pede ação,
  // que alerta enquanto estiver aberto, sem janela de tempo.
  const unreadCount = useMemo(() => {
    const threshold = Date.now() - ORDER_ALERT_WINDOW;
    const ub = data.banners.filter(b => !seen.has(b.id)).length;
    const pendentes = feed.acoes.filter(i => !seen.has(i.event.id)).length;
    const recentes = events.filter(e => {
      if (e.read_at || seen.has(e.id)) return false;
      if (feed.acoes.some(i => i.event.id === e.id)) return false; // já contado
      return new Date(e.created_at).getTime() > threshold;
    }).length;
    return ub + pendentes + recentes;
  }, [data.banners, events, feed.acoes, seen]);

  const hasUnseen = unreadCount > 0;

  // Ao ABRIR o sino: marca tudo como visto (persistido). O glow some e não
  // volta em refresh/nova sessão. NÃO marca como lido — a fila de pendências
  // continua de pé até alguém resolver.
  const markSeen = useCallback(() => {
    setSeen(prev => {
      let next = new Set(prev);
      data.banners.forEach(b => next.add(b.id));
      events.forEach(e => next.add(e.id));
      if (next.size > 200) next = new Set([...next].slice(-200));
      persistSeen(next);
      return next;
    });
  }, [data.banners, events]);

  // Dispensar banner explicitamente (X) — remove no servidor + local.
  const markBannerRead = useCallback(async (bannerId: string) => {
    if (!companyId) return;
    setData(prev => ({ ...prev, banners: prev.banners.filter(b => b.id !== bannerId) }));
    try { await notificationsApi.markBannerRead(companyId, bannerId); } catch (_) {}
  }, [companyId]);

  // Um evento vira lido: sai de "Precisa de você" e desce pro dia.
  const markEventRead = useCallback(async (eventId: string) => {
    if (!companyId) return;
    setReadLocal(prev => {
      if (prev.has(eventId)) return prev;
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    try { await notificationsApi.markEventRead(companyId, eventId); } catch (_) {}
  }, [companyId]);

  const markAllRead = useCallback(async () => {
    if (!companyId) return;
    markSeen();
    setReadLocal(prev => {
      const next = new Set(prev);
      events.forEach(e => next.add(e.id));
      return next;
    });
    setData(prev => ({ ...prev, banners: [] }));
    try { await notificationsApi.markAllRead(companyId); }
    catch (_) {
      // Backend antigo: só existe a rota de banners.
      try { await notificationsApi.markAllBannersRead(companyId); } catch (__) {}
    }
  }, [companyId, markSeen, events]);

  // Preferências: buscadas na PRIMEIRA abertura do sino, não a cada poll.
  const ensurePrefs = useCallback(async () => {
    if (!companyId || prefsFetched.current) return;
    prefsFetched.current = true;
    try {
      const res = await notificationsApi.getPreferences(companyId);
      setPrefs(mergePrefs(res?.preferences));
    } catch (_) {
      setPrefs(mergePrefs(null));   // backend ainda sem a rota: usa os defaults
    } finally {
      setPrefsLoaded(true);
    }
  }, [companyId]);

  const savePrefs = useCallback(async (next: Record<string, boolean>) => {
    const merged = mergePrefs(next);
    setPrefs(merged);               // otimista — o toggle não pode "piscar"
    if (!companyId) return;
    try { await notificationsApi.savePreferences(companyId, merged); } catch (_) {}
  }, [companyId]);

  return {
    banners:     data.banners,
    orders:      data.orders,
    events,
    feed,
    unreadCount,
    hasUnseen,
    markSeen,
    markBannerRead,
    markEventRead,
    markAllRead,
    prefs,
    prefsLoaded,
    prefsAllMuted: allMuted(prefs),
    ensurePrefs,
    savePrefs,
    refresh:     fetchNotifications,
  };
}
