// ============================================================
// components/studio/orcamentoModal/PalcoDaPeca.tsx
//
// O palco 3D da peça do orçamento (29/09/2026): a prévia ao vivo, grande
// e girando, que é o que vai no vídeo de 7 s. O mesmo motor do vídeo
// (createModelViewer, cenário estúdio) com TODAS as artes da peça na
// textura (`__artePorArea`, de artesPorLado.motorDasArtes).
//
// Fica à parte do Mug3DPreview da vitrine de propósito: aqui o canvas
// ocupa a largura do palco, sem os chips de área nem a legenda, e a peça
// vira para um lado quando a lojista escolhe um cartão (`vista`). A
// vitrine segue igual.
//
// Arte livre (29/09/2026): com `painel` e `arraste`, arrastar sobre a
// arte move a arte no painel inteiro do lado (raycast → UV, o mesmo
// pontoNaArea do editor da vitrine, #1003); fora dela, a peça gira. O
// `apiRef` tira a prévia da peça (a foto que vai para a ficha).
//
// Web-only (WebGL). No nativo, quem chama nem monta.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Platform } from "react-native";
import type { VisualTemplateSpec } from "@/services/studioVisualApi";
import { createModelViewer, type Mug3DHandle, type Mug3DOptions, type ArrasteDaPeca } from "@/components/studio/visualEngine/compose3dMug";
import type { UvDoPainel } from "@/components/studio/visualEngine/painelDaPeca";

export type VistaDoPalco = {
  /** Área para virar de frente (null = girar sozinha). */
  area: string | null;
  /** Muda a cada pedido, para virar de novo para a mesma área. */
  n: number;
};

/** O toque no painel da arte livre: centro em fração do painel; `pxPorU` = pixels de tela por 1,0 de u. */
export type ToqueNoPainel = { u: number; v: number; pxPorU: number | null };

/** Arraste da arte livre: `tocar` devolve true quando o toque é da arte (senão a peça gira). */
export type ArrasteNoPainel = {
  tocar: (p: ToqueNoPainel | null, e: PointerEvent) => boolean;
  mover: (p: ToqueNoPainel | null, e: PointerEvent) => void;
  soltar: (e: PointerEvent) => boolean;
};

export type ApiDoPalco = {
  /** A peça como está na tela, pintada com `values` (sem as alças da edição), em PNG. */
  previa: (values: Record<string, any>, opts: Mug3DOptions) => Promise<string | null>;
};

type Props = {
  spec: VisualTemplateSpec;
  values: Record<string, any>;
  opts: Mug3DOptions;
  altura: number;
  vista: VistaDoPalco;
  /** O fundo da página (hex): o estúdio deriva a paleta do ciclorama dele. */
  backdrop?: string;
  /** Mensagem de erro, no tema de quem chama. */
  corDoErro?: string;
  /** Painel da arte livre em edição (UV) e o arraste dela; sem os dois, arrastar só gira. */
  painel?: UvDoPainel | null;
  arraste?: ArrasteNoPainel | null;
  apiRef?: React.MutableRefObject<ApiDoPalco | null>;
};

export function PalcoDaPeca({ spec, values, opts, altura, vista, backdrop, corDoErro = "#B91C1C", painel = null, arraste = null, apiRef }: Props) {
  const canvasRef = useRef<any>(null);
  const handleRef = useRef<Mug3DHandle | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Um canvas por spec: trocar de modelo no mesmo canvas abria um segundo
  // WebGLRenderer no mesmo elemento (ver Mug3DPreview).
  const specAnterior = useRef(spec);
  const geracao = useRef(0);
  if (specAnterior.current !== spec) {
    specAnterior.current = spec;
    geracao.current += 1;
  }

  const ultimo = useRef({ values, opts, vista });
  ultimo.current = { values, opts, vista };
  const livre = useRef({ painel, arraste });
  livre.current = { painel, arraste };

  // Uma ponte só por viewer: lê o painel e o arraste da vez, e mede o
  // toque no painel inteiro (não na área de impressão).
  function ponte(h: Mug3DHandle): ArrasteDaPeca {
    const ponto = (e: PointerEvent): ToqueNoPainel | null => {
      const pn = livre.current.painel;
      const p = pn ? h.pontoNaArea(e.clientX, e.clientY, undefined, pn) : null;
      return p ? { u: p.u, v: p.v, pxPorU: p.pxPorU } : null;
    };
    return {
      tocar: (_p, e) => { const a = livre.current.arraste; return a && livre.current.painel ? a.tocar(ponto(e), e) : false; },
      mover: (_p, e) => { livre.current.arraste?.mover(ponto(e), e); },
      soltar: (e) => (livre.current.arraste ? livre.current.arraste.soltar(e) : false),
    };
  }

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current) return;
    let cancelado = false;
    const inicial = ultimo.current;
    const cv = canvasRef.current as HTMLCanvasElement;
    createModelViewer(cv, spec, values, { ...opts, backdrop, cenario: "estudio" })
      .then((h) => {
        if (cancelado) { h.dispose(); return; }
        handleRef.current = h;
        setErro(null);
        const u = ultimo.current;
        if (u.values !== inicial.values || u.opts !== inicial.opts) h.update(u.values, u.opts);
        if (u.vista.area) h.mostrarArea(u.vista.area);
        h.definirArraste(ponte(h));
      })
      .catch((e) => setErro(e?.message || "Não deu para abrir o 3D"));
    // O palco acompanha a largura do modal (e a virada do celular).
    let obs: any = null;
    const RO = (globalThis as any).ResizeObserver;
    if (RO) {
      obs = new RO(() => handleRef.current?.resize());
      obs.observe(cv);
    }
    return () => {
      cancelado = true;
      if (obs) obs.disconnect();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // spec fixa por canvas; valores e vista chegam pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => { handleRef.current?.update(values, opts); }, [values, opts]);

  if (apiRef) {
    apiRef.current = {
      async previa(v, o) {
        const h = handleRef.current;
        if (!h) return null;
        await h.update(v, o);
        const png = h.snapshot();
        const u = ultimo.current;
        await h.update(u.values, u.opts);
        return png;
      },
    };
  }

  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    if (vista.area) h.mostrarArea(vista.area);
    else h.giroAutomatico(true);
  }, [vista.area, vista.n]);

  if (Platform.OS !== "web") return null;
  return (
    <View style={{ width: "100%", height: altura }}>
      {/* @ts-ignore — canvas DOM no web */}
      <canvas
        key={geracao.current}
        ref={canvasRef}
        aria-label="Prévia 3D da peça girando"
        style={{ width: "100%", height: altura, display: "block", cursor: painel && arraste ? "move" : "grab", touchAction: painel && arraste ? "none" : "pan-y" } as any}
      />
      {erro ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: corDoErro, textAlign: "center" }}>{erro}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default PalcoDaPeca;
