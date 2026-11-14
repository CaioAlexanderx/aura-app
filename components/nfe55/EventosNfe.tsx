// ============================================================
// AURA. — Cancelar e corrigir texto da NF-e 55 (CP5, 14/11/2026).
// Mockup aprovado P9huGndnYF4tSPPXTykpdf, tela "Notas · cancelar /
// corrigir". Diálogos dentro do app (nada de window.confirm), no WebPortal
// na web; botões de 44 px, sem hover.
//
//   AcoesDeEventosNfe   o prazo à vista ("Pode cancelar até amanhã, 15:51
//                       (faltam 23 h)"), "Corrigir texto" e "Cancelar".
//                       Depois do prazo, "Cancelar" some e aparece o texto
//                       da devolução.
//   CancelarNfeDialog   motivo 15–255 letras → POST .../cancelar
//   CartaCorrecaoDialog texto 15–1000 → POST .../carta-correcao, com o
//                       aviso do que a carta não pode mudar
// ============================================================
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { nfe55Api } from "@/services/nfe55Api";
import {
  prazoDoCancelamento, justificativaValida, textoDaCartaValido, TEXTO_PRAZO_VENCIDO,
} from "@/utils/nfe55";

type Nota = { id: string; numero: number | null; authorized_at?: string | null; status: string };

function erroHumano(e: any, padrao: string): string {
  return (e && e.data && e.data.error) || (e && e.message) || padrao;
}

function Moldura({ children, onFechar, testID }: { children: React.ReactNode; onFechar: () => void; testID: string }) {
  return (
    <WebPortal active>
      <View style={d.overlay} testID={testID}>
        <Pressable style={d.backdrop} onPress={onFechar} accessibilityLabel="Fechar" />
        <View style={d.card}>{children}</View>
      </View>
    </WebPortal>
  );
}

export function CancelarNfeDialog({ companyId, nota, onFechar, onCancelada, agora }: {
  companyId: string; nota: Nota; onFechar: () => void; onCancelada?: () => void; agora?: number;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const prazo = prazoDoCancelamento(nota.authorized_at, agora);
  const ok = justificativaValida(motivo);

  async function cancelar() {
    if (!ok || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await nfe55Api.cancelar(companyId, nota.id, motivo.trim());
      toast.success(`NF-e nº ${nota.numero ?? ""} cancelada.`);
      onCancelada && onCancelada();
      onFechar();
    } catch (e: any) {
      setErro(erroHumano(e, "Não deu para cancelar agora. Tente de novo em instantes."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Moldura onFechar={onFechar} testID="nfe-cancelar-dialogo">
      <Text style={d.t}>Cancelar a NF-e nº {nota.numero ?? ""}?</Text>
      <Text style={d.s}>
        {prazo.ateTexto ? `A Sefaz aceita ${prazo.ateTexto}. ` : ""}Depois de cancelada não tem volta, e a venda continua registrada (para desfazer a venda, use "Cancelar venda").
      </Text>
      <Text style={d.lab}>Motivo (o cliente e a Sefaz veem)</Text>
      <TextInput value={motivo} onChangeText={setMotivo} multiline placeholder="Ex.: cliente desistiu da compra antes da entrega"
        placeholderTextColor={Colors.ink3} style={d.inp} testID="nfe-cancelar-motivo" accessibilityLabel="Motivo do cancelamento" maxLength={255} />
      <Text style={d.hint}>Pelo menos 15 letras. Regra da Sefaz.</Text>
      {erro ? <Text style={d.erro} testID="nfe-cancelar-erro">{erro}</Text> : null}
      <View style={d.acoes}>
        <Pressable style={d.btnSec} onPress={onFechar} testID="nfe-cancelar-manter" accessibilityRole="button"><Text style={d.btnSecT}>Manter a nota</Text></Pressable>
        <Pressable style={[d.btnPerigo, !ok && { opacity: 0.45 }]} onPress={cancelar} disabled={!ok || enviando} testID="nfe-cancelar-confirmar" accessibilityRole="button">
          {enviando ? <ActivityIndicator size="small" color={Colors.red} /> : <Text style={d.btnPerigoT}>Cancelar nota</Text>}
        </Pressable>
      </View>
    </Moldura>
  );
}

export function CartaCorrecaoDialog({ companyId, nota, onFechar, onEnviada }: {
  companyId: string; nota: Nota; onFechar: () => void; onEnviada?: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ok = textoDaCartaValido(texto);

  async function enviar() {
    if (!ok || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await nfe55Api.cartaCorrecao(companyId, nota.id, texto.trim());
      toast.success(`Carta de correção nº ${r.carta.seq} registrada na Sefaz.`);
      onEnviada && onEnviada();
      onFechar();
    } catch (e: any) {
      setErro(erroHumano(e, "Não deu para enviar a correção agora. Tente de novo em instantes."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Moldura onFechar={onFechar} testID="nfe-carta-dialogo">
      <Text style={d.t}>Corrigir texto da nota (carta de correção)</Text>
      <Text style={d.s} testID="nfe-carta-aviso">
        Serve para corrigir um texto, como complemento do endereço ou uma observação. Não muda valor, quantidade, imposto, data nem quem compra; para isso, cancele (até 24 h) e emita de novo.
      </Text>
      <Text style={d.lab}>O que está errado e como fica</Text>
      <TextInput value={texto} onChangeText={setTexto} multiline placeholder="Ex.: Onde se lê 'Sala 3', leia-se 'Sala 13'."
        placeholderTextColor={Colors.ink3} style={[d.inp, { minHeight: 90 }]} testID="nfe-carta-texto" accessibilityLabel="Texto da correção" maxLength={1000} />
      <Text style={d.hint}>Cada nova correção substitui a anterior, então escreva tudo o que precisa corrigir. De 15 a 1.000 letras.</Text>
      {erro ? <Text style={d.erro} testID="nfe-carta-erro">{erro}</Text> : null}
      <View style={d.acoes}>
        <Pressable style={d.btnSec} onPress={onFechar} testID="nfe-carta-voltar" accessibilityRole="button"><Text style={d.btnSecT}>Voltar</Text></Pressable>
        <Pressable style={[d.btnPri, !ok && { opacity: 0.45 }]} onPress={enviar} disabled={!ok || enviando} testID="nfe-carta-enviar" accessibilityRole="button">
          {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={d.btnPriT}>Enviar correção</Text>}
        </Pressable>
      </View>
    </Moldura>
  );
}

/**
 * Prazo + "Corrigir texto" + "Cancelar" de uma NF-e 55 autorizada.
 * `compacto`: botões pequenos (linha da lista de Notas).
 */
export function AcoesDeEventosNfe({ companyId, nota, onMudou, compacto, agora }: {
  companyId: string; nota: Nota; onMudou?: () => void; compacto?: boolean; agora?: number;
}) {
  const [dialogo, setDialogo] = useState<"cancelar" | "carta" | null>(null);
  if (nota.status !== "autorizada") return null;
  const prazo = prazoDoCancelamento(nota.authorized_at, agora);
  const btn = compacto ? d.mini : d.btnSec;
  const btnT = compacto ? d.miniT : d.btnSecT;
  return (
    <View style={{ gap: 6 }} testID={"nfe-eventos-" + nota.id}>
      {prazo.vencido ? (
        <Text style={d.prazoVencido} testID="nfe-prazo-vencido">{TEXTO_PRAZO_VENCIDO}</Text>
      ) : prazo.ateTexto ? (
        <Text style={d.prazo} testID="nfe-prazo">Pode cancelar {prazo.ateTexto}{prazo.faltaTexto ? ` (${prazo.faltaTexto})` : ""}</Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pressable style={btn} onPress={() => setDialogo("carta")} testID="nfe-corrigir" accessibilityRole="button"
          accessibilityLabel={`Corrigir texto da NF-e ${nota.numero ?? ""} (carta de correção)`}>
          <Text style={btnT}>Corrigir texto</Text>
        </Pressable>
        {!prazo.vencido ? (
          <Pressable style={[btn, { borderColor: Colors.red + "55" }]} onPress={() => setDialogo("cancelar")} testID="nfe-cancelar" accessibilityRole="button"
            accessibilityLabel={`Cancelar a NF-e ${nota.numero ?? ""}`}>
            <Text style={[btnT, { color: Colors.red }]}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
      {dialogo === "cancelar" ? (
        <CancelarNfeDialog companyId={companyId} nota={nota} agora={agora} onFechar={() => setDialogo(null)} onCancelada={onMudou} />
      ) : null}
      {dialogo === "carta" ? (
        <CartaCorrecaoDialog companyId={companyId} nota={nota} onFechar={() => setDialogo(null)} onEnviada={onMudou} />
      ) : null}
    </View>
  );
}

const d = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 300 },
  backdrop: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0 },
  card: { width: "100%", maxWidth: 440, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 20 },
  t: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  s: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginBottom: 12 },
  lab: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: Colors.ink3, marginBottom: 5 },
  inp: { minHeight: 64, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, textAlignVertical: "top" as any },
  hint: { fontSize: 11.5, color: Colors.ink3, marginTop: 4 },
  erro: { fontSize: 12.5, color: Colors.red, marginTop: 8, fontWeight: "600" },
  acoes: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  btnSec: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  btnSecT: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  btnPri: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  btnPriT: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnPerigo: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "rgba(220,38,38,0.07)", borderWidth: 1, borderColor: "rgba(220,38,38,0.35)", alignItems: "center", justifyContent: "center" },
  btnPerigoT: { fontSize: 13, fontWeight: "700", color: Colors.red },
  mini: { minHeight: 36, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  miniT: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  prazo: { fontSize: 11, color: Colors.amber, fontWeight: "600" },
  prazoVencido: { fontSize: 11, color: Colors.ink3 },
});
