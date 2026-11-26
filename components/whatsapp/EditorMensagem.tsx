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
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
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

  return (
    <View style={s.card} testID="wa-editor">
      <Pressable onPress={onFechar} accessibilityRole="button" style={s.btnLink} testID="wa-editor-voltar">
        <Text style={s.btnLinkTxt}>← Voltar</Text>
      </Pressable>
      <Text style={s.titulo}>Do seu jeito</Text>
      <Text style={s.sub}>Mude o texto à vontade. A Aura cuida das regras do WhatsApp.</Text>
      <Text style={s.meta}>{modelo.titulo}</Text>

      {diferenteDaAura && (
        <Pressable onPress={voltarAura} disabled={enviando} accessibilityRole="button" style={s.btnLink} testID="wa-editor-voltar-aura">
          <Text style={s.btnLinkTxt}>Voltar ao texto da Aura</Text>
        </Pressable>
      )}

      <Text style={s.sub}>Escreva como você fala com a cliente. Os campos roxos a Aura preenche sozinha.</Text>
      <TextInput
        value={texto}
        onChangeText={(t) => { if (!travado) setTexto(t); }}
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

      <Text style={s.meta}>Toque para colocar no texto:</Text>
      <View style={s.linhaBtns}>
        {campos.map((c) => (
          <Pressable
            key={c} onPress={() => inserir(c)} disabled={travado}
            accessibilityRole="button" accessibilityLabel={`Colocar o campo ${c}`}
            style={[s.btnCampo, travado && { opacity: 0.6 }]} testID={`wa-editor-campo-${c}`}
          >
            <Text style={s.btnCampoTxt}>+ {c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 8 }} testID="wa-editor-checks">
        {v.checks.map((c) => (
          <View key={c.id} style={s.check} testID={`wa-editor-check-${c.id}`}>
            <Text style={[s.mark, { color: c.ok ? Colors.green : Colors.amber }]}>{c.ok ? "✓" : "!"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.checkTxt, !c.ok && { color: Colors.ink }]}>{c.texto}</Text>
              {!c.ok && !!c.correcao && !travado && (
                <Pressable
                  onPress={() => setTexto(aplicarCorrecao(texto, c))}
                  accessibilityRole="button" style={s.btnLink} testID={`wa-editor-corrigir-${c.id}`}
                >
                  <Text style={s.btnLinkTxt}>
                    {c.correcao === "PONTO_FINAL" ? "Pôr um ponto final" : c.correcao === "SEPARAR" ? "Separar" : "Tirar o trecho amarelo"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>

      <Text style={s.meta}>{usandoExemplo ? "Como chega (cliente de exemplo)" : `Como chega para ${atual.nome}`}</Text>
      {!usandoExemplo && (
        <View style={s.linhaBtns}>
          {clientes.map((c, i) => (
            <Pressable
              key={c.nome + i} onPress={() => setCliente(i)} accessibilityRole="button"
              style={[s.pilula, i === cliente && s.pilulaOn]} testID={`wa-editor-cliente-${i}`}
            >
              <Text style={[s.pilulaTxt, i === cliente && s.pilulaTxtOn]}>{c.nome}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.bolha} testID="wa-editor-previa">
        <Text style={s.bolhaTxt}>{preview}</Text>
      </View>

      {enviado ? (
        <View style={{ gap: 4 }} testID="wa-editor-enviado">
          <Text style={s.ok}>Enviado para aprovação.</Text>
          <Text style={s.sub}>Até a resposta, {aviso} saem com o texto atual. A Aura avisa no sino quando o seu passar a valer.</Text>
        </View>
      ) : (
        <>
          <Pressable
            onPress={enviar} disabled={!pode}
            accessibilityRole="button" accessibilityState={{ disabled: !pode }}
            style={[s.btnPrim, !pode && { opacity: 0.45 }]} testID="wa-editor-enviar"
          >
            {enviando && <ActivityIndicator size="small" color="#fff" />}
            <Text style={s.btnPrimTxt}>Mandar para aprovação</Text>
          </Pressable>
          {!!limite ? (
            <Text style={s.aviso} testID="wa-editor-limite">{limite}</Text>
          ) : !v.ok ? (
            <Text style={s.aviso} testID="wa-editor-ajuste">Ajuste o item amarelo para mandar</Text>
          ) : (
            <Text style={s.sub}>O WhatsApp confere todo texto novo. Costuma levar algumas horas; até lá vai o texto atual.</Text>
          )}
        </>
      )}
      {!!erro && <Text style={s.erro} testID="wa-editor-erro">{erro}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  titulo: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  meta: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  input: {
    minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
    padding: 12, fontSize: 14, lineHeight: 21, color: Colors.ink, textAlignVertical: "top",
  },
  pilulasTexto: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  palavra: { fontSize: 13, color: Colors.ink2 },
  tok: {
    fontSize: 12.5, fontWeight: "700", color: Colors.violet3, backgroundColor: Colors.violetD,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: "hidden",
  },
  linhaBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnCampo: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
  },
  btnCampoTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  mark: { fontSize: 14, fontWeight: "800", width: 16, textAlign: "center" },
  checkTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  pilula: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2,
  },
  pilulaOn: { backgroundColor: Colors.violetD, borderColor: Colors.violet3 },
  pilulaTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  pilulaTxtOn: { color: Colors.violet3, fontWeight: "800" },
  bolha: { backgroundColor: Colors.violetD, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 12 },
  bolhaTxt: { fontSize: 13.5, color: Colors.ink, lineHeight: 20 },
  btnPrim: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48,
    backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 16,
  },
  btnPrimTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  btnLinkTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  ok: { fontSize: 13, fontWeight: "800", color: Colors.green },
  aviso: { fontSize: 12, fontWeight: "600", color: Colors.amber, lineHeight: 17 },
  erro: { fontSize: 12, fontWeight: "600", color: Colors.red, lineHeight: 17 },
} as any);
