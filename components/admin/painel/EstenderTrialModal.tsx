// ============================================================
// Gestão Aura › +7 dias de teste (14/10/2026)
//
// O verbo "+7 dias" dos cartões do bloco Trials por degrau e o botão da ficha
// abrem esta confirmação: estender o teste mexe na data de vencimento da loja,
// então não é um toque só. Usa a rota que já existia (PATCH
// /admin/clients/:cid/extend-trial) — o backend soma ao fim do teste, ou conta
// de hoje se já venceu, e grava em admin_audit_log.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { adminApi } from "@/services/adminApi";
import { PainelModal } from "./PainelModal";
import { Paleta } from "./paleta";

export type AlvoTrial = { company_id: string; nome: string };

export var DIAS_DE_TESTE = 7;

function dataCurta(iso: string): string {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function EstenderTrialModal(props: { alvo: AlvoTrial | null; onClose: () => void; onFeito?: () => void }) {
  var qc = useQueryClient();
  var alvo = props.alvo;
  var [enviando, setEnviando] = useState(false);
  var [erro, setErro] = useState<string | null>(null);
  var chave = alvo ? alvo.company_id : "";

  useEffect(function() { setEnviando(false); setErro(null); }, [chave]);

  async function confirmar() {
    if (!alvo || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      var r = await adminApi.extendTrial(alvo.company_id, DIAS_DE_TESTE, "Gestão Aura › Hoje: +" + DIAS_DE_TESTE + " dias");
      var ate = r && r.trial_ends_at ? dataCurta(r.trial_ends_at) : "";
      toast.success(alvo.nome + ": +" + DIAS_DE_TESTE + " dias" + (ate ? ", teste até " + ate : "") + ".");
      // O que o painel mostra do teste (vencimento, degrau) muda com a data.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-painel-hoje"] }),
        qc.invalidateQueries({ queryKey: ["admin-painel-bloco"] }),
        qc.invalidateQueries({ queryKey: ["admin-painel-ficha"] }),
        qc.invalidateQueries({ queryKey: ["admin-clients-360"] }),
      ]);
      if (props.onFeito) props.onFeito();
      props.onClose();
    } catch (e: any) {
      setErro((e && e.message) || "Não consegui estender o teste. Confira a conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PainelModal
      visible={!!alvo}
      id="estender-trial"
      titulo={"+" + DIAS_DE_TESTE + " dias de teste"}
      subtitulo={alvo ? alvo.nome : undefined}
      onClose={props.onClose}
      rodape={
        <>
          <Text style={e.footText}>Fica no log de auditoria da Gestão Aura.</Text>
          <View style={e.footAcoes}>
            <Pressable testID="trial-cancelar" onPress={props.onClose} style={e.btnGhost} accessibilityRole="button"><Text style={e.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable testID="trial-confirmar" onPress={confirmar} disabled={enviando} style={[e.btnPrimario, enviando && { opacity: 0.6 }]} accessibilityRole="button">
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={e.btnPrimarioText}>Dar +{DIAS_DE_TESTE} dias</Text>}
            </Pressable>
          </View>
        </>
      }
    >
      <Text style={e.texto}>
        O teste de {alvo ? alvo.nome : "a loja"} passa a vencer {DIAS_DE_TESTE} dias depois da data atual. Se já venceu, a contagem
        começa de hoje. Depois de dar, o primeiro uso do Caixa não encurta mais esse prazo.
      </Text>
      {erro ? <Text style={e.erro} testID="trial-erro">{erro}</Text> : null}
    </PainelModal>
  );
}

var e = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 21, color: Colors.ink2 },
  erro: { fontSize: 13, color: Colors.red },
  footText: { fontSize: 12, color: Colors.ink3 },
  footAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  btnGhost: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGhostText: { fontSize: 12, fontWeight: "600", color: Paleta.accentTexto },
  btnPrimario: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.violet, borderWidth: 1, borderColor: Colors.violet, minWidth: 104, alignItems: "center" },
  btnPrimarioText: { fontSize: 12, fontWeight: "600", color: "#fff" },
});
