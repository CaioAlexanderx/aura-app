// ============================================================
// Gestão Aura › Lançar custo do mês (18/10/2026, card f5-06)
//
// Aberto pelo botão do bloco Custos (só equipe Aura, user.role admin). Uma
// linha por categoria (infraestrutura, Anthropic, Meta, outros e, no mês que
// tiver, a sobra "sem abertura"), com valor, de onde saiu o dinheiro e uma
// observação. Só a categoria mexida vai no POST /admin/painel/custos; as
// outras ficam como estão no banco. Grava em aura_revenue_snapshot e o
// backend registra quem lançou em admin_audit_log.
//
// Passo único, no DNA do Registrar contato (cabeçalho com ícone, chips,
// rodapé com Cancelar e a ação principal só com o formulário válido).
// Regras em lancarCusto.ts (puro, testado à parte).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { adminApi } from "@/services/adminApi";
import type { PainelApiCustoOrigem } from "@/services/adminApi";
import { PainelModal } from "./PainelModal";
import { Paleta } from "./paleta";
import { brl, dataHora } from "./adaptadores";
import {
  MAX_MOTIVO, MAX_OBSERVACAO, formDoMes, mesAtualBRT, mesesDoSeletor, montarCorpo, rotuloDoMes, totalPrevisto, validar,
} from "./lancarCusto";
import type { LinhaDoForm } from "./lancarCusto";

var MSG_ERRO = "Não consegui salvar. Confira a conexão e tente de novo: se o custo tiver entrado, ele aparece no bloco.";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LancarCustoModal(props: Props) {
  var qc = useQueryClient();
  var meses = useMemo(function() { return mesesDoSeletor(); }, [props.visible]);
  var [mes, setMes] = useState<string>(function() { return mesAtualBRT(); });
  var [linhas, setLinhas] = useState<LinhaDoForm[]>([]);
  var [motivo, setMotivo] = useState("");
  var [tentou, setTentou] = useState(false);
  var [enviando, setEnviando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);

  var q = useQuery({
    queryKey: ["admin-painel-custos", mes],
    queryFn: function() { return adminApi.painel.custos.mes(mes); },
    enabled: props.visible,
    staleTime: 0,
    retry: false,
  });

  // Abrir de novo começa no mês corrente e limpo.
  useEffect(function() {
    if (!props.visible) return;
    setMes(mesAtualBRT());
    setMotivo("");
    setTentou(false);
    setErro(null);
  }, [props.visible]);

  // Trocar de mês (ou chegar o dado) refaz as linhas com o que está gravado.
  useEffect(function() {
    if (q.data && q.data.mes === mes) setLinhas(formDoMes(q.data));
    else setLinhas([]);
    setTentou(false);
    setErro(null);
  }, [q.data, mes]);

  var { ok, erros, alteradas } = useMemo(function() { return validar(linhas); }, [linhas]);
  var origens = (q.data && q.data.origens) || [];
  var total = totalPrevisto(linhas, q.data ? q.data.sem_abertura : null);

  function mudarLinha(id: string, parcial: Partial<LinhaDoForm>) {
    setLinhas(function(ls) { return ls.map(function(l) { return l.id === id ? { ...l, ...parcial } : l; }); });
    if (erro) setErro(null);
  }

  async function salvar() {
    if (enviando) return;
    setTentou(true);
    if (!ok) return;
    setEnviando(true);
    setErro(null);
    try {
      var r = await adminApi.painel.custos.lancar(montarCorpo(mes, linhas, motivo));
      toast.success("Custo de " + rotuloDoMes(mes) + " salvo: " + brl(r.total_costs, true) + ".");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-painel-custos"] }),
        qc.invalidateQueries({ queryKey: ["admin-painel-hoje"] }),
        qc.invalidateQueries({ queryKey: ["admin-painel-bloco"] }),
      ]);
      if (r.painel_atualizado === false) toast.info("O bloco Custos atualiza no próximo cálculo (ou em Recalcular).");
      props.onClose();
    } catch (e: any) {
      setErro((e && e.message) || MSG_ERRO);
    } finally {
      setEnviando(false);
    }
  }

  var podeSalvar = ok && !enviando;

  return (
    <PainelModal
      visible={props.visible}
      id="lancar-custo"
      titulo="Lançar custo do mês"
      subtitulo="Custos da Aura por categoria. Taxas da Asaas e DAS ficam fora."
      antesDoTitulo={<View style={c.ico}><Icon name="dollar" size={16} color={Paleta.accentTexto} /></View>}
      onClose={props.onClose}
      rodape={
        <>
          <Text style={c.footText} testID="custo-total">{"Total de " + rotuloDoMes(mes) + ": " + brl(total, true)}</Text>
          <View style={c.footAcoes}>
            <Pressable testID="custo-cancelar" onPress={props.onClose} style={c.btnGhost} accessibilityRole="button"><Text style={c.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable
              testID="custo-salvar"
              onPress={salvar}
              disabled={!podeSalvar}
              accessibilityRole="button"
              accessibilityState={{ disabled: !podeSalvar }}
              style={[c.btnPrimario, !podeSalvar && { opacity: 0.5 }]}
            >
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={c.btnPrimarioText}>{alteradas > 1 ? "Salvar " + alteradas + " categorias" : "Salvar custo"}</Text>}
            </Pressable>
          </View>
        </>
      }
    >
      {/* Mês */}
      <View>
        <Text style={c.rotulo}>Mês</Text>
        <View style={c.chips}>
          {meses.map(function(m) {
            var on = m === mes;
            return (
              <Pressable key={m} testID={"custo-mes-" + m} onPress={function() { setMes(m); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[c.chip, on && c.chipOn]}>
                <Text style={[c.chipText, on && c.chipTextOn]}>{rotuloDoMes(m)}</Text>
              </Pressable>
            );
          })}
        </View>
        {q.data ? (
          <Text style={c.nota} testID="custo-situacao">
            {q.data.existe_linha
              ? "Gravado hoje: " + brl(q.data.total_costs, true) + (q.data.mrr_total != null ? " · MRR " + brl(q.data.mrr_total, true) : "")
              : "Mês ainda sem linha no snapshot: o lançamento cria a linha e o cálculo diário completa o MRR."}
          </Text>
        ) : null}
      </View>

      {q.isLoading ? (
        <View style={c.estado} testID="custo-carregando"><ActivityIndicator color={Colors.violet3} /></View>
      ) : q.isError ? (
        <View style={c.caixaErro} testID="custo-erro-carga">
          <Icon name="alert" size={14} color={Colors.red} />
          <Text style={c.caixaErroText}>{(q.error as any)?.message || "Não consegui ler os custos do mês."}</Text>
          <Pressable onPress={function() { q.refetch(); }} accessibilityRole="button"><Text style={c.btnGhostText}>Tentar de novo</Text></Pressable>
        </View>
      ) : (
        linhas.map(function(l) {
          var e = tentou ? erros[l.id] : undefined;
          return (
            <View key={l.id} style={c.linha} testID={"custo-linha-" + l.id}>
              <View style={c.linhaTopo}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={c.categoria}>{l.rotulo}</Text>
                  <Text style={c.nota}>{l.ajuda}{l.lancado_em ? " · lançado em " + dataHora(l.lancado_em) : ""}</Text>
                </View>
                <View style={c.valorCaixa}>
                  <Text style={c.prefixo}>R$</Text>
                  <TextInput
                    testID={"custo-valor-" + l.id}
                    value={l.texto}
                    onChangeText={function(t) { mudarLinha(l.id, { texto: t.replace(/[^\d.,]/g, "").slice(0, 14) }); }}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="0,00"
                    placeholderTextColor={Colors.ink3}
                    style={c.valor}
                    accessibilityLabel={"Valor de " + l.rotulo}
                  />
                </View>
              </View>
              <View style={c.chips}>
                {origens.map(function(o) {
                  var on = l.origem === o.id;
                  return (
                    <Pressable key={o.id} testID={"custo-origem-" + l.id + "-" + o.id} onPress={function() { mudarLinha(l.id, { origem: o.id as PainelApiCustoOrigem }); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[c.chip, on && c.chipOn]}>
                      <Text style={[c.chipText, on && c.chipTextOn]}>{o.rotulo}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                testID={"custo-obs-" + l.id}
                value={l.observacao}
                onChangeText={function(t) { mudarLinha(l.id, { observacao: t.slice(0, MAX_OBSERVACAO) }); }}
                maxLength={MAX_OBSERVACAO}
                placeholder="Observação (opcional): ex. Railway + Supabase"
                placeholderTextColor={Colors.ink3}
                style={c.campo}
              />
              {e ? <Text style={c.erro} testID={"custo-erro-" + l.id}>{e}</Text> : null}
            </View>
          );
        })
      )}

      {/* Motivo da correção: vai para a auditoria */}
      <View>
        <Text style={c.rotulo}>Motivo <Text style={c.contador}>opcional · fica na auditoria</Text></Text>
        <TextInput
          testID="custo-motivo"
          value={motivo}
          onChangeText={function(t) { setMotivo(t.slice(0, MAX_MOTIVO)); }}
          maxLength={MAX_MOTIVO}
          placeholder="ex. fechamento do mês pelo extrato"
          placeholderTextColor={Colors.ink3}
          style={c.campo}
        />
      </View>

      {tentou && alteradas === 0 ? <Text style={c.erro} testID="custo-erro-nada">Mude ao menos uma categoria.</Text> : null}
      {erro ? (
        <View style={c.caixaErro} testID="custo-erro">
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
  contador: { fontSize: 12, fontWeight: "500", letterSpacing: 0, textTransform: "none", color: Colors.ink3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  chipOn: { backgroundColor: Paleta.accentSuave, borderColor: Paleta.accent },
  chipText: { fontSize: 13, fontWeight: "500", color: Colors.ink2 },
  chipTextOn: { fontWeight: "700", color: Paleta.accentTexto },
  nota: { fontSize: 12, color: Colors.ink3, marginTop: 4 },
  linha: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg4, padding: 12, gap: 10 },
  linhaTopo: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  categoria: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  valorCaixa: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 10, minWidth: 140 },
  prefixo: { fontSize: 13, color: Colors.ink3 },
  valor: { flex: 1, paddingVertical: 8, fontSize: 15, fontWeight: "600", color: Colors.ink, textAlign: "right" },
  campo: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.ink },
  erro: { fontSize: 12, color: Colors.red },
  estado: { paddingVertical: 24, alignItems: "center" },
  caixaErro: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: Colors.red, backgroundColor: Colors.redD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  caixaErroText: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  footText: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  footAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  btnGhost: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, fontWeight: "600", color: Paleta.accentTexto },
  btnPrimario: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, minWidth: 104, alignItems: "center" },
  btnPrimarioText: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
