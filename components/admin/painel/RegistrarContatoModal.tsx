// ============================================================
// Gestão Aura › Registrar contato (14/10/2026)
//
// O botão da ficha do cliente (Hoje e Clientes) e o verbo dos alertas do
// Painel abrem este modal. Grava em POST /admin/painel/contatos (empresa ou
// lead); a Cassie lê o resultado na rodada das 7h30.
//
// Passo único (não é wizard: o molde do TrocaModal é para multi-passo), mas
// no mesmo DNA do modal da Gestão Aura: cabeçalho com ícone, chips, rodapé
// com Cancelar e a ação principal desabilitada até o formulário ficar válido.
// Mockup: docs/mockups/registrar-contato.html. Meta: 10 segundos.
//
// Regras e opções em registrarContato.ts (puro, testado à parte).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi } from "@/services/adminApi";
import type { PainelApiContatoSalvo } from "@/services/adminApi";
import { PainelModal } from "./PainelModal";
import { Paleta } from "./paleta";
import { useFichaCliente } from "./usePainelHoje";
import {
  ATALHOS_DE_DATA, CANAIS, COMO_CHEGOU, FIADO, MARCADORES, MAX_FRASE, MAX_PROXIMO_PASSO, MOTIVOS, QUEM_DECIDE,
  RESULTADOS, formVazio, hojeBRT, montarCorpo, rotuloDaData, somarDias, validar,
} from "./registrarContato";
import type { FormContato, Opcao } from "./registrarContato";

// Para quem é o contato: uma empresa (company_id) ou um lead sem conta.
export type AlvoRegistro = {
  company_id?: string;
  lead_id?: string;
  // Sem nome (verbo do alerta), o modal lê da ficha da loja.
  nome?: string;
  telefone?: string | null;
  // O que a ficha já tem no check-in: como_chegou vale uma vez por conta.
  // Sem isto, o modal lê da ficha da loja.
  checkinAtual?: Record<string, any> | null;
};

type Props = {
  alvo: AlvoRegistro | null;
  onClose: () => void;
  onSalvo?: (salvo: PainelApiContatoSalvo, alvo: AlvoRegistro) => void;
};

function Chips<T extends string>(props: {
  prefixo: string;
  opcoes: Opcao<T>[];
  valor: T | null;
  onEscolher: (id: T | null) => void;
  alternavel?: boolean;          // tocar de novo desmarca
  grade?: boolean;
}) {
  return (
    <View style={props.grade ? c.grade : c.chips}>
      {props.opcoes.map(function(o) {
        var on = props.valor === o.id;
        var tom = on && o.tom === "risco" ? c.chipRisco : on && o.tom === "bom" ? c.chipBom : on ? c.chipOn : null;
        return (
          <Pressable
            key={o.id}
            testID={props.prefixo + "-" + o.id}
            onPress={function() { props.onEscolher(on && props.alternavel ? null : o.id); }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[c.chip, props.grade && c.chipGrade, tom]}
          >
            <Text style={[c.chipText, on && { fontWeight: "700", color: o.tom === "risco" ? Colors.red : o.tom === "bom" ? Colors.green : Paleta.accentTexto }]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RegistrarContatoModal(props: Props) {
  var qc = useQueryClient();
  var alvo = props.alvo;
  // A ficha (em cache quando veio dela) dá nome, telefone e o check-in atual.
  var { ficha } = useFichaCliente(alvo && alvo.company_id ? alvo.company_id : null);
  var nomeDoAlvo = alvo ? (alvo.nome || (ficha && ficha.nome) || "Loja") : "";
  var telefoneDoAlvo = alvo ? (alvo.telefone !== undefined ? alvo.telefone : (ficha && ficha.telefone) || null) : null;
  var checkinDoAlvo = alvo ? (alvo.checkinAtual !== undefined ? alvo.checkinAtual : (ficha && ficha.checkin) || null) : null;
  var chaveDoAlvo = alvo ? (alvo.company_id || alvo.lead_id || "") : "";
  var [form, setForm] = useState<FormContato>(formVazio);
  var [tentou, setTentou] = useState(false);
  var [enviando, setEnviando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);
  var [checkinAberto, setCheckinAberto] = useState(false);

  // Abrir para outra loja começa limpo: nada vaza entre contatos.
  useEffect(function() {
    setForm(formVazio());
    setTentou(false);
    setEnviando(false);
    setErro(null);
    setCheckinAberto(false);
  }, [chaveDoAlvo]);

  var hoje = hojeBRT();
  var { ok, erros } = useMemo(function() { return validar(form); }, [form]);
  var dataEscolhida = form.dias ? somarDias(hoje, form.dias) : null;
  var comoChegouAtual = checkinDoAlvo && typeof checkinDoAlvo.como_chegou === "string" ? checkinDoAlvo.como_chegou : null;
  var rotuloComoChegouAtual = comoChegouAtual
    ? (COMO_CHEGOU.filter(function(o) { return o.id === comoChegouAtual; })[0] || { rotulo: comoChegouAtual }).rotulo
    : null;

  function mudar(parcial: Partial<FormContato>) {
    setForm(function(f) { return { ...f, ...parcial }; });
    if (erro) setErro(null);
  }

  async function salvar() {
    if (!alvo || enviando) return;
    setTentou(true);
    if (!ok) return;
    var destino = alvo.company_id ? { company_id: alvo.company_id } : { lead_id: alvo.lead_id as string };
    setEnviando(true);
    setErro(null);
    try {
      var salvo = await adminApi.painel.contatos.registrar(montarCorpo(form, destino, hoje));
      toast.success("Contato registrado.");
      // A ficha (linha do tempo e contatos) e as notas da loja mudaram.
      qc.invalidateQueries({ queryKey: ["admin-painel-ficha"] });
      if (alvo.company_id) qc.invalidateQueries({ queryKey: ["admin-client-notes", alvo.company_id] });
      if (alvo.company_id && form.comoChegou && salvo && salvo.checkin_gravado === false) {
        toast.info("O contato entrou, mas o check-in ainda não pôde ser gravado.");
      }
      if (props.onSalvo) props.onSalvo(salvo, alvo);
      props.onClose();
    } catch (e: any) {
      // Mensagem do backend (400 com o campo, 404, 503 migration pendente).
      setErro((e && e.message) || "Não consegui salvar o contato. Confira a conexão e tente de novo; nada foi gravado.");
    } finally {
      setEnviando(false);
    }
  }

  var mostrarErros = tentou;
  var podeSalvar = ok && !enviando;

  return (
    <PainelModal
      visible={!!alvo}
      id="registrar-contato"
      titulo="Registrar contato"
      subtitulo={alvo ? nomeDoAlvo + (telefoneDoAlvo ? " · " + telefoneDoAlvo : "") : undefined}
      antesDoTitulo={<View style={c.ico}><Icon name="message_circle" size={16} color={Paleta.accentTexto} /></View>}
      onClose={props.onClose}
      rodape={
        <>
          <Text style={c.footText}>A Cassie lê os contatos na rodada das 7h30.</Text>
          <View style={c.footAcoes}>
            <Pressable testID="contato-cancelar" onPress={props.onClose} style={c.btnGhost} accessibilityRole="button"><Text style={c.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable
              testID="contato-salvar"
              onPress={salvar}
              disabled={!podeSalvar}
              accessibilityRole="button"
              accessibilityState={{ disabled: !podeSalvar }}
              style={[c.btnPrimario, !podeSalvar && { opacity: 0.5 }]}
            >
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={c.btnPrimarioText}>Salvar contato</Text>}
            </Pressable>
          </View>
        </>
      }
    >
      {/* Como foi */}
      <View>
        <Text style={c.rotulo}>Como foi <Text style={c.obr}>*</Text></Text>
        <Chips prefixo="contato-resultado" opcoes={RESULTADOS} valor={form.resultado} grade
          // O motivo escolhido sob "Não quer" não segue para outro resultado.
          onEscolher={function(id) { mudar({ resultado: id, motivo: id === "nao_quer" ? form.motivo : null }); }} />
        {mostrarErros && erros.resultado ? <Text style={c.erro} testID="contato-erro-resultado">{erros.resultado}</Text> : null}
      </View>

      {/* Canal */}
      <View>
        <Text style={c.rotulo}>Canal</Text>
        <Chips prefixo="contato-canal" opcoes={CANAIS} valor={form.canal} onEscolher={function(id) { mudar({ canal: id }); }} />
      </View>

      {/* O que pesou: só com "Não quer", e trava o Salvar */}
      {form.resultado === "nao_quer" ? (
        <View style={c.avisoMotivo} testID="contato-bloco-motivo">
          <Text style={[c.rotulo, { color: Colors.red }]}>O que pesou <Text style={c.obr}>* obrigatório quando não quer</Text></Text>
          <Chips prefixo="contato-motivo" opcoes={MOTIVOS} valor={form.motivo} alternavel onEscolher={function(id) { mudar({ motivo: id }); }} />
          {mostrarErros && erros.motivo ? <Text style={c.erro} testID="contato-erro-motivo">{erros.motivo}</Text> : null}
        </View>
      ) : null}

      {/* Uma frase */}
      <View>
        <Text style={c.rotulo}>O que aconteceu <Text style={c.obr}>*</Text>  <Text style={c.contador}>{form.frase.length}/{MAX_FRASE}</Text></Text>
        <TextInput
          testID="contato-frase"
          value={form.frase}
          onChangeText={function(t) { mudar({ frase: t.slice(0, MAX_FRASE) }); }}
          onSubmitEditing={salvar}
          returnKeyType="done"
          maxLength={MAX_FRASE}
          placeholder="Uma frase: ex. Pediu até sexta para ver o preço do anual"
          placeholderTextColor={Colors.ink3}
          style={c.campo}
        />
        {mostrarErros && erros.frase ? <Text style={c.erro} testID="contato-erro-frase">{erros.frase}</Text> : null}
      </View>

      {/* Próximo passo */}
      <View>
        <Text style={c.rotulo}>Próximo passo <Text style={c.contador}>opcional</Text></Text>
        <TextInput
          testID="contato-proximo"
          value={form.proximoPasso}
          onChangeText={function(t) { mudar({ proximoPasso: t.slice(0, MAX_PROXIMO_PASSO) }); }}
          maxLength={MAX_PROXIMO_PASSO}
          placeholder="ex. Ligar de novo"
          placeholderTextColor={Colors.ink3}
          style={c.campo}
        />
        <View style={[c.chips, { marginTop: 8, alignItems: "center" }]}>
          {ATALHOS_DE_DATA.map(function(n) {
            var on = form.dias === n;
            return (
              <Pressable key={n} testID={"contato-data-" + n} onPress={function() { mudar({ dias: on ? null : n }); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[c.chip, on && c.chipOn]}>
                <Text style={[c.chipText, on && { fontWeight: "700", color: Paleta.accentTexto }]}>{"+" + n + (n === 1 ? " dia" : " dias")}</Text>
              </Pressable>
            );
          })}
          <Pressable testID="contato-data-0" onPress={function() { mudar({ dias: null }); }} accessibilityRole="button" accessibilityState={{ selected: form.dias === null }} style={[c.chip, form.dias === null && c.chipOn]}>
            <Text style={[c.chipText, form.dias === null && { fontWeight: "700", color: Paleta.accentTexto }]}>Sem data</Text>
          </Pressable>
          <Text style={c.quando} testID="contato-quando">{dataEscolhida ? rotuloDaData(dataEscolhida) : "sem data"}</Text>
        </View>
      </View>

      {/* Importação assistida */}
      <View style={[c.chips, { alignItems: "center" }]}>
        <Text style={[c.rotulo, { marginBottom: 0 }]}>Importação assistida <Text style={c.contador}>opcional</Text></Text>
        <Chips prefixo="contato-marcador" opcoes={MARCADORES} valor={form.marcador} alternavel onEscolher={function(id) { mudar({ marcador: id }); }} />
      </View>

      {/* Check-in: fechado por padrão */}
      <View style={c.checkin}>
        <Pressable testID="contato-checkin-toggle" onPress={function() { setCheckinAberto(!checkinAberto); }} accessibilityRole="button" accessibilityState={{ expanded: checkinAberto }} style={c.checkinHead}>
          <Text style={c.checkinTitulo}>Check-in</Text>
          <Text style={c.contador}>opcional · {checkinAberto ? "fechar" : "3 toques, grava na ficha"}</Text>
        </Pressable>
        {checkinAberto ? (
          <View style={{ gap: 12, paddingHorizontal: 12, paddingBottom: 12 }} testID="contato-checkin">
            <View>
              <Text style={c.rotulo}>Como chegou</Text>
              {rotuloComoChegouAtual ? (
                <Text style={c.contador} testID="contato-comochegou-atual">{"Já registrado: " + rotuloComoChegouAtual + ". A primeira gravação fica."}</Text>
              ) : null}
              <Chips prefixo="contato-comochegou" opcoes={COMO_CHEGOU} valor={form.comoChegou} alternavel onEscolher={function(id) { mudar({ comoChegou: id }); }} />
            </View>
            <View>
              <Text style={c.rotulo}>Vende fiado</Text>
              <Chips prefixo="contato-fiado" opcoes={FIADO} valor={form.fiado} alternavel onEscolher={function(id) { mudar({ fiado: id }); }} />
            </View>
            <View>
              <Text style={c.rotulo}>Quem decide a compra</Text>
              <Chips prefixo="contato-quemdecide" opcoes={QUEM_DECIDE} valor={form.quemDecide} alternavel onEscolher={function(id) { mudar({ quemDecide: id }); }} />
            </View>
          </View>
        ) : null}
      </View>

      {erro ? (
        <View style={c.caixaErro} testID="contato-erro">
          <Icon name="alert" size={14} color={Colors.red} />
          <Text style={c.caixaErroText}>{erro}</Text>
        </View>
      ) : null}
    </PainelModal>
  );
}

var c = StyleSheet.create({
  ico: { width: 30, height: 30, borderRadius: 9, backgroundColor: Paleta.accentSuave, alignItems: "center", justifyContent: "center" },
  rotulo: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3, marginBottom: 6 },
  obr: { color: Colors.red, letterSpacing: 0 },
  contador: { fontSize: 12, fontWeight: "500", letterSpacing: 0, textTransform: "none", color: Colors.ink3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  chipGrade: { flexGrow: 1, flexBasis: "30%", alignItems: "center", paddingVertical: 10 },
  chipOn: { backgroundColor: Paleta.accentSuave, borderColor: Paleta.accent },
  chipRisco: { backgroundColor: Colors.redD, borderColor: Colors.red },
  chipBom: { backgroundColor: Colors.greenD, borderColor: Colors.green },
  chipText: { fontSize: 13, fontWeight: "500", color: Colors.ink2 },
  campo: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.ink },
  quando: { fontSize: 12, color: Colors.ink3, marginLeft: 4 },
  erro: { fontSize: 12, color: Colors.red, marginTop: 4 },
  avisoMotivo: { backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  checkin: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg4 },
  checkinHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", paddingHorizontal: 12, paddingVertical: 10 },
  checkinTitulo: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  caixaErro: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: Colors.red, backgroundColor: Colors.redD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  caixaErroText: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  footText: { fontSize: 12, color: Colors.ink3 },
  footAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  btnGhost: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, fontWeight: "600", color: Paleta.accentTexto },
  btnPrimario: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, minWidth: 104, alignItems: "center" },
  btnPrimarioText: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
