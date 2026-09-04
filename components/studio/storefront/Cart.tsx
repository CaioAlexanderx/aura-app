// ============================================================
// components/studio/storefront/Cart.tsx
// Barra flutuante do carrinho (stage="list") + lista no checkout.
// ============================================================
import { View, Pressable } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { LivePreview } from "./LivePreview";

import { CapaProduto } from "./CapaProduto";
import { temPersonalizacaoVisivel } from "@/components/studio/customizationConfig";
import { tipografiaDaLoja } from "@/constants/fonts";
import { Texto } from "./TipografiaVitrine";
// Helpers expostos pelo hook
function effectiveBackSelected(
  cfg: any, explicit: boolean | undefined
): boolean {
  if (!cfg || cfg.has_back !== true) return false;
  if (cfg.back_charge_enabled !== true) return true;
  return explicit === true;
}

// Mesma regra para a faixa central / wrap 360 (caneca, copo). A escolha
// explicita mora em values.has_middle_selected — a CartLine nao tem campo
// proprio, ao contrario do verso.
function effectiveMiddleSelected(
  cfg: any, explicit: boolean | undefined
): boolean {
  if (!cfg || cfg.has_middle !== true) return false;
  if (cfg.middle_charge_enabled !== true) return true;
  return explicit === true;
}

/** Barra flutuante no stage="list" quando há itens no carrinho */
export function CartBar({
  sf, accent,
}: {
  sf: StorefrontState;
  accent: string;
}) {
  const T = usePaletaDaVitrine();
  if (sf.cart.length === 0) return null;
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
            backgroundColor: accent, width: 26, height: 26,
            borderRadius: 13, alignItems: "center", justifyContent: "center",
          }}
        >
          <Texto style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
            {sf.cart.reduce((s, l) => s + l.qty, 0)}
          </Texto>
        </View>
        <View>
          <Texto style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
            {sf.cart.reduce((s, l) => s + l.qty, 0) === 1 ? "item personalizado" : "itens personalizados"}
          </Texto>
          <Texto style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>R$ {sf.cartSubtotal.toFixed(2)}</Texto>
        </View>
      </View>
      <Texto style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Finalizar →</Texto>
    </Pressable>
  );
}

/** Lista de itens no checkout */
export function CartItemList({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tipo = tipografiaDaLoja((sf.store as any)?.site?.font_family);
  // Os dois chips tinham 22px de altura: no celular o dedo errava e
  // "Remover" ficava a 6px de "Editar". Altura mínima e área de toque
  // ampliada (hitSlop) — o desenho continua discreto.
  const editChip: any = {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 36,
    backgroundColor: T.primary, alignItems: "center", justifyContent: "center",
  };
  const editChipTxt: any = { color: "#fff", fontSize: 11.5, fontWeight: "800" };
  const removeChip: any = {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 36,
    backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center",
  };
  const removeChipTxt: any = { color: T.red, fontSize: 11.5, fontWeight: "800" };

  return (
    <>
      {sf.cart.map((l) => {
        const unit = sf._lineUnitPrice(l);
        const hasDelta = unit !== Number(l.product.price);
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
              <Texto style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>
                Qtd {l.qty} · R$ {sf._lineTotal(l).toFixed(2)}
              </Texto>
              {hasDelta && (
                <Texto style={{ fontSize: 10, color: T.accent, marginTop: 1 }}>
                  inclui R$ {(unit - Number(l.product.price)).toFixed(2)} por opções
                </Texto>
              )}
              {backActive &&
                (Number(l.product.customization_config?.back_price_delta) || 0) > 0 && (
                  <Texto style={{ fontSize: 10, color: T.green, fontWeight: "700", marginTop: 1 }}>
                    + verso (R$ {Number(l.product.customization_config?.back_price_delta || 0).toFixed(2)})
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
                    + meio (R$ {Number(l.product.customization_config?.middle_price_delta || 0).toFixed(2)})
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
