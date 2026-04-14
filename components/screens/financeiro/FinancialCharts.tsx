// ============================================================
// AURA. — SVG Charts for Financial Analysis (Web only)
// Renders inline SVG via dangerouslySetInnerHTML
// ============================================================
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

const isWeb = Platform.OS === "web";
const EMP_COLORS = ["#7c3aed", "#0d9488", "#2563eb", "#db2777", "#d97706", "#059669"];
function fmtK(n: number) { return n >= 10000 ? `R$ ${(n/1000).toFixed(1)}k` : `R$ ${n.toFixed(2).replace('.', ',')}`; }

// -- Donut: Employee share --
export function EmployeeDonut({ employees }: { employees: { name: string; faturamento: number; pct_total: number }[] }) {
  if (!isWeb || employees.length === 0) return null;
  const total = employees.reduce((s, e) => s + e.faturamento, 0);
  const size = 180, cx = 90, cy = 90, r = 68, sw = 28;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = employees.map((e, i) => {
    const pct = e.faturamento / total;
    const dash = circ * pct;
    const gap = circ - dash;
    const o = offset; offset += dash;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${EMP_COLORS[i % EMP_COLORS.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-o}" opacity="0.85"/>`;
  }).join('');
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Colors.bg4}" stroke-width="${sw}"/>${slices}</svg>`;
  const center = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:16px;font-weight:800;color:${Colors.ink}">${fmtK(total)}</div><div style="font-size:10px;color:${Colors.ink3}">Total</div></div>`;
  return (
    <View style={s.card}>
      <Text style={s.title}>Participacao por vendedora</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 }}>
        <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 } as any} dangerouslySetInnerHTML={{ __html: svg + center }} />
        <View style={{ flex: 1, gap: 10 }}>
          {employees.map((e, i) => (
            <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: EMP_COLORS[i % EMP_COLORS.length] }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: '600' }}>{e.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: '700' }}>{e.pct_total}%</Text>
                <Text style={{ fontSize: 10, color: Colors.ink3 }}>{fmtK(e.faturamento)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// -- Grouped bars: Employee monthly evolution --
export function EmployeeMonthlyChart({ data, employees }: { data: { month: string; name: string; faturamento: number }[]; employees: string[] }) {
  if (!isWeb || data.length === 0 || employees.length === 0) return null;
  // Group by month
  const months: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    if (!months[d.month]) months[d.month] = {};
    months[d.month][d.name] = (months[d.month][d.name] || 0) + d.faturamento;
  });
  const sortedMonths = Object.keys(months).sort();
  if (sortedMonths.length < 2) return null;
  const empNames = employees.slice(0, 5);
  const maxVal = Math.max(...Object.values(months).flatMap(m => Object.values(m)), 1);
  const W = Math.max(sortedMonths.length * 80, 400);
  const H = 200, pad = 40, chartH = H - pad - 10;
  const barW = Math.min(14, 60 / empNames.length);
  const groupW = barW * empNames.length + 8;
  const step = (W - 60) / sortedMonths.length;

  let bars = '';
  sortedMonths.forEach((m, mi) => {
    const x0 = 50 + mi * step;
    empNames.forEach((name, ei) => {
      const val = months[m]?.[name] || 0;
      const h = (val / maxVal) * chartH;
      const bx = x0 + ei * barW;
      const by = pad + chartH - h;
      bars += `<rect x="${bx}" y="${by}" width="${barW - 1}" height="${h}" rx="2" fill="${EMP_COLORS[ei % EMP_COLORS.length]}" opacity="0.8"/>`;
    });
    // Month label
    const labelMonth = m.slice(5); // MM from YYYY-MM
    const MONTH_NAMES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const label = MONTH_NAMES[parseInt(labelMonth)] || labelMonth;
    bars += `<text x="${x0 + groupW/2 - 4}" y="${H - 2}" fill="${Colors.ink3}" font-size="9" text-anchor="middle" font-family="sans-serif">${label}</text>`;
  });

  // Y-axis gridlines
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    const val = maxVal - (maxVal / 4) * i;
    grid += `<line x1="45" y1="${y}" x2="${W}" y2="${y}" stroke="${Colors.border}" stroke-width="0.5" stroke-dasharray="4"/>`;
    grid += `<text x="42" y="${y + 3}" fill="${Colors.ink3}" font-size="8" text-anchor="end" font-family="sans-serif">${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val.toFixed(0)}</text>`;
  }

  const svgContent = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;

  return (
    <View style={s.card}>
      <Text style={s.title}>Evolucao mensal por vendedora</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {empNames.map((name, i) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: EMP_COLORS[i % EMP_COLORS.length] }} />
            <Text style={{ fontSize: 10, color: Colors.ink3 }}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// -- Line chart: Monthly revenue trend with ticket medio --
export function RevenueTrendLine({ monthly }: { monthly: { label: string; receita: number; ticket_medio: number }[] }) {
  if (!isWeb || monthly.length < 3) return null;
  const W = Math.max(monthly.length * 60, 400);
  const H = 180, pad = 35, chartH = H - pad - 20;
  const maxR = Math.max(...monthly.map(m => m.receita), 1);
  const maxT = Math.max(...monthly.map(m => m.ticket_medio), 1);
  const stepX = (W - 60) / (monthly.length - 1);

  // Revenue area + line
  const points = monthly.map((m, i) => {
    const x = 50 + i * stepX;
    const y = pad + chartH - (m.receita / maxR) * chartH;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length-1].x},${pad + chartH} L${points[0].x},${pad + chartH} Z`;

  // Ticket medio line
  const ticketPoints = monthly.map((m, i) => {
    const x = 50 + i * stepX;
    const y = pad + chartH - (m.ticket_medio / maxT) * chartH;
    return { x, y };
  });
  const ticketPath = ticketPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Grid
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    const val = maxR - (maxR / 4) * i;
    grid += `<line x1="45" y1="${y}" x2="${W}" y2="${y}" stroke="${Colors.border}" stroke-width="0.5" stroke-dasharray="4"/>`;
    grid += `<text x="42" y="${y + 3}" fill="${Colors.ink3}" font-size="8" text-anchor="end" font-family="sans-serif">${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val.toFixed(0)}</text>`;
  }

  // Labels
  const labels = monthly.map((m, i) => {
    const x = 50 + i * stepX;
    return `<text x="${x}" y="${H - 2}" fill="${Colors.ink3}" font-size="9" text-anchor="middle" font-family="sans-serif">${m.label}</text>`;
  }).join('');

  // Dots
  const dots = points.map((p, i) => {
    return `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#059669" stroke="${Colors.bg3}" stroke-width="2"/>`;
  }).join('');

  const svgContent = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${grid}
    <path d="${areaPath}" fill="#059669" opacity="0.1"/>
    <path d="${linePath}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${ticketPath}" fill="none" stroke="#d97706" stroke-width="1.5" stroke-dasharray="6 3" stroke-linecap="round"/>
    ${dots}
    ${labels}
  </svg>`;

  return (
    <View style={s.card}>
      <Text style={s.title}>Tendencia de faturamento</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <div dangerouslySetInnerHTML={{ __html: svgContent }} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: '#059669' }} />
          <Text style={{ fontSize: 10, color: Colors.ink3 }}>Faturamento</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: '#d97706', borderStyle: 'dashed' as any }} />
          <Text style={{ fontSize: 10, color: Colors.ink3 }}>Ticket medio</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: '700', marginBottom: 8 },
});
