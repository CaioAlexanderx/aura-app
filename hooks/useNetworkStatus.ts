import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";

export type NetworkState = "online" | "offline" | "syncing";

/**
 * UX-02: Network status hook
 * Detects online/offline state and tracks pending sync count
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkState>("online");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const goOnline = () => setStatus((prev) => (prev === "syncing" ? prev : "online"));
    const goOffline = () => setStatus("offline");

    if (!navigator.onLine) setStatus("offline");

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const isOnline = status !== "offline";

  return { status, setStatus, isOnline, pendingCount, setPendingCount };
}
