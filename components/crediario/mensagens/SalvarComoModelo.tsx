// ============================================================
// "Salvar como modelo" — o passo dentro da prévia do Cobrar (21/11/2026)
//
// O texto que a lojista editou para ESTA cliente volta a ser modelo: os
// dados da cliente viram variáveis (utils/crediarioMensagem.paraModelo) e a
// tela mostra o resultado, com as variáveis em roxo e "como fica para outra
// cliente", ANTES de gravar. Nada é gravado sem ela tocar em um dos botões.
// Fica dentro do mesmo sheet da prévia (sem modal sobre modal).
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { TextoComVariaveis } from "@/components/crediario/mensagens/TextoComVariaveis";
import {
  DADOS_DE_EXEMPLO, ESCOLHA_SITUACAO, MAX_NOME, SITUACOES, erroDoModelo, paraModelo, preencher,
  type DadosDaMensagem, type ModeloDeMensagem, type Situacao,
} from "@/utils/crediarioMensagem";

export type SalvarModeloComo = "novo" | "atualizar";

/** "Lembrete" já existe → "Lembrete (2)", "(3)"… dentro dos 40 caracteres. */
export function nomeLivre(nome: string, modelos: Array<{ name: string }>): string {
  const usados = new Set(modelos.map((m) => m.name.trim().toLowerCase()));
  if (!usados.has(nome.toLowerCase())) return nome;
  for (let n = 2; n < 100; n++) {
    const sufixo = ` (${n})`;
    const raiz = Array.from(nome).slice(0, MAX_NOME - sufixo.length).join("");
    const tentativa = raiz + sufixo;
    if (!usados.has(tentativa.toLowerCase())) return tentativa;
  }
  return nome;
}

export function SalvarComoModelo(props: {
  modeloAtual: ModeloDeMensagem;
  modelos: ModeloDeMensagem[];
  daAura: boolean;
  limite: number;
  textoEditado: string;
  dados: DadosDaMensagem;
  onVoltar: () => void;
  onSalvar: (como: SalvarModeloComo, m: { name: string; body: string; situation: Situacao | null }) => Promise<void>;
}) {
  const { modeloAtual, modelos, daAura, limite, textoEditado, dados, onVoltar, onSalvar } = props;
  const [nome, setNome] = useState(modeloAtual.name);
  // Abre na situação que o modelo já tem: o seletor mostra o que vai valer.
  // "Não usar sozinho" tira o padrão.
  const [situacao, setSituacao] = useState<Situacao | null>(modeloAtual.situation || null);
  const [salvando, setSalvando] = useState<SalvarModeloComo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const body = useMemo(() => paraModelo(textoEditado, dados, modeloAtual.body), [textoEditado, dados, modeloAtual.body]);
  const exemplo = useMemo(() => preencher(body, DADOS_DE_EXEMPLO).texto, [body]);
  // Os prontos viram da loja no primeiro salvar: "novo" soma 1 aos 4.
  const cheio = !daAura && modelos.length >= limite;

  const padraoDaEscolha = situacao
    ? modelos.find((m) => m.is_default && m.situation === situacao && m.id !== modeloAtual.id) || null
    : null;

  async function salvar(como: SalvarModeloComo) {
    const e = erroDoModelo(nome, body);
    if (e) { setErro(e); return; }
    setErro(null);
    setSalvando(como);
    try {
      // "Salvar como novo" com o mesmo nome do modelo de base vira "Nome (2)".
      const nomeFinal = como === "novo" ? nomeLivre(nome.trim(), modelos) : nome.trim();
      if (nomeFinal !== nome.trim()) setNome(nomeFinal);
      await onSalvar(como, { name: nomeFinal, body, situation: situacao });
    } catch (err: any) {
      setErro(err?.data?.error || err?.message || "Não foi possível salvar o modelo.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <View testID="salvar-modelo">
      <View style={st.head}>
        <Pressable onPress={onVoltar} accessibilityRole="button" accessibilityLabel="Voltar à prévia" style={st.voltar} testID="salvar-modelo-voltar">
          <Icon name="arrow_left" size={15} color={Colors.ink3} />
        </Pressable>
        <Text style={st.title}>Salvar como modelo</Text>
      </View>

      <Text style={st.lbl}>Nome do modelo</Text>
      <TextInput
        style={st.input}
        value={nome}
        onChangeText={(v) => setNome(v.slice(0, MAX_NOME + 5))}
        placeholder="Ex.: Passou do dia + novidade"
        placeholderTextColor={Colors.ink3}
        testID="salvar-modelo-nome"
      />

      <Text style={[st.lbl, { marginTop: 12 }]}>Usar sozinho quando a parcela estiver</Text>
      <View style={st.seg}>
        {SITUACOES.map((s) => (
          <Pressable key={s} onPress={() => setSituacao(s)} accessibilityRole="button"
            accessibilityState={{ selected: situacao === s }}
            style={[st.segItem, situacao === s && st.segOn]} testID={`salvar-modelo-sit-${s}`}>
            <Text style={[st.segTxt, situacao === s && st.segTxtOn]}>{ESCOLHA_SITUACAO[s]}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setSituacao(null)} accessibilityRole="button"
          accessibilityState={{ selected: situacao === null }}
          style={[st.segItem, situacao === null && st.segOn]} testID="salvar-modelo-sit-livre">
          <Text style={[st.segTxt, situacao === null && st.segTxtOn]}>Não usar sozinho</Text>
        </Pressable>
      </View>
      {!!padraoDaEscolha && (
        <Text style={st.mini}>
          "{ESCOLHA_SITUACAO[situacao as Situacao]}" já tem um padrão ({padraoDaEscolha.name}). Se escolher, este passa a ser o padrão.
        </Text>
      )}

      <Text style={[st.lbl, { marginTop: 12 }]}>Seu modelo vai ficar assim</Text>
      <TextoComVariaveis body={body} testID="salvar-modelo-previa" />
      <Text style={st.mini}>O que está em roxo muda sozinho para cada cliente.</Text>

      <Text style={[st.lbl, { marginTop: 12 }]}>Para outra cliente, sairia assim</Text>
      <TextoComVariaveis body={exemplo} verde testID="salvar-modelo-exemplo" />

      {!!erro && <Text style={st.erro} testID="salvar-modelo-erro">{erro}</Text>}
      {cheio && (
        <Text style={st.mini} testID="salvar-modelo-cheio">
          A loja já tem {limite} modelos. Para salvar outro, exclua um em Gerenciar modelos.
        </Text>
      )}

      <View style={st.foot}>
        <Pressable onPress={() => salvar("atualizar")} disabled={!!salvando} accessibilityRole="button"
          style={[st.btn, st.btnGhost]} testID="salvar-modelo-atualizar">
          {salvando === "atualizar"
            ? <ActivityIndicator size="small" color={Colors.violet3} />
            : <Text style={st.btnGhostTxt} numberOfLines={2}>Atualizar "{modeloAtual.name}"</Text>}
        </Pressable>
        <Pressable onPress={() => salvar("novo")} disabled={!!salvando || cheio} accessibilityRole="button"
          style={[st.btn, st.btnV, (cheio || !!salvando) && { opacity: 0.5 }]} testID="salvar-modelo-novo">
          {salvando === "novo"
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.btnVTxt}>Salvar como novo</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  voltar: { width: 36, height: 36, borderRadius: 9, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800", color: Colors.ink },
  lbl: { fontSize: 12, fontWeight: "700", color: Colors.ink2, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 10, fontSize: 14, color: Colors.ink, minHeight: 42,
  },
  seg: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segItem: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 36, justifyContent: "center", backgroundColor: Colors.bg2,
  },
  segOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  segTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  segTxtOn: { color: "#fff" },
  mini: { fontSize: 11.5, color: Colors.ink3, marginTop: 5, lineHeight: 16 },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 10 },
  foot: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  btnGhost: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  btnGhostTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2, textAlign: "center" },
  btnV: { backgroundColor: Colors.violet },
  btnVTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
