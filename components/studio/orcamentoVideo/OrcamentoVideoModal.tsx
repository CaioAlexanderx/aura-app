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
// DNA do TrocaModal (CLAUDE.md, regra 5): cabeçalho com subtítulo por
// passo, barra numerada, corpo com rolagem, rodapé com o resumo à
// esquerda e Voltar/Continuar à direita, passo final sem barra e
// confirmação de saída. No celular vira tela cheia.
//
//   1 Peça     — item, cor da peça e arte (viewer 3D ao vivo)
//   2 Valores  — condições que a LOJISTA define (nada vem da loja)
//   3 Prévia   — grava o giro, guarda o vídeo 30 dias, mensagem editável
//   4 Enviar   — compartilhar com arquivo onde existir (celular e
//                computador); senão baixar + copiar + abrir a conversa
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
import { pickImageBase64, uploadStudioMockup } from "@/services/studioUploadApi";
import { Mug3DPreview } from "@/components/studio/visualEngine/Mug3DPreview";
import {
  valoresDasCondicoes, erroDasCondicoes, lerNumero, reais, pct,
  type CondicoesDoOrcamento,
} from "./condicoesDoOrcamento";
import { mensagemDoOrcamento } from "./mensagemDoOrcamento";
import {
  carregarFontes, tem3d, temFoto, coresDaPeca, arteDoItem, customizacaoComArte, motorDaArte, fotoSem3d,
  type FontesDaPeca, type ArteDaPeca,
} from "./pecaDoOrcamento";
import { abrirPalco, gravarGiro, fotoDoPalco, DURACAO_S, type VideoGravado, type Palco } from "./gravarGiro";
import { subirVideoDoOrcamento } from "./videoDoOrcamentoApi";
import {
  podeCompartilharArquivo, compartilharArquivo, linkDaConversa, baixarArquivo, abrirConversa,
  nomeDoArquivo, telefoneDoCliente,
} from "./envioNoWhatsApp";

type Passo = 1 | 2 | 3 | 4 | 5;
type Gravacao = "ocioso" | "gravando" | "pronto" | "falhou" | "foto" | "semnada";
type Upload = "nada" | "subindo" | "salvo" | "erro";

const ROTULOS: Record<1 | 2 | 3 | 4, string> = { 1: "Peça", 2: "Valores", 3: "Prévia", 4: "Enviar" };
const SUBTITULOS: Record<Passo, string> = {
  1: "Escolha a peça e a cor, e confira a arte do cliente",
  2: "Valores do orçamento e as condições que você oferece",
  3: "Gravamos o giro de 7 s e montamos a mensagem",
  4: "Mande para o WhatsApp do cliente",
  5: "Pronto",
};

export type OrcamentoVideoModalProps = {
  visible: boolean;
  companyId: string;
  quote: StudioQuote;
  items: StudioQuoteItem[];
  nomeDaLoja: string;
  logoUrl?: string | null;
  onClose: () => void;
  /** Orçamento mudou (condições salvas, itens com a arte, marcado como enviado). */
  onAtualizou: (quote: StudioQuote, items?: StudioQuoteItem[]) => void;
};

function textoDe(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n).replace(".", ",");
}

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
  const estreito = width < 700;
  const s = useMemo(() => estilos(t, estreito), [t, estreito]);

  const aberto = quote.status === "draft" || quote.status === "sent";
  const podeEditarArte = quote.status === "draft";

  const [passo, setPasso] = useState<Passo>(1);
  const [querSair, setQuerSair] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // ── Passo 1: peça ───────────────────────────────────────────
  const comProduto = useMemo(() => items.map((it, i) => ({ it, i })).filter(({ it }) => !!it.product_id), [items]);
  const [idx, setIdx] = useState<number>(comProduto[0]?.i ?? -1);
  const item = idx >= 0 ? items[idx] : null;
  const [fontes, setFontes] = useState<FontesDaPeca | null>(null);
  const [carregandoPeca, setCarregandoPeca] = useState(false);
  const [arte, setArte] = useState<ArteDaPeca>({ texto: "", imagem: null, cor: null });
  const [arteMudou, setArteMudou] = useState(false);
  const [comLogo, setComLogo] = useState(true);
  const [seguirComFoto, setSeguirComFoto] = useState(false);
  const [subindoArte, setSubindoArte] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!item?.product_id) { setFontes(null); return; }
    setCarregandoPeca(true);
    carregarFontes(companyId, item.product_id)
      .then((f) => {
        if (!vivo) return;
        setFontes(f);
        setArte(arteDoItem(f.cfg, item.customization));
        setArteMudou(false);
        setSeguirComFoto(false);
      })
      .finally(() => { if (vivo) setCarregandoPeca(false); });
    return () => { vivo = false; };
  }, [companyId, item?.product_id, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const pode3d = tem3d(fontes);
  const podeFoto = temFoto(fontes);
  const cores = coresDaPeca(fontes?.cfg);
  const motor = useMemo(() => motorDaArte(fontes?.cfg, item?.customization, arte), [fontes, item, arte]);

  // ── Passo 2: condições (da lojista, nada pré-preenchido pela loja) ──
  const c0 = quote.condicoes || null;
  const [pixTxt, setPixTxt] = useState(textoDe(c0?.pix_desconto_pct));
  const [parcelasTxt, setParcelasTxt] = useState(textoDe(c0?.parcelas));
  const [prazoTxt, setPrazoTxt] = useState(textoDe(c0?.prazo_dias_uteis));
  const [obsTxt, setObsTxt] = useState(c0?.observacao || "");
  const [sinalTxt, setSinalTxt] = useState(textoDe(quote.deposit_pct != null ? Number(quote.deposit_pct) : null));
  const [validadeTxt, setValidadeTxt] = useState(String(quote.validity_days || 7));

  const condicoes: CondicoesDoOrcamento = {
    pix_desconto_pct: lerNumero(pixTxt),
    parcelas: lerNumero(parcelasTxt),
    prazo_dias_uteis: lerNumero(prazoTxt),
    observacao: obsTxt.trim() || null,
  };
  const sinalPct = lerNumero(sinalTxt);
  const validade = Math.max(1, Math.min(90, parseInt(validadeTxt, 10) || 7));
  const total = Number(quote.total) || 0;
  const sinalValor = sinalPct && sinalPct > 0 ? Math.round(total * sinalPct) / 100 : null;
  const erroCond = erroDasCondicoes(condicoes) || (sinalPct !== null && (sinalPct <= 0 || sinalPct > 100) ? "Sinal entre 1% e 100%" : null);
  const valores = valoresDasCondicoes({ total, deposit_pct: sinalPct, deposit_amount: sinalValor, condicoes });

  // ── Passo 3: gravação ───────────────────────────────────────
  const [gravacao, setGravacao] = useState<Gravacao>("ocioso");
  const [progresso, setProgresso] = useState(0);
  const [video, setVideo] = useState<VideoGravado | null>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [upload, setUpload] = useState<Upload>("nada");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const palcoRef = useRef<Palco | null>(null);
  const tentativa = useRef(0);

  useEffect(() => () => { palcoRef.current?.fechar(); }, []);
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

  // O que foi gravado por último: voltar ao passo 1 e mudar peça, arte,
  // cor ou logo pede gravação nova ao entrar de novo na prévia.
  const assinatura = JSON.stringify([idx, arte, comLogo, seguirComFoto, fontes?.template?.key || null]);
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
      const palco = await abrirPalco(fontes!.template!.spec!, motor.values, motor.opts);
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

  // ── Passo 4: envio ──────────────────────────────────────────
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
  const [enviadoPor, setEnviadoPor] = useState<CanalDeEnvioDoOrcamento | null>(null);

  async function marcarEnviado(canal: CanalDeEnvioDoOrcamento) {
    setOcupado(true);
    try {
      const r = await studioApi.marcarOrcamentoEnviado(companyId, quote.id, canal);
      onAtualizou(r.quote);
      setEnviadoPor(canal);
      setPasso(5);
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

  function baixarECopiar() {
    if (arquivo) baixarArquivo(arquivo, arquivo.name);
    copyToClipboard(texto).then((ok) => { if (ok) toast.success("Mensagem copiada"); }).catch(() => {});
    setJaBaixou(true);
  }

  // ── Navegação ───────────────────────────────────────────────
  async function avancar() {
    if (passo === 1) {
      if (podeEditarArte && arteMudou && item && fontes) {
        setOcupado(true);
        try {
          const novos = items.map((it, i) => i === idx ? { ...it, customization: customizacaoComArte(fontes.cfg, it.customization, arte) } : it);
          const q = await studioApi.updateQuote(companyId, quote.id, { items: novos.map((it, i) => ({ ...it, sort_order: i })) } as any);
          onAtualizou(q, novos);
          setArteMudou(false);
        } catch (e: any) {
          toast.error(e?.data?.error || e?.message || "Não deu para salvar a arte no orçamento");
          setOcupado(false);
          return;
        }
        setOcupado(false);
      }
      setPasso(2);
      return;
    }
    if (passo === 2) {
      if (erroCond) { toast.error(erroCond); return; }
      setOcupado(true);
      try {
        const r = await studioApi.salvarCondicoesDoOrcamento(companyId, quote.id, {
          ...condicoes, deposit_pct: sinalPct, validity_days: validade,
        });
        onAtualizou(r.quote);
      } catch (e: any) {
        toast.error(e?.data?.error || e?.message || "Não deu para salvar as condições");
        setOcupado(false);
        return;
      }
      setOcupado(false);
      setTextoEditado(null);
      setPasso(3);
      if (gravadoCom.current !== assinatura || gravacao === "falhou") gravar();
      return;
    }
    if (passo === 3) { setPasso(4); return; }
  }

  function voltar() { if (passo > 1 && passo < 5) setPasso((passo - 1) as Passo); }
  function pedirFechar() {
    if (passo === 5 || (gravacao === "ocioso" && !arteMudou)) onClose();
    else setQuerSair(true);
  }

  // ── Rodapé ──────────────────────────────────────────────────
  let info = `Total ${reais(total)}` + (valores.pix ? ` · ${reais(valores.pix.valor)} no Pix` : "");
  let podeAvancar = true;
  if (passo === 1) {
    if (carregandoPeca) { podeAvancar = false; info = "Carregando a peça…"; }
    else if (!item) { podeAvancar = false; info = "O orçamento precisa de um item com produto"; }
    else if (!pode3d && !podeFoto) { podeAvancar = true; info = "Sem 3D nem foto: vai só a mensagem"; }
    else if (!pode3d) info = "Sem 3D: vai a foto da peça";
  }
  if (passo === 2 && erroCond) { podeAvancar = false; info = erroCond; }
  if (passo === 3) {
    if (gravacao === "gravando") { podeAvancar = false; info = "Gravando…"; }
    else if (gravacao === "falhou") { podeAvancar = false; info = "Tente de novo ou siga com a foto"; }
    else if (gravacao === "pronto") info = upload === "salvo" ? `Vídeo pronto · ${DURACAO_S} s · guardado por 30 dias` : upload === "subindo" ? "Vídeo pronto · guardando…" : "Vídeo pronto";
    else if (gravacao === "foto") info = "Vai a foto da peça";
    else if (gravacao === "semnada") info = "Vai só a mensagem";
  }
  if (passo === 4) info = `Para ${quote.customer_name || "o cliente"}${telefone ? " · " + telefone : ""}`;

  // ─────────────────────────────────────────────────────────────
  const conteudo = (
    <View style={s.fundo}>
      <Pressable style={s.veu} onPress={pedirFechar} accessibilityLabel="Fechar" />
      <View style={s.painel} accessibilityRole={"dialog" as any} accessibilityLabel="Orçamento em vídeo 3D">
        {/* Cabeçalho */}
        <View style={s.cabeca}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <View style={s.icone}><Icon name="camera" size={17} color={t.accentInk} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.titulo}>{passo === 5 ? "Orçamento enviado" : "Orçamento em vídeo 3D"}</Text>
              <Text style={s.subtitulo} numberOfLines={2}>{SUBTITULOS[passo]}</Text>
            </View>
          </View>
          <Pressable onPress={pedirFechar} style={s.fechar} accessibilityLabel="Fechar"><Icon name="x" size={18} color={t.ink3} /></Pressable>
        </View>

        {passo < 5 && (
          <View style={s.passos}>
            {([1, 2, 3, 4] as const).map((n) => {
              const feito = passo > n, ativo = passo === n;
              return (
                <View key={n} style={s.passo}>
                  <View style={[s.bola, feito && { backgroundColor: t.success, borderColor: t.success }, ativo && { backgroundColor: t.accent, borderColor: t.accent }]}>
                    {feito ? <Icon name="check" size={11} color="#fff" /> : <Text style={[s.bolaTxt, ativo && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  {(!estreito || ativo) && <Text style={[s.rotulo, ativo && { color: t.accentInk, fontWeight: "800" }, feito && { color: t.ink2 }]}>{ROTULOS[n]}</Text>}
                  {n < 4 && <View style={[s.sep, feito && { backgroundColor: t.success }]} />}
                </View>
              );
            })}
          </View>
        )}

        <ScrollView style={s.corpo} contentContainerStyle={s.corpoConteudo} keyboardShouldPersistTaps="handled">
          {passo === 1 && (
            <View style={s.duas}>
              <View style={s.col}>
                {carregandoPeca ? (
                  <View style={s.vazio}><ActivityIndicator color={t.primary} /></View>
                ) : pode3d && !seguirComFoto ? (
                  <View style={{ alignItems: "center", gap: 6 }}>
                    <Mug3DPreview
                      key={`${fontes!.template!.key}:${idx}`}
                      spec={fontes!.template!.spec!}
                      values={motor.values}
                      size={estreito ? Math.min(width - 48, 380) : 360}
                      garmentColor={motor.opts.garmentColor}
                      artColor={motor.opts.artColor}
                      font={motor.opts.font}
                      cenario="estudio"
                    />
                    <Text style={s.nota}>O vídeo começa de frente e dá uma volta inteira.</Text>
                  </View>
                ) : (
                  <View style={s.vazio}>
                    <Icon name="box" size={26} color={t.ink3} />
                    <Text style={s.vazioTit}>{item ? "Esta peça não tem modelo 3D" : "Sem peça para mostrar"}</Text>
                    <Text style={s.vazioTxt}>
                      {item
                        ? podeFoto
                          ? "Vai a foto da peça com a arte. Para o vídeo, vincule um modelo 3D em Loja digital › Aparência."
                          : "Vai só a mensagem com os valores. Para o vídeo, vincule um modelo 3D em Loja digital › Aparência."
                        : "Adicione ao orçamento um item com produto cadastrado."}
                    </Text>
                    {pode3d && seguirComFoto && (
                      <Pressable onPress={() => setSeguirComFoto(false)} style={s.btnSec}><Text style={s.btnSecTxt}>Voltar ao 3D</Text></Pressable>
                    )}
                  </View>
                )}
              </View>

              <View style={s.col}>
                <Text style={s.secao}>Qual item vai no vídeo</Text>
                {items.map((it, i) => {
                  const ok = !!it.product_id;
                  const marcado = i === idx;
                  return (
                    <Pressable
                      key={i}
                      disabled={!ok}
                      onPress={() => { if (ok && i !== idx) { setIdx(i); setGravacao("ocioso"); } }}
                      style={[s.opcao, marcado && s.opcaoMarcada, !ok && { opacity: 0.55 }]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: marcado, disabled: !ok }}
                    >
                      <View style={[s.radio, marcado && { borderColor: t.accent }]}>{marcado && <View style={s.radioPonto} />}</View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.opcaoTit} numberOfLines={2}>{it.description}</Text>
                        <Text style={s.opcaoSub}>{ok ? `${textoDe(Number(it.quantity))} un.` : "Item avulso · entra só nos valores"}</Text>
                      </View>
                    </Pressable>
                  );
                })}

                {cores.length > 0 && (
                  <>
                    <Text style={s.secao}>Cor da peça</Text>
                    <View style={s.cores}>
                      {cores.map((c) => {
                        const sel = (arte.cor || "").toLowerCase() === c.hex.toLowerCase();
                        return (
                          <Pressable
                            key={c.hex}
                            disabled={!podeEditarArte}
                            onPress={() => { setArte({ ...arte, cor: c.hex }); setArteMudou(true); }}
                            style={s.cor}
                            accessibilityLabel={c.nome}
                            accessibilityState={{ selected: sel }}
                          >
                            <View style={[s.corBola, { backgroundColor: c.hex }, sel && { borderColor: t.accent, borderWidth: 3 }]} />
                            <Text style={[s.corNome, sel && { color: t.ink, fontWeight: "800" }]} numberOfLines={1}>{c.nome}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={s.secao}>Arte do cliente</Text>
                <TextInput
                  style={[s.input, !podeEditarArte && s.inputOff]}
                  value={arte.texto}
                  editable={podeEditarArte}
                  onChangeText={(v) => { setArte({ ...arte, texto: v }); setArteMudou(true); }}
                  placeholder="Texto na peça (opcional)"
                  placeholderTextColor={t.ink4}
                />
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Pressable
                    disabled={!podeEditarArte || subindoArte}
                    style={[s.btnSec, (!podeEditarArte || subindoArte) && { opacity: 0.5 }]}
                    onPress={async () => {
                      const img = await pickImageBase64("image/png,image/jpeg,image/webp");
                      if (!img) return;
                      setSubindoArte(true);
                      try {
                        const up = await uploadStudioMockup(companyId, { content_base64: img.base64, content_type: img.content_type, kind: "customization" });
                        setArte({ ...arte, imagem: up.url });
                        setArteMudou(true);
                      } catch (e: any) {
                        toast.error(e?.data?.error || e?.message || "Não deu para subir a imagem");
                      } finally {
                        setSubindoArte(false);
                      }
                    }}
                  >
                    {subindoArte ? <ActivityIndicator size="small" color={t.primary} /> : <Icon name="image" size={15} color={t.ink} />}
                    <Text style={s.btnSecTxt}>{arte.imagem ? "Trocar imagem" : "Enviar imagem"}</Text>
                  </Pressable>
                  {arte.imagem && podeEditarArte && (
                    <Pressable style={s.link} onPress={() => { setArte({ ...arte, imagem: null }); setArteMudou(true); }}>
                      <Text style={s.linkTxt}>Tirar imagem</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={s.nota}>
                  {podeEditarArte
                    ? "O que você ajustar aqui fica no item do orçamento, e o pedido aprovado nasce com esta arte."
                    : "Orçamento já enviado: a arte é a que está no orçamento."}
                </Text>

                <Pressable style={s.chave} onPress={() => setComLogo(!comLogo)} accessibilityRole="switch" accessibilityState={{ checked: comLogo }}>
                  <View style={[s.sw, comLogo && { backgroundColor: t.success }]}><View style={[s.swBola, comLogo && { left: 19 }]} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoTit}>Logo da loja no canto do vídeo</Text>
                    <Text style={s.opcaoSub}>O vídeo circula encaminhado. A marca vai junto.</Text>
                  </View>
                </Pressable>

                {pode3d && !seguirComFoto && podeFoto && (
                  <Pressable style={s.link} onPress={() => setSeguirComFoto(true)}><Text style={s.linkTxt}>Mandar foto em vez de vídeo</Text></Pressable>
                )}
              </View>
            </View>
          )}

          {passo === 2 && (
            <View style={s.duas}>
              <View style={s.col}>
                <Text style={s.secao}>Do orçamento</Text>
                <View style={s.cartao}>
                  {items.map((it, i) => (
                    <View key={i} style={s.linhaItem}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.opcaoTit} numberOfLines={2}>{it.description}</Text>
                        <Text style={s.opcaoSub}>{textoDe(Number(it.quantity))} × {reais(Number(it.unit_price))}</Text>
                      </View>
                      <Text style={s.valor}>{reais(Number(it.quantity) * Number(it.unit_price))}</Text>
                    </View>
                  ))}
                  {Number(quote.discount) > 0 && (
                    <View style={s.linhaItem}><Text style={[s.opcaoSub, { flex: 1 }]}>Desconto do orçamento</Text><Text style={s.valor}>− {reais(Number(quote.discount))}</Text></View>
                  )}
                  <View style={[s.linhaItem, { borderBottomWidth: 0 }]}><Text style={[s.opcaoTit, { flex: 1 }]}>Total</Text><Text style={[s.valor, { color: t.primary, fontSize: 17 }]}>{reais(total)}</Text></View>
                </View>
                <Text style={s.nota}>Preço, quantidade e desconto são os do orçamento. Para mudar, edite o orçamento.</Text>
              </View>
              <View style={s.col}>
                <Text style={s.secao}>Condições que vão na mensagem</Text>
                <Text style={s.nota}>Só vai o que você preencher. Nada vem da configuração da loja.</Text>
                <Campo t={t} s={s} rotulo="Desconto no Pix (%)" valor={pixTxt} onChange={setPixTxt} dica={valores.pix ? `${reais(valores.pix.valor)} no Pix` : "vazio = sem desconto"} />
                <Campo t={t} s={s} rotulo="Parcelas sem juros no cartão" valor={parcelasTxt} onChange={setParcelasTxt} dica={valores.cartao ? `${valores.cartao.parcelas}x de ${reais(valores.cartao.valor)}` : "vazio = não menciona cartão"} />
                <Campo t={t} s={s} rotulo="Sinal para começar (%)" valor={sinalTxt} onChange={setSinalTxt} dica={valores.sinal ? reais(valores.sinal.valor) : "vazio = sem sinal"} />
                <Campo t={t} s={s} rotulo="Prazo de produção (dias úteis)" valor={prazoTxt} onChange={setPrazoTxt} dica={valores.prazo ? "depois que o cliente aprovar a arte" : "vazio = não menciona prazo"} />
                <Campo t={t} s={s} rotulo="Validade (dias)" valor={validadeTxt} onChange={setValidadeTxt} dica={`vale até ${new Date(validaAte).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`} />
                <Text style={s.rotuloCampo}>Observação (opcional)</Text>
                <TextInput style={s.input} value={obsTxt} onChangeText={setObsTxt} maxLength={280} placeholder="Ex.: frete por conta do cliente" placeholderTextColor={t.ink4} />
                {erroCond ? <Text style={[s.nota, { color: t.dangerInk }]}>{erroCond}</Text> : null}
              </View>
            </View>
          )}

          {passo === 3 && (
            <View style={s.duas}>
              <View style={s.col}>
                <Text style={s.secao}>{gravacao === "foto" ? "Foto da peça" : `Vídeo · ${DURACAO_S} s · 720 × 900`}</Text>
                <View style={s.videoCaixa}>
                  {gravacao === "gravando" && (
                    <View style={s.gravando}>
                      <ActivityIndicator color="#fff" />
                      <Text style={s.gravandoTxt}>{!pode3d || seguirComFoto ? "Preparando a foto…" : `Gravando o giro… ${Math.round(progresso * 100)}%`}</Text>
                      <View style={s.barra}><View style={[s.barraCheia, { width: `${Math.round(progresso * 100)}%` as any }]} /></View>
                    </View>
                  )}
                  {gravacao === "pronto" && videoUrl && Platform.OS === "web" &&
                    createElement("video", { src: videoUrl, autoPlay: true, loop: true, muted: true, playsInline: true, controls: true, style: { width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#FBF8F3" } })}
                  {gravacao === "foto" && foto && Platform.OS === "web" &&
                    createElement(ImagemDoBlob, { blob: foto })}
                  {(gravacao === "falhou" || gravacao === "semnada" || gravacao === "ocioso") && (
                    <View style={s.gravando}><Icon name={gravacao === "falhou" ? "alert-circle" : "message"} size={26} color="#fff" /></View>
                  )}
                </View>
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
                    <Text style={[s.avisoTxt, { color: t.warningInk }]}>Sem modelo 3D nem foto marcada para esta peça: vai só a mensagem com os valores.</Text>
                  </View>
                )}
              </View>
              <View style={s.col}>
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
              </View>
            </View>
          )}

          {passo === 4 && (
            <View style={{ gap: 12 }}>
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
                  />
                </View>
              </View>

              {arquivo && compartilhaArquivo ? (
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
                      <Text style={s.opcaoSub}>A conversa abre com a mensagem pronta.</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {arquivo && (
                        <Pressable style={s.btnSec} onPress={baixarECopiar}>
                          <Icon name="download" size={14} color={t.ink} />
                          <Text style={s.btnSecTxt}>{jaBaixou ? "Baixar de novo" : anexo === "video" ? "Baixar vídeo" : "Baixar foto"}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={[s.btnSec, !linkConversa && { opacity: 0.5 }]}
                        disabled={!linkConversa}
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
          )}

          {passo === 5 && (
            <View style={s.sucesso}>
              <View style={s.sucessoIcone}><Icon name="check" size={28} color={t.success} /></View>
              <Text style={s.sucessoTit}>Enviado para {quote.customer_name || "o cliente"}</Text>
              <Text style={s.sucessoTxt}>
                {enviadoPor === "compartilhar" ? "Pelo compartilhamento do WhatsApp." : "Pela conversa do WhatsApp."} O orçamento fica em aberto: quando o cliente topar, toque em Aprovar para ele virar pedido. Se não seguir, Fechar.
              </Text>
              {upload === "salvo" && <Text style={s.nota}>O vídeo fica guardado por 30 dias, e dá para manter por mais tempo no orçamento.</Text>}
            </View>
          )}
        </ScrollView>

        {/* Rodapé */}
        <View style={s.pe}>
          <Text style={s.peInfo} numberOfLines={2}>{passo === 5 ? "" : info}</Text>
          <View style={s.peAcoes}>
            {passo > 1 && passo < 5 && (
              <Pressable style={s.btnSec} onPress={voltar} disabled={ocupado}><Text style={s.btnSecTxt}>← Voltar</Text></Pressable>
            )}
            {passo < 4 && (
              <Pressable style={[s.btnPri, (!podeAvancar || ocupado) && { opacity: 0.45 }]} onPress={avancar} disabled={!podeAvancar || ocupado}>
                {ocupado ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPriTxt}>Continuar →</Text>}
              </Pressable>
            )}
            {passo === 4 && arquivo && compartilhaArquivo && (
              <Pressable style={[s.btnWa, ocupado && { opacity: 0.45 }]} onPress={compartilhar} disabled={ocupado}>
                <Icon name="share" size={15} color="#fff" /><Text style={s.btnPriTxt}>Compartilhar no WhatsApp</Text>
              </Pressable>
            )}
            {passo === 4 && !(arquivo && compartilhaArquivo) && (
              <Pressable
                style={[s.btnWa, (ocupado || !linkConversa) && { opacity: 0.45 }]}
                disabled={ocupado || !linkConversa}
                onPress={() => marcarEnviado(arquivo ? "baixar" : "whatsapp")}
              >
                <Icon name="check" size={15} color="#fff" /><Text style={s.btnPriTxt}>Já mandei</Text>
              </Pressable>
            )}
            {passo === 5 && (
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

  if (!aberto && passo !== 5) {
    // Proteção: o editor só abre o modal para orçamento em aberto.
    return null;
  }
  return conteudo;
}

function Campo({ t, s, rotulo, valor, onChange, dica }: { t: StudioPalette; s: ReturnType<typeof estilos>; rotulo: string; valor: string; onChange: (v: string) => void; dica: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.rotuloCampo}>{rotulo}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput style={[s.input, { width: 96 }]} value={valor} onChangeText={onChange} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={t.ink4} />
        <Text style={[s.opcaoSub, { flex: 1 }]}>{dica}</Text>
      </View>
    </View>
  );
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
    cabeca: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.ink5 } as any,
    icone: { width: 36, height: 36, borderRadius: 10, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" } as any,
    titulo: { fontSize: 16, fontWeight: "800", color: t.ink } as any,
    subtitulo: { fontSize: 12.5, color: t.ink3 } as any,
    fechar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" } as any,
    passos: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: t.paperCard, borderBottomWidth: 1, borderBottomColor: t.ink5, flexWrap: "wrap" } as any,
    passo: { flexDirection: "row", alignItems: "center", gap: 7 } as any,
    bola: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5 } as any,
    bolaTxt: { fontSize: 11, fontWeight: "800", color: t.ink3 } as any,
    rotulo: { fontSize: 12.5, color: t.ink3 } as any,
    sep: { width: estreito ? 14 : 26, height: 2, borderRadius: 2, backgroundColor: t.ink5 } as any,
    // No celular o modal é tela cheia: o corpo ocupa o meio e o rodapé fica embaixo.
    corpo: { flexGrow: estreito ? 1 : 0, flexShrink: 1 } as any,
    corpoConteudo: { padding: 18 } as any,
    duas: { flexDirection: estreito ? "column" : "row", gap: 18 } as any,
    col: { flex: estreito ? undefined : 1, minWidth: 0, gap: 8 } as any,
    secao: { fontSize: 11, fontWeight: "800", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 } as any,
    nota: { fontSize: 12, color: t.ink3, lineHeight: 17 } as any,
    vazio: { minHeight: 300, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: t.ink5, alignItems: "center", justifyContent: "center", padding: 22, gap: 8, backgroundColor: t.paperCard } as any,
    vazioTit: { fontSize: 15, fontWeight: "800", color: t.ink, textAlign: "center" } as any,
    vazioTxt: { fontSize: 12.5, color: t.ink3, textAlign: "center", maxWidth: 320 } as any,
    opcao: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard } as any,
    opcaoMarcada: { borderColor: t.accent, backgroundColor: t.accentSoft } as any,
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: t.ink4, alignItems: "center", justifyContent: "center" } as any,
    radioPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent } as any,
    opcaoTit: { fontSize: 13.5, fontWeight: "700", color: t.ink } as any,
    opcaoSub: { fontSize: 12, color: t.ink3, lineHeight: 17 } as any,
    cores: { flexDirection: "row", gap: 10, flexWrap: "wrap" } as any,
    cor: { alignItems: "center", gap: 4, width: 64, minHeight: 44 } as any,
    corBola: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: t.ink5 } as any,
    corNome: { fontSize: 11.5, color: t.ink3 } as any,
    input: { backgroundColor: t.bgSoft, borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: t.ink } as any,
    inputOff: { opacity: 0.6 } as any,
    rotuloCampo: { fontSize: 12, fontWeight: "700", color: t.ink2, marginTop: 4 } as any,
    mensagem: { minHeight: 260, textAlignVertical: "top", fontSize: 13, lineHeight: 19 } as any,
    chave: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, marginTop: 4 } as any,
    sw: { width: 40, height: 24, borderRadius: 12, backgroundColor: t.ink5 } as any,
    swBola: { position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" } as any,
    link: { paddingVertical: 6 } as any,
    linkTxt: { fontSize: 12.5, fontWeight: "800", color: t.primary } as any,
    cartao: { backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5, borderRadius: 14, paddingHorizontal: 14 } as any,
    linhaItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.ink5 } as any,
    valor: { fontSize: 14, fontWeight: "800", color: t.ink } as any,
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
    pe: { flexDirection: estreito ? "column" : "row", alignItems: estreito ? "stretch" : "center", gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.ink5, backgroundColor: t.paperCard } as any,
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
