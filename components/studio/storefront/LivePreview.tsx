// ============================================================
// components/studio/storefront/LivePreview.tsx
// Wrap do PersonalizationPreview com props claras e tipadas.
//
// VISUAL ENGINE F3/F4 (03/07/2026):
//   Quando slug+productId são passados (ProductConfigurator) e o
//   produto tem template visual vinculado (fetch público, cache),
//   o preview sobe de nível:
//     photo2d → canvas do motor compose2d (frente/verso, arte real)
//     model3d → viewer 3D da caneca (Mug3DPreview, arraste pra girar)
//   Sem template (ou nativo, ou uso no checkout sem as props novas)
//   → comportamento ANTIGO intacto (PersonalizationPreviewBase SVG).
//
// CONTRATO (props antigas inalteradas; slug/productId são opcionais):
//   config       — CustomizationConfig | null (inclui print_area, fields)
//   values       — Record<fieldId, any> (estado atual da personalização)
//   size         — number (px de lado do preview)
//   productName  — string
//   showLabel    — boolean
//   slug?        — slug da loja (habilita o motor)
//   productId?   — id do produto (habilita o motor)
//
// MOCKUP NA FOTO (27/09/2026): sem template do banco, a marcação que a
//   lojista fez na foto da peça (`config.mockup_foto`) vira uma spec
//   photo2d e passa pelo MESMO canvas do motor. Precedência: template do
//   banco > mockup na foto > SVG. Nas miniaturas da sacola e do checkout
//   (sem slug/productId) não há consulta ao banco: a foto marcada vale
//   direto, porque a config já veio junto com a linha.
//
// TRATAMENTO PDF (D1): mantido — valor PDF é stripado antes de
// qualquer renderer (SVG ou canvas) e a nota discreta aparece abaixo.
//
// DESACOPLAMENTO DE TEMA (Onda 0 · 0.6): mantido — storefront usa
// PersonalizationPreviewBase com STOREFRONT_PALETTE no fallback.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Platform, Pressable } from "react-native";
import { PersonalizationPreviewBase, type PreviewPalette } from "@/components/studio/PersonalizationPreview";
import { areaNoSvg } from "@/components/studio/areaNoSvg";
import { valoresDoMotor, valoresComArte } from "./valoresDoMotor";
import { esperarFonteDaArte } from "./fonteDaArte";
import { pontoNaAreaDaVista } from "@/components/studio/visualEngine/pontoNaVista";
import { medidaDoArquivo } from "./produto/EnvioDaArte";
import { pixelsConhecidos } from "./produto/medidasDaArte";
import type { ArrasteDaSuperficie, PontoDaSuperficie } from "./produto/EditorDaArte";
import type { ExtrasDaArte } from "./valoresDoMotor";
import type { CustomizationConfig } from "./types";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { wash, type PaletaDaVitrine } from "./theme";
import { Icon } from "@/components/Icon";
import type { VisualTemplate, VisualView } from "@/services/studioVisualApi";
import { fetchStorefrontVisualTemplate } from "./visualTemplatePublic";
import { fonteDoMockup, useSpecDaFotoDoProduto } from "@/components/studio/visualEngine/specDaFotoDoProduto";

// S3 — a cor escolhida no campo `color` e a cor da PECA no mockup (3D e,
// desde 27/09/2026, tambem no 2D). Sem isto o motor caia no default bege
// e a escolha do cliente nao aparecia no preview — o oposto do que o
// mockup existe para mostrar. A regra mora em visualEngine/corDaPeca.ts.
import { corDaPeca } from "@/components/studio/visualEngine/corDaPeca";
import { composeView, notaDaComposicao } from "@/components/studio/visualEngine/compose2d";
import { Mug3DPreview } from "@/components/studio/visualEngine/Mug3DPreview";
import type { Cenario } from "@/components/studio/visualEngine/compose3dMug";

import { Texto } from "./TipografiaVitrine";
// Paleta do mockup, derivada da paleta da vitrine — sem tocar no tema
// interno do painel. Mantém o preview coerente com a loja em volta.
//
// Era uma constante de módulo, montada da paleta cravada. Com o tema
// vivo (S1), ela passa a ser função: a cor é da lojista e só existe em
// tempo de render.
function paletaDoPreview(T: PaletaDaVitrine): PreviewPalette {
  return {
    bgSoft: T.bg,
    ink: T.ink,
    ink3: T.ink3,
    ink4: T.ink4,
    ink5: T.border,
    primary: T.primary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna true se a string parece ser uma URL de PDF. */
function isPdfUrl(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  // Remove query string / fragment antes de checar a extensão
  try {
    const pathname = new URL(v).pathname;
    return pathname.toLowerCase().endsWith(".pdf");
  } catch {
    // URL relativa ou inválida — checa direto na string
    return v.split("?")[0].toLowerCase().endsWith(".pdf");
  }
}

/**
 * Encontra o primeiro campo type='image' que contém uma URL PDF em values.
 * Retorna { fieldId } se encontrou, null caso contrário.
 */
function findPdfImageField(
  config: CustomizationConfig | null,
  values: Record<string, any>,
): { fieldId: string } | null {
  if (!config?.fields) return null;
  for (const field of config.fields) {
    if (field.type === "image" && isPdfUrl(values[field.id])) {
      return { fieldId: field.id };
    }
  }
  return null;
}

function PdfNote({ size }: { size: number }) {
  const T = usePaletaDaVitrine();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: wash(T.ink3, 0.1),
        borderWidth: 1,
        borderColor: wash(T.ink3, 0.2),
        maxWidth: size,
      }}
      accessibilityRole="text"
      accessibilityLabel="PDF enviado. Pré-visualização indisponível."
    >
      <Icon name="file_text" size={13} color={T.ink3} />
      <Texto
        style={{ fontSize: 11, color: T.ink3, fontWeight: "600", flexShrink: 1 }}
        numberOfLines={1}
      >
        PDF enviado — pré-visualização indisponível
      </Texto>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function LivePreview({
  config, values, size, productName, showLabel, slug, productId,
  allowSideToggle = false, fotoProduto, lado, onFonte, fundo, cenario, peca, edicao, giroAutomatico, onMotor,
}: {
  /** Qual desenho está na tela: 3D, 2D (foto/template) ou o SVG de sempre. */
  onMotor?: (m: "3d" | "2d" | "svg") => void;
  /**
   * 28/09/2026 — formatação da arte. A peça ("caneca", "camiseta") dá a
   * técnica padrão quando a lojista não escolheu; `edicao` liga as guias
   * e o arraste da arte na própria peça (3D e 2D); `giroAutomatico`
   * desliga o giro sozinho do 3D.
   */
  peca?: string | null;
  edicao?: {
    extras: ExtrasDaArte;
    arraste: ArrasteDaSuperficie | null;
    editando: boolean;
    informarMotor?: (areaCm: { w: number; h: number } | null, aspecto: number) => void;
  } | null;
  giroAutomatico?: boolean;
  config: CustomizationConfig | null;
  values: Record<string, any>;
  size: number;
  productName: string;
  showLabel: boolean;
  /** F3: slug da loja — junto com productId habilita o motor visual */
  slug?: string;
  /** F3: id do produto — junto com slug habilita o motor visual */
  productId?: string;
  /**
   * Mostra o alternador Frente/Verso/Meio. So o configurador liga: nas
   * miniaturas do carrinho (56px) e da lista (72px) os chips nao cabem e
   * nao ha o que alternar — o cliente ainda nem escolheu nada.
   */
  allowSideToggle?: boolean;
  /** Foto do produto — vira a base do preview quando nao ha template
   *  visual. Sem ela o cliente ve um quadrado colorido no lugar da peca. */
  fotoProduto?: string | null;
  /**
   * Fase 3 (página do produto nova): o lado vindo de FORA. A página nova
   * desenha as abas Frente · Verso · Meio em cima do mockup e no
   * formulário, as duas sincronizadas — o lado é dela, e o alternador
   * interno fica desligado (allowSideToggle). Sem a prop, o lado segue
   * sendo do próprio preview, como antes.
   */
  lado?: "front" | "back" | "middle";
  /**
   * De onde vem o desenho da prévia (template do banco, foto marcada pela
   * lojista ou o SVG de sempre). A página do produto usa para a legenda:
   * na foto marcada, a cor da peça não pinta a foto (28/09/2026).
   */
  onFonte?: (fonte: "banco" | "foto" | "nenhuma") => void;
  /**
   * A cor do fundo em volta do 3D (hex): o estúdio do motor deriva dela o
   * chão e a parede, e a peça fica no papel da loja (app#995).
   */
  fundo?: string;
  /** O cenário do 3D: "nenhum" nas miniaturas (sacola, checkout). */
  cenario?: Cenario;
}) {
  const T = usePaletaDaVitrine();
  const canUseEngine = Platform.OS === "web" && !!slug && !!productId;
  const [tpl, setTpl] = useState<VisualTemplate | null>(null);
  // Se a consulta ao template do banco já respondeu. Enquanto não
  // responde, o mockup na foto espera: mostrar a foto e trocar pelo
  // template do banco um instante depois seria um pulo na tela.
  const [tplRespondeu, setTplRespondeu] = useState(!canUseEngine);
  const [ladoInterno, setViewId] = useState<"front" | "back" | "middle">("front");
  const viewId = lado ?? ladoInterno;
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    if (canUseEngine) {
      setTplRespondeu(false);
      fetchStorefrontVisualTemplate(slug as string, productId as string).then((t) => {
        if (alive) { setTpl(t); setTplRespondeu(true); }
      });
    } else {
      setTpl(null);
      setTplRespondeu(true);
    }
    return () => { alive = false; };
  }, [slug, productId, canUseEngine]);

  // D1: Tratamento de PDF (vale pra qualquer renderer)
  const pdfField = findPdfImageField(config, values);
  const safeValues: Record<string, any> = pdfField
    ? { ...values, [pdfField.fieldId]: undefined }
    : values;

  const specDaFoto = useSpecDaFotoDoProduto(config);
  // O canvas do motor só existe no web; no nativo segue o SVG.
  const fonte = fonteDoMockup(tpl, tplRespondeu && Platform.OS === "web" ? specDaFoto : null);
  const onFonteRef = useRef(onFonte);
  onFonteRef.current = onFonte;
  useEffect(() => { onFonteRef.current?.(fonte); }, [fonte]);
  // A nota debaixo do quadro quando a foto entrou sem a luz (ou nem
  // entrou): ver carregarImagemDoMotor em compose2d.ts.
  const [notaDoMotor, setNotaDoMotor] = useState<string | null>(null);
  const photoViews: VisualView[] =
    tpl?.kind === "photo2d" && Array.isArray(tpl.spec?.views) && tpl.spec!.views!.length
      ? (tpl.spec!.views as VisualView[])
      : fonte === "foto" && specDaFoto?.views
      ? specDaFoto.views
      : [];
  // O verso sempre foi photoViews[1] — vista fixa, template com 2 fotos.
  // O meio (wrap 360 / faixa central de caneca e copo) não tem posição
  // fixa nesse array: só existe se o template visual tiver uma view com
  // id='middle'. Sem ela NÃO inventamos asset — o preview degrada pro
  // mesmo caminho que já existe quando falta a view do verso (front, ou
  // o SVG genérico mais abaixo quando nem front tem template).
  // Por id primeiro: a spec da foto pode ter frente e meio sem verso, e
  // aí photoViews[1] é o meio.
  const backView =
    photoViews.find((v) => v.id === "back") ||
    (photoViews[1] && photoViews[1].id !== "middle" ? photoViews[1] : null);
  const middleView = photoViews.find((v) => v.id === "middle") || null;
  const engineView = !photoViews.length
    ? null
    : viewId === "back" && backView
    ? backView
    : viewId === "middle" && middleView
    ? middleView
    : photoViews[0];
  // O alternador segue o PRODUTO, nao o template visual. Antes ele exigia
  // uma view dedicada, entao quem nao tem template (a maioria) nunca via o
  // verso nem o meio: o cliente digitava o nome e a peca ficava vazia,
  // parecendo quebrada. Sem view dedicada o desenho degrada, mas o lado
  // continua acessivel.
  const showBackToggle = config?.has_back === true;
  const showMiddleToggle = config?.has_middle === true;
  const viewToggleOptions: Array<{ id: "front" | "back" | "middle"; label: string }> = [
    { id: "front", label: "Frente" },
    ...(showBackToggle ? [{ id: "back" as const, label: "Verso" }] : []),
    ...(showMiddleToggle ? [{ id: "middle" as const, label: "Meio" }] : []),
  ];
  const showViewToggle = allowSideToggle && viewToggleOptions.length > 1;

  // Os motores leem `text`, `image` e `template` — chaves fixas — e a
  // vitrine guarda tudo por id de campo. Sem esta tradução a caneca 3D
  // girava VAZIA com o nome digitado e a foto enviada (visto na loja da
  // Sheid em 04/09/2026). A cor e a fonte da arte seguem a mesma regra
  // do preview SVG: escolha do cliente, depois paleta da lojista.
  // A peça pela spec do 3D (a caneca é torneada; o GLB, por ora, é a
  // camiseta); sem 3D, a que a página disse.
  const pecaDoMotor = tpl?.kind === "model3d" && tpl.spec
    ? ((tpl.spec as any).model?.kind === "glb" ? "camiseta" : "caneca")
    : peca || null;
  const motor = valoresDoMotor(config, safeValues, viewId, {
    peca: pecaDoMotor,
    arquivo: (u) => medidaDoArquivo(u) || pixelsConhecidos(u),
    ...(edicao?.extras || {}),
  });
  // QA 28/09 (CL-26): o canvas desenha com a fonte que houver. Enquanto a
  // fonte da arte não chega, o 3D recebe a peça sem o texto (e não o texto
  // numa serifada que depois "vira" cursiva sozinha); o 2D espera dentro
  // da composição (fonteDaArte.ts). Com a formatação da arte cada texto
  // pode ter a sua fonte: espera todas.
  const fontesDaArte = Array.from(new Set([motor.font, ...motor.arte.textos.map((x) => x.fonte)])).join("\n");
  const [fontePronta, setFontePronta] = useState(() => fontesDaArte.split("\n").every((f) => esperarFonteDaArte(f) === null));
  useEffect(() => {
    const esperas = fontesDaArte.split("\n").map((f) => esperarFonteDaArte(f)).filter(Boolean) as Promise<unknown>[];
    if (!esperas.length) { setFontePronta(true); return; }
    let vivo = true;
    setFontePronta(false);
    Promise.all(esperas).then(() => { if (vivo) setFontePronta(true); });
    return () => { vivo = false; };
  }, [fontesDaArte]);
  const safeValuesKey = JSON.stringify([motor.values, motor.artColor, motor.font, motor.arte, fontePronta]);
  // Identidade estável: o viewer 3D repinta a textura a cada objeto novo
  // que recebe, e um objeto novo por render era uma repintura por render.
  // A arte inteira do lado vai junto (`__arte`): é o que o pintor único
  // desenha, com todos os textos e imagens e o ajuste da cliente.
  const engineValues = useMemo(
    () => (fontePronta
      ? valoresComArte(motor)
      : valoresComArte({ values: { ...motor.values, text: undefined }, arte: { ...motor.arte, textos: [] } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeValuesKey],
  );
  const tipoDoMotor: "3d" | "2d" | "svg" = tpl?.kind === "model3d" && tpl.spec ? "3d" : engineView ? "2d" : "svg";
  const onMotorRef = useRef(onMotor);
  onMotorRef.current = onMotor;
  useEffect(() => { onMotorRef.current?.(tipoDoMotor); }, [tipoDoMotor]);
  const arraste = edicao?.arraste || null;
  const editando = !!edicao?.editando;

  // 2D: o ponteiro no canvas vira fração da área da vista (retângulo ou
  // quad da foto) e vai para o editor; fora da área, nada acontece.
  const areaDaVista = engineView?.areas?.[0] || null;
  useEffect(() => {
    if (!areaDaVista || !edicao?.informarMotor) return;
    const areaCm = areaDaVista.width_cm > 0 && areaDaVista.height_cm > 0 ? { w: areaDaVista.width_cm, h: areaDaVista.height_cm } : null;
    const r = areaDaVista.rect;
    edicao.informarMotor(areaCm, r && r.w > 0 ? r.h / r.w : 1);
  });
  function pontoDoCanvas(e: any): PontoDaSuperficie | null {
    const cv = canvasRef.current;
    if (!cv || !engineView || !areaDaVista || typeof cv.getBoundingClientRect !== "function") return null;
    const r = cv.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    const x = ((e.clientX - r.left) / r.width) * engineView.base.w;
    const y = ((e.clientY - r.top) / r.height) * engineView.base.h;
    const p = pontoNaAreaDaVista(areaDaVista, x, y);
    return p ? { ...p, pxPorU: p.larguraNaVista * (r.width / engineView.base.w) } : null;
  }
  const arrastandoNo2D = useRef(false);
  const eventosDo2D: any = arraste && Platform.OS === "web" ? {
    onPointerDown: (e: any) => {
      if (arrastandoNo2D.current || arraste.tocar(pontoDoCanvas(e), e)) {
        arrastandoNo2D.current = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        e.preventDefault?.();
      }
    },
    onPointerMove: (e: any) => { if (arrastandoNo2D.current) arraste.mover(pontoDoCanvas(e), e); },
    onPointerUp: (e: any) => { if (arrastandoNo2D.current) arrastandoNo2D.current = arraste.soltar(e); },
    onPointerCancel: (e: any) => { if (arrastandoNo2D.current) arrastandoNo2D.current = arraste.soltar(e); },
  } : {};

  // O lado escolhido pode sumir se a lojista desligar verso/meio com a
  // tela aberta — sem isso o cliente ficaria preso numa vista morta.
  useEffect(() => {
    if (viewId === "back" && !showBackToggle) setViewId("front");
    if (viewId === "middle" && !showMiddleToggle) setViewId("front");
  }, [viewId, showBackToggle, showMiddleToggle]);

  const viewToggle = showViewToggle ? (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {viewToggleOptions.map(({ id, label }) => {
        const sel = viewId === id;
        return (
          <Pressable
            key={id}
            onPress={() => setViewId(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }} aria-selected={sel}
            accessibilityLabel={"Ver " + label}
            hitSlop={8}
            style={{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
              backgroundColor: sel ? T.primary : "transparent",
              borderWidth: 1.5, borderColor: sel ? T.primary : T.border,
            }}
          >
            <Texto style={{ fontSize: 11.5, fontWeight: "700", color: sel ? T.sobrePrimary : T.ink3 }}>
              {label}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  useEffect(() => {
    if (!engineView || !canvasRef.current) return;
    let vivo = true;
    const compor = () => {
      if (!vivo || !canvasRef.current) return;
      // A arte inteira do lado (`__arte`) — o 2D espera as fontes aqui, então
      // recebe os textos já com elas carregadas.
      composeView(canvasRef.current, engineView, valoresComArte(motor), {
        showAreas: false,
        pixelWidth: 800,
        // A camiseta vetorial ficava bege com "preto" escolhido: a cor só
        // chegava ao 3D. Agora o 2D recebe a mesma cor (e inverte as dobras
        // quando ela é escura — ver dobrasParaCor).
        garmentColor: corDaPeca(config, safeValues),
        artColor: motor.artColor,
        font: motor.font,
      }).then((r) => {
        // null = passada para trás por uma composição mais nova.
        if (vivo && r) setNotaDoMotor(notaDaComposicao(r));
      }).catch(() => undefined);
    };
    // A fonte da arte primeiro (CL-26): desenhar antes dela é desenhar
    // numa serifada que troca na próxima composição.
    const esperas = motor.arte.textos.length || motor.values.text
      ? (fontesDaArte.split("\n").map((f) => esperarFonteDaArte(f)).filter(Boolean) as Promise<unknown>[])
      : [];
    if (esperas.length) Promise.all(esperas).then(compor);
    else compor();
    return () => { vivo = false; };
    // safeValuesKey representa safeValues de forma estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineView, safeValuesKey]);

  // ── F4: template 3D (caneca) ───────────────────────────
  if (tpl?.kind === "model3d" && tpl.spec) {
    return (
      <View style={{ alignItems: "center", gap: 6 }}>
        {viewToggle}
        <Mug3DPreview
          spec={tpl.spec}
          values={engineValues}
          size={size}
          side={viewId}
          // O lado é da página (prop `lado`): o palco tem o próprio
          // Frente · Verso, com a medida do cadastro da peça.
          semSeletorDeArea={lado !== undefined}
          backdrop={fundo}
          cenario={cenario}
          accentColor={T.primary}
          // S3 — a cor da louca vinha do default do motor (#F5F2EA) e
          // ninguem a alimentava: toda caneca renderizava bege, qualquer
          // que fosse a cor escolhida. O parametro existia desde a F4.
          garmentColor={corDaPeca(config, safeValues)}
          artColor={motor.artColor}
          font={motor.font}
          giroAutomatico={giroAutomatico}
          arraste={arraste}
          editando={editando}
        />
        {pdfField && <PdfNote size={size} />}
      </View>
    );
  }

  // ── F3: template 2D (foto/vetor + arte real do cliente) ──────
  if (engineView) {
    const h = Math.round(size * (engineView.base.h / engineView.base.w));
    return (
      <View style={{ alignItems: "center", gap: 6 }}>
        {viewToggle}
        <View style={{ width: size, height: h, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: T.border }}>
          {/* @ts-ignore — canvas DOM no web (motor compose2d) */}
          <canvas
            ref={canvasRef}
            {...eventosDo2D}
            style={{ width: "100%", height: "100%", display: "block", touchAction: editando ? "none" : "auto", cursor: editando ? "move" : "default" } as any}
          />
        </View>
        {notaDoMotor ? (
          <Texto testID="nota-do-motor" style={{ fontSize: 11.5, color: T.ink3, textAlign: "center", maxWidth: size }}>
            {notaDoMotor}
          </Texto>
        ) : null}
        {pdfField && <PdfNote size={size} />}
      </View>
    );
  }

  // ── Fallback: comportamento antigo (SVG) ────────────────────
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      {viewToggle}
      <SvgEditavel config={config} lado={viewId} size={size} arraste={arraste} editando={editando} informarMotor={edicao?.informarMotor}>
      <PersonalizationPreviewBase
        config={config}
        values={safeValues}
        arte={motor.arte}
        side={viewId}
        fotoProduto={fotoProduto}
        size={size}
        productName={productName}
        showLabel={showLabel}
        t={paletaDoPreview(T)}
      />
      </SvgEditavel>
      {pdfField && <PdfNote size={size} />}
    </View>
  );
}

/**
 * A prévia sem motor (SVG) também aceita o arraste: a área desenhada é a
 * do próprio produto, em proporção, então o ponteiro vira fração dela.
 */
function SvgEditavel({
  config, lado, size, arraste, editando, informarMotor, children,
}: {
  config: CustomizationConfig | null;
  lado: "front" | "back" | "middle";
  size: number;
  arraste: ArrasteDaSuperficie | null;
  editando: boolean;
  informarMotor?: (areaCm: { w: number; h: number } | null, aspecto: number) => void;
  children: any;
}) {
  const area = config ? areaNoSvg(config, lado) : null;
  useEffect(() => {
    if (area && informarMotor) informarMotor(area.cm, area.h / area.w);
  });
  const ativo = useRef(false);
  if (!arraste || !area || Platform.OS !== "web") return children;
  const ponto = (e: any): PontoDaSuperficie | null => {
    const r = e.currentTarget?.getBoundingClientRect?.();
    if (!r || !(r.width > 0)) return null;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return { u: (x - area.x) / area.w, v: (y - area.y) / area.h, aspecto: area.h / area.w, areaCm: area.cm, pxPorU: (area.w / 100) * r.width };
  };
  const ev: any = {
    onPointerDown: (e: any) => {
      if (ativo.current || arraste.tocar(ponto(e), e)) {
        ativo.current = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        e.preventDefault?.();
      }
    },
    onPointerMove: (e: any) => { if (ativo.current) arraste.mover(ponto(e), e); },
    onPointerUp: (e: any) => { if (ativo.current) ativo.current = arraste.soltar(e); },
    onPointerCancel: (e: any) => { if (ativo.current) ativo.current = arraste.soltar(e); },
  };
  return (
    <View style={{ width: size, height: size, touchAction: editando ? "none" : "auto", cursor: editando ? "move" : "default" } as any} {...ev}>
      {children}
    </View>
  );
}

/** Tamanho padrão para o configurador (responsivo) */
export function defaultConfiguratorSize(): number {
  return Math.min(320, Platform.OS === "web" ? 320 : 280);
}
