// ============================================================
// AURA. — NF-e 55 · Pronto (CP4). Autorizada: chave (toque para copiar),
// DANFE A4, XML e envio por e-mail. Cancelar e carta de correção são do
// CP5 (não aparecem até funcionarem). WhatsApp: o backend ainda não tem
// link público assinado de documento fiscal (ver PR do CP3) — fica fora.
// ============================================================
import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { nfe55Api, type RespostaEmissao } from "@/services/nfe55Api";
import { toast } from "@/components/Toast";
import { brl, fmtChave } from "@/utils/nfe55";
import { abrirDanfe, baixarXml, copiarTexto } from "./nfe55Acoes";
import { BotaoSec, Campo, Cartao, Faixa, p } from "./partes";

type Props = {
  companyId: string;
  resposta: RespostaEmissao;
  emailInicial: string;
  total?: number | null;
};

export function PassoPronto({ companyId, resposta, emailInicial, total }: Props) {
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const nota = resposta.nfe;
  const chave = resposta.chave_acesso || nota?.chave_acesso || "";
  const quando = nota?.authorized_at ? new Date(nota.authorized_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await nfe55Api.enviarEmail(companyId, nota.id, email.trim() || undefined);
      setEnviadoPara(r.para);
      toast.success("Nota enviada para " + r.para);
    } catch (e: any) {
      toast.error((e && e.data && e.data.error) || (e && e.message) || "Não deu para enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View testID="nfe55-pronto">
      <Faixa tom="verde" titulo={`NF-e nº ${resposta.numero} autorizada`}
        texto={`Protocolo ${resposta.protocolo || "—"}${quando ? " · " + quando : ""}${total ? " · " + brl(total) : ""}`} testID="nfe55-autorizada" />
      {resposta.ambiente !== "producao" ? (
        <Faixa tom="ambar" titulo="Nota de teste (homologação)" texto="Não tem valor fiscal. O DANFE sai com a marca SEM VALOR FISCAL." />
      ) : null}
      <Cartao>
        <Text style={p.lab}>Chave de acesso (toque para copiar)</Text>
        <Pressable onPress={() => copiarTexto(chave, "Chave copiada")} accessibilityRole="button" testID="nfe55-chave">
          <Text style={{ fontFamily: "monospace" as any, fontSize: 12.5, color: Colors.ink, backgroundColor: Colors.bg4, borderRadius: 8, padding: 10 }}>{fmtChave(chave)}</Text>
        </Pressable>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <BotaoSec titulo="Baixar DANFE (PDF)" icone="file_text" onPress={() => abrirDanfe(companyId, nota.id)} testID="nfe55-danfe" />
          <BotaoSec titulo="Baixar XML" icone="download" onPress={() => baixarXml(companyId, nota.id, chave)} testID="nfe55-xml" />
        </View>
        <View style={{ marginTop: 16 }}>
          <Campo rotulo="Enviar por e-mail para" valor={email} onChange={setEmail} teclado="email-address" placeholder="e-mail do cliente" testID="nfe55-email-envio"
            dica="Vão o DANFE e o XML, que é o arquivo que o contador do cliente pede." />
          <Pressable onPress={enviar} style={[p.btnSec, { alignSelf: "flex-start", backgroundColor: Colors.violet, borderColor: Colors.violet }]} testID="nfe55-enviar-email" accessibilityRole="button">
            {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[p.btnSecTxt, { color: "#fff" }]}>Enviar por e-mail</Text>}
          </Pressable>
          {enviadoPara ? <Text style={[p.hint, { color: Colors.green }]}>Enviada para {enviadoPara}.</Text> : null}
        </View>
      </Cartao>
      <Text style={[p.muted, { marginTop: 12 }]}>A nota fica guardada na venda (Vendas › detalhe) e na lista de Notas.</Text>
    </View>
  );
}
