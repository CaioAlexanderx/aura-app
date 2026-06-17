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
// ============================================================
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import {
  notificationsApi,
  NotificationsResponse,
} from '@/services/notificationsApi';

const POLL_INTERVAL = 30_000; // 30 segundos
const ORDER_ALERT_WINDOW = 2 * 60 * 60 * 1000; // pedido "novo" alerta por 2h
const SEEN_KEY = 'aura:notif-seen-v1';

const EMPTY: NotificationsResponse = { banners: [], orders: [], unread_count: 0 };

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

  // Itens não vistos -> dirigem o glow. Banner: conta enquanto não visto.
  // Pedido: conta se recente (<2h) e não visto.
  const unreadCount = useMemo(() => {
    const threshold = Date.now() - ORDER_ALERT_WINDOW;
    const ub = data.banners.filter(b => !seen.has(b.id)).length;
    const uo = data.orders.filter(
      o => !seen.has(o.id) && new Date(o.created_at).getTime() > threshold
    ).length;
    return ub + uo;
  }, [data.banners, data.orders, seen]);

  const hasUnseen = unreadCount > 0;

  // Ao ABRIR o sino: marca tudo como visto (persistido). O glow some e não
  // volta em refresh/nova sessão. NÃO remove o banner — ele continua acessível
  // no drawer; só para de alertar.
  const markSeen = useCallback(() => {
    setSeen(prev => {
      let next = new Set(prev);
      data.banners.forEach(b => next.add(b.id));
      data.orders.forEach(o => next.add(o.id));
      if (next.size > 200) next = new Set([...next].slice(-200));
      persistSeen(next);
      return next;
    });
  }, [data.banners, data.orders]);

  // Dispensar banner explicitamente (X) — remove no servidor + local.
  const markBannerRead = useCallback(async (bannerId: string) => {
    if (!companyId) return;
    setData(prev => ({ ...prev, banners: prev.banners.filter(b => b.id !== bannerId) }));
    try { await notificationsApi.markBannerRead(companyId, bannerId); } catch (_) {}
  }, [companyId]);

  const markAllRead = useCallback(async () => {
    if (!companyId) return;
    markSeen();
    setData(prev => ({ ...prev, banners: [] }));
    try { await notificationsApi.markAllBannersRead(companyId); } catch (_) {}
  }, [companyId, markSeen]);

  return {
    banners:     data.banners,
    orders:      data.orders,
    unreadCount,
    hasUnseen,
    markSeen,
    markBannerRead,
    markAllRead,
    refresh:     fetchNotifications,
  };
}
