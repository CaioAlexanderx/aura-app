// ============================================================
// AURA. — Matcon M3: a calculadora de ambiente do carrinho
//
// 22/09/2026 — docs/matcon-faseamento-po-ux.md §4b e mockup
// docs/mockups/matcon-m3-clube-calculadora.html (#calculadora, .sheet/.amb/.res).
//
// O momento "olha isso" do M3: o vendedor toca em "calcular ambiente" no
// piso, digita 3,5 × 4,2 e a folha devolve as caixas. Não é tela nova nem
// aba de conversão — é o MESMO conteúdo dentro do ResponsiveSheet: folha
// que sobe no celular, balão centralizado no computador.
//
// Decisões que o mockup fixou e que o código respeita:
//   · Ambiente é uma LINHA em português ("Sala 3,5 × 4,2 m = 14,70 m²"),
//     não um formulário com "largura"/"comprimento" empilhados — o vendedor
//     lê em voz alta enquanto digita.
//   · A perda é a frase da config (matcon_default_waste_pct), já preenchida
//     e editável só para esta venda.
//   · Dois botões porque são duas conversas de balcão: "me vê o que dá o
//     ambiente" (15,88 m²) e "me vê só caixa fechada" (16,24 m²).
//   · A folha não guarda nada: um número entra no carrinho e ela fecha.
//     Quem arredonda e mostra a sobra na linha do item continua sendo o M0.
//
// Sem hover-reveal (regra 7 do CLAUDE.md): "remover" e "+ ambiente" são
// botões sempre visíveis, tocáveis no celular.
//
// QA 23/09/2026 (Matcon, produção, computador):
//   · No computador o balão tem ALTURA FIXA. Antes ele se recentralizava a
//     cada linha que o resultado ganhava e o botão "Usar…" fugia do mouse.
//     Agora o que cresce rola por dentro; cabeçalho e botões não se mexem.
//     No celular a folha já é ancorada embaixo — os botões nunca pulam.
//   · "considero [10] % de perda" fica numa linha só: o campo tem largura
//     fixa (o <input> do navegador tinha ~170px de largura natural e
//     empurrava a frase para baixo) e só o fim da frase pode descer.
//   · Cada opção diz quanto custa ("18,56 m² · R$ 1.202,69"), no preço que
//     o carrinho está usando — e, com o preço no cartão ligado, o do outro
//     método também, igual à linha do item.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet, SHEET_NARROW_BP } from "@/components/ResponsiveSheet";
import { parseQtyInput } from "@/utils/matconUnits";
import {
  resultadoCalculadora,
  areaDoAmbiente,
  fmtArea,
  rotuloEmbalagem,
  fraseDoValor,
} from "./calculadoraUtil";

/** Altura do balão no computador. Cabem três ambientes sem rolar; a partir
 *  daí rola por dentro — o balão não cresce e os botões não saem do lugar. */
export const ALTURA_DA_CALCULADORA = 600;

// Nomes sugeridos na ordem em que a obra acontece. São SUGESTÕES: o campo
// é editável (tem cliente que chama de "varanda", "edícula", "loja").
const NOMES_SUGERIDOS = ["Sala", "Cozinha", "Quarto", "Banheiro", "Área"];

function nomeSugerido(index: number): string {
  return NOMES_SUGERIDOS[index] || "Ambiente " + (index + 1);
}

type LinhaAmbiente = { id: number; nome: string; largura: string; comprimento: string };

function novaLinha(id: number, index: number): LinhaAmbiente {
  return { id: id, nome: nomeSugerido(index), largura: "", comprimento: "" };
}

/** Perda aceita "8", "8,5" e vazio (= 0). Acima de 100% não existe obra:
 *  trava em 100 para a conta não virar ficção. */
function parsePerdaInput(raw: string): number {
  var s = String(raw || "").trim().replace(",", ".");
  if (!s) return 0;
  var n = parseFloat(s);
  if (!isFinite(n) || n < 0) return 0;
  return n > 100 ? 100 : n;
}

export type CalculadoraAmbienteProps = {
  visible: boolean;
  onClose: () => void;
  /** Nome do produto, no subtítulo ("Porcelanato Bianco 60×60 · caixa com 2,32 m²"). */
  productName: string;
  /** Unidade de venda do produto — na prática "m²". */
  unit: string;
  /** Como a loja compra ("cx", "pct"). Sem isso, a folha fala "caixa". */
  purchaseUnitLabel?: string | null;
  /** Quantos m² vêm em uma embalagem (2,32). Sem fator, some o segundo botão. */
  purchaseFactor?: number | null;
  /** Perda padrão da config (matcon_default_waste_pct). */
  defaultWastePct: number;
  /** Devolve a quantidade ao carrinho. A folha fecha em seguida. */
  onUse: (qty: number) => void;
  /** Preço por unidade de venda (por m²) que o carrinho está usando — o do
   *  chip escolhido. Sem ele as opções não mostram valor. */
  unitPrice?: number | null;
  /** Preço no cartão: o preço no OUTRO método e o nome dele ("cartão" /
   *  "dinheiro"), como a linha do item mostra. */
  otherUnitPrice?: number | null;
  otherLabel?: string;
};

export function CalculadoraAmbiente({
  visible,
  onClose,
  productName,
  unit,
  purchaseUnitLabel,
  purchaseFactor,
  defaultWastePct,
  onUse,
  unitPrice,
  otherUnitPrice,
  otherLabel,
}: CalculadoraAmbienteProps) {
  const { width: larguraJanela, height: alturaJanela } = useWindowDimensions();
  // Balão centralizado (computador): altura travada. O teto é o mesmo do
  // ResponsiveSheet (92% da janela), para caber em notebook de 720p.
  const noComputador = larguraJanela >= SHEET_NARROW_BP;
  const alturaFixa = noComputador ? Math.min(ALTURA_DA_CALCULADORA, Math.round(alturaJanela * 0.92)) : null;
  const [linhas, setLinhas] = useState<LinhaAmbiente[]>([novaLinha(1, 0)]);
  const [perdaBuf, setPerdaBuf] = useState<string>(String(defaultWastePct ?? 0));
  const proximoId = React.useRef(2);

  // Cada abertura começa limpa: a folha não guarda ambiente de venda
  // anterior (decisão do mockup — "não vira cadastro de obra").
  useEffect(() => {
    if (!visible) return;
    proximoId.current = 2;
    setLinhas([novaLinha(1, 0)]);
    setPerdaBuf(String(defaultWastePct ?? 0));
  }, [visible, defaultWastePct]);

  const perdaPct = parsePerdaInput(perdaBuf);

  const ambientes = useMemo(
    () =>
      linhas.map(l => ({
        nome: l.nome,
        largura: parseQtyInput(l.largura),
        comprimento: parseQtyInput(l.comprimento),
      })),
    [linhas]
  );

  const res = useMemo(
    () => resultadoCalculadora({ ambientes: ambientes, perdaPct: perdaPct, purchaseFactor: purchaseFactor }),
    [ambientes, perdaPct, purchaseFactor]
  );

  const temResultado = res.areaComPerda > 0;
  const temCaixas = res.caixas != null && res.caixas > 0 && res.areaCaixasFechadas != null;

  function setCampo(id: number, campo: "nome" | "largura" | "comprimento", valor: string) {
    setLinhas(atuais => atuais.map(l => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function addAmbiente() {
    setLinhas(atuais => {
      const id = proximoId.current++;
      return atuais.concat([novaLinha(id, atuais.length)]);
    });
  }

  function removerAmbiente(id: number) {
    setLinhas(atuais => (atuais.length <= 1 ? atuais : atuais.filter(l => l.id !== id)));
  }

  function usar(qty: number | null | undefined) {
    const n = Number(qty);
    if (!isFinite(n) || n <= 0) return;
    onUse(n);
    onClose();
  }

  // "Porcelanato Bianco 60×60 · caixa com 2,32 m²" — a segunda metade só
  // existe quando a loja cadastrou o fator de compra.
  const embalagemLabel = (purchaseUnitLabel || "").trim() || "caixa";
  const subtitulo =
    purchaseFactor && purchaseFactor > 0
      ? productName + " · " + embalagemLabel + " com " + fmtArea(purchaseFactor, unit)
      : productName;

  // Quanto sai cada opção, no preço do carrinho (e no outro método, com o
  // preço no cartão ligado). "" sem preço: a linha de valor some.
  const precos = { precoUnitario: unitPrice, outroPrecoUnitario: otherUnitPrice, outroRotulo: otherLabel };
  const valorArea = temResultado ? fraseDoValor({ qty: res.areaComPerda, ...precos }) : "";
  const valorCaixas = temCaixas ? fraseDoValor({ qty: res.areaCaixasFechadas, ...precos }) : "";
  const detalheCaixas = temCaixas
    ? fmtArea(res.areaCaixasFechadas as number, unit) + (valorCaixas ? " · " + valorCaixas : "")
    : "";

  return (
    <ResponsiveSheet
      visible={visible}
      onClose={onClose}
      maxWidth={420}
      sheetStyle={alturaFixa != null ? { backgroundColor: Colors.bg2, height: alturaFixa } : { backgroundColor: Colors.bg2 }}
    >
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.titulo} testID="matcon-calc-titulo">Calcular ambiente</Text>
          <Text style={s.lede} numberOfLines={2}>{subtitulo}</Text>
        </View>
        <Pressable testID="matcon-calc-fechar" onPress={onClose} style={s.fechar} accessibilityLabel="Fechar">
          <Icon name="x" size={14} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView
        testID="matcon-calc-corpo"
        style={alturaFixa != null ? [s.body, s.bodyFixo] : s.body}
        contentContainerStyle={{ paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        {linhas.map((l, i) => {
          const area = areaDoAmbiente(parseQtyInput(l.largura), parseQtyInput(l.comprimento));
          return (
            <View key={l.id} style={s.amb} testID={"matcon-calc-ambiente-" + i}>
              {/* QA 22/09/2026: rótulo + 2 campos + "×"/"m" nunca quebram
                  entre si — só o resultado ("= 14,00 m²") cai pra linha de
                  baixo quando não cabe. Por isso o grupo fica isolado num
                  nowrap; o wrap continua só no .amb de fora. */}
              <View style={s.ambCore}>
                <TextInput
                  testID={"matcon-calc-nome-" + i}
                  style={s.ambNome}
                  value={l.nome}
                  onChangeText={v => setCampo(l.id, "nome", v)}
                  placeholder={nomeSugerido(i)}
                  placeholderTextColor={Colors.ink3}
                  maxLength={18}
                />
                <TextInput
                  testID={"matcon-calc-largura-" + i}
                  style={s.ambCampo}
                  value={l.largura}
                  onChangeText={v => setCampo(l.id, "largura", v.replace(/[^\d.,]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Colors.ink3}
                  maxLength={7}
                  selectTextOnFocus
                />
                <Text style={s.ambX}>×</Text>
                <TextInput
                  testID={"matcon-calc-comprimento-" + i}
                  style={s.ambCampo}
                  value={l.comprimento}
                  onChangeText={v => setCampo(l.id, "comprimento", v.replace(/[^\d.,]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={Colors.ink3}
                  maxLength={7}
                  selectTextOnFocus
                />
                <Text style={s.ambM}>m</Text>
              </View>
              {area > 0 ? (
                <Text style={s.ambEq} testID={"matcon-calc-area-" + i}>= {fmtArea(area, unit)}</Text>
              ) : null}
              {i > 0 ? (
                <Pressable
                  testID={"matcon-calc-remover-" + i}
                  onPress={() => removerAmbiente(l.id)}
                  style={s.ambRm}
                  accessibilityLabel={"Remover " + (l.nome || nomeSugerido(i))}
                >
                  <Text style={s.ambRmTxt}>remover</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <View style={s.addRow}>
          <Pressable testID="matcon-calc-add" onPress={addAmbiente} style={s.addChip} accessibilityLabel="Adicionar ambiente">
            <Text style={s.addChipTxt}>+ ambiente</Text>
          </Pressable>
          {res.areaSomada > 0 ? (
            <Text style={s.somados} testID="matcon-calc-somados">{fmtArea(res.areaSomada, unit)} somados</Text>
          ) : null}
        </View>

        {/* A frase da config, do jeito que a config escreve. QA 23/09/2026:
            "considero [10] % de perda" nunca quebra (grupo nowrap, campo de
            largura fixa); só "por quebra e recorte." desce quando falta
            espaço — o mesmo arranjo da linha do ambiente. */}
        <View style={s.frase}>
          <View style={s.fraseCore} testID="matcon-calc-perda-linha">
            <Text style={s.fraseTxt}>considero </Text>
            <TextInput
              testID="matcon-calc-perda"
              style={s.fraseEdit}
              value={perdaBuf}
              onChangeText={v => setPerdaBuf(v.replace(/[^\d,.]/g, ""))}
              keyboardType="decimal-pad"
              maxLength={5}
              selectTextOnFocus
              accessibilityLabel="Perda por quebra e recorte, em porcento"
            />
            <Text style={s.fraseTxt}> % de perda</Text>
          </View>
          <Text style={s.fraseTxt}> por quebra e recorte.</Text>
        </View>

        {/* O resultado grande — é o que o vendedor mostra pro cliente. */}
        <View style={s.res}>
          <View style={s.resLinha}>
            <Text style={s.resN} testID="matcon-calc-resultado">
              {temResultado ? fmtArea(res.areaComPerda, unit) : "—"}
            </Text>
            {temCaixas ? (
              <>
                <Text style={s.resSeta}>→</Text>
                <Text style={s.resCx} testID="matcon-calc-caixas">{rotuloEmbalagem(res.caixas as number, purchaseUnitLabel)}</Text>
              </>
            ) : null}
          </View>
          {temCaixas ? (
            <Text style={s.resD} testID="matcon-calc-detalhe">
              {rotuloEmbalagem(res.caixas as number, purchaseUnitLabel)} fechadas dão {fmtArea(res.areaCaixasFechadas as number, unit)}
              {res.sobra != null && res.sobra > 0 ? " · sobra " + fmtArea(res.sobra, unit) : ""}
            </Text>
          ) : (
            <Text style={s.resD}>
              {temResultado
                ? "com " + perdaPct.toLocaleString("pt-BR") + "% de perda sobre " + fmtArea(res.areaSomada, unit)
                : "digite largura e comprimento do ambiente"}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={s.foot}>
        <Pressable
          testID="matcon-calc-usar-area"
          onPress={() => usar(res.areaComPerda)}
          disabled={!temResultado}
          style={[s.btn, s.btnPrimary, !temResultado && s.btnOff]}
          accessibilityLabel={"Usar " + fmtArea(res.areaComPerda, unit) + (valorArea ? ", " + valorArea : "")}
        >
          <Text style={s.btnPrimaryTxt}>Usar {fmtArea(res.areaComPerda, unit)}</Text>
          {valorArea ? (
            <Text style={s.btnPrimarySub} testID="matcon-calc-valor-area" numberOfLines={1}>{valorArea}</Text>
          ) : null}
        </Pressable>
        {temCaixas ? (
          <Pressable
            testID="matcon-calc-usar-caixas"
            onPress={() => usar(res.areaCaixasFechadas)}
            style={[s.btn, s.btnGhost]}
            accessibilityLabel={"Usar " + rotuloEmbalagem(res.caixas as number, purchaseUnitLabel) + " fechadas, " + detalheCaixas}
          >
            <Text style={s.btnGhostTxt}>Usar {rotuloEmbalagem(res.caixas as number, purchaseUnitLabel)} fechadas</Text>
            <Text style={s.btnGhostSub} testID="matcon-calc-valor-caixas" numberOfLines={1}>{detalheCaixas}</Text>
          </Pressable>
        ) : null}
      </View>
    </ResponsiveSheet>
  );
}

const MONO = Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace";

const s = StyleSheet.create({
  head: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  titulo: { fontSize: 20, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  lede: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  fechar: {
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },

  body: { flexGrow: 0, flexShrink: 1, paddingHorizontal: 16 },
  // Balão de altura fixa: o corpo ocupa o que sobra e o rodapé fica colado
  // embaixo, sempre no mesmo lugar.
  bodyFixo: { flexGrow: 1, flexBasis: 0, minHeight: 0 },

  // .amb do mockup: uma linha em português. QA 22/09/2026 — em 390px o
  // rótulo e os dois campos nunca podem quebrar entre si (formulário
  // ilegível); só o resultado ("= 14,00 m²") cai pra linha de baixo
  // quando falta espaço. Por isso o grupo nowrap (ambCore) é um único
  // item do flex-wrap de fora.
  amb: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  ambCore: {
    flexDirection: "row", alignItems: "center", flexWrap: "nowrap", gap: 6,
    flexShrink: 0,
  },
  ambNome: {
    fontSize: 14, fontWeight: "600", color: Colors.ink,
    width: 70, flexShrink: 0, paddingVertical: 0,
  },
  // ≈64px cada (QA): cabem "12,50" com sobra, e os dois nunca disputam
  // espaço com o rótulo ou entre si.
  ambCampo: {
    fontFamily: MONO, fontSize: 13, fontWeight: "600", color: Colors.ink,
    width: 64, flexShrink: 0, textAlign: "center",
    paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: Colors.bg3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border2,
    borderBottomWidth: 2, borderBottomColor: Colors.violet,
  },
  ambX: { fontSize: 13, color: Colors.ink2, flexShrink: 0 },
  ambM: { fontSize: 13, color: Colors.ink2, flexShrink: 0 },
  ambEq: {
    fontFamily: MONO, fontSize: 12, color: Colors.violet3,
    marginLeft: "auto" as any, flexShrink: 0,
  },
  ambRm: { paddingVertical: 2, paddingHorizontal: 4, flexShrink: 0 },
  ambRmTxt: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },

  addRow: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addChip: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  addChipTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  somados: { fontFamily: MONO, fontSize: 12, color: Colors.violet3, marginLeft: "auto" as any },

  frase: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    paddingTop: 8, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  fraseCore: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 },
  fraseTxt: { fontSize: 14, color: Colors.ink2, lineHeight: 26, flexShrink: 0 },
  // Largura FIXA: sem ela o <input> do navegador fica com a largura
  // natural (~20 caracteres) e a frase quebra no meio. 52px cabem "12,5".
  fraseEdit: {
    fontFamily: MONO, fontSize: 13, fontWeight: "600", color: Colors.ink,
    width: 52, flexShrink: 0, textAlign: "center",
    paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 2,
    backgroundColor: Colors.bg3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border2,
    borderBottomWidth: 2, borderBottomColor: Colors.violet,
  },

  // .res do mockup: o número grande, a seta e as caixas.
  res: {
    marginTop: 10, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.violet, backgroundColor: Colors.violetD,
  },
  resLinha: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 10 },
  resN: { fontSize: 28, fontWeight: "700", color: Colors.ink, letterSpacing: -0.5 },
  resSeta: { fontSize: 18, color: Colors.ink3 },
  resCx: { fontSize: 28, fontWeight: "700", color: Colors.violet3, letterSpacing: -0.5 },
  resD: { fontFamily: MONO, fontSize: 11.5, color: Colors.ink2, marginTop: 8 },

  foot: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 },
  btn: {
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2,
  },
  btnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnPrimaryTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnPrimarySub: { fontFamily: MONO, fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)", marginTop: 2 },
  btnGhost: { backgroundColor: Colors.bg3 },
  btnGhostTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  btnGhostSub: { fontFamily: MONO, fontSize: 12, fontWeight: "600", color: Colors.ink2, marginTop: 2 },
  btnOff: { opacity: 0.45 },
});

export default CalculadoraAmbiente;
