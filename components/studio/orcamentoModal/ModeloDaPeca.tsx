// ============================================================
// components/studio/orcamentoModal/ModeloDaPeca.tsx
//
// "Modelo do mockup" dentro da peça do orçamento (29/09/2026). O mesmo
// seletor da ficha do produto (SeletorDeModelo + MiniaturaDoModelo +
// useSpecsDosModelos): popover no desktop, folha de baixo no celular,
// teclado e modo toque. A diferença: aqui a escolha vale SÓ neste
// orçamento. "Do produto" deixa a peça herdando (visual_template_key
// null); "Sem mockup" tira o modelo só aqui.
// ============================================================
import React, { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { Icon } from "@/components/Icon";
import { MiniaturaDoModelo } from "@/components/studio/mockupPorProduto/MiniaturaDoModelo";
import { SeletorDeModelo, type Ancora } from "@/components/studio/mockupPorProduto/SeletorDeModelo";
import { useSemHover } from "@/components/studio/mockupPorProduto/SecaoMockupPorProduto";
import { lerProduto, metaDoModelo } from "@/components/studio/mockupPorProduto/regras";
import { modeloEfetivo, opcoesDoModeloDaPeca, seloDoModelo, type ProdutoDoCatalogo } from "./regras";
import { Selo, Rotulo, Dica, type Tema } from "./ui";

type Props = {
  tema: Tema;
  produto: ProdutoDoCatalogo;
  /** visual_template_key do item (null = herda). */
  chave: string | null;
  templates: VisualTemplate[];
  specs: Record<string, VisualTemplateSpec | null>;
  editavel: boolean;
  /** Texto da arte, só para a legenda da prévia. */
  arte?: string;
  onMudar: (chave: string | null) => void;
};

export function ModeloDaPeca({ tema, produto, chave, templates, specs, editavel, arte, onMudar }: Props) {
  const { t, estreito } = tema;
  const { width } = useWindowDimensions();
  const folha = width <= 640;
  const semHover = useSemHover();
  const gatilho = useRef<any>(null);

  const opcoes = useMemo(() => opcoesDoModeloDaPeca(produto.visual_template_key, templates), [produto.visual_template_key, templates]);
  const produtoDoSeletor = useMemo(() => lerProduto(produto), [produto]);

  const [aberto, setAberto] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const [ativo, setAtivo] = useState(0);
  const [candidato, setCandidato] = useState<string | null | undefined>(undefined);
  const [modoToque, setModoToque] = useState(false);

  const efetivo = modeloEfetivo(chave, produto.visual_template_key);
  const tAtual = efetivo.key ? templates.find((x) => x.key === efetivo.key) || null : null;
  // Com o seletor aberto, a prévia acompanha a opção em foco.
  const chaveDaPrevia = aberto && candidato !== undefined ? modeloEfetivo(candidato, produto.visual_template_key).key : efetivo.key;
  const tPrevia = chaveDaPrevia ? templates.find((x) => x.key === chaveDaPrevia) || null : null;
  const selo = seloDoModelo(efetivo.key, templates);

  function abrir() {
    if (!editavel) return;
    let a: Ancora | null = null;
    try {
      const r = gatilho.current?.getBoundingClientRect?.();
      if (r) a = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width };
    } catch (_e) {}
    setAncora(a);
    setModoToque(folha || semHover);
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.key === (chave ?? null))));
    setCandidato(chave ?? null);
    setAberto(true);
  }
  function fechar(devolverFoco: boolean) {
    setAberto(false);
    setCandidato(undefined);
    if (devolverFoco) setTimeout(() => { try { gatilho.current?.focus?.({ preventScroll: true }); } catch (_e) {} }, 0);
  }

  const nome = tAtual ? tAtual.name : efetivo.key ? efetivo.key : "Sem mockup";
  const meta = tAtual ? metaDoModelo(tAtual, specs[tAtual.key]) : "Vai a foto do produto, sem vídeo";

  return (
    <View style={{ gap: 4 }}>
      <Rotulo t={t}>Modelo do mockup</Rotulo>
      <View style={{ flexDirection: estreito ? "column" : "row", gap: 12, alignItems: estreito ? "stretch" : "flex-start" }}>
        <Pressable
          ref={gatilho}
          onPress={abrir}
          disabled={!editavel}
          accessibilityRole="button"
          accessibilityLabel={"Modelo do mockup: " + nome + (efetivo.herdado ? ", do produto" : ", só neste orçamento")}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          testID={"modelo-" + produto.id}
          style={{
            flex: estreito ? undefined : 1, minWidth: 0, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10,
            paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 12, borderWidth: 1.5,
            borderColor: aberto ? t.primary : t.ink5, backgroundColor: t.paperCardElev, opacity: editavel ? 1 : 0.85,
          }}
        >
          <MiniaturaDoModelo template={tAtual} spec={tAtual ? specs[tAtual.key] : null} foto={tAtual ? null : produto.image_url} T={t} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{nome}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <Selo t={t} tipo={selo.tipo} rotulo={selo.rotulo} />
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: t.ink3, flexShrink: 1 }}>{meta}</Text>
              <Selo t={t} tipo="herdado" rotulo={efetivo.herdado ? "do produto" : "só neste orçamento"} />
            </View>
          </View>
          {editavel ? <Icon name="chevron_down" size={18} color={t.ink3} /> : null}
        </Pressable>
        <View style={{ alignItems: "center", gap: 4 }} aria-hidden>
          <MiniaturaDoModelo template={tPrevia} spec={tPrevia ? specs[tPrevia.key] : null} foto={tPrevia ? null : produto.image_url} largura={120} altura={92} T={t} />
          <Text style={{ fontSize: 11, color: t.ink3 }}>{arte ? `prévia · "${arte}" vai no vídeo` : "prévia do modelo"}</Text>
        </View>
      </View>
      <Dica t={t}>
        {estreito
          ? (efetivo.herdado ? "Vem do produto. Trocar aqui vale só neste orçamento." : "Trocado só neste orçamento.")
          : efetivo.herdado
            ? "Vem do produto. Trocar aqui vale só neste orçamento e é o que vai no vídeo 3D."
            : "Trocado só neste orçamento. Escolha Do produto para voltar ao da ficha."}
      </Dica>

      {aberto ? (
        <SeletorDeModelo
          produto={produtoDoSeletor}
          opcoes={opcoes}
          atual={chave ?? null}
          specs={specs}
          folha={folha}
          modoToque={modoToque}
          ancora={ancora}
          ativo={ativo}
          candidato={candidato}
          onAtivo={(i, previa) => { setAtivo(i); if (previa) setCandidato(opcoes[i]?.key ?? null); }}
          onSair={() => { setAtivo(Math.max(0, opcoes.findIndex((o) => o.key === (chave ?? null)))); setCandidato(chave ?? null); }}
          onConfirmar={(k) => { fechar(true); if (k !== (chave ?? null)) onMudar(k); }}
          onFechar={fechar}
          dicaDoToque="Toque num modelo para ver na prévia. Vale só neste orçamento."
          previaDaFolha={
            <View style={{ alignItems: "center", paddingVertical: 6 }}>
              <MiniaturaDoModelo template={tPrevia} spec={tPrevia ? specs[tPrevia.key] : null} foto={tPrevia ? null : produto.image_url} largura={180} altura={137} T={t} />
            </View>
          }
          T={t}
        />
      ) : null}
    </View>
  );
}

export default ModeloDaPeca;
