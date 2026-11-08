// ============================================================================
// AURA. — Estoque · Últimos reajustes (03/11/2026)
//
// Antes o "Desfazer" do reajuste em lote só existia com o modal aberto. O
// backend guarda cada reajuste por 7 dias (Aura-backend#940: lista, detalhe
// e desfazer); esta janela mostra os reajustes da empresa ativa:
//   lista   — quando, quem, o que mudou, quantos produtos e até quando dá
//             para desfazer;
//   detalhe — os itens com o preço antes e depois e, depois do desfazer,
//             quem voltou e quem ficou como está porque mudou depois.
// O desfazer pede confirmação aqui dentro (nada de confirm() do navegador).
//
// Mesmo painel do AjustarPrecoModal (DNA do TrocaModal): cabeçalho com ícone,
// corpo com rolagem e rodapé com as ações. O Estoque renderiza dentro de
// WebPortal. Multi-CNPJ: `companyId` é a empresa ativa; produto de grupo é
// uma linha só, então desfazer volta o preço em todas as lojas do grupo.
// Sem hover; alvos de 44 px; a 375 px cada item quebra em duas linhas.
// ============================================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import {
  priceAdjustmentsApi, codigoDoErro,
  type DetalheDoReajuste, type ItemDoLote, type LoteReajuste, type RespostaDesfazer,
} from "@/services/priceAdjustmentsApi";
import {
  DIAS_PARA_DESFAZER, brl, explicaMudaramDepois, mensagemErroDesfazer, nomeDoItem, plural, prazoTxt, quandoTxt,
  quemEQuantos, resumoDoDesfazer, situacaoDoLote, textoConfirmarDesfazer, textoDoLote,
} from "./reajusteRegras";
import { Aviso } from "./Aviso";

var IS_WEB = Platform.OS === "web";
var POR_PAGINA = 20;
var MAX_ITENS_NA_TELA = 300;
var MAX_LISTA_DEPOIS = 20;

type Props = {
  companyId: string;
  onFechar: () => void;
  /** Um reajuste foi desfeito: o Estoque recarrega a lista de produtos. */
  onPrecosMudaram?: () => void;
};

function mensagemErroLista(e: any): string {
  if (e && e.status === 404) return "Esta lista ainda não está disponível na sua conta.";
  return "Não conseguimos carregar os reajustes agora. Tente de novo em instantes.";
}

export function UltimosReajustesModal({ companyId, onFechar, onPrecosMudaram }: Props) {
  var estreito = useWindowDimensions().width < 640;

  var [lotes, setLotes] = useState<LoteReajuste[]>([]);
  var [total, setTotal] = useState(0);
  var [carregando, setCarregando] = useState(true);
  var [carregandoMais, setCarregandoMais] = useState(false);
  var [erroLista, setErroLista] = useState<string | null>(null);

  var [aberto, setAberto] = useState<LoteReajuste | null>(null);
  var [detalhe, setDetalhe] = useState<DetalheDoReajuste | null>(null);
  var [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  var [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  var [confirmar, setConfirmar] = useState(false);
  var [desfazendo, setDesfazendo] = useState(false);
  var [desfeito, setDesfeito] = useState<RespostaDesfazer | null>(null);
  var [erroDesfazer, setErroDesfazer] = useState<string | null>(null);

  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);

  function carregarLista() {
    setCarregando(true);
    setErroLista(null);
    priceAdjustmentsApi.lista(companyId, POR_PAGINA, 0)
      .then(function (r) {
        if (!vivo.current) return;
        setLotes(r.adjustments || []);
        setTotal(r.total || 0);
      })
      .catch(function (e: any) { if (vivo.current) setErroLista(mensagemErroLista(e)); })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }

  useEffect(function () {
    if (companyId) carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function verMais() {
    if (carregandoMais) return;
    setCarregandoMais(true);
    priceAdjustmentsApi.lista(companyId, POR_PAGINA, lotes.length)
      .then(function (r) {
        if (!vivo.current) return;
        setLotes(lotes.concat(r.adjustments || []));
        setTotal(r.total || 0);
      })
      .catch(function (e: any) { if (vivo.current) setErroLista(mensagemErroLista(e)); })
      .finally(function () { if (vivo.current) setCarregandoMais(false); });
  }

  function carregarDetalhe(id: string) {
    setCarregandoDetalhe(true);
    setErroDetalhe(null);
    priceAdjustmentsApi.detalhe(companyId, id)
      .then(function (d) {
        if (!vivo.current) return;
        setDetalhe(d);
        // A lista acompanha (desfeito, prazo) sem pedir tudo de novo.
        setLotes(function (atual) {
          return atual.map(function (l) {
            if (l.id !== d.id) return l;
            var { items: _itens, ...semItens } = d;
            return semItens;
          });
        });
      })
      .catch(function (e: any) {
        if (!vivo.current) return;
        setErroDetalhe(codigoDoErro(e) === "NOT_FOUND"
          ? "Não encontramos este reajuste nesta empresa."
          : "Não conseguimos abrir este reajuste agora. Tente de novo em instantes.");
      })
      .finally(function () { if (vivo.current) setCarregandoDetalhe(false); });
  }

  function abrir(l: LoteReajuste) {
    setAberto(l);
    setDetalhe(null);
    setDesfeito(null);
    setErroDesfazer(null);
    setConfirmar(false);
    carregarDetalhe(l.id);
  }

  function voltarParaLista() {
    if (desfazendo) return;
    setAberto(null);
    setDetalhe(null);
    setDesfeito(null);
    setErroDesfazer(null);
    setConfirmar(false);
  }

  function desfazer() {
    var lote = detalhe || aberto;
    if (!lote || desfazendo) return;
    setConfirmar(false);
    setDesfazendo(true);
    setErroDesfazer(null);
    priceAdjustmentsApi.desfazer(companyId, lote.id)
      .then(function (d) {
        if (!vivo.current) return;
        setDesfeito(d);
        if (onPrecosMudaram) onPrecosMudaram();
        carregarDetalhe(lote!.id);
      })
      .catch(function (e: any) {
        if (!vivo.current) return;
        var codigo = codigoDoErro(e);
        setErroDesfazer(mensagemErroDesfazer(codigo, e && e.status));
        // Já desfeito ou vencido: a tela passa a mostrar a situação real.
        if (codigo === "ALREADY_UNDONE" || codigo === "EXPIRED") carregarDetalhe(lote!.id);
      })
      .finally(function () { if (vivo.current) setDesfazendo(false); });
  }

  var lote: LoteReajuste | null = detalhe || aberto;
  var podeDesfazer = !!lote && situacaoDoLote(lote) === "pode" && !desfeito;
  var fechar = desfazendo ? undefined : onFechar;

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  var sub = lote
    ? textoDoLote(lote)
    : "Reajustes de preço feitos nesta empresa. Dá para desfazer por " + DIAS_PARA_DESFAZER + " dias.";

  var rodape = lote
    ? (desfazendo ? "Desfazendo o reajuste…" : "")
    : (carregando ? "" : plural(total, "reajuste", "reajustes"));

  return (
    <View style={[s.overlay, estreito && { padding: 10 }]} testID="ultimos-reajustes">
      <Pressable style={s.backdrop} onPress={fechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Últimos reajustes">

        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Icon name="rotate_ccw" size={16} color="#a78bfa" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Últimos reajustes</Text>
              <Text style={s.headerSub} testID="ultimos-sub">{sub}</Text>
            </View>
          </View>
          <Pressable onPress={fechar} style={s.closeBtn} testID="ultimos-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {!lote && (
            <Lista
              lotes={lotes}
              total={total}
              carregando={carregando}
              carregandoMais={carregandoMais}
              erro={erroLista}
              onAbrir={abrir}
              onVerMais={verMais}
              onTentarDeNovo={carregarLista}
            />
          )}
          {!!lote && (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={desfazendo ? undefined : voltarParaLista}
                style={s.voltar}
                testID="ultimos-voltar"
                accessibilityRole="button"
              >
                <Icon name="arrow_left" size={14} color={Colors.violet3} />
                <Text style={s.voltarTxt}>Todos os reajustes</Text>
              </Pressable>

              <View style={s.resumo} testID="ultimos-detalhe-resumo">
                <Text style={s.resumoTitulo}>{quandoTxt(lote.created_at)}</Text>
                <Text style={s.resumoTexto}>{quemEQuantos(lote)}</Text>
                <Text style={[s.resumoTexto, situacaoDoLote(lote) === "pode" && { color: Colors.violet3, fontWeight: "600" }]} testID="ultimos-detalhe-prazo">
                  {prazoTxt(lote)}
                </Text>
              </View>

              {!desfeito && podeDesfazer && lote.group_shared_count > 0 && (
                <Aviso tipo="info" testID="ultimos-grupo">
                  Este reajuste tem produtos do grupo. Ao desfazer, o preço volta em todas as lojas do grupo.
                </Aviso>
              )}

              {!!desfeito && (
                <Aviso tipo="ok" testID="ultimos-desfeito">{resumoDoDesfazer(desfeito)}</Aviso>
              )}
              {!!desfeito && !!explicaMudaramDepois(desfeito) && (
                <Aviso tipo="aviso" testID="ultimos-mudaram-depois">
                  {explicaMudaramDepois(desfeito)}
                  {"\n"}
                  {desfeito.changed_after.slice(0, MAX_LISTA_DEPOIS).map(function (c) {
                    var linha = c.reason === "not_found"
                      ? "• " + nomeDoItem(c) + ": não está mais no Estoque"
                      : "• " + nomeDoItem(c) + ": agora " + brl(c.price_now);
                    return linha + "\n";
                  }).join("")}
                  {desfeito.changed_after.length > MAX_LISTA_DEPOIS ? "e mais " + (desfeito.changed_after.length - MAX_LISTA_DEPOIS) + "." : ""}
                </Aviso>
              )}
              {!!erroDesfazer && <Aviso tipo="erro" testID="ultimos-erro-desfazer">{erroDesfazer}</Aviso>}
              {!!erroDetalhe && <Aviso tipo="erro" testID="ultimos-erro-detalhe">{erroDetalhe}</Aviso>}

              {carregandoDetalhe && !detalhe && (
                <View style={s.centro}><ActivityIndicator color={Colors.violet3} /></View>
              )}
              {!!detalhe && <Itens itens={detalhe.items} estreito={estreito} />}
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <Text style={s.footerInfo} numberOfLines={2} testID="ultimos-rodape">{rodape}</Text>
          <View style={s.footerActions}>
            {podeDesfazer && (
              <Pressable
                style={[s.btnSec, desfazendo && { opacity: 0.6 }]}
                onPress={desfazendo ? undefined : function () { setErroDesfazer(null); setConfirmar(true); }}
                disabled={desfazendo}
                testID="ultimos-desfazer"
                accessibilityRole="button"
                accessibilityState={{ disabled: desfazendo, busy: desfazendo }}
              >
                {desfazendo ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="rotate_ccw" size={14} color={Colors.ink} />}
                <Text style={s.btnSecTxt}>Desfazer este reajuste</Text>
              </Pressable>
            )}
            <Pressable style={[s.btnPri, desfazendo && { opacity: 0.45 }]} onPress={fechar} disabled={desfazendo} testID="ultimos-fechar" accessibilityRole="button">
              <Text style={s.btnPriTxt}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {confirmar && lote && (
        <View style={s.confOverlay} testID="ultimos-confirmar">
          <View style={s.confCard} accessibilityViewIsModal>
            <Text style={s.confTitulo}>Desfazer este reajuste?</Text>
            <Text style={s.confTexto} testID="ultimos-confirmar-texto">{textoConfirmarDesfazer(lote)}</Text>
            <View style={s.confAcoes}>
              <Pressable style={s.btnSec} onPress={function () { setConfirmar(false); }} testID="ultimos-confirmar-nao" accessibilityRole="button">
                <Text style={s.btnSecTxt}>Voltar</Text>
              </Pressable>
              <Pressable style={s.btnPri} onPress={desfazer} testID="ultimos-confirmar-sim" accessibilityRole="button">
                <Text style={s.btnPriTxt}>Desfazer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Lista({ lotes, total, carregando, carregandoMais, erro, onAbrir, onVerMais, onTentarDeNovo }: {
  lotes: LoteReajuste[]; total: number; carregando: boolean; carregandoMais: boolean; erro: string | null;
  onAbrir: (l: LoteReajuste) => void; onVerMais: () => void; onTentarDeNovo: () => void;
}) {
  if (carregando) return <View style={s.centro}><ActivityIndicator color={Colors.violet3} /></View>;
  if (erro && lotes.length === 0) {
    return (
      <View style={{ gap: 10 }}>
        <Aviso tipo="erro" testID="ultimos-erro-lista">{erro}</Aviso>
        <Pressable style={[s.btnSec, { alignSelf: "center" }]} onPress={onTentarDeNovo} testID="ultimos-tentar" accessibilityRole="button">
          <Text style={s.btnSecTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }
  if (lotes.length === 0) {
    return (
      <Text style={s.vazio} testID="ultimos-vazio">
        Nenhum reajuste por aqui ainda. Quando você ajustar preços em lote no Estoque, eles aparecem nesta lista.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {lotes.map(function (l) {
        var sit = situacaoDoLote(l);
        return (
          <Pressable key={l.id} style={s.lote} onPress={function () { onAbrir(l); }} testID={"ultimos-lote-" + l.id} accessibilityRole="button">
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={s.loteTitulo}>{textoDoLote(l)}</Text>
              <Text style={s.loteTexto}>{quandoTxt(l.created_at)} · {quemEQuantos(l)}</Text>
              <Text style={[s.loteTexto, sit === "pode" && { color: Colors.violet3, fontWeight: "600" }]} testID={"ultimos-prazo-" + l.id}>
                {prazoTxt(l)}
              </Text>
            </View>
            <Icon name="chevron_right" size={16} color={Colors.ink3} />
          </Pressable>
        );
      })}
      {!!erro && <Aviso tipo="erro">{erro}</Aviso>}
      {lotes.length < total && (
        <Pressable style={[s.btnSec, { alignSelf: "center" }]} onPress={carregandoMais ? undefined : onVerMais} testID="ultimos-ver-mais" accessibilityRole="button">
          {carregandoMais ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Text style={s.btnSecTxt}>Ver reajustes mais antigos</Text>}
        </Pressable>
      )}
    </View>
  );
}

function Itens({ itens, estreito }: { itens: ItemDoLote[]; estreito: boolean }) {
  var mostrar = itens.slice(0, MAX_ITENS_NA_TELA);
  return (
    <View style={s.itens} testID="ultimos-itens">
      {mostrar.map(function (i) {
        var chave = i.product_id + ":" + (i.variant_id || "");
        return (
          <View key={chave} style={[s.item, estreito && { flexDirection: "column", alignItems: "flex-start" }]} testID={"ultimos-item-" + chave}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.itemNome}>{nomeDoItem(i)}</Text>
              {i.undo_status === "restored" && <Text style={[s.itemStatus, { color: Colors.green }]}>Voltou ao preço de antes</Text>}
              {i.undo_status === "changed_after" && (
                <Text style={[s.itemStatus, { color: Colors.amber }]}>Ficou como está: o preço mudou depois do reajuste</Text>
              )}
            </View>
            <Text style={s.itemPreco}>
              {brl(i.price_before)} → <Text style={{ fontWeight: "700", color: Colors.ink }}>{brl(i.price_after)}</Text>
            </Text>
          </View>
        );
      })}
      {itens.length > MAX_ITENS_NA_TELA && (
        <Text style={s.loteTexto}>e mais {plural(itens.length - MAX_ITENS_NA_TELA, "item", "itens")}.</Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 640, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  centro: { paddingVertical: 28, alignItems: "center" },
  vazio: { fontSize: 13.5, color: Colors.ink3, textAlign: "center", lineHeight: 19, paddingVertical: 20 },
  lote: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.18)", backgroundColor: "rgba(124,58,237,0.05)",
  },
  loteTitulo: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  loteTexto: { fontSize: 12.5, color: Colors.ink3, lineHeight: 17 },
  voltar: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start", paddingRight: 8 },
  voltarTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  resumo: { gap: 3, padding: 14, borderRadius: 12, backgroundColor: "rgba(124,58,237,0.06)", borderWidth: 1, borderColor: "rgba(124,58,237,0.15)" },
  resumoTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  resumoTexto: { fontSize: 13, color: Colors.ink2, lineHeight: 18 },
  itens: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(124,58,237,0.15)", overflow: "hidden" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
  },
  itemNome: { fontSize: 13.5, color: Colors.ink, fontWeight: "600" },
  itemStatus: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  itemPreco: { fontSize: 13, color: Colors.ink3 },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)", backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
  },
  footerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 120, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  btnPri: {
    backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.border2,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  confOverlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
  },
  confCard: { width: "100%", maxWidth: 400, borderRadius: 16, padding: 20, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)" },
  confTitulo: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 8 },
  confTexto: { fontSize: 13.5, color: Colors.ink2, lineHeight: 19, marginBottom: 16 },
  confAcoes: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
});

export default UltimosReajustesModal;
