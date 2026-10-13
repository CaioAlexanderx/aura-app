// ============================================================
// Gestão Aura › Hoje — Catálogo de blocos e Ficha do cliente.
//
// Os dois usam a mesma casca (PainelModal): Modal do RN (na web já sai em
// portal no body, fora do shell), clique fora e Esc fecham.
// ============================================================
import { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { BarrasVerticais } from "./Graficos";
import { CaixaInsight, Indicadores, Pill } from "./BlocoCard";
import { Paleta, TextoRico } from "./paleta";
import { useFichaCliente } from "./usePainelHoje";
import { abrirWhatsApp } from "./whatsapp";
import type { BlocoId, ItemCatalogo } from "./tipos";

export function PainelModal(props: {
  visible: boolean;
  id: string;                 // vira o testID da casca e do botão de fechar
  titulo: string;
  subtitulo?: string;
  antesDoTitulo?: React.ReactNode;
  rodape?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={m.scrim} testID={props.id}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityLabel="Fechar" />
        <View style={m.modal} accessibilityRole={"dialog" as any}>
          <View style={m.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={m.tituloRow}>
                {props.antesDoTitulo}
                <Text style={m.titulo}>{props.titulo}</Text>
              </View>
              {props.subtitulo ? <Text style={m.subtitulo}>{props.subtitulo}</Text> : null}
            </View>
            <Pressable testID={props.id + "-fechar"} onPress={props.onClose} style={m.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={16} color={Paleta.accentTexto} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={m.body}>{props.children}</ScrollView>
          {props.rodape ? <View style={m.foot}>{props.rodape}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

// ── Catálogo ────────────────────────────────────────────────

export function CatalogoBlocos(props: {
  visible: boolean;
  itens: ItemCatalogo[];
  ativos: BlocoId[];
  onClose: () => void;
  onSalvar: (ativos: BlocoId[]) => void;
  salvando?: boolean;          // PUT /layout em andamento
}) {
  var [marcados, setMarcados] = useState<BlocoId[]>(props.ativos);
  // Reabrir descarta o que foi marcado e não salvo.
  useEffect(function() { if (props.visible) setMarcados(props.ativos); }, [props.visible, props.ativos]);

  function alternar(id: BlocoId) {
    setMarcados(function(atual) {
      return atual.indexOf(id) >= 0 ? atual.filter(function(x) { return x !== id; }) : atual.concat([id]);
    });
  }

  var emConstrucao = props.itens.filter(function(i) { return i.em_construcao; }).length;
  var nAtivos = marcados.length;
  var disponiveis = props.itens.length - nAtivos - emConstrucao;

  return (
    <PainelModal
      visible={props.visible}
      id="catalogo-modal"
      titulo="Catálogo de blocos"
      subtitulo="Um bloco só entra se o número se calcula sozinho."
      onClose={props.onClose}
      rodape={
        <>
          <Text style={m.footText} testID="catalogo-contagem">{nAtivos} ativos · {disponiveis} disponíveis · {emConstrucao} em construção</Text>
          <View style={m.footAcoes}>
            <Pressable testID="catalogo-cancelar" onPress={props.onClose} style={m.btnGhost}><Text style={m.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable testID="catalogo-salvar" disabled={props.salvando} onPress={function() { props.onSalvar(marcados); }} style={[m.btnPrimario, props.salvando && { opacity: 0.6 }]}><Text style={m.btnPrimarioText}>{props.salvando ? "Salvando…" : "Salvar painel"}</Text></Pressable>
          </View>
        </>
      }
    >
      <View style={m.cat}>
        {props.itens.map(function(item) {
          var ligado = marcados.indexOf(item.id) >= 0;
          var travado = !!item.em_construcao;
          return (
            <Pressable
              key={item.id}
              testID={"catalogo-item-" + item.id}
              disabled={travado}
              onPress={function() { alternar(item.id); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ligado, disabled: travado }}
              style={[m.catItem, travado && { opacity: 0.55 }]}
            >
              <View style={[m.check, ligado && m.checkOn]}>
                {ligado ? <Icon name="check" size={11} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={m.catTitulo}>{item.titulo}</Text>
                <Text style={[m.catFonte, item.aviso && { color: Colors.amber }]}>{item.fonte}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </PainelModal>
  );
}

// ── Ficha do cliente ────────────────────────────────────────

export function FichaClienteModal(props: {
  companyId: string | null;
  onClose: () => void;
  onAbrirCliente: (companyId: string) => void;
  onVerbo: (verbo: string, loja: string) => void;   // verbos que ainda não existem: "em breve"
  onAviso: (mensagem: string) => void;
}) {
  var { ficha, carregando, erro, tentarDeNovo } = useFichaCliente(props.companyId);
  var cid = props.companyId;
  return (
    <PainelModal
      visible={!!cid}
      id="ficha-modal"
      titulo={ficha ? ficha.nome : "Ficha do cliente"}
      subtitulo={ficha ? ficha.resumo : undefined}
      antesDoTitulo={ficha && ficha.situacao ? <Pill variacao={ficha.situacao} /> : null}
      onClose={props.onClose}
      rodape={ficha ? (
        <>
          <Text style={m.footText}>Fontes: {ficha.fontes}</Text>
          <View style={m.footAcoes}>
            <Pressable
              testID="ficha-whatsapp"
              onPress={function() {
                if (!abrirWhatsApp(ficha!.telefone)) props.onAviso(ficha!.nome + " não tem telefone cadastrado.");
              }}
              style={m.btn}
              accessibilityRole="link"
            >
              <Text style={m.btnText}>WhatsApp</Text>
            </Pressable>
            <Pressable testID="ficha-registrar-contato" onPress={function() { props.onVerbo("Registrar contato", ficha!.nome); }} style={m.btn}><Text style={m.btnText}>Registrar contato</Text></Pressable>
            <Pressable testID="ficha-abrir-cliente" onPress={function() { props.onAbrirCliente(ficha!.company_id); }} style={m.btnPrimario}><Text style={m.btnPrimarioText}>Abrir cliente</Text></Pressable>
          </View>
        </>
      ) : undefined}
    >
      {carregando ? <ActivityIndicator color={Colors.violet3} /> : null}
      {!carregando && !ficha && erro ? (
        <View style={{ gap: 8, alignItems: "flex-start" }} testID="ficha-erro">
          <CaixaInsight insight={{ tom: "risco", texto: "Não consegui carregar a ficha desta loja." }} />
          <Pressable testID="ficha-tentar-de-novo" onPress={tentarDeNovo} style={m.btn} accessibilityRole="button"><Text style={m.btnText}>Tentar de novo</Text></Pressable>
        </View>
      ) : null}
      {!carregando && !ficha && !erro ? (
        <CaixaInsight insight={{ tom: "neutro", texto: "Esta loja ainda não tem ficha." }} />
      ) : null}
      {ficha ? (
        <>
          {(ficha.alertas || []).map(function(a, i) {
            return <CaixaInsight key={"a" + i} insight={{ tom: a.tom, texto: a.texto }} />;
          })}
          <Indicadores itens={ficha.indicadores} />
          {ficha.serie ? (
            <View>
              <Text style={m.rotulo}>{ficha.serie.titulo}</Text>
              <BarrasVerticais pontos={ficha.serie.pontos} altura={84} valores="todos" />
            </View>
          ) : null}
          <View>
            <Text style={m.rotulo}>Módulos que usa</Text>
            <View style={m.chips}>
              {ficha.modulos.map(function(mod) {
                return <Pill key={mod.nome} variacao={{ texto: mod.nome, tom: mod.usa ? "sobe" : "mudo" }} />;
              })}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            {ficha.linha_do_tempo.map(function(ev, i) {
              return (
                <View key={i} style={m.tlRow}>
                  <Text style={m.tlData}>{ev.data}</Text>
                  <TextoRico texto={ev.texto} style={m.tlTexto} />
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </PainelModal>
  );
}

var m = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(17,15,28,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 760, maxHeight: "92%", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, overflow: "hidden" },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tituloRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  titulo: { fontSize: 18, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  subtitulo: { fontSize: 13, color: Colors.ink3, marginTop: 4 },
  fechar: { width: 30, height: 30, borderRadius: 8, backgroundColor: Paleta.accentSuave, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  footText: { fontSize: 12, color: Colors.ink3 },
  footAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  btn: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { fontSize: 12, fontWeight: "500", color: Colors.ink },
  btnGhost: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, fontWeight: "600", color: Paleta.accentTexto },
  btnPrimario: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet },
  btnPrimarioText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  cat: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catItem: { flexGrow: 1, flexBasis: 220, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minWidth: 0 },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border2, marginTop: 2, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  catTitulo: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  catFonte: { fontSize: 12, color: Colors.ink3 },
  rotulo: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tlRow: { flexDirection: "row", gap: 10 },
  tlData: { width: 50, fontSize: 13, color: Colors.ink3 },
  tlTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.ink2 },
});
