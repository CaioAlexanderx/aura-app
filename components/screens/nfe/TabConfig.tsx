import { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { nfeApi } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ns } from "./shared";

// P2 #13: Nuvem Fiscal references removed — generic "provedor fiscal"
export function TabConfig({ companyId }: { companyId: string }) {
  const { company } = useAuthStore();
  const [certFile, setCertFile] = useState("");
  const [certPass, setCertPass] = useState("");

  const setupMut = useMutation({
    mutationFn: () => nfeApi.setup(companyId),
    onSuccess: () => toast.success("Empresa registrada com sucesso!"),
    onError: (e: any) => toast.error(e?.message || "Erro no setup"),
  });

  const certMut = useMutation({
    mutationFn: (body: any) => nfeApi.uploadCertificate(companyId, body),
    onSuccess: () => toast.success("Certificado A1 enviado!"),
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar certificado"),
  });

  function handleCertUpload() {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input"); input.type = "file"; input.accept = ".pfx,.p12";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { setCertFile((reader.result as string).split(",")[1]); toast.info(`Certificado ${file.name} carregado. Informe a senha.`); };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function submitCert() {
    if (!certFile) { toast.error("Selecione o certificado A1 (.pfx)"); return; }
    if (!certPass) { toast.error("Senha do certificado obrigatoria"); return; }
    certMut.mutate({ certificate: certFile, password: certPass });
  }

  const hasCnpj = !!(company as any)?.cnpj;

  return (
    <View>
      <View style={ns.formCard}>
        <Text style={ns.formTitle}>Configuracao fiscal</Text>
        <View style={ns.configItem}>
          <Icon name={hasCnpj ? "check" : "alert"} size={16} color={hasCnpj ? Colors.green : Colors.amber} />
          <Text style={ns.configLabel}>CNPJ cadastrado</Text>
          <Text style={[ns.configValue, { color: hasCnpj ? Colors.green : Colors.amber }]}>{hasCnpj ? (company as any).cnpj : "Nao informado"}</Text>
        </View>
        <View style={ns.divider} />
        <Text style={ns.fLabel}>1. Registrar empresa no provedor fiscal</Text>
        <Pressable onPress={() => setupMut.mutate()} disabled={setupMut.isPending || !hasCnpj} style={[ns.configBtn, (!hasCnpj || setupMut.isPending) && { opacity: 0.5 }]}>
          <Text style={ns.configBtnText}>{setupMut.isPending ? "Registrando..." : "Registrar empresa"}</Text>
        </Pressable>
        <View style={ns.divider} />
        <Text style={ns.fLabel}>2. Enviar certificado digital A1 (.pfx)</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable onPress={handleCertUpload} style={ns.configBtn}><Text style={ns.configBtnText}>{certFile ? "Certificado selecionado" : "Selecionar .pfx"}</Text></Pressable>
        </View>
        {certFile && (
          <View style={{ marginTop: 8 }}>
            <TextInput style={ns.fInput} value={certPass} onChangeText={setCertPass} placeholder="Senha do certificado" placeholderTextColor={Colors.ink3} secureTextEntry />
            <Pressable onPress={submitCert} disabled={certMut.isPending} style={[ns.emitBtn, { marginTop: 8 }, certMut.isPending && { opacity: 0.6 }]}><Text style={ns.emitBtnText}>{certMut.isPending ? "Enviando..." : "Enviar certificado"}</Text></Pressable>
          </View>
        )}
      </View>
      <View style={ns.infoCard}><Icon name="info" size={13} color={Colors.violet3} /><Text style={ns.infoText}>O certificado A1 e necessario para emissao de NF-e e NFC-e. Adquira junto a sua certificadora (Certisign, Serasa, etc). Validade: 1 ano.</Text></View>
    </View>
  );
}
