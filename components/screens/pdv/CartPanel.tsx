// ============================================================
// AURA. -- PDV/Caixa · Cart panel (header + body + foot)
// Violet glass hero with big total, items list with qty controls,
// payment chips, summary rows, and Limpar/Orçamento/Finalizar CTAs.
//
// Mai/2026:
//   · Input "CPF na nota" com validação mod-11
//   · Modo "Dividir pagamento" com lista de N entradas (NFC-e payments[])
//   · CartItem ganha lixeira (confirm 2-cliques) + edição inline do preço
//   · CartItem em 2 linhas (1: avatar+nome+total+trash, 2: preço+qty)
//     pra preço/qty/total não competirem por espaço em sidebar estreita
//
// 17/06/2026 (Davi 13-15"): rodapé crescia (pagamento+split+resumo+CPF+
//   hint+CTAs 2 linhas) e empurrava o "Finalizar venda" pra fora da tela.
//   FIX estrutural: tudo que pode crescer (chips, split, resumo, CPF) foi
//   pra DENTRO do ScrollView. O rodapé fixo agora tem só o aviso de bloqueio
//   + a barra de CTAs — então "Finalizar venda" fica SEMPRE visível,
//   independente de altura de tela, zoom, split ou CPF.
//   17/06 (tarde): bloco de checkout ancorado ao FUNDO do scroll (espaçador
//   flex:1 + flexGrow no contentContainer) pra não deixar vazio enorme entre
//   o checkout e o rodapé quando há pouco conteúdo.
//   17/06 (noite): prop `fill` — o "esticar + ancorar no fundo" só vale quando
//   o painel tem altura limitada (desktop). No mobile (sem fill) o carrinho
//   fica em altura natural e a página rola — senão o espaçador estica e cria
//   um vazio gigante (report Davi no zoom 100% / janela estreita).
//
// 29/08/2026 (QA do Caixa):
//   · `finalizeDisabled` virou prop. O caminho visual de bloqueio existia mas
//     nunca era acionado — o pai não passava nada e o botão ficava com cara de
//     clicável mesmo faltando cliente/vendedora/caixa aberto.
//   · `requiredHints` deixou de ser texto morto: cada aviso pode carregar um
//     `onPress` que abre o seletor correspondente.
//
// 22/09/2026 (Matcon M0 — docs/matcon-faseamento-po-ux.md §2):
//   · A quantidade do item passa a ser dirigida pela UNIDADE do produto, e só
//     com `matcon_enabled` ligado. Unidade fracionada (m, m², m³, kg, g, L,
//     ml, ton) → campo decimal mono tabular com o sufixo da unidade ao lado,
//     sem os botões − +, porque ninguém clica 25 vezes pra chegar em 12,5 m².
//     Qualquer outro caso → o stepper de sempre.
//   · Com o toggle on, o teto do stepper sobe de 3 pra 6 dígitos (1.200
//     tijolos cabem). Com o toggle OFF nada muda: stepper, parseInt,
//     replace(/\D/g,"") e maxLength 3, item por item, unidade por unidade.
//   · Abaixo do campo decimal, e só quando "arredondar para embalagem" está
//     ligado na config e o produto tem fator de compra, entra a linha
//     "= 6 caixas · 13,92 m² · sobra 1,42 m²". Ela INFORMA — não mexe na
//     quantidade vendida (decisão de produto, registrada no contrato).
//   · O botão "calcular ambiente" do mockup é M3. Não está aqui, nem como
//     placeholder.
//
// 22/09/2026 (Matcon M1 — docs/matcon-faseamento-po-ux.md §3, mockup
// docs/mockups/matcon-modulo.html #carrinho "Salvar orçamento"):
//   · QA em produção (22/09, decisão do Caio): o quarto botão do M1 sobrecarregava
//     o rodapé (4 CTAs numa linha só, "Salvar orç…" truncando). Voltou a três
//     botões sempre — Limpar / Orçamento / Finalizar venda. Com matcon_enabled
//     + onSaveQuote, o botão "Orçamento" passa a SALVAR (onSaveQuote) em vez de
//     imprimir; sem Matcon ele continua imprimindo (onGenerateQuote), igual
//     sempre foi. `onSaveQuote`/`savedQuote`/`savingQuote` continuam OPCIONAIS.
//     Toda a chamada de API/wa.me/markQuoteSent vive em hooks/useMatconQuote.ts;
//     este componente só dispara o handler e mostra o card de sucesso.
//   · Carrinho vazio desabilita o botão (mesma regra do "Finalizar venda").
//   · O card "Orçamento #N salvo" ganhou "Imprimir" (onGenerateQuote, o
//     gerador de sempre) ao lado de "Enviar no WhatsApp" e "Ver orçamentos"
//     (era "Ver na esteira" — texto de tela é língua do lojista).
// ============================================================
import { Fragment, forwardRef, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly, accentForProduct, productLetter, fmtCurrency, fmtInt } from "./types";
import { MerchantLogo, useMerchantBrand } from "./MerchantLogo";
import { validateCpf, maskCpf, onlyDigits } from "@/lib/validators";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { readMatconSettings } from "@/constants/matcon";
import { parseQtyInput, fmtQty } from "@/utils/matconUnits";
import { usaCampoDecimal, qtyMaxLength, fraseDeEmbalagem, usaCalculadoraAmbiente, usaLoteNoItem } from "./matconQty";
import { CalculadoraAmbiente } from "@/components/matcon/CalculadoraAmbiente";
import { LoteDoItem } from "@/components/matcon/LotePicker";
import type { LotAllocation } from "@/services/matconApi";

export type CartDisplayItem = {
  productId: string;
  productBaseId: string;
  name: string;
  price: number;
  qty: number;
  listPrice?: number;
  // 22/09/2026 (Matcon M0). Os três são opcionais: item sem unidade — que é
  // o caso de todo mundo hoje — renderiza o stepper de sempre.
  unit?: string | null;
  purchaseUnit?: string | null;
  purchaseFactor?: number | null;
};

export type PayChip = { key: string; label: string; icon: string };

/** 22/09/2026 (Matcon M1). Card "Orçamento #N salvo" do rodapé — monta e
 *  controla em hooks/useMatconQuote.ts, o CartPanel só renderiza. */
export type SavedQuoteCard = {
  number: number;
  /** "29/09" — já formatado (o CartPanel não sabe de fuso/parse de data). */
  validUntilLabel: string;
  total: number;
  onSendWhatsApp: () => void;
  onViewEsteira: () => void;
  onDismiss?: () => void;
};

/** Aviso de bloqueio do rodapé. Quando traz `onPress`, o aviso vira botão e
 *  leva direto ao seletor que resolve a pendência (29/08/2026). */
export type RequiredHint = { label: string; onPress?: () => void };

// Mantido isolado de useCart pra evitar dep ciclica e permitir uso standalone.
export type SplitEntry = { method: string; value: number; change?: number };

type Props = {
  orderNumber?: string | null;
  items: CartDisplayItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  payMethods: PayChip[];
  activePay: string;
  onPay: (k: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onSetQty?: (id: string, qty: number) => void;
  onPriceChange?: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onFinalize: () => void;
  onGenerateQuote?: () => void;
  /** 22/09/2026 (Matcon M4). Devolve as alocações por lote do item — vira
   *  `items[].lot_allocations` no POST /pdv/sale (useCart.setLotAllocations).
   *  Opcional: sem ele a linha do lote continua aparecendo, só não viaja
   *  na venda (o backend baixa FIFO, que é o default do contrato). */
  onLotAllocations?: (id: string, allocations: LotAllocation[]) => void;
  showOrcamento?: boolean;
  // 22/09/2026 (Matcon M1). Todos opcionais — sem eles o rodapé é o de hoje.
  onSaveQuote?: () => void;
  savingQuote?: boolean;
  savedQuote?: SavedQuoteCard | null;
  discountLabel?: string | null;
  isProcessing?: boolean;
  /** Bloqueio "de requisito" (cliente/vendedora/caixa). Deixa o botão com
   *  aparência inativa mas AINDA clicável — ver comentário em finalizeInactive. */
  finalizeDisabled?: boolean;
  requiredHints?: (string | RequiredHint)[];
  emptyCta?: string;
  headerSubtitle?: string | null;
  /** Densidade reduzida (carrinho estreito): CTAs em 2 linhas. */
  compact?: boolean;
  /** Painel com altura limitada (desktop): corpo rola e o checkout ancora no
   *  fundo. No mobile (sem fill) o painel tem altura natural e a página rola. */
  fill?: boolean;
  // CPF na nota (NFC-e). Opcional — se passado, mostra o input.
  cpfNaNota?: string;
  onCpfNaNotaChange?: (v: string) => void;

  // Multi-pagamento (opcional). Se onToggleSplit não passar, modo split fica oculto.
  splitMode?: boolean;
  splitPayments?: SplitEntry[];
  splitRemaining?: number;
  splitIsBalanced?: boolean;
  onToggleSplit?: () => void;
  onAddSplitPayment?: () => void;
  onUpdateSplitPayment?: (idx: number, patch: Partial<SplitEntry>) => void;
  onRemoveSplitPayment?: (idx: number) => void;
};

const HEAD_INK = "#ffffff";
const HEAD_INK_SOFT = "rgba(255,255,255,0.9)";
const HEAD_INK_DIM = "rgba(255,255,255,0.65)";
const HEAD_INK_DIMMER = "rgba(255,255,255,0.55)";

export const CartPanel = forwardRef<any, Props>(function CartPanel(props, headRef) {
  const {
    orderNumber, items, subtotal, discountAmount, total, itemCount,
    payMethods, activePay, onPay,
    onInc, onDec, onSetQty, onPriceChange, onRemove, onClear, onFinalize, onGenerateQuote,
    onLotAllocations,
    showOrcamento, onSaveQuote, savingQuote, savedQuote,
    discountLabel, isProcessing, finalizeDisabled, requiredHints,
    emptyCta, headerSubtitle, compact, fill,
    cpfNaNota, onCpfNaNotaChange,
    splitMode, splitPayments, splitRemaining, splitIsBalanced,
    onToggleSplit, onAddSplitPayment, onUpdateSplitPayment, onRemoveSplitPayment,
  } = props;

  const marca = useMerchantBrand();
  // 22/09/2026 (Matcon M0): o toggle e o "arredondar para embalagem" vêm de
  // pdv_settings. Loja sem Matcon lê `matcon_enabled: false` (o default do
  // readMatconSettings) e daqui pra baixo nada do Matcon existe.
  const { settings: pdvSettings } = usePdvSettings();
  const matcon = useMemo(() => readMatconSettings(pdvSettings), [pdvSettings]);
  const showCpfInput = onCpfNaNotaChange !== undefined;
  const splitAvailable = onToggleSplit !== undefined; // fica off quando o pai não wireou
  const splitOn = !!splitMode && splitAvailable;

  // Estado de validação CPF: só avalia quando temos 11 dígitos.
  // Antes disso fica neutro (sem indicador, sem border colorido).
  const cpfState = useMemo<"empty" | "incomplete" | "valid" | "invalid">(() => {
    const d = onlyDigits(cpfNaNota || "");
    if (d.length === 0) return "empty";
    if (d.length < 11) return "incomplete";
    return validateCpf(d) ? "valid" : "invalid";
  }, [cpfNaNota]);

  const cpfBorderColor =
    cpfState === "valid" ? "rgba(34,197,94,0.55)" :
    cpfState === "invalid" ? "rgba(239,68,68,0.55)" :
    Glass.lineBorderCard;

  // ── Bloqueio do "Finalizar venda" em DOIS níveis (29/08/2026) ──────────────
  // 1) HARD (`disabled` de verdade no Pressable): estados em que apertar não
  //    tem resposta útil e ainda pode fazer estrago — venda em processamento
  //    (duplo POST), carrinho vazio, split que não fecha com o total. O
  //    handleFinalize do hook NÃO barra split desbalanceado sem crediário, então
  //    tirar o `disabled` aqui deixaria passar venda com pagamento errado.
  // 2) INATIVO (só aparência): bloqueio por requisito — cliente/vendedora/caixa
  //    fechado, vindo de `finalizeDisabled`. Aqui o botão CONTINUA clicável de
  //    propósito: handleFinalize mostra o toast explicando o que falta. Se
  //    desabilitássemos o Pressable, o lojista clicaria e não aconteceria
  //    absolutamente nada — pior do que o bug original.
  const finalizeHardBlocked = !!isProcessing || items.length === 0 || (splitOn && !splitIsBalanced);
  const finalizeInactive = finalizeHardBlocked || !!finalizeDisabled;

  // Avisos de bloqueio normalizados (aceita string pura por retrocompat).
  const hints: RequiredHint[] = useMemo(
    () => (requiredHints || []).map(h => (typeof h === "string" ? { label: h } : h)),
    [requiredHints],
  );

  return (
    <View
      style={[
        s.cart,
        Platform.OS === "web"
          ? ({
              background: Glass.cardMid,
              backdropFilter: "blur(20px) saturate(150%)",
              WebkitBackdropFilter: "blur(20px) saturate(150%)",
              borderLeft: "1px solid " + Glass.lineBorderCard,
            } as any)
          : { backgroundColor: Colors.bg2, borderLeftWidth: 1, borderLeftColor: Colors.border },
      ]}
    >
      {/* HEAD */}
      <View
        ref={headRef as any}
        style={[
          s.head,
          Platform.OS === "web"
            ? ({
                background: Glass.cartHeadGrad,
                borderBottom: "1px solid " + Glass.lineBorderCard,
              } as any)
            : { backgroundColor: Colors.violet, borderBottomWidth: 1, borderBottomColor: Colors.border },
        ]}
      >
        {IS_WEB && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              right: "-30%",
              width: "80%",
              height: "200%",
              background:
                "radial-gradient(ellipse, rgba(167,139,250,0.45), transparent 60%)",
              animation: "caixaHeroShift 12s ease-in-out infinite",
              pointerEvents: "none",
            } as any}
          />
        )}
        <View style={s.headRow}>
          <Text style={s.headLabel}>Total da venda</Text>
          {orderNumber ? <Text style={s.headOrd}>{orderNumber}</Text> : null}
        </View>
        <View style={s.totalRow}>
          <Text style={s.cur}>R$ </Text>
          <Text style={s.totalInt}>{fmtInt(Math.floor(total))}</Text>
          <Text style={s.cents}>
            ,{String(Math.round((total - Math.floor(total)) * 100)).padStart(2, "0")}
          </Text>
        </View>
        <View style={s.meta}>
          <View>
            <Text style={s.metaK}>Itens</Text>
            {/* Com unidade fracionada a soma vira 22,5 — fmtQty escreve em
                pt-BR. Fora do Matcon fica o número cru de sempre. */}
            <Text style={s.metaV}>{matcon.matcon_enabled ? fmtQty(itemCount) : itemCount}</Text>
          </View>
          <View>
            <Text style={s.metaK}>Desconto</Text>
            <Text style={[s.metaV, { color: discountAmount > 0 ? "#b9f6ca" : HEAD_INK }]}>
              {discountAmount > 0 ? "− " + fmtCurrency(discountAmount) : "R$ 0,00"}
            </Text>
          </View>
          <View>
            <Text style={s.metaK}>Pagamento</Text>
            <Text style={[s.metaV, { color: "#e9d5ff", textTransform: "uppercase" }]}>
              {splitOn ? `${splitPayments?.length || 0}× SPLIT` : activePay}
            </Text>
          </View>
        </View>
        {headerSubtitle ? <Text style={s.subtitle}>{headerSubtitle}</Text> : null}
      </View>

      {/* BODY — rola tudo que pode crescer: itens + pagamento + divisão +
          resumo + CPF. O "Finalizar venda" fica fixo no FOOT, sempre visível.
          Só ancora o checkout no fundo (espaçador) quando fill (desktop). */}
      <ScrollView style={s.body} contentContainerStyle={fill ? { padding: 14, paddingHorizontal: 16, flexGrow: 1 } : { padding: 14, paddingHorizontal: 16 }}>
        {items.length === 0 ? (
          <View style={s.empty}>
            {/* 16/09/2026 (Fase 0 · I0.3): é aqui que a marca da loja fica em
                destaque de verdade — cabeçalho de recibo no carrinho vazio.
                Sai assim que o primeiro item entra, e não custa um pixel da
                altura da grade de produtos. */}
            <MerchantLogo size={120} dim />
            {marca.name ? <Text style={s.emptyLoja}>{marca.name}</Text> : null}
            <Text style={s.emptyTxt}>Carrinho vazio</Text>
            <Text style={[s.emptyTxt, { marginTop: 4, fontWeight: "400", color: Colors.ink3 }]}>
              {emptyCta || "Clique em um produto para adicionar"}
            </Text>
          </View>
        ) : (
          items.map(it => (
            <CartItem
              key={it.productId}
              item={it}
              onInc={() => onInc(it.productId)}
              onDec={() => onDec(it.productId)}
              onRemove={() => onRemove(it.productId)}
              onQtySet={qty => onSetQty?.(it.productId, qty)}
              onPriceChange={onPriceChange ? (price => onPriceChange(it.productId, price)) : undefined}
              matconEnabled={matcon.matcon_enabled}
              roundToPackage={matcon.matcon_round_to_package}
              defaultWastePct={matcon.matcon_default_waste_pct}
              lotsEnabled={matcon.matcon_lots_enabled}
              onLotAllocations={onLotAllocations}
            />
          ))
        )}

        {/* Espaçador flexível (só no modo fill/desktop): empurra o checkout pro
            fundo da área de rolagem quando há pouco conteúdo (sem vazio entre
            checkout e rodapé). Com muitos itens colapsa pra 0 e tudo rola. No
            mobile (sem fill) NÃO entra — senão estica e cria vazio gigante. */}
        {fill && <View style={{ flex: 1, minHeight: 14 }} />}

        {/* ── Pagamento / divisão / resumo / CPF (rolam junto) ─────────── */}
        <View style={s.checkoutBlock}>
          {/* Payment chips — só quando NÃO está em modo split */}
          {!splitOn && (
            <View style={s.payGrid}>
              {payMethods.map(m => {
                const isActive = activePay === m.key;
                const webChip = webOnly({
                  background: isActive ? "rgba(124,58,237,0.22)" : Glass.lineFaint,
                  border: isActive ? "1px solid rgba(124,58,237,0.5)" : "1px solid " + Glass.lineBorderCard,
                  color: isActive ? (IS_DARK_MODE ? "#fff" : Colors.ink) : Colors.ink2,
                  transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
                  cursor: "pointer",
                  boxShadow: isActive ? "0 4px 12px rgba(124,58,237,0.3)" : "none",
                });
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => onPay(m.key)}
                    style={[
                      s.payChip,
                      isActive && s.payChipActive,
                      Platform.OS === "web" ? (webChip as any) : null,
                    ] as any}
                  >
                    <Icon name={m.icon as any} size={15} color={isActive ? (IS_DARK_MODE ? "#fff" : Colors.violet) : Colors.ink2} />
                    <Text style={[s.payLabel, isActive && { color: IS_DARK_MODE ? "#fff" : Colors.ink }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Toggle "Dividir pagamento" — só aparece quando o pai wireou. */}
          {splitAvailable && (
            <Pressable onPress={onToggleSplit} style={s.splitToggle}>
              <Icon name={splitOn ? "x" : "wallet"} size={13} color={Colors.violet3} />
              <Text style={s.splitToggleTxt}>
                {splitOn ? "Cancelar divisão" : "Dividir pagamento"}
              </Text>
            </Pressable>
          )}

          {/* Lista de splits */}
          {splitOn && (
            <View style={s.splitPanel}>
              {(splitPayments || []).map((entry, idx) => (
                <SplitRow
                  key={idx}
                  entry={entry}
                  methods={payMethods}
                  onChangeMethod={(method) => onUpdateSplitPayment?.(idx, { method })}
                  onChangeValue={(value) => onUpdateSplitPayment?.(idx, { value })}
                  onRemove={() => onRemoveSplitPayment?.(idx)}
                  canRemove={(splitPayments?.length || 0) > 1}
                />
              ))}
              <Pressable onPress={onAddSplitPayment} style={s.splitAdd}>
                <Icon name="plus" size={14} color={Colors.violet3} />
                <Text style={s.splitAddTxt}>Adicionar pagamento</Text>
              </Pressable>

              {/* Status balance */}
              <View style={[
                s.splitStatus,
                splitIsBalanced
                  ? { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)" }
                  : { backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.35)" },
              ]}>
                <Icon
                  name={splitIsBalanced ? "check" : "alert"}
                  size={12}
                  color={splitIsBalanced ? "#22c55e" : Colors.amber}
                />
                <Text style={[s.splitStatusTxt, { color: splitIsBalanced ? "#22c55e" : Colors.amber }]}>
                  {splitIsBalanced
                    ? "Pronto · soma fecha com o total"
                    : (splitRemaining || 0) > 0
                      ? `Faltam ${fmtCurrency(splitRemaining || 0)}`
                      : `Sobrando ${fmtCurrency(Math.abs(splitRemaining || 0))}`}
                </Text>
              </View>
            </View>
          )}

          {/* Summary */}
          <View style={s.sumRow}>
            <Text style={s.sumK}>Subtotal</Text>
            <Text style={s.sumV}>{fmtCurrency(subtotal)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={[s.sumK, discountAmount > 0 && { color: Colors.green }]}>
              Desconto{discountLabel ? " · " + discountLabel : ""}
            </Text>
            <Text style={[s.sumV, discountAmount > 0 && { color: Colors.green }]}>
              {discountAmount > 0 ? "− " + fmtCurrency(discountAmount) : "R$ 0,00"}
            </Text>
          </View>
          <View style={[s.sumRow, s.sumRowTotal]}>
            <Text style={{ fontSize: 13, color: Colors.ink2, fontWeight: "700" }}>Total</Text>
            <Text style={[s.sumV, { color: Colors.violet3, fontSize: 15 }]}>{fmtCurrency(total)}</Text>
          </View>

          {/* CPF na nota (NFC-e) — input opcional, aparece só quando wirado.
              Indicador visual de validação mod-11 ao lado direito quando 11 dígitos.
              FIX: paddingVertical movido do cpfRow pro cpfInput para que toda a
              área visual do row seja clicável (antes o padding ficava no View e
              clicks na borda não focavam o TextInput). */}
          {showCpfInput && (
            <>
              <View style={[s.cpfRow, { borderColor: cpfBorderColor }]}>
                <Icon name="file_text" size={14} color={Colors.ink3} />
                <Text style={s.cpfLabel}>CPF na nota</Text>
                <TextInput
                  style={[
                    s.cpfInput,
                    IS_WEB && (webOnly({ cursor: "text" }) as any),
                  ]}
                  value={cpfNaNota || ""}
                  onChangeText={(v) => onCpfNaNotaChange?.(maskCpf(v))}
                  placeholder="(opcional)"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="number-pad"
                  maxLength={14}
                />
                {cpfState === "valid" && (
                  <View style={[s.cpfBadge, { backgroundColor: "rgba(34,197,94,0.18)" }]}>
                    <Icon name="check" size={12} color="#22c55e" />
                  </View>
                )}
                {cpfState === "invalid" && (
                  <View style={[s.cpfBadge, { backgroundColor: "rgba(239,68,68,0.18)" }]}>
                    <Icon name="x" size={12} color="#ef4444" />
                  </View>
                )}
              </View>
              {cpfState === "invalid" && (
                <Text style={s.cpfErr}>CPF inválido — confira os dígitos</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FOOT — fixo, sempre visível: aviso de bloqueio + barra de CTAs.
          (Finalizar nunca mais sai da tela, mesmo em telas baixas / zoom.) */}
      <View
        style={[
          s.foot,
          Platform.OS === "web"
            ? ({ background: Glass.cardDeep, borderTop: "1px solid " + Glass.lineBorderCard } as any)
            : { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
        ]}
      >
        {/* Required hints — fica no rodapé pra o motivo do bloqueio aparecer
            ao lado do botão inativo (ex.: "Caixa fechado").
            29/08/2026: cada aviso com `onPress` vira botão e abre o seletor que
            resolve a pendência. Nada de hover-reveal (CLAUDE.md #7): o chip já
            nasce visível, com borda e seta, e é tocável direto no dedo. */}
        {/* 22/09/2026 (Matcon M1): card "Orçamento #N salvo" — só com o
            toggle ligado e depois de salvar. Fica ACIMA dos hints/CTAs pra
            não sumir atrás do aviso de bloqueio. */}
        {matcon.matcon_enabled && savedQuote && (
          <View style={s.quoteCard} testID="matcon-orcamento-salvo-card">
            <View style={s.quoteCardHead}>
              <Text style={s.quoteCardTitle} numberOfLines={1}>
                Orçamento #{savedQuote.number} salvo.
              </Text>
              {savedQuote.onDismiss && (
                <Pressable onPress={savedQuote.onDismiss} hitSlop={8}>
                  <Icon name="x" size={13} color={Colors.violet3} />
                </Pressable>
              )}
            </View>
            <Text style={s.quoteCardSub}>
              Vale até {savedQuote.validUntilLabel} · {fmtCurrency(savedQuote.total)}
            </Text>
            <View style={s.quoteCardActs}>
              <Pressable onPress={savedQuote.onSendWhatsApp} style={s.quoteCardWaBtn}>
                <Icon name="send" size={12} color="#fff" />
                <Text style={s.quoteCardWaTxt} numberOfLines={1}>Enviar no WhatsApp</Text>
              </Pressable>
              {onGenerateQuote && (
                <Pressable testID="matcon-orcamento-imprimir" onPress={onGenerateQuote} style={s.quoteCardGhostBtn}>
                  <Text style={s.quoteCardGhostTxt} numberOfLines={1}>Imprimir</Text>
                </Pressable>
              )}
              <Pressable onPress={savedQuote.onViewEsteira} style={s.quoteCardGhostBtn}>
                <Text style={s.quoteCardGhostTxt} numberOfLines={1}>Ver orçamentos</Text>
              </Pressable>
            </View>
          </View>
        )}

        {hints.length > 0 && (
          <View style={s.hintsBox}>
            <Icon name="alert" size={11} color={Colors.amber} />
            <View style={s.hintsList}>
              {hints.map((h, i) => (
                <Fragment key={h.label}>
                  {i > 0 && <Text style={s.hintsSep}>·</Text>}
                  {h.onPress ? (
                    <Pressable
                      onPress={h.onPress}
                      accessibilityRole="button"
                      accessibilityLabel={h.label + " — tocar para resolver"}
                      style={[
                        s.hintChip,
                        IS_WEB && (webOnly({ cursor: "pointer" }) as any),
                      ] as any}
                    >
                      <Text style={s.hintChipTxt} numberOfLines={1}>{h.label}</Text>
                      <Icon name="chevron_right" size={10} color={Colors.amber} />
                    </Pressable>
                  ) : (
                    <Text style={s.hintsTxt} numberOfLines={1}>{h.label}</Text>
                  )}
                </Fragment>
              ))}
            </View>
          </View>
        )}

        {/* CTA row — em carrinho estreito (compact) o "Finalizar venda"
            ganha a própria linha, largura cheia, e Limpar/Orçamento dividem
            a linha de cima. Evita truncar/estourar fora da tela. */}
        {(() => {
          const clearBtn = (
            <Pressable onPress={onClear} style={[s.ctaSec]}>
              <Text style={s.ctaSecTxt} numberOfLines={1}>Limpar</Text>
            </Pressable>
          );
          // 22/09/2026 (Matcon M1, revisto no QA de 22/09): um botão só,
          // "Orçamento". Com matcon_enabled + onSaveQuote ele SALVA (mesma
          // regra de desabilitar do "Finalizar venda": carrinho vazio ou
          // savingQuote — spinner no lugar do texto). Sem Matcon, ou sem
          // onSaveQuote, ele continua imprimindo via onGenerateQuote, do
          // jeito que sempre foi.
          const quoteSaveMode = matcon.matcon_enabled && !!onSaveQuote;
          const quoteBtn = quoteSaveMode ? (
            <Pressable
              testID="cta-salvar-orcamento"
              onPress={onSaveQuote}
              disabled={!!savingQuote || items.length === 0}
              style={[s.ctaAlt, (savingQuote || items.length === 0) && { opacity: 0.5 }]}
            >
              {savingQuote ? (
                <ActivityIndicator color={Colors.violet3} size="small" />
              ) : (
                <>
                  <Icon name="clipboard" size={15} color={Colors.violet3} />
                  <Text style={s.ctaAltTxt} numberOfLines={1}>Orçamento</Text>
                </>
              )}
            </Pressable>
          ) : showOrcamento && onGenerateQuote ? (
            <Pressable onPress={onGenerateQuote} disabled={!!isProcessing} style={[s.ctaAlt, isProcessing && { opacity: 0.5 }]}>
              <Icon name="file_text" size={15} color={Colors.violet3} />
              <Text style={s.ctaAltTxt} numberOfLines={1}>Orçamento</Text>
            </Pressable>
          ) : null;
          const finalizeBtn = (
            <Pressable
              onPress={onFinalize}
              disabled={finalizeHardBlocked}
              aria-disabled={finalizeInactive}
              accessibilityRole="button"
              accessibilityState={{ disabled: finalizeInactive, busy: !!isProcessing }}
              style={[
                s.ctaPri,
                compact ? s.ctaPriFull : s.ctaPriRow,
                Platform.OS === "web"
                  ? ({
                      background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                      boxShadow: finalizeInactive
                        ? "none"
                        : "0 8px 20px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                      position: "relative",
                      overflow: "hidden",
                      // Clicável (o toast explica o que falta) mas o cursor já
                      // avisa que a venda não vai fechar assim.
                      cursor: finalizeInactive ? "not-allowed" : "pointer",
                    } as any)
                  : { backgroundColor: Colors.violet },
                finalizeInactive && { opacity: 0.5 },
              ]}
            >
              {/* Brilho animado só quando o botão está de fato liberado —
                  botão inativo que pisca sugere ação que não vai acontecer. */}
              {IS_WEB && !finalizeInactive && (
                <span
                  aria-hidden
                  style={{
                    content: '"',
                    position: "absolute",
                    top: 0,
                    left: "-100%",
                    width: "100%",
                    height: "100%",
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                    animation: "caixaShine 3s ease-in-out infinite",
                    pointerEvents: "none",
                  } as any}
                />
              )}
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={s.ctaPriTxt} numberOfLines={1}>Finalizar venda</Text>
                </>
              )}
            </Pressable>
          );

          if (compact) {
            return (
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={s.ctaRowTop}>
                  {clearBtn}
                  {quoteBtn}
                </View>
                {finalizeBtn}
              </View>
            );
          }
          return (
            <View style={s.ctaRow}>
              {clearBtn}
              {quoteBtn}
              {finalizeBtn}
            </View>
          );
        })()}
      </View>
    </View>
  );
});

// ── Linha do split: chips de método + input valor + remover ─────
function SplitRow({
  entry, methods, onChangeMethod, onChangeValue, onRemove, canRemove,
}: {
  entry: SplitEntry;
  methods: PayChip[];
  onChangeMethod: (m: string) => void;
  onChangeValue: (v: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  // Edição de valor com buffer local (evita rerender em cada tecla quando user digita "12,50")
  const [buf, setBuf] = useState<string | null>(null);
  const isEditing = buf !== null;
  const display = isEditing ? buf! : entry.value.toFixed(2).replace(".", ",");

  function handleCommit() {
    if (buf !== null) {
      const cleaned = buf.replace(",", ".").replace(/[^\d.]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n >= 0) onChangeValue(n);
    }
    setBuf(null);
  }

  return (
    <View style={s.splitRow}>
      {/* Mini chips de método */}
      <View style={s.splitChips}>
        {methods.map(m => {
          const active = entry.method === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => onChangeMethod(m.key)}
              style={[s.splitChip, active && s.splitChipActive]}
            >
              <Icon name={m.icon as any} size={11} color={active ? Colors.violet : Colors.ink3} />
              <Text style={[s.splitChipTxt, active && { color: Colors.violet, fontWeight: "700" }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Valor */}
      <View style={s.splitValBox}>
        <Text style={s.splitValPrefix}>R$</Text>
        <TextInput
          style={s.splitValInput}
          value={display}
          onFocus={() => setBuf(entry.value.toFixed(2).replace(".", ","))}
          onChangeText={(v) => setBuf(v.replace(/[^\d,.]/g, ""))}
          onBlur={handleCommit}
          onSubmitEditing={handleCommit}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
      </View>

      {/* Remover */}
      {canRemove ? (
        <Pressable onPress={onRemove} style={s.splitRemove}>
          <Icon name="x" size={12} color={Colors.ink3} />
        </Pressable>
      ) : (
        <View style={s.splitRemove} />
      )}
    </View>
  );
}

// ── CartItem em 2 linhas ─────────────────────────────────────
// Linha 1: [avatar] [nome flex:1]                  [total] [trash]
// Linha 2:          [R$ unit ✏]    spacer    [- qty +]
// Avatar ocupa só linha 1; linha 2 alinha à esquerda do nome (indent).
function parseCurrencyInput(raw: string): number | null {
  const sanitized = raw.replace(/[^\d,.]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
  if (!normalized) return null;
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function CartItem({
  item, onInc, onDec, onRemove, onQtySet, onPriceChange,
  matconEnabled, roundToPackage, defaultWastePct, lotsEnabled, onLotAllocations,
}: {
  item: CartDisplayItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onQtySet: (qty: number) => void;
  onPriceChange?: (price: number) => void;
  /** 22/09/2026 (Matcon M0). Opcionais com default = comportamento de hoje:
   *  quem renderiza o CartItem sem passar nada continua no stepper. */
  matconEnabled?: boolean;
  roundToPackage?: boolean;
  /** 22/09/2026 (Matcon M3). Perda padrão da config, sugerida na
   *  calculadora de ambiente. Só chega aqui com o toggle ligado. */
  defaultWastePct?: number;
  /** 22/09/2026 (Matcon M4). Frase da config "Controlo lote e tonalidade…".
   *  Sem ela (o default de toda loja) o item não tem linha de lote nem
   *  dispara a busca dos lotes. */
  lotsEnabled?: boolean;
  onLotAllocations?: (id: string, allocations: LotAllocation[]) => void;
}) {
  // Campo decimal só quando toggle on E a unidade é fracionada (§2 do doc).
  const decimalQty = usaCampoDecimal(!!matconEnabled, item.unit);
  const qtyMaxLen = qtyMaxLength(!!matconEnabled, item.unit);
  const fraseEmbalagem = fraseDeEmbalagem({
    matconEnabled: !!matconEnabled,
    roundToPackage: !!roundToPackage,
    qty: item.qty,
    unit: item.unit,
    purchaseUnit: item.purchaseUnit,
    purchaseFactor: item.purchaseFactor,
  });
  // 22/09/2026 (Matcon M3, §4b): o botão "calcular ambiente" só existe em
  // produto de piso — unidade m², com o toggle ligado. No cimento em "sc"
  // ele não aparece: ninguém calcula ambiente de saco.
  const temCalculadora = usaCalculadoraAmbiente(!!matconEnabled, item.unit);
  const [calcAberta, setCalcAberta] = useState(false);
  // 22/09/2026 (Matcon M4, mockup #carrinho): a linha "lote 27B · 95,12 m²
  // disponíveis" + o aviso dos lotes. Todo o componente (inclusive a busca
  // dos lotes) só existe quando o gate está ligado E o produto é vendido em
  // m²/m³ — cimento em "sc" nunca vê nada disso.
  const temLote = usaLoteNoItem(!!matconEnabled, !!lotsEnabled, item.unit);

  // Buffer pra edição de qty
  const [inputVal, setInputVal] = useState<string | null>(null);
  const isEditing = inputVal !== null;

  // Buffer pra edição de preço
  const [priceBuf, setPriceBuf] = useState<string | null>(null);
  const isEditingPrice = priceBuf !== null;

  // Lixeira: 2 cliques (1o vira vermelho/alerta, 2o deleta dentro de 2s)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<any>(null);

  function handleFocus() {
    // No campo decimal o buffer abre já em pt-BR ("12,5"), que é o que o
    // vendedor vê — e o parseQtyInput lê de volta a vírgula sem reclamar.
    setInputVal(decimalQty ? fmtQty(item.qty) : String(item.qty));
  }

  function handleCommit() {
    if (inputVal !== null) {
      if (decimalQty) {
        // parseQtyInput aceita "12,5", "12.5" e "1.200,5"; devolve null pra
        // vazio/zero/lixo — e aí o campo só volta pro valor que já estava.
        const dec = parseQtyInput(inputVal);
        if (dec !== null && dec !== item.qty) onQtySet(dec);
      } else {
        const n = parseInt(inputVal, 10);
        if (!isNaN(n) && n > 0 && n !== item.qty) {
          onQtySet(n);
        }
      }
    }
    setInputVal(null);
  }

  function handlePriceFocus() {
    if (!onPriceChange) return;
    setPriceBuf(item.price.toFixed(2).replace(".", ","));
  }

  function commitPriceBuffer(buf: string | null) {
    if (buf === null || !onPriceChange) return;
    const n = parseCurrencyInput(buf);
    if (n !== null && n !== item.price) onPriceChange(n);
  }

  function handlePriceChangeText(v: string) {
    const next = v.replace(/[^\d,.]/g, "");
    setPriceBuf(next);
    // Atualiza o carrinho enquanto o caixa digita. Assim, se ele clicar em
    // "Finalizar" sem sair do campo, o POST /pdv/sale e a NFC-e já usam o
    // valor editado em vez do preço original do estoque.
    commitPriceBuffer(next);
  }

  function handlePriceCommit() {
  commitPriceBuffer(priceBuf);
  setPriceBuf(null);
  }

  function handleDeletePress() {
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmDelete(false);
      onRemove();
      return;
    }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2000);
  }

  const accent = accentForProduct(item.productBaseId);
  const letter = productLetter(item.name);
  // Lápis = desconto: se o preço efetivo ficou abaixo do preço de tabela
  // (listPrice), mostra o preço cheio riscado + o % de desconto.
  const hasDiscount = item.listPrice != null && item.listPrice > item.price + 0.001;
  const discPct = hasDiscount ? Math.round((1 - item.price / (item.listPrice as number)) * 100) : 0;
  const imgBg = webOnly({
    background:
      "radial-gradient(circle at 30% 30%, " +
      accent +
      "55, " +
      accent +
      "18)",
    border: "1px solid " + accent + "40",
  });

  return (
    <View style={s.item}>
      {/* Linha 1: avatar | nome | total | trash */}
      <View style={s.itemRow1}>
        <View style={[s.itemImg, Platform.OS === "web" ? (imgBg as any) : { backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "44" }]}>
          <Text style={s.itemLetter}>{letter}</Text>
        </View>
        <Text numberOfLines={1} style={s.itemName}>
          {item.name}
        </Text>
        <Text style={s.itemPrice} numberOfLines={1}>
          {fmtCurrency(item.price * item.qty)}
        </Text>
        <Pressable
          onPress={handleDeletePress}
          style={[s.itemTrash, confirmDelete && s.itemTrashConfirm]}
        >
          <Icon
            name={confirmDelete ? "alert" : "trash"}
            size={13}
            color={confirmDelete ? "#ef4444" : Colors.ink3}
          />
        </Pressable>
      </View>

      {/* Linha 2: indent | preço unitário editável | spacer | qtyCtrl */}
      <View style={s.itemRow2}>
        <View style={s.itemIndent} />
        {isEditingPrice ? (
          <View style={s.priceEditRow}>
            <Text style={s.priceEditPrefix}>R$</Text>
            <TextInput
              style={s.priceEditInput}
              value={priceBuf!}
              onChangeText={handlePriceChangeText}
              onBlur={handlePriceCommit}
              onSubmitEditing={handlePriceCommit}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
          </View>
        ) : onPriceChange ? (
          <Pressable onPress={handlePriceFocus} style={s.priceEditableTouch}>
            {hasDiscount && (
              <Text style={s.itemMetaStrike} numberOfLines={1}>
                {fmtCurrency(item.listPrice as number)}
              </Text>
            )}
            <Text style={[s.itemMeta, hasDiscount && s.itemMetaDiscounted]} numberOfLines={1}>
              {fmtCurrency(item.price)}
            </Text>
            {hasDiscount && (
              <Text style={s.itemDiscBadge} numberOfLines={1}>−{discPct}%</Text>
            )}
            <Icon name="edit" size={9} color={Colors.violet3} />
          </Pressable>
        ) : (
          <Text style={s.itemMeta} numberOfLines={1}>
            {fmtCurrency(item.price)}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {decimalQty ? (
          /* Campo decimal: o número se digita, não se clica. Sem − e +,
             com o sufixo da unidade em fonte menor ao lado (mockup .dec). */
          <View style={s.decCtrl}>
            <TextInput
              testID={"carrinho-qty-" + item.productId}
              style={[
                s.decVal,
                IS_WEB && (webOnly({ outline: "none", cursor: "text" }) as any),
              ]}
              value={isEditing ? inputVal! : fmtQty(item.qty)}
              onFocus={handleFocus}
              onChangeText={v => setInputVal(v.replace(/[^\d.,]/g, ""))}
              onBlur={handleCommit}
              onSubmitEditing={handleCommit}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={qtyMaxLen}
            />
            <Text style={s.decUnit}>{item.unit}</Text>
          </View>
        ) : (
          <View style={s.qtyCtrl}>
            <Pressable testID={"carrinho-dec-" + item.productId} onPress={onDec} style={s.qtyBtn}>
              <Text style={s.qtyBtnTxt}>−</Text>
            </Pressable>
            <TextInput
              testID={"carrinho-qty-" + item.productId}
              style={[
                s.qtyVal,
                IS_WEB && (webOnly({ outline: "none", cursor: "text" }) as any),
              ]}
              value={isEditing ? inputVal! : String(item.qty)}
              onFocus={handleFocus}
              onChangeText={v => setInputVal(v.replace(/\D/g, ""))}
              onBlur={handleCommit}
              onSubmitEditing={handleCommit}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={qtyMaxLen}
            />
            <Pressable testID={"carrinho-inc-" + item.productId} onPress={onInc} style={s.qtyBtn}>
              <Text style={s.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Linha 3 (só Matcon): "= 6 caixas · 13,92 m² · sobra 1,42 m²".
          É o momento "olha isso" do M0 (§4b do doc) — e é só informação:
          a venda continua sendo os 12,5 m² que o vendedor digitou. */}
      {fraseEmbalagem || temCalculadora ? (
        <View style={s.itemRow3}>
          <View style={s.itemIndent} />
          {fraseEmbalagem ? (
            <Text testID={"carrinho-embalagem-" + item.productId} style={s.pkgHint} numberOfLines={2}>
              {fraseEmbalagem}
            </Text>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }} />
          )}
          {/* Sempre visível (regra 7 do CLAUDE.md): nada de hover-reveal —
              no balcão a venda é no dedo, em tela de toque. */}
          {temCalculadora ? (
            <Pressable
              testID={"carrinho-calcular-" + item.productId}
              onPress={() => setCalcAberta(true)}
              style={s.calcBtn}
              accessibilityLabel={"Calcular ambiente de " + item.name}
            >
              <Icon name="calculator" size={11} color={Colors.violet3} />
              <Text style={s.calcBtnTxt} numberOfLines={1}>calcular ambiente</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Linha 4 (só M4): de qual lote sai o material, e o aviso quando a
          quantidade não cabe em um lote só. Nunca bloqueia a venda. */}
      {temLote ? (
        <LoteDoItem
          productId={item.productBaseId}
          productName={item.name}
          unit={item.unit || ""}
          qty={item.qty}
          purchaseFactor={item.purchaseFactor}
          purchaseUnit={item.purchaseUnit}
          onAllocations={onLotAllocations ? (allocs => onLotAllocations(item.productId, allocs)) : undefined}
        />
      ) : null}

      {/* A folha do M3: sobe no celular, vira balão no computador. Devolve a
          quantidade pelo mesmo caminho do campo decimal (onQtySet). */}
      {temCalculadora ? (
        <CalculadoraAmbiente
          visible={calcAberta}
          onClose={() => setCalcAberta(false)}
          productName={item.name}
          unit={item.unit || "m²"}
          purchaseUnitLabel={item.purchaseUnit}
          purchaseFactor={item.purchaseFactor}
          defaultWastePct={defaultWastePct ?? 0}
          onUse={qty => onQtySet(qty)}
        />
      ) : null}
    </View>
  );
}

const ITEM_AVATAR = 32;
const ITEM_AVATAR_GAP = 8;

const s = StyleSheet.create({
  cart: { flex: 1, flexDirection: "column", overflow: "hidden" },
  head: { flexShrink: 0, padding: 18, paddingHorizontal: 20, position: "relative", overflow: "hidden" },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headLabel: { fontSize: 9, fontWeight: "700", color: HEAD_INK_DIM, letterSpacing: 1.5, textTransform: "uppercase" },
  // 29/08/2026: não é mais um número de venda (a venda ainda nem existe no
  // backend) — é um rótulo de estado. Saiu do monospace pra não ser lido como
  // número fiscal.
  headOrd: { color: "#e9d5ff", fontSize: 9, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  totalRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, marginBottom: 6 },
  cur: { fontSize: 20, color: HEAD_INK, opacity: 0.75, marginRight: 6, lineHeight: 40, fontWeight: "400" },
  totalInt: { fontSize: 40, color: HEAD_INK, fontWeight: "700", letterSpacing: -1, lineHeight: 42 },
  cents: { fontSize: 20, color: HEAD_INK, opacity: 0.8, lineHeight: 40, fontWeight: "500" },
  meta: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)" },
  metaK: { fontSize: 9, fontWeight: "700", color: HEAD_INK_DIMMER, letterSpacing: 1, textTransform: "uppercase" },
  metaV: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 12, color: HEAD_INK, fontWeight: "700", marginTop: 3 },
  subtitle: { fontSize: 10, color: HEAD_INK_DIMMER, marginTop: 10 },
  body: { flex: 1, minHeight: 0 },
  empty: { alignItems: "center", padding: 40, paddingHorizontal: 20, gap: 4 },
  emptyLoja: { color: Colors.ink, fontSize: 14, fontWeight: "700", letterSpacing: 0.2, textAlign: "center", marginTop: 12, marginBottom: 6 },
  emptyTxt: { color: Colors.ink2, fontSize: 12, fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700", textAlign: "center" },
  // Bloco de checkout que agora rola junto com os itens (pagamento+resumo+CPF).
  // Separador no topo pra destacar do fim da lista de itens.
  checkoutBlock: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Glass.lineSoft },
  // CartItem 2-linhas. Linha 1: avatar+nome+total+trash. Linha 2: preço+qty.
  item: {
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Glass.lineFaint,
  },
  itemRow1: { flexDirection: "row", alignItems: "center", gap: ITEM_AVATAR_GAP },
  itemRow2: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  itemIndent: { width: ITEM_AVATAR + ITEM_AVATAR_GAP, flexShrink: 0 },
  itemImg: { width: ITEM_AVATAR, height: ITEM_AVATAR, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemLetter: { fontSize: 12, color: "#ffffff", fontWeight: "700", textShadowColor: "rgba(0,0,0,0.25)" as any, textShadowRadius: Platform.OS === "web" ? 4 : 0 as any },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flex: 1, minWidth: 0 },
  itemMeta: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 10.5, color: Colors.ink3, letterSpacing: 0.2 },
  itemMetaStrike: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 10, color: Colors.ink3, letterSpacing: 0.2, textDecorationLine: "line-through", opacity: 0.7 },
  itemMetaDiscounted: { color: Colors.green, fontWeight: "700" },
  itemDiscBadge: { fontSize: 9, fontWeight: "800", color: Colors.green, backgroundColor: Colors.green + "1A", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  // Edição inline do preço — Pressable que vira TextInput
  priceEditableTouch: {
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  priceEditRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.bg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  priceEditPrefix: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  priceEditInput: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 11, color: Colors.ink, fontWeight: "700",
    minWidth: 60, paddingVertical: 0,
    textAlign: "right",
  },
  // Linha 3 (Matcon): a frase das embalagens, indentada como a linha 2.
  itemRow3: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  pkgHint: {
    flex: 1, minWidth: 0,
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 10.5, color: Colors.violet3, fontWeight: "600", letterSpacing: 0.2,
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  // Botão "calcular ambiente" (M3): mesma linha da frase das embalagens,
  // encolhe antes dela e nunca some.
  calcBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0,
    marginLeft: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border2,
    backgroundColor: Colors.bg3,
  },
  calcBtnTxt: { fontSize: 10.5, fontWeight: "700", color: Colors.violet3, letterSpacing: 0.2 },
  // Campo decimal do Matcon (mockup .dec): borda violeta, número à direita e
  // a unidade em fonte menor ao lado. Sem − e + de propósito.
  decCtrl: {
    flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: Glass.lineSoft, borderRadius: 7,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.45)",
  },
  decVal: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 13, color: Colors.ink, fontWeight: "700",
    minWidth: 52, textAlign: "right", paddingVertical: 0,
  },
  decUnit: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 10, color: Colors.ink3, fontWeight: "600",
  },
  // qtyCtrl tem espaço próprio na linha 2 — sem aperto.
  qtyCtrl: { flexDirection: "row", alignItems: "center", gap: 4, padding: 2, backgroundColor: Glass.lineSoft, borderRadius: 7, flexShrink: 0 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Glass.lineFaint, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { color: Colors.ink, fontWeight: "700", fontSize: 14 },
  qtyVal: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 13, color: Colors.ink, fontWeight: "700", minWidth: 18, textAlign: "center", paddingHorizontal: 2 },
  // Total à direita da linha 1, sem competir com qtyCtrl.
  itemPrice: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 13, color: Colors.violet3, fontWeight: "700", textAlign: "right", flexShrink: 0 },
  // Lixeira: estado normal e estado de confirm (2o clique deleta)
  itemTrash: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
    flexShrink: 0,
  },
  itemTrashConfirm: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.45)",
  },
  foot: { flexShrink: 0, padding: 12, paddingHorizontal: 16, paddingBottom: 16 },
  // 5 chips em uma linha (gap menor + paddingHorizontal menor pra crediário caber).
  payGrid: { flexDirection: "row", gap: 4, marginBottom: 10, flexWrap: "wrap" },
  payChip: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 9, minWidth: 56 },
  payChipActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  payLabel: { fontSize: 9.5, color: Colors.ink2, fontWeight: "600" },
  // Toggle "Dividir pagamento" — link sutil (não compete com chips)
  splitToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 6, marginBottom: 8,
    alignSelf: "center",
  },
  splitToggleTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  // Painel de splits
  splitPanel: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: Glass.lineFaint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Glass.lineBorderCard,
    gap: 8,
  },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  splitChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  splitChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 4, paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: Glass.lineSoft,
    borderWidth: 1, borderColor: "transparent",
  },
  splitChipActive: { backgroundColor: Colors.violetD, borderColor: "rgba(124,58,237,0.4)" },
  splitChipTxt: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  splitValBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.bg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 4,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    minWidth: 88,
  },
  splitValPrefix: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  splitValInput: {
    flex: 1, textAlign: "right",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12, color: Colors.ink, fontWeight: "700",
    paddingVertical: 0,
  },
  splitRemove: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  splitAdd: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(124,58,237,0.4)",
  },
  splitAddTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  splitStatus: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1,
  },
  splitStatusTxt: { fontSize: 10, fontWeight: "700", flex: 1 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sumRowTotal: { paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: Glass.lineSoft },
  sumK: { fontSize: 12, color: Colors.ink2, fontWeight: "500" },
  sumV: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", color: Colors.ink, fontWeight: "700", fontSize: 12 },
  // FIX: paddingVertical removido do cpfRow e movido pro cpfInput.
  // Antes: padding ficava no View → clicks na borda do row não focavam o input.
  // Agora: input é o elemento que define a altura, toda a área visual é clicável.
  cpfRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10,
    backgroundColor: Glass.lineFaint, borderRadius: 8,
    marginTop: 10, borderWidth: 1,
  },
  cpfLabel: {
    fontSize: 11, color: Colors.ink3, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  cpfInput: {
    flex: 1, alignSelf: "stretch", textAlign: "right",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12, color: Colors.ink, fontWeight: "600",
    paddingVertical: 8,
  },
  cpfBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cpfErr: {
    fontSize: 10, color: "#ef4444", fontWeight: "600",
    marginTop: 4, marginLeft: 4,
  },
  hintsBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.amberD, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" },
  hintsList: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  hintsTxt: { fontSize: 10, color: Colors.amber, fontWeight: "600" },
  hintsSep: { fontSize: 10, color: Colors.amber, opacity: 0.5 },
  // Chip tocável: borda + seta deixam claro que resolve ali mesmo, sem hover.
  // Altura mínima de 28 pra ter alvo de toque decente no tablet do balcão.
  hintChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    minHeight: 28, paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1, borderColor: "rgba(251,191,36,0.45)",
  },
  hintChipTxt: { fontSize: 10, color: Colors.amber, fontWeight: "700" },
  ctaRow: { flexDirection: "row", gap: 8 },
  ctaRowTop: { flexDirection: "row", gap: 8 },
  ctaPriRow: { flex: 1.7 },
  ctaPriFull: { alignSelf: "stretch", width: "100%" },
  ctaSec: { flex: 1, height: 46, borderRadius: 12, backgroundColor: Glass.lineFaint, borderWidth: 1, borderColor: Glass.lineBorderCard, alignItems: "center", justifyContent: "center" },
  ctaSecTxt: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  ctaAlt: { flex: 1.3, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Glass.lineFaint, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  ctaAltTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  // Card "Orçamento #N salvo" — mockup docs/mockups/matcon-modulo.html
  // (bloco "Salvar orçamento" do #carrinho).
  quoteCard: {
    backgroundColor: Colors.violetD, borderRadius: 10, borderWidth: 1, borderColor: "rgba(124,58,237,0.35)",
    padding: 10, marginBottom: 10, gap: 6,
  },
  quoteCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  quoteCardTitle: { fontSize: 12.5, color: Colors.ink, fontWeight: "800", flex: 1 },
  quoteCardSub: { fontSize: 11.5, color: Colors.ink2, fontWeight: "500" },
  // 22/09/2026 (QA): três ações agora (Enviar/Imprimir/Ver orçamentos) — em
  // carrinho estreito não cabem numa linha só, então quebra com flexWrap.
  quoteCardActs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  quoteCardWaBtn: {
    flexGrow: 1, flexBasis: 150, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    height: 34, borderRadius: 8, backgroundColor: "#25D366",
  },
  quoteCardWaTxt: { fontSize: 11.5, color: "#fff", fontWeight: "700" },
  quoteCardGhostBtn: {
    flexGrow: 1, flexBasis: 90, minWidth: 80, alignItems: "center", justifyContent: "center", height: 34, borderRadius: 8,
    backgroundColor: Glass.lineFaint, borderWidth: 1, borderColor: Glass.lineBorderCard,
  },
  quoteCardGhostTxt: { fontSize: 11.5, color: Colors.ink, fontWeight: "700" },
  ctaPri: { height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaPriTxt: { fontSize: 13, color: "#fff", fontWeight: "700", letterSpacing: 0.3 },
});

export default CartPanel;
