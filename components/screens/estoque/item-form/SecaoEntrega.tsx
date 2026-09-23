// ============================================================
// AURA. — Cadastro de item (aberto) · seção "Entrega" (só no perfil Matcon)
//
// 22/09/2026 — docs/mockups/matcon-cadastro-produto.html, ponto ⑧.
// Uma linha: "Cada m² pesa [21,5] kg." Grava products.weight_kg (coluna do
// M0), que o peso da carga da entrega já soma (components/matcon/
// nfeEntregaUtil.ts, pesoDaEntrega). Opcional: vazio grava null.
//
// Só renderiza quando o perfil pede (perfil.entrega) — no padrão o modal
// nem monta esta seção.
// ============================================================
import { View, Text } from "react-native";
import { Entrada, Secao, fr, s } from "./ui";
import { fmtQty, nomeDaUnidade, parseQtyInput } from "@/utils/matconUnits";
import { nomeDaEmbalagem } from "./perfis";

type Props = {
  unidade: string;
  peso: string; onPeso: (v: string) => void;
  purchaseUnit?: string | null;
  purchaseFactor?: string;
  onSubmit: () => void;
};

/** A dica debaixo do peso: o peso da embalagem (com "Compro por") e o de 100
 *  unidades. "" sem peso. */
export function dicaDoPeso(unidade: string, pesoKg: number | null, fator: number | null, purchaseUnit?: string | null): string {
  if (!pesoKg || !(pesoKg > 0)) return "";
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const partes: string[] = [];
  if (fator && fator > 0) {
    const emb = nomeDaEmbalagem(purchaseUnit);
    partes.push((emb.artigo === "a" ? "A " : "O ") + emb.nome + ": " + fmtQty(r3(pesoKg * fator)) + " kg.");
  }
  partes.push("100 " + unidade + " ≈ " + fmtQty(r3(pesoKg * 100)) + " kg.");
  partes.push("O Aura soma o peso da carga na entrega e o peso vai na nota fiscal.");
  return partes.join(" ");
}

export function SecaoEntrega(p: Props) {
  const pesoNum = p.peso.trim() ? parseQtyInput(p.peso) : null;
  const fator = p.purchaseFactor && p.purchaseFactor.trim() ? parseQtyInput(p.purchaseFactor) : null;
  const dica = dicaDoPeso(p.unidade, pesoNum, fator, p.purchaseUnit);
  return (
    <Secao icon="truck" titulo="Entrega" selo={{ tom: "", texto: "opcional" }}>
      <View style={fr.frase}>
        <Text style={fr.fraseTxt}>{"Cada " + nomeDaUnidade(p.unidade) + " pesa"}</Text>
        <Entrada
          value={p.peso}
          onChangeText={(v: string) => p.onPeso(v.replace(/[^0-9.,]/g, ""))}
          onSubmitEditing={p.onSubmit}
          placeholder="0"
          keyboardType="decimal-pad"
          accessibilityLabel={"Peso de cada " + p.unidade + ", em kg"}
          style={fr.fraseInput}
        />
        <Text style={fr.fraseTxt}>kg.</Text>
      </View>
      <Text style={s.hint}>
        {dica || "Serve para saber quanto vai no caminhão e sai na nota fiscal da entrega."}
      </Text>
    </Secao>
  );
}

export default SecaoEntrega;
