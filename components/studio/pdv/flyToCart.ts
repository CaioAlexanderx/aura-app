// ============================================================
// AURA STUDIO · PDV — fly-to-cart (Fase 6.1)
// Micro-interação web: ao adicionar um produto comum, um elemento
// "voa" do card até o carrinho (desktop) / barra mobile, encolhendo e
// some. Alvo = elemento com data-fly-target="cart". Web-only.
// ============================================================
import { Platform } from "react-native";

export type FlyRect = { left: number; top: number; width: number; height: number };

export function flyToCart(from: FlyRect | null | undefined, label: string, color: string) {
  if (Platform.OS !== "web" || typeof document === "undefined" || !from) return;
  const target = document.querySelector('[data-fly-target="cart"]') as HTMLElement | null;
  if (!target) return;
  const to = target.getBoundingClientRect();

  const fly = document.createElement("div");
  fly.textContent = (label || "").slice(0, 2);
  fly.style.cssText =
    "position:fixed;z-index:9999;" +
    `left:${from.left}px;top:${from.top}px;` +
    `width:${Math.min(from.width, 72)}px;height:54px;` +
    "border-radius:12px;display:grid;place-items:center;" +
    "font-family:inherit;font-weight:800;font-size:15px;color:#fff;" +
    "pointer-events:none;will-change:transform,opacity,left,top;" +
    `background:${color};box-shadow:0 12px 30px rgba(2,6,23,0.4);` +
    "transition:left .6s cubic-bezier(.5,-.2,.7,1),top .6s cubic-bezier(.5,-.2,.7,1),width .6s ease,height .6s ease,opacity .6s ease,transform .6s ease;";
  document.body.appendChild(fly);

  requestAnimationFrame(() => {
    fly.style.left = to.left + to.width / 2 - 20 + "px";
    fly.style.top = to.top + 22 + "px";
    fly.style.width = "40px";
    fly.style.height = "40px";
    fly.style.opacity = "0";
    fly.style.transform = "scale(0.4) rotate(10deg)";
  });
  setTimeout(() => fly.remove(), 640);

  // pulso sutil no alvo
  try {
    target.animate?.(
      [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
      { duration: 240, easing: "ease-out" }
    );
  } catch (_) {}
}
