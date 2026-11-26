// ============================================================
// AURA. — Detalhe da condicional · "Acrescentar peça" (C5b, 26/11/2026)
//
// Notas do mockup: "Acrescentar peça: entra com o preço do dia e o mesmo
// prazo; comprovante reimpresso marcado como atualizado". Reaproveita o passo
// de peças da Nova condicional (nova/PassoPecas: bipe, busca, cor e tamanho,
// livre/com cliente, aviso de quem vende sem estoque) e chama `acrescentar` do
// hooks/useCondicional.ts (POST /itens, na loja dona da condicional).
//
// Respostas: 201 com `avisos[].mensagem` para quem vende sem estoque (mostra o
// aviso); 409 COND_SEM_SALDO volta com a condicional que segura a peça (a
// mesma nota da Nova condicional); 422 com a frase do servidor.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, CondicionalCores as CD } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { lerVendaSemEstoque } from "@/utils/vendaSemEstoque";
import { PassoPecas } from "../nova/PassoPecas";
import { usePecasDaLoja } from "../nova/usePecasDaLoja";
import { faltasDoErro, frasePronta, type FaltaDaCondicional } from "../nova/api";
import type { PecaDaCondicional as PecaNova } from "../nova/busca";

export const TEXTOS_DO_ACRESCENTAR = {
  titulo: "Acrescentar peça",
  sub: "Entra com o preço de hoje e o mesmo prazo.",
  confirmar: (n: number) => (n === 1 ? "Acrescentar 1 peça" : `Acrescentar ${n} peças`),
  cancelar: "Cancelar",
  feito: (n: number) => (n === 1 ? "Peça acrescentada." : `${n} peças acrescentadas.`),
  erro: "Não deu para acrescentar agora. Tente de novo.",
} as const;
const T = TEXTOS_DO_ACRESCENTAR;

type Props = {
  /** Loja DONA da condicional (consolidado incluso). */
  companyId: string;
  acrescentar: (items: Array<{ product_id: string; variant_id?: string | null }>) => Promise<any>;
  onFechar: () => void;
  onVerCondicional?: (condicionalId: string, companyId?: string | null) => void;
};

export function AcrescentarPecas({ companyId, acrescentar, onFechar, onVerCondicional }: Props) {
  const { settings } = usePdvSettings(companyId);
  const vendeSemEstoque = lerVendaSemEstoque(settings);
  const { produtos, carregando, variantesDe, acharNoServidor } = usePecasDaLoja(companyId, true);
  const [pecas, setPecas] = useState<PecaNova[]>([]);
  const [faltas, setFaltas] = useState<FaltaDaCondicional[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (enviando || !pecas.length) return;
    setEnviando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await acrescentar(pecas.map((p) => ({ product_id: p.productId, ...(p.variantId ? { variant_id: p.variantId } : {}) })));
      const avisos = ((r && r.avisos) || []).map((a: any) => a && a.mensagem).filter(Boolean) as string[];
      toast.success(T.feito(pecas.length));
      if (avisos.length) { setAviso(avisos[0]); setPecas([]); }
      else onFechar();
    } catch (e: any) {
      const f = faltasDoErro(e);
      if (f) setFaltas(f);
      else setErro(frasePronta(e) || e?.message || T.erro);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={s.caixa} testID="cond-acrescentar">
      <View style={s.topo}>
        <Icon name="plus" size={14} color={CD.cdInk} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo}>{T.titulo}</Text>
          <Text style={s.sub}>{T.sub}</Text>
        </View>
      </View>
      <PassoPecas
        produtos={produtos}
        carregando={carregando}
        variantesDe={variantesDe}
        acharNoServidor={acharNoServidor}
        pecas={pecas}
        onAdicionar={(p) => { setPecas((l) => [...l, p]); setFaltas(null); setAviso(null); }}
        onTirar={(chave) => { setPecas((l) => l.filter((x) => x.chave !== chave)); setFaltas(null); }}
        vendeSemEstoque={vendeSemEstoque}
        faltas={faltas}
        onVerCondicional={onVerCondicional ? (id) => onVerCondicional(id, companyId) : undefined}
      />
      {!!aviso && (
        <View style={s.aviso} testID="cond-acrescentar-aviso" accessibilityRole="alert">
          <Icon name="alert" size={14} color={CD.warnInk} />
          <Text style={s.avisoTxt}>{aviso}</Text>
        </View>
      )}
      {!!erro && <Text style={s.erro} testID="cond-acrescentar-erro" accessibilityRole="alert">{erro}</Text>}
      <View style={s.acoes}>
        <Button title={T.confirmar(pecas.length)} icon="plus" variant="primary" loading={enviando}
          disabled={!pecas.length || !!faltas?.length} onPress={confirmar} style={s.botao} testID="cond-acrescentar-confirmar" />
        <Button title={T.cancelar} variant="ghost" onPress={onFechar} disabled={enviando} style={s.botao} testID="cond-acrescentar-cancelar" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderWidth: 1, borderStyle: "dashed", borderColor: CD.cdLine, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: CD.cdBg },
  topo: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 10 },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2 },
  aviso: { flexDirection: "row", gap: 6, alignItems: "flex-start", padding: 8, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: CD.warnLine, backgroundColor: CD.warnBg },
  avisoTxt: { flex: 1, fontSize: 12, color: CD.warnInk, lineHeight: 17 },
  erro: { fontSize: 12.5, color: CD.badInk, marginTop: 8 },
  acoes: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },
  botao: { minHeight: 44 },
});
