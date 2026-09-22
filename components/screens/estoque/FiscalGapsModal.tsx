// ============================================================
// AURA. — Estoque · "Resolver agora" o aviso fiscal (Matcon M2)
//
// 22/09/2026 (docs/CONTRACT_MATCON.md §M2): lista curta dos produtos de
// família com ST provável (cimento, argamassa, tinta, revestimento…) sem
// código fiscal (CEST). Produto · NCM · sugestão · "Aceitar sugestão" por
// linha, e "Aceitar todas (N)" no rodapé. Sem chamada nova: `products` já
// vem calculado (utils/cest.ts, calcularFiscalGaps) a partir da lista que
// o Estoque tem em memória.
//
// Ação sempre visível em cada linha e no rodapé (regra 7 do CLAUDE.md:
// hover-reveal quebra em touch) — nada depende de passar o mouse.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import type { Product } from "./types";
import { suggestCest, formatCestDisplay } from "@/utils/cest";
import { formatNcmDisplay } from "@/utils/ncm";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Só os produtos com o gap (calcularFiscalGaps já filtrou). */
  products: Product[];
  onAccept?: (product: Product, cest: string) => Promise<boolean | void> | void;
};

export function FiscalGapsModal({ visible, onClose, products, onAccept }: Props) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [pendingAll, setPendingAll] = useState(false);

  async function aceitar(p: Product) {
    const sug = suggestCest(p.ncm);
    if (!sug || !onAccept) return;
    setPending((s) => ({ ...s, [p.id]: true }));
    try {
      await onAccept(p, sug.cest);
    } finally {
      setPending((s) => { const n = { ...s }; delete n[p.id]; return n; });
    }
  }

  async function aceitarTodas() {
    if (!onAccept || products.length === 0) return;
    setPendingAll(true);
    try {
      for (const p of products) {
        const sug = suggestCest(p.ncm);
        if (sug) await onAccept(p, sug.cest);
      }
    } finally {
      setPendingAll(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Código fiscal (CEST)</Text>
            <Pressable onPress={onClose} style={s.closeBtn} accessibilityLabel="Fechar">
              <Text style={s.closeText}>x</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {products.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32, gap: 6 }}>
                <Text style={s.emptyTitle}>Todos os produtos com código fiscal.</Text>
                <Text style={s.emptySub}>As notas de cimento, tinta e ferragem saem sem susto.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {products.map((p) => {
                  const sug = suggestCest(p.ncm);
                  if (!sug) return null;
                  const busy = !!pending[p.id] || pendingAll;
                  return (
                    <View key={p.id} style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.rowDetail}>
                          NCM {formatNcmDisplay((p.ncm || "").replace(/\D/g, ""))} · {sug.family}
                        </Text>
                      </View>
                      <Text style={s.rowSug}>
                        sugestão <Text style={s.rowSugCode}>{formatCestDisplay(sug.cest)}</Text>
                      </Text>
                      <Pressable
                        onPress={() => aceitar(p)}
                        disabled={busy}
                        style={[s.btn, busy && s.btnOff]}
                        accessibilityLabel={"Aceitar sugestão para " + p.name}
                      >
                        {busy
                          ? <ActivityIndicator size="small" color={Colors.violet3} />
                          : <Text style={s.btnTxt}>Aceitar sugestão</Text>}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {products.length > 0 && (
            <View style={s.footer}>
              <Pressable
                onPress={aceitarTodas}
                disabled={pendingAll}
                style={[s.btnPrimary, pendingAll && s.btnOff]}
                accessibilityLabel={"Aceitar todas (" + products.length + ")"}
              >
                {pendingAll
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnPrimaryTxt}>{"Aceitar todas (" + products.length + ")"}</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet: {
    backgroundColor: Colors.bg2, borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "85%",
    borderWidth: 1, borderColor: Colors.border2, overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, color: Colors.ink3, fontWeight: "600" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowDetail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  rowSug: { fontSize: 11, color: Colors.ink3, flexShrink: 0 },
  rowSugCode: { fontWeight: "700", color: Colors.ink },
  btn: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, flexShrink: 0,
  },
  btnOff: { opacity: 0.6 },
  btnTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },

  emptyTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  emptySub: { fontSize: 12, color: Colors.ink3 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  btnPrimary: {
    borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violet3,
  },
  btnPrimaryTxt: { fontSize: 13.5, color: "#fff", fontWeight: "700" },
});

export default FiscalGapsModal;
