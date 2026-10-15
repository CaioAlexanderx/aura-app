import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fiscalCertificateApi, type FiscalCertificateUploadResult } from "@/services/fiscalCertificateApi";
import {
  TAMANHO_MAX_BYTES, base64DoDataUrl, erroDeEnvio, formatarTamanho, validarArquivo,
  type CampoDoErro,
} from "@/utils/certificadoA1";

// ============================================================
// Formulário de envio do certificado A1 (14/10/2026).
// Mockup aprovado: docs/mockups/certificado-a1-cliente.html (cartão
// "Eu mesmo cadastro" / "Enviar um novo certificado").
//
// SEGREDOS — leia antes de mexer:
//  · a senha vive só no estado deste componente (secureTextEntry), nunca em
//    storage, query cache, log ou toast;
//  · o conteúdo do .pfx NÃO fica no estado: guardamos o `File` (alça do
//    arquivo no disco) e lemos o base64 só dentro de enviar(), numa variável
//    local que é zerada no finally;
//  · depois de QUALQUER resposta (sucesso ou erro) o campo de senha é limpo;
//  · ao desmontar (trocar de aba/empresa), senha e arquivo são descartados;
//  · o envio não usa useMutation (o cache do react-query guarda as variáveis).
// ============================================================

export type ModoDoFormulario = "novo" | "troca" | "renovar";

type Props = {
  companyId: string;
  empresa: { nome: string; cnpj?: string | null };
  modo: ModoDoFormulario;
  /** Mostra "Cancelar" (só quando o formulário foi aberto por um clique). */
  podeCancelar?: boolean;
  onCancelar?: () => void;
  onEnviado: (resultado: FiscalCertificateUploadResult) => void;
};

const IS_WEB = Platform.OS === "web";

function lerBase64(arquivo: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(base64DoDataUrl(String(reader.result || "")));
    reader.onerror = () => reject(new Error("leitura"));
    reader.readAsDataURL(arquivo);
  });
}

export function CertificadoForm({ companyId, empresa, modo, podeCancelar, onCancelar, onEnviado }: Props) {
  const [arquivo, setArquivo] = useState<any>(null);          // File (alça do disco), não o conteúdo
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ campo: CampoDoErro; texto: string } | null>(null);
  const senhaRef = useRef<TextInput>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      // Desmontar = descartar. Nada de senha ou arquivo sobrevive à aba.
      montado.current = false;
      setSenha("");
      setArquivo(null);
    };
  }, []);

  function escolherArquivo() {
    if (!IS_WEB || typeof document === "undefined") {
      setErro({ campo: "geral", texto: "Para enviar o certificado, abra a Aura pelo navegador do computador. Se preferir, chame a Aura no WhatsApp ao lado." });
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pfx,.p12";
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      setNomeArquivo(f.name);
      const v = validarArquivo({ name: f.name, size: f.size });
      if (!v.ok) {
        setArquivo(null);
        setErro({ campo: "arquivo", texto: v.motivo });
        return;
      }
      setArquivo(f);
      setErro(null);
    };
    input.click();
  }

  async function enviar() {
    if (enviando || !arquivo || !senha) return;
    const v = validarArquivo({ name: arquivo.name, size: arquivo.size });
    if (!v.ok) { setErro({ campo: "arquivo", texto: v.motivo }); return; }

    setEnviando(true);
    setErro(null);
    let base64 = "";
    try {
      try {
        base64 = await lerBase64(arquivo);
      } catch {
        if (montado.current) {
          setArquivo(null);
          setErro({ campo: "arquivo", texto: "Não conseguimos ler este arquivo. Escolha o arquivo do certificado A1, que termina em .pfx ou .p12." });
        }
        return;
      }
      const resultado = await fiscalCertificateApi.upload(companyId, { pfx_base64: base64, password: senha });
      base64 = "";
      setSenha("");
      setArquivo(null);
      setNomeArquivo("");
      onEnviado(resultado);
    } catch (e: any) {
      // Senha limpa em QUALQUER erro; o arquivo (alça) só sai se o erro é dele.
      setSenha("");
      const er = erroDeEnvio(e, empresa);
      if (!montado.current) return;
      if (er.campo === "arquivo") setArquivo(null);
      setErro({ campo: er.campo, texto: er.texto });
      if (er.campo === "senha") setTimeout(() => { senhaRef.current?.focus(); }, 0);
    } finally {
      base64 = "";
      if (montado.current) setEnviando(false);
    }
  }

  const titulo = modo === "novo" ? "Eu mesmo cadastro" : "Enviar um novo certificado";
  const sub =
    modo === "novo" ? "Leva uns 2 minutos. Você só precisa do arquivo e da senha do certificado."
    : modo === "renovar" ? "Envie o arquivo do certificado renovado. Assim que ele for aceito, a emissão volta a funcionar."
    : "O certificado atual continua valendo até o novo ser aceito.";
  const pronto = !!arquivo && !!senha && !enviando;
  const erroArquivo = erro && erro.campo === "arquivo" ? erro.texto : null;
  const erroSenha = erro && erro.campo === "senha" ? erro.texto : null;
  const erroGeral = erro && erro.campo === "geral" ? erro.texto : null;

  return (
    <View style={f.card} testID="cert-a1-form">
      <View style={f.head}>
        <Icon name="lock" size={18} color={Colors.violet3} />
        <Text style={f.title}>{titulo}</Text>
      </View>
      <Text style={f.sub}>{sub}</Text>

      {modo === "novo" && (
        <View style={f.steps}>
          {[
            ["Tenha o arquivo do certificado A1 em mãos.", " É o arquivo que termina em .pfx ou .p12, que você recebeu ao comprar o certificado digital. O contador ou quem vendeu o certificado pode reenviar."],
            ["Escolha o arquivo", " aqui embaixo."],
            ["Digite a senha do certificado", ", a mesma que você criou quando o emitiu."],
          ].map((p, i) => (
            <View key={i} style={f.step}>
              <View style={f.stepN}><Text style={f.stepNText}>{i + 1}</Text></View>
              <Text style={f.stepText}><Text style={f.stepBold}>{p[0]}</Text>{p[1]}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={f.label}>Arquivo do certificado</Text>
      <View style={[f.fileBox, !!erroArquivo && f.boxErr, enviando && { opacity: 0.6 }]}>
        <Icon name="file_text" size={16} color={Colors.ink3} />
        <Text style={[f.fileName, !!nomeArquivo && { color: Colors.ink }]} numberOfLines={1}>
          {nomeArquivo || "Nenhum arquivo escolhido"}
        </Text>
        <Pressable
          onPress={escolherArquivo}
          disabled={enviando}
          accessibilityRole="button"
          accessibilityLabel={nomeArquivo ? "Trocar arquivo do certificado" : "Escolher arquivo do certificado"}
          style={f.btnSm}
          testID="cert-a1-escolher"
        >
          <Text style={f.btnSmText}>{nomeArquivo ? "Trocar arquivo" : "Escolher arquivo"}</Text>
        </Pressable>
      </View>
      {erroArquivo ? (
        <View style={f.errRow} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="cert-a1-erro-arquivo">
          <Icon name="x_circle" size={16} color={Colors.red} />
          <Text style={f.errText}>{erroArquivo}</Text>
        </View>
      ) : (
        <Text style={f.help}>Arquivos .pfx ou .p12, de até {formatarTamanho(TAMANHO_MAX_BYTES)}.</Text>
      )}

      <Text style={f.label}>Senha do certificado</Text>
      <View style={f.pwWrap}>
        <TextInput
          ref={senhaRef}
          value={senha}
          onChangeText={(t) => { setSenha(t); if (erro && erro.campo === "senha") setErro(null); }}
          secureTextEntry={!mostrar}
          editable={!enviando}
          placeholder="Digite a senha"
          placeholderTextColor={Colors.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          accessibilityLabel="Senha do certificado"
          onSubmitEditing={() => { if (pronto) enviar(); }}
          style={[f.input, !!erroSenha && f.boxErr, enviando && { opacity: 0.6 }]}
          testID="cert-a1-senha"
        />
        <Pressable
          onPress={() => setMostrar((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={mostrar ? "Ocultar senha" : "Mostrar senha"}
          style={f.eye}
          testID="cert-a1-olho"
        >
          <Icon name={mostrar ? "eye_off" : "eye"} size={20} color={Colors.ink3} />
        </Pressable>
      </View>
      {!!erroSenha && (
        <View style={f.errRow} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="cert-a1-erro-senha">
          <Icon name="x_circle" size={16} color={Colors.red} />
          <Text style={f.errText}>{erroSenha}</Text>
        </View>
      )}

      {!!erroGeral && (
        <View style={[f.errRow, { marginTop: 12 }]} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID="cert-a1-erro-geral">
          <Icon name="x_circle" size={16} color={Colors.red} />
          <Text style={f.errText}>{erroGeral}</Text>
        </View>
      )}

      {enviando && (
        <Text style={[f.help, { marginTop: 12 }]} accessibilityLiveRegion="polite">
          Estamos conferindo o certificado. Leva alguns segundos, não feche esta tela.
        </Text>
      )}

      <View style={f.actions}>
        <Pressable
          onPress={enviar}
          disabled={!pronto}
          accessibilityRole="button"
          accessibilityState={{ disabled: !pronto }}
          style={[f.btnPri, !pronto && f.btnPriOff]}
          testID="cert-a1-enviar"
        >
          {enviando && <ActivityIndicator size="small" color="#fff" />}
          <Text style={[f.btnPriText, !pronto && { color: Colors.ink3 }]}>{enviando ? "Enviando…" : "Enviar certificado"}</Text>
        </Pressable>
        {podeCancelar && !enviando && onCancelar && (
          <Pressable onPress={onCancelar} accessibilityRole="button" style={f.btnGhost} testID="cert-a1-cancelar">
            <Text style={f.btnGhostText}>Cancelar</Text>
          </Pressable>
        )}
      </View>

      <View style={f.note}>
        <Icon name="lock" size={14} color={Colors.violet3} />
        <Text style={f.noteText}>Seu certificado é guardado criptografado e a senha não fica salva.</Text>
      </View>
    </View>
  );
}

const f = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 13, color: Colors.ink3, marginTop: 4, marginBottom: 14, lineHeight: 19 },
  steps: { gap: 10, marginBottom: 16 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepN: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNText: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  stepText: { flex: 1, fontSize: 13, color: Colors.ink3, lineHeight: 19 },
  stepBold: { color: Colors.ink, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "600", color: Colors.ink, marginBottom: 6, marginTop: 6 },
  fileBox: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48,
    backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingLeft: 12, paddingRight: 6, paddingVertical: 6,
  },
  fileName: { flex: 1, fontSize: 13, color: Colors.ink3 },
  boxErr: { borderColor: Colors.red },
  btnSm: {
    minHeight: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  btnSmText: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  help: { fontSize: 12, color: Colors.ink3, marginTop: 6 },
  errRow: { flexDirection: "row", gap: 7, alignItems: "flex-start", marginTop: 8 },
  errText: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  pwWrap: { position: "relative", justifyContent: "center" },
  input: {
    height: 48, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingLeft: 12, paddingRight: 50, fontSize: 14, color: Colors.ink,
  },
  eye: { position: "absolute", right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 18 },
  btnPri: {
    flexGrow: 1, flexBasis: 200, minHeight: 46, borderRadius: 10, backgroundColor: Colors.violet,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18,
  },
  btnPriOff: { backgroundColor: Colors.bg4 },
  btnPriText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnGhost: { minHeight: 46, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  btnGhostText: { fontSize: 14, fontWeight: "600", color: Colors.ink3 },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  noteText: { flex: 1, fontSize: 12, color: Colors.ink3, lineHeight: 17 },
});
