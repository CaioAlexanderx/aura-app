import { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Product } from "./types";
import { fmt } from "./types";
import { useValoresOcultos } from "@/stores/valoresOcultos";
// 22/09/2026 (Matcon M0): a concatenação crua já mostrava decimal quando
// havia um, mas sem separador de milhar pt-BR. fmtQty é neutro pra
// estoque inteiro (a imensa maioria hoje) e correto pra fracionado.
import { qtdComUnidade } from "@/utils/matconUnits";
// 22/09/2026 (Matcon M2, docs/CONTRACT_MATCON.md §M2): aviso fiscal —
// produtos de família com ST provável (cimento, tinta, ferragem…) sem
// código fiscal (CEST). Calculado no front, sem chamada nova.
import { calcularFiscalGaps } from "@/utils/cest";
import { FiscalGapsModal } from "./FiscalGapsModal";

function AlertRow({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);
  const { m } = useValoresOcultos();
  const isWeb = Platform.OS === "web";
  const deficit = product.minStock - product.stock;
  return (
    <Pressable onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[s.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
      <View style={s.icon}><Text style={s.iconText}>!</Text></View>
      <View style={{ flex: 1 }}><Text style={s.name}>{product.name}</Text><Text style={s.detail}>Atual: {qtdComUnidade(product.stock, product.unit)} · Mínimo: {qtdComUnidade(product.minStock, product.unit)}</Text></View>
      <View style={{ alignItems: "flex-end", gap: 4 }}><View style={s.badge}><Text style={s.badgeText}>Repor {qtdComUnidade(deficit, product.unit)}</Text></View><Text style={s.cost}>~{m(fmt(deficit * product.cost))}</Text></View>
    </Pressable>
  );
}

type Props = {
  products: Product[];
  // 22/09/2026 (Matcon M2) — todas opcionais: sem matconOn o aviso fiscal
  // nem calcula. `emiteNota` e `onUpdateCest` vêm da tela de Estoque
  // (nfce_config.is_active e updateProduct do useProducts).
  matconOn?: boolean;
  emiteNota?: boolean;
  onUpdateCest?: (product: Product, cest: string) => Promise<boolean | void> | void;
};

export function AlertsList({ products, matconOn, emiteNota, onUpdateCest }: Props) {
  const { m } = useValoresOcultos();
  const [gapsOpen, setGapsOpen] = useState(false);
  const lowStock = products.filter(p => p.stock <= p.minStock).sort((a, b) => (a.stock / (a.minStock || 1)) - (b.stock / (b.minStock || 1)));

  // Só calcula com o módulo ligado: loja sem Matcon nem varre a lista.
  const fiscalGaps = useMemo(
    () => (matconOn ? calcularFiscalGaps(products) : []),
    [products, matconOn]
  );
  // Só emissor de nota vê isso — quem não emite nota não tem o que resolver.
  const mostrarAvisoFiscal = !!matconOn && !!emiteNota && fiscalGaps.length > 0;

  const avisoFiscal = mostrarAvisoFiscal ? (
    <>
      <View style={s.fiscalCard}>
        <View style={s.fiscalRow}>
          <View style={s.fiscalIcon}><Text style={s.fiscalIconText}>!</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.fiscalTitle}>
              {fiscalGaps.length} produto{fiscalGaps.length > 1 ? "s" : ""} de cimento, tinta e ferragem sem o código fiscal (CEST)
            </Text>
            <Text style={s.fiscalSub}>A nota deles pode ser recusada.</Text>
          </View>
          <Pressable onPress={() => setGapsOpen(true)} style={s.fiscalBtn} accessibilityLabel="Resolver agora">
            <Text style={s.fiscalBtnText}>Resolver agora</Text>
          </Pressable>
        </View>
      </View>
      <FiscalGapsModal
        visible={gapsOpen}
        onClose={() => setGapsOpen(false)}
        products={fiscalGaps}
        onAccept={onUpdateCest}
      />
    </>
  ) : null;

  if (lowStock.length === 0) return (
    <View>
      <View style={s.allGood}><Text style={s.allGoodIcon}>OK</Text><Text style={s.allGoodTitle}>Estoque em dia!</Text><Text style={s.allGoodSub}>Nenhum produto abaixo do estoque mínimo.</Text></View>
      {avisoFiscal}
    </View>
  );

  return (
    <View>
      <View style={s.alertHeader}><Text style={s.alertHeaderText}>{lowStock.length} produto{lowStock.length > 1 ? "s" : ""} abaixo do estoque minimo</Text></View>
      <View style={s.listCard}>{lowStock.map(p => <AlertRow key={p.id} product={p} />)}</View>
      <View style={s.reorderCard}><Text style={s.reorderTitle}>Custo estimado de reposição</Text><Text style={s.reorderValue}>{m(fmt(lowStock.reduce((s, p) => s + (p.minStock - p.stock) * p.cost, 0)))}</Text><Text style={s.reorderHint}>Para repor todos ao estoque mínimo</Text></View>
      {avisoFiscal}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 14, color: Colors.red, fontWeight: "800" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  detail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  cost: { fontSize: 10, color: Colors.ink3 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  alertHeader: { backgroundColor: Colors.redD, borderRadius: 12, padding: 14, marginBottom: 16 },
  alertHeaderText: { fontSize: 13, color: Colors.red, fontWeight: "600" },
  allGood: { alignItems: "center", paddingVertical: 48, gap: 8 },
  allGoodIcon: { fontSize: 32, color: Colors.green, fontWeight: "800" },
  allGoodTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  allGoodSub: { fontSize: 13, color: Colors.ink3 },
  reorderCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", gap: 6 },
  reorderTitle: { fontSize: 12, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  reorderValue: { fontSize: 28, color: Colors.amber, fontWeight: "800", letterSpacing: -0.5 },
  reorderHint: { fontSize: 11, color: Colors.ink3 },
  // 22/09/2026 (Matcon M2) — aviso fiscal, logo abaixo dos alertas de mínimo.
  fiscalCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", marginTop: 16 },
  fiscalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fiscalIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.amberD, alignItems: "center", justifyContent: "center" },
  fiscalIconText: { fontSize: 14, color: Colors.amber, fontWeight: "800" },
  fiscalTitle: { fontSize: 13, color: Colors.ink, fontWeight: "600", lineHeight: 18 },
  fiscalSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  fiscalBtn: { backgroundColor: Colors.amberD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", flexShrink: 0 },
  fiscalBtnText: { fontSize: 11.5, color: Colors.amber, fontWeight: "700" },
});

export default AlertsList;
