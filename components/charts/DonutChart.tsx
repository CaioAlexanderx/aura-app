// ============================================================
// AURA. — DonutChart genérico (SVG inline, web-only)
//
// Componente reutilizável pra distribuições percentuais.
// Mesma técnica do EmployeeDonut (FinancialCharts) porém genérico:
// recebe lista de items, total, e função de cor por índice.
//
// Uso:
//   <DonutChart
//     items={[{ category: 'A', amount: 1200 }, ...]}
//     total={4000}
//     colorFn={(i) => COLORS[i % COLORS.length]}
//   />
//
// Em nativo (Platform.OS !== 'web') retorna null — mesma
// estratégia dos outros charts SVG do app, já que dependem de
// dangerouslySetInnerHTML. Ajuste futuro: trocar por react-native-svg
// se quiser parity nativa.
// ============================================================
import { View, Text, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

const isWeb = Platform.OS === "web";

export type DonutItem = { category: string; amount: number };

type DonutChartProps = {
  items: DonutItem[];
  total: number;
  /** colorFn(i) decide a cor de cada slice na ordem de items */
  colorFn: (index: number) => string;
  /** tamanho do círculo em px (default 160) */
  size?: number;
  /** label central (default: total formatado em R$). Pass empty string pra ocultar. */
  centerLabel?: string;
  /** sublabel central (default: 'Total'). Pass empty string pra ocultar. */
  centerSublabel?: string;
};

function defaultFmt(n: number): string {
  if (n >= 10000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export function DonutChart({
  items,
  total,
  colorFn,
  size = 160,
  centerLabel,
  centerSublabel = "Total",
}: DonutChartProps) {
  // Em nativo não renderiza (depende de SVG inline / dangerouslySetInnerHTML)
  if (!isWeb) return null;

  // Defensivo: sem dados
  if (!items || items.length === 0 || total <= 0) {
    return (
      <View style={[s.placeholder, { width: size, height: size }]}>
        <Text style={s.placeholderText}>Sem dados</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = Math.round(size * 0.38);   // raio do círculo
  const sw = Math.round(size * 0.155); // espessura do anel
  const circ = 2 * Math.PI * r;

  // Constrói slices com offset acumulado
  let offset = 0;
  const slices = items
    .map((it, i) => {
      const pct = it.amount / total;
      const dash = circ * pct;
      const gap = circ - dash;
      const o = offset;
      offset += dash;
      const color = colorFn(i);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-o}" opacity="0.88"/>`;
    })
    .join("");

  const svg =
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Colors.bg4}" stroke-width="${sw}"/>` +
    `${slices}` +
    `</svg>`;

  const label = centerLabel !== undefined ? centerLabel : defaultFmt(total);
  const showCenter = label !== "" || centerSublabel !== "";

  const center = showCenter
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">` +
      (label ? `<div style="font-size:${Math.round(size * 0.10)}px;font-weight:800;color:${Colors.ink};line-height:1.1">${escapeHtml(label)}</div>` : "") +
      (centerSublabel ? `<div style="font-size:${Math.round(size * 0.065)}px;color:${Colors.ink3};letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(centerSublabel)}</div>` : "") +
      `</div>`
    : "";

  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 } as any}
      dangerouslySetInnerHTML={{ __html: svg + center }}
    />
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default DonutChart;

const s = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  placeholderText: { fontSize: 11, color: Colors.ink3 },
});
