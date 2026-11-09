// ============================================================================
// AURA. — Página Black Friday · seção "Crediário para janeiro" (p-91)
//
// Mockup aprovado pelo Caio (09/11/2026): https://claude.ai/artifact/Ki6PMsQx9eywuchDrcKMnX
//
// À esquerda, o atalho: escolhe o dia (5, 10, 15, 20 ou 25) e abre o
// lançamento do crediário que já existe (CriarLancamentoModal) com a
// "Primeira parcela em" preenchida nesse dia de janeiro. Lança, não cobra.
// À direita, o que já está combinado: carnês, parcelas e valor EM ABERTO que
// vencem de 01 a 31/01 (a fonte são as parcelas, não o razão), e como se
// espalham pelas semanas. Sem nome de cliente.
//
// Em janeiro só o resumo aparece, sem o botão. No consolidado o resumo soma as
// empresas (com a tabela por empresa) e o botão pergunta para qual empresa
// lançar; empresa única no consolidado não pergunta.
// Quem decide se a seção aparece é a página (secoes.ts + useResumoVencimento).
// ============================================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import type { ResumoDoJaneiro } from "@/hooks/useResumoVencimento";
import type { EmpresaDoResumo } from "@/services/resumoVencimentoApi";
import {
  DIAS_DE_VENCIMENTO, DIA_PADRAO, barrasDasSemanas, brl, plural, primeiraParcelaNoDia,
  type FaseCrediarioJaneiro,
} from "./regrasCrediarioJaneiro";

type Props = {
  companyId: string | undefined;
  consolidado: boolean;
  fase: FaseCrediarioJaneiro;
  /** "AAAA-MM-DD" de hoje em Brasília. */
  hojeIso: string;
  resumo: ResumoDoJaneiro;
};

function nomeDaEmpresa(e: EmpresaDoResumo, i: number): string {
  return e.nome || "Empresa " + (i + 1);
}

function Atalho({ consolidado, hojeIso, empresas, companyId, onFechou }: {
  consolidado: boolean; hojeIso: string; empresas: EmpresaDoResumo[]; companyId: string | undefined; onFechou: () => void;
}) {
  var [dia, setDia] = useState(DIA_PADRAO);
  var [perguntando, setPerguntando] = useState(false);
  // undefined = fechado; null = a empresa ativa; string = a empresa escolhida.
  var [abertoPara, setAbertoPara] = useState<string | null | undefined>(undefined);
  var primeira = primeiraParcelaNoDia(hojeIso, dia);

  function lancar() {
    if (!consolidado) { setAbertoPara(null); return; }
    if (empresas.length === 1) { setAbertoPara(empresas[0].company_id); return; }
    setPerguntando(true);
  }

  function fechar() {
    setAbertoPara(undefined);
    onFechou();
  }

  return (
    <View style={s.box} testID="crediario-jan-atalho">
      <Text style={s.boxTit}>Lançar com a 1ª parcela em janeiro</Text>
      <Text style={s.t}>Escolha o dia do vencimento. O lançamento abre com o cliente e o valor por preencher.</Text>

      <View style={s.dias} accessibilityRole="radiogroup" accessibilityLabel="Dia do vencimento">
        {DIAS_DE_VENCIMENTO.map(function (d) {
          var ativo = d === dia;
          return (
            <Pressable
              key={d}
              style={[s.dia, ativo && s.diaAtivo]}
              onPress={function () { setDia(d); }}
              testID={"crediario-jan-dia-" + d}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo, checked: ativo }}
              accessibilityLabel={"Dia " + d}
            >
              <Text style={[s.diaTxt, ativo && s.diaTxtAtivo]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      {perguntando ? (
        <View style={s.pergunta} testID="crediario-jan-escolher-empresa">
          <Text style={s.perguntaTit}>Para qual empresa é o lançamento?</Text>
          {empresas.map(function (e, i) {
            return (
              <Pressable
                key={e.company_id}
                style={s.empresaBtn}
                onPress={function () { setPerguntando(false); setAbertoPara(e.company_id); }}
                testID={"crediario-jan-empresa-" + e.company_id}
                accessibilityRole="button"
              >
                <Text style={s.empresaTxt} numberOfLines={1}>{nomeDaEmpresa(e, i)}</Text>
              </Pressable>
            );
          })}
          <Pressable style={s.voltar} onPress={function () { setPerguntando(false); }} testID="crediario-jan-empresa-cancelar" accessibilityRole="button">
            <Text style={s.voltarTxt}>Voltar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={s.cta} onPress={lancar} testID="crediario-jan-lancar" accessibilityRole="button">
          <Text style={s.ctaTxt}>Lançar crediário</Text>
          <Text style={s.ctaSub}>1ª parcela em {primeira}</Text>
        </Pressable>
      )}

      <Text style={s.hint}>
        {consolidado && empresas.length > 1
          ? "Antes de abrir, o app pergunta para qual empresa lançar."
          : "Pode mudar a data no próprio lançamento."}
      </Text>

      {abertoPara !== undefined && (
        <CriarLancamentoModal
          visible
          onClose={fechar}
          companyId={abertoPara || companyId}
          primeiraParcela={primeira}
        />
      )}
    </View>
  );
}

function Resumo({ resumo, consolidado }: { resumo: ResumoDoJaneiro; consolidado: boolean }) {
  var { m } = useValoresOcultos();
  var d = resumo.dados!;
  var ano = d.periodo.ate.slice(0, 4);
  var vazio = d.parcelas === 0;
  var barras = barrasDasSemanas(d.por_semana, d.periodo);
  var nEmpresas = d.company_count != null ? d.company_count : d.empresas.length;

  return (
    <View style={s.box} testID="crediario-jan-resumo">
      <Text style={s.boxTit}>Já combinado para janeiro</Text>
      {vazio ? (
        <Text style={s.t} testID="crediario-jan-vazio">
          Nenhuma parcela em aberto vence em janeiro{consolidado ? " em nenhuma das empresas" : ""}. Quando você lançar um crediário com a primeira parcela em janeiro, ele aparece aqui.
        </Text>
      ) : (
        <>
          <Text style={s.t} testID="crediario-jan-legenda">
            Parcelas em aberto que vencem de 01 a 31/01/{ano}{consolidado && nEmpresas > 1 ? ", somando as " + nEmpresas + " empresas" : ""}.
          </Text>
          <View style={s.kpis}>
            <View style={s.kpi}><Text style={s.kpiN} testID="crediario-jan-carnes">{d.carnes.toLocaleString("pt-BR")}</Text><Text style={s.t}>{d.carnes === 1 ? "carnê" : "carnês"}</Text></View>
            <View style={s.kpi}><Text style={s.kpiN} testID="crediario-jan-parcelas">{d.parcelas.toLocaleString("pt-BR")}</Text><Text style={s.t}>{d.parcelas === 1 ? "parcela" : "parcelas"}</Text></View>
            <View style={s.kpi}><Text style={s.kpiN} testID="crediario-jan-valor">{m(brl(d.valor))}</Text><Text style={s.t}>a receber</Text></View>
          </View>
          {barras.length > 0 && (
            <View testID="crediario-jan-semanas">
              <View style={s.barras}>
                {barras.map(function (b) {
                  return (
                    <View
                      key={b.rotulo}
                      style={s.barraCol}
                      accessibilityLabel={"Semana de " + b.rotulo + ": " + plural(b.parcelas, "parcela", "parcelas")}
                    >
                      <View style={[s.barra, { height: (b.altura * 0.72) }]} />
                    </View>
                  );
                })}
              </View>
              <View style={s.eixo}>
                {barras.map(function (b) { return <Text key={b.rotulo} style={s.eixoTxt}>{b.rotulo}</Text>; })}
              </View>
              <Text style={s.eixoNota}>Por semana, a partir de segunda-feira.</Text>
            </View>
          )}
          {consolidado && d.empresas.length > 1 && (
            <View style={s.tab} testID="crediario-jan-empresas">
              <View style={s.tabLinha}>
                <Text style={[s.tabCab, { flex: 1 }]}>Empresa</Text>
                <Text style={[s.tabCab, s.tabNum]}>Parcelas</Text>
                <Text style={[s.tabCab, s.tabValor]}>Valor</Text>
              </View>
              {d.empresas.map(function (e, i) {
                return (
                  <View key={e.company_id} style={[s.tabLinha, s.tabLinhaBorda]} testID={"crediario-jan-linha-" + e.company_id}>
                    <Text style={[s.tabTxt, { flex: 1 }]} numberOfLines={1}>{nomeDaEmpresa(e, i)}</Text>
                    <Text style={[s.tabTxt, s.tabNum]}>{e.parcelas.toLocaleString("pt-BR")}</Text>
                    <Text style={[s.tabTxt, s.tabValor]}>{m(brl(e.valor))}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function CrediarioParaJaneiro({ companyId, consolidado, fase, hojeIso, resumo }: Props) {
  if (!resumo.dados) return null;
  var comAtalho = fase === "atalho";
  return (
    <View style={s.grade} testID="crediario-jan-secao">
      {comAtalho && (
        <Atalho
          consolidado={consolidado}
          hojeIso={hojeIso}
          empresas={resumo.dados.empresas}
          companyId={companyId}
          onFechou={resumo.recarregar}
        />
      )}
      <Resumo resumo={resumo} consolidado={consolidado} />
    </View>
  );
}

var s = StyleSheet.create({
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  box: {
    flexGrow: 1, flexBasis: 280, minWidth: 0,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, backgroundColor: Colors.bg4,
  },
  boxTit: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  t: { fontSize: 13, color: Colors.ink3, lineHeight: 19 },
  dias: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  dia: {
    minWidth: 52, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center", paddingHorizontal: 10,
  },
  diaAtivo: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  diaTxt: { fontSize: 14, fontWeight: "600", color: Colors.ink2 },
  diaTxtAtivo: { color: Colors.ink },
  cta: {
    minHeight: 48, borderRadius: 12, backgroundColor: Colors.violet, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 8,
  },
  ctaTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  ctaSub: { fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.85)" },
  hint: { fontSize: 12, color: Colors.ink3, marginTop: 8 },
  pergunta: { gap: 8 },
  perguntaTit: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  empresaBtn: {
    minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
    paddingHorizontal: 14, justifyContent: "center",
  },
  empresaTxt: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  voltar: { alignSelf: "flex-start", paddingVertical: 6 },
  voltarTxt: { fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  kpis: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 12 },
  kpi: { flex: 1, minWidth: 0 },
  kpiN: { fontSize: 22, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4 },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 72, marginTop: 6 },
  barraCol: { flex: 1, height: 72, justifyContent: "flex-end" },
  barra: { backgroundColor: Colors.violet, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 3, opacity: 0.9 },
  eixo: { flexDirection: "row", gap: 5, marginTop: 4 },
  eixoTxt: { flex: 1, fontSize: 11, color: Colors.ink3, textAlign: "center" },
  eixoNota: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  tab: { marginTop: 12 },
  tabLinha: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 8 },
  tabLinhaBorda: { borderTopWidth: 1, borderTopColor: Colors.border },
  tabCab: { fontSize: 11, fontWeight: "600", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  tabTxt: { fontSize: 13, color: Colors.ink2 },
  tabNum: { width: 72, textAlign: "right" },
  tabValor: { width: 110, textAlign: "right" },
});
