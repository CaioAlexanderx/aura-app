// ============================================================
// AURA. — Linha "Nota de serviço" na OS, no detalhe da venda e na cobrança
//
// Mockup aprovado docs/mockups/nfse-cadastro-servico.html, tela 5. Regra do
// dono: a nota sai sozinha (backend). Aqui:
//   - nota emitida → "NFS-e nº X emitida" + "Imprimir 2ª via" (nunca outra);
//   - saindo → "NFS-e saindo… em geral leva menos de um minuto";
//   - falha ou pendência → o motivo e "Emitir NFS-e" (pendência de cliente
//     ganha "Completar o cliente"; serviço sem código, "Ver o cadastro do
//     serviço");
//   - 'nenhuma' (venda só de produto, loja que não emite, venda anterior ao
//     opt-in) → não renderiza nada: a tela fica como era;
//   - 'nenhuma' com pode_emitir (10/11/2026, Aura-backend#989: serviço e a
//     loja emite, com ou sem a automática) → "Esta venda ainda não tem
//     NFS-e" + "Emitir NFS-e", como o "Emitir NFC-e" ao lado. Se a nota
//     voltar pendente por falta de quem contratou, o "Completar o cliente"
//     abre sozinho.
//
// Multi-CNPJ: companyId é o da VENDA/OS (a empresa que vendeu ou prestou).
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useSituacaoNfse } from "@/hooks/useNfseAutomatica";
import { nfseAutomaticaApi, type OrigemNfse, type SituacaoNfse, type NotaDaOrigemNfse, type TomadorNfse } from "@/services/nfseAutomaticaApi";
import {
  botaoDaNfse, faltaTomador, motivoDaSituacao, notasEmitidas, numeroJaUsado, rotaDoEmitir,
} from "@/utils/nfseAutomatica";
import { abrirPdfDaNfse } from "./nfseAcoes";
import { AjudaFiscal } from "./AjudaFiscal";
import { CompletarTomador } from "./CompletarTomador";

export const ROTA_CADASTRO_DO_SERVICO = "/estoque";

/** "Emitir NFS-e" / "Tentar de novo": a rota certa para o estado.
 *  `tomador` (opcional) vai no corpo do /emitir — o CPF/CNPJ que o Caixa
 *  pediu. Devolve a situação (null em erro) para quem chama decidir o
 *  próximo passo (ex.: abrir o "Completar o cliente"). */
export function useEmitirNfse(companyId: string | null | undefined, tipo: OrigemNfse, id: string | null | undefined, aplicar: (s: SituacaoNfse) => void) {
  const [emitindo, setEmitindo] = useState(false);
  async function emitir(situacao: SituacaoNfse | null, tomador?: TomadorNfse | null): Promise<SituacaoNfse | null> {
    if (!companyId || !id || emitindo) return null;
    setEmitindo(true);
    try {
      const s = rotaDoEmitir(situacao) === "tentar_de_novo"
        ? await nfseAutomaticaApi.tentarDeNovo(companyId, tipo, id)
        : await nfseAutomaticaApi.emitir(companyId, tipo, id, tomador || null);
      if (s && s.aviso) toast.info(s.aviso);
      aplicar(s);
      return s;
    } catch (e: any) {
      toast.error((e && e.data && e.data.error) || (e && e.message) || "Não deu para emitir a nota de serviço agora.");
      return null;
    } finally {
      setEmitindo(false);
    }
  }
  return { emitir, emitindo };
}

function textoDoGatilho(n: NotaDaOrigemNfse | undefined, origem: "os" | "venda" | "cobranca"): string {
  const g = (n && n.gatilho) || (origem === "os" ? "os" : origem === "cobranca" ? "pagamento" : "venda");
  if (g === "os") return "Saiu sozinha quando a OS foi entregue.";
  if (g === "pagamento") return "Saiu sozinha quando o pagamento entrou.";
  if (g === "manual") return "Emitida pelo botão \"Emitir NFS-e\".";
  return "Saiu sozinha ao finalizar a venda.";
}

type Props = {
  companyId: string | null | undefined;
  tipo: OrigemNfse;
  id: string | null | undefined;
  /** Onde a linha aparece (muda só os textos). */
  origem?: "os" | "venda" | "cobranca";
  /** Sem a caixa de ajuda (quando a tela já mostra uma). */
  semAjuda?: boolean;
  /** Título "Nota de serviço" acima da linha. */
  comTitulo?: boolean;
  /** Estilo da caixa (a OS usa o cartão da tela). */
  style?: any;
  testID?: string;
};

export function NfseDaOrigem({ companyId, tipo, id, origem = tipo === "os" ? "os" : "venda", semAjuda, comTitulo, style, testID = "nfse-origem" }: Props) {
  const { token } = useAuthStore();
  const { situacao, aplicar } = useSituacaoNfse({ companyId, tipo, id, nenhumaEhFinal: true });
  const { emitir, emitindo } = useEmitirNfse(companyId, tipo, id, aplicar);
  const [completando, setCompletando] = useState(false);

  const botao = botaoDaNfse(situacao);
  if (!situacao || botao === "nada" || !companyId || !id) return null;

  const emitidas = notasEmitidas(situacao);
  const motivo = motivoDaSituacao(situacao);
  const quem = origem === "cobranca" ? "o cliente desta cobrança" : origem === "os" ? "o cliente desta OS" : "o cliente desta venda";

  let corpo: JSX.Element;
  if (botao === "segunda_via") {
    corpo = (
      <>
        {emitidas.map((n) => (
          <View key={n.id} style={s.row}>
            <View style={s.ok}>
              <Icon name="check" size={12} color={Colors.green} />
              <Text style={s.okTxt} testID={`${testID}-emitida`}>NFS-e{n.nfse_number ? " nº " + n.nfse_number : ""} emitida</Text>
            </View>
            <Pressable
              onPress={() => abrirPdfDaNfse({ companyId, tipo, id, nfseId: String(n.nfse_id), token })}
              style={s.btn}
              testID={`${testID}-2a-via`}
            >
              <Icon name="file_text" size={13} color={Colors.violet3} />
              <Text style={s.btnTxt}>Imprimir 2ª via</Text>
            </Pressable>
          </View>
        ))}
        <Text style={s.note}>{textoDoGatilho(emitidas[0], origem)} Esta nota já existe: aqui só sai a 2ª via, nunca uma nota nova.</Text>
      </>
    );
  } else if (botao === "aguardar") {
    corpo = (
      <View style={s.row}>
        <View style={s.ok}>
          <ActivityIndicator size="small" color={Colors.violet3} />
          <Text style={s.vaiTxt} testID={`${testID}-saindo`}>NFS-e saindo… em geral leva menos de um minuto.</Text>
        </View>
      </View>
    );
  } else if (situacao.estado === "nenhuma") {
    // Botão manual: serviço, loja que emite, ainda sem nota.
    corpo = completando ? (
      <CompletarTomador
        companyId={companyId}
        tipo={tipo}
        id={id}
        onFeito={(r) => { setCompletando(false); aplicar(r); }}
        onCancelar={() => setCompletando(false)}
      />
    ) : (
      <>
        <Text style={s.none} testID={`${testID}-sem-nota`}>
          {origem === "os" ? "Esta OS ainda não tem NFS-e." : "Esta venda ainda não tem NFS-e."}
        </Text>
        <Pressable
          onPress={async () => { const r = await emitir(situacao); if (faltaTomador(r)) setCompletando(true); }}
          disabled={emitindo}
          style={[s.btn, s.btnPri, { alignSelf: "flex-start" }, emitindo && { opacity: 0.6 }]}
          accessibilityRole="button"
          testID={`${testID}-emitir`}
        >
          {emitindo ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="file_text" size={13} color="#fff" />}
          <Text style={[s.btnTxt, { color: "#fff" }]}>Emitir NFS-e</Text>
        </Pressable>
      </>
    );
  } else {
    const pendente = botao === "completar_e_emitir";
    const cancelada = situacao.estado === "cancelada";
    // série/número já usados por outro emissor: só a mensagem do backend e "Tentar de novo"
    const jaUsado = numeroJaUsado(situacao) && !!motivo;
    const titulo = cancelada ? "A nota de serviço desta " + (origem === "os" ? "OS" : origem === "cobranca" ? "cobrança" : "venda") + " foi cancelada." : "A nota de serviço não saiu sozinha.";
    const detalhe = jaUsado ? String(motivo) : pendente
      ? (motivo || "A prefeitura pede o CPF ou CNPJ de quem contratou, e " + quem + " ainda não tem.") + " Complete o cliente e emita aqui."
      : (motivo ? motivo + " " : "") + (cancelada ? "Se precisar, emita uma nova." : "A " + (origem === "os" ? "OS" : origem === "cobranca" ? "cobrança" : "venda") + " está certinha; falta só a nota. Ela não sai duas vezes, pode emitir com tranquilidade.");
    corpo = (
      <>
        <View style={s.err} testID={`${testID}-problema`}>
          <Icon name="alert" size={13} color={Colors.red} />
          <Text style={s.errTxt}><Text style={{ fontWeight: "800" }}>{titulo}</Text> {detalhe}</Text>
        </View>
        {completando ? (
          <CompletarTomador
            companyId={companyId}
            tipo={tipo}
            id={id}
            onFeito={(r) => { setCompletando(false); aplicar(r); }}
            onCancelar={() => setCompletando(false)}
          />
        ) : (
          <View style={[s.row, { justifyContent: "flex-end" }]}>
            {pendente && (
              <Pressable onPress={() => setCompletando(true)} style={s.btn} testID={`${testID}-completar`}>
                <Icon name="users" size={13} color={Colors.violet3} />
                <Text style={s.btnTxt}>Completar o cliente</Text>
              </Pressable>
            )}
            {botao === "cadastrar_codigo" && (
              <Pressable onPress={() => router.push(ROTA_CADASTRO_DO_SERVICO as any)} style={s.btn} testID={`${testID}-cadastro`}>
                <Text style={s.btnTxt}>Ver o cadastro do serviço</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => emitir(situacao)}
              disabled={emitindo}
              style={[s.btn, s.btnPri, emitindo && { opacity: 0.6 }]}
              testID={`${testID}-emitir`}
            >
              {emitindo ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="receipt" size={13} color="#fff" />}
              <Text style={[s.btnTxt, { color: "#fff" }]}>{jaUsado ? "Tentar de novo" : "Emitir NFS-e"}</Text>
            </Pressable>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[s.box, style]} testID={testID}>
      {comTitulo && <Text style={s.titulo}>Nota de serviço</Text>}
      {corpo}
      {!semAjuda && <AjudaFiscal style={{ marginTop: 4 }} />}
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: "100%", gap: 8 },
  titulo: { fontSize: 11, color: Colors.ink3, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  ok: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  okTxt: { fontSize: 12, color: Colors.green, fontWeight: "700" },
  vaiTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "600", flexShrink: 1 },
  note: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  none: { fontSize: 12, color: Colors.ink3 },
  err: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "44" },
  errTxt: { flex: 1, fontSize: 12, color: Colors.ink, lineHeight: 17 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  btnPri: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
});

export default NfseDaOrigem;
