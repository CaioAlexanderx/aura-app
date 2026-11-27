// ============================================================
// EditorMensagem — "Do seu jeito" (artboard Editor)
//
// A lojista muda o texto de um modelo; a Aura cuida das regras do WhatsApp:
//   - campos em pílula que a Aura preenche ({Nome}, {Parcela}...), com os
//     botões "+ Nome", "+ Parcela" para pôr no cursor;
//   - prévia com 3 clientes reais da loja (nome, parcela, valor);
//   - conferência ao vivo, com a correção em um toque: termina em campo,
//     campos colados, oferta num aviso, 1.024 letras (a mesma função do
//     servidor, em waMensagem.ts — o servidor confere de novo ao salvar);
//   - "Mandar para aprovação": só abre com tudo certo. Texto novo só vale
//     depois do WhatsApp aprovar; até lá vai o anterior. Limite de edição
//     (1 a cada 24 h, 10 a cada 30 dias) vem como EDICAO_LIMITE_24H/30D.
// Overlay não: o editor abre no lugar da lista (dentro do shell).
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { BtnPrimario, BtnTracejado, Lnk, Meta, Pilula, Selo, Superficie, Titulo, V, EDITOR_INLINE, estiloBolha, t } from "./waVidro";
import { EditorInline } from "./EditorInline";
import { waConfigApi, erroConfig, type WaModeloRaw } from "@/services/waConfigApi";
import { aplicarCorrecao, inserirCampo, renderizar, segmentos, validar } from "./waMensagem";
import type { ClientePrevia } from "./waPreviaClientes";

interface Props {
  companyId: string;
  modelo: WaModeloRaw;
  clientes: ClientePrevia[];
  onFechar: () => void;
  /** Mudou algo no servidor (enviou, restaurou): o pai recarrega os modelos. */
  onMudou: () => void;
}

function quando(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} às ${hh}:${mi}`;
}

/** Frase do limite de edição lida do modelo (antes de tentar enviar). */
export function limiteDeEdicao(modelo: WaModeloRaw): string | null {
  const e = modelo.edicao;
  if (!e || e.pode !== false) return null;
  const q = quando(e.proxima_em);
  if (e.restam_30_dias === 0) return `Você usou as 10 edições dos últimos 30 dias deste texto.${q ? ` Poderá editar de novo em ${q}.` : ""}`;
  return `Este texto já foi editado hoje.${q ? ` Poderá editar de novo em ${q}.` : ""}`;
}

export function EditorMensagem({ companyId, modelo, clientes, onFechar, onMudou }: Props) {
  const campos = modelo.campos || [];
  const categoria = modelo.categoria || "UTILITY";
  const emUso = modelo.texto_em_uso || "";
  const [texto, setTexto] = useState<string>(modelo.texto_novo || emUso);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: emUso.length, end: emUso.length });
  const [cliente, setCliente] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const v = useMemo(() => validar({ campos, categoria }, texto), [campos, categoria, texto]);
  const limite = limiteDeEdicao(modelo);
  const semMudanca = texto.trim() === emUso.trim();
  const travado = enviado || enviando;
  const pode = v.ok && !semMudanca && !limite && !travado && modelo.estado !== "EM_APROVACAO";

  const usandoExemplo = clientes.length === 0;
  const atual = clientes[Math.min(cliente, Math.max(clientes.length - 1, 0))];
  const preview = usandoExemplo ? renderizar(texto) : renderizar(texto, atual.valores, false);

  const inserir = useCallback((campo: string) => {
    if (travado) return;
    const r = inserirCampo(texto, campo, sel.start, sel.end);
    setTexto(r.texto);
    setSel({ start: r.cursor, end: r.cursor });
  }, [texto, sel, travado]);

  const enviar = useCallback(async () => {
    if (!pode) return;
    setEnviando(true);
    setErro(null);
    try {
      await waConfigApi.enviarModelo(companyId, String(modelo.key), texto.trim());
      setEnviado(true);
      onMudou();
    } catch (e: any) {
      const er = erroConfig(e);
      if (er.code === "EDICAO_LIMITE_24H" || er.code === "EDICAO_LIMITE_30D") {
        const q = quando(er.data?.proxima_em);
        setErro(`${er.message}${q ? ` Poderá editar de novo em ${q}.` : ""}`);
      } else {
        setErro(er.message);
      }
    } finally {
      setEnviando(false);
    }
  }, [pode, companyId, modelo.key, texto, onMudou]);

  const voltarAura = useCallback(async () => {
    setEnviando(true);
    setErro(null);
    try {
      await waConfigApi.restaurarModelo(companyId, String(modelo.key));
      onMudou();
      onFechar();
    } catch (e: any) {
      setErro(erroConfig(e).message);
    } finally {
      setEnviando(false);
    }
  }, [companyId, modelo.key, onMudou, onFechar]);

  const diferenteDaAura = !!modelo.texto_novo || (modelo.texto_padrao != null && emUso !== modelo.texto_padrao);
  const aviso = categoria === "UTILITY" ? "os avisos" : "as mensagens";
  const trechoOferta = v.checks.find((c) => c.id === "oferta" && !c.ok)?.trecho || null;
  const donoMeta = `${modelo.automatica === "crediario" ? "Crediário" : modelo.automatica === "aniversario" ? "Aniversário" : modelo.automatica === "venda_mais" ? "Venda+" : "Mensagem"} · ${categoria === "UTILITY" ? "aviso" : "novidade"}`;
  const partesPrevia = segmentos(texto).map((g) => ({
    campo: g.campo,
    v: g.campo ? renderizar(`{${g.v}}`, usandoExemplo ? undefined : atual.valores, usandoExemplo) : g.v,
  }));

  return (
    <View style={{ gap: 26 }} testID="wa-editor">
      <View style={{ gap: 10 }}>
        <Lnk onPress={onFechar} testID="wa-editor-voltar" style={{ minHeight: 32, paddingHorizontal: 0 }}>← Voltar</Lnk>
        <Titulo tamanho={52}>Do seu jeito</Titulo>
        <Text style={t(18, V.ink2, "400", { lineHeight: 26 })}>Mude o texto à vontade. A Aura cuida das regras do WhatsApp.</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        <Superficie variante="glass" raio={30} padding={{ h: 30, v: 26 }} gap={18} style={{ flexGrow: 999, flexShrink: 1, flexBasis: 640 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View>
              <Meta>{donoMeta}</Meta>
              <Text style={t(24, V.ink, "800", { letterSpacing: -0.7, lineHeight: 30 })}>{modelo.titulo}</Text>
            </View>
            {diferenteDaAura && (
              <Lnk onPress={voltarAura} desabilitado={enviando} testID="wa-editor-voltar-aura">Voltar ao texto da Aura</Lnk>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={t(14, V.ink2)}>Escreva como você fala com a cliente. Os campos roxos a Aura preenche sozinha.</Text>
            {EDITOR_INLINE ? (
              <EditorInline
                valor={texto} cursor={sel.start} travado={travado} destaque={trechoOferta}
                onChange={(tx) => { if (!travado) setTexto(tx); }}
                onSel={(a, b) => setSel({ start: a, end: b })}
                testID="wa-editor-texto"
              />
            ) : (
              <>
                <TextInput
                  value={texto}
                  onChangeText={(tx) => { if (!travado) setTexto(tx); }}
                  onSelectionChange={(e) => setSel({ start: e.nativeEvent.selection.start, end: e.nativeEvent.selection.end })}
                  selection={sel}
                  editable={!travado}
                  multiline
                  style={[s.input, travado && { opacity: 0.6 }]}
                  accessibilityLabel="Texto da mensagem"
                  testID="wa-editor-texto"
                />
                <View style={s.pilulasTexto} testID="wa-editor-pilulas">
                  {segmentos(texto).map((g, i) => (
                    <Text key={i} style={g.campo ? s.tok : s.palavra}>{g.v}</Text>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={t(14, V.ink2)}>Toque para colocar no texto:</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {campos.map((c) => (
                <Pilula key={c} peq onPress={() => inserir(c)} desabilitado={travado} testID={`wa-editor-campo-${c}`}>
                  <Text accessibilityLabel={`Colocar o campo ${c}`} style={t(13, V.ink, "600")}>+ {c}</Text>
                </Pilula>
              ))}
            </View>
          </View>

          <Superficie variante="dry" raio={22} padding={{ h: 18, v: 16 }} gap={10}>
            <View style={{ gap: 10 }} testID="wa-editor-checks">
              {v.checks.map((c) => (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }} testID={`wa-editor-check-${c.id}`}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.ok ? V.okBg : V.warnBg }}>
                    <Text style={t(13, c.ok ? V.ok : V.warn, "800", { lineHeight: 16 })}>{c.ok ? "✓" : "!"}</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4 }}>
                    <Text style={t(14, c.ok ? V.ink2 : V.ink)}>{c.texto}</Text>
                    {!c.ok && !!c.correcao && !travado && (
                      <Pilula peq ligada onPress={() => setTexto(aplicarCorrecao(texto, c))} testID={`wa-editor-corrigir-${c.id}`}>
                        <Text style={t(13, V.onTxt, "600")}>
                          {c.correcao === "PONTO_FINAL" ? "Pôr um ponto final" : c.correcao === "SEPARAR" ? "Separar" : "Tirar o trecho amarelo"}
                        </Text>
                      </Pilula>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Superficie>
        </Superficie>

        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, maxWidth: 420, minWidth: 0, gap: 18 }}>
          <Superficie variante="solid" raio={34} padding={14} gap={12}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: V.rule }}>
              <Text style={t(13, V.ink3)} accessibilityLabel={usandoExemplo ? "Como chega (cliente de exemplo)" : `Como chega para ${atual.nome}`}>{usandoExemplo ? "Como chega (cliente de exemplo)" : "Como chega para"}</Text>
              {!usandoExemplo && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {clientes.map((c, i) => (
                    <Pilula key={c.nome + i} peq role="radio" ligada={i === cliente} onPress={() => setCliente(i)} testID={`wa-editor-cliente-${i}`}>
                      <Text style={t(13, i === cliente ? V.onTxt : V.ink, "600")}>{c.nome}</Text>
                    </Pilula>
                  ))}
                </View>
              )}
            </View>
            <View style={{ minHeight: 240, justifyContent: "flex-end", padding: 6 }}>
              <View style={estiloBolha()} testID="wa-editor-previa">
                <Text style={t(15, V.ink, "400", { lineHeight: 22 })} accessibilityLabel={partesPrevia.map((p) => p.v).join("")}>
                  {partesPrevia.map((p, i) => (
                    <Text key={i} style={p.campo ? { fontWeight: "700" } : undefined}>{p.v}</Text>
                  ))}
                </Text>
                <Text style={t(12, V.ink3, "400", { marginTop: 4, textAlign: "right" })}>9:00</Text>
              </View>
            </View>
          </Superficie>

          {enviado ? (
            <Superficie variante="dry" raio={24} padding={{ h: 18, v: 16 }} gap={6}>
              <View testID="wa-editor-enviado" style={{ gap: 6 }}>
                <Text style={t(17, V.ink, "700")}>Enviado para aprovação.</Text>
                <Text style={t(14, V.ink2)}>Até a resposta, {aviso} saem com o texto atual. A Aura avisa no sino quando o seu passar a valer.</Text>
              </View>
            </Superficie>
          ) : (
            <View style={{ gap: 10, alignItems: "flex-start" }}>
              {pode ? (
                <BtnPrimario onPress={enviar} disabled={false} carregando={enviando} testID="wa-editor-enviar">Mandar para aprovação</BtnPrimario>
              ) : (
                <BtnTracejado testID="wa-editor-enviar" disabled onPress={() => {}}>
                  {limite ? "Edição indisponível agora" : "Ajuste o item amarelo para mandar"}
                </BtnTracejado>
              )}
              {!!limite ? (
                <Text style={s.aviso} testID="wa-editor-limite">{limite}</Text>
              ) : !v.ok ? (
                <Text style={s.aviso} testID="wa-editor-ajuste">Ajuste o item amarelo para mandar</Text>
              ) : (
                <Text style={t(13, V.ink3)}>O WhatsApp confere todo texto novo. Costuma levar algumas horas; até lá vai o texto atual.</Text>
              )}
            </View>
          )}
          {!!erro && <Text style={s.erro} testID="wa-editor-erro">{erro}</Text>}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Meta>Depois de mandar</Meta>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <Superficie variante="solid" raio={24} padding={{ h: 20, v: 18 }} gap={6} style={{ flexGrow: 1, flexBasis: 300 }}>
            <Selo texto="Em aprovação" tom="warn" />
            <Text style={t(14, V.ink2)}>Na lista de mensagens, com o texto novo apagado e o atual valendo.</Text>
          </Superficie>
          <Superficie variante="solid" raio={24} padding={{ h: 20, v: 18 }} gap={6} style={{ flexGrow: 1, flexBasis: 300 }}>
            <Selo texto="Aprovado" tom="ok" />
            <Text style={t(14, V.ink2)}>{'No sino: "Seu texto de \'' + modelo.titulo + '\' já está valendo."'}</Text>
          </Superficie>
          <Superficie variante="solid" raio={24} padding={{ h: 20, v: 18 }} gap={8} style={{ flexGrow: 1, flexBasis: 300 }}>
            <Selo texto="Não aprovado" tom="danger" />
            <Text style={t(14, V.ink2)}>"O WhatsApp achou que o texto parece propaganda. O texto atual continua valendo."</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Pilula peq ligada><Text style={t(13, V.onTxt, "600")}>Ajustar para mim</Text></Pilula>
              <Pilula peq><Text style={t(13, V.ink, "600")}>Ficar com o da Aura</Text></Pilula>
            </View>
          </Superficie>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: V.campoLine, backgroundColor: V.campoBg,
    padding: 12, fontSize: 14, lineHeight: 21, color: V.ink, textAlignVertical: "top",
  },
  pilulasTexto: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  palavra: { fontSize: 13, color: V.ink2 },
  tok: {
    fontSize: 12.5, fontWeight: "700", color: V.tokTxt, backgroundColor: V.tokBg,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: "hidden",
  },
  aviso: { fontSize: 13, fontWeight: "600", color: V.warn, lineHeight: 18 },
  erro: { fontSize: 13, fontWeight: "600", color: V.bad, lineHeight: 18 },
} as any);