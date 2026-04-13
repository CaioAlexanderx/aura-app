import { Platform } from "react-native";

export function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2 || Platform.OS !== "web") return null;
  const w = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 6) - 3).toFixed(1)}`)
    .join(" ");
  const html = `<svg width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polyline points="${points}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="0,${height} ${points} ${w},${height}" fill="url(#sg)"/>
  </svg>`;
  return <span style={{ display: "inline-block", width: w, height } as any} dangerouslySetInnerHTML={{ __html: html }} />;
}
