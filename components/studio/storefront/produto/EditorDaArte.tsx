// ============================================================
// components/studio/storefront/produto/EditorDaArte.tsx
//
// "Ajustar a arte" na página da peça (28/09/2026). Decisão do PO: a
// cliente arrasta DIRETO NA PEÇA — na caneca e na camiseta 3D, e no
// plano do 2D (template de foto e "Mockup na foto"). Arrastar sobre a
// arte ou a área de impressão move a arte; fora dela, gira a peça. A
// alça do canto (ou a pinça) muda o tamanho. Botões de 44 px e o
// teclado fazem tudo sem gesto.
//
// O que é regra (onde cai, quanto mede, DPI, avisos) mora em
// visualEngine/layoutDaArte; aqui só o estado da edição e os controles.
// O ajuste vai para o pedido em `<campo>_ajuste`, completo (frações,
// retrato em cm, pixels do arquivo e DPI) a cada mudança — a ficha de
// produção lê dali.
//
// Diagnóstico e mockup aprovado:
//   docs/studio/formatacao-da-arte-diagnostico.md
//   docs/mockups/studio-formatacao-da-arte.html
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import type { CustomizationConfig } from "../types";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { wash } from "../theme";
import { Icon } from "@/components/Icon";
import { arteDoLado, type ExtrasDaArte } from "../valoresDoMotor";
import {
  resolverArte, unidadeDaArea, comAreaDoMotor, ajusteDoItem, avisosDaArte, larguraDoEncaixe,
  margemDaArea, moverAjuste, escalarAjuste, girarAjuste, grudarNoCentro, itemNoPonto, caixaDoItem,
  pontoNaAreaDaArte, altDoTamanho, textoDasMedidas,
  type Ajuste, type ArteDoLado, type AvisoDaArte, type ItemDaArte, type Tamanho,
} from "@/components/studio/visualEngine/layoutDaArte";
import { medidaDoArquivo } from "./EnvioDaArte";
import { fundoBrancoConhecido, medidorDaVitrine, pixelsConhecidos, useVersaoDasMedidas } from "./medidasDaArte";
import { borda2, transicao } from "./kitDaPagina";
import { nitidezDoItem, SeloDeNitidez } from "./nitidezDaArte";
export { nitidezDoItem, SeloDeNitidez };
import type { Lado } from "./regrasDaPagina";

/** O ponteiro na área do motor (3D: raycast; 2D: vista). */
export type PontoDaSuperficie = {
  u: number; v: number;
  /** Altura ÷ largura do retângulo da área no motor. */
  aspecto: number;
  areaCm: { w: number; h: number } | null;
  /** 3D: a área do produto pode passar do retângulo do modelo. */
  transborda?: boolean;
  /** 3D (caneca): pixel não quadrado na peça. */
  pixel?: number | null;
  /** Pixels de TELA para 1,0 de u no ponto tocado (a folga do toque é em pixels, não em cm). */
  pxPorU?: number | null;
};

/** O contrato que o 3D (ArrasteDaPeca) e o 2D recebem. */
export type ArrasteDaSuperficie = {
  tocar: (p: PontoDaSuperficie | null, e: { pointerId: number }) => boolean;
  mover: (p: PontoDaSuperficie | null, e: { pointerId: number }) => void;
  soltar: (e: { pointerId: number }) => boolean;
};

export type Direcao = "esquerda" | "direita" | "cima" | "baixo";

/** Chave de sessão do "Girar sozinha" (lembrado entre produtos, na aba). */
const CHAVE_DO_GIRO = "aura.vitrine.giroAutomatico";

export function useGiroAutomatico(): [boolean, (v: boolean) => void] {
  const [ligado, setLigado] = useState<boolean>(() => {
    try {
      const v = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(CHAVE_DO_GIRO) : null;
      return v == null ? true : v === "1";
    } catch { return true; }
  });
  const trocar = (v: boolean) => {
    setLigado(v);
    try { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(CHAVE_DO_GIRO, v ? "1" : "0"); } catch { /* aba privada */ }
  };
  return [ligado, trocar];
}

function arquivoDe(url: string) {
  return medidaDoArquivo(url) || pixelsConhecidos(url);
}

type Motor = { areaCm: { w: number; h: number } | null; aspecto: number };

type Estado = {
  arte: ArteDoLado;
  itens: ItemDaArte[];
  W: number; H: number; emCm: boolean;
};

export type EditorDaArte = {
  editando: boolean;
  abrir: () => void;
  fechar: () => void;
  temConteudo: boolean;
  sel: string | null;
  selecionar: (campo: string) => void;
  /** Para valoresDoMotor: guias, edição e seleção. */
  extras: ExtrasDaArte;
  /** Só existe editando. */
  arraste: ArrasteDaSuperficie | null;
  itens: ItemDaArte[];
  alvo: ItemDaArte | null;
  W: number; H: number; emCm: boolean;
  avisos: AvisoDaArte[];
  informarMotor: (areaCm: { w: number; h: number } | null, aspecto: number) => void;
  mover: (d: Direcao, passo?: number) => void;
  escalar: (fator: number) => void;
  girar: () => void;
  encaixar: (modo: "ajustar" | "preencher" | "centralizar") => void;
  /** P/M/G do texto (o selecionado, ou o campo dado). */
  tamanho: (t: Tamanho, campo?: string) => void;
  recomecar: () => void;
  corrigir: (a: AvisoDaArte) => void;
  /** Teclado (web): setas movem, Shift acelera, + e − mudam o tamanho, R gira. */
  tecla: (e: { key: string; shiftKey?: boolean; preventDefault?: () => void }) => void;
};

export function useEditorDaArte({
  cfg, values, lado, setValor, peca, mostrarArea,
}: {
  cfg: CustomizationConfig | null;
  values: Record<string, any>;
  lado: Lado;
  setValor: (id: string, v: any) => void;
  peca: string | null;
  /** "Área de impressão" ligada fora da edição. */
  mostrarArea: boolean;
}): EditorDaArte {
  const versao = useVersaoDasMedidas();
  const [editando, setEditando] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const motor = useRef<Motor>({ areaCm: null, aspecto: 1 });
  // Ajustes ainda não refletidos em `values` (o estado da vitrine é
  // assíncrono; sem isto o próximo movimento leria o valor velho e a
  // arte pularia de volta).
  const pendentes = useRef<Record<string, Ajuste>>({});
  const agendado = useRef<number | null>(null);

  const refs = useRef({ cfg, values, lado, setValor, peca, sel, editando });
  refs.current = { cfg, values, lado, setValor, peca, sel, editando };

  // O que já chegou em `values` sai da fila.
  for (const k of Object.keys(pendentes.current)) {
    if (values[k] === pendentes.current[k]) delete pendentes.current[k];
  }

  function estado(): Estado {
    const r = refs.current;
    const v = { ...r.values, ...pendentes.current };
    const arte = comAreaDoMotor(arteDoLado(r.cfg, v, r.lado, { peca: r.peca, arquivo: arquivoDe }), motor.current.areaCm);
    const { W, H, emCm } = unidadeDaArea(arte, { w: 1, h: motor.current.aspecto || 1 });
    return { arte, itens: resolverArte(arte, W, H, medidorDaVitrine(arquivoDe)), W, H, emCm };
  }

  function escrever(chave: string, aj: Ajuste) {
    pendentes.current[chave] = aj;
    if (agendado.current != null) return;
    const flush = () => {
      agendado.current = null;
      for (const [k, a] of Object.entries(pendentes.current)) refs.current.setValor(k, a);
    };
    // Um quadro (~16 ms) junta os movimentos do arraste. setTimeout e não
    // requestAnimationFrame: aba em segundo plano não roda quadro, e o
    // ajuste de um botão ficaria preso na fila.
    agendado.current = setTimeout(flush, 16) as any;
  }

  /** Grava o ajuste (frações) de um item, completando cm, pixels e DPI. */
  function gravar(campo: string, novo: Ajuste) {
    const e = estado();
    const trocar = <T extends { campo: string; ajuste: Ajuste | null }>(l: T[]) => l.map((x) => (x.campo === campo ? { ...x, ajuste: novo } : x));
    const arte2: ArteDoLado = { ...e.arte, imagens: trocar(e.arte.imagens), textos: trocar(e.arte.textos) };
    const it = resolverArte(arte2, e.W, e.H, medidorDaVitrine(arquivoDe)).find((i) => i.campo === campo);
    if (!it) return;
    escrever(`${campo}_ajuste`, ajusteDoItem(it, e.W, e.H, e.emCm));
  }

  function alvoDe(e: Estado): ItemDaArte | null {
    const s = refs.current.sel;
    return (s && e.itens.find((i) => i.campo === s)) || e.itens[0] || null;
  }

  function ajusteDe(it: ItemDaArte, e: Estado): Ajuste {
    return ajusteDoItem(it, e.W, e.H, e.emCm);
  }

  // ── Gestos ──────────────────────────────────────────────
  const gesto = useRef<{
    modo: "mover" | "escala" | "pinca" | null;
    campo: string | null;
    x0: number; y0: number; cx0: number; cy0: number;
    d0: number; aj0: Ajuste | null;
    ultimoToque: number;
  }>({ modo: null, campo: null, x0: 0, y0: 0, cx0: 0, cy0: 0, d0: 1, aj0: null, ultimoToque: 0 });
  const dedos = useRef(new Map<number, { x: number; y: number }>());

  const arraste = useMemo<ArrasteDaSuperficie>(() => ({
    tocar(p, ev) {
      if (!refs.current.editando || !p) return false;
      motor.current = { areaCm: p.areaCm, aspecto: p.aspecto || 1 };
      const e = estado();
      const pt = pontoNaAreaDaArte(p.u, p.v, e.arte, p.areaCm, p.aspecto || 1, !p.transborda, p.pixel);
      const g = gesto.current;
      // Segundo dedo: pinça sobre o item que o primeiro pegou.
      if (dedos.current.size >= 1 && g.campo) {
        dedos.current.set(ev.pointerId, { x: pt.x, y: pt.y });
        const [a, b] = Array.from(dedos.current.values());
        const it = e.itens.find((i) => i.campo === g.campo);
        if (it && a && b) {
          g.modo = "pinca"; g.d0 = Math.max(1e-6, Math.hypot(a.x - b.x, a.y - b.y)); g.aj0 = ajusteDe(it, e);
        }
        return true;
      }
      // A folga é de TELA: 22 px no mouse e 30 no dedo (alvo de ~44 px),
      // seja a peça grande ou pequena na página.
      const toque = (ev as any).pointerType === "touch";
      const folga = p.pxPorU && p.pxPorU > 0 ? ((toque ? 30 : 22) * pt.porU) / p.pxPorU : Math.min(e.W, e.H) * 0.04;
      const selecionado = alvoDe(e);
      // Alça do canto do item selecionado: tamanho.
      if (selecionado) {
        const c = caixaDoItem(selecionado);
        const cantos = [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]];
        // O miolo do item é sempre de mover: numa peça pequena na tela a
        // folga de 22 px cobre o item inteiro, e todo toque virava alça.
        const noMiolo = pt.x > c.x + c.w * 0.25 && pt.x < c.x + c.w * 0.75 && pt.y > c.y + c.h * 0.25 && pt.y < c.y + c.h * 0.75;
        if (!noMiolo && cantos.some(([x, y]) => Math.hypot(pt.x - x, pt.y - y) <= folga)) {
          dedos.current.set(ev.pointerId, { x: pt.x, y: pt.y });
          // Distância inicial com piso: perto do centro, um milímetro de
          // arraste não pode multiplicar o tamanho por dez.
          const d0 = Math.max(Math.hypot(pt.x - selecionado.cx, pt.y - selecionado.cy), Math.hypot(c.w, c.h) / 4, 1e-6);
          Object.assign(g, { modo: "escala", campo: selecionado.campo, cx0: selecionado.cx, cy0: selecionado.cy, d0, aj0: ajusteDe(selecionado, e) });
          return true;
        }
      }
      const tocado = itemNoPonto(e.itens, pt.x, pt.y, folga * 0.4);
      const naArea = pt.x >= 0 && pt.x <= e.W && pt.y >= 0 && pt.y <= e.H;
      if (!tocado && !naArea) return false;
      const it = tocado || selecionado;
      if (!it) return naArea;
      if (it.campo !== refs.current.sel) setSel(it.campo);
      dedos.current.set(ev.pointerId, { x: pt.x, y: pt.y });
      const agora = Date.now();
      // Dois toques: centraliza.
      if (tocado && agora - g.ultimoToque < 320 && g.campo === it.campo) {
        g.ultimoToque = 0;
        gravar(it.campo, { ...ajusteDe(it, e), cx: 0.5, cy: 0.5 });
        Object.assign(g, { modo: null });
        return true;
      }
      Object.assign(g, { modo: "mover", campo: it.campo, x0: pt.x, y0: pt.y, cx0: it.cx, cy0: it.cy, aj0: ajusteDe(it, e), ultimoToque: agora });
      return true;
    },
    mover(p, ev) {
      const g = gesto.current;
      if (!p || !g.modo || !g.campo || !g.aj0) return;
      const e = estado();
      const pt = pontoNaAreaDaArte(p.u, p.v, e.arte, p.areaCm, p.aspecto || 1, !p.transborda, p.pixel);
      if (dedos.current.has(ev.pointerId)) dedos.current.set(ev.pointerId, { x: pt.x, y: pt.y });
      if (g.modo === "pinca") {
        const [a, b] = Array.from(dedos.current.values());
        if (!a || !b) return;
        gravar(g.campo, escalarAjuste(g.aj0, Math.hypot(a.x - b.x, a.y - b.y) / g.d0));
        return;
      }
      if (g.modo === "escala") {
        gravar(g.campo, escalarAjuste(g.aj0, Math.hypot(pt.x - g.cx0, pt.y - g.cy0) / g.d0));
        return;
      }
      const s = grudarNoCentro(g.cx0 + pt.x - g.x0, g.cy0 + pt.y - g.y0, e.W, e.H, Math.min(e.W, e.H) * 0.03);
      gravar(g.campo, moverAjuste(g.aj0, s.cx - g.cx0, s.cy - g.cy0, e.W, e.H));
    },
    soltar(ev) {
      dedos.current.delete(ev.pointerId);
      const g = gesto.current;
      if (dedos.current.size === 0) { g.modo = null; return false; }
      // Sobrou um dedo depois da pinça: volta a mover a partir dele.
      if (g.modo === "pinca" && g.campo) {
        const e = estado();
        const it = e.itens.find((i) => i.campo === g.campo);
        const [a] = Array.from(dedos.current.values());
        if (it && a) Object.assign(g, { modo: "mover", x0: a.x, y0: a.y, cx0: it.cx, cy0: it.cy, aj0: ajusteDe(it, e) });
      }
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // ── Botões ──────────────────────────────────────────────
  function comAlvo(f: (it: ItemDaArte, e: Estado) => Ajuste | null) {
    const e = estado();
    const it = alvoDe(e);
    if (!it) return;
    const novo = f(it, e);
    if (novo) gravar(it.campo, novo);
  }
  const passoPadrao = () => { const e = estado(); return e.emCm ? 0.2 : Math.min(e.W, e.H) * 0.02; };
  const mover = (d: Direcao, passo?: number) => comAlvo((it, e) => {
    const p = passo ?? passoPadrao();
    return moverAjuste(ajusteDe(it, e), d === "esquerda" ? -p : d === "direita" ? p : 0, d === "cima" ? -p : d === "baixo" ? p : 0, e.W, e.H);
  });
  const escalar = (f: number) => comAlvo((it, e) => escalarAjuste(ajusteDe(it, e), f));
  const girar = () => comAlvo((it, e) => {
    const a = girarAjuste(ajusteDe(it, e));
    // Imagem encaixada continua encaixada depois de girar.
    if (it.tipo === "imagem" && (it.encaixe === "ajustar" || it.encaixe === "preencher")) {
      const asp = it.w > 0 ? it.h / it.w : 1;
      return { ...a, larg: larguraDoEncaixe(it.encaixe, asp, a.rot || 0, e.W, e.H, margemDaArea(e.W, e.H, e.emCm)), encaixe: it.encaixe, cx: 0.5, cy: 0.5 };
    }
    return a;
  });
  const encaixar = (modo: "ajustar" | "preencher" | "centralizar") => comAlvo((it, e) => {
    const a = ajusteDe(it, e);
    if (modo === "centralizar" || it.tipo !== "imagem") return { ...a, cx: 0.5, cy: 0.5 };
    const asp = it.w > 0 ? it.h / it.w : 1;
    return { ...a, cx: 0.5, cy: 0.5, larg: larguraDoEncaixe(modo, asp, it.rot, e.W, e.H, margemDaArea(e.W, e.H, e.emCm)), encaixe: modo };
  });
  const tamanho = (t: Tamanho, campo?: string) => {
    const e = estado();
    const it = campo ? e.itens.find((i) => i.campo === campo) : alvoDe(e);
    if (campo) refs.current.setValor(`${campo}_tam`, t);
    if (!it || it.tipo !== "texto") return;
    if (!campo) refs.current.setValor(`${it.campo}_tam`, t);
    // Sem ajuste, o tamanho basta (o layout padrão lê o P/M/G); com
    // ajuste, a altura da letra do ajuste acompanha.
    const temAjuste = !!(refs.current.values[`${it.campo}_ajuste`] || pendentes.current[`${it.campo}_ajuste`]);
    if (temAjuste) gravar(it.campo, { ...ajusteDe(it, e), alt: altDoTamanho(t, e.emCm ? e.H : null) });
  };
  const recomecar = () => {
    const e = estado();
    const it = alvoDe(e);
    if (!it) return;
    delete pendentes.current[`${it.campo}_ajuste`];
    refs.current.setValor(`${it.campo}_ajuste`, undefined);
  };
  const corrigir = (a: AvisoDaArte) => {
    const e = estado();
    const it = e.itens.find((i) => i.campo === a.campo);
    if (!it) return;
    setSel(it.campo);
    const aj = ajusteDe(it, e);
    if (a.tipo === "nitidez" && it.tipo === "imagem") {
      const larg = Math.min(aj.larg || 1, a.nitidaAteCm / e.W);
      return gravar(it.campo, afastar({ ...aj, larg, encaixe: "livre" }, it, e, larg));
    }
    if (a.tipo === "cortada" && it.tipo === "imagem" && (it.bw > e.W || it.bh > e.H)) {
      const asp = it.w > 0 ? it.h / it.w : 1;
      return gravar(it.campo, { ...aj, cx: 0.5, cy: 0.5, larg: larguraDoEncaixe("ajustar", asp, it.rot, e.W, e.H, margemDaArea(e.W, e.H, e.emCm)), encaixe: "ajustar" });
    }
    gravar(it.campo, afastar(aj, it, e));
  };
  const tecla = (ev: { key: string; shiftKey?: boolean; preventDefault?: () => void }) => {
    if (!refs.current.editando) return;
    const p = ev.shiftKey ? passoPadrao() * 10 : passoPadrao();
    const mapa: Record<string, Direcao> = { ArrowLeft: "esquerda", ArrowRight: "direita", ArrowUp: "cima", ArrowDown: "baixo" };
    if (mapa[ev.key]) { ev.preventDefault?.(); mover(mapa[ev.key], p); }
    else if (ev.key === "+" || ev.key === "=") { ev.preventDefault?.(); escalar(1.05); }
    else if (ev.key === "-" || ev.key === "_") { ev.preventDefault?.(); escalar(1 / 1.05); }
    else if (ev.key === "r" || ev.key === "R") { ev.preventDefault?.(); girar(); }
  };

  const e = useMemo(estado, [cfg, values, lado, peca, versao, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const alvo = alvoDe(e);
  // DTF imprime o fundo branco da arte (sublimação não): aviso, sem trava.
  const avisos: AvisoDaArte[] = [
    ...avisosDaArte(e.itens, e.W, e.H, e.emCm),
    ...(e.arte.tecnica === "dtf"
      ? e.itens.filter((i) => i.tipo === "imagem" && fundoBrancoConhecido(i.url) === true).map((i) => ({ tipo: "fundo" as const, campo: i.campo }))
      : []),
  ];

  // Sem nada para ajustar (removeu a arte e apagou o texto), a edição fecha.
  const temConteudo = e.itens.length > 0;
  useEffect(() => { if (editando && !temConteudo) setEditando(false); }, [editando, temConteudo]);

  return {
    editando,
    abrir: () => { if (temConteudo) { setEditando(true); if (!refs.current.sel && e.itens[0]) setSel(e.itens[0].campo); } },
    fechar: () => setEditando(false),
    temConteudo,
    sel: alvo ? alvo.campo : null,
    selecionar: setSel,
    extras: { guias: editando || mostrarArea, editando, selecionado: editando && alvo ? alvo.campo : null },
    arraste: editando ? arraste : null,
    itens: e.itens,
    alvo,
    W: e.W, H: e.H, emCm: e.emCm,
    avisos,
    informarMotor: (areaCm, aspecto) => {
      const m = motor.current;
      const igual = m.aspecto === aspecto && (m.areaCm === areaCm || (m.areaCm && areaCm && m.areaCm.w === areaCm.w && m.areaCm.h === areaCm.h));
      if (!igual) motor.current = { areaCm, aspecto: aspecto || 1 };
    },
    mover, escalar, girar, encaixar, tamanho, recomecar, corrigir, tecla,
  };
}

/** O centro que tira o item da borda (dentro da margem), sem mudar o tamanho. */
function afastar(aj: Ajuste, it: ItemDaArte, e: Estado, larg?: number): Ajuste {
  const m = margemDaArea(e.W, e.H, e.emCm);
  const f = larg != null && it.tipo === "imagem" && it.w > 0 ? (larg * e.W) / it.w : 1;
  const bw = it.bw * f, bh = it.bh * f;
  const cx = bw + 2 * m > e.W ? e.W / 2 : Math.min(Math.max(it.cx, m + bw / 2), e.W - m - bw / 2);
  const cy = bh + 2 * m > e.H ? e.H / 2 : Math.min(Math.max(it.cy, m + bh / 2), e.H - m - bh / 2);
  return { ...aj, cx: cx / e.W, cy: cy / e.H };
}

// ── A faixa de baixo da prévia ───────────────────────────────

function Interruptor({ ligado, rotulo, onTrocar, testID }: { ligado: boolean; rotulo: string; onTrocar: () => void; testID?: string }) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={onTrocar}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }} aria-checked={ligado}
      accessibilityLabel={rotulo}
      style={({ hovered }: any) => [{
        flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 999,
        backgroundColor: hovered ? t.bg3 : t.bg2, borderWidth: 1, borderColor: borda2(t),
      }, transicao("background-color")]}
    >
      <View style={{ width: 30, height: 18, borderRadius: 9, backgroundColor: ligado ? t.marcaFill : t.ink4, justifyContent: "center" }}>
        <View style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: ligado ? t.sobreMarca : t.bg2, marginLeft: ligado ? 14 : 2 }, transicao("margin-left")]} />
      </View>
      <Texto style={{ fontSize: 13, color: t.ink2 }}>{rotulo}</Texto>
    </Pressable>
  );
}

/**
 * Debaixo da prévia: "Área de impressão", "Girar sozinha" (só no 3D) e
 * "Ajustar a arte" / "Pronto".
 */
export function FaixaDaPrevia({
  editor, mostrarArea, onMostrarArea, giro, onGiro, tem3D,
}: {
  editor: EditorDaArte;
  mostrarArea: boolean;
  onMostrarArea: (v: boolean) => void;
  giro: boolean;
  onGiro: (v: boolean) => void;
  tem3D: boolean;
}) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, width: "100%" }}>
      {!editor.editando ? <Interruptor testID="interruptor-area" ligado={mostrarArea} rotulo="Área de impressão" onTrocar={() => onMostrarArea(!mostrarArea)} /> : null}
      {tem3D ? <Interruptor testID="interruptor-giro" ligado={giro} rotulo="Girar sozinha" onTrocar={() => onGiro(!giro)} /> : null}
      <View style={{ flex: 1 }} />
      {editor.temConteudo ? (
        <Pressable
          testID={editor.editando ? "pronto-da-arte" : "ajustar-a-arte"}
          onPress={editor.editando ? editor.fechar : editor.abrir}
          accessibilityRole="button"
          accessibilityState={{ expanded: editor.editando }}
          style={({ pressed }: any) => [{
            flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 12,
            backgroundColor: t.marcaFill, transform: pressed ? [{ scale: 0.98 }] : undefined,
          }]}
        >
          <Icon name={editor.editando ? "check" : "resize"} size={18} color={t.sobreMarca} />
          <Texto style={{ fontSize: 14.5, fontWeight: "600", color: t.sobreMarca }}>{editor.editando ? "Pronto" : "Ajustar a arte"}</Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Os controles da edição ───────────────────────────────────

function Segmento<T extends string>({ opcoes, valor, onEscolher, rotulo }: { opcoes: Array<{ v: T; rotulo: string }>; valor: T | null; onEscolher: (v: T) => void; rotulo: string }) {
  const t = useTemaDaVitrine();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={{ flexDirection: "row", padding: 3, gap: 3, borderRadius: 12, backgroundColor: t.bg3, flexShrink: 1 }}>
      {opcoes.map((o) => {
        const sel = o.v === valor;
        return (
          <Pressable
            key={o.v}
            onPress={() => onEscolher(o.v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }} aria-checked={sel}
            style={[{ minHeight: 40, minWidth: 44, paddingHorizontal: 12, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: sel ? t.bg2 : "transparent" }, transicao("background-color")]}
          >
            <Texto numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: sel ? t.ink : t.ink2 }}>{o.rotulo}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

function BotaoQuadrado({ icone, rotulo, onPress, testID }: { icone: string; rotulo: string; onPress: () => void; testID?: string }) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ hovered, pressed }: any) => [{
        width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: borda2(t), backgroundColor: hovered ? t.bg3 : t.bg2,
        transform: pressed ? [{ scale: 0.96 }] : undefined,
      }]}
    >
      <Icon name={icone as any} size={18} color={t.ink} />
    </Pressable>
  );
}

function BotaoDeTexto({ rotulo, icone, onPress, testID }: { rotulo: string; icone?: string; onPress: () => void; testID?: string }) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      style={({ hovered }: any) => [{
        flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 12,
        borderWidth: 1, borderColor: borda2(t), backgroundColor: hovered ? t.bg3 : t.bg2,
      }]}
    >
      {icone ? <Icon name={icone as any} size={16} color={t.ink} /> : null}
      <Texto style={{ fontSize: 13.5, fontWeight: "600", color: t.ink }}>{rotulo}</Texto>
    </Pressable>
  );
}

function rotuloDoItem(it: ItemDaArte, rotulos: Record<string, string>): string {
  return rotulos[it.campo] || (it.tipo === "imagem" ? "Imagem" : it.texto);
}

/** O texto de um aviso, curto, com o botão que resolve. */
export function textoDoAviso(a: AvisoDaArte, nome: string): { texto: string; acao: string; tom: "amber" | "red" } {
  if (a.tipo === "cortada") return { texto: `Parte de "${nome}" fica fora da área e não será impressa.`, acao: "Encaixar na área", tom: "red" };
  if (a.tipo === "margem") return { texto: `"${nome}" está a menos de 3 mm da borda: pode ser cortado na produção.`, acao: "Afastar da borda", tom: "amber" };
  if (a.tipo === "fundo") return { texto: "A arte tem fundo branco: nesta peça ele sai impresso, como um retângulo branco em volta do desenho. Mande a arte com fundo transparente ou peça o ajuste.", acao: "", tom: "amber" };
  const f = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  return { texto: `Nesse tamanho a imagem fica com ${a.dpi} dpi e pode sair borrada. Nítida até ${f(a.nitidaAteCm)} cm de largura.`, acao: "Reduzir até ficar nítida", tom: "amber" };
}

export function ControlesDaArte({ editor, rotulos }: { editor: EditorDaArte; rotulos: Record<string, string> }) {
  const t = useTemaDaVitrine();
  const it = editor.alvo;
  if (!editor.editando || !it) return null;
  const nit = nitidezDoItem(it, editor.emCm);
  const medidas = editor.emCm ? textoDasMedidas(it.bw, it.bh) : null;
  const eventosDeTeclado: any = Platform.OS === "web" ? { onKeyDown: (e: any) => editor.tecla(e.nativeEvent ? { key: e.nativeEvent.key, shiftKey: e.nativeEvent.shiftKey, preventDefault: () => e.preventDefault?.() } : e) } : {};
  return (
    <View
      testID="controles-da-arte"
      accessibilityLabel="Ajustar a arte: setas movem, mais e menos mudam o tamanho, R gira"
      style={{ gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2, width: "100%" }}
      {...eventosDeTeclado}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Texto style={{ fontSize: 13.5, color: t.ink2 }}>
          {it.tipo === "imagem" ? "Imagem" : "Texto"}{medidas ? ": " : ""}
          {medidas ? <Numero style={{ fontSize: 13.5, fontWeight: "600", color: t.ink }}>{medidas}</Numero> : null}
          {it.rot ? <Texto style={{ fontSize: 13.5, color: t.ink3 }}>{` · girada ${it.rot}°`}</Texto> : null}
        </Texto>
        {nit ? <SeloDeNitidez dpi={nit.dpi} faixa={nit.faixa} /> : null}
      </View>

      {editor.avisos.length ? (
        <View style={{ gap: 8 }}>
          {editor.avisos.map((a, i) => {
            const alvo = editor.itens.find((x) => x.campo === a.campo);
            const txt = textoDoAviso(a, alvo ? rotuloDoItem(alvo, rotulos) : "a arte");
            const cor = txt.tom === "red" ? t.red : t.amber;
            return (
              <View key={a.tipo + a.campo + i} accessibilityRole="alert" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, backgroundColor: wash(cor, 0.12) }}>
                <Icon name="alert" size={16} color={cor} />
                <Texto style={{ flex: 1, minWidth: 180, fontSize: 13, lineHeight: 18, color: cor }}>{txt.texto}</Texto>
                {txt.acao ? <BotaoDeTexto rotulo={txt.acao} onPress={() => editor.corrigir(a)} testID={"corrigir-" + a.tipo} /> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Texto style={{ fontSize: 12.5, color: t.ink3 }}>Dentro da área e longe da borda. É assim que vai ser impresso.</Texto>
      )}

      {editor.itens.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2, minWidth: 64 }}>Ajustar</Texto>
          <Segmento
            rotulo="O que ajustar"
            opcoes={editor.itens.map((x) => ({ v: x.campo, rotulo: rotuloDoItem(x, rotulos) }))}
            valor={it.campo}
            onEscolher={editor.selecionar}
          />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <Texto style={{ fontSize: 13, fontWeight: "600", color: t.ink2, minWidth: 64 }}>Encaixar</Texto>
        <Segmento
          rotulo="Encaixar"
          opcoes={it.tipo === "imagem"
            ? [{ v: "ajustar" as const, rotulo: "Ajustar" }, { v: "preencher" as const, rotulo: "Preencher" }, { v: "centralizar" as const, rotulo: "Centralizar" }]
            : [{ v: "centralizar" as const, rotulo: "Centralizar" }]}
          valor={it.tipo === "imagem" && (it.encaixe === "ajustar" || it.encaixe === "preencher") ? it.encaixe : null}
          onEscolher={editor.encaixar}
        />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <BotaoQuadrado icone="minus" rotulo="Diminuir" onPress={() => editor.escalar(1 / 1.08)} testID="arte-menor" />
        <BotaoQuadrado icone="plus" rotulo="Aumentar" onPress={() => editor.escalar(1.08)} testID="arte-maior" />
        <View style={{ width: 8 }} />
        <BotaoQuadrado icone="arrow_left" rotulo="Mover para a esquerda" onPress={() => editor.mover("esquerda")} />
        <BotaoQuadrado icone="chevron_up" rotulo="Mover para cima" onPress={() => editor.mover("cima")} />
        <BotaoQuadrado icone="chevron_down" rotulo="Mover para baixo" onPress={() => editor.mover("baixo")} />
        <BotaoQuadrado icone="arrow_right" rotulo="Mover para a direita" onPress={() => editor.mover("direita")} testID="arte-direita" />
        <BotaoDeTexto icone="rotate_ccw" rotulo="Girar 90°" onPress={editor.girar} testID="arte-girar" />
        <Pressable onPress={editor.recomecar} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
          <Texto style={{ fontSize: 13.5, color: t.ink2, textDecorationLine: "underline" }}>Recomeçar</Texto>
        </Pressable>
      </View>
      <Texto style={{ fontSize: 12, color: t.ink3 }}>
        {Platform.OS === "web" ? "Arraste a arte na peça; fora dela, a peça gira. Puxe um canto (ou use dois dedos) para o tamanho." : "Use os botões para posicionar a arte."}
      </Texto>
    </View>
  );
}
