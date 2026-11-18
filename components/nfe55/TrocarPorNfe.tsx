// ============================================================
// AURA. — "Trocar por NF-e" no detalhe da venda (17/11/2026)
// Card "Trocar por NF-e", aprovado pelo Caio em 17/11.
//
// A venda tem NFC-e autorizada e o cliente precisa de NF-e (empresa / CNPJ):
//   - dentro do prazo de cancelamento da NFC-e: botão "Trocar por NF-e" →
//     confirmação clara ("A NFC-e nº X será cancelada e você vai emitir a
//     NF-e no lugar") → cancela pela rota de sempre (POST /nfce/:id/cancel,
//     evento 110111 na SEFAZ) → só com o cancelamento aceito, onCancelada()
//     abre o assistente da NF-e (Nfe55Wizard) para a mesma venda;
//   - SEFAZ recusou: a janela fica aberta com o motivo; o assistente não abre;
//   - fora do prazo: link discreto que explica, com gentileza, que a NF-e não
//     pode ser emitida para esta venda pela Aura (sem "prazo reaberto");
//   - qualquer outro caso (gateway, loja que não emitiria a NF-e, venda sem
//     NFC-e): nada aparece — a tela de hoje.
//
// Quem decide é o backend (GET /nfe55/venda/:saleId/trocar-nfce): o prazo é
// o por UF de services/nfcePrazoCancelamento.js (Aura-backend#1070), o mesmo
// com que a rota de cancelamento recusa (código NFCE_PRAZO_CANCELAMENTO_VENCIDO).
// O app só compara o relógio com o cancelavel_ate que o servidor mandou.
//
// Nota fiscal é sempre manual: nada aqui cancela ou emite sem o toque e a
// confirmação da lojista. Multi-CNPJ: companyId = loja DA VENDA.
// Janela por cima do detalhe da venda (ResponsiveSheet = Modal): JanelaEmpilhada,
// nunca WebPortal (o WebPortal perde o foco dentro de um Modal, aura-app#1313).
// Textos em constants/textosTrocarPorNfe.ts.
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { JanelaEmpilhada } from "@/components/JanelaEmpilhada";
import { nfe55Api, type SituacaoTrocaPorNfe } from "@/services/nfe55Api";
import { salesApi } from "@/services/salesApi";
import { TEXTOS_TROCAR_POR_NFE as T } from "@/constants/textosTrocarPorNfe";

type Props = {
  companyId: string;
  saleId: string;
  /** A NFC-e autorizada que o detalhe mostra (só para a tela reler quando ela muda). */
  nfceId: string;
  /** NFC-e cancelada na SEFAZ: abrir o assistente da NF-e e reler a venda. */
  onCancelada: () => void;
  /** Relógio injetável (testes). */
  agora?: () => number;
};

// A rota de cancelamento (Aura-backend#1070) recusa fora do prazo com este código.
const PRAZO_VENCIDO = "NFCE_PRAZO_CANCELAMENTO_VENCIDO";

function erroHumano(e: any): string | null {
  return (e && e.data && e.data.error) || (e && e.message) || null;
}

export function TrocarPorNfe({ companyId, saleId, nfceId, onCancelada, agora = Date.now }: Props) {
  const [sit, setSit] = useState<SituacaoTrocaPorNfe | null>(null);
  const [verForaDoPrazo, setVerForaDoPrazo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState<string>(T.motivoPadrao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O servidor recusou por prazo no meio do caminho (a tela estava aberta).
  const [prazoVenceu, setPrazoVenceu] = useState(false);

  useEffect(() => {
    let vivo = true;
    setSit(null);
    nfe55Api.trocarNfce(companyId, saleId)
      .then((r) => { if (vivo) setSit(r); })
      // Sem resposta, a tela fica como hoje (nunca um botão que não sabe o que faz).
      .catch(() => { if (vivo) setSit(null); });
    return () => { vivo = false; };
  }, [companyId, saleId, nfceId]);

  if (!sit || !sit.nfce) return null;
  const nfce = sit.nfce;
  const ate = nfce.cancelavel_ate ? Date.parse(nfce.cancelavel_ate) : NaN;
  // O servidor respondeu na abertura do detalhe; o prazo pode vencer com a tela aberta.
  const venceuAgora = sit.situacao === "pode_trocar" && Number.isFinite(ate) && agora() > ate;
  const foraDoPrazo = sit.situacao === "fora_do_prazo" || venceuAgora || prazoVenceu;

  if (foraDoPrazo) {
    return (
      <View style={st.col}>
        <Pressable onPress={() => setVerForaDoPrazo((v) => !v)} style={st.link} accessibilityRole="button" testID="venda-trocar-nfe-fora-link">
          <Text style={st.linkT}>{T.foraDoPrazoLink}</Text>
        </Pressable>
        {verForaDoPrazo ? <Text style={st.fora} testID="venda-trocar-nfe-fora">{T.foraDoPrazo(nfce.numero, nfce.prazo_minutos)}</Text> : null}
      </View>
    );
  }
  if (sit.situacao !== "pode_trocar") return null;

  const motivoOk = motivo.trim().length >= 15;

  function abrir() {
    if (Number.isFinite(ate) && agora() > ate) { setVerForaDoPrazo(true); return; }
    setMotivo(T.motivoPadrao);
    setErro(null);
    setConfirmando(true);
  }

  async function confirmar() {
    if (enviando) return;
    if (!motivoOk) { setErro(T.motivoCurto); return; }
    setEnviando(true);
    setErro(null);
    try {
      await salesApi.cancelNfce(companyId, nfce.id, motivo.trim());
      toast.success(T.cancelada(nfce.numero));
      setConfirmando(false);
      onCancelada();
    } catch (e: any) {
      if (e && e.data && e.data.code === PRAZO_VENCIDO) {
        setConfirmando(false);
        setPrazoVenceu(true);
        setVerForaDoPrazo(true);
        return;
      }
      const m = erroHumano(e);
      setErro(m ? T.recusada(m) : T.recusadaSemMotivo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={st.col}>
      <Button testID="venda-trocar-nfe" title={T.botao} icon="repeat" size="sm" variant="secondary"
        onPress={abrir} style={{ alignSelf: "flex-start" }} />
      <Text style={st.dica}>{T.dicaDoBotao(nfce.cancelavel_ate)}</Text>

      {confirmando ? (
        <JanelaEmpilhada onRequestClose={() => { if (!enviando) setConfirmando(false); }}>
          <View style={d.overlay} testID="venda-trocar-nfe-confirmar-janela">
            <Pressable style={d.backdrop} onPress={() => { if (!enviando) setConfirmando(false); }} accessibilityLabel="Fechar" />
            <View style={d.card}>
              <Text style={d.t}>{T.confirmarTitulo}</Text>
              <Text style={d.forte} testID="venda-trocar-nfe-texto">{T.confirmarTexto(nfce.numero)}</Text>
              <Text style={d.s}>{T.confirmarDetalhe}</Text>
              <Text style={d.lab}>{T.motivoRotulo}</Text>
              <TextInput value={motivo} onChangeText={setMotivo} multiline maxLength={255} editable={!enviando}
                placeholderTextColor={Colors.ink3} style={d.inp} testID="venda-trocar-nfe-motivo" accessibilityLabel={T.motivoRotulo} />
              <Text style={d.hint}>{T.motivoDica}</Text>
              {erro ? <Text style={d.erro} testID="venda-trocar-nfe-erro">{erro}</Text> : null}
              <View style={d.acoes}>
                <Pressable style={d.btnSec} onPress={() => setConfirmando(false)} disabled={enviando} testID="venda-trocar-nfe-manter" accessibilityRole="button">
                  <Text style={d.btnSecT}>{T.manter}</Text>
                </Pressable>
                <Pressable style={[d.btnPri, (!motivoOk || enviando) && { opacity: 0.6 }]} onPress={confirmar} disabled={enviando}
                  testID="venda-trocar-nfe-confirmar" accessibilityRole="button">
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={d.btnPriT}>{T.confirmar}</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </JanelaEmpilhada>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  col: { width: "100%", gap: 4, marginTop: 8 },
  dica: { fontSize: 11.5, color: Colors.ink3 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  linkT: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  fora: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18, backgroundColor: Colors.bg3, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border },
});

// Mesmo desenho dos diálogos da NF-e (components/nfe55/EventosNfe.tsx).
const d = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  card: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 20 },
  t: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  forte: { fontSize: 13.5, fontWeight: "700", color: Colors.ink, lineHeight: 19, marginBottom: 6 },
  s: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginBottom: 12 },
  lab: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: Colors.ink3, marginBottom: 5 },
  inp: { minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, textAlignVertical: "top" as any },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 4 },
  erro: { fontSize: 12.5, color: Colors.red, marginTop: 8, fontWeight: "600", lineHeight: 18 },
  acoes: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  btnSec: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  btnSecT: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  btnPri: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPriT: { fontSize: 13, fontWeight: "700", color: "#fff" },
});

export default TrocarPorNfe;
