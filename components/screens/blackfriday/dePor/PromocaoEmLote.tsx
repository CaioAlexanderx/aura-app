// ============================================================================
// AURA. — Página Black Friday · seção "Promoção em lote" (De/Por, p-86)
//
// Mockup aprovado pelo Caio (08/11/2026): https://claude.ai/artifact/UHRfmosodr9VCqHUt11Yhf
// Estados: sem promoção (convite), agendada, no ar e encerrada (com
// "Repetir"). "Encerrar agora" pede confirmação. Os cartões "vendidos na
// promoção" (p-93) entram no bloco "no ar" e na encerrada: VendidosNaPromocao.
// Quem decide se a seção aparece é a página (secoes.ts + usePromocoesDePor):
// backend sem a rota ou perfil Estoque só consulta = some.
// Multi-CNPJ: a promoção é por empresa; no consolidado a seção explica e
// pede para escolher a empresa.
// ============================================================================
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { WebPortal } from "@/components/WebPortal";
import { Aviso } from "@/components/screens/estoque/reajuste/Aviso";
import { promocoesApi, type ItemDaLista, type StatusPromocao } from "@/services/promocoesApi";
import type { PromocoesDePor } from "@/hooks/usePromocoesDePor";
import { CriarPromocaoModal, mensagemErroPromo } from "./CriarPromocaoModal";
import { VendidosNaPromocao } from "./VendidosNaPromocao";
import { alvoDoItem, nomeDoItemPromo, brl, chaveDoItem, diaMes, diaMesDe, pctTxt, plural, resumoDaLista, somarDias } from "./regrasDePor";

type Props = {
  companyId: string | undefined;
  consolidado: boolean;
  dados: PromocoesDePor;
};

var LIMITE = 20;

function Bloco({ status, lista, companyId, onMudou, onAdicionar }: {
  status: "ativa" | "agendada"; lista: ItemDaLista[]; companyId: string; onMudou: () => void; onAdicionar: () => void;
}) {
  var [confirma, setConfirma] = useState(false);
  var [ver, setVer] = useState(false);
  var [todos, setTodos] = useState(false);
  var [encerrando, setEncerrando] = useState<string | null>(null);
  var [confirmaItem, setConfirmaItem] = useState<string | null>(null);
  var [erro, setErro] = useState<string | null>(null);
  var r = resumoDaLista(lista);
  var ativa = status === "ativa";

  function encerrar(itens: ItemDaLista[], chave: string) {
    setEncerrando(chave);
    setErro(null);
    promocoesApi.encerrar(companyId, itens.map(alvoDoItem))
      .then(function () { setConfirma(false); setConfirmaItem(null); onMudou(); })
      .catch(function (e) { setErro(mensagemErroPromo(e)); })
      .finally(function () { setEncerrando(null); });
  }

  var mostrados = todos ? lista : lista.slice(0, LIMITE);

  return (
    <View style={s.bloco} testID={"promo-bloco-" + status}>
      <View style={s.blocoTopo}>
        <Text style={s.blocoTit}>{ativa ? "Promoção no ar" : "Promoção agendada"}</Text>
        <Text style={[s.badge, ativa ? s.badgeG : s.badgeA]}>{ativa ? "No ar" : "Agendada"}</Text>
      </View>
      <View style={s.kp}>
        <View style={s.kpBox}><Text style={s.kpN} testID={"promo-n-" + status}>{r.itens.toLocaleString("pt-BR")}</Text><Text style={s.t}>{r.itens === 1 ? "item em promoção" : "itens em promoção"}</Text></View>
        <View style={s.kpBox}><Text style={s.kpN}>{pctTxt(r.desconto)}</Text><Text style={s.t}>desconto médio</Text></View>
        {!ativa && r.ini && <View style={s.kpBox}><Text style={s.kpN}>{diaMes(r.ini)}</Text><Text style={s.t} testID="promo-comeca">{r.iniHora ? "começa às " + r.iniHora : "começa neste dia"}</Text></View>}
        {r.fim && <View style={s.kpBox}><Text style={s.kpN}>{diaMes(r.fim)}</Text><Text style={s.t}>{r.fimVaria ? "a última termina às 23h59" : "termina às 23h59"}</Text></View>}
        {r.fim && <View style={s.kpBox}><Text style={s.kpN}>{diaMes(somarDias(r.fim, 1))}</Text><Text style={s.t}>os preços voltam sozinhos</Text></View>}
      </View>

      {ativa && <VendidosNaPromocao companyId={companyId} lista={lista} status="ativa" />}

      {!!erro && <Aviso tipo="erro" testID={"promo-erro-encerrar-" + status}>{erro}</Aviso>}

      {confirma ? (
        <View style={s.conf} testID={"promo-confirmar-" + status}>
          <Text style={s.confTxt}><Text style={{ fontWeight: "700" }}>Encerrar agora?</Text> {plural(r.itens, "item volta", "itens voltam")} ao preço normal neste momento.</Text>
          <View style={s.acoes}>
            <Pressable style={s.btn} onPress={function () { setConfirma(false); }} testID={"promo-manter-" + status} accessibilityRole="button"><Text style={s.btnTxt}>Manter</Text></Pressable>
            <Pressable style={[s.btn, s.btnR]} onPress={function () { encerrar(lista, "todos"); }} disabled={!!encerrando}
              testID={"promo-encerrar-sim-" + status} accessibilityRole="button">
              {encerrando === "todos" ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={[s.btnTxt, { color: Colors.red }]}>Encerrar agora</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.acoes}>
          <Pressable style={s.btn} onPress={onAdicionar} testID={"promo-adicionar-" + status} accessibilityRole="button"><Text style={s.btnTxt}>Adicionar produtos</Text></Pressable>
          <Pressable style={s.btn} onPress={function () { setVer(!ver); }} testID={"promo-ver-" + status} accessibilityRole="button">
            <Text style={s.btnTxt}>{ver ? "Esconder os produtos" : "Ver os produtos"}</Text>
          </Pressable>
          <Pressable style={[s.btn, s.btnR]} onPress={function () { setConfirma(true); }} testID={"promo-encerrar-" + status} accessibilityRole="button">
            <Text style={[s.btnTxt, { color: Colors.red }]}>Encerrar agora</Text>
          </Pressable>
        </View>
      )}

      {ver && (
        <View style={s.lista} testID={"promo-lista-" + status}>
          {mostrados.map(function (i) {
            var k = chaveDoItem(i);
            return (
              <View key={k} style={s.linha} testID={"promo-linha-" + k}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nome} numberOfLines={2}>{nomeDoItemPromo(i)}</Text>
                  <Text style={s.t}>até {diaMesDe(i.ends_at)}</Text>
                </View>
                <View style={s.precos}>
                  <Text style={s.de}>{brl(i.preco_de)}</Text>
                  <Text style={s.por}>{brl(i.preco_por)}</Text>
                </View>
                {confirmaItem === k ? (
                  <Pressable style={s.btnMini} onPress={function () { encerrar([i], k); }} disabled={!!encerrando} testID={"promo-encerrar-item-sim-" + k} accessibilityRole="button">
                    {encerrando === k ? <ActivityIndicator size="small" color={Colors.red} /> : (
                      <Text style={[s.miniTxt, { color: Colors.red }]}>
                        {/* Alvo só com o produto encerra também as variantes dele (backend). */}
                        {!i.variant_id && lista.some(function (o) { return o.product_id === i.product_id && !!o.variant_id; }) ? "Confirmar (com as variantes)" : "Confirmar"}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable style={s.btnMini} onPress={function () { setConfirmaItem(k); }} testID={"promo-encerrar-item-" + k} accessibilityRole="button" accessibilityLabel={"Encerrar a promoção de " + nomeDoItemPromo(i)}>
                    <Text style={s.miniTxt}>Encerrar</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {lista.length > mostrados.length && (
            <Pressable style={s.mais} onPress={function () { setTodos(true); }} testID={"promo-mais-" + status}>
              <Text style={s.maisTxt}>Ver todos os {lista.length.toLocaleString("pt-BR")}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export function PromocaoEmLote({ companyId, consolidado, dados }: Props) {
  var [aberto, setAberto] = useState(false);
  var [repetir, setRepetir] = useState<string[] | undefined>(undefined);

  if (consolidado || !companyId) {
    return (
      <View testID="promo-consolidado">
        <Aviso tipo="info">A promoção é de cada empresa. Escolha uma empresa no seletor do topo para criar ou ver as promoções dela.</Aviso>
      </View>
    );
  }

  var temAlgo = dados.ativa.length > 0 || dados.agendada.length > 0;
  var fim = resumoDaLista(dados.encerrada);

  function abrir(ids?: string[]) { setRepetir(ids); setAberto(true); }

  return (
    <View style={{ gap: 12 }} testID="promo-secao">
      {!temAlgo && dados.encerrada.length === 0 && (
        <View style={s.vazio} testID="promo-vazio">
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.vazioTit}>Nenhuma promoção ligada</Text>
            <Text style={s.t}>Escolha os produtos, o desconto e até quando vale. Leva menos de um minuto.</Text>
          </View>
          <Pressable style={s.btnP} onPress={function () { abrir(); }} testID="promo-criar" accessibilityRole="button"><Text style={s.btnPTxt}>Criar promoção</Text></Pressable>
        </View>
      )}

      {dados.ativa.length > 0 && <Bloco status="ativa" lista={dados.ativa} companyId={companyId} onMudou={dados.recarregar} onAdicionar={function () { abrir(); }} />}
      {dados.agendada.length > 0 && <Bloco status="agendada" lista={dados.agendada} companyId={companyId} onMudou={dados.recarregar} onAdicionar={function () { abrir(); }} />}

      {!temAlgo && dados.encerrada.length > 0 && (
        <View style={s.vazio} testID="promo-encerrada">
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={s.vazioTit}>{fim.fim ? "Promoção encerrada em " + diaMes(fim.fim) : "Promoção encerrada"}</Text>
            <Text style={s.t}>{plural(fim.itens, "item voltou", "itens voltaram")} ao preço normal.</Text>
          </View>
          <Pressable style={s.btn} onPress={function () {
            var ids: string[] = [];
            dados.encerrada.forEach(function (i) { if (ids.indexOf(i.product_id) < 0) ids.push(i.product_id); });
            abrir(ids);
          }} testID="promo-repetir" accessibilityRole="button"><Text style={s.btnTxt}>Repetir promoção</Text></Pressable>
          <Pressable style={s.btnP} onPress={function () { abrir(); }} testID="promo-criar" accessibilityRole="button"><Text style={s.btnPTxt}>Criar promoção</Text></Pressable>
          <VendidosNaPromocao companyId={companyId} lista={dados.encerrada} status="encerrada" />
        </View>
      )}

      <WebPortal active={aberto}>
        <CriarPromocaoModal
          companyId={companyId}
          preSelecionados={repetir}
          onFechar={function () { setAberto(false); }}
          onAplicada={dados.recarregar}
        />
      </WebPortal>
    </View>
  );
}

var s = StyleSheet.create({
  t: { fontSize: 12.5, color: Colors.ink3 },
  vazio: {
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 12, padding: 16,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14,
  },
  vazioTit: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  bloco: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 14, padding: 14, gap: 12 },
  blocoTopo: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  blocoTit: { fontSize: 15, fontWeight: "700", color: Colors.ink, flexShrink: 1 },
  badge: { marginLeft: "auto" as any, fontSize: 11.5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
  badgeG: { backgroundColor: Colors.greenD, color: Colors.green },
  badgeA: { backgroundColor: Colors.amberD, color: Colors.amber },
  kp: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpBox: { flexGrow: 1, flexBasis: 140, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: Colors.bg2 },
  kpN: { fontSize: 19, fontWeight: "700", color: Colors.ink },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
    alignItems: "center", justifyContent: "center",
  },
  btnR: { borderColor: Colors.red },
  btnTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  btnP: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  conf: { borderRadius: 10, padding: 12, backgroundColor: Colors.redD, gap: 10 },
  confTxt: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  lista: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, overflow: "hidden" },
  linha: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 6, minHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: "wrap" },
  nome: { fontSize: 13.5, color: Colors.ink },
  precos: { alignItems: "flex-end" },
  de: { fontSize: 12, color: Colors.ink3, textDecorationLine: "line-through" },
  por: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  btnMini: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  miniTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "600" },
  mais: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  maisTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});

export default PromocaoEmLote;
