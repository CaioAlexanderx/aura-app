// ============================================================
// AURA. — Ótica: foto do papel da receita
//
// 23/11/2026. O campo `photo_url` existe na receita desde o começo, mas não
// havia como anexar. O caminho é o mesmo da foto do produto
// (components/ImageUploadSection): escolhe o arquivo no navegador e manda
// base64 + tipo.
//
// A diferença é que esta foto é DADO DE SAÚDE: não pode morar em endereço
// público como a foto de um produto. Por isso o bloco só aparece quando o
// servidor avisa que guarda o arquivo em área privada
// (`capabilities.prescription_photo` no GET de configurações da ótica —
// contrato em docs/otica-cadastro-completo-backend.md, seção 3). Sem o aviso,
// este componente não desenha nada.
//
// A foto nunca entra em mensagem de WhatsApp nem no link de acompanhamento.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { oticaApi, type Prescription } from "@/services/oticaApi";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const LIMITE = 5 * 1024 * 1024;

type Props = {
  companyId: string;
  receita: Prescription;
  /** `capabilities.prescription_photo` do servidor. Falso = não desenha. */
  disponivel: boolean;
  /** Loja com a ótica ligada pode trocar; desligada, só vê. */
  podeEditar: boolean;
  onChanged: (p: Prescription) => void;
};

/** Erro do arquivo escolhido, ou null. */
export function erroDaFoto(file: { size: number; type: string }): string | null {
  if (!TIPOS.includes(file.type)) return "Use uma foto em JPEG, PNG ou WebP.";
  if (file.size > LIMITE) return "A foto deve ter no máximo 5 MB.";
  return null;
}

function lerBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FotoDaReceita({ companyId, receita, disponivel, podeEditar, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  if (!disponivel) return null;
  // Receita sem foto numa loja que não pode editar: nada a mostrar.
  if (!receita.photo_url && !podeEditar) return null;

  function escolher() {
    if (Platform.OS !== "web" || typeof document === "undefined") { toast.info("Anexar a foto está disponível na versão web"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = TIPOS.join(",");
    input.style.cssText = "position:fixed;top:-100px;opacity:0";
    document.body.appendChild(input);
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      const erro = erroDaFoto(file);
      if (erro) { toast.error(erro); return; }
      setBusy(true);
      try {
        const r = await oticaApi.uploadPrescriptionPhoto(companyId, receita.id, { content: await lerBase64(file), content_type: file.type });
        onChanged(r.prescription);
        toast.success("Foto da receita guardada");
      } catch (err: any) {
        toast.error(err?.data?.error || "Não deu para guardar a foto. Tente de novo.");
      } finally {
        setBusy(false);
      }
    };
    input.click();
  }

  async function remover() {
    setBusy(true);
    try {
      const r = await oticaApi.removePrescriptionPhoto(companyId, receita.id);
      onChanged(r.prescription);
      toast.success("Foto removida");
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para remover a foto. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={st.box} testID={`otica-rx-foto-${receita.id}`}>
      <View style={st.icone}><Icon name="camera" size={18} color={Colors.violet3} /></View>
      <View style={{ flex: 1, minWidth: 160 }}>
        <Text style={st.titulo}>{receita.photo_url ? "Foto do papel da receita guardada" : "Foto do papel da receita"}</Text>
        <Text style={st.sub}>JPEG, PNG ou WebP, até 5 MB. Fica guardada com a receita; não vai em mensagem.</Text>
      </View>
      {busy ? <ActivityIndicator color={Colors.violet3} /> : (
        <View style={st.acoes}>
          {!!receita.photo_url && (
            <Pressable onPress={() => Linking.openURL(receita.photo_url!)} style={st.btn} testID={`otica-rx-foto-ver-${receita.id}`}>
              <Text style={st.btnTxt}>Ver foto</Text>
            </Pressable>
          )}
          {podeEditar && (
            <Pressable onPress={escolher} style={st.btn} testID={`otica-rx-foto-anexar-${receita.id}`}>
              <Text style={st.btnTxt}>{receita.photo_url ? "Trocar foto" : "Anexar foto"}</Text>
            </Pressable>
          )}
          {podeEditar && !!receita.photo_url && (
            <Pressable onPress={remover} style={st.btn} testID={`otica-rx-foto-remover-${receita.id}`}>
              <Text style={[st.btnTxt, { color: Colors.red }]}>Remover</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: Colors.border2, borderRadius: 12, padding: 12 },
  icone: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  sub: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 1 },
  acoes: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  btn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  btnTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink },
});
