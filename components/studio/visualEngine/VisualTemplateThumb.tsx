// ============================================================
// AURA STUDIO · VisualTemplateThumb — F6 (thumbnail neutro)
//
// Mini-preview do template visual pra listas (Estoque Studio,
// personalizáveis) quando o produto não tem foto própria.
// Desenho 2D leve (canvas): camiseta neutra (photo2d) ou caneca
// estilizada (model3d) — NÃO monta three.js (thumb precisa ser
// barato em lista com dezenas de itens).
//
// Token-free (cores neutras fixas) — funciona em painel e listas.
// Web-only; nativo devolve null (a lista mostra o placeholder atual).
//
// 03/07/2026 — F6 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { composeView } from "./compose2d";
import { defaultTshirtSpec } from "./defaultTemplates";

type Props = {
  kind: "photo2d" | "model3d" | null | undefined;
  size?: number;          // px (quadrado-ish; altura 0.76x)
  garmentColor?: string;
};

function drawMugThumb(canvas: HTMLCanvasElement, px: number, garmentColor: string) {
  canvas.width = px;
  canvas.height = Math.round(px * 0.76);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#ECEAE4";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.88, W * 0.3, H * 0.05, 0, 0, 7); ctx.fill();
  // corpo
  const bx = W * 0.32, by = H * 0.22, bw = W * 0.34, bh = H * 0.56;
  ctx.fillStyle = garmentColor;
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = Math.max(px * 0.006, 1.5);
  ctx.beginPath();
  // @ts-ignore roundRect existe nos browsers alvo; fallback abaixo
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(bx, by, bw, bh, [4, 4, 10, 10]);
  } else {
    ctx.rect(bx, by, bw, bh);
  }
  ctx.fill(); ctx.stroke();
  // alça
  ctx.beginPath();
  ctx.arc(bx + bw + px * 0.005, by + bh * 0.45, bh * 0.28, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = Math.max(px * 0.035, 4);
  ctx.strokeStyle = garmentColor;
  ctx.stroke();
  ctx.lineWidth = Math.max(px * 0.006, 1.5);
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.arc(bx + bw + px * 0.005, by + bh * 0.45, bh * 0.28 + Math.max(px * 0.018, 2), -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + bw + px * 0.005, by + bh * 0.45, bh * 0.28 - Math.max(px * 0.018, 2), -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // borda superior
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by, bw / 2, bh * 0.06, 0, 0, 7);
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fill();
  // área de impressão sugerida
  ctx.strokeStyle = "#7C3AED";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + bw * 0.15, by + bh * 0.22, bw * 0.7, bh * 0.5);
  ctx.setLineDash([]);
}

export function VisualTemplateThumb({ kind, size = 96, garmentColor = "#F5F2EA" }: Props) {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current || !kind) return;
    if (kind === "model3d") {
      drawMugThumb(canvasRef.current, size * 2, garmentColor); // 2x pra nitidez
    } else {
      const spec = defaultTshirtSpec(21, 28, "center");
      composeView(canvasRef.current, spec.views[0], {}, {
        garmentColor,
        showAreas: true,
        pixelWidth: size * 2,
      });
    }
  }, [kind, size, garmentColor]);

  if (Platform.OS !== "web" || !kind) return null;

  return (
    // @ts-ignore — canvas DOM no web
    <canvas
      ref={canvasRef}
      style={{ width: size, height: Math.round(size * 0.76), display: "block", borderRadius: 8 } as any}
    />
  );
}

export default VisualTemplateThumb;
