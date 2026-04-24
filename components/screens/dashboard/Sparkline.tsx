import { View, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { GRAD } from "./types";

type Props = {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  // Claude Design multi-color spark (violet1 -> violet2 -> pink).
  rainbow?: boolean;
  // Area fill + glowing leading dot.
  glow?: boolean;
  strokeWidth?: number;
};

// Builds a smooth cubic-bezier path through the data points for a silky line.
function smoothPath(data: number[], w: number, h: number, pad = 4) {
  if (!data || data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / range) * (h - pad * 2) - pad,
  }));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function Sparkline({
  data,
  color = Colors.violet3,
  height = 40,
  width = 120,
  rainbow = false,
  glow = false,
  strokeWidth = 2,
}: Props) {
  // Native falls back to an invisible placeholder — the web export is the
  // deployment target where fidelity matters, and we avoid a new dep.
  if (!data || data.length < 2 || Platform.OS !== "web") {
    return <View style={{ width, height }} />;
  }

  const line = smoothPath(data, width, height);
  if (!line) return null;

  const gradId = `sg-${Math.random().toString(36).slice(2, 8)}`;
  const areaId = `${gradId}-a`;

  const strokePaint = rainbow ? `url(#${gradId})` : color;
  const dotColor = rainbow ? GRAD.pink : color;

  // Leading dot at end
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const endX = (data.length - 1) * step;
  const endY = height - ((data[data.length - 1] - min) / range) * (height - 8) - 4;

  // Area (line down to bottom corners)
  const area = `${line} L ${endX.toFixed(1)} ${height} L 0 ${height} Z`;

  const shadow = glow ? `filter: drop-shadow(0 2px 6px ${GRAD.violet3}88);` : "";

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="overflow: visible">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${GRAD.violet1}"/>
          <stop offset="50%" stop-color="${GRAD.violet2}"/>
          <stop offset="100%" stop-color="${GRAD.pink}"/>
        </linearGradient>
        <linearGradient id="${areaId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${rainbow ? GRAD.violet2 : color}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${rainbow ? GRAD.violet2 : color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${areaId})"/>
      <path d="${line}" fill="none" stroke="${strokePaint}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="${shadow} stroke-dasharray: 1200; stroke-dashoffset: 0; animation: auraDrawLine 1.6s cubic-bezier(0.3, 0, 0.2, 1) both"/>
      ${glow ? `<circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="3" fill="#fff" style="filter: drop-shadow(0 0 6px ${dotColor})"/>` : ""}
    </svg>
  `;

  return (
    <span
      style={{ display: "inline-block", width, height, lineHeight: 0 } as any}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
