// ============================================================
// Gestão Aura › Clientes › Valor combinado da assinatura (14/10/2026)
//
// Caso Luis Henrique: dono de 2 lojas, Negócio anual por R$ 211,20/mês. O
// checkout padrão só sabe somar plano + R$ 19 × acessos extras; quem fecha um
// valor diferente é a equipe, aqui. O cliente só vê o valor no checkout normal
// ("Valor combinado") e paga como sempre — nada de link de cobrança.
//
// Backend: PUT/DELETE /admin/clients/:cid/custom-subscription (admin_audit_log,
// action='set_custom_subscription'). O valor vale só para o plano e o ciclo
// gravados e protege a assinatura do reajuste automático de acessos extras.
//
// Dois passos no mesmo modal (formulário → revisão com a confirmação), no DNA
// do modal da Gestão Aura (PainelModal), como o Registrar contato.
// Regras e textos em utils/valorCombinado.ts (puro, testado à parte).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { adminApi } from "@/services/adminApi";
import { PainelModal } from "./painel/PainelModal";
import { Paleta } from "./painel/paleta";
import {
  CICLOS_VALOR_COMBINADO, PLANOS_VALOR_COMBINADO, ROTULO_VALOR_COMBINADO,
  TEXTO_CONFIRMACAO_VALOR_COMBINADO, TEXTO_REMOCAO_VALOR_COMBINADO,
  corpoDoValorCombinado, formInicialValorCombinado, formatarBRL, lerValorCombinado,
  resumoDoValorCombinado, rotuloDoCiclo, rotuloDoPlano, validarValorCombinado,
} from "@/utils/valorCombinado";
import type { FormValorCombinado } from "@/utils/valorCombinado";

type Props = {
  companyId: string;
  nome: string;
  plano?: string | null;
  ciclo?: string | null;
  // Bloco `custom_subscription` do clients-360. undefined = o servidor ainda
  // não devolve o campo (backend antigo): a tela não afirma "tabela".
  atual?: unknown;
};

type Aberto = null | "definir" | "remover";

export function ValorCombinadoSection(props: Props) {
  var [aberto, setAberto] = useState<Aberto>(null);
  var cs = lerValorCombinado(props.atual);
  var servidorSemCampo = props.atual === undefined;

  return (
    <View style={s.section} testID="valor-combinado-bloco">
      <Text style={s.sectionTitle}>Valor combinado da assinatura</Text>
      <View style={s.valorRow}>
        <Text style={s.valorLabel}>Valor atual</Text>
        <Text testID="valor-combinado-atual" style={[s.valorTexto, cs && { color: Colors.violet3 }]}>
          {servidorSemCampo ? "não informado pelo servidor" : resumoDoValorCombinado(props.atual)}
        </Text>
      </View>
      {cs && cs.note ? <Text style={s.nota}>{cs.note}</Text> : null}
      <View style={s.acoes}>
        <Pressable testID="valor-combinado-definir" onPress={function() { setAberto("definir"); }} style={s.btnPrimario} accessibilityRole="button">
          <Text style={s.btnPrimarioText}>{cs ? "Alterar valor combinado" : "Definir valor combinado"}</Text>
        </Pressable>
        {cs ? (
          <Pressable testID="valor-combinado-remover" onPress={function() { setAberto("remover"); }} style={s.btnGhost} accessibilityRole="button">
            <Text style={s.btnGhostText}>Remover valor combinado</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={s.hint}>
        Vale só para o plano e o ciclo gravados, em qualquer forma de pagamento, e já inclui os acessos extras:
        a assinatura deixa de ser reajustada sozinha quando os acessos mudam. Registrado em admin_audit_log.
      </Text>

      <ValorCombinadoModal
        aberto={aberto}
        onClose={function() { setAberto(null); }}
        companyId={props.companyId}
        nome={props.nome}
        plano={props.plano}
        ciclo={props.ciclo}
        atual={props.atual}
      />
    </View>
  );
}

function ValorCombinadoModal(props: {
  aberto: Aberto;
  onClose: () => void;
  companyId: string;
  nome: string;
  plano?: string | null;
  ciclo?: string | null;
  atual?: unknown;
}) {
  var qc = useQueryClient();
  var modo = props.aberto;
  var [form, setForm] = useState<FormValorCombinado>(function() { return formInicialValorCombinado(props.atual, props.plano, props.ciclo); });
  var [revisando, setRevisando] = useState(false);
  var [tentou, setTentou] = useState(false);
  var [enviando, setEnviando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);

  // Cada abertura começa limpa, com o valor atual como ponto de partida.
  useEffect(function() {
    if (!modo) return;
    setForm(formInicialValorCombinado(props.atual, props.plano, props.ciclo));
    setRevisando(false);
    setTentou(false);
    setEnviando(false);
    setErro(null);
  }, [modo, props.companyId]);

  var v = useMemo(function() { return validarValorCombinado(form); }, [form]);
  var cs = lerValorCombinado(props.atual);

  function mudar(parcial: Partial<FormValorCombinado>) {
    setForm(function(f) { return { ...f, ...parcial }; });
    if (erro) setErro(null);
  }

  function revisar() {
    setTentou(true);
    if (v.ok) setRevisando(true);
  }

  async function confirmarDefinir() {
    if (enviando || !v.ok || v.valor === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await adminApi.setCustomSubscription(props.companyId, corpoDoValorCombinado(form, v.valor));
      toast.success(props.nome + ": valor combinado de " + formatarBRL(v.valor) + "/mês gravado.");
      await qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      props.onClose();
    } catch (e: any) {
      setErro((e && (e.data?.error || e.message)) || "Não consegui gravar o valor combinado. Confira a conexão e tente de novo.");
      setRevisando(false);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarRemover() {
    var motivo = form.motivo.trim();
    setTentou(true);
    if (enviando || motivo.length < 3) return;
    setEnviando(true);
    setErro(null);
    try {
      await adminApi.clearCustomSubscription(props.companyId, motivo);
      toast.success(props.nome + ": valor combinado removido.");
      await qc.invalidateQueries({ queryKey: ["admin-clients-360"] });
      props.onClose();
    } catch (e: any) {
      setErro((e && (e.data?.error || e.message)) || "Não consegui remover o valor combinado. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (modo === "remover") {
    return (
      <PainelModal
        visible
        id="valor-combinado-remover-modal"
        titulo="Remover valor combinado"
        subtitulo={props.nome}
        onClose={props.onClose}
        rodape={
          <>
            <Text style={m.footText}>Fica no log de auditoria da Gestão Aura.</Text>
            <View style={m.footAcoes}>
              <Pressable testID="valor-combinado-cancelar" onPress={props.onClose} style={m.btnGhost} accessibilityRole="button"><Text style={m.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable testID="valor-combinado-confirmar-remocao" onPress={confirmarRemover} disabled={enviando} style={[m.btnPrimario, enviando && { opacity: 0.6 }]} accessibilityRole="button">
                {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.btnPrimarioText}>Remover</Text>}
              </Pressable>
            </View>
          </>
        }
      >
        {cs ? <Text style={m.texto}>{"Hoje: " + resumoDoValorCombinado(props.atual) + "."}</Text> : null}
        <Text style={m.texto}>{TEXTO_REMOCAO_VALOR_COMBINADO}</Text>
        <View>
          <Text style={m.label}>Motivo</Text>
          <TextInput
            testID="valor-combinado-motivo"
            value={form.motivo}
            onChangeText={function(t) { mudar({ motivo: t }); }}
            placeholder="ex: cliente voltou para a tabela"
            placeholderTextColor={Colors.ink3}
            style={m.input}
          />
          {tentou && form.motivo.trim().length < 3 ? <Text style={m.erroCampo}>Diga o motivo: fica no log de auditoria.</Text> : null}
        </View>
        {erro ? <Text testID="valor-combinado-erro" style={m.erro}>{erro}</Text> : null}
      </PainelModal>
    );
  }

  return (
    <PainelModal
      visible={modo === "definir"}
      id="valor-combinado-modal"
      titulo={ROTULO_VALOR_COMBINADO + " da assinatura"}
      subtitulo={props.nome}
      onClose={props.onClose}
      rodape={
        <>
          <Text style={m.footText}>{revisando ? "Confira antes de gravar." : "Fica no log de auditoria da Gestão Aura."}</Text>
          <View style={m.footAcoes}>
            {revisando ? (
              <Pressable testID="valor-combinado-voltar" onPress={function() { setRevisando(false); }} style={m.btnGhost} accessibilityRole="button"><Text style={m.btnGhostText}>Voltar</Text></Pressable>
            ) : (
              <Pressable testID="valor-combinado-cancelar" onPress={props.onClose} style={m.btnGhost} accessibilityRole="button"><Text style={m.btnGhostText}>Cancelar</Text></Pressable>
            )}
            {revisando ? (
              <Pressable testID="valor-combinado-confirmar" onPress={confirmarDefinir} disabled={enviando} style={[m.btnPrimario, enviando && { opacity: 0.6 }]} accessibilityRole="button">
                {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.btnPrimarioText}>Gravar valor combinado</Text>}
              </Pressable>
            ) : (
              <Pressable testID="valor-combinado-revisar" onPress={revisar} style={[m.btnPrimario, tentou && !v.ok && { opacity: 0.6 }]} accessibilityRole="button">
                <Text style={m.btnPrimarioText}>Revisar</Text>
              </Pressable>
            )}
          </View>
        </>
      }
    >
      {revisando && v.valor !== null ? (
        <View style={m.revisao} testID="valor-combinado-revisao">
          <Text style={m.revisaoValor}>{formatarBRL(v.valor) + " por mês"}</Text>
          <Text style={m.texto}>{rotuloDoPlano(form.plano) + " · " + rotuloDoCiclo(form.ciclo)}</Text>
          {form.nota.trim() ? <Text style={m.texto}>{form.nota.trim()}</Text> : null}
          <Text style={m.confirmacao} testID="valor-combinado-confirmacao">{TEXTO_CONFIRMACAO_VALOR_COMBINADO}</Text>
        </View>
      ) : (
        <>
          <View>
            <Text style={m.label}>Valor mensal total (R$)</Text>
            <TextInput
              testID="valor-combinado-valor"
              value={form.valor}
              onChangeText={function(t) { mudar({ valor: t }); }}
              placeholder="211,20"
              placeholderTextColor={Colors.ink3}
              keyboardType="decimal-pad"
              inputMode="decimal"
              style={m.input}
            />
            {tentou && v.erros.valor ? <Text style={m.erroCampo}>{v.erros.valor}</Text> : <Text style={m.dica}>Substitui plano + acessos extras na cobrança.</Text>}
          </View>

          <View>
            <Text style={m.label}>Plano</Text>
            <View style={m.chips}>
              {PLANOS_VALOR_COMBINADO.map(function(p) {
                var on = form.plano === p.key;
                return (
                  <Pressable key={p.key} testID={"valor-combinado-plano-" + p.key} onPress={function() { mudar({ plano: p.key }); }}
                    accessibilityRole="button" accessibilityState={{ selected: on }} style={[m.chip, on && m.chipOn]}>
                    <Text style={[m.chipText, on && m.chipTextOn]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={m.label}>Ciclo</Text>
            <View style={m.chips}>
              {CICLOS_VALOR_COMBINADO.map(function(c) {
                var on = form.ciclo === c.key;
                return (
                  <Pressable key={c.key} testID={"valor-combinado-ciclo-" + c.key} onPress={function() { mudar({ ciclo: c.key }); }}
                    accessibilityRole="button" accessibilityState={{ selected: on }} style={[m.chip, on && m.chipOn]}>
                    <Text style={[m.chipText, on && m.chipTextOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={m.dica}>Só vale quando o cliente escolhe este mesmo plano e ciclo no checkout.</Text>
          </View>

          <View>
            <Text style={m.label}>O que foi combinado (equipe)</Text>
            <TextInput
              testID="valor-combinado-nota"
              value={form.nota}
              onChangeText={function(t) { mudar({ nota: t }); }}
              placeholder="ex: 2 lojas: R$ 140,83 + R$ 70,37 da segunda loja"
              placeholderTextColor={Colors.ink3}
              multiline
              style={[m.input, { minHeight: 60 }]}
            />
          </View>

          <View>
            <Text style={m.label}>Motivo</Text>
            <TextInput
              testID="valor-combinado-motivo"
              value={form.motivo}
              onChangeText={function(t) { mudar({ motivo: t }); }}
              placeholder="ex: fechado por WhatsApp em 14/10"
              placeholderTextColor={Colors.ink3}
              style={m.input}
            />
            {tentou && v.erros.motivo ? <Text style={m.erroCampo}>{v.erros.motivo}</Text> : null}
          </View>
        </>
      )}
      {erro ? <Text testID="valor-combinado-erro" style={m.erro}>{erro}</Text> : null}
    </PainelModal>
  );
}

var s = StyleSheet.create({
  section: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  valorRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  valorLabel: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  valorTexto: { fontSize: 14, fontWeight: "800", color: Colors.ink, flexShrink: 1, textAlign: "right" },
  nota: { fontSize: 12, color: Colors.ink3, marginTop: 8, lineHeight: 17 },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  btnPrimario: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center" },
  btnPrimarioText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnGhost: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  btnGhostText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  hint: { fontSize: 10, color: Colors.ink3, marginTop: 10, lineHeight: 14 },
});

var m = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 21, color: Colors.ink2 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: Colors.ink },
  dica: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  erroCampo: { fontSize: 12, color: Colors.red, marginTop: 6 },
  erro: { fontSize: 13, color: Colors.red },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: Colors.bg4 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.ink3 },
  chipTextOn: { color: Paleta.accentTexto, fontWeight: "700" },
  revisao: { gap: 8 },
  revisaoValor: { fontSize: 24, fontWeight: "800", color: Colors.violet3 },
  confirmacao: { fontSize: 13, lineHeight: 19, color: Colors.ink, backgroundColor: Colors.violetD, borderRadius: 10, padding: 12, marginTop: 6 },
  footText: { fontSize: 12, color: Colors.ink3 },
  footAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  btnGhost: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, fontWeight: "600", color: Paleta.accentTexto },
  btnPrimario: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, minWidth: 104, alignItems: "center" },
  btnPrimarioText: { fontSize: 12, fontWeight: "600", color: "#fff" },
});

export default ValorCombinadoSection;
