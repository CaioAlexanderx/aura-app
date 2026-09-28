// ============================================================
// Aba Lançamentos · alternância Lista / Quadro (28/09/2026)
// A escolha fica lembrada por aparelho. Sem empresa individual (consolidado)
// ou em demonstração, só a lista existe e a alternância nem aparece.
// ============================================================
import { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { QuadroFinanceiro } from "./QuadroFinanceiro";
import type { Transaction } from "@/components/screens/financeiro/types";

export type VisaoLancamentos = "lista" | "quadro";
const CHAVE = "aura.financeiro.visaoLancamentos";

export function lerVisao(): VisaoLancamentos {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CHAVE) : null;
    return v === "quadro" ? "quadro" : "lista";
  } catch { return "lista"; }
}

function gravarVisao(v: VisaoLancamentos) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CHAVE, v); } catch { /* aba anônima */ }
}

export function ListaOuQuadro({ podeQuadro, companyId, onEditar, children }: { podeQuadro: boolean; companyId?: string | null; onEditar?: (tx: Transaction) => void; children: ReactNode }) {
  const [visao, setVisao] = useState<VisaoLancamentos>(lerVisao);
  if (!podeQuadro || !companyId) return <>{children}</>;

  function trocar(v: VisaoLancamentos) { setVisao(v); gravarVisao(v); }

  return (
    <View style={{ gap: 14 }}>
      <View style={s.seg} accessibilityRole="tablist">
        {(["lista", "quadro"] as VisaoLancamentos[]).map((v) => (
          <Pressable key={v} onPress={() => trocar(v)} style={[s.btn, visao === v && s.ativo]}
            accessibilityRole="tab" accessibilityState={{ selected: visao === v }} testID={"visao-" + v}>
            <Text style={[s.txt, visao === v && s.txtAtivo]}>{v === "lista" ? "Lista" : "Quadro"}</Text>
          </Pressable>
        ))}
      </View>
      {visao === "quadro" ? <QuadroFinanceiro companyId={companyId} onEditar={onEditar ? (l) => onEditar(l as Transaction) : undefined} /> : children}
    </View>
  );
}

const s = StyleSheet.create({
  seg: { alignSelf: "flex-start", flexDirection: "row", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 3 },
  btn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 7 },
  ativo: { backgroundColor: Colors.violetD },
  txt: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  txtAtivo: { color: Colors.violet3 },
});
