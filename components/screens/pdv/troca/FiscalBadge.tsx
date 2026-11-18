// ============================================================
// AURA. — PDV · Troca v2 · FiscalBadge
// Comunica AO OPERADOR no Step 4 (antes de confirmar) qual estratégia
// fiscal o backend vai usar. Quatro estados visuais:
//
//   - cancel_reissue: NFC-e original no prazo de cancelamento da UF → cancela
//   - devolucao_55:   NFC-e fora do prazo → emite NF-e 55 devolução
//                     (exige endereço — AddressForm aparece junto)
//   - per_origin:     multi-venda com idades mistas — cada origem segue
//                     sua regra (cancel_reissue + devolucao_55 misto)
//   - none:           sem emissão fiscal (caso não-fiscal)
//
// 17/11/2026 (b-troca-prazo-nfce): a estratégia vem da prévia do backend
// (sale.nfce_troca_estrategia, prazo por UF). Componente fora de uso hoje;
// textos alinhados para não guardar a regra antiga de 24 h.
//
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { FiscalStrategy } from "./types";
import { TEXTOS_PRAZO_NFCE } from "@/constants/textosPrazoNfce";

type Props = {
  strategy: FiscalStrategy;
  // Quando per_origin, podemos detalhar quais vendas caem em cada caminho
  perOriginDetail?: { cancelReissueCount: number; devolucao55Count: number };
};

const STRATEGY_CONFIG = {
  cancel_reissue: {
    emoji: "✓",
    title: "Cancelamento + reemissão de NFC-e",
    desc: TEXTOS_PRAZO_NFCE.badgeCancelaDesc,
    accent: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.3)",
  },
  devolucao_55: {
    emoji: "📄",
    title: "NF-e modelo 55 de devolução",
    desc: TEXTOS_PRAZO_NFCE.badgeDevolucaoDesc,
    accent: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.3)",
  },
  per_origin: {
    emoji: "⚖️",
    title: "Estratégia mista (por venda original)",
    desc: "Vendas têm idades fiscais diferentes. Cada uma segue a regra correspondente — algumas vão por cancel/reemissão, outras por NF-e 55.",
    accent: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.3)",
  },
  none: {
    emoji: "○",
    title: "Sem emissão fiscal",
    desc: "Esta operação não envolve documentos fiscais — apenas movimentação de estoque e financeiro.",
    accent: Colors.ink3,
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  },
} as const;

export function FiscalBadge({ strategy, perOriginDetail }: Props) {
  const cfg = STRATEGY_CONFIG[strategy];
  const detailLine =
    strategy === "per_origin" && perOriginDetail
      ? `${perOriginDetail.cancelReissueCount} cancelamento(s) + ${perOriginDetail.devolucao55Count} NF-e 55`
      : null;

  return (
    <View
      style={[
        s.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
    >
      <View style={[s.badgeIco, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
        <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.badgeTitle, { color: cfg.accent }]}>
          {cfg.title}
        </Text>
        <Text style={s.badgeDesc}>{cfg.desc}</Text>
        {detailLine && (
          <Text style={[s.badgeDetail, { color: cfg.accent }]}>{detailLine}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 14,
  },
  badgeIco: {
    width: 36, height: 36,
    borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  badgeTitle: {
    fontSize: 13, fontWeight: "700", marginBottom: 3,
  },
  badgeDesc: {
    fontSize: 12, color: Colors.ink2, lineHeight: 17,
  },
  badgeDetail: {
    fontSize: 11, fontWeight: "600", marginTop: 4,
  },
});

export default FiscalBadge;
