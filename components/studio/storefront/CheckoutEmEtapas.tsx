// ============================================================
// components/studio/storefront/CheckoutEmEtapas.tsx
//
// O checkout em três etapas (Fase 2, Telas 2, 3, 4 e 8 do mockup
// studio-vitrine-02-fechar-a-venda). Só com a chave `vitrine_v2`; sem
// ela, Checkout.tsx continua exatamente como era.
//
// Portado da loja Negócio (Aura-backend templates/storefront/parts/
// checkout.js, validada em set/2026), no desenho do mockup:
//   1 Seus dados   rótulos em cima, WhatsApp com máscara, CPF/CNPJ
//                  opcional com dígito verificador, dados lembrados por 90
//                  dias ("Que bom te ver de novo, Helena" + "Não sou eu");
//   2 Entrega      CEP PRIMEIRO: o oitavo dígito busca o endereço (ViaCEP)
//                  e cota o frete sozinho; três modos, retirada por app
//                  com "informo depois";
//   3 Pagamento    Pix, cartão e na retirada, cada um com o preço; a
//                  política de revisões acima do botão.
// O botão diz o total ou o que falta — e o toque no botão apagado leva ao
// campo. Resumo recolhível no celular ("Ver itens"), coluna fixa no
// desktop. Três coisas só do Studio (JORNADA §4.6): a miniatura com a
// arte da cliente, o prazo de produção e a política de revisões.
//
// Tela 8: quem volta pelo histórico, abre duas abas ou toca duas vezes
// criava dois pedidos. Com um pedido esperando pagamento (pedidoGuardado
// + consulta ao servidor), o checkout pergunta antes.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, TextInput, Image, useWindowDimensions, Platform } from "react-native";
import type { StorefrontState } from "./useStorefront";
import type { DeliveryType } from "./types";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { useVitrine } from "./ContextoDaVitrine";
import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "./moeda";
import { wash } from "./theme";
import { modoDaVitrine } from "./modoDaVitrine";
import { Checkout } from "./Checkout";
import { BarraDeCookies } from "./ConsentimentoDaVitrine";
import { MiniaturaDaLinha } from "./ui/MiniaturaDaLinha";
import { Campo, Botao, Caixinha, Nota, LinhaDeProtecao, BORDA_DE_CAMPO, FUNDO_APAGADO, FUNDO_SUAVE } from "./ui/Formulario";
import {
  maskCep, maskDocumento, avisoDoDocumento, faltaNosDados, faltaNaEntrega, modosDeEntrega,
  formasDePagamento, botaoDoPagamento, fraseDasRevisoes, diasUteis, digitos,
  type Etapa, type FormaDePagamento, type Falta,
} from "./formularioDoCheckout";
import {
  lerDadosLembrados, esquecerDadosLembrados, saudacao, storageLocal, primeiroNome,
} from "./dadosLembrados";
import { buscarEnderecoPorCep, linhaDoBairro, type EnderecoDoCep } from "./enderecoPorCep";
import { lerPedidoPendente, esquecerPedidoPendente, aindaEsperaPagamento, type PedidoPendente } from "./pedidoGuardado";
import { diaEHora, numeroDoPedido } from "./pedidoPorToken";
import { parcelasDoPreco } from "./parcelamento";
import { maskPlate } from "./courierPlate";
import { resumoDaLinha } from "./resumoDaPeca";
import { valoresDaSacola } from "./SacolaEmGaveta";
import { precoDaLinha, descontoDoPix, pecasNaSacola } from "./precoDaSacola";
import { medirNaVitrine, itensDaSacola } from "./eventosDaVitrine";
import { enderecoDaApi } from "./enderecoDaApi";

const API_BASE = enderecoDaApi();

/** O endereço de retirada: o do servidor, senão o da loja no rodapé. */
function enderecoDeRetirada(store: any): string {
  return String(store?.delivery?.pickup_address || store?.site?.endereco || "").trim();
}

// ── Os números do checkout ───────────────────────────────────

export type ContaDoCheckout = {
  subtotal: number;
  frete: number;
  /** Desconto do Pix da forma ESCOLHIDA (0 fora do Pix). */
  descontoPix: number;
  /** O desconto se a cliente escolher o Pix (para o cartão do Pix mostrar). */
  descontoSeForPix: number;
  total: number;
  pixPct: number;
  prazo: number;
  freteConhecido: boolean;
};

export function contaDoCheckout(sf: StorefrontState, tipo: DeliveryType | null, forma: FormaDePagamento | null): ContaDoCheckout {
  const v = valoresDaSacola(sf);
  const pixPct = v.pixPct;
  const temPix = !!sf.store?.payment?.has_pix;
  const descontoSeForPix = temPix
    ? (sf.cotacao ? Math.max(0, sf.cotacao.subtotal - sf.cotacao.total_pix) : descontoDoPix(v.subtotal, pixPct))
    : 0;
  const q = sf.shippingQuote;
  const freteConhecido = tipo !== "delivery" || (q != null && typeof q.fee === "number");
  const frete = tipo === "delivery" && q && typeof q.fee === "number" ? q.fee : 0;
  const descontoPix = forma === "pix" ? descontoSeForPix : 0;
  return {
    subtotal: v.subtotal, frete, descontoPix, descontoSeForPix,
    total: v.subtotal - descontoPix + frete,
    pixPct, prazo: v.prazo, freteConhecido,
  };
}

// ── Peças da tela ────────────────────────────────────────────

function Cabecalho({ sf, etapa, onVoltar, larga }: { sf: StorefrontState; etapa: Etapa; onVoltar: () => void; larga: boolean }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  return (
    <View
      style={{
        backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border,
        paddingHorizontal: 12, height: 60, flexDirection: "row", alignItems: "center",
      }}
    >
      <Pressable
        onPress={onVoltar}
        accessibilityRole="button"
        accessibilityLabel={etapa === 1 ? "Continuar comprando" : "Voltar para a etapa anterior"}
        style={{ minWidth: 44, height: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}
      >
        <Icon name="chevron_left" size={20} color={T.ink} />
        {larga ? (
          <Texto style={{ fontSize: 13.5, fontWeight: "600", color: T.ink }}>
            {etapa === 1 ? "Continuar comprando" : "Voltar"}
          </Texto>
        ) : null}
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Texto numberOfLines={1} style={{ fontFamily: tipo.display, fontSize: 20, color: T.ink }}>
          {sf.store?.site?.name || "Loja"}
        </Texto>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 44, justifyContent: "flex-end", paddingRight: 4 }}>
        <Icon name="lock" size={14} color={T.green} />
        <Numero style={{ fontSize: 10.5, letterSpacing: 1.1, color: T.ink3, textTransform: "uppercase" }}>
          Compra segura
        </Numero>
      </View>
    </View>
  );
}

function BarraDeEtapas({ etapa, onIr }: { etapa: Etapa; onIr: (e: Etapa) => void }) {
  const T = usePaletaDaVitrine();
  const rotulos = ["Seus dados", "Entrega", "Pagamento"];
  return (
    <View
      accessibilityRole={"progressbar" as any}
      accessibilityLabel={`Etapa ${etapa} de 3: ${rotulos[etapa - 1]}`}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 12 }}
    >
      {rotulos.map((r, i) => {
        const n = (i + 1) as Etapa;
        const feita = n < etapa;
        const atual = n === etapa;
        return (
          <View key={r} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
            {i > 0 ? <View style={{ width: 12, height: 1.5, backgroundColor: BORDA_DE_CAMPO }} /> : null}
            <Pressable
              onPress={() => (feita ? onIr(n) : undefined)}
              disabled={!feita}
              accessibilityRole="button"
              accessibilityLabel={feita ? `Voltar para ${r}` : r}
              style={{ flexDirection: "row", alignItems: "center", gap: 7, minHeight: 32 }}
            >
              <View
                style={{
                  width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                  backgroundColor: atual ? T.ink : feita ? FUNDO_APAGADO : T.card,
                  borderWidth: atual || feita ? 0 : 1, borderColor: BORDA_DE_CAMPO,
                }}
              >
                {feita
                  ? <Icon name="check" size={13} color={T.ink2} />
                  : <Numero style={{ fontSize: 12, fontWeight: "700", color: atual ? T.bg : T.ink2 }}>{n}</Numero>}
              </View>
              <Texto style={{ fontSize: 13.5, fontWeight: atual ? "700" : "400", color: atual ? T.ink : T.ink2 }} numberOfLines={1}>
                {r}
              </Texto>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** Os itens do resumo: miniatura com a contagem, nome, resumo e preço. */
function ItensDoResumo({ sf, compacto }: { sf: StorefrontState; compacto?: boolean }) {
  const T = usePaletaDaVitrine();
  const v = valoresDaSacola(sf);
  return (
    <View style={{ gap: 14 }}>
      {sf.cart.map((l, i) => (
        <View key={l.lineId} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <MiniaturaDaLinha line={l} tamanho={compacto ? 44 : 52} quantidade={l.qty} corDaLoja={(sf.store as any)?.site?.primary_color} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink }} numberOfLines={1}>{l.product.name}</Texto>
            <Texto style={{ fontSize: 12, color: T.ink3 }} numberOfLines={2}>{resumoDaLinha(l).slice(0, 2).join(" · ")}</Texto>
          </View>
          <Numero style={{ fontSize: 13.5, fontWeight: "600", color: T.ink }}>{dinheiro(v.linhas[i] ?? precoDaLinha(l).total)}</Numero>
        </View>
      ))}
    </View>
  );
}

function Totais({ sf, c, tipo, forma, etapa }: { sf: StorefrontState; c: ContaDoCheckout; tipo: DeliveryType | null; forma: FormaDePagamento | null; etapa: Etapa }) {
  const T = usePaletaDaVitrine();
  const n = pecasNaSacola(sf.cart);
  const linha = (rotulo: string, valor: string, cor?: string, fraco?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
      <Texto style={{ fontSize: 13.5, color: cor || T.ink2 }}>{rotulo}</Texto>
      {fraco
        ? <Texto style={{ fontSize: 12.5, color: T.ink3 }}>{valor}</Texto>
        : <Numero style={{ fontSize: 13.5, fontWeight: "600", color: cor || T.ink }}>{valor}</Numero>}
    </View>
  );
  const rotuloEntrega = tipo === "delivery" ? "Entrega" : tipo === "courier" ? "Retirada por app" : tipo === "pickup" ? "Retirada na loja" : "Entrega";
  const valorEntrega = !tipo
    ? (etapa === 1 ? "no próximo passo" : "escolha como receber")
    : tipo === "delivery"
      ? (c.freteConhecido ? (c.frete > 0 ? dinheiro(c.frete) : "Grátis") : "pelo CEP")
      : tipo === "courier" ? "pago no app" : "Grátis";
  const entregaGratis = valorEntrega === "Grátis";
  return (
    <View style={{ gap: 8 }}>
      {linha(`Subtotal · ${n} ${n === 1 ? "peça" : "peças"}`, dinheiro(c.subtotal))}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <Texto style={{ fontSize: 13.5, color: T.ink2 }}>{rotuloEntrega}</Texto>
        {entregaGratis
          ? <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.green }}>Grátis</Texto>
          : tipo === "delivery" && c.freteConhecido
            ? <Numero style={{ fontSize: 13.5, fontWeight: "600", color: T.ink }}>{valorEntrega}</Numero>
            : <Texto style={{ fontSize: 12.5, color: T.ink3 }}>{valorEntrega}</Texto>}
      </View>
      {c.descontoPix > 0 ? linha(`Desconto no Pix (${String(c.pixPct).replace(".", ",")}%)`, "− " + dinheiro(c.descontoPix), T.green) : null}
      <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Texto style={{ fontSize: 15, fontWeight: "700", color: T.ink }}>{forma === "pix" ? "Total no Pix" : "Total"}</Texto>
        <Numero testID="total-do-checkout" style={{ fontSize: 19, fontWeight: "700", color: T.ink }}>{dinheiro(c.total)}</Numero>
      </View>
      {forma !== "pix" && c.descontoSeForPix > 0 ? (
        <Texto style={{ fontSize: 12.5, fontWeight: "600", color: T.green, textAlign: "right" }}>
          ou {dinheiro(c.total - c.descontoSeForPix)} no Pix
        </Texto>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 }}>
        <Icon name="clock" size={14} color={T.ink3} />
        <Texto style={{ fontSize: 12.5, color: T.ink3, flex: 1 }}>Pronto em {diasUteis(c.prazo)} após a aprovação da arte.</Texto>
      </View>
    </View>
  );
}

/** O resumo na coluna da direita (desktop). */
function ResumoLateral({ sf, c, tipo, forma, etapa }: { sf: StorefrontState; c: ContaDoCheckout; tipo: DeliveryType | null; forma: FormaDePagamento | null; etapa: Etapa }) {
  const T = usePaletaDaVitrine();
  const n = pecasNaSacola(sf.cart);
  return (
    <View style={{ backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 20, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Numero style={{ fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: T.ink3 }}>
          Sua sacola · {n} {n === 1 ? "peça" : "peças"}
        </Numero>
        <Pressable onPress={sf.abrirSacola} accessibilityRole="button" accessibilityLabel="Editar a sacola" style={{ minHeight: 36, justifyContent: "center" }}>
          <Texto style={{ fontSize: 13, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Editar</Texto>
        </Pressable>
      </View>
      <ItensDoResumo sf={sf} />
      <View style={{ height: 1, backgroundColor: T.border }} />
      <Totais sf={sf} c={c} tipo={tipo} forma={forma} etapa={etapa} />
    </View>
  );
}

/** O resumo recolhido do celular: "Ver itens" com o total sempre à vista. */
function ResumoRecolhivel({ sf, c, tipo, forma, etapa }: { sf: StorefrontState; c: ContaDoCheckout; tipo: DeliveryType | null; forma: FormaDePagamento | null; etapa: Etapa }) {
  const T = usePaletaDaVitrine();
  const [aberto, setAberto] = useState(false);
  return (
    <View style={{ backgroundColor: FUNDO_SUAVE, borderTopWidth: 1, borderBottomWidth: 1, borderColor: T.border }}>
      <Pressable
        onPress={() => setAberto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={(aberto ? "Esconder itens" : "Ver itens") + ", total " + dinheiro(c.total)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 56 }}
      >
        <View style={{ flexDirection: "row" }}>
          {sf.cart.slice(0, 3).map((l, i) => (
            <View key={l.lineId} style={{ marginLeft: i ? -12 : 0 }}>
              <MiniaturaDaLinha line={l} tamanho={34} corDaLoja={(sf.store as any)?.site?.primary_color} />
            </View>
          ))}
        </View>
        <Texto style={{ fontSize: 14.5, color: T.ink }}>{aberto ? "Esconder itens" : "Ver itens"}</Texto>
        <Icon name={aberto ? "chevron_up" : "chevron_down"} size={16} color={T.ink} />
        <View style={{ flex: 1 }} />
        <Numero style={{ fontSize: 16, fontWeight: "600", color: T.ink }}>{dinheiro(c.total)}</Numero>
      </Pressable>
      {aberto ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
          <ItensDoResumo sf={sf} compacto />
          <Pressable onPress={sf.abrirSacola} accessibilityRole="button" style={{ alignSelf: "flex-start", minHeight: 36, justifyContent: "center" }}>
            <Texto style={{ fontSize: 13, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Editar a sacola</Texto>
          </Pressable>
          <View style={{ height: 1, backgroundColor: T.border }} />
          <Totais sf={sf} c={c} tipo={tipo} forma={forma} etapa={etapa} />
        </View>
      ) : null}
    </View>
  );
}

/** Um cartão de escolha (modo de entrega, forma de pagamento), com o rádio do kit. */
function Opcao({
  titulo, icone, preco, precoCor, riscado, selo, detalhe, escolhida, desligada, onEscolher, children, testID,
}: {
  titulo: string; icone: string; preco?: string | null; precoCor?: string; riscado?: string | null;
  selo?: string | null; detalhe?: string | null; escolhida: boolean; desligada?: boolean;
  onEscolher: () => void; children?: React.ReactNode; testID?: string;
}) {
  const T = usePaletaDaVitrine();
  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16, backgroundColor: desligada ? FUNDO_SUAVE : T.card,
        borderWidth: escolhida ? 2 : 1, borderStyle: desligada ? "dashed" : "solid",
        borderColor: escolhida ? T.ink : BORDA_DE_CAMPO,
      }}
    >
      <Pressable
        onPress={onEscolher}
        disabled={desligada}
        accessibilityRole="radio"
        accessibilityState={{ checked: escolhida, disabled: !!desligada }}
        accessibilityLabel={[titulo, preco, detalhe].filter(Boolean).join(", ")}
        style={{ flexDirection: "row", gap: 14, padding: escolhida ? 15 : 16, alignItems: "flex-start" }}
      >
        <View
          style={{
            width: 22, height: 22, borderRadius: 11, marginTop: 1, borderWidth: escolhida ? 0 : 1.5,
            borderColor: BORDA_DE_CAMPO, backgroundColor: escolhida ? T.ink : T.card,
            alignItems: "center", justifyContent: "center",
          }}
        >
          {escolhida ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.bg }} /> : null}
        </View>
        <View style={{ flex: 1, gap: 4, opacity: desligada ? 0.6 : 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Icon name={icone} size={16} color={T.ink} />
            <Texto style={{ fontSize: 15.5, fontWeight: "700", color: T.ink }}>{titulo}</Texto>
            {selo ? (
              <View style={{ backgroundColor: wash(T.green, 0.12), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Numero style={{ fontSize: 11.5, fontWeight: "700", color: T.green }}>{selo}</Numero>
              </View>
            ) : null}
          </View>
          {detalhe ? <Texto style={{ fontSize: 13.5, lineHeight: 19, color: T.ink2 }}>{detalhe}</Texto> : null}
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: 110 }}>
          {preco ? <Numero style={{ fontSize: 14.5, fontWeight: "700", color: precoCor || T.ink, textAlign: "right" }}>{preco}</Numero> : null}
          {riscado ? <Numero style={{ fontSize: 11.5, color: T.ink3, textDecorationLine: "line-through" }}>{riscado}</Numero> : null}
        </View>
      </Pressable>
      {children ? <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>{children}</View> : null}
    </View>
  );
}

/** Tela 8: "Você tem um pedido esperando pagamento". */
function AvisoDePedidoPendente({
  pendente, onContinuar, onNovo, larga,
}: { pendente: PedidoPendente; onContinuar: () => void; onNovo: () => void; larga: boolean }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const numero = numeroDoPedido(pendente.order_number);
  const minutos = Math.max(1, Math.round((Date.now() - pendente.ts) / 60000));
  const ha = minutos < 60 ? `há ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`
    : `há ${Math.round(minutos / 60)} ${Math.round(minutos / 60) === 1 ? "hora" : "horas"}`;
  const vence = diaEHora(new Date(pendente.ts + 72 * 3600 * 1000).toISOString());
  const pix = pendente.payment_method === "pix";
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 95 }} testID="pedido-pendente">
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash(T.ink, 0.42) }} />
      <View
        accessibilityViewIsModal
        style={[
          { position: "absolute", backgroundColor: T.bg, padding: 24, gap: 14 },
          larga
            ? { top: "18%", alignSelf: "center", left: "50%", width: 440, marginLeft: -220, borderRadius: 20 } as any
            : { left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
        ]}
      >
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: wash(T.amber, 0.12), alignItems: "center", justifyContent: "center" }}>
          <Icon name="clock" size={24} color={T.amber} />
        </View>
        <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 22, lineHeight: 27, color: T.ink }}>
          {`Você tem um pedido esperando pagamento${numero ? ` (${numero})` : ""}`}
        </Texto>
        <Texto style={{ fontSize: 14, lineHeight: 21, color: T.ink2 }}>
          {`Você começou esse pedido ${ha} e o ${pix ? "Pix" : "pagamento"} ainda não entrou. Quer continuar de onde parou?`}
        </Texto>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, backgroundColor: T.card }}>
          <View style={{ flexDirection: "row" }}>
            {pendente.imagens.slice(0, 3).map((u, i) => (
              <View key={u + i} style={{ marginLeft: i ? -12 : 0, width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, overflow: "hidden" }}>
                <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>
              {`${pendente.pecas} ${pendente.pecas === 1 ? "peça" : "peças"}${pendente.total ? ` · ${dinheiro(pendente.total)}${pix ? " no Pix" : ""}` : ""}`}
            </Texto>
            {pix && vence ? <Texto style={{ fontSize: 13, color: T.ink2 }}>{`O código vale até ${vence}`}</Texto> : null}
          </View>
        </View>
        <Botao titulo="Continuar esse pedido" onPress={onContinuar} testID="continuar-pedido" />
        <Botao titulo="Fazer um novo" variante="secundario" onPress={onNovo} />
        {pix ? (
          <Texto style={{ fontSize: 12.5, color: T.ink3, textAlign: "center" }}>
            {`Se não for pago, o ${numero || "pedido"} cancela sozinho em 72 horas.`}
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

// ── A tela ───────────────────────────────────────────────────

export function CheckoutEmEtapas({ sf }: { sf: StorefrontState }) {
  const modo = modoDaVitrine(sf.store);
  // Loja fechada: o checkout de hoje já sabe mostrar o recado e o
  // orçamento (Fase 1C). Não há pedido para montar em etapas.
  if (!sf.store) return null;
  if (!modo.aceita) return <Checkout sf={sf} />;
  return <CheckoutAberto sf={sf} />;
}

function CheckoutAberto({ sf }: { sf: StorefrontState }) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();
  const larga = width >= 900;
  const store: any = sf.store;
  const slug = useVitrine()?.slug || "";
  const nomeDaLoja = store?.site?.name || "loja";

  const [etapa, setEtapa] = useState<Etapa>(1);
  const scroll = useRef<ScrollView>(null);
  const campos = useRef<Record<string, TextInput | null>>({});
  const ref = (nome: string) => (el: TextInput | null) => { campos.current[nome] = el; };

  // ── Dados lembrados (Tela 2) ────────────────────────────────
  const [lembrada, setLembrada] = useState<string | null>(null);
  useEffect(() => {
    const d = lerDadosLembrados(slug, storageLocal());
    if (!d || sf.customerName.trim()) return;
    sf.setCustomerName(d.name);
    sf.setCustomerPhone(d.phone);
    sf.setCustomerEmail(d.email);
    if (d.customer_cpf_cnpj) { sf.setQuerDocumento(true); sf.setCustomerDocument(maskDocumento(d.customer_cpf_cnpj)); }
    if (d.address_zip) sf.setAddressZip(maskCep(d.address_zip));
    if (d.address_street) sf.setAddressStreet(d.address_street);
    if (d.address_number) sf.setAddressNumber(d.address_number);
    if (d.address_complement) sf.setAddressComplement(d.address_complement);
    if (d.address_neighborhood) sf.setAddressNeigh(d.address_neighborhood);
    if (d.address_city) sf.setAddressCity(d.address_city);
    if (d.address_state) sf.setAddressState(d.address_state);
    setLembrada(d.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function naoSouEu() {
    esquecerDadosLembrados(slug, storageLocal());
    setLembrada(null);
    sf.setCustomerName(""); sf.setCustomerPhone(""); sf.setCustomerEmail("");
    sf.setQuerDocumento(false); sf.setCustomerDocument("");
    sf.setAddressZip(""); sf.setAddressStreet(""); sf.setAddressNumber(""); sf.setAddressComplement("");
    sf.setAddressNeigh(""); sf.setAddressCity(""); sf.setAddressState("");
    setCep({ estado: "vazio", endereco: null });
    setTimeout(() => campos.current.nome?.focus?.(), 0);
  }

  // ── begin_checkout, uma vez por visita ──────────────────────
  const medido = useRef(false);
  useEffect(() => {
    if (medido.current || sf.cart.length === 0) return;
    medido.current = true;
    medirNaVitrine(store?.site?.rastreadores, { nome: "begin_checkout", itens: itensDaSacola(sf.cart, sf._lineUnitPrice) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pedido esperando pagamento (Tela 8) ─────────────────────
  const [pendente, setPendente] = useState<PedidoPendente | null>(null);
  const [recadoDoPendente, setRecadoDoPendente] = useState<PedidoPendente | null>(null);
  useEffect(() => {
    const p = lerPedidoPendente(slug, storageLocal());
    if (!p || !p.token) return;
    let vivo = true;
    fetch(`${API_BASE}/storefront/${slug}/studio/pedido/${encodeURIComponent(p.token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo) return;
        // Pago, cancelado ou sumido: a chave é apagada em silêncio.
        if (j && aindaEsperaPagamento(j)) setPendente(p);
        else esquecerPedidoPendente(slug, storageLocal());
      })
      .catch(() => { /* sem rede: não pergunta nada */ });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entrega ─────────────────────────────────────────────────
  const modos = modosDeEntrega(store?.delivery);
  // Nada vem escolhido (o botão diz "Escolha como receber"), a não ser que
  // a loja só tenha um modo.
  const [entrega, setEntrega] = useState<DeliveryType | null>(modos.length === 1 ? modos[0].tipo : null);
  const [cep, setCep] = useState<{ estado: "vazio" | "buscando" | "ok" | "nao_achado" | "erro"; endereco: EnderecoDoCep | null }>({ estado: "vazio", endereco: null });
  const [editarEndereco, setEditarEndereco] = useState(false);
  const foraDaArea = !!(sf.shippingQuote && sf.shippingQuote.fee == null && sf.shippingQuote.error);
  const entregaEmCasa = modos.some((m) => m.tipo === "delivery");

  function escolherEntrega(t: DeliveryType) {
    setEntrega(t);
    sf.setDeliveryType(t);
    if (t === "delivery" && digitos(sf.addressZip).length === 8 && !sf.shippingQuote) sf.quoteShipping(sf.addressZip);
    // "Pagar na retirada" some na retirada por app.
    if (t === "courier" && sf.paymentMethod === "on_delivery") sf.setPaymentMethod(null);
  }

  async function aoDigitarCep(bruto: string) {
    const v = maskCep(bruto);
    sf.setAddressZip(v);
    const d = digitos(v);
    if (d.length !== 8) {
      if (cep.estado !== "vazio") setCep({ estado: "vazio", endereco: null });
      return;
    }
    setCep({ estado: "buscando", endereco: null });
    let e: EnderecoDoCep | null = null;
    try {
      e = await buscarEnderecoPorCep(d);
    } catch {
      setCep({ estado: "erro", endereco: null });
      setEditarEndereco(true);
      return;
    }
    if (!e) { setCep({ estado: "nao_achado", endereco: null }); setEditarEndereco(true); return; }
    setCep({ estado: "ok", endereco: e });
    if (e.rua) sf.setAddressStreet(e.rua);
    if (e.bairro) sf.setAddressNeigh(e.bairro);
    sf.setAddressCity(e.cidade);
    sf.setAddressState(e.uf);
    setEditarEndereco(!e.rua || !e.bairro);
    if (entregaEmCasa) {
      // O CEP preenchido é a cliente dizendo "entrega em casa": o modo é
      // escolhido, o frete cotado, e o cursor vai para o número.
      setEntrega("delivery");
      sf.setDeliveryType("delivery");
      sf.quoteShipping(d);
      setTimeout(() => campos.current.numero?.focus?.(), 50);
    }
  }

  // O modo da tela e o do pedido andam juntos (loja com um modo só já
  // começa com ele escolhido, e o pedido tem de levar o mesmo).
  useEffect(() => {
    if (entrega && sf.deliveryType !== entrega) sf.setDeliveryType(entrega);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrega]);

  // Fora da área: "Receber em casa" desmarca (os outros modos seguem à mão).
  useEffect(() => {
    if (foraDaArea && entrega === "delivery") setEntrega(null);
  }, [foraDaArea, entrega]);

  // ── Pagamento ───────────────────────────────────────────────
  const formas = formasDePagamento(store?.payment, entrega);
  // Nada vem escolhido com mais de uma forma; com uma só, ela vem marcada.
  const escolheuPagamento = useRef(false);
  useEffect(() => {
    if (escolheuPagamento.current) return;
    if (formas.length === 1) sf.setPaymentMethod(formas[0].forma);
    else sf.setPaymentMethod(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formas.length]);
  const forma = (sf.paymentMethod && formas.some((f) => f.forma === sf.paymentMethod) ? sf.paymentMethod : null) as FormaDePagamento | null;
  const [comRecado, setComRecado] = useState(!!sf.notes.trim());

  const c = contaDoCheckout(sf, entrega, forma);

  // ── O que falta, por etapa ─────────────────────────────────
  const falta1 = faltaNosDados({
    nome: sf.customerName, whatsapp: sf.customerPhone, email: sf.customerEmail,
    querDocumento: sf.querDocumento, documento: sf.customerDocument,
  });
  const falta2 = faltaNaEntrega({
    tipo: entrega, cep: sf.addressZip, rua: sf.addressStreet, numero: sf.addressNumber,
    bairro: sf.addressNeigh, cidade: sf.addressCity, uf: sf.addressState,
    foraDaArea, cotando: sf.quotingShipping, buscandoCep: cep.estado === "buscando",
    courierNome: sf.courierName, courierPlaca: sf.courierPlate, informarDepois: sf.courierInformarDepois,
  });
  const falta3: Falta | null = forma ? null : { texto: "Escolha como pagar", campo: "pagamento" };
  const falta = etapa === 1 ? falta1 : etapa === 2 ? falta2 : falta3;

  function irPara(e: Etapa) {
    setEtapa(e);
    sf.setError(null);
    setTimeout(() => scroll.current?.scrollTo?.({ y: 0, animated: false }), 0);
  }
  function levarAoCampo(f: Falta) {
    const el = campos.current[f.campo];
    if (el && typeof el.focus === "function") { el.focus(); return; }
    scroll.current?.scrollTo?.({ y: 0, animated: true });
  }
  function avancar() {
    if (falta) { levarAoCampo(falta); return; }
    if (etapa === 1) irPara(2);
    else if (etapa === 2) irPara(3);
    else sf.submitOrder();
  }
  function voltar() {
    if (etapa > 1) irPara((etapa - 1) as Etapa);
    else sf.goTo("list");
  }

  const rotuloDoBotao = sf.sending ? "Criando o pedido…"
    : falta ? falta.texto
    : etapa === 1 ? "Continuar para a entrega"
    : etapa === 2 ? "Continuar para o pagamento"
    : botaoDoPagamento(forma, dinheiro(c.total));

  if (sf.cart.length === 0 && !sf.sending) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Cabecalho sf={sf} etapa={1} onVoltar={() => sf.goTo("list")} larga={larga} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
          <Texto style={{ fontFamily: tipo.display, fontSize: 24, color: T.ink, textAlign: "center" }}>Sua sacola está vazia</Texto>
          <Texto style={{ fontSize: 14.5, color: T.ink2, textAlign: "center", maxWidth: 320 }}>
            Escolha uma peça e deixe com a sua cara. A gente mostra como fica antes de produzir.
          </Texto>
          <View style={{ minWidth: 200 }}><Botao titulo="Ver a loja" onPress={() => sf.goTo("list")} /></View>
        </View>
      </View>
    );
  }

  const botaoPrincipal = (
    <Botao
      testID="botao-do-checkout"
      titulo={rotuloDoBotao}
      iconeDepois={!falta && etapa < 3 && !sf.sending ? "arrow_right" : undefined}
      apagado={!!falta}
      desativado={sf.sending}
      onPress={avancar}
    />
  );

  // ── Etapa 1 ─────────────────────────────────────────────────
  const aviso = avisoDoDocumento(sf.customerDocument);
  const etapa1 = (
    <View style={{ gap: 18 }}>
      {lembrada ? (
        <View
          testID="dados-lembrados"
          style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: FUNDO_APAGADO, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16 }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: T.ink, alignItems: "center", justifyContent: "center" }}>
            <Texto style={{ fontFamily: tipo.display, color: T.bg, fontSize: 18 }}>{primeiroNome(lembrada).charAt(0).toUpperCase()}</Texto>
          </View>
          <View style={{ flex: 1 }}>
            <Texto style={{ fontFamily: tipo.display, fontSize: 17, lineHeight: 22, color: T.ink }}>{saudacao(lembrada)}</Texto>
            <Texto style={{ fontSize: 13, lineHeight: 19, color: T.ink2 }}>Seus dados da última compra já estão aqui.</Texto>
          </View>
          <Pressable onPress={naoSouEu} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingLeft: 4 }}>
            <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Não sou eu</Texto>
          </Pressable>
        </View>
      ) : null}
      <Campo
        ref={ref("nome")} testID="campo-nome" rotulo="Nome completo" placeholder="Como está no seu documento"
        value={sf.customerName} onChangeText={sf.setCustomerName} autoComplete="name" textContentType="name"
        onBlur={() => sf.setCustomerName(sf.customerName.trim())}
      />
      <Campo
        ref={ref("whatsapp")} testID="campo-whatsapp" rotulo="WhatsApp" placeholder="(12) 99999-9999"
        value={sf.customerPhone} onChangeText={sf.setCustomerPhone} keyboardType="phone-pad" inputMode="tel"
        autoComplete="tel" textContentType="telephoneNumber"
        nota="Usamos o WhatsApp só para avisar sobre o pedido e mandar a arte para você aprovar."
      />
      <Campo
        ref={ref("email")} testID="campo-email" rotulo="E-mail" opcional placeholder="voce@email.com"
        value={sf.customerEmail} onChangeText={sf.setCustomerEmail} keyboardType="email-address" inputMode="email"
        autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
        nota="Mandamos o link para acompanhar o pedido."
        erro={falta1?.campo === "email" ? "Confira o e-mail. Exemplo: nome@email.com" : null}
      />
      <Caixinha testID="quero-documento" marcada={sf.querDocumento} onTrocar={sf.setQuerDocumento} texto="Quero CPF/CNPJ na nota" />
      {sf.querDocumento ? (
        <Campo
          ref={ref("documento")} testID="campo-documento" rotulo="CPF ou CNPJ" numerico
          placeholder="000.000.000-00" value={sf.customerDocument}
          onChangeText={(t) => sf.setCustomerDocument(maskDocumento(t))} keyboardType="number-pad" inputMode="numeric"
          erro={aviso && !aviso.ok ? aviso.texto : null}
          nota={aviso?.ok ? aviso.texto : "A nota sai no seu nome depois que a loja confirmar o pedido."}
          direita={aviso?.ok ? <Icon name="check" size={16} color={T.green} /> : null}
        />
      ) : null}
    </View>
  );

  // ── Etapa 2 ─────────────────────────────────────────────────
  const retirada = enderecoDeRetirada(store);
  const d = store?.delivery || {};
  const q = sf.shippingQuote;
  const freteTexto = q && typeof q.fee === "number" ? (q.fee > 0 ? dinheiro(q.fee) : "Grátis") : "pelo CEP";
  const etapa2 = (
    <View style={{ gap: 14 }}>
      {entregaEmCasa ? (
        <>
          <Campo
            ref={ref("cep")} testID="campo-cep" rotulo="CEP" numerico placeholder="00000-000"
            value={sf.addressZip} onChangeText={aoDigitarCep} keyboardType="number-pad" inputMode="numeric"
            autoComplete="postal-code" maxLength={9}
            direita={cep.estado === "ok" ? <Icon name="check" size={16} color={T.green} /> : null}
            nota={cep.estado === "buscando" ? "Buscando o endereço…"
              : cep.estado === "nao_achado" ? "Não achamos esse CEP. Confira os números ou digite o endereço."
              : cep.estado === "erro" ? "Não deu para buscar o endereço agora. Digite abaixo."
              : cep.estado === "ok" ? null
              : "Vai retirar na loja? Pode pular."}
          />
          {cep.estado === "ok" && cep.endereco ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: -6 }}>
              <Icon name="check" size={14} color={T.green} />
              <Texto style={{ fontSize: 13, color: T.green }}>{linhaDoBairro(cep.endereco)}</Texto>
            </View>
          ) : null}
          {foraDaArea ? (
            <Nota tom="vermelho" icone="alert" testID="fora-da-area">
              {`${q?.error || "Fora da área de entrega"}${q?.distance_km ? ` (${q.distance_km} km da loja)` : ""}. Dá para retirar na loja${modos.some((m) => m.tipo === "courier") ? " ou mandar buscar por app" : ""}.`}
            </Nota>
          ) : null}
        </>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel="Como você quer receber?" style={{ gap: 12 }}>
        {modos.map((m) => {
          if (m.tipo === "pickup") {
            return (
              <Opcao
                key="pickup" testID="opcao-pickup" titulo="Retirar na loja" icone="store" preco="Grátis" precoCor={T.green}
                detalhe={[retirada, d.pickup_eta_text || `Pronto para retirar em ${diasUteis(c.prazo)} após a aprovação da arte.`].filter(Boolean).join("\n")}
                escolhida={entrega === "pickup"} onEscolher={() => escolherEntrega("pickup")}
              />
            );
          }
          if (m.tipo === "delivery") {
            const escolhida = entrega === "delivery";
            return (
              <Opcao
                key="delivery" testID="opcao-delivery" titulo="Receber em casa" icone="truck"
                preco={foraDaArea ? "—" : freteTexto} precoCor={q && q.fee === 0 ? T.green : undefined}
                detalhe={foraDaArea ? "Não entregamos nesse CEP."
                  : q?.eta || d.delivery_eta_text || (sf.quotingShipping ? "Calculando o frete…" : "Digite o CEP para ver o frete e o prazo.")}
                escolhida={escolhida} desligada={foraDaArea}
                onEscolher={() => {
                  escolherEntrega("delivery");
                  if (digitos(sf.addressZip).length !== 8) setTimeout(() => campos.current.cep?.focus?.(), 0);
                }}
              >
                {escolhida ? (
                  <>
                    {cep.estado === "ok" && !editarEndereco && sf.addressStreet ? (
                      <View style={{ flexDirection: "row", gap: 10, backgroundColor: FUNDO_SUAVE, borderRadius: 12, padding: 14 }}>
                        <Icon name="location" size={16} color={T.ink} />
                        <View style={{ flex: 1 }}>
                          <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink }}>{sf.addressStreet}</Texto>
                          <Texto style={{ fontSize: 13.5, color: T.ink2 }}>{linhaDoBairro({ bairro: sf.addressNeigh, cidade: sf.addressCity, uf: sf.addressState })}</Texto>
                        </View>
                        <Pressable onPress={() => setEditarEndereco(true)} accessibilityRole="button" accessibilityLabel="Alterar o endereço" style={{ minHeight: 36, justifyContent: "center" }}>
                          <Texto style={{ fontSize: 13, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Alterar</Texto>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <Campo ref={ref("rua")} rotulo="Rua" placeholder="Rua ou avenida" value={sf.addressStreet} onChangeText={sf.setAddressStreet} autoComplete="street-address" />
                        <Campo ref={ref("bairro")} rotulo="Bairro" value={sf.addressNeigh} onChangeText={sf.setAddressNeigh} />
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}><Campo ref={ref("cidade")} rotulo="Cidade" value={sf.addressCity} onChangeText={sf.setAddressCity} /></View>
                          <View style={{ width: 84 }}><Campo ref={ref("uf")} rotulo="UF" value={sf.addressState} onChangeText={sf.setAddressState} autoCapitalize="characters" maxLength={2} /></View>
                        </View>
                      </>
                    )}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ width: "40%" }}>
                        <Campo ref={ref("numero")} testID="campo-numero" rotulo="Número" placeholder="123" value={sf.addressNumber} onChangeText={sf.setAddressNumber} keyboardType="number-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Campo rotulo="Complemento" opcional placeholder="Apto, bloco" value={sf.addressComplement} onChangeText={sf.setAddressComplement} />
                      </View>
                    </View>
                  </>
                ) : null}
              </Opcao>
            );
          }
          const escolhida = entrega === "courier";
          return (
            <Opcao
              key="courier" testID="opcao-courier" titulo="Retirada por app" icone="moto" preco="pago no app"
              detalhe={`Você chama um Uber Flash ou 99 Entrega até a loja quando estiver pronto.`}
              escolhida={escolhida} onEscolher={() => escolherEntrega("courier")}
            >
              {escolhida ? (
                <>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Icon name="shield" size={15} color={T.ink2} />
                    <Texto style={{ flex: 1, fontSize: 13, lineHeight: 19, color: T.ink2 }}>
                      Por que pedimos: a {nomeDaLoja} só entrega a sua peça para quem você indicar aqui. O frete você paga direto no app.
                    </Texto>
                  </View>
                  {!sf.courierInformarDepois ? (
                    <>
                      <Campo ref={ref("courierNome")} testID="campo-entregador" rotulo="Nome de quem vai buscar" value={sf.courierName} onChangeText={sf.setCourierName} />
                      <Campo
                        ref={ref("courierPlaca")} testID="campo-placa" rotulo="Placa do veículo" numerico autoCapitalize="characters"
                        value={sf.courierPlate} onChangeText={(t) => sf.setCourierPlate(maskPlate(t))}
                        nota="Carro ou moto. Exemplo: ABC-1234 ou ABC-1D23."
                      />
                    </>
                  ) : (
                    <Nota tom="info" icone="info">
                      {`Sem problema. Quando chamar o app, mande o nome e a placa para a ${nomeDaLoja} pelo WhatsApp — a loja só entrega para quem você indicar.`}
                    </Nota>
                  )}
                  <Caixinha
                    testID="informo-depois" marcada={sf.courierInformarDepois} onTrocar={sf.setCourierInformarDepois}
                    texto="Ainda não sei quem vai buscar — informo depois"
                  />
                </>
              ) : null}
            </Opcao>
          );
        })}
      </View>
    </View>
  );

  // ── Etapa 3 ─────────────────────────────────────────────────
  const semPix = c.subtotal + c.frete;
  const parc = parcelasDoPreco(semPix, store?.payment?.card_max_installments);
  const entregaResumo = entrega === "pickup" ? `Retirar na loja${retirada ? " · " + retirada : ""}`
    : entrega === "delivery" ? `Receber em casa · ${[sf.addressStreet, sf.addressNumber].filter(Boolean).join(", ")}`
    : entrega === "courier" ? `Retirada por app${sf.courierInformarDepois ? " · informo depois quem busca" : sf.courierName ? " · " + sf.courierName : ""}`
    : "";
  const etapa3 = (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Como você quer pagar?" style={{ gap: 12 }}>
        {formas.map((f) => {
          const escolher = () => { escolheuPagamento.current = true; sf.setPaymentMethod(f.forma); };
          if (f.forma === "pix") {
            const comDesc = c.descontoSeForPix > 0;
            return (
              <Opcao
                key="pix" testID="opcao-pix" titulo="Pix" icone="pix"
                selo={comDesc ? `−${String(c.pixPct).replace(".", ",")}%` : null}
                preco={dinheiro(semPix - c.descontoSeForPix)} riscado={comDesc ? dinheiro(semPix) : null}
                detalhe={`Aprovação na hora.${comDesc ? ` Você economiza ${dinheiro(c.descontoSeForPix)}.` : ""} O código vale por 72 horas.`}
                escolhida={forma === "pix"} onEscolher={escolher}
              />
            );
          }
          if (f.forma === "card") {
            return (
              <Opcao
                key="card" testID="opcao-cartao" titulo="Cartão de crédito" icone="credit_card" preco={dinheiro(semPix)}
                detalhe={`${parc ? `Até ${parc.vezes}x de ${dinheiro(parc.valor)} sem juros. ` : ""}Você paga no Mercado Pago e volta pra cá.`}
                escolhida={forma === "card"} onEscolher={escolher}
              />
            );
          }
          return (
            <Opcao
              key="od" testID="opcao-na-retirada" titulo={f.titulo} icone="cash" preco={dinheiro(semPix)}
              detalhe={entrega === "delivery" ? "Dinheiro ou maquininha, na hora da entrega." : "Dinheiro ou maquininha, na hora de retirar."}
              escolhida={forma === "on_delivery"} onEscolher={escolher}
            />
          );
        })}
      </View>

      <View style={{ borderWidth: 1, borderColor: T.border, borderRadius: 16, backgroundColor: T.card, marginTop: 6 }}>
        {[
          { rotulo: "Seus dados", texto: [sf.customerName.trim(), sf.customerPhone].filter(Boolean).join(" · "), ir: 1 as Etapa },
          { rotulo: "Entrega", texto: entregaResumo, ir: 2 as Etapa },
        ].map((b, i) => (
          <View key={b.rotulo} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: T.border }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Numero style={{ fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: T.ink3 }}>{b.rotulo}</Numero>
              <Texto style={{ fontSize: 14, color: T.ink }}>{b.texto}</Texto>
            </View>
            <Pressable onPress={() => irPara(b.ir)} accessibilityRole="button" accessibilityLabel={"Alterar " + b.rotulo.toLowerCase()} style={{ minHeight: 44, justifyContent: "center" }}>
              <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Alterar</Texto>
            </Pressable>
          </View>
        ))}
      </View>

      {comRecado ? (
        <Campo
          rotulo={`Recado para a ${nomeDaLoja}`} opcional multiline placeholder="Algo importante para a loja saber?"
          value={sf.notes} onChangeText={sf.setNotes} style={{ minHeight: 84, paddingTop: 12, textAlignVertical: "top" } as any}
        />
      ) : (
        <Pressable onPress={() => setComRecado(true)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}>
          <Icon name="plus" size={15} color={T.ink} />
          <Texto style={{ fontSize: 14, fontWeight: "700", color: T.ink, textDecorationLine: "underline" }}>Adicionar um recado para a {nomeDaLoja}</Texto>
        </Pressable>
      )}
    </View>
  );

  const titulos: Record<Etapa, string> = { 1: "Seus dados", 2: "Como você quer receber?", 3: "Como você quer pagar?" };
  const revisoes = fraseDasRevisoes(store?.revisions);

  const pe = (
    <View style={{ gap: 10 }}>
      {sf.error ? <Nota tom="vermelho" icone="alert" testID="erro-do-checkout">{sf.error}</Nota> : null}
      {etapa === 3 ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Icon name="eye" size={15} color={T.ink2} />
          <Texto style={{ fontSize: 13, lineHeight: 18, color: T.ink2, textAlign: "center", flexShrink: 1 }}>{revisoes}</Texto>
        </View>
      ) : null}
      {larga && etapa > 1 ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 120 }}><Botao titulo="Voltar" variante="secundario" icone="chevron_left" onPress={voltar} /></View>
          <View style={{ flex: 1 }}>{botaoPrincipal}</View>
        </View>
      ) : botaoPrincipal}
    </View>
  );

  const formulario = (
    <View
      style={larga
        ? { backgroundColor: T.card, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 28, gap: 20 }
        : { paddingHorizontal: 16, paddingTop: 20, gap: 20 }}
    >
      {recadoDoPendente ? (
        <Nota tom="ambar" icone="clock">
          {`O pedido ${numeroDoPedido(recadoDoPendente.order_number)} continua esperando o pagamento. Se não for pago, cancela sozinho em 72 horas.`}
        </Nota>
      ) : null}
      <View style={{ gap: 4 }}>
        <Numero style={{ fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: T.ink3 }}>Etapa {etapa} de 3</Numero>
        <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: larga ? 26 : 27, lineHeight: 33, color: T.ink }}>
          {titulos[etapa]}
        </Texto>
      </View>
      {etapa === 1 ? etapa1 : etapa === 2 ? etapa2 : etapa3}
      <LinhaDeProtecao />
      {larga ? pe : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }} testID="checkout-em-etapas">
      <Cabecalho sf={sf} etapa={etapa} onVoltar={voltar} larga={larga} />
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: larga ? 48 : 28 }} keyboardShouldPersistTaps="handled">
        <BarraDeEtapas etapa={etapa} onIr={irPara} />
        {larga ? (
          <View style={{ flexDirection: "row", gap: 24, width: "100%", maxWidth: 1040, alignSelf: "center", paddingHorizontal: 24, alignItems: "flex-start" }}>
            <View style={{ flex: 1, minWidth: 0 }}>{formulario}</View>
            <View style={{ width: 360, position: Platform.OS === "web" ? ("sticky" as any) : "relative", top: 16 }}>
              <ResumoLateral sf={sf} c={c} tipo={entrega} forma={forma} etapa={etapa} />
            </View>
          </View>
        ) : (
          <>
            <ResumoRecolhivel sf={sf} c={c} tipo={entrega} forma={forma} etapa={etapa} />
            {formulario}
          </>
        )}
      </ScrollView>
      <BarraDeCookies />
      {!larga ? (
        <View style={{ backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
          {pe}
        </View>
      ) : null}
      {pendente ? (
        <AvisoDePedidoPendente
          pendente={pendente}
          larga={larga}
          onContinuar={() => { const t = pendente.token; setPendente(null); if (t) sf.irParaPedido(t); }}
          onNovo={() => { setRecadoDoPendente(pendente); setPendente(null); }}
        />
      ) : null}
    </View>
  );
}
