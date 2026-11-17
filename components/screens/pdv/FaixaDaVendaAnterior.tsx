// ============================================================
// AURA. — components/screens/pdv/FaixaDaVendaAnterior.tsx (17/11/2026, p-147)
//
// Faixa no topo da coluna do catálogo, acima do título "Caixa", com o que
// sobrou da venda anterior: número, total, cupom e o estado da nota fiscal.
// Mockup aprovado "Caixa e Troca", Parte 2 (decisões 10 a 12).
//
//   - Uma linha no computador; três no celular (venda e ×, cupom, nota).
//   - "Imprimir cupom" imprime o cupom da venda anterior (Ctrl/⌘+P também,
//     pelo listener do Caixa — utils/atalhosDoCaixa).
//   - Nota: enviando, autorizada ou recusada. A recusada fica vermelha, sem
//     ×, até alguém tocar em "Ver o motivo" (abre o motivo aqui mesmo, com
//     "Tentar de novo"). O estado vem de services/emissaoDaNfce, o mesmo da
//     tela final: a emissão continua depois que ela sai.
// Regras em utils/faixaDaVendaAnterior; textos em ./textosDaTelaFinal.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useEmissaoDaNfce } from "@/hooks/useEmissaoDaNfce";
import { chaveDaNotaDaVenda, marcarMotivoVisto, tentarDeNovo } from "@/services/emissaoDaNfce";
import { ehVendaDoServidor } from "@/services/impressaoNoQuadro";
import {
  cupomDaVenda, dispensarVendaAnterior, marcarCupom, useVendaAnterior,
} from "@/stores/vendaAnterior";
import { notaNaFaixa, notaPrendeAFaixa, podeDispensar, type VendaNaFaixa } from "@/utils/faixaDaVendaAnterior";
import type { ConfigDoVale } from "@/utils/valeTroca";
import { imprimirCupomDaVenda } from "./SaleComplete";
import { TEXTOS_DA_TELA_FINAL as T } from "./textosDaTelaFinal";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Imprime o cupom da venda da faixa (botão e Ctrl/⌘+P). Chamar dentro do
 * clique ou da tecla: a janela de impressão abre na hora.
 */
export function imprimirCupomDaFaixa(f: VendaNaFaixa, token: string | null, config?: ConfigDoVale) {
  if (!ehVendaDoServidor(f.saleId)) return;
  if (cupomDaVenda(f.saleId) === "imprimindo") return;
  const antes = cupomDaVenda(f.saleId);
  marcarCupom(f.saleId, "imprimindo");
  imprimirCupomDaVenda(f.companyId, f.saleId, token, new Date(f.vendaEm), config)
    .then((r) => marcarCupom(f.saleId, r === "ok" ? "impresso" : antes))
    .catch(() => marcarCupom(f.saleId, antes));
}

type Props = {
  faixa: VendaNaFaixa;
  /** Celular: três linhas. */
  compact?: boolean;
  token: string | null;
  config?: ConfigDoVale;
  /** Faixa de uma venda mais antiga que a da frente: só aparece enquanto a
   *  nota prende (enviando, ou recusada sem ninguém ver). */
  antiga?: boolean;
};

export function FaixaDaVendaAnterior({ faixa, compact, token, config, antiga }: Props) {
  const chave = chaveDaNotaDaVenda(faixa.saleId);
  const nota = useEmissaoDaNfce(chave);
  const cupom = useVendaAnterior(s => s.cupom[faixa.saleId]) || "imprimir";
  const [motivoAberto, setMotivoAberto] = useState(false);
  const estadoNota = notaNaFaixa(nota);
  const recusada = estadoNota === "recusada";
  const mostraX = podeDispensar(nota);

  if (antiga && !notaPrendeAFaixa(nota)) return null;

  function verMotivo() {
    marcarMotivoVisto(chave);
    setMotivoAberto(v => !v);
  }

  const venda = (
    <View style={s.peca}>
      <Icon name="check" size={14} color={Colors.green} />
      <Text style={s.txt} numberOfLines={1}>
        <Text style={s.forte}>{T.faixaVenda(faixa.rotulo)}</Text>
        {T.faixaRegistrada(fmt(faixa.total))}
      </Text>
    </View>
  );

  const pecaCupom = !ehVendaDoServidor(faixa.saleId) ? null
    : cupom === "impresso" ? (
      <View style={s.peca} testID="faixa-cupom-impresso">
        <Icon name="check" size={14} color={Colors.green} />
        <Text style={[s.txt, s.ok]}>{T.cupomImpresso}</Text>
      </View>
    ) : cupom === "imprimindo" ? (
      <View style={s.peca} testID="faixa-cupom-imprimindo">
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={s.txt}>{T.imprimindoCupom}</Text>
      </View>
    ) : (
      <Pressable
        onPress={() => imprimirCupomDaFaixa(faixa, token, config)}
        style={[s.botao, compact && s.botaoToque]}
        accessibilityRole="button"
        testID="faixa-imprimir"
      >
        <Icon name="receipt" size={14} color={Colors.violet3} />
        <Text style={s.botaoTxt}>{T.imprimirCupom}</Text>
      </Pressable>
    );

  const pecaNota = estadoNota === "enviando" ? (
    <View style={s.peca} testID="faixa-nota-enviando">
      <ActivityIndicator size="small" color={Colors.violet3} />
      <Text style={s.txt}>{T.notaEnviando}</Text>
    </View>
  ) : estadoNota === "autorizada" ? (
    <View style={s.peca} testID="faixa-nota-autorizada">
      <Icon name="check" size={14} color={Colors.green} />
      <Text style={[s.txt, s.ok]}>{T.notaAutorizada}</Text>
    </View>
  ) : estadoNota === "processando" ? (
    <View style={s.peca} testID="faixa-nota-processando">
      <Icon name="clock" size={14} color={Colors.amber} />
      <Text style={s.txt}>{T.notaProcessando}</Text>
    </View>
  ) : recusada ? (
    <View style={s.peca} testID="faixa-nota-recusada">
      <Icon name="alert" size={14} color={Colors.red} />
      <Text style={[s.txt, s.ruim]}>{T.notaRecusada}</Text>
      <Pressable
        onPress={verMotivo}
        style={[s.botao, s.botaoRecusa, compact && s.botaoToque]}
        accessibilityRole="button"
        accessibilityState={{ expanded: motivoAberto }}
        testID="faixa-ver-motivo"
      >
        <Text style={s.botaoTxt}>{T.verMotivo}</Text>
      </Pressable>
    </View>
  ) : null;

  const x = mostraX ? (
    <Pressable
      onPress={() => dispensarVendaAnterior(faixa.saleId)}
      style={[s.x, compact && s.xToque]}
      accessibilityRole="button"
      accessibilityLabel={T.dispensar}
      testID="faixa-dispensar"
    >
      <Icon name="x" size={14} color={Colors.ink3} />
    </Pressable>
  ) : null;

  // Motivo: o que a SEFAZ (ou o servidor) disse, como no bloco da tela final.
  const erros = nota.payloadDoErro?.erros || nota.payloadDoErro?.errors || [];
  const primeiro = Array.isArray(erros) && erros.length ? erros[0] : null;
  const campo = primeiro?.campo || primeiro?.field;
  const detalhe = primeiro?.mensagem || primeiro?.message || primeiro?.descricao;

  return (
    <View style={[s.faixa, recusada && s.faixaRecusada]} testID="faixa-venda-anterior">
      {compact ? (
        <>
          <View style={s.linha}>{venda}<View style={{ flex: 1, minWidth: 4 }} />{x}</View>
          {pecaCupom ? <View style={s.linha}>{pecaCupom}</View> : null}
          {pecaNota ? <View style={s.linha}>{pecaNota}</View> : null}
        </>
      ) : (
        <View style={[s.linha, s.linhaLarga]}>
          {venda}
          {pecaCupom}
          {pecaNota}
          <View style={{ flex: 1, minWidth: 4 }} />
          {x}
        </View>
      )}
      {recusada && motivoAberto ? (
        <View style={s.motivo} testID="faixa-motivo">
          <Text style={[s.txt, s.forte]}>{T.motivoTitulo}</Text>
          <Text style={s.txt}>{nota.erro || T.motivoSemTexto}</Text>
          {campo ? <Text style={[s.txt, s.ruim]}>{T.campo(campo, detalhe)}</Text> : null}
          <Pressable
            onPress={() => { setMotivoAberto(false); tentarDeNovo(chave); }}
            style={[s.botao, compact && s.botaoToque, { alignSelf: "flex-start" }]}
            accessibilityRole="button"
            testID="faixa-tentar-de-novo"
          >
            <Icon name="refresh" size={13} color={Colors.violet3} />
            <Text style={s.botaoTxt}>{T.tentarDeNovo}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    borderRadius: 11, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
    paddingVertical: 7, paddingLeft: 12, paddingRight: 8, marginBottom: 12, gap: 6,
  },
  faixaRecusada: { borderColor: Colors.red, backgroundColor: Colors.redD },
  linha: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  linhaLarga: { flexWrap: "wrap", columnGap: 14, rowGap: 6 } as any,
  peca: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0, flexShrink: 1 },
  txt: { fontSize: 12.5, color: Colors.ink2, flexShrink: 1 },
  forte: { color: Colors.ink, fontWeight: "700" },
  ok: { color: Colors.green, fontWeight: "600" },
  ruim: { color: Colors.red, fontWeight: "700" },
  botao: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 30, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD,
  },
  botaoToque: { minHeight: 44 },
  botaoRecusa: { borderColor: Colors.red, backgroundColor: Colors.bg3 },
  botaoTxt: { fontSize: 12.5, color: Colors.ink, fontWeight: "600" },
  x: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  xToque: { width: 44, height: 44 },
  motivo: { gap: 6, paddingTop: 8, marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border },
});

export default FaixaDaVendaAnterior;
