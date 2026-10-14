// ============================================================
// Gestão Aura › Hoje — Catálogo de blocos e Ficha do cliente.
//
// Os dois usam a mesma casca (PainelModal, em PainelModal.tsx): Modal do RN
// (na web já sai em portal no body, fora do shell), clique fora e Esc fecham.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { BarrasVerticais } from "./Graficos";
import { PainelModal } from "./PainelModal";
import { CaixaInsight, Indicadores, Pill } from "./BlocoCard";
import { Paleta, TextoRico } from "./paleta";
import { useConversaContato, useFichaCliente } from "./usePainelHoje";
import { abrirWhatsApp } from "./whatsapp";
import type { BlocoId, ItemCatalogo } from "./tipos";

// A casca mora em PainelModal.tsx; reexportada para quem já importava daqui.
export { PainelModal };

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
  onRegistrarContato: (companyId: string) => void;   // abre RegistrarContatoModal por cima da ficha
  onEstenderTrial?: (companyId: string, nome: string) => void;   // abre a confirmação de +7 dias
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
            <Pressable testID="ficha-registrar-contato" onPress={function() { props.onRegistrarContato(ficha!.company_id); }} style={m.btn} accessibilityRole="button"><Text style={m.btnText}>Registrar contato</Text></Pressable>
            {ficha.em_trial && props.onEstenderTrial ? (
              <Pressable testID="ficha-estender-trial" onPress={function() { props.onEstenderTrial!(ficha!.company_id, ficha!.nome); }} style={m.btn} accessibilityRole="button"><Text style={m.btnText}>+7 dias de teste</Text></Pressable>
            ) : null}
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
          {ficha.contatos && ficha.contatos.length > 0 ? (
            <View style={{ gap: 8 }} testID="ficha-contatos">
              <Text style={m.rotulo}>Contatos da equipe</Text>
              {ficha.contatos.slice(0, 3).map(function(ct) {
                return (
                  <View key={ct.id} style={m.contato} testID={"ficha-contato-" + ct.id}>
                    <View style={m.tlRow}>
                      <Text style={m.tlData}>{ct.data}</Text>
                      <Text style={m.contatoTitulo}>{ct.titulo}{ct.motivo ? " · " + ct.motivo : ""}</Text>
                    </View>
                    <Text style={m.contatoTexto}>{ct.texto}</Text>
                    {ct.proximo ? (
                      <Text style={[m.contatoProximo, ct.atrasado && { color: Colors.red }]}>
                        {"Próximo passo: " + ct.proximo + (ct.atrasado ? " (atrasado)" : "")}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
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

// ── Conversa de um contato do WhatsApp ──────────────────────

// Cor da bolha por quem falou: cliente (à esquerda), Aurinha e Caio (à direita).
function bolhaDe(autor: "cliente" | "aurinha" | "humano") {
  if (autor === "cliente") return { alinha: "flex-start" as const, bg: Colors.bg4, fg: Colors.ink };
  if (autor === "aurinha") return { alinha: "flex-end" as const, bg: Paleta.accentSuave, fg: Colors.ink };
  return { alinha: "flex-end" as const, bg: Colors.violet, fg: "#fff" };
}

export function ConversaContatoModal(props: {
  conversaId: string | null;
  onClose: () => void;
  onAbrirLoja: (companyId: string) => void;
  onAviso: (mensagem: string) => void;
}) {
  var { conversa, carregando, erro, tentarDeNovo } = useConversaContato(props.conversaId);
  var cid = props.conversaId;
  return (
    <PainelModal
      visible={!!cid}
      id="conversa-modal"
      titulo={conversa ? conversa.titulo : "Conversa do WhatsApp"}
      subtitulo={conversa ? conversa.telefone + (conversa.empresa ? " · " + conversa.empresa.nome : "") : undefined}
      antesDoTitulo={conversa && conversa.situacao ? <Pill variacao={conversa.situacao} /> : null}
      onClose={props.onClose}
      rodape={conversa ? (
        <>
          <Text style={m.footText}>Fonte: WhatsApp da Aura</Text>
          <View style={m.footAcoes}>
            <Pressable
              testID="conversa-whatsapp"
              onPress={function() {
                if (!abrirWhatsApp(conversa!.link || conversa!.telefone)) props.onAviso("Este contato não tem telefone utilizável.");
              }}
              style={m.btn}
              accessibilityRole="link"
            >
              <Text style={m.btnText}>Abrir no WhatsApp</Text>
            </Pressable>
            {conversa.empresa ? (
              <Pressable
                testID="conversa-abrir-empresa"
                onPress={function() { props.onAbrirLoja(conversa!.empresa!.company_id); }}
                style={m.btnPrimario}
                accessibilityRole="button"
              >
                <Text style={m.btnPrimarioText}>Abrir ficha de {conversa.empresa.nome}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : undefined}
    >
      {carregando ? <ActivityIndicator testID="conversa-carregando" color={Colors.violet3} /> : null}
      {!carregando && !conversa && erro ? (
        <View style={{ gap: 8, alignItems: "flex-start" }} testID="conversa-erro">
          <CaixaInsight insight={{ tom: "risco", texto: "Não consegui carregar esta conversa. Ela pode ter sido removida ou o número da Aura não está ligado." }} />
          <Pressable testID="conversa-tentar-de-novo" onPress={tentarDeNovo} style={m.btn} accessibilityRole="button"><Text style={m.btnText}>Tentar de novo</Text></Pressable>
        </View>
      ) : null}
      {conversa ? (
        <>
          <View style={m.contatoDados}>
            <View>
              <Text style={m.rotulo}>Telefone</Text>
              <Pressable
                testID="conversa-telefone"
                onPress={function() { if (!abrirWhatsApp(conversa!.link || conversa!.telefone)) props.onAviso("Este contato não tem telefone utilizável."); }}
                accessibilityRole="link"
                accessibilityLabel={"Abrir o WhatsApp de " + conversa.telefone}
              >
                <Text style={m.linkTel}>{conversa.telefone}</Text>
              </Pressable>
            </View>
            <View>
              <Text style={m.rotulo}>Empresa</Text>
              {conversa.empresa ? (
                <Pressable testID="conversa-empresa" onPress={function() { props.onAbrirLoja(conversa!.empresa!.company_id); }} accessibilityRole="button">
                  <Text style={m.linkTel}>{conversa.empresa.nome}</Text>
                </Pressable>
              ) : (
                <Text style={m.semEmpresa} testID="conversa-sem-empresa">Sem empresa vinculada</Text>
              )}
            </View>
            {conversa.situacao ? (
              <View>
                <Text style={m.rotulo}>Situação</Text>
                <View style={{ alignSelf: "flex-start" }}><Pill variacao={conversa.situacao} /></View>
              </View>
            ) : null}
          </View>

          <Indicadores itens={conversa.indicadores} />

          <View style={{ gap: 8 }}>
            <Text style={m.rotulo}>Mensagens</Text>
            {conversa.truncada ? (
              <Text style={m.footText} testID="conversa-truncada">Mostrando só as últimas 200 mensagens desta conversa.</Text>
            ) : null}
            {conversa.mensagens.length === 0 ? (
              <Text style={m.footText}>Nenhuma mensagem nesta conversa.</Text>
            ) : null}
            {conversa.mensagens.map(function(msg) {
              var b = bolhaDe(msg.autor);
              return (
                <View key={msg.id} testID={"mensagem-" + msg.id} style={{ alignItems: b.alinha }}>
                  <View style={[m.bolha, { backgroundColor: b.bg }]}>
                    <Text style={[m.bolhaQuem, { color: b.fg }]}>{msg.quem} · {msg.quando}</Text>
                    <Text style={[m.bolhaTexto, { color: b.fg }]}>{msg.texto}</Text>
                  </View>
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
  contatoDados: { flexDirection: "row", flexWrap: "wrap", columnGap: 28, rowGap: 10 },
  linkTel: { fontSize: 14, fontWeight: "600", color: Paleta.accentTexto },
  semEmpresa: { fontSize: 14, color: Colors.ink3 },
  bolha: { maxWidth: "88%", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bolhaQuem: { fontSize: 11, fontWeight: "600", opacity: 0.8 },
  bolhaTexto: { fontSize: 14, lineHeight: 20 },
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
  contato: { gap: 2, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.bg4 },
  contatoTitulo: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.ink },
  contatoTexto: { fontSize: 13, lineHeight: 19, color: Colors.ink2, marginLeft: 60 },
  contatoProximo: { fontSize: 12, color: Paleta.accentTexto, marginLeft: 60 },
  tlRow: { flexDirection: "row", gap: 10 },
  tlData: { width: 50, fontSize: 13, color: Colors.ink3 },
  tlTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.ink2 },
});
