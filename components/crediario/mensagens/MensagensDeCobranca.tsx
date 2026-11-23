// ============================================================
// Mensagens de cobrança — Configurações do crediário (21/11/2026)
//
// No lugar dos 5 textos da régua (que nenhum caminho usava): a lista dos
// modelos que o Cobrar oferece. Criar, editar (com botões que inserem a
// variável onde está o cursor), duplicar, excluir e "usar como padrão" por
// situação. Loja que nunca salvou vê os prontos da Aura com "Salvar uma
// cópia". Salva na hora, pela rota dos modelos — não depende do botão
// "Salvar configurações" da tela.
// Ações sempre à mostra (nada de hover-reveal): "Editar" e "⋯" abrem
// embaixo do cartão, no computador e no celular.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { useModelosDeMensagem } from "@/hooks/useModelosDeMensagem";
import {
  ESCOLHA_SITUACAO, MAX_LETRAS, MAX_NOME, ROTULO_SITUACAO, SITUACOES, VARIAVEIS,
  erroDoModelo, inserirVariavel, letras,
  type ModeloDeMensagem, type Situacao,
} from "@/utils/crediarioMensagem";

type Edicao = {
  id: string | "novo";
  /** Pronto da Aura de onde saiu a cópia (toma o lugar dele ao salvar). */
  copiaDe?: ModeloDeMensagem | null;
  name: string;
  body: string;
  situation: Situacao | null;
};

function msgErro(e: any, padrao: string): string {
  return e?.data?.error || e?.message || padrao;
}

export function MensagensDeCobranca({ companyId }: { companyId?: string | null }) {
  const api = useModelosDeMensagem(companyId);
  const { modelos, daAura, limite, reserva, carregando } = api;
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const cheio = !daAura && modelos.length >= limite;

  function abrir(e: Edicao) {
    setEdicao(e); setMenuDe(null); setExcluindo(null); setErro(null); setSel(null);
  }

  async function rodar(fn: () => Promise<unknown>, ok: string, falha: string) {
    setOcupado(true);
    try {
      await fn();
      toast.success(ok);
      return true;
    } catch (e: any) {
      toast.error(msgErro(e, falha));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao() {
    if (!edicao) return;
    const e = erroDoModelo(edicao.name, edicao.body);
    if (e) { setErro(e); return; }
    setErro(null);
    const dados = { name: edicao.name.trim(), body: edicao.body.trim(), situation: edicao.situation };
    const ok = await rodar(
      () => edicao.id === "novo"
        ? api.criar({ ...dados, replaces_aura: edicao.copiaDe?.aura_key || null })
        : api.atualizar(edicao.id, dados),
      "Modelo salvo.", "Não foi possível salvar o modelo.",
    );
    if (ok) setEdicao(null);
  }

  function editor(ehNovo: boolean) {
    if (!edicao) return null;
    const n = letras(edicao.body);
    return (
      <View style={st.editor} testID="mensagens-editor">
        <Text style={st.lbl}>Nome</Text>
        <TextInput style={st.input} value={edicao.name} testID="mensagens-editor-nome"
          onChangeText={(v) => setEdicao({ ...edicao, name: v.slice(0, MAX_NOME + 5) })}
          placeholder="Ex.: Lembrete da loja" placeholderTextColor={Colors.ink3} />
        <Text style={[st.lbl, { marginTop: 10 }]}>Texto</Text>
        <TextInput style={[st.input, st.texto]} value={edicao.body} multiline textAlignVertical="top"
          testID="mensagens-editor-texto"
          onChangeText={(v) => setEdicao({ ...edicao, body: v })}
          onSelectionChange={(ev) => setSel(ev.nativeEvent.selection)}
          placeholder="Oi, {nome}! …" placeholderTextColor={Colors.ink3} />
        <View style={st.vars} accessibilityLabel="Inserir no texto">
          {VARIAVEIS.map((v) => (
            <Pressable key={v.chave} accessibilityRole="button" style={st.varBtn} testID={`mensagens-var-${v.chave}`}
              onPress={() => {
                const r = inserirVariavel(edicao.body, sel, v.chave);
                setEdicao({ ...edicao, body: r.texto });
                setSel({ start: r.cursor, end: r.cursor });
              }}>
              <Text style={st.varTxt}>+ {v.rotulo}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[st.mini, n > MAX_LETRAS && { color: Colors.red }]}>
          Toque para inserir onde o cursor está. {n.toLocaleString("pt-BR")} de 1.000 letras.
        </Text>

        <Text style={[st.lbl, { marginTop: 10 }]}>Usar sozinho quando a parcela estiver</Text>
        <View style={st.seg}>
          {[...SITUACOES, null].map((s) => {
            const on = edicao.situation === s;
            return (
              <Pressable key={s || "livre"} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[st.segItem, on && st.segOn]} testID={`mensagens-editor-sit-${s || "livre"}`}
                onPress={() => setEdicao({ ...edicao, situation: s })}>
                <Text style={[st.segTxt, on && st.segTxtOn]}>{s ? ESCOLHA_SITUACAO[s] : "Não usar sozinho"}</Text>
              </Pressable>
            );
          })}
        </View>

        {!!erro && <Text style={st.erro} testID="mensagens-editor-erro">{erro}</Text>}

        <View style={st.acoes}>
          <Pressable accessibilityRole="button" onPress={salvarEdicao} disabled={ocupado}
            style={[st.btn, st.btnV, ocupado && { opacity: 0.6 }]} testID="mensagens-editor-salvar">
            {ocupado ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnVTxt}>Salvar</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setEdicao(null)} style={st.btn} testID="mensagens-editor-cancelar">
            <Text style={st.btnTxt}>Cancelar</Text>
          </Pressable>
          {!ehNovo && (
            <Pressable accessibilityRole="button" onPress={() => { setExcluindo(edicao.id); }}
              style={[st.btn, { marginLeft: "auto" }]} testID="mensagens-editor-excluir">
              <Text style={[st.btnTxt, { color: Colors.red }]}>Excluir modelo</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  function confirmarExclusao(m: ModeloDeMensagem) {
    return (
      <View style={st.confirma} testID="mensagens-confirmar-exclusao">
        <Text style={st.confirmaTxt}>{`Excluir "${m.name}"? Não dá para desfazer.`}</Text>
        <View style={st.acoes}>
          <Pressable accessibilityRole="button" disabled={ocupado} style={[st.btn, st.btnRed]}
            testID="mensagens-excluir-sim"
            onPress={async () => {
              const ok = await rodar(() => api.excluir(m.id), "Modelo excluído.", "Não foi possível excluir o modelo.");
              if (ok) { setExcluindo(null); setEdicao(null); setMenuDe(null); }
            }}>
            <Text style={st.btnVTxt}>Excluir</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={st.btn} onPress={() => setExcluindo(null)}>
            <Text style={st.btnTxt}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function menu(m: ModeloDeMensagem) {
    return (
      <View style={st.menu} testID={`mensagens-menu-${m.id}`}>
        <Pressable accessibilityRole="button" style={st.menuItem} disabled={ocupado || cheio}
          testID="mensagens-duplicar"
          onPress={async () => {
            const ok = await rodar(
              () => api.criar({ name: Array.from(m.name + " (cópia)").slice(0, MAX_NOME).join(""), body: m.body, situation: null }),
              "Modelo duplicado.", "Não foi possível duplicar o modelo.",
            );
            if (ok) setMenuDe(null);
          }}>
          <Text style={[st.menuTxt, cheio && { opacity: 0.5 }]}>Duplicar</Text>
        </Pressable>
        <Text style={st.menuLbl}>Usar como padrão para</Text>
        <View style={st.seg}>
          {[...SITUACOES, null].map((s) => {
            const on = (m.situation || null) === s;
            return (
              <Pressable key={s || "livre"} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[st.segItem, on && st.segOn]} disabled={ocupado}
                testID={`mensagens-padrao-${s || "livre"}`}
                onPress={async () => {
                  const ok = await rodar(() => api.definirPadrao(m.id, s), "Pronto.", "Não foi possível mudar o padrão.");
                  if (ok) setMenuDe(null);
                }}>
                <Text style={[st.segTxt, on && st.segTxtOn]}>{s ? ESCOLHA_SITUACAO[s] : "Não usar sozinho"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" style={st.menuItem} onPress={() => setExcluindo(m.id)} testID="mensagens-excluir">
          <Text style={[st.menuTxt, { color: Colors.red }]}>Excluir</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="mensagens-de-cobranca">
      <Text style={st.titulo}>Mensagens de cobrança</Text>
      <Text style={st.desc}>
        Os textos que aparecem quando você toca em Cobrar.
        {!daAura && <Text style={st.count}>{` ${modelos.length} de ${limite} modelos`}</Text>}
      </Text>

      {reserva && (
        <Text style={st.aviso} testID="mensagens-reserva">
          Não consegui carregar os modelos da loja agora. O Cobrar usa os textos prontos da Aura enquanto isso.
        </Text>
      )}

      {daAura && !reserva && !carregando && (
        <View style={st.vazio} testID="mensagens-vazio">
          <Text style={st.vazioTit}>Você ainda não salvou nenhum modelo</Text>
          <Text style={st.vazioTxt}>Enquanto isso, o Cobrar usa os textos prontos da Aura. Salve uma cópia de qualquer um para mudar as palavras.</Text>
        </View>
      )}

      {modelos.map((m) => {
        const editando = !!edicao && (edicao.id === m.id || (edicao.id === "novo" && edicao.copiaDe?.id === m.id));
        return (
          <View key={m.id} style={[st.item, editando && st.itemOn]} testID={`mensagens-item-${m.id}`}>
            <View style={st.itemRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={st.tags}>
                  <Text style={st.nome}>{m.name}</Text>
                  {m.origin === "aura" && <View style={st.aura}><Text style={st.auraTxt}>Aura</Text></View>}
                  {!!m.situation && (
                    <View style={st.pad}>
                      <Text style={st.padTxt}>
                        {m.origin === "aura" ? ROTULO_SITUACAO[m.situation] : "padrão · " + ROTULO_SITUACAO[m.situation]}
                      </Text>
                    </View>
                  )}
                </View>
                {!editando && <Text style={st.previa} numberOfLines={2}>{m.body.replace(/\s*\n+\s*/g, " ")}</Text>}
              </View>
              {!editando && (
                <View style={st.itemAcoes}>
                  {m.origin === "aura" ? (
                    <Pressable accessibilityRole="button" style={st.ico} testID={`mensagens-copiar-${m.id}`}
                      onPress={() => abrir({ id: "novo", copiaDe: m, name: m.name, body: m.body, situation: m.situation })}>
                      <Text style={st.icoTxt}>Salvar uma cópia</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable accessibilityRole="button" style={st.ico} testID={`mensagens-editar-${m.id}`}
                        onPress={() => abrir({ id: m.id, name: m.name, body: m.body, situation: m.situation })}>
                        <Text style={st.icoTxt}>Editar</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Mais ações" style={st.ico}
                        testID={`mensagens-mais-${m.id}`}
                        onPress={() => { setExcluindo(null); setMenuDe(menuDe === m.id ? null : m.id); }}>
                        <Text style={st.icoTxt}>⋯</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
            {editando && editor(edicao!.id === "novo")}
            {!editando && menuDe === m.id && excluindo !== m.id && menu(m)}
            {excluindo === m.id && confirmarExclusao(m)}
          </View>
        );
      })}

      {!!edicao && edicao.id === "novo" && !edicao.copiaDe && (
        <View style={[st.item, st.itemOn]}>{editor(true)}</View>
      )}

      {!(edicao && edicao.id === "novo" && !edicao.copiaDe) && (
        <Pressable accessibilityRole="button" disabled={cheio}
          style={[st.novo, cheio && { opacity: 0.5 }]} testID="mensagens-novo"
          onPress={() => abrir({ id: "novo", name: "", body: "", situation: null })}>
          <Text style={st.novoTxt}>{daAura ? "+ Escrever um modelo do zero" : "+ Novo modelo"}</Text>
        </Pressable>
      )}
      {cheio && <Text style={st.mini}>{`A loja já tem ${limite} modelos. Exclua um para criar outro.`}</Text>}
      <Text style={st.mini}>Os modelos são salvos na hora, sem precisar de "Salvar configurações".</Text>
    </View>
  );
}

const st = StyleSheet.create({
  titulo: { fontSize: 14, fontWeight: "800", color: Colors.ink, marginTop: 18 },
  desc: { fontSize: 12, color: Colors.ink3, marginTop: 2, marginBottom: 12, lineHeight: 17 },
  count: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  aviso: { fontSize: 11.5, color: Colors.amber, marginBottom: 10, lineHeight: 16 },
  vazio: {
    alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2,
    backgroundColor: Colors.violetD, borderRadius: 14, padding: 14, marginBottom: 12,
  },
  vazioTit: { fontSize: 13.5, fontWeight: "800", color: Colors.ink, marginBottom: 3, textAlign: "center" },
  vazioTxt: { fontSize: 12, color: Colors.ink2, textAlign: "center", lineHeight: 17 },
  item: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 11, marginBottom: 9, backgroundColor: Colors.bg2 },
  itemOn: { borderColor: Colors.violet },
  itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  nome: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  aura: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  auraTxt: { fontSize: 10.5, fontWeight: "800", color: Colors.violet3 },
  pad: { backgroundColor: Colors.greenD, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  padTxt: { fontSize: 10.5, fontWeight: "700", color: Colors.green },
  previa: { fontSize: 12, color: Colors.ink3, marginTop: 4, lineHeight: 17 },
  itemAcoes: { flexDirection: "row", gap: 6, flexShrink: 0 },
  ico: {
    minWidth: 40, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3, paddingHorizontal: 9, alignItems: "center", justifyContent: "center",
  },
  icoTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  editor: { marginTop: 10 },
  lbl: { fontSize: 12, fontWeight: "700", color: Colors.ink2, marginBottom: 5 },
  input: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 9, fontSize: 13.5, color: Colors.ink, minHeight: 42,
  },
  texto: { minHeight: 140, lineHeight: 20 },
  vars: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  varBtn: {
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD, borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 6, minHeight: 36, justifyContent: "center",
  },
  varTxt: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  mini: { fontSize: 11.5, color: Colors.ink3, marginTop: 6, lineHeight: 16 },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segItem: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7,
    minHeight: 36, justifyContent: "center", backgroundColor: Colors.bg3,
  },
  segOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  segTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  segTxtOn: { color: "#fff" },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 9 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" },
  btn: {
    minHeight: 40, borderRadius: 10, paddingHorizontal: 13, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  btnTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
  btnV: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnRed: { backgroundColor: Colors.red, borderColor: Colors.red },
  btnVTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  menu: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, gap: 6 },
  menuItem: { minHeight: 40, justifyContent: "center" },
  menuTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  menuLbl: { fontSize: 11.5, fontWeight: "700", color: Colors.ink3, marginTop: 2 },
  confirma: { marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  confirmaTxt: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  novo: {
    minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  novoTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
});
