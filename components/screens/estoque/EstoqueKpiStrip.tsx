// ============================================================
// EstoqueKpiStrip — 4 cards web (Valor primário com sparkline +
// Produtos + Unidades + Estoque baixo). Premium v2 (08/05/2026).
// Web-only.
// ============================================================
import { Platform } from "react-native";
import { useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

const fmtBRL = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

function Sparkline({ accent, isDark }: { accent: string; isDark: boolean }) {
  const pts = [22, 20, 24, 21, 26, 24, 28, 26, 30, 28, 33, 30, 34];
  const w = 110, h = 32;
  const max = Math.max(...pts), min = Math.min(...pts);
  const path = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h;
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const lastY = h - ((pts[pts.length - 1] - min) / (max - min || 1)) * h;
  return (
    <svg width={w} height={h + 4} style={{ position: "absolute", right: 16, top: 16 } as any}>
      <defs>
        <linearGradient id="auraEstSparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={isDark ? 0.35 : 0.22} />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + " L" + w + "," + h + " L0," + h + " Z"} fill="url(#auraEstSparkFill)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="3" fill={accent} />
    </svg>
  );
}

type Props = {
  totalValue: number;
  totalProducts: number;
  totalUnits: number;
  lowCount: number;
  onLowClick?: () => void;
};

export function EstoqueKpiStrip({ totalValue, totalProducts, totalUnits, lowCount, onLowClick }: Props) {
  const C = useColors();
  const { isDark } = useThemeStore();
  if (Platform.OS !== "web") return null;

  const accent = C.violet;
  const surface = isDark ? "rgba(20,14,38,0.55)" : "rgba(255,255,255,0.70)";
  const border = isDark ? "rgba(120,100,240,0.18)" : "rgba(109,40,217,0.10)";
  const border2 = isDark ? "rgba(167,139,250,0.30)" : "rgba(124,58,237,0.20)";
  const formatted = fmtBRL(totalValue);
  const [reais, cents] = formatted.replace("R$ ", "").split(",");

  const Card = ({ label, primary, big, tone, valueNode, sub, onClick, sparkline }: {
    label: string; primary?: boolean; big?: boolean; tone?: "warn" | "good";
    valueNode: any; sub: any; onClick?: () => void; sparkline?: boolean;
  }) => {
    const dotColor = tone === "warn" ? "#fbbf24" : tone === "good" ? (isDark ? "#34d399" : "#059669") : accent;
    return (
      <div onClick={onClick} className="aura-est-lift" style={{
        background: surface,
        border: "1px solid " + (primary ? border2 : border),
        borderRadius: 18,
        padding: "18px 20px 16px",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: primary ? "0 18px 38px " + accent + "10" : "none",
        cursor: onClick ? "pointer" : "default",
      } as any}>
        {primary && (
          <div style={{
            position: "absolute", top: -50, right: -30, width: 200, height: 200,
            background: "radial-gradient(circle, " + accent + "22 0%, transparent 65%)",
            animation: "auraEstPulse 8s ease-in-out infinite", pointerEvents: "none",
          } as any} />
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: big ? 6 : 8,
          fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          color: C.ink3, position: "relative",
        } as any}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: dotColor } as any} />
          {label}
        </div>
        <div style={{
          fontFamily: Fonts.heading,
          fontSize: big ? 50 : 30, lineHeight: 1, color: C.ink,
          fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
          position: "relative", display: "flex", alignItems: "baseline", flexWrap: "wrap",
          fontWeight: 400,
        } as any}>{valueNode}</div>
        <div style={{ fontSize: 12, color: C.ink3, marginTop: big ? 10 : 6, position: "relative" } as any}>{sub}</div>
        {sparkline && <Sparkline accent={accent} isDark={isDark} />}
      </div>
    );
  };

  return (
    <div className="aura-est-rise" style={{
      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 14,
      margin: "8px 4px 22px",
    } as any}>
      <Card
        label="Valor em estoque"
        primary big sparkline
        valueNode={
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 } as any}>
            <span style={{ fontFamily: Fonts.heading, fontStyle: "italic", fontSize: 18, color: C.ink3, alignSelf: "flex-start", marginTop: 6 } as any}>R$</span>
            <span style={{ fontFamily: Fonts.heading, fontSize: 50, lineHeight: 1, color: C.ink, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" } as any}>{reais}</span>
            <span style={{ fontFamily: Fonts.heading, fontSize: 22, color: C.ink2, alignSelf: "flex-start", marginTop: 6, fontVariantNumeric: "tabular-nums" } as any}>,{cents || "00"}</span>
          </span>
        }
        sub={<span>Soma de stock × custo · atualizado em tempo real</span>}
      />
      <Card
        label="Produtos"
        valueNode={<>{fmtInt(totalProducts)}<span style={{ fontSize: 16, color: C.ink3, marginLeft: 4 } as any}>itens</span></>}
        sub="Total cadastrado"
      />
      <Card
        label="Unidades em estoque"
        valueNode={<>{fmtInt(totalUnits)}<span style={{ fontSize: 16, color: C.ink3, marginLeft: 4 } as any}>un</span></>}
        sub="Soma de stock"
      />
      <Card
        label="Estoque baixo"
        tone={lowCount > 0 ? "warn" : "good"}
        valueNode={<>{lowCount}<span style={{ fontSize: 16, color: C.ink3, marginLeft: 4 } as any}>{lowCount > 0 ? "alerta" + (lowCount > 1 ? "s" : "") : "ok"}</span></>}
        sub={lowCount > 0 ? "reposição sugerida" : "tudo dentro do esperado"}
        onClick={lowCount > 0 ? onLowClick : undefined}
      />
    </div>
  );
}
