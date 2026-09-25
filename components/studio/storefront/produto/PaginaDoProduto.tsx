// ============================================================
// components/studio/storefront/produto/PaginaDoProduto.tsx
//
// A página do produto nova — Fase 3 da normalização da vitrine Studio
// (FASEAMENTO §3.1 e §4 Fases 3A/3B; JORNADA §4.3 e §4.4). Especificação
// visual: docs/mockups/studio-vitrine-03-produto.html (9 telas).
//
// Atrás da chave `vitrine_v2` (chaveV2.ts): a rota escolhe entre esta e o
// ProductConfigurator de hoje (VitrineNaRota.tsx). Nada de regra de
// preço nasce aqui — o unitário e o total são os do hook, a mesma conta
// do servidor; a validação é a mesma do commit (faltaNaPeca espelha
// validateRequiredFields, com teste).
//
// O que muda para a cliente:
//   1. Chegada: trilha, carrossel da galeria, preço ao vivo, parcelas,
//      Pix e o prazo na primeira dobra.
//   2. Modelo e cor: mini-carrossel dos modelos (troca mantendo o que foi
//      preenchido) e a cor que pinta a peça no mockup.
//   3. A arte: os três caminhos como cartões com preço, o envio com
//      progresso e o aviso de foto pequena antes de subir.
//   4. O mockup vira slide — o primeiro e o ativo — assim que há arte,
//      texto ou cor; abas Frente · Verso · Meio sincronizadas.
//   5. Quantidade digitável, régua da escada, "Faltam N", prazo por faixa.
//   6. Frete e retirada antes do checkout.
//   7. Barra de compra fixa: o que falta, o total, "Adicionar à sacola".
//   8. Detalhes abaixo da dobra; "Da mesma categoria".
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Linking, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { StorefrontState } from "../useStorefront";
import type { StudioStoreProduct } from "../types";
import { useVitrine } from "../ContextoDaVitrine";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { LivePreview } from "../LivePreview";
import { ZoomFoto } from "../ZoomFoto";
import { fotosDoProduto } from "../CarrosselFoto";
import { CapaProduto } from "../CapaProduto";
import { SizeGuideModal } from "../SizeGuideModal";
import { BarraDeCookies } from "../ConsentimentoDaVitrine";
import { BotaoCompartilhar } from "../CompartilharPeca";
import { FaixaDaTemporada } from "../FaixaDaTemporada";
import { RodapeDaVitrine } from "../RodapeDaVitrine";
import { configDisponivel } from "../camposDaVitrine";
import { modoDaVitrine } from "../modoDaVitrine";
import { linkDoPedido } from "../pedidoPeloWhatsApp";
import { numeroWhatsApp } from "../AncoraWhatsApp";
import { medirNaVitrine, itemDoProduto } from "../eventosDaVitrine";
import { textoDeParcelamento } from "../parcelamento";
import { precoNoPix } from "../precoNoPix";
import { basePriceForQty } from "../qtyTiers";
import { relacionadosDe } from "../relacionados";
import { seloDoProduto, pecaMaisPedida } from "../selosDoProduto";
import { tituloDaPagina } from "../rotasDaVitrine";
import { dinheiro } from "../moeda";
import { SOBRE_FOTO } from "../theme";
import { useReduzirMovimento } from "../movimento";
import { temPersonalizacaoVisivel } from "@/components/studio/customizationConfig";
import { ART_ADJUST, ART_DESIGNER, ART_NONE, ART_SERVICE_BRIEF_ID } from "@/components/studio/artService";
import { fetchStorefrontVisualTemplate } from "../visualTemplatePublic";
import {
  faltaNaPeca, campoDaCorDaPeca, campoDoServicoDeArte, origensDoLado, prazoDaQuantidade, linhasDePrazo,
  textoDeDias, nomeDaPeca, suaPeca, sobreEstaPeca, nomeCurto, notaDeRevisao, adicionaisDaPeca,
  areaDeImpressao, limiarDaPeca, quantidadeValida, type Lado,
} from "./regrasDaPagina";
import { PalcoDoProduto } from "./PalcoDoProduto";
import { CaminhosDaArte, LadosDaArte, ladosComConteudo, etiquetaDaArte } from "./ArteDaPeca";
import type { EstadoDoEnvio } from "./EnvioDaArte";
import { QuantidadeEDesconto } from "./QuantidadeEDesconto";
import { EntregaNoProduto } from "./EntregaNoProduto";
import { BarraDeCompraCelular, BlocoDeCompraDesktop, type AcaoDaBarra } from "./BarraDeCompra";
import { DetalhesDaPeca, DaMesmaCategoria } from "./DetalhesDaPeca";
import { CabecalhoDaLoja, Trilha } from "./CabecalhoDaLoja";
import { BotaoIcone, CabecalhoDaSecao, EtiquetaFalta, EtiquetaPronta, transicao, useNumeroAnimado, usePulso } from "./kitDaPagina";

/** A partir daqui, duas colunas (a mesma régua do ProductConfigurator). */
export const LARGURA_DESKTOP = 900;
const LARGURA_MAX = 1200;
const ALTURA_DO_CABECALHO = { celular: 52, desktop: 64 };
/** Abaixo disto o bloco de compra do desktop fica compacto. */
const ALTURA_CONFORTAVEL = 900;

/** A categoria da peça e os modelos dela, para a trilha e o seletor. */
function categoriaDaPeca(sf: StorefrontState, p: StudioStoreProduct): { categoria: any; produtos: StudioStoreProduct[] } | null {
  const doGrupo = (sf.vitrine || []).find((e: any) => e.kind === "category" && e.products.some((x: any) => String(x.id) === String(p.id))) as any;
  if (doGrupo) return { categoria: doGrupo.category, produtos: doGrupo.products };
  const cat = (sf.store?.categories || []).find((c) => p.category_id && String(c.id) === String(p.category_id));
  return cat ? { categoria: cat, produtos: (sf.store?.products || []).filter((x) => x.category_id === p.category_id) } : null;
}

/** Nó DOM de um ref do react-native-web (o próprio elemento). */
function noDom(r: any): any {
  if (!r) return null;
  if (typeof r.getBoundingClientRect === "function") return r;
  if (typeof r.getScrollableNode === "function") return r.getScrollableNode();
  return null;
}

export function PaginaDoProduto({ sf, slug }: { sf: StorefrontState; slug: string }) {
  const v = useVitrine();
  const t = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  const { width, height } = useWindowDimensions();
  const desktop = width >= LARGURA_DESKTOP;
  const compacto = desktop && height < ALTURA_CONFORTAVEL;

  const produto = sf.activeProduct as StudioStoreProduct;
  const cfg = configDisponivel(produto?.customization_config, produto?.templates) || null;
  const values = sf.editingValues;
  const store: any = sf.store;
  const modo = modoDaVitrine(store);
  const editando = !!(sf as any)._editingLineId;
  const grupo = produto ? categoriaDaPeca(sf, produto) : null;
  const peca = nomeDaPeca(grupo?.categoria?.name || produto?.category);

  // ── Estado da página ─────────────────────────────────────
  const lados = ladosComConteudo(cfg);
  const [lado, setLadoBruto] = useState<Lado>("front");
  const ladoAtual: Lado = lados.includes(lado) ? lado : "front";
  const [slide, setSlide] = useState(0);
  const [personalizou, setPersonalizou] = useState(() => temPersonalizacaoVisivel(cfg, values));
  const [primeiraVez, setPrimeiraVez] = useState(0);
  const [envios, setEnvios] = useState<Partial<Record<Lado, EstadoDoEnvio>>>({});
  const [destaque, setDestaque] = useState<string | null>(null);
  const [cutucada, setCutucada] = useState(0);
  const [adicionado, setAdicionado] = useState(false);
  const [zoomFoto, setZoomFoto] = useState<number | null>(null);
  const [zoomMock, setZoomMock] = useState(false);
  const [guia, setGuia] = useState(false);
  const [dock, setDock] = useState(false);
  const [areasDoModelo, setAreasDoModelo] = useState<any[] | null>(null);
  const [faixaMedida, setFaixaMedida] = useState(0);
  const filaDeModelos = useRef<any>(null);
  const rolagem = useRef<any>(null);
  const ancoras = useRef<Record<string, any>>({});
  const relogios = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => { relogios.current.forEach(clearTimeout); }, []);
  const depois = (ms: number, fn: () => void) => { relogios.current.push(setTimeout(fn, ms)); };

  // Outra peça aberta (modelo trocado, relacionado, link): o palco volta
  // ao começo; o mockup continua se a personalização veio junto.
  const idAnterior = useRef(produto?.id);
  useEffect(() => {
    if (!produto || idAnterior.current === produto.id) return;
    idAnterior.current = produto.id;
    setPersonalizou((p) => p || temPersonalizacaoVisivel(cfg, values));
    setSlide(0);
    setEnvios({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto?.id]);

  // Fase 1C — view_item: uma vez por peça aberta (igual ao configurador).
  useEffect(() => {
    if (!produto || editando) return;
    medirNaVitrine(store?.site?.rastreadores, { nome: "view_item", itens: [itemDoProduto(produto)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto?.id]);

  // O título da aba (a rota nova não passa pelo ConteudoDaVitrine).
  const titulo = tituloDaPagina({ stage: "configure", nomeDaLoja: store?.site?.name, produto: produto?.name });
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined" && produto) document.title = titulo;
  }, [titulo, produto]);

  // A área do modelo visual só é lida quando o cadastro não tem área:
  // a mesma consulta (em cache) que o LivePreview já faz.
  const semAreaNoCadastro = !(Number((cfg as any)?.print_area?.width_cm) > 0 && Number((cfg as any)?.print_area?.height_cm) > 0);
  useEffect(() => {
    if (!produto || !semAreaNoCadastro || Platform.OS !== "web") { setAreasDoModelo(null); return; }
    let vivo = true;
    fetchStorefrontVisualTemplate(slug, String(produto.id)).then((tpl) => {
      if (!vivo) return;
      const spec: any = tpl?.spec;
      setAreasDoModelo(spec?.areas || spec?.views?.[0]?.areas || null);
    });
    return () => { vivo = false; };
  }, [produto?.id, slug, semAreaNoCadastro]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!produto) return null;

  // ── Números (todos do hook) ──────────────────────────────
  const qtd = sf.editingQty;
  const unitario = sf.configuringUnitPrice;
  const totalDaLinha = typeof (sf as any).configuringLineTotal === "number" ? (sf as any).configuringLineTotal : unitario * qtd;
  // Com a Fase 2 o serviço de arte é cobrado uma vez por linha: ele sai
  // do unitário e aparece à parte.
  const artePorLinha = typeof (sf as any).configuringArtDelta === "number";
  const pixPct = Number(store?.payment?.pix_discount_pct) || 0;
  const temPix = !!store?.payment?.has_pix && pixPct > 0;
  const tiers = produto.qty_tiers || [];
  const precoDeTabela = Number(produto.price) || 0;
  const adicionalPorUnidade = unitario - basePriceForQty(precoDeTabela, tiers, qtd);
  const prazoDaLoja = Number(store?.sla?.total_estimate_days) || null;
  const prazo = prazoDaQuantidade(tiers as any, qtd, prazoDaLoja);

  const versoAtivo = (sf as any)._effectiveBackSelected ? (sf as any)._effectiveBackSelected(cfg, sf.editingAddBack) : sf.editingAddBack;
  const meioAtivo = (sf as any)._effectiveMiddleSelected ? (sf as any)._effectiveMiddleSelected(cfg, sf.editingAddMiddle) : sf.editingAddMiddle;
  const falta = faltaNaPeca(cfg, values, versoAtivo, meioAtivo);
  const ladoEnviando = (Object.keys(envios) as Lado[]).find((l) => envios[l] === "enviando") || null;
  const fraseDaFalta = ladoEnviando
    ? `Enviando a arte ${ladoEnviando === "back" ? "do verso" : ladoEnviando === "middle" ? "do meio" : "da frente"}`
    : falta?.frase || (sf.error ? String(sf.error) : null);

  // ── Campos com lugar próprio ─────────────────────────────
  const campoCor = campoDaCorDaPeca(cfg);
  // Sem paleta cadastrada, as mesmas duas cores do FieldColor (branco e
  // preto): campo de cor obrigatório sem bolinha seria pendência sem saída.
  const coresCadastradas: string[] = (campoCor?.config?.colors || []).filter((c: any) => typeof c === "string");
  const cores: string[] = campoCor ? (coresCadastradas.length ? coresCadastradas : ["#FFFFFF", "#000000"]) : [];
  const corDaPeca = campoCor ? (typeof values[campoCor.id] === "string" ? values[campoCor.id] : cores[0] || null) : null;
  const campoArte = campoDoServicoDeArte(cfg);
  const caminho = campoArte ? String(values[campoArte.id] || ART_NONE) : ART_NONE;
  const escolhaDoAjuste = (campoArte?.config?.choices || []).find((c: any) => c.value === ART_ADJUST);
  const temOrigemDeArte = lados.some((l) => { const o = origensDoLado(cfg, l); return !!(o.envio || o.pronta); });

  // ── Ações ────────────────────────────────────────────────
  function personalizar() {
    if (!personalizou) { setPersonalizou(true); setPrimeiraVez((n) => n + 1); }
    setSlide(0);
  }
  function setValor(id: string, valor: any) {
    sf.setFieldValue(id, valor);
    const f = cfg?.fields?.find((x) => x.id === id);
    const visivel = !f ? /_cor$/.test(id) : (f.type === "text" && id !== ART_SERVICE_BRIEF_ID) || f.type === "image" || f.type === "template" || f.type === "color";
    if (visivel && valor != null && String(valor).trim() !== "") personalizar();
  }
  function setLado(l: Lado) {
    setLadoBruto(l);
    if (personalizou) setSlide(0);
  }
  function escolherCaminho(v2: string) {
    if (!campoArte) return;
    sf.setFieldValue(campoArte.id, v2);
    // "Criem a arte pra mim" dispensa e limpa o envio (Agente J) — e a
    // arte pronta, como no mockup. No ajuste a arte pronta não vale:
    // ajustar é sobre o arquivo da cliente.
    for (const f of cfg?.fields || []) {
      if (v2 === ART_DESIGNER && (f.type === "image" || f.type === "template") && values[f.id]) sf.setFieldValue(f.id, "");
      if (v2 === ART_ADJUST && f.type === "template" && values[f.id]) sf.setFieldValue(f.id, "");
    }
  }
  function rolarAte(chave: string) {
    const alvo = noDom(ancoras.current[chave]);
    const caixa = noDom(rolagem.current);
    if (!alvo || !caixa) return;
    const folga = desktop ? 20 : 72 + 12;
    const y = alvo.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop - folga;
    rolagem.current?.scrollTo?.({ y: Math.max(0, y), animated: !reduzir });
  }
  function irParaFalta() {
    setCutucada((n) => n + 1);
    if (!falta) return;
    if (lados.includes(falta.lado)) setLadoBruto(falta.lado);
    const secao = campoCor && falta.campoId === campoCor.id ? "cor" : "arte";
    rolarAte(secao);
    setDestaque(falta.campoId);
    depois(2400, () => setDestaque(null));
  }
  function pedirOrcamento() {
    const l = linkDoPedido({
      numero: store?.site?.whatsapp, produto, valores: values, quantidade: qtd,
      precoUnitario: unitario, nomeDaLoja: store?.site?.name,
      ...(artePorLinha ? ({ arte: (sf as any).configuringArtDelta } as any) : null),
    });
    if (l) Linking.openURL(l);
    else sf.goTo("lote");
  }
  function adicionar() {
    if (falta || ladoEnviando) { irParaFalta(); return; }
    const faseDois = "adicionado" in (sf as any);
    const nome = produto.name;
    sf.commitConfigure();
    setAdicionado(true);
    depois(1400, () => setAdicionado(false));
    // Sem a gaveta da Fase 2 a vitrine volta para a loja ao adicionar;
    // o aviso da casca diz o que aconteceu. Com ela, a própria Fase 2
    // mostra "Adicionado à sacola" com o "Ver sacola".
    if (!faseDois) v?.avisar(`${nome} na sacola`, "check");
  }
  function comprarAgora() {
    if (falta || ladoEnviando) { irParaFalta(); return; }
    sf.commitConfigure({ direto: true });
  }
  function atualizar() {
    if (falta || ladoEnviando) { irParaFalta(); return; }
    sf.commitConfigure();
  }
  function trocarModelo(p: StudioStoreProduct) {
    if (String(p.id) === String(produto.id)) return;
    if (sf.activeSiblings.some((m) => String(m.id) === String(p.id))) sf.switchModel(p);
    else sf.openConfigure(p, grupo?.produtos || []);
  }

  // ── Textos do topo ───────────────────────────────────────
  const adicionais = adicionaisDaPeca(cfg, values, versoAtivo, meioAtivo);
  const noUnitario = adicionais.filter((a) => !(artePorLinha && a.servicoDeArte));
  const daLinha = adicionais.filter((a) => artePorLinha && a.servicoDeArte);
  const inclui = [
    noUnitario.length ? "Inclui " + noUnitario.map((a) => `${a.nome} (+${dinheiro(a.valor)})`).join(" e ") : "",
    daLinha.length ? daLinha.map((a) => `${a.nome.charAt(0).toUpperCase() + a.nome.slice(1)}: +${dinheiro(a.valor)}, uma vez no item`).join(" · ") : "",
  ].filter(Boolean).join(". ");
  const selo = seloDoProduto(produto, pecaMaisPedida(store?.products || []));
  const fotos = fotosDoProduto((produto as any).gallery_urls, produto.image_url);
  const comMockup = personalizou || fotos.length === 0;
  const area = areaDeImpressao(cfg, areasDoModelo);
  const relacionados = relacionadosDe(produto, store?.products);
  const sizeGuide = (cfg as any)?.size_guide as { file_url: string; content_type: string } | undefined;
  const numeroWa = numeroWhatsApp(store?.site?.whatsapp);
  const linkWa = linkDoPedido({
    numero: store?.site?.whatsapp, produto, valores: values, quantidade: qtd, precoUnitario: unitario, nomeDaLoja: store?.site?.name,
    ...(artePorLinha ? ({ arte: (sf as any).configuringArtDelta } as any) : null),
  });

  // ── Medidas ──────────────────────────────────────────────
  const larguraConteudo = Math.min(width, LARGURA_MAX) - (desktop ? 80 : 0);
  // O palco do desktop cabe INTEIRO entre o cabeçalho e a faixa de compra
  // (medida de verdade; antes de medir, a estimativa): trilha, palco e
  // legenda à vista sem rolar, num notebook de 768 px também.
  const alturaDaFaixa = faixaMedida || (compacto ? 190 : 236);
  const alturaUtil = height - ALTURA_DO_CABECALHO.desktop - alturaDaFaixa;
  const ladoDoPalcoDesk = Math.round(Math.max(320, Math.min(528, alturaUtil - 40 - 16 - 36, larguraConteudo - 86 - 56 - 400)));
  const larguraDoPalco = desktop ? ladoDoPalcoDesk : width - 32;
  const alturaDoPalco = desktop ? ladoDoPalcoDesk : Math.round((width - 32) * 5 / 6);
  const larguraDaGaleria = desktop ? 72 + 14 + ladoDoPalcoDesk : width;
  const tamanhoDoMock = Math.round(Math.min(larguraDoPalco, alturaDoPalco) * (desktop ? 0.78 : 0.72));

  const mockup = (
    <LivePreview
      config={cfg}
      values={values}
      size={tamanhoDoMock}
      productName={produto.name}
      showLabel={false}
      slug={slug}
      productId={produto.id}
      fotoProduto={produto.image_url}
      lado={ladoAtual}
    />
  );

  // ── Seções numeradas ─────────────────────────────────────
  let passo = 0;
  const secoes: ReactNode[] = [];
  const secao = (chave: string, conteudo: ReactNode) => (
    <View
      key={chave}
      ref={(r) => { ancoras.current[chave] = r; }}
      testID={"secao-" + chave}
      style={{ paddingVertical: desktop ? 24 : 22, paddingHorizontal: desktop ? 0 : 16, borderTopWidth: 1, borderTopColor: t.border }}
    >
      {conteudo}
    </View>
  );

  if (sf.activeSiblings.length > 1 && !editando) {
    passo += 1;
    secoes.push(secao("modelo", (
      <>
        <CabecalhoDaSecao
          numero={passo}
          titulo="Modelo"
          extra={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Texto style={{ fontSize: 13, color: t.ink2 }}>{`${sf.activeSiblings.length} modelos`}</Texto>
              {desktop ? (
                <>
                  <BotaoIcone icone="chevron_left" rotulo="Ver modelos anteriores" onPress={() => moverFila(filaDeModelos.current, -1)} tamanho={40} />
                  <BotaoIcone icone="chevron_right" rotulo="Ver mais modelos" onPress={() => moverFila(filaDeModelos.current, 1)} tamanho={40} />
                </>
              ) : null}
            </View>
          }
        />
        <SeletorDeModelo fila={filaDeModelos} modelos={sf.activeSiblings} atual={String(produto.id)} categoria={grupo?.categoria?.name} desktop={desktop} onEscolher={trocarModelo} />
      </>
    )));
  }
  if (campoCor && cores.length) {
    passo += 1;
    secoes.push(secao("cor", (
      <>
        <CabecalhoDaSecao numero={passo} titulo={campoCor.label && campoCor.label.trim().toLowerCase() !== "cor" ? campoCor.label : `Cor ${peca.feminino ? "da" : "do"} ${peca.nome}`} />
        {cores.length > 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={campoCor.label || "Cor"} style={[{ flexDirection: "row", flexWrap: "wrap", gap: 2, marginHorizontal: -4, borderRadius: 999 }, destaque === campoCor.id && Platform.OS === "web" ? ({ boxShadow: `0 0 0 3px ${t.amber}` } as any) : null]}>
            {cores.map((c) => {
              const sel = String(values[campoCor.id] || "").toLowerCase() === c.toLowerCase();
              const escolha = (campoCor.config?.choices || []).find((ch: any) => ch.value === c || ch.label === c);
              const delta = Number(escolha?.price_delta) || 0;
              return (
                <Pressable
                  key={c}
                  onPress={() => setValor(campoCor.id, c)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={`${escolha?.label || c}${delta ? ", mais " + dinheiro(delta) : ""}`}
                  style={{ width: 50, minHeight: 50, alignItems: "center", justifyContent: "center" }}
                >
                  <View style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 1, borderColor: "rgba(0,0,0,.12)" },
                    Platform.OS === "web" ? ({ boxShadow: `inset 0 0 0 3px ${t.bg2}`, ...(sel ? { outline: `2px solid ${t.marcaTexto}`, outlineOffset: 2 } : null) } as any) : sel ? { borderWidth: 2, borderColor: t.marcaTexto } : null]} />
                  {delta ? <Numero style={{ fontSize: 10, color: sel ? t.ink : t.ink3, marginTop: 2 }}>+{dinheiro(delta)}</Numero> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: cores[0], borderWidth: 1, borderColor: "rgba(0,0,0,.12)" }} />
            <Texto style={{ fontSize: 14, color: t.ink2 }}>Vem numa cor só.</Texto>
          </View>
        )}
      </>
    )));
  }

  const temCamposNoForm = lados.length > 0 && (temOrigemDeArte || (cfg?.fields || []).some((f) => f.type === "text" || f.type === "option"));
  if (campoArte || temCamposNoForm) {
    passo += 1;
    const faltaArte = !!falta && falta.tipo === "arte";
    const etq = campoArte || temOrigemDeArte
      ? etiquetaDaArte({ enviando: !!ladoEnviando, faltaArte, designer: caminho === ART_DESIGNER, temArte: !faltaArte && lados.some((l) => { const o = origensDoLado(cfg, l); return !!((o.envio && values[o.envio.id]) || (o.pronta && values[o.pronta.id])); }) })
      : null;
    secoes.push(secao("arte", (
      <>
        <CabecalhoDaSecao
          numero={passo}
          titulo={campoArte ? "Como você quer resolver a arte?" : temOrigemDeArte ? "Sua arte" : "Personalize"}
          extra={etq ? (etq.tipo === "falta" ? <EtiquetaFalta texto={etq.texto} /> : <EtiquetaPronta texto={etq.texto} />) : null}
        />
        <View style={{ gap: 22 }}>
          {campoArte ? (
            <CaminhosDaArte
              campo={campoArte}
              valor={caminho}
              brief={String(values[ART_SERVICE_BRIEF_ID] || "")}
              desktop={desktop}
              onEscolher={escolherCaminho}
              onBrief={(b) => sf.setFieldValue(ART_SERVICE_BRIEF_ID, b)}
            />
          ) : null}
          {cfg ? (
            <LadosDaArte
              cfg={cfg}
              values={values}
              lados={lados}
              lado={ladoAtual}
              onLado={setLado}
              setValor={setValor}
              caminho={caminho}
              templates={produto.templates}
              slug={slug}
              peca={peca}
              limiar={limiarDaPeca(area)}
              desktop={desktop}
              versoLigado={sf.editingAddBack}
              meioLigado={sf.editingAddMiddle}
              onVerso={() => { const novo = !sf.editingAddBack; sf.setEditingAddBack(novo); if (novo) personalizar(); }}
              onMeio={() => { const novo = !sf.editingAddMiddle; sf.setEditingAddMiddle(novo); if (novo) personalizar(); }}
              corDaPeca={corDaPeca}
              onEnvio={(l, e) => setEnvios((s) => (s[l] === e ? s : { ...s, [l]: e }))}
              pedirAjuste={escolhaDoAjuste && Number(escolhaDoAjuste.price_delta) >= 0 ? { preco: Number(escolhaDoAjuste.price_delta) || 0, onPress: () => escolherCaminho(ART_ADJUST) } : null}
              destaque={destaque}
            />
          ) : null}
        </View>
      </>
    )));
  }

  passo += 1;
  secoes.push(secao("quantidade", (
    <>
      <CabecalhoDaSecao numero={passo} titulo="Quantidade" />
      <QuantidadeEDesconto
        qtd={qtd}
        onQtd={(n) => sf.setEditingQty(quantidadeValida(n))}
        unitario={unitario}
        tiers={tiers}
        precoDeTabela={precoDeTabela}
        adicionalPorUnidade={adicionalPorUnidade}
        prazoDaLoja={prazoDaLoja}
        onLote={() => sf.goTo("lote")}
      />
    </>
  )));

  const entrega = store?.delivery;
  if (!entrega || entrega.pickup_enabled !== false || entrega.delivery_enabled || entrega.courier_pickup_enabled) {
    passo += 1;
    secoes.push(secao("entrega", (
      <>
        <CabecalhoDaSecao numero={passo} titulo="Entrega ou retirada" />
        <EntregaNoProduto slug={slug} entrega={entrega} endereco={store?.site?.endereco} cepInicial={sf.addressZip} onCep={(c) => sf.setAddressZip(c)} />
        {modo.aceita && linkWa ? (
          <Pressable onPress={() => Linking.openURL(linkWa)} accessibilityRole="link" accessibilityLabel="Fazer este pedido pelo WhatsApp da loja"
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, marginTop: 14 }}>
            <Icon name="whatsapp" size={16} color={t.ink2} />
            <Texto style={{ fontSize: 13.5, fontWeight: "500", color: t.ink2 }}>Prefere pedir pelo WhatsApp?</Texto>
          </Pressable>
        ) : null}
      </>
    )));
  }

  // ── Blocos ───────────────────────────────────────────────
  const trilha = (
    <Trilha
      desktop={desktop}
      niveis={[
        { rotulo: "Início", onPress: () => sf.goTo("list") },
        ...(grupo ? [{ rotulo: grupo.categoria.name, onPress: () => sf.abrirGrupo(grupo.categoria, grupo.produtos) }] : []),
        { rotulo: grupo ? nomeCurto(produto.name, grupo.categoria.name) : produto.name },
      ]}
    />
  );

  const palco = (
    <PalcoDoProduto
      fotos={fotos}
      nome={produto.name}
      selo={selo}
      largura={larguraDoPalco}
      altura={alturaDoPalco}
      desktop={desktop}
      comMockup={comMockup}
      mockupPersonalizado={personalizou}
      mockup={mockup}
      rotuloDoMock={suaPeca(peca)}
      lados={lados}
      lado={ladoAtual}
      onLado={setLado}
      slide={slide}
      onSlide={setSlide}
      onAmpliar={(i) => (i == null ? setZoomMock(true) : setZoomFoto(i))}
      brilho={primeiraVez}
    />
  );

  const info = (
    <InfoDoTopo
      nome={produto.name}
      produto={produto}
      unitario={unitario}
      qtd={qtd}
      parcelas={textoDeParcelamento(unitario, store?.payment?.card_max_installments)}
      pix={temPix ? precoNoPix(unitario, pixPct) : null}
      inclui={inclui}
      prazo={prazo}
      store={store}
      desktop={desktop}
    />
  );

  const acao: AcaoDaBarra = {
    total: totalDaLinha, unitario, qtd,
    totalNoPix: temPix ? precoNoPix(totalDaLinha, pixPct) : null,
    falta: fraseDaFalta, cutucada, adicionado, editando, aceita: modo.aceita, store,
    onFalta: irParaFalta, onAdicionar: adicionar, onComprar: comprarAgora, onAtualizar: atualizar, onOrcamento: pedirOrcamento,
  };

  const detalhes = (
    <DetalhesDaPeca
      produto={produto}
      titulo={sobreEstaPeca(peca)}
      area={area}
      notaDeRevisao={notaDeRevisao(store?.revisions)}
      prazos={linhasDePrazo(tiers as any, prazoDaLoja)}
      temGuia={!!sizeGuide?.file_url}
      onGuia={() => setGuia(true)}
      whatsapp={numeroWa && linkWa ? { numero: String(store?.site?.whatsapp || ""), link: linkWa } : null}
      desktop={desktop}
    />
  );
  const mesma = (
    <DaMesmaCategoria
      produtos={relacionados}
      desktop={desktop}
      largura={larguraConteudo}
      corDaLoja={store?.site?.primary_color}
      onEscolher={(p) => { trocarModelo(p); rolagem.current?.scrollTo?.({ y: 0, animated: !reduzir }); }}
    />
  );

  const sobreposicoes = (
    <>
      <ZoomFoto fotos={fotos} nome={produto.name} indice={zoomFoto} onFechar={() => setZoomFoto(null)} />
      {zoomMock ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setZoomMock(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(20,18,16,.92)", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <View style={{ position: "absolute", top: 12, right: 12, left: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Numero style={{ color: SOBRE_FOTO, opacity: 0.8, fontSize: 13 }}>{suaPeca(peca)}</Numero>
              <BotaoIcone icone="x" rotulo="Fechar" cor={SOBRE_FOTO} onPress={() => setZoomMock(false)} />
            </View>
            <View style={{ borderRadius: 18, overflow: "hidden", backgroundColor: t.bg3, padding: 16 }}>
              <LivePreview config={cfg} values={values} size={Math.round(Math.min(width, height) * 0.72)} productName={produto.name} showLabel={false} slug={slug} productId={produto.id} fotoProduto={produto.image_url} lado={ladoAtual} />
            </View>
          </View>
        </Modal>
      ) : null}
      {guia && sizeGuide?.file_url ? <SizeGuideModal sizeGuide={sizeGuide} onClose={() => setGuia(false)} /> : null}
    </>
  );

  const rodape = (
    <View style={{ marginTop: desktop ? 56 : 30 }}>
      <RodapeDaVitrine store={store} />
    </View>
  );

  if (!desktop) {
    const fimDoPalco = 44 + alturaDoPalco;
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }} testID="pagina-do-produto">
        <CabecalhoDaLoja sf={sf} desktop={false} onVoltar={() => { sf.setError(null); sf.goTo("list"); }} linhaEmbaixo={dock} />
        <View style={{ flex: 1, position: "relative" }}>
          <ScrollView
            ref={rolagem}
            style={{ flex: 1 }}
            scrollEventThrottle={32}
            onScroll={(e) => { const y = e.nativeEvent.contentOffset.y; const d = y > fimDoPalco; if (d !== dock) setDock(d); }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {trilha}
            <View style={{ paddingHorizontal: 16 }}>{palco}</View>
            {info}
            {secoes}
            {detalhes}
            {mesma}
            {rodape}
          </ScrollView>
          <Doca
            visivel={dock}
            titulo={personalizou ? suaPeca(peca) : produto.name}
            legenda={grupo ? nomeCurto(produto.name, grupo.categoria.name) : ""}
            foto={fotos[0] || null}
            preco={unitario}
            onPress={() => rolagem.current?.scrollTo?.({ y: 0, animated: !reduzir })}
          />
        </View>
        <BarraDeCookies />
        <BarraDeCompraCelular a={acao} />
        {sobreposicoes}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }} testID="pagina-do-produto">
      <CabecalhoDaLoja sf={sf} desktop onVoltar={() => sf.goTo("list")} categoriaAtiva={grupo ? String(grupo.categoria?.slug || grupo.categoria?.id || "") : null} />
      <ScrollView ref={rolagem} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: 40 }}>
          <View style={{ paddingVertical: 8 }}>{trilha}</View>
          <View style={{ flexDirection: "row", gap: 56, alignItems: "flex-start" }}>
            <View style={[{ width: larguraDaGaleria }, Platform.OS === "web" ? ({ position: "sticky", top: 16 } as any) : null]}>
              {palco}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {info}
              {secoes}
            </View>
          </View>
          <View style={{ marginTop: 56 }}>{detalhes}</View>
          {mesma}
        </View>
        {rodape}
      </ScrollView>
      <BarraDeCookies />
      {/* O bloco de compra numa faixa PRÓPRIA, fora da rolagem: alinhado à
          coluna direita como no mockup, mas sem cobrir nada — no mockup
          ele flutuava por cima e, numa tela de 820 px, escondia a seção
          da arte. Aqui a rolagem termina onde a faixa começa. */}
      <View style={{ backgroundColor: t.bg, paddingTop: 8, paddingBottom: 14 }} onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (Math.abs(h - faixaMedida) > 2) setFaixaMedida(h); }}>
        <View style={{ width: "100%", maxWidth: LARGURA_MAX, alignSelf: "center", paddingHorizontal: 40, flexDirection: "row", gap: 56 }}>
          <View style={{ width: larguraDaGaleria }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <BlocoDeCompraDesktop a={acao} compacto={compacto} />
          </View>
        </View>
      </View>
      {sobreposicoes}
    </View>
  );
}

/** Nome, preço ao vivo, parcelas, Pix e o bloco calmo do prazo (Tela 1). */
function InfoDoTopo({
  nome, produto, unitario, qtd, parcelas, pix, inclui, prazo, store, desktop,
}: {
  nome: string;
  produto: StudioStoreProduct;
  unitario: number;
  qtd: number;
  parcelas: string | null;
  pix: number | null;
  inclui: string;
  prazo: number | null;
  store: any;
  desktop: boolean;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  const preco = useNumeroAnimado(unitario);
  const acende = usePulso(prazo, 1300);
  return (
    <View style={{ paddingTop: desktop ? 6 : 6, paddingBottom: desktop ? 22 : 20, paddingHorizontal: desktop ? 0 : 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <Texto accessibilityRole="header" style={{ flex: 1, fontFamily: tipo.display, fontSize: desktop ? 32 : 27, lineHeight: desktop ? 36 : 31, color: t.ink, paddingTop: 4, letterSpacing: -0.3 }}>
          {nome}
        </Texto>
        <BotaoCompartilhar produto={produto} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: desktop ? 10 : 6 }}>
        <Numero accessibilityLiveRegion="polite" testID="preco-unitario" style={{ fontSize: desktop ? 30 : 28, fontWeight: "700", letterSpacing: -0.7, color: t.ink }}>{dinheiro(preco)}</Numero>
        {qtd > 1 ? <Texto style={{ fontSize: 13, color: t.ink3 }}>cada</Texto> : null}
      </View>
      {parcelas ? <Texto style={{ fontSize: 13.5, color: t.ink2, marginTop: 6 }}>{parcelas}</Texto> : null}
      {pix != null ? (
        <Texto style={{ fontSize: 13, fontWeight: "600", color: t.green, marginTop: 2 }}>
          <Numero style={{ fontSize: 13, fontWeight: "600", color: t.green }}>{dinheiro(pix)}</Numero> no Pix
        </Texto>
      ) : null}
      {inclui ? <Texto style={{ fontSize: 12.5, color: t.ink3, marginTop: 6 }}>{inclui}.</Texto> : null}
      <View style={{ marginTop: desktop ? 16 : 12, paddingVertical: 4, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.bg3 }}>
        {prazo != null ? (
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, borderRadius: 8 }, acende ? { backgroundColor: t.marcaWashForte } : null, transicao("background-color", 600)]}>
            <Icon name="clock" size={18} color={t.marcaTexto} />
            <Texto style={{ fontSize: 14, color: t.ink2, flex: 1 }}>
              <Texto style={{ fontWeight: "600", color: t.ink }}>{`Pronto em ${textoDeDias(prazo)}`}</Texto>
              {qtd >= 10 ? <Texto style={{ fontSize: 12.5, color: t.ink3 }}>{` para ${qtd} unidades`}</Texto> : null}
            </Texto>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, borderTopWidth: prazo != null ? 1 : 0, borderTopColor: t.border }}>
          <Icon name="eye" size={18} color={t.marcaTexto} />
          <Texto style={{ fontSize: 14, color: t.ink2, flex: 1 }}>Você aprova o mockup antes de produzir</Texto>
        </View>
      </View>
      {modoDaVitrine(store).aceita ? <View style={{ marginTop: 10 }}><FaixaDaTemporada store={store} lugar="junto" /></View> : null}
    </View>
  );
}

/**
 * O mini-carrossel de modelos (Tela 2): a capa de cada modelo, o nome
 * curto e o preço, na ordem da grade. Trocar mantém o que a cliente já
 * preencheu (sf.switchModel → transportarValores).
 */
/** Rola a fila de modelos (setas do desktop). */
function moverFila(fila: any, d: number) {
  const n = noDom(fila);
  if (n?.scrollBy) n.scrollBy({ left: d * 324, behavior: "smooth" });
}

function SeletorDeModelo({
  fila, modelos, atual, categoria, desktop, onEscolher,
}: {
  fila: { current: any };
  modelos: StudioStoreProduct[];
  atual: string;
  categoria?: string | null;
  desktop: boolean;
  onEscolher: (p: StudioStoreProduct) => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <View style={{ position: "relative", marginHorizontal: desktop ? 0 : -16 }}>
      <ScrollView
        ref={fila}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: desktop ? 2 : 16, paddingTop: 3, paddingBottom: 8 }}
        accessibilityRole={"radiogroup" as any}
        accessibilityLabel="Modelo"
      >
        {modelos.map((m) => {
          const sel = String(m.id) === atual;
          const foto = fotosDoProduto((m as any).gallery_urls, m.image_url)[0] || null;
          return (
            <Pressable
              key={m.id}
              onPress={() => onEscolher(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              accessibilityLabel={`${m.name}, ${dinheiro(Number(m.price))}`}
              style={{ width: 98, gap: 6 }}
            >
              {({ hovered }: any) => (
                <>
                  <View style={[{ width: 98, height: 98, borderRadius: 14, overflow: "hidden", backgroundColor: t.bg3, borderWidth: sel ? 2 : 1, borderColor: sel ? t.marcaTexto : hovered ? t.ink3 : t.border }, transicao("border-color")]}>
                    {foto ? <Image source={{ uri: foto }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
                      : <CapaProduto nome={m.name} tamanho={98} altura={98} preencher fonteDisplay={tipo.display} />}
                  </View>
                  <Texto numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 16, color: sel ? t.ink : t.ink2, fontWeight: sel ? "600" : "400" }}>
                    {nomeCurto(m.name, categoria)}
                  </Texto>
                  <Numero style={{ fontSize: 12, fontWeight: "500", color: sel ? t.ink : t.ink3 }}>{dinheiro(Number(m.price))}</Numero>
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * A prévia compacta do celular (Tela 2): ao rolar para além da foto, uma
 * faixa de 72 px com a peça, o nome e o preço. Antes a prévia inteira
 * (445 px) grudava no topo e escondia o campo de texto.
 */
function Doca({ visivel, titulo, legenda, foto, preco, onPress }: { visivel: boolean; titulo: string; legenda: string; foto: string | null; preco: number; onPress: () => void }) {
  const t = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  return (
    <View
      pointerEvents={visivel ? "auto" : "none"}
      accessibilityElementsHidden={!visivel}
      style={[{
        position: "absolute", left: 0, right: 0, top: 0, zIndex: 25, backgroundColor: t.bg,
        borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 6, paddingHorizontal: 12,
        opacity: visivel ? 1 : 0, transform: [{ translateY: visivel ? 0 : -20 }],
      }, reduzir ? null : transicao("opacity, transform")]}
    >
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Ver a peça maior" style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60 }}>
        <View style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", backgroundColor: t.bg3 }}>
          {foto ? <Image source={{ uri: foto }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: t.ink }}>{titulo}</Texto>
          {legenda ? <Texto numberOfLines={1} style={{ fontSize: 12.5, color: t.ink3 }}>{legenda}</Texto> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Numero style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>{dinheiro(preco)}</Numero>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Texto style={{ fontSize: 12, fontWeight: "600", color: t.marcaTexto }}>Ver maior</Texto>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

