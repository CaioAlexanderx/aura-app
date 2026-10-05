// ============================================================
// AURA STUDIO · Orçamento em vídeo 3D pelo WhatsApp (28/09/2026)
//
// Desenho: docs/studio/orcamento-video-3d.md
// Mockup:  docs/mockups/studio-orcamento-video-3d.html
//
// A lojista grava um vídeo de 7 s da peça girando, com a arte e a cor do
// cliente, e manda o vídeo EMBUTIDO na mensagem do WhatsApp dele, com os
// valores e as condições por extenso. Sem link e sem página pública: a
// conversa é no WhatsApp dela, e o orçamento fica em aberto no painel até
// ela Aprovar (vira pedido) ou Fechar.
//
// DNA do TrocaModal (CLAUDE.md, regra 5): cabeçalho com subtítulo,
// corpo com rolagem, rodapé com o resumo à esquerda e as ações à direita,
// passo final de confirmação e confirmação de saída. No celular vira tela
// cheia.
//
// 29/09/2026 (modal do orçamento, decisões 2 e 3 do PO): o passo
// "Valores" saiu. Validade, sinal, Pix, parcelas, prazo e observação
// moram no orçamento (components/studio/orcamentoModal) e chegam aqui já
// salvos em `quote`. O envio por link virou um canal dentro de Enviar.
// O modelo 3D da peça é o do item do orçamento, se a lojista trocou
// (modeloDaPeca, backend 364).
//
// 29/09/2026 (vídeo em primeiro plano, mockup
// docs/mockups/studio-orcamento-video-primeiro-plano.html): o assistente
// de 3 passos (Peça → Prévia → Enviar) vira UM passo, Enviar. A arte, a
// cor, o tamanho por lado e a prévia 3D moram na peça do orçamento
// (orcamentoModal/EstudioDaPeca); aqui o vídeo é gravado sozinho ao
// abrir, com TODAS as artes da peça girando (artesPorLado.motorDasArtes),
// ao lado da mensagem e do canal. Só a peça do vídeo ainda se escolhe
// aqui, quando o orçamento tem mais de uma.
//
//   Enviar   — vídeo (gravado ao abrir), mensagem editável e canal:
//              compartilhar com arquivo onde existir (celular e
//              computador); senão baixar + copiar + abrir a conversa. Ou
//              o canal "Link do orçamento" (página para o cliente).
//   ✓ Enviado
//
// Web-only (canvas, WebGL, WebCodecs): o editor nem mostra o botão no
// nativo. Multi-CNPJ: tudo usa a empresa do orçamento (companyId da rota
// do orçamento), com a marca dela.
// ============================================================
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioQuote, type StudioQuoteItem, type CanalDeEnvioDoOrcamento } from "@/services/studioApi";
import { carregarFontesDaPeca } from "./modeloDaPeca";
import { formaDaMiniaturaDoModelo } from "@/components/studio/mockupPorProduto/MiniaturaDoModelo";
import { valoresDasCondicoes, reais } from "./condicoesDoOrcamento";
import { mensagemDoOrcamento, primeiroNome } from "./mensagemDoOrcamento";
import { tem3d, temFoto, fotoSem3d, type FontesDaPeca } from "./pecaDoOrcamento";
import { artesDoItem, motorDasArtes, ladosDaPeca, textoDasArtes } from "./artesPorLado";
import { abrirPalco, gravarGiro, fotoDoPalco, DURACAO_S, type VideoGravado, type Palco } from "./gravarGiro";
import { subirVideoDoOrcamento } from "./videoDoOrcamentoApi";
import {
  podeCompartilharArquivo, compartilharArquivo, linkDaConversa, baixarArquivo, abrirConversa,
  nomeDoArquivo, telefoneDoCliente,
} from "./envioNoWhatsApp";

type Passo = "enviar" | "enviado";
type Canal = "whatsapp" | "link";
type Gravacao = "ocioso" | "gravando" | "pronto" | "falhou" | "foto" | "semnada";
type Upload = "nada" | "subindo" | "salvo" | "erro";

const SUBTITULOS: Record<Passo, string> = {
  enviar: "O vídeo da peça, a mensagem e o WhatsApp do cliente",
  enviado: "Pronto",
};

export type OrcamentoVideoModalProps = {
  visible: boolean;
  companyId: string;
  quote: StudioQuote;
  items: StudioQuoteItem[];
  nomeDaLoja: string;
  logoUrl?: string | null;
  onClose: () => void;
  /** Orçamento mudou (marcado como enviado, link gerado). */
  onAtualizou: (quote: StudioQuote, items?: StudioQuoteItem[]) => void;
};

function textoDe(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n).replace(".", ",");
}

import { ehCelular, respiroInferior } from "@/components/studio/modalNoCelular";

export function OrcamentoVideoModal(props: OrcamentoVideoModalProps) {
  return (
    <WebPortal active={props.visible}>
      <Corpo {...props} />
    </WebPortal>
  );
}

function Corpo({ companyId, quote, items, nomeDaLoja, logoUrl, onClose, onAtualizou }: OrcamentoVideoModalProps) {
  const t = useStudioTokens();
  const { width } = useWindowDimensions();
  // Etapa 4 (05/10): a mesma largura do shell e a regra do modal no celular.
  const estreito = ehCelular(width);
  const s = useMemo(() => estilos(t, estreito), [t, estreito]);
  const aberto = quote.status === "draft" || quote.status === "sent";

  const [passo, setPasso] = useState<Passo>("enviar");
  const [querSair, setQuerSair] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // ── A peça do vídeo ─────────────────────────────────────────
  const comProduto = useMemo(() => items.map((it, i) => ({ it, i })).filter(({ it }) => !!it.product_id), [items]);
  const [idx, setIdx] = useState<number>(comProduto[0]?.i ?? -1);
  const item = idx >= 0 ? items[idx] : null;
  const [fontes, setFontes] = useState<FontesDaPeca | null>(null);
  const [carregandoPeca, setCarregandoPeca] = useState(!!item?.product_id);
  const [comLogo, setComLogo] = useState(true);
  const [seguirComFoto, setSeguirComFoto] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!item?.product_id) { setFontes(null); setCarregandoPeca(false); return; }
    setCarregandoPeca(true);
    carregarFontesDaPeca(companyId, item.product_id, item.visual_template_key)
      .then((f) => {
        if (!vivo) return;
        setFontes(f);
        setSeguirComFoto(false);
      })
      .catch(() => { if (vivo) setFontes(null); })
      .finally(() => { if (vivo) setCarregandoPeca(false); });
    return () => { vivo = false; };
  }, [companyId, item?.product_id, item?.visual_template_key, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const pode3d = tem3d(fontes);
  const podeFoto = temFoto(fontes);
  const spec3d = pode3d ? fontes!.template!.spec! : null;
  // A peça define a técnica padrão (a sublimação da caneca recorta o branco).
  const formaDaPeca = fontes?.template ? formaDaMiniaturaDoModelo(fontes.template, fontes.template.spec) : null;
  const tipoDaPeca = formaDaPeca === "caneca" || formaDaPeca === "camiseta" ? formaDaPeca : null;
  // As artes são as da peça no orçamento (frente, verso ou estendida), todas de uma vez.
  const artes = useMemo(() => artesDoItem(fontes?.cfg, item?.customization), [fontes, item]);
  const motor = useMemo(
    () => motorDasArtes(fontes?.cfg, item?.customization, artes, spec3d, tipoDaPeca),
    [fontes, item, artes, spec3d, tipoDaPeca],
  );

  // ── Condições: as do orçamento, já salvas pelo modal do orçamento ──
  const validade = Math.max(1, Math.min(90, Number(quote.validity_days) || 7));
  const total = Number(quote.total) || 0;
  const valores = valoresDasCondicoes(quote);

  // ── Gravação ────────────────────────────────────────────────
  const [gravacao, setGravacao] = useState<Gravacao>("ocioso");
  const [progresso, setProgresso] = useState(0);
  const [video, setVideo] = useState<VideoGravado | null>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [upload, setUpload] = useState<Upload>("nada");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const palcoRef = useRef<Palco | null>(null);
  const tentativa = useRef(0);

  useEffect(() => () => { tentativa.current += 1; palcoRef.current?.fechar(); }, []);
  useEffect(() => {
    if (!video) { setVideoUrl(null); return; }
    const u = URL.createObjectURL(video.blob);
    setVideoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [video]);

  const validaAte = quote.status === "sent" && quote.expires_at
    ? quote.expires_at
    : new Date(Date.now() + validade * 86400000).toISOString();
  const anexo: "video" | "foto" | "nada" = video ? "video" : foto ? "foto" : "nada";
  const textoGerado = mensagemDoOrcamento({
    nomeDoCliente: quote.customer_name,
    nomeDaLoja,
    itens: items,
    desconto: Number(quote.discount) || 0,
    total,
    valores,
    validaAte,
    anexo,
  });
  const texto = textoEditado ?? textoGerado;

  // O vídeo é gravado sozinho ao abrir, e de novo quando muda a peça,
  // o logo ou a troca por foto.
  const assinatura = JSON.stringify([idx, item?.customization || null, comLogo, seguirComFoto, fontes?.template?.key || null]);
  const gravadoCom = useRef<string | null>(null);

  async function gravar(forcarFoto = false) {
    const minha = ++tentativa.current;
    gravadoCom.current = assinatura;
    setVideo(null); setFoto(null); setUpload("nada"); setProgresso(0);
    const marca = { nome: nomeDaLoja, logoUrl };
    if (!pode3d || seguirComFoto || forcarFoto) {
      setGravacao("gravando");
      const f = fontes ? await fotoSem3d(fontes, motor).catch(() => null) : null;
      if (minha !== tentativa.current) return;
      if (f) { setFoto(f); setGravacao("foto"); } else setGravacao("semnada");
      return;
    }
    setGravacao("gravando");
    try {
      palcoRef.current?.fechar();
      palcoRef.current = null;
      const palco = await abrirPalco(spec3d!, motor.values, motor.opts);
      palcoRef.current = palco;
      const v = await gravarGiro(palco, marca, comLogo, (f) => { if (minha === tentativa.current) setProgresso(f); });
      if (minha !== tentativa.current) return;
      if (v) {
        setVideo(v);
        setGravacao("pronto");
        guardar(v);
      } else {
        const f = await fotoDoPalco(palco, marca, comLogo);
        if (minha !== tentativa.current) return;
        setFoto(f);
        setGravacao(f ? "foto" : "falhou");
        if (f) toast.info("Este navegador não grava vídeo. Vai a foto da peça.");
      }
    } catch (e: any) {
      if (minha !== tentativa.current) return;
      console.warn("[orcamentoVideo] gravação falhou:", e?.message);
      setGravacao("falhou");
    } finally {
      palcoRef.current?.fechar();
      palcoRef.current = null;
    }
  }

  useEffect(() => {
    if (passo !== "enviar" || carregandoPeca) return;
    if (!item) { setGravacao("semnada"); return; }
    if (gravadoCom.current !== assinatura) gravar();
  }, [passo, carregandoPeca, assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(v: VideoGravado) {
    setUpload("subindo");
    try {
      await subirVideoDoOrcamento(companyId, quote.id, v.blob, v.contentType, v.formato);
      setUpload("salvo");
    } catch (e: any) {
      setUpload("erro");
      console.warn("[orcamentoVideo] upload:", e?.message);
    }
  }

  // ── Envio ───────────────────────────────────────────────────
  const [telefone, setTelefone] = useState(quote.customer_phone || "");
  const arquivo = useMemo(() => {
    if (typeof File === "undefined") return null;
    if (video) return new File([video.blob], nomeDoArquivo(nomeDaLoja, quote.customer_name, video.ext), { type: video.contentType });
    if (foto) return new File([foto], nomeDoArquivo(nomeDaLoja, quote.customer_name, foto.type === "image/png" ? "png" : "jpg"), { type: foto.type || "image/jpeg" });
    return null;
  }, [video, foto, nomeDaLoja, quote.customer_name]);
  const compartilhaArquivo = podeCompartilharArquivo(arquivo);
  const linkConversa = linkDaConversa(telefone, texto);
  const [jaBaixou, setJaBaixou] = useState(false);
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [enviadoPor, setEnviadoPor] = useState<CanalDeEnvioDoOrcamento | "link" | null>(null);
  const gravando = gravacao === "gravando";

  async function marcarEnviado(c: CanalDeEnvioDoOrcamento) {
    setOcupado(true);
    try {
      const r = await studioApi.marcarOrcamentoEnviado(companyId, quote.id, c);
      onAtualizou(r.quote);
      setEnviadoPor(c);
      setPasso("enviado");
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não deu para registrar o envio");
    } finally {
      setOcupado(false);
    }
  }

  async function compartilhar() {
    if (!arquivo) return;
    // A mensagem vai para a área de transferência antes: alguns iPhones
    // descartam o texto quando recebem arquivo.
    copyToClipboard(texto).catch(() => {});
    const r = await compartilharArquivo(arquivo, texto);
    if (r === "enviado") await marcarEnviado("compartilhar");
    else if (r === "falhou") toast.error("O compartilhamento não abriu. Use baixar e abrir a conversa.");
  }

  // Canal "Link do orçamento": a página pública em que o cliente aceita
  // ou recusa. Era o botão "Enviar ao cliente" do editor antigo.
  const textoDoLink = (url: string) => {
    const nome = primeiroNome(quote.customer_name);
    return `${nome ? `Oi, ${nome}! ` : ""}Segue o seu orçamento${nomeDaLoja ? ` da ${nomeDaLoja}` : ""}: ${url}`;
  };
  async function enviarLink() {
    setOcupado(true);
    try {
      const r = await studioApi.sendQuote(companyId, quote.id);
      onAtualizou(r);
      const url = r.quote_url;
      const conversa = linkDaConversa(telefone, textoDoLink(url));
      if (conversa) abrirConversa(conversa);
      copyToClipboard(textoDoLink(url)).catch(() => {});
      setEnviadoPor("link");
      setPasso("enviado");
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não deu para gerar o link do orçamento");
    } finally {
      setOcupado(false);
    }
  }

  function baixarECopiar() {
    if (arquivo) baixarArquivo(arquivo, arquivo.name);
    copyToClipboard(texto).then((ok) => { if (ok) toast.success("Mensagem copiada"); }).catch(() => {});
    setJaBaixou(true);
  }

  function pedirFechar() {
    if (passo === "enviado" || gravacao === "ocioso" || gravacao === "semnada") onClose();
    else setQuerSair(true);
  }

  // ── Rodapé ──────────────────────────────────────────────────
  let info = `Para ${quote.customer_name || "o cliente"}${telefone ? " · " + telefone : ""} · ${reais(total)}`;
  if (carregandoPeca) info = "Carregando a peça…";
  else if (gravando) info = !pode3d || seguirComFoto ? "Preparando a foto…" : `Gravando o giro de ${DURACAO_S} s…`;
  else if (gravacao === "falhou") info = "O vídeo não saiu: tente de novo ou siga com a foto";
  const semArquivoAinda = carregandoPeca || gravando || gravacao === "falhou";

  // ─────────────────────────────────────────────────────────────
  const conteudo = (
    <View style={s.fundo}>
      <Pressable style={s.veu} onPress={pedirFechar} accessibilityLabel="Fechar" />
      <View style={s.painel} accessibilityRole={"dialog" as any} accessibilityLabel="Enviar o orçamento">
        {/* Cabeçalho */}
        <View style={s.cabeca}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            {estreito ? null : <View style={s.icone}><Icon name="whatsapp" size={17} color={t.accentInk} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo} numberOfLines={estreito ? 1 : undefined} testID="envio-titulo">{passo === "enviado" ? "Orçamento enviado" : "Enviar o orçamento"}</Text>
              {estreito ? null : <Text style={s.subtitulo} numberOfLines={2}>{SUBTITULOS[passo]}</Text>}
            </View>
          </View>
          <Pressable onPress={pedirFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar" testID="envio-fechar"><Icon name="x" size={18} color={t.ink3} /></Pressable>
        </View>

        <ScrollView style={s.corpo} contentContainerStyle={s.corpoConteudo} keyboardShouldPersistTaps="handled">
          {passo === "enviar" && (
            <View style={s.duas}>
              {/* O vídeo */}
              <View style={s.col}>
                <Text style={s.secao}>{gravacao === "foto" ? "Foto da peça" : `Vídeo · ${DURACAO_S} s · 720 × 900`}</Text>
                <View style={s.videoCaixa} testID="video-do-orcamento">
                  {(gravando || carregandoPeca) && (
                    <View style={s.gravando}>
                      <ActivityIndicator color="#fff" />
                      <Text style={s.gravandoTxt}>{carregandoPeca ? "Carregando a peça…" : !pode3d || seguirComFoto ? "Preparando a foto…" : `Gravando o giro… ${Math.round(progresso * 100)}%`}</Text>
                      {!carregandoPeca && pode3d && !seguirComFoto ? <View style={s.barra}><View style={[s.barraCheia, { width: `${Math.round(progresso * 100)}%` as any }]} /></View> : null}
                    </View>
                  )}
                  {gravacao === "pronto" && videoUrl && Platform.OS === "web" &&
                    createElement("video", { src: videoUrl, autoPlay: true, loop: true, muted: true, playsInline: true, controls: true, style: { width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#FBF8F3" } })}
                  {gravacao === "foto" && foto && Platform.OS === "web" &&
                    createElement(ImagemDoBlob, { blob: foto })}
                  {!carregandoPeca && (gravacao === "falhou" || gravacao === "semnada" || gravacao === "ocioso") && (
                    <View style={s.gravando}><Icon name={gravacao === "falhou" ? "alert-circle" : "message"} size={26} color="#fff" /></View>
                  )}
                </View>
                {pode3d && !seguirComFoto && !gravando ? (
                  <Text style={s.nota}>
                    {item ? `${textoDasArtes(artes, ladosDaPeca(fontes?.cfg, spec3d))} · ` : ""}A arte, a cor e o tamanho vêm da peça no orçamento. Para mudar, volte ao orçamento e abra a peça.
                  </Text>
                ) : null}
                {gravacao === "pronto" && video && (
                  <View style={s.meta}>
                    <Text style={s.opcaoSub}>{video.ext.toUpperCase()} · {(video.blob.size / 1048576).toFixed(1).replace(".", ",")} MB</Text>
                    <Text style={[s.opcaoSub, upload === "salvo" && { color: t.successInk, fontWeight: "800" }, upload === "erro" && { color: t.dangerInk }]}>
                      {upload === "subindo" ? "Guardando…" : upload === "salvo" ? "Guardado por 30 dias" : upload === "erro" ? "Não foi guardado (dá para enviar mesmo assim)" : ""}
                    </Text>
                    <Pressable style={s.btnSec} onPress={() => gravar()}><Icon name="refresh" size={14} color={t.ink} /><Text style={s.btnSecTxt}>Gravar de novo</Text></Pressable>
                  </View>
                )}
                {video && video.formato === "webm" && (
                  <View style={[s.aviso, { backgroundColor: t.warningSoft }]}>
                    <Text style={[s.avisoTxt, { color: t.warningInk }]}>Este navegador gravou em WebM, que alguns iPhones não tocam no WhatsApp. Se o cliente usa iPhone, grave pelo Chrome ou Safari atualizados.</Text>
                  </View>
                )}
                {gravacao === "falhou" && (
                  <View style={[s.aviso, { backgroundColor: t.dangerSoft }]}>
                    <Text style={[s.avisoTit, { color: t.dangerInk }]}>Não deu para gravar o vídeo</Text>
                    <Text style={[s.avisoTxt, { color: t.dangerInk }]}>Tente de novo. Se repetir, siga com a foto da peça.</Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <Pressable style={s.btnSec} onPress={() => gravar()}><Text style={s.btnSecTxt}>Tentar de novo</Text></Pressable>
                      <Pressable style={s.btnSec} onPress={() => { setSeguirComFoto(true); gravar(true); }}><Text style={s.btnSecTxt}>Seguir com foto</Text></Pressable>
                    </View>
                  </View>
                )}
                {gravacao === "semnada" && (
                  <View style={[s.aviso, { backgroundColor: t.warningSoft }]}>
                    <Text style={[s.avisoTxt, { color: t.warningInk }]}>
                      {item ? "Sem modelo 3D nem foto marcada para esta peça: vai só a mensagem com os valores." : "O orçamento só tem itens avulsos: vai a mensagem com os valores."}
                    </Text>
                  </View>
                )}
                {!carregandoPeca && item && !pode3d && gravacao !== "semnada" ? (
                  <Text style={s.nota}>Esta peça não tem modelo 3D: vai a foto com a arte. Para o vídeo, escolha um modelo 3D na peça, em Modelo do mockup.</Text>
                ) : null}

                {item ? (
                  <Pressable style={s.chave} onPress={() => setComLogo(!comLogo)} accessibilityRole="switch" accessibilityState={{ checked: comLogo }}>
                    <View style={[s.sw, comLogo && { backgroundColor: t.success }]}><View style={[s.swBola, comLogo && { left: 19 }]} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.opcaoTit}>Logo da loja no canto do vídeo</Text>
                      <Text style={s.opcaoSub}>O vídeo circula encaminhado. A marca vai junto.</Text>
                    </View>
                  </Pressable>
                ) : null}
                {pode3d && !seguirComFoto && podeFoto && !gravando && (
                  <Pressable style={s.link} onPress={() => setSeguirComFoto(true)}><Text style={s.linkTxt}>Mandar foto em vez de vídeo</Text></Pressable>
                )}
                {pode3d && seguirComFoto && !gravando && (
                  <Pressable style={s.link} onPress={() => setSeguirComFoto(false)}><Text style={s.linkTxt}>Voltar ao vídeo</Text></Pressable>
                )}
              </View>

              {/* Peça, mensagem e canal */}
              <View style={s.col}>
                {comProduto.length > 1 ? (
                  <>
                    <Text style={s.secao}>Peça do vídeo</Text>
                    <View accessibilityRole={"radiogroup" as any} accessibilityLabel="Peça do vídeo" style={{ gap: 8 }}>
                      {comProduto.map(({ it, i }) => {
                        const marcado = i === idx;
                        return (
                          <Pressable
                            key={i}
                            disabled={gravando}
                            onPress={() => { if (i !== idx) setIdx(i); }}
                            style={[s.opcao, marcado && s.opcaoMarcada, gravando && !marcado && { opacity: 0.55 }]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: marcado, disabled: gravando }}
                            testID={"peca-do-video-" + i}
                          >
                            <View style={[s.radio, marcado && { borderColor: t.accent }]}>{marcado && <View style={s.radioPonto} />}</View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.opcaoTit} numberOfLines={2}>{it.description}</Text>
                              <Text style={s.opcaoSub}>{textoDe(Number(it.quantity))} un.</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Text style={s.secao}>Para</Text>
                <View style={s.para}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{(quote.customer_name || "?").trim().slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={s.opcaoTit}>{quote.customer_name || "Cliente"}</Text>
                    <TextInput
                      style={[s.input, { marginTop: 4 }]}
                      value={telefone}
                      onChangeText={setTelefone}
                      keyboardType="phone-pad"
                      placeholder="WhatsApp do cliente"
                      placeholderTextColor={t.ink4}
                      accessibilityLabel="WhatsApp do cliente"
                    />
                  </View>
                </View>

                <Text style={s.secao}>Mensagem</Text>
                <TextInput
                  style={[s.input, s.mensagem]}
                  value={texto}
                  onChangeText={setTextoEditado}
                  multiline
                  accessibilityLabel="Mensagem para o cliente"
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <Text style={s.opcaoSub}>{texto.length} caracteres</Text>
                  {textoEditado !== null && (
                    <Pressable onPress={() => setTextoEditado(null)}><Text style={s.linkTxt}>Restaurar texto original</Text></Pressable>
                  )}
                </View>
                <Text style={s.nota}>*asteriscos* viram negrito no WhatsApp. Sem link: valores e condições vão por extenso.</Text>

                <Text style={s.secao}>Como mandar</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole={"radiogroup" as any} accessibilityLabel="Como mandar">
                  {([["whatsapp", anexo === "video" ? "Vídeo e mensagem" : anexo === "foto" ? "Foto e mensagem" : "Mensagem"], ["link", "Link do orçamento"]] as const).map(([id, rotulo]) => (
                    <Pressable
                      key={id}
                      onPress={() => setCanal(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: canal === id }}
                      testID={"canal-" + id}
                      style={[s.opcao, { flexGrow: 1, flexBasis: 180, minHeight: 44 }, canal === id && s.opcaoMarcada]}
                    >
                      <View style={[s.radio, canal === id && { borderColor: t.accent }]}>{canal === id && <View style={s.radioPonto} />}</View>
                      <Text style={s.opcaoTit}>{rotulo}</Text>
                    </Pressable>
                  ))}
                </View>

                {canal === "link" ? (
                  <View style={[s.canal, s.canalMarcado]} testID="canal-link-detalhe">
                    <View style={[s.canalIcone, { backgroundColor: t.primary }]}><Icon name="link" size={18} color="#fff" /></View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.opcaoTit}>Link do orçamento</Text>
                      <Text style={s.opcaoSub}>
                        O cliente abre uma página com as peças e os valores e responde por lá: aceitar ou recusar. A conversa abre com o link escrito, e o link fica copiado.{quote.token ? " É o mesmo link que já foi enviado." : ""}
                      </Text>
                      {!telefoneDoCliente(telefone) && <Text style={[s.nota, { color: t.warningInk }]}>Sem WhatsApp com DDD: o link só fica copiado.</Text>}
                    </View>
                  </View>
                ) : arquivo && compartilhaArquivo ? (
                  <View style={[s.canal, s.canalMarcado]}>
                    <View style={[s.canalIcone, { backgroundColor: "#25D366" }]}><Icon name="share" size={18} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.opcaoTit}>Compartilhar no WhatsApp</Text>
                      <Text style={s.opcaoSub}>
                        {anexo === "video" ? "O vídeo e a mensagem vão juntos." : "A foto e a mensagem vão juntas."} Na lista do WhatsApp, escolha a conversa de {quote.customer_name || "seu cliente"}{telefoneDoCliente(telefone) ? ` · ${telefone}` : ""}. A mensagem também fica copiada: se ela não aparecer junto do {anexo === "video" ? "vídeo" : "arquivo"}, é só colar.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={[s.canal, s.canalMarcado]}>
                    <View style={[s.canalIcone, { backgroundColor: "#25D366" }]}><Icon name="whatsapp" size={18} color="#fff" /></View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={s.opcaoTit}>{arquivo ? "Baixar, copiar e abrir a conversa" : "Abrir a conversa com a mensagem"}</Text>
                      {arquivo ? (
                        <Text style={s.opcaoSub}>
                          Este navegador não compartilha arquivo. 1) Baixe o {anexo === "video" ? "vídeo" : "arquivo"} (a mensagem fica copiada). 2) Abra a conversa: o texto já vai escrito. 3) Arraste o {anexo === "video" ? "vídeo" : "arquivo"} baixado para a conversa e envie.
                        </Text>
                      ) : (
                        <Text style={s.opcaoSub}>{semArquivoAinda ? "Espere o vídeo ficar pronto para mandar junto." : "A conversa abre com a mensagem pronta."}</Text>
                      )}
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {arquivo && (
                          <Pressable style={s.btnSec} onPress={baixarECopiar}>
                            <Icon name="download" size={14} color={t.ink} />
                            <Text style={s.btnSecTxt}>{jaBaixou ? "Baixar de novo" : anexo === "video" ? "Baixar vídeo" : "Baixar foto"}</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={[s.btnSec, (!linkConversa || semArquivoAinda) && { opacity: 0.5 }]}
                          disabled={!linkConversa || semArquivoAinda}
                          onPress={() => { if (linkConversa) abrirConversa(linkConversa); }}
                        >
                          <Icon name="whatsapp" size={14} color={t.ink} />
                          <Text style={s.btnSecTxt}>Abrir conversa</Text>
                        </Pressable>
                        <Pressable style={s.btnSec} onPress={() => copyToClipboard(texto).then((ok) => ok && toast.success("Mensagem copiada")).catch(() => {})}>
                          <Icon name="copy" size={14} color={t.ink} />
                          <Text style={s.btnSecTxt}>Copiar mensagem</Text>
                        </Pressable>
                      </View>
                      {!linkConversa && <Text style={[s.nota, { color: t.dangerInk }]}>Informe o WhatsApp do cliente com DDD.</Text>}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {passo === "enviado" && (
            <View style={s.sucesso}>
              <View style={s.sucessoIcone}><Icon name="check" size={28} color={t.success} /></View>
              <Text style={s.sucessoTit}>Enviado para {quote.customer_name || "o cliente"}</Text>
              <Text style={s.sucessoTxt}>
                {enviadoPor === "link" ? "Pelo link do orçamento." : enviadoPor === "compartilhar" ? "Pelo compartilhamento do WhatsApp." : "Pela conversa do WhatsApp."} O orçamento fica em aberto: quando o cliente topar, toque em Aprovar para ele virar pedido. Se não seguir, Fechar.
              </Text>
              {upload === "salvo" && <Text style={s.nota}>O vídeo fica guardado por 30 dias, e dá para manter por mais tempo no orçamento.</Text>}
            </View>
          )}
        </ScrollView>

        {/* Rodapé */}
        <View style={s.pe} testID="envio-rodape">
          {estreito && (passo === "enviado" || !info) ? null : <Text style={s.peInfo} numberOfLines={estreito ? 1 : 2}>{passo === "enviado" ? "" : info}</Text>}
          <View style={s.peAcoes}>
            {passo === "enviar" && canal === "link" && (
              <Pressable style={[s.btnWa, ocupado && { opacity: 0.45 }]} onPress={enviarLink} disabled={ocupado} testID="enviar-link">
                {ocupado ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="link" size={15} color="#fff" />}<Text style={s.btnPriTxt}>Enviar o link</Text>
              </Pressable>
            )}
            {passo === "enviar" && canal === "whatsapp" && arquivo && compartilhaArquivo && (
              <Pressable style={[s.btnWa, (ocupado || gravando) && { opacity: 0.45 }]} onPress={compartilhar} disabled={ocupado || gravando} testID="compartilhar">
                <Icon name="share" size={15} color="#fff" /><Text style={s.btnPriTxt}>Compartilhar no WhatsApp</Text>
              </Pressable>
            )}
            {passo === "enviar" && canal === "whatsapp" && !(arquivo && compartilhaArquivo) && (
              <Pressable
                style={[s.btnWa, (ocupado || !linkConversa || semArquivoAinda) && { opacity: 0.45 }]}
                disabled={ocupado || !linkConversa || semArquivoAinda}
                onPress={() => marcarEnviado(arquivo ? "baixar" : "whatsapp")}
                testID="ja-mandei"
              >
                <Icon name="check" size={15} color="#fff" /><Text style={s.btnPriTxt}>Já mandei</Text>
              </Pressable>
            )}
            {passo === "enviado" && (
              <Pressable style={s.btnPri} onPress={onClose}><Text style={s.btnPriTxt}>Voltar ao orçamento</Text></Pressable>
            )}
          </View>
        </View>

        {querSair && (
          <View style={s.sairVeu}>
            <View style={s.sairCaixa}>
              <Text style={s.titulo}>Sair sem enviar?</Text>
              <Text style={[s.subtitulo, { marginTop: 6 }]}>
                O orçamento continua como está.{upload === "salvo" ? " O vídeo gravado fica guardado." : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
                <Pressable style={s.btnSec} onPress={() => setQuerSair(false)}><Text style={s.btnSecTxt}>Continuar aqui</Text></Pressable>
                <Pressable style={s.btnPri} onPress={onClose}><Text style={s.btnPriTxt}>Sair</Text></Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  if (!aberto && passo !== "enviado") {
    // Proteção: o editor só abre o modal para orçamento em aberto.
    return null;
  }
  return conteudo;
}

function ImagemDoBlob({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return createElement("img", { src: url, alt: "Foto da peça", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } });
}

function estilos(t: StudioPalette, estreito: boolean) {
  const web = Platform.OS === "web";
  return {
    fundo: {
      ...(web ? ({ position: "fixed", inset: 0 } as any) : { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }),
      zIndex: 1200, alignItems: "center", justifyContent: estreito ? "flex-start" : "center",
      padding: estreito ? 0 : 20,
    } as any,
    veu: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(2,6,23,0.6)" } as any,
    painel: {
      width: "100%", maxWidth: 940, backgroundColor: t.paperCardElev,
      borderRadius: estreito ? 0 : 18, borderWidth: estreito ? 0 : 1, borderColor: t.ink5,
      overflow: "hidden", maxHeight: estreito ? ("100%" as any) : ("92%" as any), height: estreito ? ("100%" as any) : undefined,
      ...(web && !estreito ? ({ boxShadow: "0 24px 60px -18px rgba(2,6,23,0.7)" } as any) : {}),
    } as any,
    cabeca: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.ink5,
      ...(estreito ? { paddingLeft: 14, paddingRight: 6, paddingVertical: 4, minHeight: 52 } : {}),
    } as any,
    icone: { width: 36, height: 36, borderRadius: 10, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" } as any,
    titulo: { fontSize: 16, fontWeight: "800", color: t.ink } as any,
    subtitulo: { fontSize: 12.5, color: t.ink3 } as any,
    fechar: { width: estreito ? 44 : 36, height: estreito ? 44 : 36, borderRadius: 10, alignItems: "center", justifyContent: "center" } as any,
    // No celular o modal é tela cheia: o corpo ocupa o meio e o rodapé fica embaixo.
    corpo: { flexGrow: estreito ? 1 : 0, flexShrink: 1 } as any,
    corpoConteudo: { padding: 18 } as any,
    duas: { flexDirection: estreito ? "column" : "row", gap: 18 } as any,
    col: { flex: estreito ? undefined : 1, minWidth: 0, gap: 8 } as any,
    secao: { fontSize: 11, fontWeight: "800", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 } as any,
    nota: { fontSize: 12, color: t.ink3, lineHeight: 17 } as any,
    opcao: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard } as any,
    opcaoMarcada: { borderColor: t.accent, backgroundColor: t.accentSoft } as any,
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: t.ink4, alignItems: "center", justifyContent: "center" } as any,
    radioPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent } as any,
    opcaoTit: { fontSize: 13.5, fontWeight: "700", color: t.ink } as any,
    opcaoSub: { fontSize: 12, color: t.ink3, lineHeight: 17 } as any,
    input: { backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: t.ink } as any,
    mensagem: { minHeight: 220, textAlignVertical: "top", fontSize: 13, lineHeight: 19 } as any,
    chave: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, marginTop: 4 } as any,
    sw: { width: 40, height: 24, borderRadius: 12, backgroundColor: t.ink5 } as any,
    swBola: { position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" } as any,
    link: { paddingVertical: 6 } as any,
    linkTxt: { fontSize: 12.5, fontWeight: "800", color: t.primary } as any,
    videoCaixa: { width: "100%", maxWidth: 380, aspectRatio: 0.8, alignSelf: "center", borderRadius: 16, overflow: "hidden", backgroundColor: "#1E293B" } as any,
    gravando: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 } as any,
    gravandoTxt: { color: "#fff", fontWeight: "700", fontSize: 13 } as any,
    barra: { width: "80%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" } as any,
    barraCheia: { height: 6, backgroundColor: t.accent } as any,
    meta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 } as any,
    aviso: { borderRadius: 12, padding: 12, marginTop: 6 } as any,
    avisoTit: { fontSize: 13, fontWeight: "800" } as any,
    avisoTxt: { fontSize: 12.5, lineHeight: 18 } as any,
    para: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5, borderRadius: 14, padding: 12, flexWrap: "wrap" } as any,
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" } as any,
    avatarTxt: { fontWeight: "800", color: t.primary } as any,
    canal: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard, alignItems: "flex-start" } as any,
    canalMarcado: { borderColor: t.accent, backgroundColor: t.accentSoft } as any,
    canalIcone: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" } as any,
    sucesso: { alignItems: "center", gap: 8, paddingVertical: 18 } as any,
    sucessoIcone: { width: 60, height: 60, borderRadius: 30, backgroundColor: t.successSoft, alignItems: "center", justifyContent: "center" } as any,
    sucessoTit: { fontSize: 19, fontWeight: "800", color: t.ink, textAlign: "center" } as any,
    sucessoTxt: { fontSize: 13.5, color: t.ink3, textAlign: "center", maxWidth: 480, lineHeight: 20 } as any,
    pe: { flexDirection: estreito ? "column" : "row", alignItems: estreito ? "stretch" : "center", gap: estreito ? 6 : 10, paddingHorizontal: estreito ? 14 : 18, paddingVertical: estreito ? undefined : 12, borderTopWidth: 1, borderTopColor: t.ink5, backgroundColor: t.paperCard, ...(estreito ? { paddingTop: 8, ...respiroInferior(10) } : {}) } as any,
    peInfo: { flex: estreito ? undefined : 1, fontSize: 12.5, color: t.ink2, fontWeight: "600" } as any,
    peAcoes: { flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" } as any,
    btnPri: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, minHeight: 44, flexGrow: estreito ? 1 : 0 } as any,
    btnPriTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 } as any,
    btnWa: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1DA851", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 11, minHeight: 44, flexGrow: estreito ? 1 : 0 } as any,
    btnSec: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.paperCard, borderWidth: 1.5, borderColor: t.ink5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, minHeight: 40 } as any,
    btnSecTxt: { color: t.ink, fontWeight: "700", fontSize: 13 } as any,
    sairVeu: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(2,6,23,0.55)", alignItems: "center", justifyContent: "center", padding: 16 } as any,
    sairCaixa: { backgroundColor: t.paperCardElev, borderRadius: 16, padding: 18, maxWidth: 380, width: "100%" } as any,
  };
}

export default OrcamentoVideoModal;
