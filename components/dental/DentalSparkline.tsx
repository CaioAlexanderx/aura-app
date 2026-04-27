// ============================================================
// DentalSparkline — mini sparkline cyan/violet (PR16).
//
// SVG via dangerouslySetInnerHTML (mesmo padrao do shell negocio,
// sem dependencia de react-native-svg).
//
// Aceita series de numeros, normaliza pra range visivel.
// Variant: 'inline' (16px alto, KPI cards) ou 'hero' (40px, hero card).
// ============================================================

import { View } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  variant?: "inline" | "hero";
  glow?: boolean;
}

export function DentalSparkline({
  values, width = 80, height = 18,
  color = DentalColors.cyan, variant = "inline", glow = false,
}: Props) {
  if (typeof window === "undefined" || !values || values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const padY = height * 0.15;
  const innerH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - padY - ((v - min) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathLine = `M ${points.join(" L ")}`;
  const pathArea = `${pathLine} L ${width.toFixed(1)},${height.toFixed(1)} L 0,${height.toFixed(1)} Z`;

  const lineWidth = variant === "hero" ? 2.5 : 1.5;
  const gradId = "dentalSpark_" + Math.random().toString(36).slice(2, 8);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${pathArea}" fill="url(#${gradId})" />
      <path d="${pathLine}" fill="none" stroke="${color}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"
        ${glow ? `style="filter: drop-shadow(0 0 6px ${color}80)"` : ""} />
    </svg>
  `;

  return (
    <View
      style={{ width, height }}
      // @ts-expect-error dangerouslySetInnerHTML web only
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
