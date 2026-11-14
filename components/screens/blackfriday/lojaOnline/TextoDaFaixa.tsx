// ============================================================================
// AURA. — Black Friday na loja online · "escreva o seu texto" (p-122)
//
// Pedido do Caio (14/11/2026): abaixo das três opções prontas (que seguem
// como atalhos), dois campos opcionais:
//   - Título da faixa (até 28, contador "12/28"): vale na faixa fina e no
//     título da faixa grande. A loja mostra em caixa alta.
//   - Frase da faixa grande (até 90): vazio = o texto padrão.
// O "até N% OFF" e a data seguem calculados pelo servidor. Campo vazio volta
// à opção pronta. Prévia ao vivo da faixa fina com 375 px, do jeito que a
// cliente vê no celular (quebra em duas linhas com título longo).
// As regras moram em regrasTextoDaFaixa.ts (as mesmas do servidor, que confere de
// novo e devolve 422 com a mensagem).
// ============================================================================
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import type { EstadoDaCampanha, MudancaDaCampanha } from "@/services/campanhaLojaApi";
import { diaMes } from "./regrasCampanhaLoja";
import {
  LIMITE_DA_FRASE, LIMITE_DO_TITULO, contar, erroDoTexto, frasePadrao, normalizar, partesDaFaixaFina,
} from "./regrasTextoDaFaixa";

type Props = {
  estado: EstadoDaCampanha;
  /** Grava (a seção troca o estado pelo do servidor). Erro: mensagem pronta. */
  onSalvar: (mudanca: MudancaDaCampanha) => Promise<string | null>;
};

export function TextoDaFaixa({ estado, onSalvar }: Props) {
  var limiteTitulo = (estado.limites && estado.limites.titulo) || LIMITE_DO_TITULO;
  var limiteFrase = (estado.limites && estado.limites.frase) || LIMITE_DA_FRASE;
  var [titulo, setTitulo] = useState(estado.titulo_texto || "");
  var [frase, setFrase] = useState(estado.frase_texto || "");
  var [salvando, setSalvando] = useState(false);
  var [erroServidor, setErroServidor] = useState<string | null>(null);
  var [salvo, setSalvo] = useState(false);

  // O servidor mudou (outra aba, recarga): o campo acompanha.
  useEffect(function () { setTitulo(estado.titulo_texto || ""); }, [estado.titulo_texto]);
  useEffect(function () { setFrase(estado.frase_texto || ""); }, [estado.frase_texto]);

  var pronto = (estado.titulos.find(function (t) { return t.id === estado.titulo; }) || { texto: "Black Friday" }).texto;
  var ate = diaMes(estado.promocoes.ate_data || (estado.periodo_padrao && estado.periodo_padrao.fim));
  var erroTitulo = erroDoTexto(titulo, limiteTitulo, "O título da faixa");
  var erroFrase = erroDoTexto(frase, limiteFrase, "A frase da faixa grande");
  var mudou = normalizar(titulo) !== normalizar(estado.titulo_texto) || normalizar(frase) !== normalizar(estado.frase_texto);
  var podeSalvar = mudou && !erroTitulo && !erroFrase && !salvando;
  var tituloNaFaixa = erroTitulo ? pronto : (normalizar(titulo) || pronto);

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    setErroServidor(null);
    setSalvo(false);
    var t = normalizar(titulo);
    var f = normalizar(frase);
    var erro = await onSalvar({ titulo_texto: t || null, frase_texto: f || null });
    setSalvando(false);
    if (erro) setErroServidor(erro);
    else setSalvo(true);
  }

  return (
    <View style={s.wrap} testID="bf-loja-texto">
      <Text style={s.lab}>Ou escreva o seu título</Text>
      <TextInput
        value={titulo}
        onChangeText={function (v) { setTitulo(v); setSalvo(false); }}
        placeholder={pronto}
        placeholderTextColor={Colors.ink3}
        maxLength={limiteTitulo + 8}
        style={[s.campo, !!erroTitulo && s.campoErro]}
        accessibilityLabel="Título da faixa"
        testID="bf-loja-titulo-texto"
      />
      <View style={s.linhaInfo}>
        <Text style={[s.dica, !!erroTitulo && s.erro]} testID="bf-loja-titulo-texto-ajuda">
          {erroTitulo || "Vale na faixa fina e no título da faixa grande. Vazio = o título escolhido acima."}
        </Text>
        <Text style={[s.contador, contar(normalizar(titulo)) > limiteTitulo && s.erro]} testID="bf-loja-titulo-texto-contador">
          {contar(normalizar(titulo)) + "/" + limiteTitulo}
        </Text>
      </View>

      <Text style={[s.lab, { marginTop: 10 }]}>Frase da faixa grande (opcional)</Text>
      <TextInput
        value={frase}
        onChangeText={function (v) { setFrase(v); setSalvo(false); }}
        placeholder={frasePadrao(ate)}
        placeholderTextColor={Colors.ink3}
        maxLength={limiteFrase + 8}
        style={[s.campo, !!erroFrase && s.campoErro]}
        accessibilityLabel="Frase da faixa grande"
        testID="bf-loja-frase-texto"
      />
      <View style={s.linhaInfo}>
        <Text style={[s.dica, !!erroFrase && s.erro]} testID="bf-loja-frase-texto-ajuda">
          {erroFrase || "Aparece embaixo do “Até N% OFF” na página inicial. Vazio = o texto padrão."}
        </Text>
        <Text style={[s.contador, contar(normalizar(frase)) > limiteFrase && s.erro]} testID="bf-loja-frase-texto-contador">
          {contar(normalizar(frase)) + "/" + limiteFrase}
        </Text>
      </View>

      <Text style={[s.lab, { marginTop: 10 }]}>Prévia no celular</Text>
      <View style={s.previa} testID="bf-loja-previa">
        <Text style={s.previaTxt} testID="bf-loja-previa-texto">
          {partesDaFaixaFina(tituloNaFaixa, estado.promocoes.ate_pct, ate).map(function (p, i) {
            return (
              <React.Fragment key={i}>
                {i > 0 && <Text style={s.previaSep}>{"  ·  "}</Text>}
                {p}
              </React.Fragment>
            );
          })}
        </Text>
      </View>

      <View style={s.acoes}>
        <Pressable
          style={[s.btnP, !podeSalvar && { opacity: 0.45 }]}
          onPress={salvar}
          disabled={!podeSalvar}
          accessibilityRole="button"
          accessibilityState={{ disabled: !podeSalvar, busy: salvando }}
          testID="bf-loja-texto-salvar"
        >
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPTxt}>Salvar o texto</Text>}
        </Pressable>
        {salvo && !mudou && <Text style={s.ok} testID="bf-loja-texto-salvo">Salvo. A loja mostra em até 1 minuto.</Text>}
      </View>
      {!!erroServidor && <Text style={[s.dica, s.erro]} testID="bf-loja-texto-erro">{erroServidor}</Text>}
    </View>
  );
}

var s = StyleSheet.create({
  wrap: { marginTop: 12, gap: 4 },
  lab: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  campo: {
    minHeight: 44, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: Colors.bg3, color: Colors.ink, fontSize: 14,
  },
  campoErro: { borderColor: Colors.red },
  linhaInfo: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dica: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  erro: { color: Colors.red },
  contador: { fontSize: 12, color: Colors.ink3, fontVariant: ["tabular-nums"] },
  // A faixa fina da loja, com a largura de um celular (375 px).
  previa: {
    width: "100%", maxWidth: 375, backgroundColor: "#0a0a0a", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10, marginTop: 2,
  },
  previaTxt: { color: "#f5c542", fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, textAlign: "center", lineHeight: 15 },
  previaSep: { color: "#fff", fontWeight: "500" },
  acoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 },
  btnP: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  ok: { fontSize: 12.5, color: Colors.green },
});

export default TextoDaFaixa;
