// ============================================================
// AURA. — Hook de notificações com polling 30s
// Criado: 13/06/2026
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import {
  notificationsApi,
  NotificationsResponse,
  OrderNotification,
} from '@/services/notificationsApi';

const POLL_INTERVAL = 30_000; // 30 segundos

const EMPTY: NotificationsResponse = { banners: [], orders: [], unread_count: 0 };

export function useNotifications() {
  const company   = useAuthStore(s => s.company);
  const companyId = (company as any)?.id as string | undefined;

  const [data, setData]                   = useState<NotificationsResponse>(EMPTY);
  const [seenOrderIds, setSeenOrderIds]   = useState<Set<string>>(new Set());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  function computeUnreadCount(
    banners: NotificationsResponse['banners'],
    orders: OrderNotification[],
    seen: Set<string>
  ) {
    const threshold = Date.now() - 2 * 60 * 60 * 1000;
    const newOrders = orders.filter(
      o => !seen.has(o.id) && new Date(o.created_at).getTime() > threshold
    );
    return banners.length + newOrders.length;
  }

  const fetchNotifications = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await notificationsApi.list(companyId);
      setData(prev => {
        const unread_count = computeUnreadCount(res.banners, res.orders, seenOrderIds);
        return { ...res, unread_count };
      });
    } catch (_) {
      // silent — polling não deve crashar a UI
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, seenOrderIds]);

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

  const markBannerRead = useCallback(async (bannerId: string) => {
    if (!companyId) return;
    setData(prev => ({
      ...prev,
      banners: prev.banners.filter(b => b.id !== bannerId),
      unread_count: Math.max(0, prev.unread_count - 1),
    }));
    try { await notificationsApi.markBannerRead(companyId, bannerId); } catch (_) {}
  }, [companyId]);

  const markAllRead = useCallback(async () => {
    if (!companyId) return;
    const newSeen = new Set([...seenOrderIds, ...data.orders.map(o => o.id)]);
    setSeenOrderIds(newSeen);
    setData(prev => ({ ...prev, banners: [], unread_count: 0 }));
    try { await notificationsApi.markAllBannersRead(companyId); } catch (_) {}
  }, [companyId, seenOrderIds, data.orders]);

  const dismissOrders = useCallback(() => {
    const newSeen = new Set([...seenOrderIds, ...data.orders.map(o => o.id)]);
    setSeenOrderIds(newSeen);
    setData(prev => ({
      ...prev,
      unread_count: prev.banners.length,
    }));
  }, [seenOrderIds, data.orders]);

  return {
    banners:        data.banners,
    orders:         data.orders,
    unreadCount:    data.unread_count,
    markBannerRead,
    markAllRead,
    dismissOrders,
    refresh:        fetchNotifications,
  };
}
