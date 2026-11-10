// ============================================================================
// AURA. — Estoque · Por loja (consolidado, 10/11/2026)
//
// Na visão de todas as lojas: o mesmo produto numa linha, com quanto tem em
// cada loja e o total. GET /me/estoque/por-loja (só as lojas que o usuário
// acessa; o backend filtra). Produto com grade abre o detalhe por variante:
// GET /me/estoque/por-loja/variantes?chave= (rótulo × lojas).
//
// Largo (≥ 768 px): tabela com uma coluna por loja (rolagem lateral quando
// são muitas). Estreito (375 px): cartões com chips "Loja A: 12 · Loja B: 3".
// Sem hover-reveal: tudo visível, toque abre o detalhe. Só leitura.
// ============================================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { Pagination } from "@/components/Pagination";
import { WebPortal } from "@/components/WebPortal";
import {
  estoqueTransferenciasApi, type ItemPorLoja, type LojaDoGrupo, type RespostaPorLoja, type RespostaVariantesPorLoja,
} from "@/services/estoqueTransferenciasApi";
import { fmtQty } from "@/utils/matconUnits";

var IS_WEB = Platform.OS === "web";
export var POR_PAGINA_POR_LOJA = 30;
export var LARGURA_TABELA = 768;

function qtd(n: number | null | undefined): string {
  return n == null ? "—" : fmtQty(Number(n) || 0);
}

function estoqueNa(porLoja: Array<{ company_id: string; estoque: number | null }>, lojaId: string): number | null {
  var x = porLoja.find(function (p) { return p.company_id === lojaId; });
  return x ? x.estoque : null;
}

/** "Loja A: 12 · Loja B: 3" (chips no estreito). */
export function chipsDasLojas(lojas: LojaDoGrupo[], porLoja: Array<{ company_id: string; estoque: number | null }>): string[] {
  return lojas.map(function (l) { return l.nome + ": " + qtd(estoqueNa(porLoja, l.id)); });
}

export function EstoquePorLoja() {
  var largura = useWindowDimensions().width;
  var largo = largura >= LARGURA_TABELA;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  var [busca, setBusca] = useState("");
  var [q, setQ] = useState("");
  var [pagina, setPagina] = useState(1);
  var [dados, setDados] = useState<RespostaPorLoja | null>(null);
  var [carregando, setCarregando] = useState(true);
  var [erro, setErro] = useState<string | null>(null);
  var [tentativa, setTentativa] = useState(0);
  var [aberto, setAberto] = useState<ItemPorLoja | null>(null);

  // Busca espera a pessoa parar de digitar.
  useEffect(function () {
    var t = setTimeout(function () { setQ(busca.trim()); setPagina(1); }, 350);
    return function () { clearTimeout(t); };
  }, [busca]);

  useEffect(function () {
    setCarregando(true);
    setErro(null);
    estoqueTransferenciasApi.porLoja({ q: q || undefined, limit: POR_PAGINA_POR_LOJA, offset: (pagina - 1) * POR_PAGINA_POR_LOJA })
      .then(function (r) { if (vivo.current) setDados(r); })
      .catch(function (e: any) {
        if (!vivo.current) return;
        setErro(e && e.status === 404
          ? "O estoque por loja ainda não está disponível. Tente de novo mais tarde."
          : "Não conseguimos carregar o estoque por loja agora.");
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }, [q, pagina, tentativa]);

  var lojas = (dados && dados.lojas) || [];
  var itens = (dados && dados.itens) || [];
  var total = (dados && dados.total_itens) || 0;
  var totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_POR_LOJA));

  function tabela() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: "100%" as any }}>
        <View style={{ flex: 1, minWidth: 320 + lojas.length * 110 }} testID="por-loja-tabela">
          <View style={[s.tr, s.thead]}>
            <Text style={[s.th, s.colNome]}>Produto</Text>
            {lojas.map(function (l) { return <Text key={l.id} style={[s.th, s.colLoja]} numberOfLines={2} testID={"por-loja-col-" + l.id}>{l.nome}</Text>; })}
            <Text style={[s.th, s.colLoja, { color: Colors.ink }]}>Total</Text>
          </View>
          {itens.map(function (it) {
            return (
              <View key={it.chave} style={s.tr} testID={"por-loja-linha-" + it.chave}>
                <View style={s.colNome}>
                  <Text style={s.nome} numberOfLines={2}>{it.nome}</Text>
                  <Text style={s.sub} numberOfLines={1}>{it.sku || it.barcode || "Sem código"}</Text>
                  {it.tem_variantes && (
                    <Pressable onPress={function () { setAberto(it); }} style={s.verGrade} accessibilityRole="button" testID={"por-loja-variantes-" + it.chave}>
                      <Text style={s.verGradeTxt}>Ver tamanhos e cores</Text>
                    </Pressable>
                  )}
                </View>
                {lojas.map(function (l) {
                  var n = estoqueNa(it.por_loja, l.id);
                  return <Text key={l.id} style={[s.td, s.colLoja, n == null && { color: Colors.ink3 }]} testID={"por-loja-celula-" + it.chave + "-" + l.id}>{qtd(n)}</Text>;
                })}
                <Text style={[s.td, s.colLoja, s.total]} testID={"por-loja-total-" + it.chave}>{qtd(it.total)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  function cartoes() {
    return (
      <View style={{ gap: 8 }} testID="por-loja-cartoes">
        {itens.map(function (it) {
          return (
            <View key={it.chave} style={s.card} testID={"por-loja-cartao-" + it.chave}>
              <View style={s.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nome} numberOfLines={2}>{it.nome}</Text>
                  <Text style={s.sub} numberOfLines={1}>{it.sku || it.barcode || "Sem código"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.cardTotal} testID={"por-loja-total-" + it.chave}>{qtd(it.total)}</Text>
                  <Text style={s.cardTotalLbl}>TOTAL</Text>
                </View>
              </View>
              <View style={s.chips}>
                {chipsDasLojas(lojas, it.por_loja).map(function (c, i) {
                  return <View key={i} style={s.chip}><Text style={s.chipTxt} testID={"por-loja-chip-" + it.chave + "-" + i}>{c}</Text></View>;
                })}
              </View>
              {it.tem_variantes && (
                <Pressable onPress={function () { setAberto(it); }} style={s.verGrade} accessibilityRole="button" testID={"por-loja-variantes-" + it.chave}>
                  <Text style={s.verGradeTxt}>Ver tamanhos e cores</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View testID="por-loja">
      <TextInput
        style={s.busca as any}
        placeholder="Buscar por nome, SKU ou código de barras..."
        placeholderTextColor={Colors.ink3}
        value={busca}
        onChangeText={setBusca}
        testID="por-loja-busca"
      />
      {erro ? (
        <View style={s.erroBox}>
          <Text style={s.erro} testID="por-loja-erro">{erro}</Text>
          <Pressable onPress={function () { setTentativa(tentativa + 1); }} style={s.retry} accessibilityRole="button">
            <Text style={s.retryTxt}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : carregando && !dados ? (
        <View style={{ paddingVertical: 32 }}><ActivityIndicator color={Colors.violet3} /></View>
      ) : itens.length === 0 ? (
        <Text style={s.vazio} testID="por-loja-vazio">{q ? "Nenhum produto encontrado." : "Nenhum produto nas suas lojas."}</Text>
      ) : (
        <View style={[s.lista, carregando && { opacity: 0.6 }]}>
          {largo ? tabela() : cartoes()}
        </View>
      )}
      <Pagination page={pagina} totalPages={totalPaginas} total={total} pageSize={POR_PAGINA_POR_LOJA} onPage={setPagina} />

      <WebPortal active={!!aberto}>
        {aberto ? <VariantesPorLojaModal item={aberto} onFechar={function () { setAberto(null); }} /> : null}
      </WebPortal>
    </View>
  );
}

export function VariantesPorLojaModal({ item, onFechar }: { item: ItemPorLoja; onFechar: () => void }) {
  var largura = useWindowDimensions().width;
  var largo = largura >= LARGURA_TABELA;
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);
  var [dados, setDados] = useState<RespostaVariantesPorLoja | null>(null);
  var [erro, setErro] = useState(false);

  useEffect(function () {
    estoqueTransferenciasApi.variantesPorLoja(item.chave)
      .then(function (r) { if (vivo.current) setDados(r); })
      .catch(function () { if (vivo.current) setErro(true); });
  }, [item.chave]);

  var lojas = (dados && dados.lojas) || [];
  var variantes = (dados && dados.variantes) || [];

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  return (
    <View style={s.overlay} testID="por-loja-variantes-modal">
      <Pressable style={s.backdrop} onPress={onFechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel={"Tamanhos e cores de " + item.nome}>
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headerTitle} numberOfLines={2}>{item.nome}</Text>
            <Text style={s.sub}>{"Tamanhos e cores por loja · total " + qtd(item.total)}</Text>
          </View>
          <Pressable onPress={onFechar} style={s.closeBtn} testID="por-loja-variantes-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ padding: 16 }}>
          {erro ? <Text style={s.erro} testID="por-loja-variantes-erro">Não conseguimos carregar os tamanhos e cores agora.</Text>
            : !dados ? <ActivityIndicator color={Colors.violet3} />
            : variantes.length === 0 ? <Text style={s.vazio}>Sem tamanhos e cores ativos.</Text>
            : largo ? (
              <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" as any }}>
                <View style={{ flex: 1, minWidth: 240 + lojas.length * 100 }} testID="por-loja-variantes-tabela">
                  <View style={[s.tr, s.thead]}>
                    <Text style={[s.th, s.colNome]}>Tamanho e cor</Text>
                    {lojas.map(function (l) { return <Text key={l.id} style={[s.th, s.colLoja]} numberOfLines={2}>{l.nome}</Text>; })}
                    <Text style={[s.th, s.colLoja, { color: Colors.ink }]}>Total</Text>
                  </View>
                  {variantes.map(function (v, i) {
                    return (
                      <View key={i} style={s.tr} testID={"por-loja-variante-" + i}>
                        <View style={s.colNome}>
                          <Text style={s.nome}>{v.rotulo}</Text>
                          {v.sku || v.barcode ? <Text style={s.sub}>{v.sku || v.barcode}</Text> : null}
                        </View>
                        {lojas.map(function (l) {
                          var n = estoqueNa(v.por_loja, l.id);
                          return <Text key={l.id} style={[s.td, s.colLoja, n == null && { color: Colors.ink3 }]} testID={"por-loja-variante-" + i + "-" + l.id}>{qtd(n)}</Text>;
                        })}
                        <Text style={[s.td, s.colLoja, s.total]}>{qtd(v.total)}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={{ gap: 8 }} testID="por-loja-variantes-cartoes">
                {variantes.map(function (v, i) {
                  return (
                    <View key={i} style={s.card} testID={"por-loja-variante-" + i}>
                      <View style={s.cardTop}>
                        <Text style={[s.nome, { flex: 1 }]}>{v.rotulo}</Text>
                        <Text style={s.cardTotal}>{qtd(v.total)}</Text>
                      </View>
                      <View style={s.chips}>
                        {chipsDasLojas(lojas, v.por_loja).map(function (c, j) {
                          return <View key={j} style={s.chip}><Text style={s.chipTxt} testID={"por-loja-variante-chip-" + i + "-" + j}>{c}</Text></View>;
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
        </ScrollView>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  busca: {
    backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, minHeight: 44,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: Colors.ink, marginBottom: 12,
  },
  lista: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  thead: { backgroundColor: Colors.bg4 },
  th: { fontSize: 10.5, fontWeight: "700", color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  td: { fontSize: 14, color: Colors.ink2, fontWeight: "600" },
  colNome: { flex: 1, minWidth: 200 },
  colLoja: { width: 100, textAlign: "right" },
  total: { color: Colors.ink, fontWeight: "800" },
  nome: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  verGrade: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", marginTop: 2 },
  verGradeTxt: { color: Colors.violet3, fontSize: 12, fontWeight: "700" },
  card: { padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTotal: { fontSize: 18, fontWeight: "800", color: Colors.ink, lineHeight: 22 },
  cardTotalLbl: { fontSize: 9, color: Colors.ink3, letterSpacing: 0.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: Colors.bg4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipTxt: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  erroBox: { alignItems: "center", padding: 24, gap: 12 },
  erro: { fontSize: 13, color: Colors.red },
  retry: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" },
  retryTxt: { fontSize: 12, color: "#fff", fontWeight: "700" },
  vazio: { fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 32 },
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 12,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 820, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
});

export default EstoquePorLoja;
