// ============================================================
// AURA STUDIO · Pedir aprovação da arte (27/11/2026)
//
// Refeito fiel ao mockup da Nina (Personalizados → Produção → pedido).
// UMA tela, sem passos:
//
//   · ao abrir, a Aura grava o vídeo da peça girando (gravarGiro, o mesmo
//     do orçamento em vídeo) e mostra a barra; o botão fica travado em
//     "Preparando o vídeo…" até o vídeo ficar pronto;
//   · à esquerda, "Como a Ana vê": a prévia da página de aprovação, só
//     para olhar (sem ação);
//   · à direita, o que vai para a cliente, o WhatsApp, a mensagem e o
//     envio. "Usar outro arquivo" guarda o que existia: foto, PDF e link.
//   · no celular, a prévia vem primeiro e o botão fica fixo embaixo.
//
// O fluxo do servidor não mudou: o vídeo sobe e vira um render ligado ao
// pedido (render_id), o link nasce em POST /orders/:id/approval e o
// WhatsApp abre com o texto pronto. A mensagem leva o link na linha de
// baixo; o texto do WhatsApp é montado aqui, porque o link só existe
// depois que o servidor responde.
// ============================================================
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, Linking, Platform, ActivityIndicator,
  ScrollView, useWindowDimensions,
} from "react-native";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, type StudioOrder, type StudioOrderItem, type StudioApprovalCreated } from "@/services/studioApi";
import { studioVisualApi } from "@/services/studioVisualApi";
import { gerarRenderDoPedido, type EtapaDoRender } from "@/components/studio/visualEngine/gerarRenderAprovacao";
import { DURACAO_S } from "@/components/studio/orcamentoVideo/gravarGiro";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import { maskPhone } from "@/utils/masks";
import { nomeDaLojaDe } from "@/utils/nomeDaLoja";
import { pickImageBase64, uploadStudioMockup } from "@/services/studioUploadApi";
import { numeroDoPedido } from "@/components/studio/pagamentoDoPedido";
import { ehCelular, respiroInferior } from "@/components/studio/modalNoCelular";
import {
  type Anexo, ehPdf, ehVideo, itensDaPrevia, linkDoWhatsApp, mensagemPadrao, primeiroNomeDe,
  progressoDaGeracao, reais, rotuloDoItem, seloDoAnexo, telefoneValido, textoComLink,
} from "@/components/studio/aprovacaoDaArte/regras";

type Props = {
  order: StudioOrder;
  onClose: () => void;
  onSent: () => void;
};

type Fase = "gerando" | "pronto" | "falhou";

const ESCRITO_NA_WEB = Platform.OS === "web";

export function ApprovalRequestModal({ order, onClose, onSent }: Props) {
  const t = useStudioTokens();
  const { width } = useWindowDimensions();
  const celular = ehCelular(width);
  const s = useMemo(() => buildStyles(t, celular, width), [t, celular, width]);
  const { company, companyLogo } = useAuthStore() as any;
  const nomeDaLoja = nomeDaLojaDe(company) || "";

  // ── Dados do pedido ────────────────────────────────────────
  const [itens, setItens] = useState<StudioOrderItem[] | null>(null);
  const [totalDoPedido, setTotalDoPedido] = useState<number>(Number(order.total_amount) || 0);
  useEffect(() => {
    let vivo = true;
    if (!company?.id) return;
    studioApi.getOrder(company.id, order.id)
      .then((d) => {
        if (!vivo) return;
        setItens(d?.items || []);
        const tot = Number((d?.order as any)?.total ?? d?.order?.total_amount);
        if (Number.isFinite(tot) && tot > 0) setTotalDoPedido(tot);
      })
      .catch(() => { if (vivo) setItens([]); });
    return () => { vivo = false; };
  }, [company?.id, order.id]);
  const linhas = useMemo(() => itensDaPrevia(itens), [itens]);

  // ── A cliente, o telefone e a mensagem ─────────────────────
  const [nome, setNome] = useState(order.customer_name || order.display_name || "");
  const [telefone, setTelefone] = useState(maskPhone(order.customer_phone || ""));
  const [mensagemEditada, setMensagemEditada] = useState<string | null>(null);
  const primeiro = primeiroNomeDe(nome);
  const mensagem = mensagemEditada ?? mensagemPadrao(nome);
  const ela = primeiro ? "a " + primeiro : "a cliente";

  // ── O vídeo (ou outro arquivo) ─────────────────────────────
  const [fase, setFase] = useState<Fase>("gerando");
  const [etapa, setEtapa] = useState<EtapaDoRender | null>(null);
  const [giro, setGiro] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const tentativa = useRef(0);

  async function gravar() {
    const minha = ++tentativa.current;
    setFase("gerando"); setEtapa(null); setGiro(0); setErro(null); setAnexo(null);
    if (!company?.id) return;
    if (!ESCRITO_NA_WEB) {
      setFase("falhou");
      setErro("A gravação do vídeo está disponível na versão web. Use outro arquivo.");
      return;
    }
    // Um quadro para a tela pintar antes da gravação pesada (LJ-36).
    await new Promise<void>((r) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(r, 0));
      else setTimeout(r, 0);
    });
    try {
      const r = await gerarRenderDoPedido(
        company.id,
        order.id,
        (e) => { if (minha === tentativa.current) setEtapa(e); },
        {
          marca: { nome: nomeDaLoja, logoUrl: companyLogo || company?.logo_url || null },
          aoProgredir: (f) => { if (minha === tentativa.current) setGiro(f); },
        },
      );
      if (minha !== tentativa.current) return;
      setAnexo({ url: r.url, isVideo: !!r.isVideo, renderId: r.renderId, origem: "gerado" });
      setFase("pronto");
    } catch (e: any) {
      if (minha !== tentativa.current) return;
      const msg = e?.code === "timeout"
        ? "O envio demorou demais (arquivo grande ou conexão lenta). Grave de novo ou use outro arquivo."
        : e?.message || "Não deu para gravar o vídeo. Use outro arquivo.";
      setFase("falhou");
      setErro(msg);
    }
  }

  useEffect(() => {
    gravar();
    return () => { tentativa.current += 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Outro arquivo: foto, PDF ou link ───────────────────────
  const [outroAberto, setOutroAberto] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [linkColado, setLinkColado] = useState("");

  function usarArquivo(url: string) {
    tentativa.current += 1; // cancela a gravação em curso
    setAnexo({ url, isVideo: ehVideo(url), renderId: null, origem: "arquivo" });
    setFase("pronto");
    setErro(null);
  }

  async function subirDoAparelho() {
    if (!company?.id || subindo) return;
    const escolhido = await pickImageBase64("image/*,application/pdf").catch((e: any) => {
      toast.error(e?.message || "Não foi possível abrir a galeria.");
      return null;
    });
    if (!escolhido) return;
    setSubindo(true);
    try {
      const r = await uploadStudioMockup(company.id, {
        content_base64: escolhido.base64,
        content_type: escolhido.content_type,
        kind: "approval",
      });
      usarArquivo(r.url);
      setLinkColado("");
    } catch (e: any) {
      toast.error(e?.message || "Não deu para enviar o arquivo.");
    } finally {
      setSubindo(false);
    }
  }

  function colarLink(v: string) {
    setLinkColado(v);
    const url = v.trim();
    if (/^https?:\/\/\S+$/.test(url)) usarArquivo(url);
  }

  // ── Link da aprovação e envio ──────────────────────────────
  const [criado, setCriado] = useState<{ chave: string; dados: StudioApprovalCreated } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const telefoneOk = telefoneValido(telefone);
  const pronto = fase === "pronto" && !!anexo;

  /** O link nasce uma vez por arquivo: copiar e mandar reaproveitam o mesmo. */
  async function garantirLink(): Promise<StudioApprovalCreated | null> {
    if (!company?.id || !anexo) return null;
    const chave = anexo.url + "|" + (anexo.renderId || "");
    if (criado && criado.chave === chave) return criado.dados;
    const corpo = { mockup_url: anexo.url, customer_phone: telefone.trim() || undefined };
    const r = anexo.renderId
      ? await studioVisualApi.requestApprovalWithRender(company.id, order.id, { ...corpo, render_id: anexo.renderId })
      : await studioApi.requestApproval(company.id, order.id, corpo);
    const dados = r as StudioApprovalCreated;
    setCriado({ chave, dados });
    return dados;
  }

  async function copiarLink() {
    if (!pronto || enviando) return;
    setEnviando(true);
    try {
      const c = await garantirLink();
      if (!c) return;
      const ok = await copyToClipboard(c.approval_url);
      if (ok) toast.success("Link copiado");
      else toast.info(c.approval_url);
    } catch (e: any) {
      toast.error(e?.message || "Não deu para criar o link.");
    } finally {
      setEnviando(false);
    }
  }

  async function mandar() {
    if (!pronto || enviando || !telefoneOk) return;
    setEnviando(true);
    try {
      const c = await garantirLink();
      if (!c) return;
      const conversa = linkDoWhatsApp(telefone, textoComLink(mensagem, c.approval_url));
      if (!conversa) {
        toast.error("Confira o WhatsApp da cliente: faltou o DDD ou algum número.");
        return;
      }
      if (Platform.OS === "web") window.open(conversa, "_blank");
      else Linking.openURL(conversa).catch(() => toast.error("Não foi possível abrir o WhatsApp"));
      setEnviado(true);
    } catch (e: any) {
      toast.error(e?.message || "Não deu para criar o link.");
    } finally {
      setEnviando(false);
    }
  }

  const rotuloDoBotao = fase === "gerando" ? "Preparando o vídeo…" : enviando ? "Abrindo o WhatsApp…" : "Mandar pelo WhatsApp";
  const botaoTravado = !pronto || enviando || !telefoneOk;

  // ── Peças da tela ──────────────────────────────────────────
  const urlDoAnexo = anexo ? anexo.url : null;
  const palco = (
    <View style={s.palco} testID="aprovacao-palco">
      {fase === "gerando" ? <Text style={s.palcoTxt}>Preparando o vídeo da peça…</Text> : null}
      {fase === "falhou" ? <Text style={s.palcoTxt}>Sem prévia ainda</Text> : null}
      {pronto && urlDoAnexo && anexo!.isVideo && Platform.OS === "web"
        ? createElement("video", {
            src: urlDoAnexo, autoPlay: true, loop: true, muted: true, playsInline: true,
            "data-testid": "aprovacao-video",
            style: { width: "100%", height: "100%", objectFit: celular ? "contain" : "cover", display: "block" },
          })
        : null}
      {pronto && urlDoAnexo && !anexo!.isVideo && !ehPdf(urlDoAnexo)
        ? <Image source={{ uri: urlDoAnexo }} style={s.palcoImg} resizeMode="contain" />
        : null}
      {pronto && urlDoAnexo && ehPdf(urlDoAnexo) ? <Text style={s.palcoTxt}>Arquivo em PDF</Text> : null}
    </View>
  );

  const previa = (
    <View style={s.previaCol}>
      <View style={s.previaTopo}>
        <Text style={s.meta}>Como {ela} vê</Text>
        {celular && pronto && anexo ? <Text style={s.seloPeq}>{anexo.origem === "arquivo" ? "✓ Arquivo pronto" : anexo.isVideo ? "✓ Vídeo pronto" : "✓ Imagem pronta"}</Text> : null}
      </View>
      <View style={s.previaCartao} testID="aprovacao-previa">
        {celular ? null : (
          <View style={s.previaCabeca}>
            <Text style={s.previaLoja} numberOfLines={1}>{nomeDaLoja || "Sua loja"}</Text>
            <Text style={s.previaSub}>Aprovação da arte</Text>
          </View>
        )}
        {palco}
        <View style={s.previaItens}>
          {celular ? null : linhas.map((l, i) => (
            <View key={i} style={s.previaLinha}>
              <Text style={s.previaItemTxt} numberOfLines={2}>{rotuloDoItem(l)}</Text>
              <Text style={s.previaItemTxt}>{reais(l.valor)}</Text>
            </View>
          ))}
          <View style={[s.previaLinha, s.previaTotal]}>
            <Text style={s.previaTotalTxt}>Total</Text>
            <Text style={s.previaTotalTxt} testID="aprovacao-total">{reais(totalDoPedido)}</Text>
          </View>
        </View>
        {celular ? null : (
          <View style={s.previaBotoes}>
            <View style={[s.previaBtn, { backgroundColor: "#7c3aed" }]}><Text style={[s.previaBtnTxt, { color: "#fff" }]}>Aprovar produção</Text></View>
            <View style={[s.previaBtn, { borderWidth: 1, borderColor: "#d6cfee" }]}><Text style={[s.previaBtnTxt, { color: "#18172b" }]}>Pedir ajuste</Text></View>
          </View>
        )}
      </View>
    </View>
  );

  const outroArquivo = outroAberto ? (
    <View style={s.outro} testID="aprovacao-outro">
      <Pressable style={[s.pill, subindo && { opacity: 0.6 }]} onPress={subirDoAparelho} disabled={subindo} accessibilityRole="button">
        {subindo ? <ActivityIndicator color={t.primary} /> : <Icon name="upload" size={15} color={t.ink} />}
        <Text style={s.pillTxt}>Subir foto ou PDF</Text>
      </Pressable>
      <Text style={s.nota}>ou cole um link</Text>
      <TextInput
        style={s.input}
        placeholder="https://..."
        placeholderTextColor={t.ink4}
        value={linkColado}
        onChangeText={colarLink}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Link do arquivo"
      />
    </View>
  ) : null;

  const pilulas = (
    <View style={s.pilulas}>
      <Pressable style={s.pill} onPress={gravar} accessibilityRole="button" testID="aprovacao-gravar-de-novo" disabled={fase === "gerando"}>
        <Text style={[s.pillTxt, fase === "gerando" && { opacity: 0.5 }]}>Gravar de novo</Text>
      </Pressable>
      <Pressable style={[s.pill, outroAberto && s.pillLigada]} onPress={() => setOutroAberto((v) => !v)} accessibilityRole="button" testID="aprovacao-outro-arquivo">
        <Text style={s.pillTxt}>Usar outro arquivo</Text>
      </Pressable>
    </View>
  );

  const cartaoDoQueVai = (
    <View style={s.cartao} testID="aprovacao-o-que-vai">
      <View style={s.cartaoTopo}>
        <Text style={s.cartaoTitulo}>O que vai para a cliente</Text>
        {pronto && anexo ? <Text style={s.selo} testID="aprovacao-selo">{seloDoAnexo(anexo, DURACAO_S)}</Text> : null}
      </View>
      {fase === "gerando" ? (
        <View style={{ gap: 8 }}>
          <Text style={s.cartaoTxt}>A Aura está gravando a peça girando com a arte do pedido. Leva alguns segundos.</Text>
          <View style={s.barra} testID="aprovacao-progresso">
            <View style={[s.barraCheia, { width: `${Math.round(progressoDaGeracao(etapa, giro) * 100)}%` as any }]} />
          </View>
        </View>
      ) : null}
      {pronto && anexo ? (
        <Text style={s.cartaoTxt}>
          {anexo.origem === "arquivo"
            ? "O arquivo que você escolheu vai no link, no lugar do vídeo. Para voltar ao vídeo, grave de novo."
            : anexo.isVideo
              ? "A peça girando com a arte do pedido, como está no pedido. Se mudar a arte, grave de novo."
              : "A imagem da peça com a arte do pedido. Se mudar a arte, grave de novo."}
        </Text>
      ) : null}
      {fase === "falhou" ? (
        <View style={s.erro} testID="aprovacao-erro">
          <Icon name="alert-circle" size={14} color={t.dangerInk} />
          <Text style={s.erroTxt}>{erro || "Não deu para gravar o vídeo."}</Text>
        </View>
      ) : null}
      {fase !== "gerando" ? pilulas : null}
      {outroArquivo}
    </View>
  );

  const campoNome = celular ? null : (
    <View style={s.campo}>
      <Text style={s.rotulo}>Para</Text>
      <TextInput style={s.input} value={nome} onChangeText={setNome} accessibilityLabel="Para" testID="aprovacao-nome" />
    </View>
  );
  const campoTelefone = (
    <View style={s.campo}>
      <Text style={s.rotulo}>{celular ? `WhatsApp ${primeiro ? "da " + primeiro : "da cliente"}` : "WhatsApp"}</Text>
      <TextInput
        style={s.input}
        value={telefone}
        onChangeText={(v) => setTelefone(maskPhone(v))}
        keyboardType="phone-pad"
        placeholder="(00) 00000-0000"
        placeholderTextColor={t.ink4}
        accessibilityLabel="WhatsApp"
        testID="aprovacao-telefone"
      />
      {telefone.trim() && !telefoneOk ? <Text style={[s.nota, { color: t.dangerInk }]}>Confira o número, com DDD.</Text> : null}
    </View>
  );
  const campoMensagem = (
    <View style={s.campo}>
      <Text style={s.rotulo}>Mensagem</Text>
      <View style={[s.input, s.mensagemCaixa]}>
        <TextInput
          style={s.mensagemTxt}
          value={mensagem}
          onChangeText={setMensagemEditada}
          multiline
          accessibilityLabel="Mensagem"
          testID="aprovacao-mensagem"
        />
        <View style={s.ficha}><Text style={s.fichaTxt}>link da aprovação</Text></View>
      </View>
      {celular ? null : <Text style={s.nota}>O link vale 7 dias. Quando {ela} aprovar ou pedir ajuste, você recebe no sino.</Text>}
    </View>
  );

  const rodapeEnviado = (
    <>
      <View style={{ flex: 1, minWidth: 0 }} testID="aprovacao-enviado">
        <Text style={s.enviadoTitulo}>Mandado para {ela}.</Text>
        <Text style={s.enviadoTxt}>O pedido continua em "Aguardando arte" até ela responder; aprovado, ele passa sozinho para "Aprovado".</Text>
      </View>
      <Pressable style={[s.botao, celular && { alignSelf: "stretch" }]} onPress={onSent} accessibilityRole="button" testID="aprovacao-fechar-enviado">
        <Text style={s.botaoTxt}>Fechar</Text>
      </Pressable>
    </>
  );
  const botaoMandar = (
    <Pressable
      style={[s.botao, celular && s.botaoCheio, botaoTravado && { opacity: 0.45 }]}
      onPress={mandar}
      disabled={botaoTravado}
      accessibilityRole="button"
      accessibilityState={{ disabled: botaoTravado }}
      testID="aprovacao-mandar"
    >
      <Text style={s.botaoTxt}>{rotuloDoBotao}</Text>
      <Icon name="arrow-right" size={16} color="#fff" />
    </Pressable>
  );

  return (
    <View style={s.fundo} testID="aprovacao-modal">
      <View style={s.folha} accessibilityRole={"dialog" as any} accessibilityLabel="Pedir aprovação da arte">
        <View style={s.cabeca}>
          {celular ? (
            <Pressable onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel="Voltar" testID="aprovacao-fechar">
              <Icon name="chevron-left" size={20} color={t.ink} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={s.metaPeq} numberOfLines={1}>{numeroDoPedido(order)}{primeiro || nome ? ` · ${celular ? primeiro : nome}` : ""}</Text>
            <Text style={s.titulo} numberOfLines={celular ? 1 : 2}>Pedir aprovação da arte<Text style={{ color: "#9a6cf7" }}>.</Text></Text>
            {celular ? null : <Text style={s.subtitulo}>A cliente recebe um link pelo WhatsApp, vê a peça girando e aprova ou pede ajuste.</Text>}
          </View>
          {celular ? null : (
            <Pressable onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar" testID="aprovacao-fechar">
              <Icon name="x" size={18} color={t.ink} />
            </Pressable>
          )}
        </View>

        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={s.corpo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {previa}
          <View style={s.direita}>
            {celular ? (
              <>
                {fase === "gerando" ? cartaoDoQueVai : fase === "falhou" ? cartaoDoQueVai : (
                  <>
                    {pilulas}
                    {outroArquivo}
                  </>
                )}
                {campoTelefone}
                {campoMensagem}
              </>
            ) : (
              <>
                {cartaoDoQueVai}
                <View style={s.dupla}>{campoNome}{campoTelefone}</View>
                {campoMensagem}
                <View style={s.rodapeDesktop}>
                  {enviado ? rodapeEnviado : (
                    <>
                      <Pressable onPress={copiarLink} disabled={!pronto || enviando} style={s.lnk} accessibilityRole="button" testID="aprovacao-copiar-link">
                        <Text style={[s.lnkTxt, (!pronto || enviando) && { opacity: 0.5 }]}>Copiar o link</Text>
                      </Pressable>
                      {botaoMandar}
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {celular ? (
          <View style={s.rodapeCelular}>
            {enviado ? <View style={{ gap: 10 }}>{rodapeEnviado}</View> : botaoMandar}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const MONO = Platform.OS === "web" ? '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace' : undefined;
const web = (o: Record<string, any>): any => (Platform.OS === "web" ? o : {});

const buildStyles = (t: StudioPalette, celular: boolean, largura: number) => StyleSheet.create({
  // Pano escuro sobre a página (no mockup, a Produção aparece borrada atrás).
  fundo: {
    flex: 1,
    backgroundColor: "rgba(3,4,12,0.62)",
    paddingHorizontal: celular ? 0 : largura >= 1100 ? 120 : 24,
    paddingVertical: celular ? 0 : 48,
    alignItems: "center",
    ...web({ backdropFilter: "blur(2px)" }),
  },
  folha: {
    flex: 1, width: "100%", maxWidth: 1280,
    backgroundColor: t.bg,
    borderRadius: celular ? 0 : 28,
    borderWidth: celular ? 0 : 1, borderColor: t.primaryBorder,
    overflow: "hidden",
    ...web({ boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }),
  },
  cabeca: {
    flexDirection: "row", alignItems: celular ? "center" : "flex-start", gap: celular ? 8 : 16,
    paddingHorizontal: celular ? 12 : 28, paddingTop: celular ? 14 : 22, paddingBottom: celular ? 10 : 16,
    borderBottomWidth: 1, borderBottomColor: t.ink5,
  },
  metaPeq: { fontFamily: MONO, fontSize: celular ? 11 : 12, letterSpacing: 1.6, textTransform: "uppercase", color: t.ink3, fontWeight: "500" },
  meta: { fontFamily: MONO, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: t.ink3, fontWeight: "500" },
  titulo: { fontSize: celular ? 18 : 28, fontWeight: "800", color: t.ink, letterSpacing: celular ? -0.3 : -0.8 },
  subtitulo: { fontSize: 14, color: t.ink2, lineHeight: 20 },
  fechar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: celular ? 0 : 1, borderColor: t.ink5 },

  corpo: {
    flexGrow: 1,
    flexDirection: celular ? "column" : "row",
    gap: celular ? 14 : 28,
    paddingHorizontal: celular ? 16 : 28, paddingVertical: celular ? 14 : 22,
  },

  // ── Prévia (esquerda) ──
  previaCol: celular ? { gap: 10 } : { width: 380, gap: 10, flexShrink: 0 },
  previaTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previaCartao: {
    backgroundColor: "#fbfaf8", borderRadius: celular ? 18 : 20, padding: celular ? 10 : 14, gap: celular ? 8 : 12,
  },
  previaCabeca: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  previaLoja: { fontSize: 15, fontWeight: "800", color: "#18172b", flexShrink: 1 },
  previaSub: { fontSize: 12, color: "#6a608e" },
  palco: {
    aspectRatio: celular ? 1 : 0.8, borderRadius: celular ? 14 : 16, overflow: "hidden",
    backgroundColor: "#e8e3da", alignItems: "center", justifyContent: "center",
    ...web({ backgroundImage: "radial-gradient(90% 70% at 50% 45%, #f6f3ee, #dcd6cc)" }),
  },
  palcoTxt: { fontSize: 13, color: "#6a608e", textAlign: "center", paddingHorizontal: 12 },
  palcoImg: { width: "100%", height: "100%" },
  previaItens: { gap: 4 },
  previaLinha: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  previaItemTxt: { fontSize: 14, color: "#18172b", flexShrink: 1 },
  previaTotal: { borderTopWidth: celular ? 0 : 1, borderTopColor: "#e3dff0", paddingTop: celular ? 0 : 6 },
  previaTotalTxt: { fontSize: celular ? 15 : 16, fontWeight: "800", color: "#18172b" },
  previaBotoes: { flexDirection: "row", gap: 8 },
  previaBtn: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previaBtnTxt: { fontSize: 14, fontWeight: "700" },

  // ── Direita ──
  direita: celular ? { gap: 14 } : { flex: 1, minWidth: 0, gap: 18 },
  cartao: {
    backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 16, gap: 10,
  },
  cartaoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cartaoTitulo: { fontSize: 16, fontWeight: "800", color: t.ink },
  cartaoTxt: { fontSize: 14, color: t.ink2, lineHeight: 21 },
  selo: {
    height: 30, paddingHorizontal: 12, borderRadius: 999, overflow: "hidden",
    backgroundColor: t.mintSoft, color: t.mint, fontSize: 13, fontWeight: "600", lineHeight: 30,
  },
  seloPeq: {
    height: 26, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden",
    backgroundColor: t.mintSoft, color: t.mint, fontSize: 12, fontWeight: "600", lineHeight: 26,
  },
  barra: { height: 6, borderRadius: 999, backgroundColor: t.ink5, overflow: "hidden" },
  barraCheia: {
    height: 6, borderRadius: 999, backgroundColor: t.primary2,
    ...web({ backgroundImage: "linear-gradient(90deg,#8b5cf6,#c4b5fd)", transition: "width .3s ease-out" }),
  },
  pilulas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: celular ? 40 : 44, paddingHorizontal: celular ? 14 : 16,
    borderRadius: 999, borderWidth: 1, borderColor: t.ink5,
  },
  pillLigada: { backgroundColor: t.primarySoft, borderColor: t.primaryBorder },
  pillTxt: { fontSize: celular ? 13 : 14, fontWeight: "600", color: t.ink },
  outro: { gap: 8, paddingTop: 4 },
  erro: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: t.dangerSoft, borderRadius: 10, padding: 10 },
  erroTxt: { flex: 1, fontSize: 13, color: t.dangerInk, lineHeight: 18, fontWeight: "600" },

  dupla: { flexDirection: "row", gap: 14 },
  campo: celular ? { gap: 6 } : { flex: 1, gap: 6, minWidth: 0 },
  rotulo: { fontSize: 13, fontWeight: "600", color: t.ink2 },
  input: {
    minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: t.primaryBorder,
    backgroundColor: t.bgSoft, fontSize: 15, color: t.ink, ...web({ outlineStyle: "none" }),
  },
  mensagemCaixa: { minHeight: 96, gap: 6, alignItems: "flex-start" },
  mensagemTxt: { width: "100%", fontSize: celular ? 14 : 15, lineHeight: celular ? 22 : 26, color: t.ink, padding: 0, minHeight: 52, ...web({ outlineStyle: "none", resize: "none" }) },
  ficha: {
    height: 24, paddingHorizontal: 8, borderRadius: 999, justifyContent: "center",
    backgroundColor: t.primarySoft, borderWidth: 1, borderColor: t.primaryBorder,
  },
  fichaTxt: { fontSize: celular ? 12 : 13, fontWeight: "600", color: t.ink },
  nota: { fontSize: 13, color: t.ink3, lineHeight: 19 },

  // ── Rodapé ──
  rodapeDesktop: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: t.ink5, ...web({ marginTop: "auto" }),
  },
  rodapeCelular: {
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.ink5, backgroundColor: t.bg,
    ...respiroInferior(18),
  },
  lnk: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  lnkTxt: { fontSize: 14, fontWeight: "600", color: t.accentInk },
  botao: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    minHeight: 50, paddingHorizontal: 22, borderRadius: 14, backgroundColor: "#7c3aed",
    ...web({
      backgroundImage: "linear-gradient(135deg,#8b5cf6,#7c3aed 45%,#6d28d9)",
      boxShadow: "0 10px 26px rgba(60,20,140,.45), inset 0 1px 0 rgba(255,255,255,.35)",
    }),
  },
  botaoCheio: { alignSelf: "stretch", minHeight: 52 },
  botaoTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  enviadoTitulo: { fontSize: 15, fontWeight: "800", color: t.mint },
  enviadoTxt: { fontSize: 14, color: t.ink2, lineHeight: 20 },
});

export default ApprovalRequestModal;
