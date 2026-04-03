import { Platform } from "react-native";

const QUEUE_KEY = "aura_offline_queue";
const PRODUCTS_CACHE_KEY = "aura_products_cache";

export type QueueItem = {
  id: string;
  type: "sale" | "transaction" | "customer" | "product";
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  body: any;
  createdAt: string;
  retries: number;
};

// ── Storage helpers ──────────────────────────────────────

function getStorage(): Storage | null {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") return localStorage;
  return null;
}

function getQueue(): QueueItem[] {
  const s = getStorage();
  if (!s) return [];
  try { return JSON.parse(s.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}

function saveQueue(queue: QueueItem[]) {
  const s = getStorage();
  if (s) s.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Cache products for offline use ───────────────────────

export function cacheProducts(products: any[]) {
  const s = getStorage();
  if (s && products?.length) {
    s.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
      products,
      cachedAt: new Date().toISOString(),
    }));
  }
}

export function getCachedProducts(): any[] {
  const s = getStorage();
  if (!s) return [];
  try {
    const data = JSON.parse(s.getItem(PRODUCTS_CACHE_KEY) || "{}");
    return data.products || [];
  } catch { return []; }
}

export function getCacheAge(): string | null {
  const s = getStorage();
  if (!s) return null;
  try {
    const data = JSON.parse(s.getItem(PRODUCTS_CACHE_KEY) || "{}");
    return data.cachedAt || null;
  } catch { return null; }
}

// ── Queue operations (offline writes) ────────────────────

export function addToQueue(item: Omit<QueueItem, "id" | "createdAt" | "retries">) {
  const queue = getQueue();
  queue.push({
    ...item,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  saveQueue(queue);
  return queue.length;
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function clearQueue() {
  saveQueue([]);
}

// ── Sync queue when back online ──────────────────────────

export async function syncQueue(
  baseUrl: string,
  token: string,
  onProgress?: (synced: number, total: number) => void,
  onError?: (item: QueueItem, error: any) => void,
): Promise<{ synced: number; failed: number; remaining: number }> {
  const queue = getQueue();
  if (!queue.length) return { synced: 0, failed: 0, remaining: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      const resp = await fetch(baseUrl + item.endpoint, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(item.body),
      });

      if (resp.ok) {
        synced++;
        onProgress?.(synced, queue.length);
      } else if (resp.status >= 500) {
        item.retries++;
        if (item.retries < 5) remaining.push(item);
        else failed++;
      } else {
        failed++;
        onError?.(item, await resp.json().catch(() => ({})));
      }
    } catch {
      item.retries++;
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return { synced, failed, remaining: remaining.length };
}

// ── Auto-sync listener ───────────────────────────────────

let syncListenerActive = false;

export function startAutoSync(baseUrl: string, getToken: () => string | null) {
  if (syncListenerActive || Platform.OS !== "web") return;
  syncListenerActive = true;

  window.addEventListener("online", async () => {
    const token = getToken();
    if (!token) return;
    const queueLen = getQueueLength();
    if (queueLen === 0) return;
    console.log("[offlineSync] Back online, syncing " + queueLen + " items...");
    const result = await syncQueue(baseUrl, token);
    console.log("[offlineSync] Result:", result);
  });
}
