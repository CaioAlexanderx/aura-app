import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";

// UX-06: First-time tooltips / coach marks
// Shows contextual tips on first visit to each screen

const SEEN_KEY = "aura_tooltips_seen";

// ── Storage ──────────────────────────────────────────────

function getSeenTips(): string[] {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
}

function markTipSeen(tipId: string) {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
  const seen = getSeenTips();
  if (!seen.includes(tipId)) {
    seen.push(tipId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }
}

export function resetAllTips() {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.removeItem(SEEN_KEY);
  }
}

// ── Tooltip definitions ──────────────────────────────────

export interface TooltipDef {
  id: string;
  title: string;
  message: string;
  screen: string; // which screen this belongs to
  position?: "top" | "bottom"; // where to show
  delay?: number; // ms delay before showing
}

export const TOOLTIPS: TooltipDef[] = [
  // Dashboard
  {
    id: "dashboard_welcome",
    title: "Bem-vindo ao Painel!",
    message: "Aqui voce acompanha seus KPIs em tempo real. Os dados atualizam automaticamente.",
    screen: "dashboard",
    position: "top",
    delay: 500,
  },
  // Financeiro
  {
    id: "financeiro_tabs",
    title: "Abas do Financeiro",
    message: "Use as abas para navegar entre Lancamentos, A Receber, Minha Retirada e Resumo.",
    screen: "financeiro",
    position: "top",
  },
  // PDV
  {
    id: "pdv_busca",
    title: "Busca rapida",
    message: "Digite o nome ou codigo do produto para adicionar ao carrinho. Use Ctrl+N no desktop.",
    screen: "pdv",
    position: "top",
  },
  // Estoque
  {
    id: "estoque_novo",
    title: "Adicionar produto",
    message: "Clique em '+ Novo produto' ou use Ctrl+N para cadastrar. Preencha pelo menos nome e preco.",
    screen: "estoque",
    position: "top",
  },
  // Clientes
  {
    id: "clientes_ranking",
    title: "Ranking de clientes",
    message: "Seus clientes sao ordenados por LTV (valor total gasto). Clique para ver o historico.",
    screen: "clientes",
    position: "top",
  },
  // Contabilidade
  {
    id: "contabil_alertas",
    title: "Calendario fiscal",
    message: "A Aura calcula estimativas e lembra dos prazos. As obrigacoes variam conforme seu regime.",
    screen: "contabilidade",
    position: "top",
  },
  // NF-e
  {
    id: "nfe_emissao",
    title: "Emissao de notas",
    message: "Notas podem ser emitidas automaticamente em cada venda PJ ou manualmente aqui.",
    screen: "nfe",
    position: "top",
  },
  // IA
  {
    id: "ia_contexto",
    title: "Assistente inteligente",
    message: "Selecione o contexto (Financeiro, Estoque, CRM...) para respostas mais precisas.",
    screen: "ia",
    position: "top",
  },
];

// ── Hook ─────────────────────────────────────────────────

export function useFirstTimeTooltip(screen: string) {
  const [activeTip, setActiveTip] = useState<TooltipDef | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = getSeenTips();
    const tip = TOOLTIPS.find(t => t.screen === screen && !seen.includes(t.id));
    if (!tip) return;

    const timer = setTimeout(() => {
      setActiveTip(tip);
      setVisible(true);
    }, tip.delay || 300);

    return () => clearTimeout(timer);
  }, [screen]);

  const dismiss = useCallback(() => {
    if (activeTip) {
      markTipSeen(activeTip.id);
    }
    setVisible(false);
    setActiveTip(null);
  }, [activeTip]);

  return { activeTip, visible, dismiss };
}

// ── Component ────────────────────────────────────────────

interface TooltipBannerProps {
  tip: TooltipDef | null;
  visible: boolean;
  onDismiss: () => void;
}

export function TooltipBanner({ tip, visible, onDismiss }: TooltipBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!tip || !visible) return null;

  return (
    <Animated.View style={[s.container, { opacity }]}>
      <View style={s.card}>
        <View style={s.header}>
          <View style={s.dot} />
          <Text style={s.title}>{tip.title}</Text>
          <Pressable onPress={onDismiss} style={s.closeBtn} hitSlop={12}>
            <Text style={s.closeText}>Entendi</Text>
          </Pressable>
        </View>
        <Text style={s.message}>{tip.message}</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.violetD || "rgba(124,58,237,0.10)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.violet3 || "#7C3AED",
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.violet3 || "#7C3AED",
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.violet3 || "#7C3AED",
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: Colors.violet3 || "#7C3AED",
  },
  closeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.violet3 || "#7C3AED",
  },
  message: {
    fontSize: 12,
    color: Colors.ink2 || "#999",
    lineHeight: 18,
    paddingLeft: 16,
  },
});
