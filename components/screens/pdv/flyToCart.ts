// ============================================================
// AURA. -- PDV/Caixa · Fly-to-cart imperative helper
// Web only. Creates a floating chip (letter + gradient) that
// animates from the clicked product button to the cart head
// position, then removes itself from DOM.
// ============================================================
import { Platform } from "react-native";

export type FlyPoint = { x: number; y: number };

export function flyToCart(from: FlyPoint, to: FlyPoint, accent: string, letter: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = letter;
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "44px";
  el.style.height = "44px";
  el.style.borderRadius = "10px";
  el.style.zIndex = "1000";
  el.style.pointerEvents = "none";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.color = "#fff";
  el.style.fontSize = "20px";
  el.style.fontWeight = "700";
  el.style.background = "linear-gradient(135deg, " + accent + ", #6d28d9)";
  el.style.boxShadow = "0 8px 20px rgba(124,58,237,0.5)";
  el.style.setProperty("--from-x", from.x + "px");
  el.style.setProperty("--from-y", from.y + "px");
  el.style.setProperty("--to-x", to.x + "px");
  el.style.setProperty("--to-y", to.y + "px");
  el.style.animation = "caixaFlyToCart 0.7s cubic-bezier(0.5,-0.2,0.7,1) forwards";
  document.body.appendChild(el);
  setTimeout(() => {
    try { el.remove(); } catch {}
  }, 750);
}
