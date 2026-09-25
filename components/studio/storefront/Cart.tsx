// ============================================================
// components/studio/storefront/Cart.tsx
// Barra flutuante do carrinho (stage="list") + lista no checkout.
// ============================================================
import { useState } from "react";
import { View, Pressable, Linking } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { linkDoOrcamentoDoCarrinho } from "./pedidoPeloWhatsApp";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { wash, tintaSobre, corLegivelSobre } from "./theme";
import { LivePreview } from "./LivePreview";

import { CapaProduto } from "./CapaProduto";
import { temPersonalizacaoVisivel } from "@/components/studio/customizationConfig";
import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { dinheiro } from "./moeda";
import { Icon } from "@/components/Icon";
import { modoDaVitrine } from "./modoDaVitrine";
import { FolhaDaSacolaFechada } from "./SacolaFechada";
// O verso e o meio estao na peca? Era uma COPIA da regra do hook, aqui;
// desde a Fase 2 (25/09/2026) as duas telas leem o mesmo modulo puro.
import { versoEfetivo as effectiveBackSelected, meioEfetivo as effectiveMiddleSelected, precoDaLinha } from "./precoDaSacola";

/** Barra flutuante no stage="list" quando há itens no carrinho */
export function CartBar({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  // Fase 1C (D8): com a loja fechada, a barra nao leva ao checkout — abre
  // a folha que explica com o recado da loja e oferece o orcamento. Antes
  // a sacola guardada no navegador furava o fechamento e a cliente so
  // descobria no 409 do "Enviar pedido".
  const modo = modoDaVitrine(sf.store);
  const [folha, setFolha] = useState(false);
  if (sf.cart.length === 0) return null;
  // A barra e escura (a tinta do papel). Nada de branco cravado: a tinta
  // de cima sai da conta de contraste, e o selo da contagem usa a cor da
  // loja AJUSTADA para aparecer sobre a barra — a Sheid (#1a1612) sumiria
  // num selo quase preto em cima de barra quase preta. Antes o selo usava
  // accent_color, que o PO tirou da vitrine (so a cor principal pinta).
  const tinta = tintaSobre(T.ink);
  const selo = corLegivelSobre(tema.marca, T.ink);
  const pecas = sf.cart.reduce((s, l) => s + l.qty, 0);

  // Fase 2 (chave vitrine_v2): a barra abre a GAVETA da sacola, aberta ou
  // fechada a loja — a gaveta sabe mostrar as duas (SacolaEmGaveta.tsx).
  if (sf.vitrineV2) {
    return (
      <Pressable
        testID="barra-da-sacola"
        onPress={sf.abrirSacola}
        accessibilityRole="button"
        accessibilityLabel={"Ver sacola, " + pecas + (pecas === 1 ? " peça" : " peças") + ", " + dinheiro(sf.cartSubtotal)}
        style={{
          position: "absolute", left: 12, right: 12, bottom: 40,
          maxWidth: 980, marginHorizontal: "auto",
          backgroundColor: T.ink, borderRadius: 12, minHeight: 52,
          paddingVertical: 12, paddingHorizontal: 16,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ backgroundColor: selo, minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
            <Numero style={{ color: tintaSobre(selo), fontSize: 12, fontWeight: "700" }}>{pecas}</Numero>
          </View>
          <View>
            <Texto style={{ fontSize: 10.5, color: tinta, opacity: 0.72 }}>
              {pecas === 1 ? "peça na sacola" : "peças na sacola"}
            </Texto>
            <Numero style={{ color: tinta, fontSize: 16, fontWeight: "700" }}>{dinheiro(sf.cartSubtotal)}</Numero>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Texto style={{ color: tinta, fontSize: 13.5, fontWeight: "800" }}>Ver sacola</Texto>
          <Icon name="chevron_right" size={16} color={tinta} />
        </View>
      </Pressable>
    );
  }

  if (!modo.aceita) {
    return (
      <>
        <Pressable
          onPress={() => setFolha(true)}
          accessibilityRole="button"
          accessibilityLabel={"Ver sacola, " + pecas + (pecas === 1 ? " item" : " itens")}
          style={{
            position: "absolute", left: 12, right: 12, bottom: 40,
            maxWidth: 980, marginHorizontal: "auto",
            backgroundColor: T.ink, borderRadius: 12, minHeight: 48,
            paddingVertical: 13, paddingHorizontal: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="shopping_bag" size={18} color={tinta} />
            <Texto style={{ color: tinta, fontSize: 14, fontWeight: "600" }}>
              <Numero style={{ color: tinta, fontSize: 14, fontWeight: "700" }}>{pecas}</Numero>
              {pecas === 1 ? " item na sacola" : " itens na sacola"}
            </Texto>
          </View>
          <Icon name="chevron_right" size={18} color={tinta} />
        </Pressable>
        <FolhaDaSacolaFechada sf={sf} visivel={folha} onFechar={() => setFolha(false)} />
      </>
    );
  }

  return (
    <Pressable
      onPress={() => sf.goTo("checkout")}
      // A barra flutuante ficou de fora quando a vitrine ganhou coluna de
      // desktop: num monitor de 1440px ela ia de ponta a ponta (left/right
      // 12), com o "Ver carrinho" a mais de mil pixels do total. Agora
      // acompanha a mesma coluna do resto da loja.
      style={{
        // left+right esticam a barra; o maxWidth trava a largura e a margem
        // automatica centra o que sobra. Nada de width:"100%" junto, que
        // brigaria com os dois lados ancorados.
        position: "absolute", left: 12, right: 12, bottom: 40,
        maxWidth: 980, marginHorizontal: "auto",
        backgroundColor: T.ink, borderRadius: 12,
        paddingVertical: 14, paddingHorizontal: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            backgroundColor: selo, width: 26, height: 26,
            borderRadius: 13, alignItems: "center", justifyContent: "center",
          }}
        >
          <Numero style={{ color: tintaSobre(selo), fontSize: 12, fontWeight: "700" }}>
            {sf.cart.reduce((s, l) => s + l.qty, 0)}
          </Numero>
        </View>
        <View>
          <Texto style={{ fontSize: 10.5, color: tinta, opacity: 0.72 }}>
            {sf.cart.reduce((s, l) => s + l.qty, 0) === 1 ? "item personalizado" : "itens personalizados"}
          </Texto>
          <Numero style={{ color: tinta, fontSize: 16, fontWeight: "700" }}>{dinheiro(sf.cartSubtotal)}</Numero>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* Orcamento sempre acionavel e APARTADO do checkout (decisao do
            Caio, 04/09/2026): um botao pequeno, que nao disputa com
            "Finalizar". Leva o carrinho inteiro, peca por peca, para o
            WhatsApp da loja. Sem numero cadastrado ele nao existe. */}
        {(() => {
          const link = linkDoOrcamentoDoCarrinho({
            numero: (sf.store?.site as any)?.whatsapp,
            linhas: sf.cart,
            nomeDaLoja: sf.store?.site?.name,
          });
          if (!link) return null;
          return (
            <Pressable
              onPress={(e: any) => { e?.stopPropagation?.(); Linking.openURL(link); }}
              accessibilityRole="link"
              accessibilityLabel="Pedir orcamento destas pecas pelo WhatsApp"
              hitSlop={8}
              style={{ paddingVertical: 6, paddingHorizontal: 4 }}
            >
              <Texto style={{ color: tinta, opacity: 0.8, fontSize: 11.5, fontWeight: "600" }}>
                Orçamento
              </Texto>
            </Pressable>
          );
        })()}
        <Texto style={{ color: tinta, fontSize: 13, fontWeight: "800" }}>Finalizar →</Texto>
      </View>
    </Pressable>
  );
}

/** Lista de itens no checkout */
export function CartItemList({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  // A fonte do Studio, a mesma da home (ver Checkout).
  const tipo = useTipografia();
  // Os dois chips tinham 22px de altura: no celular o dedo errava e
  // "Remover" ficava a 6px de "Editar". Altura mínima e área de toque
  // ampliada (hitSlop) — o desenho continua discreto.
  const editChip: any = {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 36,
    backgroundColor: T.primary, alignItems: "center", justifyContent: "center",
  };
  // Texto do par legivel da loja — era branco cravado sobre a cor dela.
  const editChipTxt: any = { color: T.sobrePrimary, fontSize: 11.5, fontWeight: "800" };
  const removeChip: any = {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 36,
    backgroundColor: wash(T.red, 0.1), alignItems: "center", justifyContent: "center",
  };
  const removeChipTxt: any = { color: T.red, fontSize: 11.5, fontWeight: "800" };

  return (
    <>
      {sf.cart.map((l) => {
        const unit = sf._lineUnitPrice(l);
        const hasDelta = unit !== Number(l.product.price);
        // Servico de arte: uma vez por linha (decisao do PO, 25/09/2026).
        const arte = precoDaLinha(l).arte;
        const backActive = effectiveBackSelected(
          l.product.customization_config,
          l.hasBackSelected
        );
        const middleActive = effectiveMiddleSelected(
          l.product.customization_config,
          (l as any).values?.has_middle_selected
        );
        return (
          <View
            key={l.lineId}
            style={{
              backgroundColor: T.card, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: T.border,
              flexDirection: "row", alignItems: "center", gap: 12,
            }}
          >
            {/* Sem a foto, este preview desenhava a AREA DE IMPRESSAO — o
                cliente via "6x4cm" no lugar da peca que acabou de
                escolher. Mesmo bug que o configurador tinha; aqui faltou
                passar a foto junto.

                E quando nao ha foto NEM personalizacao — gravacao opcional
                que o cliente deixou em branco — o preview so tem a area
                vazia pra mostrar. Ai a capa composta assume, como na
                prateleira. */}
            {(l.product as any).image_url ||
            temPersonalizacaoVisivel(l.product.customization_config as any, l.values) ? (
              <LivePreview
                config={l.product.customization_config}
                values={l.values}
                size={56}
                productName={l.product.name}
                showLabel={false}
                fotoProduto={(l.product as any).image_url}
              />
            ) : (
              <CapaProduto
                nome={l.product.name}
                tamanho={56}
                corDaLoja={(sf.store as any)?.site?.primary_color}
                fonteDisplay={tipo.display}
              />
            )}
            <View style={{ flex: 1 }}>
              <Texto style={{ fontSize: 13, color: T.ink, fontWeight: "700" }}>{l.product.name}</Texto>
              <Numero style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                Qtd {l.qty} · {dinheiro(sf._lineTotal(l))}
              </Numero>
              {hasDelta && (
                <Texto style={{ fontSize: 10.5, color: T.primaryTexto, marginTop: 1 }}>
                  inclui {dinheiro((unit - Number(l.product.price)))} por opções
                </Texto>
              )}
              {arte > 0 && (
                <Texto style={{ fontSize: 10.5, color: T.primaryTexto, marginTop: 1 }}>
                  + {dinheiro(arte)} do serviço de arte, uma vez
                </Texto>
              )}
              {backActive &&
                (Number(l.product.customization_config?.back_price_delta) || 0) > 0 && (
                  <Texto style={{ fontSize: 10, color: T.green, fontWeight: "700", marginTop: 1 }}>
                    + verso ({dinheiro(Number(l.product.customization_config?.back_price_delta || 0))})
                  </Texto>
                )}
              {backActive &&
                (Number(l.product.customization_config?.back_price_delta) || 0) === 0 &&
                l.product.customization_config?.has_back === true && (
                  <Texto style={{ fontSize: 10, color: T.ink3, marginTop: 1 }}>com verso personalizado</Texto>
                )}
              {middleActive &&
                (Number(l.product.customization_config?.middle_price_delta) || 0) > 0 && (
                  <Texto style={{ fontSize: 10, color: T.green, fontWeight: "700", marginTop: 1 }}>
                    + meio ({dinheiro(Number(l.product.customization_config?.middle_price_delta || 0))})
                  </Texto>
                )}
              {middleActive &&
                (Number(l.product.customization_config?.middle_price_delta) || 0) === 0 &&
                l.product.customization_config?.has_middle === true && (
                  <Texto style={{ fontSize: 10, color: T.ink3, marginTop: 1 }}>com meio personalizado</Texto>
                )}
            </View>
            <View style={{ gap: 8 }}>
              <Pressable
                onPress={() => sf.editCartLine(l)}
                style={editChip}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={"Editar " + l.product.name}
              >
                <Texto style={editChipTxt}>Editar</Texto>
              </Pressable>
              <Pressable
                onPress={() => sf.removeCartLine(l.lineId)}
                style={removeChip}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={"Remover " + l.product.name}
              >
                <Texto style={removeChipTxt}>Remover</Texto>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}
