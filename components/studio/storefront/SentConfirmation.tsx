// ============================================================
// components/studio/storefront/SentConfirmation.tsx
// Stage="sent": confirmação do pedido enviado com Pix,
// policy de revisões e próximos passos.
// ============================================================
import { useState } from "react";
import { View, Pressable, ScrollView, Platform, Image, Linking } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { tintaSobre, FUNDO_DO_QR } from "./theme";
import { Icon } from "@/components/Icon";
import { NextStep } from "./ui/NextStep";
import { QrCode } from "@/components/QrCode";
import { BarraDeCookies } from "./ConsentimentoDaVitrine";

import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { dinheiro } from "./moeda";
export function SentConfirmation({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  // Confirmacao tambem na cor da loja: e a ultima tela que o cliente ve.
  // Tema do contexto (papel), nao montarTema(cor) sem modo — que caia no
  // "claro" e calculava o contraste contra o fundo errado (D4).
  const tema = useTemaDaVitrine();
  // A fonte do Studio, a mesma da home (ver Checkout).
  const tipo = useTipografia();

  const [copied, setCopied] = useState(false);
  if (!sf.sentOrder || !sf.store) return null;
  const { sentOrder, store } = sf;
  const rev = store.revisions;
  const slaDays = store.sla.total_estimate_days;

  // Copia o payload Pix (copia-e-cola). Web-only — storefront roda no browser.
  function copyPix() {
    const code = sentOrder?.pix?.payload;
    if (!code) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
      (navigator as any).clipboard
        .writeText(code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{
        padding: 24, paddingBottom: 40,
        alignItems: "center", minHeight: "100%" as any,
      }}
    >
      <View
        style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: T.green,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon name="check" size={40} color={tintaSobre(T.green)} />
      </View>

      {/* O "Feito no Aura Studio" com emoji saiu daqui (mockup da Fase 2,
          tela de confirmacao): a loja e da lojista, e a assinatura da Aura
          fica so no rodape institucional. */}

      <Texto style={{ fontFamily: tipo.display, fontSize: 24, lineHeight: 29, color: T.ink, marginTop: 10 }}>
        Pedido enviado!
      </Texto>
      <Texto style={{ fontSize: 13, color: T.ink3, marginTop: 6, textAlign: "center", maxWidth: 320 }}>
        {sentOrder.pix
          ? "Pague o Pix abaixo. Depois disso, a loja inicia a arte e envia mockup pra aprovação no WhatsApp."
          : sentOrder.card
          ? "Redirecionando ao pagamento com cartão..."
          : "A loja confirmará seu pedido em breve por WhatsApp."}
      </Texto>

      <View
        style={{
          backgroundColor: T.card, borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: T.border,
          alignItems: "center", gap: 6, minWidth: 260, marginTop: 16,
        }}
      >
        <Numero style={{ fontSize: 10.5, color: T.ink3, textTransform: "uppercase", letterSpacing: 1.2 }}>Pedido</Numero>
        <Numero style={{ fontSize: 18, color: T.ink, fontWeight: "700" }}>#{sentOrder.order_number}</Numero>
        <Numero style={{ fontSize: 10.5, color: T.ink3, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 8 }}>Total</Numero>
        <Numero style={{ fontSize: 26, color: tema.marcaTexto, fontWeight: "700" }}>
          {dinheiro(Number(sentOrder.total))}
        </Numero>
        <Texto style={{ fontSize: 11.5, color: tema.marcaTexto, fontWeight: "700", marginTop: 8 }}>
          Aguardando produção da arte
        </Texto>
      </View>

      {sentOrder.pix && (
        <View style={{ marginTop: 16, maxWidth: 320, width: "100%", gap: 10, alignItems: "center" }}>
          <Numero style={{ fontSize: 10.5, color: T.ink3, textAlign: "center", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: "600" }}>
            Pague com Pix
          </Numero>

          {/* QR: usa a imagem do gateway (base64) quando vier; senao gera do payload */}
          <View style={{ padding: 12, backgroundColor: FUNDO_DO_QR, borderRadius: 12, borderWidth: 1, borderColor: T.border }}>
            {sentOrder.pix.qrcode ? (
              <Image
                source={{
                  uri: sentOrder.pix.qrcode.startsWith("data:")
                    ? sentOrder.pix.qrcode
                    : `data:image/png;base64,${sentOrder.pix.qrcode}`,
                }}
                style={{ width: 180, height: 180 }}
                resizeMode="contain"
                accessibilityLabel="QR Code do Pix"
              />
            ) : (
              <QrCode value={sentOrder.pix.payload} size={180} />
            )}
          </View>

          <Texto style={{ fontSize: 11, color: T.ink3, textAlign: "center" }}>ou copie o código Pix</Texto>
          {/* O codigo sai na voz dos numeros (Bricolage, digitos tabulares):
              a mono de sistema era a unica fonte fora da loja nesta tela. */}
          <Numero
            style={{
              fontSize: 11, color: T.ink,
              padding: 10, backgroundColor: T.bg, borderRadius: 8,
              borderWidth: 1, borderColor: T.border,
            }}
            numberOfLines={4}
          >
            {sentOrder.pix.payload}
          </Numero>

          <Pressable
            onPress={copyPix}
            accessibilityRole="button"
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: copied ? T.green : tema.marcaFill,
              paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10,
            }}
          >
            {copied ? <Icon name="check" size={16} color={tintaSobre(T.green)} /> : null}
            <Texto style={{ color: copied ? tintaSobre(T.green) : tema.sobreMarca, fontSize: 13, fontWeight: "800" }}>
              {copied ? "Código copiado" : "Copiar código Pix"}
            </Texto>
          </Pressable>
        </View>
      )}

      {/* 05/09/2026: o link de acompanhamento. Nasce do payload ou nao
          existe — antes da migration 322 o backend manda null e o bloco
          some. E o link que a cliente guarda em vez de perguntar "e ai?"
          no WhatsApp. */}
      {sentOrder.track_url ? (
        <View
          testID="acompanhar-pedido"
          style={{
            backgroundColor: T.card, borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: T.border,
            marginTop: 16, maxWidth: 380, width: "100%", gap: 8,
          }}
        >
          <Numero style={{ fontSize: 10.5, color: tema.marcaTexto, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Acompanhe seu pedido
          </Numero>
          <Texto style={{ fontSize: 12.5, color: T.ink2, lineHeight: 18 }}>
            Guarde este link: ele mostra em que etapa o pedido está, sem precisar perguntar.
          </Texto>
          <Pressable
            onPress={() => Linking.openURL(sentOrder.track_url as string)}
            accessibilityRole="link"
            style={{
              alignSelf: "flex-start", paddingVertical: 9, paddingHorizontal: 14,
              borderRadius: 10, borderWidth: 1, borderColor: tema.marcaFill,
            }}
          >
            <Texto style={{ fontSize: 12.5, fontWeight: "800", color: tema.marcaTexto }}>Abrir acompanhamento</Texto>
          </Pressable>
          <Texto selectable style={{ fontSize: 11, color: T.ink3 }} numberOfLines={2}>
            {sentOrder.track_url}
          </Texto>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: T.card, borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: T.border,
          marginTop: 20, maxWidth: 380, width: "100%",
        }}
      >
        <Numero
          style={{
            fontSize: 10.5, color: tema.marcaTexto, fontWeight: "700",
            letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8,
          }}
        >
          Próximos passos
        </Numero>
        <NextStep n={1} title="A loja recebe seu pedido" desc="Tudo que você personalizou já chegou. A produção entra na fila." />
        <NextStep
          n={2}
          title="Arte é preparada"
          desc={`Em até ${slaDays} ${slaDays === 1 ? "dia útil" : "dias úteis"} a loja gera o mockup digital do seu pedido.`}
        />
        <NextStep n={3} title="Você aprova pelo WhatsApp" desc="A loja te envia o mockup pra aprovar. Se quiser ajustes, é só pedir." />
        <NextStep n={4} title="Produção e entrega" desc="Após aprovado, vai pra produção. Entrega/retirada conforme combinado." last />
      </View>

      {(rev.max_included > 0 || rev.policy_text) && (
        <View
          style={{
            backgroundColor: T.bg, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: T.border,
            marginTop: 12, maxWidth: 380, width: "100%",
            gap: 6,
          }}
        >
          <Numero style={{ fontSize: 10.5, color: T.ink3, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Política de revisões
          </Numero>
          {rev.max_included > 0 && (
            <Texto style={{ fontSize: 12, color: T.ink2, lineHeight: 17 }}>
              <Numero style={{ fontWeight: "700", color: tema.marcaTexto }}>{rev.max_included}</Numero>
              {" "}revis{rev.max_included === 1 ? "ão" : "ões"} grát{rev.max_included === 1 ? "is" : "is"} no mockup.
              {rev.extra_price > 0 && (
                <>
                  {" "}Revisão extra:{" "}
                  <Numero style={{ fontWeight: "700", color: tema.marcaTexto }}>{dinheiro(rev.extra_price)}</Numero>.
                </>
              )}
            </Texto>
          )}
          {rev.policy_text && (
            <Texto style={{ fontSize: 11.5, color: T.ink3, lineHeight: 16, fontStyle: "italic" }}>
              {rev.policy_text}
            </Texto>
          )}
        </View>
      )}

      <Pressable
        onPress={sf.resetToList}
        accessibilityRole="button"
        style={{
          backgroundColor: tema.marcaFill, paddingHorizontal: 24, paddingVertical: 12,
          borderRadius: 10, marginTop: 20,
        }}
      >
        <Texto style={{ color: tema.sobreMarca, fontSize: 14, fontWeight: "700" }}>+ Personalizar outro</Texto>
      </Pressable>
    </ScrollView>
    <BarraDeCookies />
    </View>
  );
}
