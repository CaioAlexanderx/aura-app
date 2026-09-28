// ============================================================
// components/studio/mockupPorProduto/PreviaDoModelo.tsx
//
// O pré-visualizador da seção "Mockup por produto" (aba Aparência,
// 28/09/2026). Mostra o produto em foco com o modelo escolhido — ou com
// o modelo sob o cursor, antes de gravar — e a arte de exemplo "Helena".
//
// UM viewer 3D só: o primeiro modelo 3D cria o WebGLRenderer e os
// seguintes entram por `trocarPeca` na mesma cena. Passar o mouse por dez
// modelos não abre dez contextos WebGL (o navegador tem teto e derruba o
// mais velho). Quando a prévia mostra um 2D, o canvas 3D fica montado e
// escondido, pronto para a próxima peça. Enquanto o GLB carrega, a
// miniatura do modelo ocupa o quadro.
//
// Sem modelo, a precedência é a da vitrine (`fonteDoMockup`): Mockup na
// foto marcado pela lojista > foto do produto com a arte por cima > só a
// arte.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Image, Platform } from "react-native";
import { router } from "expo-router";
import type { VisualTemplate, VisualTemplateSpec, VisualView } from "@/services/studioVisualApi";
import { createModelViewer, type Mug3DHandle } from "@/components/studio/visualEngine/compose3dMug";
import { composeView } from "@/components/studio/visualEngine/compose2d";
import { fonteDoMockup, useSpecDaFotoDoProduto, vistaDoLado } from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { Icon } from "@/components/Icon";
import { MiniaturaDoModelo } from "./MiniaturaDoModelo";
import {
  abasDaPrevia, ARTE_DE_EXEMPLO, tipoDoModelo, type ProdutoDoMockup,
} from "./regras";

const COR_DA_ARTE = "#BE185D";
const WEB = Platform.OS === "web";

type Props = {
  produto: ProdutoDoMockup;
  /** O modelo mostrado: o atual, ou o que está sob o cursor no seletor. */
  template: VisualTemplate | null;
  /** undefined enquanto a spec chega. */
  spec: VisualTemplateSpec | null | undefined;
  /** O modelo mostrado ainda não foi gravado. */
  provisorio: boolean;
  /** Quadro preso no topo (tela estreita): mais baixo, com "Recolher". */
  compacto?: boolean;
  recolhida?: boolean;
  onRecolher?: () => void;
  /** A folha de baixo está aberta com a prévia dela: este quadro solta o WebGL. */
  pausar3D?: boolean;
  /** A versão dentro da folha de baixo: sem cabeçalho, quadro baixo. */
  naFolha?: boolean;
  T: any;
  testID?: string;
};

export function PreviaDoModelo({
  produto, template, spec, provisorio, compacto, recolhida, onRecolher, pausar3D, naFolha, T, testID,
}: Props) {
  const tipo = tipoDoModelo(template);
  const eh3D = tipo === "3D";
  const abas = useMemo(() => abasDaPrevia(template, spec), [template, spec]);
  const [area, setArea] = useState<string>(abas[0]?.id || "front");
  useEffect(() => { setArea(abas[0]?.id || "front"); }, [template?.key, abas]);

  // Sem modelo: o Mockup na foto que a lojista marcou, como na vitrine.
  const specDaFoto = useSpecDaFotoDoProduto(produto.customization_config);
  const fonte = template ? "modelo" : fonteDoMockup(null, specDaFoto) === "foto" ? "foto-marcada" : produto.foto ? "foto" : "sem-foto";

  // O 3D fica montado depois da primeira peça 3D (escondido nos 2D).
  const [usou3D, setUsou3D] = useState(false);
  useEffect(() => { if (eh3D && spec) setUsou3D(true); }, [eh3D, spec]);
  const ultimaSpec3D = useRef<VisualTemplateSpec | null>(null);
  if (eh3D && spec) ultimaSpec3D.current = spec;

  const altura = naFolha ? 168 : compacto ? 190 : 320;
  const topoDasAbas = abas.length > 1;

  const vista2D: VisualView | null = useMemo(() => {
    if (fonte === "modelo" && !eh3D && spec?.views?.length) {
      return spec.views.find((v) => v.id === area) || spec.views[0];
    }
    if (fonte === "foto-marcada") return vistaDoLado(specDaFoto, "front");
    return null;
  }, [fonte, eh3D, spec, area, specDaFoto]);

  const carregandoSpec = !!template && spec === undefined;

  let nota: React.ReactNode = null;
  let notaGenerica = false;
  const naFoto = fonteDoMockup(null, specDaFoto) === "foto";
  if (template) {
    nota = eh3D
      ? "A cliente vê a arte dela nesta peça e gira para conferir antes de pagar."
      : "A arte da cliente aparece na foto de estúdio da peça, sem girar.";
    if (naFoto) nota += " Com um modelo escolhido, ele passa na frente do Mockup na foto que você marcou.";
    notaGenerica = !naFoto && !!produto.foto;
  } else if (fonte === "foto-marcada") {
    nota = "Sem modelo da Aura, vale o Mockup na foto que você marcou na aba Personalização do produto.";
  } else if (fonte === "foto") {
    nota = "Sem modelo, a cliente vê a foto do produto com a arte por cima, sem girar.";
  } else {
    nota = (
      <>
        Este produto ainda não tem foto. Sem foto e sem modelo, a cliente vê só a arte numa prévia plana.{" "}
        <Text
          accessibilityRole="link"
          onPress={() => router.push(("/studio/estoque?action=edit-product&id=" + produto.id) as any)}
          style={{ color: T.infoInk, fontWeight: "700" }}
        >
          Adicionar foto no Estoque →
        </Text>
      </>
    );
  }

  const linhaDoModelo = (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: naFolha ? 0 : 4 }}>
      {template ? <Tag T={T} texto={tipo || ""} /> : fonte === "foto-marcada" ? <Tag T={T} texto="FOTO" acento /> : null}
      <Text style={{ fontSize: 12.5, color: T.ink2 }} testID="previa-modelo">
        {template ? template.name : fonte === "foto-marcada" ? "Mockup na foto" : "Sem mockup"}
      </Text>
      {provisorio ? (
        <View style={{ backgroundColor: T.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.accentInk }} testID="previa-provisoria">
            {naFolha ? "Ainda não salvo" : "Prévia, ainda não salvo"}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // As abas ficam FORA do quadro: por cima da cena elas cobriam a boca da
  // caneca no quadro baixo do celular (a câmera da caneca enquadra pela altura).
  const barraDeAbas = topoDasAbas ? (
    <View
      role="tablist"
      aria-label="Área da arte"
      style={{
        marginTop: naFolha ? 0 : compacto ? 8 : 12, alignSelf: "center", flexDirection: "row", gap: 2, padding: 3,
        borderRadius: 999, backgroundColor: T.bgSoft, maxWidth: "100%",
      }}
    >
      {abas.map((a) => {
        const sel = a.id === area;
        return (
          <Pressable
            key={a.id}
            role="tab"
            aria-selected={sel}
            onPress={() => setArea(a.id)}
            testID={"previa-aba-" + a.id}
            style={{
              minHeight: compacto || naFolha ? 44 : 32, justifyContent: "center",
              paddingHorizontal: 12, borderRadius: 999, backgroundColor: sel ? T.primary : "transparent",
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: sel ? "#fff" : T.ink3 }}>{a.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  const palco = (
    <View
      style={{
        marginTop: naFolha ? 0 : compacto ? 8 : 10, borderRadius: 12, overflow: "hidden",
        backgroundColor: T.bgSoft, height: altura, position: "relative",
      }}
    >
      {/* 3D: um só viewer, montado na primeira peça 3D e mantido. */}
      {WEB && usou3D && !pausar3D ? (
        <Palco3D
          spec={ultimaSpec3D.current}
          area={area}
          altura={altura}
          visivel={eh3D && !!spec}
          template={template}
          T={T}
        />
      ) : null}

      {!eh3D && vista2D && WEB ? <Palco2D view={vista2D} altura={altura} /> : null}

      {!template && fonte === "foto" && produto.foto ? (
        <FotoComArte uri={produto.foto} T={T} />
      ) : null}
      {!template && fonte === "sem-foto" ? <SoArte T={T} /> : null}
      {/* Modelo cuja spec não veio (rede, modelo arquivado): a arte plana, nunca um quadro vazio. */}
      {template && !carregandoSpec && (spec === null || (!eh3D && !vista2D)) ? <SoArte T={T} /> : null}

      {carregandoSpec || (eh3D && pausar3D) ? (
        <Carregando template={template} spec={spec} T={T} texto={pausar3D ? "" : "Carregando o modelo…"} />
      ) : null}


      {eh3D && !!spec && !pausar3D ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", bottom: 6, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5,
            backgroundColor: T.paperCardElev, opacity: 0.92, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
          }}
        >
          <Icon name="rotate_ccw" size={12} color={T.ink2} />
          <Text style={{ fontSize: 11, color: T.ink2 }}>Arraste para girar</Text>
        </View>
      ) : null}
    </View>
  );

  if (naFolha) {
    return (
      <View testID={testID} style={{ gap: 8 }}>
        {barraDeAbas}
        {palco}
        {linhaDoModelo}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: T.paperCardElev, borderWidth: 1, borderColor: T.ink5, borderRadius: 16,
        padding: compacto ? 10 : 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: T.ink3 }}>PRÉVIA NA LOJA</Text>
          <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "700", color: T.ink, marginTop: 2 }} testID="previa-produto">
            {produto.name}
          </Text>
          <View aria-live="polite">{linhaDoModelo}</View>
        </View>
        {compacto && onRecolher ? (
          <Pressable
            onPress={onRecolher}
            accessibilityRole="button"
            aria-expanded={!recolhida}
            testID="previa-recolher"
            style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: "center", marginTop: -6, marginRight: -4 }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: T.infoInk }}>{recolhida ? "Mostrar" : "Recolher"}</Text>
          </Pressable>
        ) : null}
      </View>

      {recolhida ? null : barraDeAbas}
      {recolhida ? null : palco}

      {!recolhida && !compacto ? (
        <Text style={{ marginTop: 8, fontSize: 11.5, color: T.ink3, textAlign: "center" }}>Arte de exemplo: Helena</Text>
      ) : null}
      {!recolhida && !(compacto && notaGenerica) ? (
        <Text style={{ marginTop: compacto ? 6 : 10, fontSize: compacto ? 12 : 12.5, lineHeight: compacto ? 17 : 18, color: T.ink2 }} testID="previa-nota">
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

function Tag({ texto, acento, T }: { texto: string; acento?: boolean; T: any }) {
  return (
    <View style={{ borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: acento ? T.accentSoft : T.primarySoft }}>
      <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 0.4, color: acento ? T.accentInk : T.infoInk }}>{texto}</Text>
    </View>
  );
}

function Carregando({ template, spec, texto, T }: { template: VisualTemplate | null; spec: any; texto: string; T: any }) {
  return (
    <View
      style={{
        position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center",
        gap: 8, backgroundColor: T.bgSoft,
      }}
      testID="previa-carregando"
    >
      <MiniaturaDoModelo template={template} spec={spec} largura={120} altura={92} T={T} />
      {texto ? <Text style={{ fontSize: 12, color: T.ink3 }}>{texto}</Text> : null}
    </View>
  );
}

/** Sem modelo e com foto: a foto do produto e a arte chapada por cima. */
function FotoComArte({ uri, T }: { uri: string; T: any }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: T.accent, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 24, color: COR_DA_ARTE }}>Helena</Text>
        </View>
      </View>
    </View>
  );
}

/** Nem foto nem modelo: só a arte, numa prévia plana. */
function SoArte({ T }: { T: any }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: "70%", aspectRatio: 1.6, maxHeight: "70%", borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed",
          borderColor: T.ink4, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 28, color: COR_DA_ARTE }}>Helena</Text>
      </View>
    </View>
  );
}

/** 2D: o motor de sempre (composeView), com a arte de exemplo. */
function Palco2D({ view, altura }: { view: VisualView; altura: number }) {
  const cv = useRef<any>(null);
  useEffect(() => {
    if (!cv.current) return;
    composeView(cv.current, view, ARTE_DE_EXEMPLO, { showAreas: false, pixelWidth: 900, artColor: COR_DA_ARTE, backdrop: null })
      .catch(() => {});
  }, [view]);
  return React.createElement("canvas", {
    ref: cv,
    "data-testid": "previa-2d",
    style: { width: "100%", height: altura, display: "block", objectFit: "contain" },
  });
}

/** A área pedida, se a peça tiver; senão a primeira dela. */
function areaDaSpec(spec: VisualTemplateSpec, area: string): string | undefined {
  const areas = spec.areas || [];
  return (areas.find((a) => a.id === area) || areas[0])?.id;
}

/**
 * O viewer 3D único. `spec` é a peça desejada; as trocas são feitas em
 * série e só a última pedida é aplicada (quem atravessa a lista com o
 * mouse vê o modelo onde parou, não cada um pelo caminho).
 */
function Palco3D({
  spec, area, altura, visivel, template, T,
}: {
  spec: VisualTemplateSpec | null; area: string; altura: number; visivel: boolean; template: VisualTemplate | null; T: any;
}) {
  const cv = useRef<any>(null);
  const handle = useRef<Mug3DHandle | null>(null);
  const desejada = useRef<VisualTemplateSpec | null>(null);
  const aplicada = useRef<VisualTemplateSpec | null>(null);
  const ocupado = useRef(false);
  const vivo = useRef(true);
  const areaRef = useRef(area);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  const sincronizar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      while (vivo.current && desejada.current && desejada.current !== aplicada.current) {
        const alvo = desejada.current;
        const opcoes = { areaId: areaDaSpec(alvo, areaRef.current), artColor: COR_DA_ARTE };
        if (!handle.current) {
          if (!cv.current) break;
          const h = await createModelViewer(cv.current, alvo, ARTE_DE_EXEMPLO, opcoes);
          if (!vivo.current) { h.dispose(); return; }
          handle.current = h;
        } else {
          await handle.current.trocarPeca(alvo, ARTE_DE_EXEMPLO, opcoes);
        }
        aplicada.current = alvo;
      }
      if (vivo.current) { setErro(false); setCarregando(false); }
    } catch (_e) {
      aplicada.current = desejada.current;
      if (vivo.current) { setErro(true); setCarregando(false); }
    } finally {
      ocupado.current = false;
    }
    if (vivo.current && desejada.current && desejada.current !== aplicada.current) sincronizar();
  }, []);

  useEffect(() => {
    if (!spec) return;
    desejada.current = spec;
    if (spec !== aplicada.current) {
      setCarregando(true);
      setErro(false);
      sincronizar();
    }
  }, [spec, sincronizar]);

  useEffect(() => {
    areaRef.current = area;
    const h = handle.current, s = aplicada.current;
    if (h && s && s === desejada.current) h.update(ARTE_DE_EXEMPLO, { areaId: areaDaSpec(s, area) });
  }, [area]);

  useEffect(() => { if (visivel) handle.current?.resize(); }, [visivel, altura]);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: visivel ? "flex" : "none" }}>
      {React.createElement("canvas", {
        ref: cv,
        "data-testid": "previa-3d",
        "aria-label": template ? "Prévia 3D de " + template.name + " com a arte de exemplo. Arraste para girar." : "Prévia 3D",
        role: "img",
        // pan-y: arrastar na vertical rola a página (o quadro fica preso no
        // topo no celular); na horizontal, gira a peça.
        style: { width: "100%", height: altura, display: "block", cursor: "grab", touchAction: "pan-y" },
      })}
      {carregando || erro ? (
        <View
          style={{
            position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center",
            gap: 8, backgroundColor: T.bgSoft,
          }}
        >
          <MiniaturaDoModelo template={template} spec={spec} largura={120} altura={92} T={T} />
          <Text style={{ fontSize: 12, color: T.ink3 }}>{erro ? "Não foi possível abrir o 3D agora." : "Carregando o modelo…"}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default PreviaDoModelo;
