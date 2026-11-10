// ============================================================================
// AURA. — Estoque · Transferências (histórico, 10/11/2026)
//
// Link "Transferências" no topo do Estoque (só com 2+ lojas no grupo).
// GET /companies/:id/estoque/transferencias?limit&offset — lista simples:
// número, data, origem → destino, peças; toque abre o detalhe com os itens.
// Mesmo painel do Transferir/Últimos reajustes, via WebPortal.
// ============================================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { estoqueTransferenciasApi, type Transferencia } from "@/services/estoqueTransferenciasApi";
import { plural } from "@/utils/transferenciaEstoque";
import { fmtQty } from "@/utils/matconUnits";

var IS_WEB = Platform.OS === "web";
var POR_PAGINA = 20;

type Props = {
  companyId: string;
  /** id → nome das lojas que o usuário acessa (cai aqui quando o backend não manda o nome). */
  nomes: Record<string, string>;
  onFechar: () => void;
};

function dois(n: number) { return n < 10 ? "0" + n : String(n); }
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return dois(d.getDate()) + "/" + dois(d.getMonth() + 1) + "/" + d.getFullYear() + " às " + dois(d.getHours()) + ":" + dois(d.getMinutes());
}

export function pecasDa(t: Transferencia): number {
  if (t.total_pecas != null) return Number(t.total_pecas) || 0;
  return (t.itens || []).reduce(function (a, i) { return a + (Number(i.quantidade) || 0); }, 0);
}

export function TransferenciasModal({ companyId, nomes, onFechar }: Props) {
  var vivo = useRef(true);
  useEffect(function () { vivo.current = true; return function () { vivo.current = false; }; }, []);
  var [lista, setLista] = useState<Transferencia[]>([]);
  var [total, setTotal] = useState<number | null>(null);
  var [carregando, setCarregando] = useState(true);
  var [erro, setErro] = useState<string | null>(null);
  var [aberta, setAberta] = useState<Transferencia | null>(null);

  function carregar(offset: number) {
    setCarregando(true);
    setErro(null);
    estoqueTransferenciasApi.historico(companyId, POR_PAGINA, offset)
      .then(function (r) {
        if (!vivo.current) return;
        var novas = (r && r.transferencias) || [];
        setLista(function (l) { return offset === 0 ? novas : l.concat(novas); });
        setTotal(r && r.total != null ? Number(r.total) : null);
      })
      .catch(function (e: any) {
        if (!vivo.current) return;
        setErro(e && e.status === 404
          ? "O histórico de transferências ainda não está disponível. Tente de novo mais tarde."
          : "Não conseguimos carregar as transferências agora. Tente de novo em instantes.");
      })
      .finally(function () { if (vivo.current) setCarregando(false); });
  }
  useEffect(function () { carregar(0); }, [companyId]);

  var temMais = total != null ? lista.length < total : false;

  function nome(id: string, doBackend?: string | null) { return doBackend || nomes[id] || "Outra loja"; }

  var panelWeb = IS_WEB ? {
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE ? "0 24px 60px -10px rgba(0,0,0,0.7)" : "0 24px 60px -10px rgba(124,58,237,0.22)",
  } : null;

  function linha(t: Transferencia) {
    var saiu = t.origem_company_id === companyId;
    var pecas = pecasDa(t);
    var nItens = t.total_itens != null ? Number(t.total_itens) : (t.itens ? t.itens.length : null);
    return (
      <Pressable key={t.id} onPress={function () { setAberta(t); }} style={s.item} accessibilityRole="button" testID={"transferencias-item-" + t.id}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.itemTitulo} numberOfLines={1}>{"Nº " + t.numero + " · " + dataCurta(t.criada_em)}</Text>
          <Text style={s.itemRota} numberOfLines={2}>{nome(t.origem_company_id, t.origem_nome) + " → " + nome(t.destino_company_id, t.destino_nome)}</Text>
          <Text style={s.itemSub}>{plural(pecas, "peça", "peças") + (nItens != null ? " · " + plural(nItens, "item", "itens") : "")}</Text>
        </View>
        <View style={[s.tag, saiu ? s.tagSaiu : s.tagChegou]}>
          <Text style={[s.tagTxt, { color: saiu ? Colors.amber : Colors.green }]}>{saiu ? "Saiu" : "Chegou"}</Text>
        </View>
      </Pressable>
    );
  }

  function detalhe(t: Transferencia) {
    var itens = t.itens || [];
    return (
      <View testID="transferencias-detalhe">
        <Text style={s.detTitulo}>{"Transferência nº " + t.numero}</Text>
        <Text style={s.itemSub}>{dataCurta(t.criada_em) + (t.usuario_nome ? " · " + t.usuario_nome : "")}</Text>
        <Text style={[s.itemRota, { marginTop: 8 }]}>{nome(t.origem_company_id, t.origem_nome) + " → " + nome(t.destino_company_id, t.destino_nome)}</Text>
        <Text style={s.itemSub}>{plural(pecasDa(t), "peça", "peças")}</Text>
        {t.observacao ? <Text style={[s.itemSub, { marginTop: 6 }]}>{"Observação: " + t.observacao}</Text> : null}
        <View style={{ gap: 6, marginTop: 14 }}>
          {itens.length === 0 && <Text style={s.itemSub}>Os itens desta transferência não vieram no histórico.</Text>}
          {itens.map(function (i, idx) {
            return (
              <View key={i.product_id + ":" + (i.variant_id || "") + ":" + idx} style={s.detItem} testID={"transferencias-detalhe-item-" + idx}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemTitulo} numberOfLines={2}>{i.nome || "Produto"}</Text>
                  {i.rotulo ? <Text style={s.itemSub}>{i.rotulo}</Text> : null}
                  {i.criado_no_destino ? <Text style={s.criado}>{"Criado em " + nome(t.destino_company_id, t.destino_nome)}</Text> : null}
                </View>
                <Text style={s.qtd}>{fmtQty(Number(i.quantidade) || 0)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={s.overlay} testID="transferencias-modal">
      <Pressable style={s.backdrop} onPress={onFechar} accessibilityLabel="Fechar" />
      <View style={[s.panel, panelWeb ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]} accessibilityViewIsModal accessibilityLabel="Transferências">
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIco}><Text style={s.headerIcoTxt}>⇄</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.headerTitle}>Transferências</Text>
              <Text style={s.headerSub}>Peças que saíram e chegaram desta loja.</Text>
            </View>
          </View>
          <Pressable onPress={onFechar} style={s.closeBtn} testID="transferencias-x" accessibilityRole="button" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {aberta ? detalhe(aberta) : (
            <>
              {erro && <Text style={s.erro} testID="transferencias-erro">{erro}</Text>}
              {!erro && !carregando && lista.length === 0 && (
                <Text style={s.itemSub} testID="transferencias-vazio">
                  Nenhuma transferência ainda. Selecione produtos no Estoque e toque em "Transferir para outra loja".
                </Text>
              )}
              <View style={{ gap: 8 }}>{lista.map(linha)}</View>
              {carregando && <View style={{ paddingVertical: 16 }}><ActivityIndicator color={Colors.violet3} /></View>}
              {!carregando && temMais && (
                <Pressable onPress={function () { carregar(lista.length); }} style={s.mais} testID="transferencias-mais" accessibilityRole="button">
                  <Text style={s.maisTxt}>Ver mais antigas</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
        <View style={s.footer}>
          {aberta ? (
            <Pressable style={s.btnSec} onPress={function () { setAberta(null); }} testID="transferencias-voltar" accessibilityRole="button">
              <Icon name="arrow_left" size={14} color={Colors.ink} />
              <Text style={s.btnSecTxt}>Voltar</Text>
            </Pressable>
          ) : <View />}
          <Pressable style={s.btnPri} onPress={onFechar} testID="transferencias-fechar" accessibilityRole="button">
            <Text style={s.btnPriTxt}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  overlay: {
    position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
  },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  panel: { width: "100%", maxWidth: 620, maxHeight: "94%", borderRadius: 18, overflow: "hidden", flexDirection: "column" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  headerIco: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" },
  headerIcoTxt: { color: "#a78bfa", fontSize: 16, fontWeight: "800" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center",
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 18, paddingBottom: 12 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12, minHeight: 56,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  itemTitulo: { fontSize: 13.5, color: Colors.ink, fontWeight: "700" },
  itemRota: { fontSize: 13, color: Colors.ink2, fontWeight: "600", marginTop: 2 },
  itemSub: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 17 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  tagSaiu: { backgroundColor: Colors.amberD, borderColor: Colors.amber },
  tagChegou: { backgroundColor: Colors.greenD, borderColor: Colors.green },
  tagTxt: { fontSize: 11.5, fontWeight: "700" },
  detTitulo: { fontSize: 16, color: Colors.ink, fontWeight: "800" },
  detItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  criado: { fontSize: 11.5, color: Colors.violet3, fontWeight: "600", marginTop: 2 },
  qtd: { fontSize: 15, color: Colors.ink, fontWeight: "800" },
  erro: { fontSize: 13, color: Colors.red, marginBottom: 10 },
  mais: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginTop: 8 },
  maisTxt: { color: Colors.violet3, fontSize: 12.5, fontWeight: "700" },
  footer: {
    paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
  },
  btnPri: { backgroundColor: Colors.violet, minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.border2, minHeight: 44,
    paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
});

export default TransferenciasModal;
