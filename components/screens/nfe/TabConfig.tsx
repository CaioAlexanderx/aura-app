import { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { nfeApi } from "@/services/api";
import { nfceApi, type NfceConfig } from "@/services/nfceApi";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ns } from "./shared";

// 22/09/2026 (Matcon M2 — fiscal do Simples, docs/CONTRACT_MATCON.md §M2):
// "Minha empresa é do [Simples Nacional]" — uma frase a mais no padrão do
// Matcon, mockup docs/mockups/matcon-m2-fiscal.html#config. É ela que
// decide CSOSN vs CST na emissão e se a pergunta "o imposto já veio
// recolhido?" aparece no cadastro do produto (só regime=simples). Sem
// nfce_config ainda (empresa nova), o default é "simples" — o mais comum
// no varejo de bairro que este módulo atende.
const REGIMES: { key: NonNullable<NfceConfig["regime"]>; label: string }[] = [
  { key: "simples", label: "Simples Nacional" },
  { key: "presumido", label: "Lucro presumido" },
  { key: "real", label: "Lucro real" },
];

// Exportado: TabConfig não está montado em nenhuma tela hoje (a aba
// "Configuração" saiu do TABS de app/(tabs)/nfe.tsx antes desta mudança —
// comentário abaixo, em TabConfig). Pra frase não ficar invisível,
// app/(tabs)/nfe.tsx reusa este mesmo componente num card pequeno no topo
// da aba "Emitir NF-e", só com matcon_enabled.
export function RegimeFiscal({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["nfce-config", companyId],
    queryFn: () => nfceApi.getConfig(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
  });
  const regimeAtual = data?.config?.regime || "simples";
  const [aberto, setAberto] = useState(false);

  const salvarMut = useMutation({
    mutationFn: (regime: NonNullable<NfceConfig["regime"]>) => nfceApi.saveConfig(companyId, { regime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nfce-config", companyId] });
      toast.success("Regime fiscal atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Não deu para salvar o regime fiscal"),
  });

  const rotuloAtual = REGIMES.find((r) => r.key === regimeAtual)?.label || "Simples Nacional";

  return (
    <View style={{ marginBottom: 16 }} testID="nfe-config-regime">
      <Text style={{ fontSize: 15, color: Colors.ink, lineHeight: 24 }}>
        Minha empresa é do{" "}
        <Pressable
          onPress={() => setAberto((v) => !v)}
          style={{
            flexDirection: "row", alignItems: "center", gap: 4,
            backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.violet3 + "66",
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
          }}
          testID="nfe-config-regime-abrir"
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>{rotuloAtual}</Text>
          <Icon name={aberto ? "chevron_up" : "chevron_down"} size={12} color={Colors.ink3} />
        </Pressable>
        .
      </Text>
      <Text style={{ fontSize: 11.5, color: Colors.ink3, marginTop: 4, lineHeight: 16 }}>
        É isso que decide como a nota sai. No Simples, a pergunta &quot;o imposto já veio recolhido?&quot; aparece
        no cadastro do produto; nos outros regimes o cadastro não muda.
      </Text>
      {aberto && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {REGIMES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => { setAberto(false); if (r.key !== regimeAtual) salvarMut.mutate(r.key); }}
              disabled={salvarMut.isPending}
              style={[ns.chip, r.key === regimeAtual && ns.chipActive]}
              testID={`nfe-config-regime-${r.key}`}
            >
              <Text style={[ns.chipText, r.key === regimeAtual && ns.chipTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// P2 #13: Nuvem Fiscal references removed — generic "provedor fiscal"
//
// 22/09/2026: este componente não é montado em nenhuma tela hoje (a aba
// "Configuração" foi removida do TABS de app/(tabs)/nfe.tsx antes desta
// mudança — ver comentário "Aba Configuração some" logo abaixo). A frase
// do regime fiscal (RegimeFiscal, exportado acima) por isso também é
// renderizada direto em app/(tabs)/nfe.tsx, num card no topo da aba
// "Emitir NF-e" — é a única tela onde a config da NF-e existe hoje.
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
    if (!certPass) { toast.error("Senha do certificado obrigatória"); return; }
    certMut.mutate({ certificate: certFile, password: certPass });
  }

  const hasCnpj = !!(company as any)?.cnpj;

  return (
    <View>
      <View style={ns.formCard}>
        <Text style={ns.formTitle}>Configuração fiscal</Text>
        <RegimeFiscal companyId={companyId} />
        <View style={ns.divider} />
        <View style={ns.configItem}>
          <Icon name={hasCnpj ? "check" : "alert"} size={16} color={hasCnpj ? Colors.green : Colors.amber} />
          <Text style={ns.configLabel}>CNPJ cadastrado</Text>
          <Text style={[ns.configValue, { color: hasCnpj ? Colors.green : Colors.amber }]}>{hasCnpj ? (company as any).cnpj : "Não informado"}</Text>
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
      <View style={ns.infoCard}><Icon name="info" size={13} color={Colors.violet3} /><Text style={ns.infoText}>O certificado A1 e necessário para emissão de NF-e e NFC-e. Adquira junto a sua certificadora (Certisign, Serasa, etc). Validade: 1 ano.</Text></View>
    </View>
  );
}
