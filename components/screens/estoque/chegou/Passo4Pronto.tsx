// ============================================================
// AURA. — "Chegou mercadoria" · Passo 4: Pronto (A7)
//
// Mockup estoque-portas-mockup-17-11.html, parte 4 ("Passo 4 · Pronto" e
// "Parte não entrou"). A contagem vem das respostas do servidor
// (resumoDoPronto): com entrada, já existiam, cadastrados agora, ligados ao
// fornecedor e o que ficou de fora.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TEXTOS_CHEGOU as T } from "./textosChegou";
import type { ResumoDoPronto } from "./gravarEntrada";

const brl = (n: number | null | undefined) =>
  n === null || n === undefined ? null : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  estreito: boolean;
  semCusto: boolean;
  numeroDaNota: string | null;
  resumo: ResumoDoPronto;
  fora: Array<{ nome: string; motivo: string }>;
  /** Parte não entrou: quantos itens entraram de quantos. */
  falha: { feitos: number; total: number } | null;
  onRepetir: () => void;
  onBaixar?: () => void;
};

export function Passo4Pronto({ estreito, semCusto, numeroDaNota, resumo, fora, falha, onRepetir, onBaixar }: Props) {
  if (falha) {
    const y = falha.total - falha.feitos;
    return (
      <View style={[s.caixa, s.caixaAmbar]} testID="chegou-falha-no-meio">
        <Icon name="alert" size={18} color={Colors.amber} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={s.titulo}>{T.falhaTitulo(falha.feitos, falha.total)}</Text>
          <Text style={s.texto}>{T.falhaTexto(falha.feitos, y)}</Text>
          <View style={s.acoes}>
            <Pressable onPress={onRepetir} style={s.btnPri} accessibilityRole="button" testID="chegou-falha-repetir">
              <Text style={s.btnPriTxt}>{T.falhaRepetir(y)}</Text>
            </Pressable>
            {onBaixar ? (
              <Pressable onPress={onBaixar} style={s.btnSec} accessibilityRole="button" testID="chegou-falha-baixar">
                <Text style={s.btnSecTxt}>{T.falhaBaixar(y)}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={s.apoio}>{T.falhaSemDobro(falha.feitos)}</Text>
        </View>
      </View>
    );
  }

  const total = semCusto ? null : brl(resumo.totalDaCompra);
  const sub = numeroDaNota ? T.prontoNota(numeroDaNota, resumo.fornecedor, total) : T.prontoSemNota(resumo.fornecedor, total);
  const motivoFora = fora.length === 1 ? T.prontoForaUm(fora[0].nome, fora[0].motivo) : fora.length > 1 ? T.prontoForaVarios(fora.length) : null;

  return (
    <View style={{ gap: 14 }} testID="chegou-pronto">
      <View style={[s.caixa, s.caixaVerde]}>
        <View style={s.selo}><Icon name="check" size={18} color="#fff" /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.titulo}>{estreito ? T.prontoTituloCelular : T.prontoTitulo}</Text>
          {sub ? <Text style={s.texto}>{sub}</Text> : null}
        </View>
      </View>

      {estreito ? (
        <View style={{ gap: 6 }}>
          <Text style={s.forte}>{T.prontoComEntradaCelular(resumo.comEntrada, resumo.jaTinha, resumo.cadastrados)}</Text>
          {resumo.fornecedor ? <Text style={s.texto}>{T.prontoLigadosCelular(resumo.fornecedor)}</Text> : null}
          {fora.length ? <Text style={s.texto}>{T.prontoForaCelular(fora.length)}</Text> : null}
        </View>
      ) : (
        <View style={s.tiles}>
          <View style={s.tile} testID="chegou-pronto-com-entrada">
            <Text style={s.numero}>{resumo.comEntrada}</Text>
            <Text style={s.forte}>{T.prontoComEntrada(resumo.comEntrada)}</Text>
            <Text style={s.apoio}>{T.prontoComEntradaDetalhe(resumo.jaTinha, resumo.cadastrados)}</Text>
          </View>
          <View style={s.tile} testID="chegou-pronto-cadastrados">
            <Text style={s.numero}>{resumo.cadastrados}</Text>
            <Text style={s.forte}>{T.prontoCadastrados(resumo.cadastrados)}</Text>
          </View>
          {resumo.fornecedor ? (
            <View style={s.tile} testID="chegou-pronto-ligados">
              <Text style={s.numero}>{resumo.comEntrada}</Text>
              <Text style={s.forte}>{T.prontoLigados(resumo.comEntrada, resumo.fornecedor, !semCusto)}</Text>
            </View>
          ) : null}
        </View>
      )}

      {motivoFora ? (
        <View style={[s.caixa, s.caixaAmbar]} testID="chegou-pronto-fora">
          <Icon name="alert_circle" size={16} color={Colors.amber} />
          <Text style={[s.texto, { flex: 1 }]}>{motivoFora}</Text>
        </View>
      ) : null}
      {resumo.cadastrados > 0 && !estreito ? <Text style={s.apoio}>{T.prontoNovosApoio(resumo.cadastrados)}</Text> : null}
    </View>
  );
}

// ── F2 · Pronto da lista sem quantidade (só ligar) ───────────
export function ProntoDaLista({ fornecedor, semCusto, jaTinha, cadastrados, naoAchados }: {
  fornecedor: string;
  semCusto: boolean;
  jaTinha: number;
  cadastrados: number;
  naoAchados: number;
}) {
  return (
    <View style={{ gap: 14 }} testID="chegou-pronto-lista">
      <View style={[s.caixa, s.caixaVerde]}>
        <View style={s.selo}><Icon name="check" size={18} color="#fff" /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={s.titulo}>{T.ligadosTitulo(fornecedor)}</Text>
          <Text style={s.texto}>{T.ligadosDetalhe(jaTinha, cadastrados)}</Text>
          <Text style={s.apoio}>{semCusto ? T.ligadosSemCusto : T.ligadosComCusto}</Text>
        </View>
      </View>
      {naoAchados > 0 ? (
        <View style={[s.caixa, s.caixaAmbar]} testID="chegou-pronto-lista-nao-achados">
          <Icon name="alert_circle" size={16} color={Colors.amber} />
          <Text style={[s.texto, { flex: 1 }]}>{T.ligadosNaoAchados(naoAchados)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  caixaVerde: { borderColor: Colors.green, backgroundColor: Colors.greenD },
  caixaAmbar: { borderColor: Colors.amber, backgroundColor: Colors.amberD },
  selo: { width: 34, height: 34, borderRadius: 999, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  texto: { fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  forte: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  apoio: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, minWidth: 200, flexBasis: 0, padding: 14, borderRadius: 12, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  numero: { fontSize: 26, fontWeight: "800", color: Colors.green },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  btnPri: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet },
  btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSec: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});
