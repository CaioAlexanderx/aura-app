// ============================================================
// components/studio/storefront/ProductConfigurator.tsx
// Orquestra os fields de um produto: frente/verso, opt-in verso,
// LivePreview, quantidade, botao Adicionar/Atualizar.
// Agente I (03/06/2026): link 'Ver guia de medidas' + values/onFieldChange no FieldRenderer
// Agente J (03/06/2026): ocultar campo image quando art_service=designer + limpar valor
// Visual Engine F3 (03/07/2026): slug+productId passados ao LivePreview —
//   com template visual vinculado, o preview vira canvas 2D/viewer 3D.
// ============================================================
import { useState, useEffect, useMemo } from "react";
import { View, Pressable, ScrollView, useWindowDimensions, Platform, Linking } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import type { PaletaDaVitrine } from "./theme";
import { FieldRenderer } from "./FieldRenderer";
import { LivePreview, defaultConfiguratorSize } from "./LivePreview";
import { montarTema, wash } from "./theme";
import { matchTier, proximaFaixa, faixaLabel } from "./qtyTiers";
import { validateRequiredFields } from "./useStorefront";
import { PoweredByAura } from "./ui/PoweredByAura";
import { linkDoPedido } from "./pedidoPeloWhatsApp";
import { SizeGuideModal } from "./SizeGuideModal";
// sideOf: fonte unica pra decidir o lado de um campo (front/back/middle).
// Usar aqui em vez de reimplementar o ternario evita a mesma divergencia
// que ja aconteceu entre painel/backend/storefront (ver customizationConfig.ts).
import { sideOf } from "@/components/studio/customizationConfig";

import { tipografiaDaLoja } from "@/constants/fonts";
import { textoDeParcelamento } from "./parcelamento";
import { FreteNoProduto } from "./FreteNoProduto";
import { ZoomFoto, DicaDeZoom } from "./ZoomFoto";
import { fotosDoProduto } from "./CarrosselFoto";
import { Texto } from "./TipografiaVitrine";
// Porte da loja comum (24/08/2026): descricao, ficha tecnica, "Comprar
// agora" e relacionados. Nenhuma linha de UI e compartilhada entre as
// duas lojas — o que e compartilhado e o payload, e ha teste no backend
// que falha se um campo de produto existir so de um lado.
import { FichaTecnica } from "./FichaTecnica";
import { relacionadosDe } from "./relacionados";
import { configDisponivel } from "./camposDaVitrine";
// 30px era menor que a ponta do dedo; 40px + hitSlop chega aos 44 que o
// toque pede sem o controle ficar grande na tela.
const qtyBtn: any = {
  width: 40, height: 40, borderRadius: 10,
  backgroundColor: "#f3f4f6",
  alignItems: "center", justifyContent: "center",
};
// Estilo solto no módulo lia a paleta cravada; com o tema vivo ele
// depende da loja, então vira função chamada dentro do componente.
const qtyTxtCom = (T: PaletaDaVitrine): any => ({ color: T.ink, fontSize: 16, fontWeight: "800" });

export function ProductConfigurator({
  sf,
  slug,
}: {
  sf: StorefrontState;
  /** Slug da loja — necessario para o endpoint de upload no FieldImage */
  slug: string;
}) {
  const T = usePaletaDaVitrine();
  const qtyTxt = qtyTxtCom(T);
  const {
    activeProduct, editingValues, setFieldValue, editingQty, setEditingQty,
    editingAddBack, setEditingAddBack,
    editingAddMiddle, setEditingAddMiddle,
    configuringUnitPrice, commitConfigure,
    // openConfigure entra aqui pra secao de relacionados: tocar num
    // vizinho troca o produto ativo sem sair da tela.
    openConfigure,
    goTo, error,
    // editingLineId nao e exposto diretamente — inferimos pelo comportamento:
    // quando activeProduct nao e null E tem um lineId travado, e edicao.
    // O hook sabe internamente; o texto do botao muda via sf._isEditing.
  } = sf;

  // Agente I: estado local do modal do guia de medidas
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Vizinhos de categoria. Sem rede: a vitrine ja tem o catalogo inteiro
  // em memoria (a maior loja tem 30 produtos). Antes do early return
  // porque useMemo nao pode ser condicional.
  const relacionados = useMemo(
    () => relacionadosDe(activeProduct, sf.store?.products),
    [activeProduct, sf.store],
  );

  // Agente J: detecta o campo art_service e o campo image em todos os fields.
  // Calculado ANTES do early return para que o useEffect abaixo possa ser
  // chamado incondicionalmente (Rules of Hooks).
  // Campo "escolher template da galeria" numa loja sem arte pronta não é
  // campo: sumia da tela com um recado para a lojista ("Loja não
  // cadastrou templates ainda") e ainda entrava na pendência do rodapé.
  // Ver camposDaVitrine.ts — o filtro vale para render E validação.
  const cfg = configDisponivel(activeProduct?.customization_config, activeProduct?.templates);
  const allFieldsForHooks = cfg?.fields || [];
  const artServiceField = allFieldsForHooks.find(
    (f) => f.type === "option" && (f.config as any)?.is_art_service
  );
  const imageField = allFieldsForHooks.find((f) => f.type === "image");

  // Agente J: valor atual do campo art_service (null quando o campo nao existe
  // ou quando activeProduct ainda nao esta carregado).
  const artServiceValue =
    artServiceField != null
      ? (editingValues[artServiceField.id] ?? "")
      : null;

  // Agente J: limpa o valor do campo image ao trocar para 'designer'.
  // DEVE ficar ANTES de qualquer early return para respeitar as Rules of Hooks.
  // O corpo do effect e defensivo: retorna cedo se activeProduct for null,
  // se nao houver campo image ou se o art_service nao for 'designer'.
  useEffect(() => {
    if (artServiceValue !== "designer") return;
    if (!imageField) return;
    const currentImageVal = editingValues[imageField.id];
    if (currentImageVal != null && currentImageVal !== "") {
      setFieldValue(imageField.id, "");
    }
    // editingValues intencionalmente omitido da dep-array: queremos reagir
    // apenas a mudancas no valor do art_service, nao a cada keystroke geral.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artServiceValue]);

  if (!activeProduct) return null;

  const hasDelta = configuringUnitPrice !== Number(activeProduct.price);

  // Agente I: extrai size_guide do customization_config
  const sizeGuide = (cfg as any)?.size_guide as
    | { file_url: string; content_type: string }
    | undefined;
  const hasSizeGuide = !!(sizeGuide?.file_url);

  const allFields = cfg?.fields || [];

  // S6 — escada vinda do backend, já com preço unitário por faixa.
  const escada = activeProduct?.qty_tiers || [];
  const faixaAtual = matchTier(escada, editingQty);
  const proxima = proximaFaixa(escada, editingQty);
  const frontFields = allFields.filter((f) => sideOf(f) === "front");
  const backFields = allFields.filter((f) => sideOf(f) === "back");
  const hasBack = cfg?.has_back === true;
  const backCharge = cfg?.back_charge_enabled === true;
  const backPrice = Number(cfg?.back_price_delta) || 0;
  const shouldRenderBack = hasBack && backFields.length > 0;
  const showBackBody = shouldRenderBack && (!backCharge || editingAddBack);

  // Meio (faixa central / wrap 360 de caneca e copo) — mesmo padrao do
  // verso acima: so tem secao propria quando o produto liga has_middle
  // E tem campo(s) marcados side="middle".
  const middleFields = allFields.filter((f) => sideOf(f) === "middle");
  const hasMiddle = cfg?.has_middle === true;
  const middleCharge = cfg?.middle_charge_enabled === true;
  const middlePrice = Number(cfg?.middle_price_delta) || 0;
  const shouldRenderMiddle = hasMiddle && middleFields.length > 0;
  const showMiddleBody = shouldRenderMiddle && (!middleCharge || editingAddMiddle);
  // Flat (sem secoes) so quando NENHUM lado extra existe — com back OU
  // middle, o layout vira sempre "Frente" + secao(oes) do(s) lado(s) extra(s).
  const shouldRenderAnySide = shouldRenderBack || shouldRenderMiddle;

  // S4 — o que ainda falta, calculado ENQUANTO a pessoa preenche.
  //
  // validateRequiredFields ja existia e so rodava no commit: a pessoa
  // configurava a peca inteira, tocava "Comprar agora" e so entao
  // descobria que faltava a arte. A mesma funcao, chamada aqui, vira
  // aviso na tela em vez de recusa no fim.
  //
  // E a MESMA do commit de proposito: duas validacoes divergentes fazem
  // o aviso sumir e o botao recusar mesmo assim.
  // A promessa de revisao desta loja, em uma linha.
  const notaDeRevisao = (() => {
    const r: any = (sf.store as any)?.revisions;
    if (!r) return null;
    if (r.policy_text) return String(r.policy_text);
    const inc = Number(r.max_included) || 0;
    if (inc <= 0) return "Você aprova o mockup antes de a loja produzir.";
    const extra = Number(r.extra_price) || 0;
    const base = `Você aprova o mockup antes de produzir. ${inc} ${inc === 1 ? "revisão inclusa" : "revisões inclusas"}`;
    return extra > 0
      ? `${base}; revisão extra R$ ${extra.toFixed(2).replace(".", ",")}.`
      : `${base}.`;
  })();

  const pendencia = validateRequiredFields(
    cfg ?? null, editingValues, showBackBody, showMiddleBody,
  );

  // Agente J: designer=true quando o campo art_service existe e tem valor 'designer'
  const artServiceDesigner =
    artServiceField != null &&
    editingValues[artServiceField.id] === "designer";

  // Agente I + J: passa values + onFieldChange ao FieldRenderer;
  // quando art_service=designer, nao renderiza o campo image.
  const renderField = (f: typeof allFields[0]) => {
    // Agente J: suprime campo image enquanto designer estiver ativo
    if (f.type === "image" && artServiceDesigner) return null;

    return (
      <FieldRenderer
        key={f.id}
        field={f}
        value={editingValues[f.id]}
        templates={activeProduct.templates}
        slug={slug}
        onChange={(v) => setFieldValue(f.id, v)}
        values={editingValues}
        onFieldChange={setFieldValue}
      />
    );
  };

  // A vitrine nasceu so pra celular: sem largura maxima, num monitor os
  // campos iam de ponta a ponta e o "Quantidade" ficava a mais de mil
  // pixels do proprio contador. No desktop o conteudo passa a viver numa
  // coluna centrada, com o preview FIXO ao lado dos campos — o cliente ve
  // a peca mudando enquanto digita, que e o ponto da tela.
  // A cor da loja finalmente chega ao caminho de compra. Ate aqui o botao
  // "Adicionar" saia azul-marinho (`tema.marcaTexto`) numa loja violeta — a
  // marca quebrava exatamente onde o cliente decide pagar.
  //
  // Preenchimento e tinta saem de `montarTema`, nao da cor crua: o hex do
  // lojista e arbitrario e um botao amarelo-limao com texto branco nao se
  // le. Ver fase 01.
  const tema = useMemo(
    () => montarTema((sf.store as any)?.site?.primary_color),
    [(sf.store as any)?.site?.primary_color],
  );

  // A tipografia escolhida pela lojista parava na prateleira: o titulo do
  // produto saia na fonte do sistema. Mesma fonte de verdade do ProductList.
  const tipo = tipografiaDaLoja((sf.store as any)?.site?.font_family);
  const [zoom, setZoom] = useState<number | null>(null);
  const fotosDaPeca = fotosDoProduto((activeProduct as any)?.gallery_urls, (activeProduct as any)?.image_url);
  const textoParcelas = textoDeParcelamento(
    configuringUnitPrice,
    (sf.store as any)?.payment?.card_max_installments,
  );

  const { width: larguraTela } = useWindowDimensions();
  const telaLarga = larguraTela >= 900;
  // DEPOIS de telaLarga: declarar antes daria "Cannot access
  // 'telaLarga' before initialization" — o mesmo erro que ja derrubou
  // esta tela antes.
  // No celular o preview fica grudado no topo enquanto a pessoa rola. Com
  // 320px de lado (250 de altura no 3D), mais os seletores, a legenda e
  // o botão de zoom, o bloco grudado media ~445px num telefone de 812:
  // sobravam 60px para o formulário, e o campo de texto ficava ESCONDIDO
  // embaixo da caneca — tocar nele era impossível (visto em 04/09/2026).
  // Preview menor no celular; zoom e frete saem do bloco grudado.
  const ladoDoPreview = telaLarga ? 360 : Math.min(240, defaultConfiguratorSize());
  const LARGURA_MAX = 980;
  // Sobra de cada lado pra alinhar cabecalho e rodape com a coluna.
  const recuoLateral = telaLarga ? Math.max(28, (larguraTela - LARGURA_MAX) / 2) : 16;

  const linhaConteudo = {
    flexDirection: telaLarga ? ("row" as const) : ("column" as const),
    gap: telaLarga ? 28 : 16,
    width: "100%" as const,
    maxWidth: LARGURA_MAX,
    alignSelf: "center" as const,
    alignItems: telaLarga ? ("flex-start" as const) : ("stretch" as const),
  };
  // S4 (decisao 3) — no celular a peca fica GRUDADA no topo enquanto a
  // pessoa desce preenchendo. Sem isto, escolher a cor no fim do
  // formulario nao mostra nada: o mockup ja rolou para fora da tela, e a
  // promessa da vitrine e justamente "veja antes de pagar".
  //
  // No desktop nao e preciso: as duas colunas cabem lado a lado.
  const previewGrudento = !telaLarga && Platform.OS === "web"
    ? ({ position: "sticky", top: 0, zIndex: 3, backgroundColor: T.bg,
         paddingBottom: 10 } as any)
    : {};

  const colunaPreview = {
    width: telaLarga ? 360 : ("100%" as const),
    alignItems: "center" as const,
  };
  const colunaCampos = {
    flex: telaLarga ? 1 : undefined,
    width: telaLarga ? undefined : ("100%" as const),
    gap: 16,
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Modal guia de medidas */}
      {showSizeGuide && hasSizeGuide && (
        <SizeGuideModal
          sizeGuide={sizeGuide!}
          onClose={() => setShowSizeGuide(false)}
        />
      )}

      {/* Header */}
      <View
        style={{
          backgroundColor: T.card,
          paddingHorizontal: recuoLateral, paddingTop: 20, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: T.border,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}
      >
        <Pressable onPress={() => { goTo("list"); sf.setError(null); }}>
          <Texto style={{ fontSize: 22, color: T.ink2 }}>←</Texto>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Texto style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase" }}>Personalize</Texto>
          <Texto style={{ fontFamily: tipo.display, fontSize: 19, lineHeight: 23, color: T.ink }}>{activeProduct.name}</Texto>
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: "rgba(30,58,138,0.08)",
              paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: 999, marginTop: 4,
            }}
          >
            <Texto style={{ fontSize: 9, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Estúdio · Arte personalizada
            </Texto>
          </View>

          {/* Agente I: link 'Ver guia de medidas' — só quando size_guide existe */}
          {hasSizeGuide && (
            <Pressable
              onPress={() => setShowSizeGuide(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "rgba(30,58,138,0.25)",
                backgroundColor: "rgba(30,58,138,0.05)",
              }}
            >
              <Texto style={{ fontSize: 11 }}>📐</Texto>
              <Texto
                style={{
                  fontSize: 11,
                  color: tema.marcaTexto,
                  fontWeight: "700",
                  textDecorationLine: "underline",
                }}
              >
                Ver guia de medidas
              </Texto>
            </Pressable>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Texto style={{ fontSize: 15, fontWeight: "800", color: tema.marcaTexto }}>
            R$ {configuringUnitPrice.toFixed(2)}
          </Texto>
          {/* "3x de R$ 53,30" e uma frase diferente de "R$ 159,90" pra
              quem esta decidindo. So aparece quando a lojista declarou o
              teto — a loja nao inventa numero de parcela. */}
          {textoParcelas ? (
            <Texto style={{ fontSize: 10.5, color: T.ink3, marginTop: 1 }}>{textoParcelas}</Texto>
          ) : null}
          {hasDelta && (
            <Texto style={{ fontSize: 9.5, color: T.ink3, marginTop: 1 }}>
              base R$ {Number(activeProduct.price).toFixed(2)}
            </Texto>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: telaLarga ? 28 : 16, paddingBottom: 160 }}
      >
        <View style={linhaConteudo}>
        <View style={colunaPreview}>
          {/* So a peca gruda no topo. Zoom e frete ficam no fluxo: no
              celular cada linha dentro do bloco grudado e uma linha a
              menos de formulario visivel. */}
          <View style={[{ width: "100%", alignItems: "center" }, previewGrudento]}>
            <View style={{ width: ladoDoPreview, alignSelf: "center" }}>
              <LivePreview
                config={cfg ?? null}
                values={editingValues}
                size={ladoDoPreview}
                productName={activeProduct.name}
                showLabel={false}
                slug={slug}
                productId={activeProduct.id}
                fotoProduto={(activeProduct as any).image_url}
                allowSideToggle
              />
            </View>
          </View>

          {/* Em peca personalizada o detalhe E o produto: textura do
              tecido, acabamento da costura. So oferece zoom quando ha
              foto — ampliar a area de impressao nao serve a ninguem. */}
          {fotosDaPeca.length > 0 ? (
            <View style={{ width: ladoDoPreview, alignSelf: "center" }}>
              <DicaDeZoom onPress={() => setZoom(0)} corDaLoja={(sf.store as any)?.site?.primary_color} />
            </View>
          ) : null}

          {/* O cliente so via o frete depois de configurar a peca e
              preencher endereco — e desistia no numero que aparecia no
              fim. A rota de cotacao e a MESMA do checkout, chamada aqui
              mais cedo. */}
          {sf.store?.delivery?.delivery_enabled ? (
            <View style={{ marginTop: 14 }}>
              <FreteNoProduto slug={slug} corDaLoja={(sf.store as any)?.site?.primary_color} />
            </View>
          ) : null}
        </View>

        <View style={colunaCampos}>

        {/* S1 — seletor de modelo. Só aparece quando o produto foi aberto
            por uma categoria com 2+ modelos; produto solto não ganha uma
            fileira vazia. Trocar de modelo preserva o que já foi
            preenchido (ver transportarValores em categoryGrouping.ts). */}
        {sf.activeSiblings.length > 1 ? (
          <View style={{ gap: 8 }}>
            <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              Modelo
            </Texto>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {sf.activeSiblings.map((m) => {
                const sel = m.id === activeProduct.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => sf.switchModel(m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={m.name}
                    style={{
                      minWidth: 104, padding: 8, borderRadius: 10,
                      backgroundColor: sel ? tema.marcaWash : T.card,
                      borderWidth: sel ? 2 : 1,
                      borderColor: sel ? tema.marcaTexto : T.border,
                    }}
                  >
                    <Texto
                      numberOfLines={2}
                      style={{ fontSize: 11, fontWeight: sel ? "800" : "600", color: sel ? tema.marcaTexto : T.ink }}
                    >
                      {m.name}
                    </Texto>
                    <Texto style={{ fontSize: 11, color: sel ? tema.marcaTexto : T.ink3, fontWeight: "700", marginTop: 4 }}>
                      R$ {Number(m.price).toFixed(2)}
                    </Texto>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Fields: flat quando so tem frente, agrupados por secao quando
            o produto tem verso e/ou meio (faixa central/wrap 360). */}
        {!shouldRenderAnySide ? (
          <>{allFields.map(renderField)}</>
        ) : (
          <>
            {/* Frente — o titulo so faz sentido com algo embaixo dele.
                Produto que so personaliza o meio mostrava "FRENTE" e nada
                mais, parecendo secao quebrada. */}
            {frontFields.length > 0 && (
              <View style={{ gap: 4, marginTop: 4 }}>
                <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                  Frente
                </Texto>
              </View>
            )}
            {frontFields.map(renderField)}

            {shouldRenderBack && (
              <>
                {/* Divisor VERSO */}
                <View style={{ marginTop: 18, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(30,58,138,0.08)" }}>
                    <Texto style={{ fontSize: 12, color: tema.marcaTexto }}>↻</Texto>
                    <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Verso</Texto>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
                </View>

                {/* Opt-in verso cobrado */}
                {backCharge ? (
                  <Pressable
                    onPress={() => {
                      const next = !editingAddBack;
                      setEditingAddBack(next);
                      if (next && backPrice > 0) {
                        console.log("[storefront] verso adicionado: +R$ " + backPrice.toFixed(2));
                      }
                    }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: T.card, borderRadius: 10, padding: 12,
                      borderWidth: 1.5,
                      borderColor: editingAddBack ? tema.marcaTexto : T.border,
                    }}
                  >
                    <View
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        borderWidth: 2,
                        borderColor: editingAddBack ? tema.marcaFill : T.ink4,
                        backgroundColor: editingAddBack ? tema.marcaFill : "transparent",
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {editingAddBack && (
                        <Texto style={{ color: tema.sobreMarca, fontSize: 13, fontWeight: "900" }}>✓</Texto>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Texto style={{ fontSize: 13, color: T.ink, fontWeight: "800" }}>
                        Personalizar também o verso
                      </Texto>
                      {!editingAddBack && (
                        <Texto style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                          Opcional · adiciona arte no lado de trás da peça
                        </Texto>
                      )}
                      {editingAddBack && backPrice > 0 && (
                        <Texto style={{ fontSize: 11.5, color: T.green, fontWeight: "700", marginTop: 2 }}>
                          +R$ {backPrice.toFixed(2)} no total
                        </Texto>
                      )}
                    </View>
                    {!editingAddBack && backPrice > 0 && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(236,72,153,0.12)" }}>
                        <Texto style={{ fontSize: 11, color: T.accent, fontWeight: "800" }}>+R$ {backPrice.toFixed(2)}</Texto>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Texto style={{ fontSize: 11, color: T.ink3, textAlign: "center", fontStyle: "italic", marginTop: -2 }}>
                    Verso incluso · sem custo adicional
                  </Texto>
                )}

                {/* Fields do verso (so quando ativo) */}
                {showBackBody && backFields.map(renderField)}
              </>
            )}

            {shouldRenderMiddle && (
              <>
                {/* Divisor MEIO — mesmo padrao visual do verso acima,
                    so troca o rotulo/icone. Caneca e copo tem arte que da
                    a volta (wrap 360) ou faixa central: nao e frente nem
                    verso, e um terceiro lado com a mesma regra de opt-in. */}
                <View style={{ marginTop: 18, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(30,58,138,0.08)" }}>
                    <Texto style={{ fontSize: 12, color: tema.marcaTexto }}>▭</Texto>
                    <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Meio</Texto>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
                </View>

                {/* Opt-in meio cobrado — regra de ativacao identica ao
                    verso: sem cobranca fica sempre ativo, com cobranca so
                    quando o cliente marca (has_middle_selected). Espelha
                    middleIsActive em src/routes/studioStorefront.js
                    (aura-backend); divergir aqui derruba o pedido no
                    fechamento. */}
                {middleCharge ? (
                  <Pressable
                    onPress={() => {
                      const next = !editingAddMiddle;
                      setEditingAddMiddle(next);
                      if (next && middlePrice > 0) {
                        console.log("[storefront] meio adicionado: +R$ " + middlePrice.toFixed(2));
                      }
                    }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: T.card, borderRadius: 10, padding: 12,
                      borderWidth: 1.5,
                      borderColor: editingAddMiddle ? tema.marcaTexto : T.border,
                    }}
                  >
                    <View
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        borderWidth: 2,
                        borderColor: editingAddMiddle ? tema.marcaFill : T.ink4,
                        backgroundColor: editingAddMiddle ? tema.marcaFill : "transparent",
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {editingAddMiddle && (
                        <Texto style={{ color: tema.sobreMarca, fontSize: 13, fontWeight: "900" }}>✓</Texto>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Texto style={{ fontSize: 13, color: T.ink, fontWeight: "800" }}>
                        Personalizar também o meio
                      </Texto>
                      {!editingAddMiddle && (
                        <Texto style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                          Opcional · arte na faixa central / ao redor da peça
                        </Texto>
                      )}
                      {editingAddMiddle && middlePrice > 0 && (
                        <Texto style={{ fontSize: 11.5, color: T.green, fontWeight: "700", marginTop: 2 }}>
                          +R$ {middlePrice.toFixed(2)} no total
                        </Texto>
                      )}
                    </View>
                    {!editingAddMiddle && middlePrice > 0 && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(236,72,153,0.12)" }}>
                        <Texto style={{ fontSize: 11, color: T.accent, fontWeight: "800" }}>+R$ {middlePrice.toFixed(2)}</Texto>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Texto style={{ fontSize: 11, color: T.ink3, textAlign: "center", fontStyle: "italic", marginTop: -2 }}>
                    Meio incluso · sem custo adicional
                  </Texto>
                )}

                {/* Fields do meio (so quando ativo) */}
                {showMiddleBody && middleFields.map(renderField)}
              </>
            )}
          </>
        )}

        {/* Quantidade */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <Texto style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>Quantidade</Texto>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => setEditingQty(Math.max(1, editingQty - 1))}
              style={qtyBtn}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Diminuir quantidade"
            >
              <Texto style={qtyTxt}>−</Texto>
            </Pressable>
            <Texto style={{ minWidth: 30, textAlign: "center", color: T.ink, fontWeight: "800", fontSize: 16 }}>
              {editingQty}
            </Texto>
            <Pressable
              onPress={() => setEditingQty(editingQty + 1)}
              style={qtyBtn}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Aumentar quantidade"
            >
              <Texto style={qtyTxt}>+</Texto>
            </Pressable>
          </View>
        </View>

        {/* S6 — escada de desconto. Fica ao lado da quantidade, não no
            carrinho: é argumento de venda para atacado e some se o cliente
            só descobrir depois de fechar. Cada faixa é tocável — o pulo
            para a quantidade que ativa o desconto é o gesto todo. */}
        {escada.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              Quanto mais, mais barato
            </Texto>
            {escada.map((t) => {
              const ativa = faixaAtual && faixaAtual.min_qty === t.min_qty;
              return (
                <Pressable
                  key={t.min_qty}
                  onPress={() => setEditingQty(Math.max(editingQty, t.min_qty))}
                  accessibilityRole="button"
                  accessibilityLabel={faixaLabel(t) + ": R$ " + Number(t.unit_price).toFixed(2) + " por unidade"}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
                    backgroundColor: ativa ? tema.marcaWash : T.card,
                    borderWidth: ativa ? 2 : 1,
                    borderColor: ativa ? tema.marcaTexto : T.border,
                  }}
                >
                  <Texto style={{ fontSize: 12, color: ativa ? tema.marcaTexto : T.ink2, fontWeight: ativa ? "800" : "600" }}>
                    {faixaLabel(t)}
                  </Texto>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Texto style={{ fontSize: 12, color: ativa ? tema.marcaTexto : T.ink, fontWeight: "800" }}>
                      R$ {Number(t.unit_price).toFixed(2)}
                    </Texto>
                    <View style={{ backgroundColor: T.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Texto style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                        -{Number(t.discount_pct).toFixed(0)}%
                      </Texto>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {proxima ? (
              <Texto style={{ fontSize: 11, color: T.ink3 }}>
                Leve {proxima.min_qty} e pague R$ {Number(proxima.unit_price).toFixed(2)} por unidade.
              </Texto>
            ) : null}
          </View>
        ) : null}

        {/* Sobre este produto. A vitrine tinha o campo no payload desde
            sempre e nunca mostrava — a tela e um configurador, e a
            descricao ficou de fora quando ela nasceu. Fica DEPOIS das
            opcoes: quem ja esta configurando decidiu; o texto e pra quem
            desceu procurando mais. */}
        {activeProduct.description && String(activeProduct.description).trim() ? (
          <View style={{ gap: 7 }}>
            <Texto style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
              Sobre este produto
            </Texto>
            <Texto style={{ fontSize: 13, lineHeight: 20, color: T.ink2 }}>
              {String(activeProduct.description).trim()}
            </Texto>
          </View>
        ) : null}

        <FichaTecnica produto={activeProduct} T={T} marcaTexto={tema.marcaTexto} />

        {error && (
          <Texto style={{ fontSize: 12, color: T.red, textAlign: "center" }}>{error}</Texto>
        )}
        </View>
        </View>

        {/* Produtos relacionados. Some sozinho quando sobra menos de dois
            vizinhos — fileira de um item so chama atencao pro tamanho da
            loja em vez de mostrar produto. */}
        {relacionados.length ? (
          // paddingTop: no celular o titulo colava na ultima linha da
          // descricao, parecendo continuacao do texto do produto.
          <View style={{ paddingHorizontal: recuoLateral, paddingTop: 28, paddingBottom: 26, gap: 14 }}>
            <Texto style={{ fontFamily: tipo.display, fontSize: 19, color: T.ink }}>
              Produtos relacionados
            </Texto>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {relacionados.map((r) => {
                const foto = fotosDoProduto(r.gallery_urls, r.image_url)[0] || null;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => openConfigure(r)}
                    accessibilityRole="button"
                    accessibilityLabel={r.name + ", R$ " + Number(r.price).toFixed(2)}
                    style={{ width: 138 }}
                  >
                    <View
                      style={{
                        width: 138, height: 138, borderRadius: 12, overflow: "hidden",
                        backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {foto ? (
                        <img
                          src={foto}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6%" }}
                        />
                      ) : (
                        <Texto style={{ fontSize: 22, color: T.ink3 }}>
                          {(r.name || "?").trim().charAt(0).toUpperCase()}
                        </Texto>
                      )}
                    </View>
                    <Texto numberOfLines={2} style={{ fontFamily: tipo.display, fontSize: 13.5, lineHeight: 17, color: T.ink, marginTop: 8 }}>
                      {r.name}
                    </Texto>
                    <Texto style={{ fontSize: 12.5, fontWeight: "800", color: tema.marcaTexto, marginTop: 2 }}>
                      R$ {Number(r.price).toFixed(2)}
                    </Texto>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ZoomFoto fotos={fotosDaPeca} nome={activeProduct.name} indice={zoom} onFechar={() => setZoom(null)} />

      {/* Botao CTA */}
      <View
        style={{
          backgroundColor: T.card, paddingVertical: 14, paddingHorizontal: recuoLateral,
          borderTopWidth: 1, borderTopColor: T.border,
          alignItems: telaLarga ? "center" : "stretch",
        }}
      >
        {/* O que falta, em ambar, antes do botao — nao depois do toque. */}
        {pendencia ? (
          <View style={{
            width: "100%", maxWidth: telaLarga ? 420 : undefined, marginBottom: 10,
            backgroundColor: wash(T.amber, 0.14), borderRadius: 10,
            paddingVertical: 8, paddingHorizontal: 12,
          }}>
            <Texto style={{ fontSize: 12, color: T.ink2, lineHeight: 17 }}>
              {pendencia}
            </Texto>
          </View>
        ) : null}

        {/* A politica de revisao e o que separa "comprei e torci" de
            "comprei e vou ver antes". Ela existe no payload desde
            25/05/2026 e so aparecia na tela de confirmacao — depois de
            pagar, que e tarde para tranquilizar alguem. */}
        {notaDeRevisao ? (
          <Texto style={{
            width: "100%", maxWidth: telaLarga ? 420 : undefined,
            fontSize: 11.5, color: T.ink3, marginBottom: 10, lineHeight: 16,
          }}>
            {notaDeRevisao}
          </Texto>
        ) : null}
        {/* Editando uma linha do carrinho ha UMA acao: atualizar. Oferecer
            "Comprar agora" ali seria oferecer o que a pessoa ja fez —
            ela veio do carrinho. */}
        {(sf as any)._editingLineId ? (
          <Pressable
            onPress={() => commitConfigure()}
            style={{
              backgroundColor: tema.marcaFill, paddingVertical: 14, borderRadius: 10, alignItems: "center",
              width: "100%", maxWidth: telaLarga ? 420 : undefined,
            }}
          >
            <Texto style={{ color: tema.sobreMarca, fontSize: 15, fontWeight: "800" }}>
              Atualizar • R$ {(configuringUnitPrice * editingQty).toFixed(2)}
            </Texto>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 10, width: "100%", maxWidth: telaLarga ? 420 : undefined }}>
            {/* "Comprar agora" e a acao PRINCIPAL e leva o preenchimento
                solido; "Adicionar" fica contornado. Mesma hierarquia da
                loja comum — uma cor cheia por tela, e ela pertence a acao
                que fecha a venda. */}
            <Pressable
              onPress={() => commitConfigure({ direto: true })}
              accessibilityRole="button"
              accessibilityLabel={"Comprar agora por R$ " + (configuringUnitPrice * editingQty).toFixed(2)}
              style={{
                flex: 1, backgroundColor: tema.marcaFill, paddingVertical: 14,
                borderRadius: 10, alignItems: "center",
                borderWidth: 1.5, borderColor: tema.marcaFill,
              }}
            >
              <Texto style={{ color: tema.sobreMarca, fontSize: 14.5, fontWeight: "800" }}>
                Comprar agora
              </Texto>
              <Texto style={{ color: tema.sobreMarca, fontSize: 11.5, fontWeight: "700", opacity: 0.85, marginTop: 1 }}>
                R$ {(configuringUnitPrice * editingQty).toFixed(2)}
              </Texto>
            </Pressable>

            <Pressable
              onPress={() => commitConfigure()}
              accessibilityRole="button"
              accessibilityLabel="Adicionar ao carrinho e continuar comprando"
              style={{
                flex: 1, backgroundColor: "transparent", paddingVertical: 14,
                borderRadius: 10, alignItems: "center", justifyContent: "center",
                borderWidth: 1.5, borderColor: tema.marcaFill,
              }}
            >
              <Texto style={{ color: tema.marcaTexto, fontSize: 14.5, fontWeight: "800", textAlign: "center" }}>
                Adicionar ao carrinho
              </Texto>
            </Pressable>
          </View>
        )}

        {/* O terceiro caminho: metade das clientes de personalizado so
            fecha falando com gente. O que muda a conversa nao e o botao,
            e a mensagem chegar pronta — a lojista le a peca, a
            personalizacao e o valor sem perguntar "de qual peca voce
            fala?". Sem numero cadastrado o botao nao existe: abrir o
            WhatsApp em branco seria pior. */}
        {(() => {
          const link = linkDoPedido({
            numero: (sf.store?.site as any)?.whatsapp,
            produto: activeProduct,
            valores: editingValues,
            quantidade: editingQty,
            precoUnitario: configuringUnitPrice,
            nomeDaLoja: sf.store?.site?.name,
          });
          if (!link) return null;
          return (
            <Pressable
              onPress={() => Linking.openURL(link)}
              accessibilityRole="link"
              accessibilityLabel="Fazer este pedido pelo WhatsApp da loja"
              style={{
                marginTop: 10, paddingVertical: 13, borderRadius: 10,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Texto style={{ color: tema.ink2, fontSize: 13.5, fontWeight: "600" }}>
                Prefere pedir pelo WhatsApp?
              </Texto>
            </Pressable>
          );
        })()}
      </View>

      <PoweredByAura />
    </View>
  );
}
