// ============================================================
// AURA. — "Completar o cliente" da NFS-e pendente
//
// CPF ou CNPJ (com dígito verificador) e o nome de quem contratou, mandados
// em POST /origem/:tipo/:id/completar — o backend grava o tomador nesta
// prestação e emite. Não mexe no cadastro do cliente.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { toast } from "@/components/Toast";
import { nfseAutomaticaApi, type OrigemNfse, type SituacaoNfse } from "@/services/nfseAutomaticaApi";
import { docValido, estadoDoDoc, mascararDoc, mensagemDoDoc } from "@/utils/nfseAutomatica";
import { onlyDigits } from "@/lib/validators";

type Props = {
  companyId: string;
  tipo: OrigemNfse;
  id: string;
  docInicial?: string | null;
  nomeInicial?: string | null;
  onFeito: (s: SituacaoNfse) => void;
  onCancelar?: () => void;
};

export function CompletarTomador({ companyId, tipo, id, docInicial, nomeInicial, onFeito, onCancelar }: Props) {
  const [doc, setDoc] = useState(mascararDoc(docInicial || ""));
  const [nome, setNome] = useState(nomeInicial || "");
  const [enviando, setEnviando] = useState(false);
  const est = estadoDoDoc(doc);
  const msg = mensagemDoDoc(doc, { temProduto: false });
  const pode = docValido(doc) && nome.trim().length >= 2 && !enviando;

  async function enviar() {
    if (!pode) return;
    setEnviando(true);
    try {
      const s = await nfseAutomaticaApi.completar(companyId, tipo, id, { doc: onlyDigits(doc), nome: nome.trim() });
      if (s && s.aviso) toast.info(s.aviso);
      onFeito(s);
    } catch (e: any) {
      toast.error((e && e.data && e.data.error) || (e && e.message) || "Não deu para completar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={s.box} testID="nfse-completar">
      <Text style={s.lbl}>CPF ou CNPJ de quem contratou <Text style={{ color: Colors.red }}>*</Text></Text>
      <TextInput
        style={[s.in, est === "invalido" && { borderColor: Colors.red }, (est === "cpf" || est === "cnpj") && { borderColor: Colors.green }]}
        value={doc}
        onChangeText={(v) => setDoc(mascararDoc(v))}
        placeholder={onlyDigits(doc).length > 11 ? "00.000.000/0000-00" : "000.000.000-00"}
        placeholderTextColor={Colors.ink3}
        keyboardType="number-pad"
        maxLength={18}
        accessibilityLabel="CPF ou CNPJ de quem contratou"
        testID="nfse-completar-doc"
      />
      <Text style={[s.msg, msg.tom === "ok" && { color: Colors.green }, msg.tom === "erro" && { color: Colors.red }]}>{msg.texto}</Text>
      <Text style={s.lbl}>Nome de quem contratou <Text style={{ color: Colors.red }}>*</Text></Text>
      <TextInput
        style={s.in}
        value={nome}
        onChangeText={setNome}
        placeholder="Nome completo ou razão social"
        placeholderTextColor={Colors.ink3}
        accessibilityLabel="Nome de quem contratou"
        testID="nfse-completar-nome"
      />
      <View style={s.acoes}>
        {onCancelar && (
          <Pressable onPress={onCancelar} style={s.btn} testID="nfse-completar-cancelar">
            <Text style={s.btnTxt}>Voltar</Text>
          </Pressable>
        )}
        <Pressable
          onPress={enviar}
          disabled={!pode}
          style={[s.btn, s.btnPri, !pode && { opacity: 0.5 }]}
          accessibilityState={{ disabled: !pode }}
          testID="nfse-completar-enviar"
        >
          {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.btnTxt, { color: "#fff" }]}>Completar e emitir</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: "100%", gap: 6, padding: 10, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  lbl: { fontSize: 11, color: Colors.ink2, fontWeight: "700" },
  in: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg2 },
  msg: { fontSize: 11, color: Colors.ink3 },
  acoes: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 },
  btn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4 },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});

export default CompletarTomador;
