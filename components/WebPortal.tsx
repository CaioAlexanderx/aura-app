import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Renderiza children diretamente no document.body (web only).
// Escapa de containers com CSS transform que quebram position:fixed.
// No native, renderiza children inline normalmente.
export function WebPortal({ children, active }: { children: React.ReactNode; active: boolean }) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return active ? <>{children}</> : null;
  }
  return active ? <PortalImpl>{children}</PortalImpl> : null;
}

function PortalImpl({ children }: { children: React.ReactNode }) {
  var [container, setContainer] = useState<HTMLDivElement | null>(null);
  var [mounted, setMounted] = useState(false);

  useEffect(function() {
    var el = document.createElement("div");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "0";
    el.style.bottom = "0";
    el.style.zIndex = "9999";
    el.style.pointerEvents = "auto";
    document.body.appendChild(el);
    setContainer(el);
    setMounted(true);
    // Lock body scroll
    var prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return function() {
      document.body.style.overflow = prev;
      try { document.body.removeChild(el); } catch {}
    };
  }, []);

  if (!mounted || !container) return null;

  // Use react-dom createPortal if available
  try {
    var ReactDOM = require("react-dom");
    return ReactDOM.createPortal(children, container);
  } catch {
    return <>{children}</>;
  }
}

export default WebPortal;
