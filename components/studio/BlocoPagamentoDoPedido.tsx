// ============================================================
// AURA Studio · Bloco "Pagamento" do detalhe do pedido (26/09/2026)
//
// Achado A1 do QA da lojista (P0, história LJ-33): a lojista Studio não
// tinha onde conferir o comprovante nem confirmar o Pix por chave de um
// pedido da vitrine. O aviso "Comprovante para conferir" abre
// /studio/pedidos/:id, e é aqui que ela confere e dá baixa.
//
// - Forma, situação legível, valor em reais e o comprovante (miniatura
//   que amplia; PDF abre fora).
// - "Confirmar pagamento recebido" / "Aprovar pagamento" e "Recusar
//   pagamento", sempre com confirmação antes de gravar. A chamada é a
//   MESMA do Canal (approve-payment / reject-payment), exportada de
//   hooks/useDigitalOrders.
// - Multi-CNPJ: a empresa da chamada é a do PEDIDO (company_id), não a
//   da sessão — na visão de grupo as duas podem diferir.
// - Enquanto pede ação, o bloco fica em âmbar e vai para o topo do
//   detalhe (quem posiciona é a tela).
//
// Regras em ./pagamentoDoPedido (puras, testadas sem montar componente).
// ============================================================
import { useMemo, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal, Image, TextInput, ActivityIndicator, Linking,
} from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { pagamentoDoPedidoDigitalApi } from "@/hooks/useDigitalOrders";
import {
  situacaoDoPagamento, acoesDoPagamento, formaDoPagamento, reais, totalDoPedido,
  comprovanteEhPdf, type PagamentoDoPedido, type TomDoPagamento,
} from "./pagamentoDoPedido";

type Props = {
  pedido: PagamentoDoPedido;
  /** Empresa da sessão — só se o pedido não trouxer company_id. */
  companyIdDaSessao?: string | null;
  /** Recarrega o pedido depois de confirmar ou recusar. */
  onAtualizado: () => void | Promise<void>;
};

type Confirmacao = "aprovar" | "recusar" | null;

export function BlocoPagamentoDoPedido({ pedido, companyIdDaSessao, onAtualizado }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const situacao = situacaoDoPagamento(pedido);
  const { podeAgir, rotuloConfirmar } = acoesDoPagamento(pedido);
  const total = reais(totalDoPedido(pedido));
  const numero = pedido.order_number != null && pedido.order_number !== "" ? `#${pedido.order_number}` : "";
  const cid = pedido.company_id || companyIdDaSessao || null;

  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [motivo, setMotivo] = useState("");
  const [agindo, setAgindo] = useState<Confirmacao>(null);
  const [ampliado, setAmpliado] = useState(false);
  const [miniaturaFalhou, setMiniaturaFalhou] = useState(false);

  const cor = corDoTom(t, situacao.tom);
  const comprovante = pedido.payment_proof_url || null;
  const pdf = comprovanteEhPdf(comprovante);

  function fechar() {
    if (agindo) return;
    setConfirmacao(null);
    setMotivo("");
  }

  async function executar() {
    const acao = confirmacao;
    if (!acao || !pedido.id) return;
    if (!cid) {
      toast.error("Empresa não identificada — recarregue a página e tente de novo.");
      return;
    }
    setAgindo(acao);
    try {
      if (acao === "aprovar") {
        await pagamentoDoPedidoDigitalApi.aprovar(cid, pedido.id);
        toast.success(`Pagamento confirmado${numero ? ` · pedido ${numero}` : ""}`);
      } else {
        await pagamentoDoPedidoDigitalApi.recusar(cid, pedido.id, motivo.trim() || undefined);
        toast.success(`Pagamento recusado${numero ? ` · pedido ${numero} cancelado` : ""}`);
      }
      setConfirmacao(null);
      setMotivo("");
      await onAtualizado();
    } catch (e: any) {
      const padrao = acao === "aprovar" ? "Não foi possível confirmar o pagamento" : "Não foi possível recusar o pagamento";
      toast.error(e?.message ? `${padrao}: ${e.message}` : padrao);
    } finally {
      setAgindo(null);
    }
  }

  return (
    <View
      testID="bloco-pagamento"
      style={[s.bloco, situacao.precisaAgir && { backgroundColor: t.warningSoft, borderColor: t.warning }]}
    >
      <Text style={s.eyebrow} accessibilityRole="header">PAGAMENTO</Text>

      <View style={s.linha}>
        <View style={s.campo}>
          <Text style={s.rotulo}>Forma</Text>
          <Text style={s.valor}>{formaDoPagamento(pedido.payment_method)}</Text>
        </View>
        <View style={s.campo}>
          <Text style={s.rotulo}>Valor</Text>
          <Text style={[s.valor, s.numero]}>{total}</Text>
        </View>
      </View>

      <View style={[s.pilula, { backgroundColor: cor.fundo }]}>
        <Icon name={iconeDoTom(situacao.tom)} size={14} color={cor.texto} />
        <Text style={[s.pilulaTxt, { color: cor.texto }]}>{situacao.rotulo}</Text>
      </View>
      <Text style={s.detalhe}>{situacao.detalhe}</Text>

      {comprovante ? (
        <View style={s.comprovante}>
          <Text style={s.rotulo}>Comprovante</Text>
          {pdf || miniaturaFalhou ? (
            <Pressable
              onPress={() => Linking.openURL(comprovante)}
              style={s.botaoArquivo}
              accessibilityRole="button"
              accessibilityLabel={pdf ? "Abrir comprovante em PDF" : "Abrir comprovante"}
            >
              <Icon name="file-text" size={18} color={t.primary} />
              <Text style={s.botaoArquivoTxt}>{pdf ? "Abrir comprovante (PDF)" : "Abrir comprovante"}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setAmpliado(true)}
              style={s.miniaturaAlvo}
              accessibilityRole="imagebutton"
              accessibilityLabel="Ver comprovante em tamanho real"
            >
              <Image
                source={{ uri: comprovante }}
                style={s.miniatura}
                resizeMode="cover"
                onError={() => setMiniaturaFalhou(true)}
              />
              <Text style={s.dica}>Toque para ampliar</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {podeAgir ? (
        <View style={s.acoes}>
          <Pressable
            testID="btn-confirmar-pagamento"
            onPress={() => setConfirmacao("aprovar")}
            disabled={!!agindo}
            style={[s.botao, { backgroundColor: t.primary }, agindo && s.desligado]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!agindo, busy: agindo === "aprovar" }}
          >
            {agindo === "aprovar"
              ? <ActivityIndicator size="small" color="#fff" />
              : <Icon name="check-circle" size={16} color="#fff" />}
            <Text style={s.botaoTxt}>{rotuloConfirmar}</Text>
          </Pressable>
          <Pressable
            testID="btn-recusar-pagamento"
            onPress={() => setConfirmacao("recusar")}
            disabled={!!agindo}
            style={[s.botao, s.botaoSecundario, agindo && s.desligado]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!agindo, busy: agindo === "recusar" }}
          >
            {agindo === "recusar"
              ? <ActivityIndicator size="small" color={t.dangerInk} />
              : <Icon name="x-circle" size={16} color={t.dangerInk} />}
            <Text style={[s.botaoTxt, { color: t.dangerInk }]}>Recusar pagamento</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Confirmação antes de gravar — as duas ações mexem no pedido da cliente. */}
      <Modal visible={confirmacao !== null} transparent animationType="fade" onRequestClose={fechar}>
        <View style={s.fundoModal}>
          <View style={s.caixaModal}>
            {confirmacao === "aprovar" ? (
              <>
                <Text style={s.tituloModal}>
                  {pedido.payment_method === "pix" || !pedido.payment_method ? `Confirmar o Pix de ${total}?` : `Confirmar o pagamento de ${total}?`}
                </Text>
                <Text style={s.textoModal}>
                  {[numero && `Pedido ${numero}`, pedido.customer_name].filter(Boolean).join(" · ")}
                  {numero || pedido.customer_name ? "\n\n" : ""}
                  Confira no extrato do banco se o valor caiu. O pedido passa para pago, a cliente vê
                  "Pagamento recebido" e ele sai do cancelamento automático.
                </Text>
              </>
            ) : (
              <>
                <Text style={s.tituloModal}>Recusar o pagamento?</Text>
                <Text style={s.textoModal}>
                  {numero ? `O pedido ${numero} será cancelado.` : "O pedido será cancelado."} Use quando o Pix
                  não caiu ou o comprovante não confere.
                </Text>
                <Text style={[s.rotulo, { marginTop: 12 }]}>Motivo (opcional)</Text>
                <TextInput
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder="Ex.: o valor do comprovante não confere"
                  placeholderTextColor={t.ink4}
                  style={s.entrada}
                  maxLength={200}
                  accessibilityLabel="Motivo da recusa"
                />
              </>
            )}
            <View style={s.botoesModal}>
              <Pressable
                onPress={fechar}
                disabled={!!agindo}
                style={[s.botao, s.botaoSecundario]}
                accessibilityRole="button"
              >
                <Text style={[s.botaoTxt, { color: t.ink2 }]}>Voltar</Text>
              </Pressable>
              <Pressable
                testID="btn-confirmar-acao"
                onPress={executar}
                disabled={!!agindo}
                style={[s.botao, { backgroundColor: confirmacao === "recusar" ? t.danger : t.primary }, agindo && s.desligado]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!agindo, busy: !!agindo }}
              >
                {agindo ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={s.botaoTxt}>
                  {agindo
                    ? (confirmacao === "recusar" ? "Recusando..." : "Confirmando...")
                    : (confirmacao === "recusar" ? "Recusar e cancelar" : "Sim, confirmar")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comprovante em tamanho real. */}
      <Modal visible={ampliado} transparent animationType="fade" onRequestClose={() => setAmpliado(false)}>
        <View style={s.fundoLightbox}>
          {comprovante ? <Image source={{ uri: comprovante }} style={s.imagemGrande} resizeMode="contain" /> : null}
          <View style={s.botoesModal}>
            <Pressable
              onPress={() => comprovante && Linking.openURL(comprovante)}
              style={[s.botao, { backgroundColor: t.paperCardElev }]}
              accessibilityRole="button"
            >
              <Icon name="external-link" size={16} color={t.ink} />
              <Text style={[s.botaoTxt, { color: t.ink }]}>Abrir original</Text>
            </Pressable>
            <Pressable
              onPress={() => setAmpliado(false)}
              style={[s.botao, { backgroundColor: t.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Fechar comprovante"
            >
              <Text style={s.botaoTxt}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function corDoTom(t: StudioPalette, tom: TomDoPagamento): { fundo: string; texto: string } {
  if (tom === "atencao") return { fundo: t.paperCardElev, texto: t.warningInk };
  if (tom === "sucesso") return { fundo: t.successSoft, texto: t.successInk };
  return { fundo: t.bgSoft, texto: t.ink2 };
}

function iconeDoTom(tom: TomDoPagamento): string {
  if (tom === "atencao") return "clock";
  if (tom === "sucesso") return "check-circle";
  return "info";
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    bloco: { backgroundColor: t.paperCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: t.ink5, marginBottom: 14 },
    eyebrow: { fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 0.8, marginBottom: 10 },
    linha: { flexDirection: "row", gap: 24, flexWrap: "wrap", marginBottom: 12 },
    campo: { minWidth: 120 },
    rotulo: { fontSize: 11, fontWeight: "700", color: t.ink3, marginBottom: 2 },
    valor: { fontSize: 15, fontWeight: "700", color: t.ink },
    numero: { fontVariant: ["tabular-nums"] },
    pilula: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    pilulaTxt: { fontSize: 12, fontWeight: "800" },
    detalhe: { fontSize: 12.5, color: t.ink2, lineHeight: 18, marginTop: 8 },
    comprovante: { marginTop: 14 },
    miniaturaAlvo: { alignSelf: "flex-start", gap: 4, minHeight: 44 },
    miniatura: { width: 96, height: 120, borderRadius: 10, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 },
    dica: { fontSize: 11, color: t.ink3 },
    botaoArquivo: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCardElev },
    botaoArquivoTxt: { color: t.primary, fontWeight: "700", fontSize: 13 },
    acoes: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 16 },
    botao: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 12 },
    botaoSecundario: { backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink4 },
    botaoTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
    desligado: { opacity: 0.6 },
    fundoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 16 },
    caixaModal: { backgroundColor: t.paperCardElev, borderRadius: 20, padding: 22, width: "100%", maxWidth: 440 },
    tituloModal: { fontSize: 17, fontWeight: "800", color: t.ink, marginBottom: 8 },
    textoModal: { fontSize: 13.5, color: t.ink2, lineHeight: 20 },
    entrada: { borderWidth: 1, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: t.ink, backgroundColor: t.bg },
    botoesModal: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 },
    fundoLightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 16 },
    imagemGrande: { width: "100%", height: "80%" },
  });
}
