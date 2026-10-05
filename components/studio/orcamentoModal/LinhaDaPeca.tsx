// ============================================================
// components/studio/orcamentoModal/LinhaDaPeca.tsx
//
// Uma peça do orçamento (29/09/2026). Fechada: foto, nome, "12 × R$
// 39,90", o selo do modelo e o total da linha. Tocada, abre NA PRÓPRIA
// LINHA com quantidade (− 1 +), preço, "Modelo do mockup" e a arte do
// cliente, mais "Tirar do orçamento". Antes, mudar a quantidade era
// tirar e pôr de novo, e voltava com 1.
//
// 29/09/2026 (vídeo em primeiro plano): aberta, a peça começa pelo
// estúdio (EstudioDaPeca) — a prévia 3D girando e o envio da arte por
// lugar. O campo de texto da arte saiu: o texto vem dentro da imagem.
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioQuoteItem } from "@/services/studioApi";
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { reais } from "@/components/studio/orcamentoVideo/condicoesDoOrcamento";
import { arteDoItem } from "@/components/studio/orcamentoVideo/pecaDoOrcamento";
import { artesDoItem, ladosDaPeca, quantasArtes, textoDasArtes } from "@/components/studio/orcamentoVideo/artesPorLado";
import { ModeloDaPeca } from "./ModeloDaPeca";
import { EstudioDaPeca } from "./EstudioDaPeca";
import {
  lerPreco, lerQuantidade, modeloEfetivo, seloDoModelo, textoDaQuantidade, textoDoPreco,
  type ProdutoDoCatalogo,
} from "./regras";
import { Botao, Campo, FotoDoProduto, Rotulo, Selo, type Tema } from "./ui";

/** A peça em memória: o item do orçamento com uma chave local e a foto. */
export type Peca = Omit<StudioQuoteItem, "id" | "sort_order"> & {
  chave: string;
  image_url?: string | null;
  visual_template_key: string | null;
};

type Props = {
  tema: Tema;
  /** Empresa do orçamento (multi-CNPJ): o envio da arte vai para ela. */
  cid: string | null;
  peca: Peca;
  produto: ProdutoDoCatalogo | null;
  aberta: boolean;
  editavel: boolean;
  templates: VisualTemplate[];
  specs: Record<string, VisualTemplateSpec | null>;
  onAlternar: () => void;
  onMudar: (p: Partial<Peca>) => void;
  onTirar: () => void;
};

export function LinhaDaPeca({ tema, cid, peca, produto, aberta, editavel, templates, specs, onAlternar, onMudar, onTirar }: Props) {
  const { t, estreito } = tema;
  const [qtdTxt, setQtdTxt] = useState(textoDaQuantidade(peca.quantity));
  const [precoTxt, setPrecoTxt] = useState(textoDoPreco(peca.unit_price));
  useEffect(() => { if (lerQuantidade(qtdTxt) !== peca.quantity) setQtdTxt(textoDaQuantidade(peca.quantity)); }, [peca.quantity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lerPreco(precoTxt) !== peca.unit_price) setPrecoTxt(textoDoPreco(peca.unit_price)); }, [peca.unit_price]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = produto?.customization_config || null;
  const arte = arteDoItem(cfg, peca.customization);
  const efetivo = peca.product_id ? modeloEfetivo(peca.visual_template_key, produto?.visual_template_key) : null;
  const selo = efetivo ? seloDoModelo(efetivo.key, templates) : null;
  const nomeDoModelo = efetivo?.key ? templates.find((x) => x.key === efetivo.key)?.name || null : null;
  const template = efetivo?.key ? templates.find((x) => x.key === efetivo.key) || null : null;
  const spec = efetivo?.key ? specs[efetivo.key] || null : null;
  const specDo3d = template?.kind === "model3d" ? spec : null;
  const artes = artesDoItem(cfg, peca.customization);
  const lados = ladosDaPeca(cfg, specDo3d);
  const nArtes = peca.product_id ? quantasArtes(artes, lados) : 0;

  function passo(delta: number) {
    const n = Math.max(1, Math.round((peca.quantity + delta) * 1000) / 1000);
    onMudar({ quantity: n });
  }

  return (
    <View
      testID={"peca-" + peca.chave}
      style={{ borderWidth: 1.5, borderColor: aberta ? t.primary : t.ink5, borderRadius: 12, backgroundColor: t.paperCardElev, minWidth: 0 }}
    >
      <Pressable
        onPress={onAlternar}
        accessibilityRole="button"
        aria-expanded={aberta}
        accessibilityLabel={`${peca.description}, ${textoDaQuantidade(peca.quantity)} de ${reais(peca.unit_price)}. ${aberta ? "Fechar" : editavel ? "Editar" : "Ver"}`}
        testID={"peca-linha-" + peca.chave}
        style={{ flexDirection: "row", alignItems: estreito ? "flex-start" : "center", gap: estreito ? 8 : 10, padding: 8, minHeight: 60 }}
      >
        <FotoDoProduto t={t} uri={peca.image_url || produto?.image_url} />
        <View style={{ flex: 1, minWidth: 0, gap: estreito ? 3 : 2 }}>
          <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 13.5, color: t.ink }}>{peca.description}</Text>
          {/* Celular (etapa 4): o preço tem linha própria, à direita, e os selos descem. */}
          {estreito ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }} testID="peca-valores">
              <Text numberOfLines={1} style={{ fontSize: 12, color: t.ink3, flexShrink: 1 }}>{textoDaQuantidade(peca.quantity)} × {reais(peca.unit_price)}</Text>
              <Text numberOfLines={1} style={{ fontWeight: "800", fontSize: 14, color: t.ink }} testID="peca-total">{reais(peca.quantity * peca.unit_price)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }} testID="peca-selos">
            {estreito ? null : <Text style={{ fontSize: 12, color: t.ink3 }}>{textoDaQuantidade(peca.quantity)} × {reais(peca.unit_price)}</Text>}
            {selo ? <Selo t={t} tipo={selo.tipo} rotulo={nomeDoModelo ? `${selo.rotulo} · ${nomeDoModelo}` : selo.rotulo} /> : <Selo t={t} tipo="herdado" rotulo="avulso" />}
            {efetivo && !efetivo.herdado ? <Selo t={t} tipo="herdado" rotulo="só aqui" /> : null}
            {peca.product_id ? <Selo t={t} tipo={nArtes ? "2d" : "sem"} rotulo={textoDasArtes(artes, lados)} /> : null}
          </View>
        </View>
        {estreito ? null : <Text style={{ fontWeight: "800", fontSize: 14, color: t.ink }}>{reais(peca.quantity * peca.unit_price)}</Text>}
        <View style={{ width: estreito ? 28 : 36, height: 36, alignItems: "center", justifyContent: "center", transform: [{ rotate: aberta ? "180deg" : "0deg" }] }}>
          <Icon name="chevron_down" size={16} color={t.ink3} />
        </View>
      </Pressable>

      {aberta ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.ink5, marginHorizontal: 8, paddingTop: 12, paddingBottom: 12, paddingHorizontal: 4, gap: 12 }}>
          {peca.product_id && produto ? (
            <EstudioDaPeca
              tema={tema}
              cid={cid}
              chave={peca.chave}
              customization={peca.customization ?? null}
              cfg={cfg}
              template={template}
              spec={spec}
              editavel={editavel}
              onMudar={(c) => onMudar({ customization: c })}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <View style={{ gap: 4 }}>
              <Rotulo t={t}>Quantidade</Rotulo>
              <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: t.ink5, borderRadius: 10, backgroundColor: t.bgSoft, overflow: "hidden", opacity: editavel ? 1 : 0.75 }}>
                <Pressable onPress={() => passo(-1)} disabled={!editavel || peca.quantity <= 1} accessibilityLabel="Menos um" testID="qtd-menos" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: peca.quantity <= 1 ? 0.4 : 1 }}>
                  <Icon name="minus" size={16} color={t.ink} />
                </Pressable>
                <TextInput
                  value={qtdTxt}
                  editable={editavel}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Quantidade"
                  testID="qtd"
                  onChangeText={(v) => { setQtdTxt(v); const n = lerQuantidade(v); if (n !== null) onMudar({ quantity: n }); }}
                  onBlur={() => setQtdTxt(textoDaQuantidade(peca.quantity))}
                  style={{ width: 56, minHeight: 44, textAlign: "center", fontSize: 14, color: t.ink }}
                />
                <Pressable onPress={() => passo(1)} disabled={!editavel} accessibilityLabel="Mais um" testID="qtd-mais" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="plus" size={16} color={t.ink} />
                </Pressable>
              </View>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 160 }}>
              <Campo
                tema={tema}
                rotulo="Preço unitário (R$)"
                value={precoTxt}
                editable={editavel}
                keyboardType="decimal-pad"
                testID="preco"
                onChangeText={(v) => { setPrecoTxt(v); const n = lerPreco(v); if (n !== null) onMudar({ unit_price: n }); }}
                onBlur={() => setPrecoTxt(textoDoPreco(peca.unit_price))}
                dica={peca.pricing_meta
                  ? "Sugerido pelo motor de preço" + (peca.unit_cost ? ` · custo ${reais(Number(peca.unit_cost))}` : "")
                  : peca.unit_cost ? `Custo ${reais(Number(peca.unit_cost))}` : undefined}
              />
            </View>
          </View>

          {produto ? (
            <ModeloDaPeca
              tema={tema}
              produto={produto}
              chave={peca.visual_template_key}
              templates={templates}
              specs={specs}
              editavel={editavel}
              arte={arte.texto}
              onMudar={(k) => onMudar({ visual_template_key: k })}
            />
          ) : peca.product_id ? null : (
            <Text style={{ fontSize: 12, color: t.ink3 }}>Item avulso: entra só nos valores, sem mockup.</Text>
          )}

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            {editavel ? <Botao tema={tema} tipo="perigo" pequeno rotulo="Tirar do orçamento" onPress={onTirar} testID="tirar" /> : null}
            <Botao tema={tema} tipo="sec" pequeno rotulo="Pronto" onPress={onAlternar} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default LinhaDaPeca;
