// ============================================================
// components/studio/mockupPorProduto/SeletorDeModelo.tsx
//
// A lista aberta do seletor de modelo (28/09/2026). No desktop, um
// popover ancorado no seletor; em tela de até 640 px, uma folha de baixo
// com a prévia dentro dela (a folha cobre o quadro de prévia da página).
//
// Dois jeitos de escolher, como no mockup aprovado:
//   - mouse: passar por uma opção troca a prévia (espera de 70 ms, para
//     atravessar a lista não trocar o 3D a cada linha); sair da lista
//     volta ao modelo atual; clique grava.
//   - toque (sem hover, ou folha): tocar só marca a opção e troca a
//     prévia; grava em "Usar este modelo". Nada de hover-reveal.
// Teclado nos dois: setas andam e trocam a prévia, Enter grava, Esc
// fecha sem mudar nada e devolve o foco ao seletor, letras pulam.
//
// Vai por WebPortal: dentro da aba, o z-index:0 das Views do RNW
// prenderia o popover atrás da página.
// ============================================================
import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import type { VisualTemplateSpec } from "@/services/studioVisualApi";
import { WebPortal } from "@/components/WebPortal";
import { Icon } from "@/components/Icon";
import { MiniaturaDoModelo } from "./MiniaturaDoModelo";
import {
  metaDoModelo, metaDoNenhum, proximaPorDigitacao, ROTULO_DO_GRUPO,
  type OpcaoDoSeletor, type ProdutoDoMockup,
} from "./regras";

export type Ancora = { top: number; left: number; right: number; bottom: number; width: number };

type Props = {
  produto: ProdutoDoMockup;
  opcoes: OpcaoDoSeletor[];
  /** O modelo gravado hoje (null = sem modelo). */
  atual: string | null;
  specs: Record<string, VisualTemplateSpec | null>;
  folha: boolean;
  modoToque: boolean;
  ancora: Ancora | null;
  ativo: number;
  candidato: string | null | undefined;
  /** Move o cursor da lista; `previa` também troca o modelo mostrado. */
  onAtivo: (i: number, previa: boolean) => void;
  /** O mouse saiu da lista: a prévia volta ao modelo atual. */
  onSair: () => void;
  onConfirmar: (key: string | null) => void;
  onFechar: (devolverFoco: boolean) => void;
  /** A prévia da folha de baixo. */
  previaDaFolha?: React.ReactNode;
  /** Dica do rodapé no toque antes de escolher (o orçamento diz "só neste orçamento"). */
  dicaDoToque?: string;
  T: any;
};

export function SeletorDeModelo({
  produto, opcoes, atual, specs, folha, modoToque, ancora, ativo, candidato,
  onAtivo, onSair, onConfirmar, onFechar, previaDaFolha, dicaDoToque, T,
}: Props) {
  const listaRef = useRef<any>(null);
  const hover = useRef<any>(null);
  const digitado = useRef("");
  const digitadoTimer = useRef<any>(null);
  const idDe = (i: number) => "op-" + produto.id + "-" + i;

  // Foco na lista ao abrir: as setas já funcionam sem outro clique.
  useEffect(() => {
    const t = setTimeout(() => { try { listaRef.current?.focus?.({ preventScroll: true }); } catch (_e) {} }, 0);
    // Esc com o foco em outro ponto da folha (Cancelar, X) também fecha.
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(true); };
    const web = Platform.OS === "web" && typeof document !== "undefined";
    if (web) document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t); clearTimeout(hover.current); clearTimeout(digitadoTimer.current);
      if (web) document.removeEventListener("keydown", esc);
    };
  }, []);

  // A opção ativa sempre à vista.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const el = document.getElementById(idDe(ativo));
    if (el && (el as any).scrollIntoView) (el as any).scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  function aoTeclar(e: any) {
    const k: string = e?.key ?? e?.nativeEvent?.key ?? "";
    const parar = () => { e.preventDefault?.(); e.stopPropagation?.(); };
    if (k === "ArrowDown" || k === "ArrowUp") {
      parar();
      onAtivo(Math.max(0, Math.min(opcoes.length - 1, ativo + (k === "ArrowDown" ? 1 : -1))), true);
    } else if (k === "Home" || k === "End") {
      parar();
      onAtivo(k === "Home" ? 0 : opcoes.length - 1, true);
    } else if (k === "Enter" || k === " ") {
      parar();
      onConfirmar(opcoes[ativo]?.key ?? null);
    } else if (k === "Escape") {
      parar();
      onFechar(true);
    } else if (k === "Tab") {
      onFechar(true);
    } else if (k.length === 1 && /\S/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      clearTimeout(digitadoTimer.current);
      digitado.current += k;
      digitadoTimer.current = setTimeout(() => { digitado.current = ""; }, 700);
      const j = proximaPorDigitacao(opcoes, ativo, digitado.current);
      if (j >= 0) onAtivo(j, true);
    }
  }

  const iguais = candidato === undefined || candidato === atual;

  // ── Lista de opções ─────────────────────────────────────
  const itens: React.ReactNode[] = [];
  let grupo = "";
  opcoes.forEach((o, i) => {
    if (o.grupo !== grupo) {
      grupo = o.grupo;
      if (o.grupo !== "nenhum") {
        const n = opcoes.filter((x) => x.grupo === o.grupo).length;
        itens.push(
          <View key={"g-" + o.grupo} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 10, paddingBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: T.ink3 }}>
              {ROTULO_DO_GRUPO[o.grupo].toUpperCase()}
            </Text>
            <Text style={{ fontSize: 11, color: T.ink3 }}>{n}</Text>
          </View>
        );
      }
    }
    const eAtual = o.key === atual;
    const escolhido = modoToque && o.key === candidato;
    const eAtivo = i === ativo;
    const spec = o.template ? specs[o.template.key] : null;
    const meta = o.meta ?? (o.template ? metaDoModelo(o.template, spec) : metaDoNenhum(produto));
    itens.push(
      <Pressable
        key={o.key ?? "nenhum"}
        nativeID={idDe(i)}
        testID={"opcao-" + (o.key ?? "nenhum")}
        role="option"
        aria-selected={eAtual}
        focusable={false}
        onHoverIn={() => {
          if (modoToque) return;
          clearTimeout(hover.current);
          hover.current = setTimeout(() => onAtivo(i, true), 70);
        }}
        onPress={() => {
          clearTimeout(hover.current);
          if (modoToque) onAtivo(i, true);
          else onConfirmar(o.key);
        }}
        style={{
          flexDirection: "row", alignItems: "center", gap: 10, minHeight: folha ? 52 : 48,
          paddingVertical: 5, paddingLeft: 5, paddingRight: 8, borderRadius: 10,
          borderWidth: 1.5, borderColor: escolhido ? T.primary : "transparent",
          backgroundColor: eAtivo || escolhido ? T.primaryGhost : "transparent",
        }}
      >
        <MiniaturaDoModelo template={o.template} spec={spec} T={T} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: T.ink }}>{o.nome}</Text>
          <Text style={{ fontSize: 11.5, color: T.ink3 }}>{meta}</Text>
        </View>
        {eAtual ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="check" size={13} color={T.infoInk} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.infoInk }}>Atual</Text>
          </View>
        ) : null}
        {modoToque ? (
          <View
            style={{
              width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginLeft: 6,
              borderColor: escolhido ? T.primary : T.ink4, alignItems: "center", justifyContent: "center",
            }}
          >
            {escolhido ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary }} /> : null}
          </View>
        ) : null}
      </Pressable>
    );
  });

  const lista = (
    <ScrollView style={{ flexGrow: 1, flexShrink: 1 }} contentContainerStyle={{ padding: folha ? 10 : 6, paddingTop: folha ? 4 : 6 }}>
      <View
        ref={listaRef}
        role="listbox"
        tabIndex={0}
        aria-label={"Modelos para " + produto.name}
        {...({ "aria-activedescendant": idDe(ativo) } as any)}
        onKeyDown={aoTeclar}
        onMouseLeave={() => {
          if (modoToque) return;
          clearTimeout(hover.current);
          hover.current = setTimeout(onSair, 120);
        }}
        testID="lista-de-modelos"
        style={{ outlineStyle: "none" } as any}
      >
        {itens}
      </View>
    </ScrollView>
  );

  const rodape = modoToque ? (
    <View style={{ padding: folha ? 16 : 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.ink5, gap: 8 }}>
      <Text style={{ fontSize: 12, color: T.ink3 }} testID="rodape-dica">
        {iguais
          ? (dicaDoToque || "Toque num modelo para ver na prévia. Nada muda na loja até você confirmar.")
          : "Você está vendo a prévia. Toque em Usar este modelo para gravar."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => onFechar(true)}
          accessibilityRole="button"
          testID="seletor-cancelar"
          style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: T.ink4, justifyContent: "center" }}
        >
          <Text style={{ fontWeight: "700", color: T.ink2 }}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => { if (!iguais) onConfirmar(candidato ?? null); }}
          accessibilityRole="button"
          disabled={iguais}
          testID="seletor-usar"
          style={{
            flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
            backgroundColor: iguais ? T.ink5 : T.primary,
          }}
        >
          <Text style={{ fontWeight: "700", color: iguais ? T.ink3 : "#FFFFFF" }}>Usar este modelo</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: T.ink5 }} aria-hidden>
      <Text style={{ fontSize: 11.5, color: T.ink3 }}>Passe o mouse para ver na prévia. Clique para usar.</Text>
    </View>
  );

  // ── Onde a lista mora ───────────────────────────────────
  let caixa: React.ReactNode;
  if (folha) {
    caixa = (
      <View
        role="dialog"
        aria-modal
        aria-label={"Escolher modelo para " + produto.name}
        testID="seletor-folha"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%",
          backgroundColor: T.paperCardElev, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: -8 },
        }}
      >
        <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: T.ink4, opacity: 0.7, alignSelf: "center", marginTop: 8 }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start", paddingLeft: 16, paddingRight: 8, paddingVertical: 6 }}>
          <View style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: T.ink }}>Escolher modelo</Text>
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: T.ink3, marginTop: 2 }}>{produto.name}</Text>
          </View>
          <Pressable
            onPress={() => onFechar(true)}
            accessibilityRole="button"
            accessibilityLabel="Fechar sem mudar"
            testID="seletor-fechar"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="x" size={20} color={T.ink2} />
          </Pressable>
        </View>
        {previaDaFolha ? <View style={{ paddingHorizontal: 16 }}>{previaDaFolha}</View> : null}
        {lista}
        {rodape}
      </View>
    );
  } else {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    const a = ancora || { top: 80, left: 12, right: vw - 12, bottom: 120, width: 360 };
    const larg = Math.min(Math.max(a.width, 360), vw - 24);
    const esq = Math.min(Math.max(12, a.right - larg), vw - 12 - larg);
    const abaixo = vh - a.bottom - 12, acima = a.top - 12;
    const paraCima = abaixo < 340 && acima > abaixo;
    const maxH = Math.max(240, Math.min(480, (paraCima ? acima : abaixo) - 8));
    caixa = (
      <View
        testID="seletor-popover"
        style={[
          {
            position: "absolute", left: esq, width: larg, maxHeight: maxH,
            backgroundColor: T.paperCardElev, borderWidth: 1, borderColor: T.ink5, borderRadius: 14, overflow: "hidden",
            shadowColor: "#0F172A", shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
          },
          paraCima ? { bottom: vh - a.top + 6 } : { top: a.bottom + 6 },
        ]}
      >
        {lista}
        {rodape}
      </View>
    );
  }

  return (
    <WebPortal active>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        <Pressable
          onPress={() => onFechar(false)}
          accessibilityLabel="Fechar a lista de modelos"
          focusable={false}
          testID="seletor-fundo"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: folha ? "rgba(2,6,23,0.55)" : "transparent" }}
        />
        {caixa}
      </View>
    </WebPortal>
  );
}

export default SeletorDeModelo;
