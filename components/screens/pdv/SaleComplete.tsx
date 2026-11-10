// ============================================================
// AURA. — components/screens/pdv/SaleComplete.tsx
//
// 25/05/2026 — Refatorado: bloco de emissão NFC-e extraído pra
// <NfceActions/> (componente reutilizado também no Step5Success da
// Troca). Zero mudança de UX — mesma tela, mesmos botoes.
//
// 29/08/2026 — Acabamento pós-QA: UUID cru virou "Código da venda"
// (8 caracteres, copiável), check de sucesso virou ícone de verdade,
// plural com concordância e rótulo neutro "Quem vendeu".
//
// 01/09/2026 — O backend passou a devolver `sale.sale_number` (sequencial
// por empresa, começa em 1). O recibo agora mostra "Nº 170" sob o rótulo
// "Número da venda"; o UUID encurtado ficou só como fallback pra venda
// sem número (ambiente não migrado). O toque continua copiando o UUID
// inteiro — é o que o suporte pede.
//
// 23/09/2026 (QA em produção) — a conta fecha na tela: subtotal, desconto e
// total vêm do que o POST /pdv/sale gravou (useCart → contaComOServidor).
// Antes, com cupom e preço no cartão/dividido, a tela mostrava o cupom do
// dinheiro (R$ 201,60) sobre o subtotal rateado e o banco gravava R$ 216,02.
// O desconto manual ganhou a própria linha — subtotal − cupom − desconto =
// total, sempre.
//
// 23/09/2026 (QA Matcon, com o backend no ar) — a venda de orçamento diz
// "Entrega nº 1 criada para 25/09 — acompanhe em Entregas" (toque abre
// /matcon/entregas) e a venda indicada diz "Abbey ganhou 10 pontos com
// esta venda". As frases vêm de ./matconDaVenda.ts a partir de
// `sale.matcon` (resposta do POST); sem `matcon`, nada muda na tela.
//
// 09/11/2026 (entrega, parte 2 — mockup "Entrega no Caixa", F) — a venda
// com endereço ganha a linha "Entrega" e a caixinha "Imprimir papel de
// entrega": marcada quando há frete, desmarcada sem frete (aparece só se o
// cliente já tem endereço). Bobina ou A4, lembrado no computador. Marcada,
// o botão vira "Imprimir cupom e entrega" e tudo sai numa janela só
// (utils/entregaDaVenda.ts). Desmarcada, o cupom é pedido exatamente como
// antes, na mesma rota.
//
// 10/11/2026 (NFS-e automática — mockup nfse-cadastro-servico.html, tela 4)
// — loja com a emissão automática ligada e venda com serviço: dois cartões,
// "Cupom fiscal (NFC-e) — produtos" (o NfceActions de sempre; o backend
// tira os serviços da nota, Aura-backend#983) e "Nota de serviço (NFS-e) —
// serviços" (components/nfse/NfseVendaCard, polling leve da situação), mais
// a ajuda fiscal. Venda só de produto ou loja sem o opt-in: tela igual.
// ============================================================
import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { copyText } from "@/utils/clipboard";
import { pluralize } from "@/utils/plural";
import type { SaleResult } from "@/hooks/useCart";
import { PAYMENTS } from "@/hooks/useCart";
import { NfceActions, type NfceActionsItem } from "./NfceActions";
import { OsActions } from "./OsActions";
import { WarrantySaleActions } from "./WarrantySaleActions";
import { openPrintWindow } from "@/services/printWindow";
import type { NfcePaymentEntry } from "@/services/nfceApi";
import { router } from "expo-router";
import { frasesMatconDaVenda } from "./matconDaVenda";
import { cupomComVale } from "@/utils/valeTrocaCupom";
import { NOME_DO_FRETE } from "@/utils/frete";
import type { ConfigDoVale } from "@/utils/valeTroca";
import { resumoDoEndereco, type Endereco } from "@/components/endereco/endereco";
import { useNfseAutomaticaConfig } from "@/hooks/useNfseAutomatica";
import { composicaoDaVenda, ehServico, mascararDoc, rotuloDoDoc } from "@/utils/nfseAutomatica";
import { NfseVendaCard } from "@/components/nfse/NfseVendaCard";
import { AjudaFiscal } from "@/components/nfse/AjudaFiscal";
import {
  caixinhaDaEntrega, encadearPapelA4, gravarFormatoDoPapel, lerFormatoDoPapel, rotaDoCupom, rotaDoPapelA4,
  type FormatoDoPapel,
} from "@/utils/entregaDaVenda";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function paymentLabel(key: string): string {
  return PAYMENTS.find(p => p.key === key)?.label || key;
}

/**
 * `papel`: null = só o cupom (a rota de sempre). "bobina" = o papel depois
 * do cupom, no mesmo documento. "a4" = o cupom e, quando a impressão dele
 * fecha, o papel em A4 na MESMA janela. Um pop-up só nos três casos.
 */
function openPrintReceipt(companyId: string, saleId: string, token: string | null, vendaEm: Date, config?: ConfigDoVale, papel: FormatoDoPapel | null = null) {
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressão disponível apenas na versão web");
    return;
  }
  // Fix 10/07 (relato Davi): janela abre SINCRONA no clique (printWindow) —
  // window.open depois do await perdia a user activation e o Chrome
  // bloqueava o pop-up de forma intermitente ("nem sempre imprime").
  openPrintWindow(async () => {
    const res = await fetch(rotaDoCupom(BASE_URL, companyId, saleId, papel === "bobina"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false as const, error: "Erro ao gerar cupom" };
    // 13/10/2026: vendas de nov/dez saem com o bloco "Vale-troca" (QR) — ver
    // utils/valeTroca.ts. Fora do período, ou com a loja desligando, o HTML do
    // backend segue intacto.
    let html = cupomComVale(await res.text(), { companyId, saleId, vendaEm, config });
    if (papel === "a4") {
      // O papel em A4 é buscado já, e a própria janela do cupom navega para
      // ele depois de imprimir (o Chrome bloquearia um segundo pop-up).
      try {
        const r2 = await fetch(rotaDoPapelA4(BASE_URL, companyId, saleId), { headers: { Authorization: `Bearer ${token}` } });
        if (r2.ok) {
          const url = URL.createObjectURL(new Blob([await r2.text()], { type: "text/html" }));
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10 * 60_000);
          html = encadearPapelA4(html, url);
        } else {
          toast.error("O cupom vai sair, mas não deu para gerar o papel de entrega.");
        }
      } catch {
        toast.error("O cupom vai sair, mas não deu para gerar o papel de entrega.");
      }
    }
    return { ok: true as const, html };
  }).then((r) => {
    if (r === "blocked") toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  });
}

type Props = {
  sale: SaleResult;
  onNewSale: () => void;
  /** Se true, dispara nfceApi.emit() automaticamente no mount.
      Lido de nfce_config.auto_emit_nfce pela tela do PDV. */
  autoEmit?: boolean;
  /** 22/09/2026 (QA Matcon). Sem uso desde 23/09/2026 — "N produtos"
   *  conta linhas, em qualquer loja. Mantido para não mexer em quem chama. */
  matconEnabled?: boolean;
  /** pdv_settings.matcon_default_delivery_days — data da entrega criada. */
  matconDeliveryDays?: number;
  /** Nome de quem indicou (a resposta da venda não traz). */
  referralName?: string | null;
  /** pdv_settings da loja: o vale-troca do cupom lê vale_troca_enabled daqui. */
  pdvSettings?: ConfigDoVale;
  /** 09/11/2026: endereço do cadastro do cliente da venda (venda sem
   *  retrato, ex.: sem frete). null = cliente sem endereço ou sem cliente. */
  enderecoDoCliente?: Endereco | null;
};

export function SaleComplete({ sale, onNewSale, autoEmit, matconDeliveryDays, referralName, pdvSettings, enderecoDoCliente }: Props) {
  const { company, token, companyCount } = useAuthStore();
  // NFS-e automática: opt-in da loja que vendeu (o Caixa é sempre de uma
  // loja — company.id é a empresa da venda, também no grupo multi-CNPJ).
  const { ativa: nfseAtiva } = useNfseAutomaticaConfig(company?.id);
  const composicao = composicaoDaVenda(sale.items);
  const duasNotas = nfseAtiva && composicao.temServico;
  const itensServico = sale.items.filter(ehServico);
  const itensProduto = sale.items.filter((i) => !ehServico(i));
  const nomes = (l: typeof sale.items) => l.map((i) => i.name).join(", ");
  const somar = (l: typeof sale.items) => Math.round(l.reduce((t, i) => t + i.price * i.qty, 0) * 100) / 100;
  const nomeDaLoja = (companyCount || 0) > 1 ? (company?.trade_name || company?.name || null) : null;
  // Instante em que a tela final abriu = o da venda (o vale-troca do cupom
  // vale pelo dia da venda, não pelo da impressão).
  const vendaEm = useRef(new Date()).current;
  const matconFrases = frasesMatconDaVenda(sale.matcon, {
    diasDeEntrega: matconDeliveryDays ?? 2,
    nomeDoIndicado: referralName,
  });
  const cupom = sale.couponDiscount && sale.couponDiscount > 0 ? sale.couponDiscount : 0;
  const manual = sale.manualDiscount && sale.manualDiscount > 0 ? sale.manualDiscount : 0;
  const desconto = sale.discount != null ? sale.discount : cupom + manual;
  const subtotal = sale.subtotal != null
    ? sale.subtotal
    : sale.items.reduce((s, i) => s + i.price * i.qty, 0);
  const hasCoupon = !!(sale.couponCode && cupom > 0);
  const hasDiscount = desconto > 0.004;
  // 30/10/2026 (Frete no Caixa): o frete está dentro do subtotal gravado;
  // a tela mostra os produtos, o frete e o total, cada um na sua linha.
  const frete = sale.frete && sale.frete > 0 ? sale.frete : 0;
  const subtotalProdutos = Math.round((subtotal - frete) * 100) / 100;

  // 09/11/2026: papel de entrega. O endereço da venda vale primeiro; sem
  // ele, o do cadastro do cliente.
  const enderecoDaEntrega = sale.entrega || enderecoDoCliente || null;
  const caixinha = caixinhaDaEntrega({ frete, endereco: enderecoDaEntrega });
  const [comPapel, setComPapel] = useState(caixinha.marcada);
  const [formatoDoPapel, setFormatoDoPapel] = useState<FormatoDoPapel>(() => lerFormatoDoPapel());
  const [estreito, setEstreito] = useState(false);
  const imprimirPapel = caixinha.mostra && comPapel;
  function escolherFormato(f: FormatoDoPapel) {
    setFormatoDoPapel(f);
    gravarFormatoDoPapel(f);
  }

  const hasSplit = !!(sale.payments && sale.payments.length > 0);
  const payments: NfcePaymentEntry[] | undefined = hasSplit
    ? sale.payments!.map(p => ({ method: p.method, value: p.value, change: p.change }))
    : undefined;

  const nfceItems: NfceActionsItem[] = sale.items.map(i => ({
    product_id: i.productId,
    product_name: i.name,
    quantity: i.qty,
    unit_price: i.price,
  }));
  // O frete foi uma linha da venda: vai na nota também, senão a soma dos
  // pagamentos não fecha com os itens.
  if (frete > 0) nfceItems.push({ product_id: "frete", product_name: NOME_DO_FRETE, quantity: 1, unit_price: frete });

  // QA 23/09/2026: conta PRODUTOS (linhas) — somar quantidades misturava
  // unidades (10 m² + 500 tijolos = "510 produtos").
  const totalProdutos = sale.items.length;

  // 01/09/2026 — número de venda de verdade. Vem sequencial POR EMPRESA, então
  // é o que o lojista dita no balcão. Quando vier null (venda de ambiente não
  // migrado) caímos no UUID encurtado, que era o comportamento anterior.
  const hasSaleNumber = typeof sale.saleNumber === "number" && sale.saleNumber > 0;
  const shortSaleId = String(sale.id || "").slice(0, 8).toUpperCase();
  const saleIdLabel = hasSaleNumber ? "Número da venda" : "Código da venda";
  const saleIdValue = hasSaleNumber
    ? `Nº ${sale.saleNumber!.toLocaleString("pt-BR")}`
    : `#${shortSaleId}`;

  function handleCopyId() {
    // Copia o UUID INTEIRO (e não o número/código exibido): o número curto
    // serve pra ditar/anotar no balcão, o UUID é o que o suporte precisa.
    copyText(sale.id, "Código completo copiado");
  }

  function handlePrint() {
    if (!company?.id) return;
    openPrintReceipt(company.id, sale.id, token, vendaEm, pdvSettings, imprimirPapel ? formatoDoPapel : null);
  }

  return (
    <View style={s.container}>
      <View style={s.card} onLayout={(e) => setEstreito(e.nativeEvent.layout.width < 400)}>
        <View style={s.checkCircle}><Icon name="check" size={32} color={Colors.green} /></View>
        <Text style={s.title}>Venda registrada!</Text>
        <Pressable onPress={handleCopyId} style={s.saleIdBox}>
          <Text style={s.saleIdLabel}>{saleIdLabel}</Text>
          <Text style={s.saleId}>{saleIdValue}</Text>
        </Pressable>

        {hasCoupon && (
          <View style={s.couponRow}>
            <View style={s.couponBadge}>
              <Text style={s.couponBadgeText}>{sale.couponCode}</Text>
            </View>
            <Text testID="venda-cupom" style={s.couponDiscount}>-{fmt(cupom)}</Text>
          </View>
        )}

        {(hasDiscount || frete > 0) && (
          <View style={s.row}>
            <Text style={s.label}>Subtotal</Text>
            <Text testID="venda-subtotal" style={hasDiscount ? s.metaStrike : s.meta}>{fmt(subtotalProdutos)}</Text>
          </View>
        )}
        {manual > 0 && (
          <View style={s.row}>
            <Text style={s.label}>Desconto</Text>
            <Text testID="venda-desconto" style={s.meta}>-{fmt(manual)}</Text>
          </View>
        )}
        {frete > 0 && (
          <View style={s.row}>
            <Text style={s.label}>Frete</Text>
            <Text testID="venda-frete" style={s.meta}>{fmt(frete)}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={s.label}>Total</Text>
          <Text testID="venda-total" style={s.value}>{fmt(sale.total)}</Text>
        </View>
        {hasSplit ? (
          <View style={s.splitBox}>
            <Text style={s.splitTitle}>Pagamentos ({payments!.length})</Text>
            {payments!.map((p, i) => (
              <View key={i} style={s.splitLine}>
                <Text style={s.splitMethod}>{paymentLabel(p.method)}</Text>
                <Text style={s.splitValue}>{fmt(p.value)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.row}>
            <Text style={s.label}>Pagamento</Text>
            <Text style={s.meta}>{paymentLabel(sale.payment)}</Text>
          </View>
        )}
        <View style={s.row}>
          <Text style={s.label}>Itens</Text>
          <Text testID="venda-produtos" style={s.meta}>{pluralize(totalProdutos, "produto")}</Text>
        </View>
        {sale.customerName && (
          <View style={s.row}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.meta}>{sale.customerName}</Text>
          </View>
        )}
        {caixinha.mostra && (
          <View style={s.row}>
            <Text style={s.label}>Entrega</Text>
            <Text testID="venda-entrega" style={[s.meta, s.metaDireita]} numberOfLines={2}>{resumoDoEndereco(enderecoDaEntrega)}</Text>
          </View>
        )}
        {duasNotas && sale.tomador ? (
          <View style={s.row}>
            <Text style={s.label}>{rotuloDoDoc(sale.tomador.doc)}</Text>
            <Text testID="venda-doc-tomador" style={s.meta}>{mascararDoc(sale.tomador.doc)}</Text>
          </View>
        ) : sale.cpfNaNota ? (
          <View style={s.row}>
            <Text style={s.label}>CPF na nota</Text>
            <Text style={s.meta}>{sale.cpfNaNota}</Text>
          </View>
        ) : null}
        {sale.employeeName && (
          <View style={s.row}>
            <Text style={s.label}>Quem vendeu</Text>
            <Text style={s.meta}>{sale.employeeName}</Text>
          </View>
        )}

        {(matconFrases.entrega || matconFrases.pontos) && (
          <View style={s.matconBox}>
            {matconFrases.entrega && (
              <Pressable
                onPress={() => router.push("/matcon/entregas" as any)}
                style={s.matconLinha}
                accessibilityRole="link"
                testID="venda-matcon-entrega"
              >
                <Icon name="truck" size={14} color={Colors.violet3} />
                <Text style={s.matconTexto}>{matconFrases.entrega}</Text>
              </Pressable>
            )}
            {matconFrases.pontos && (
              <View style={s.matconLinha} testID="venda-matcon-pontos">
                <Icon name="tag" size={14} color={Colors.violet3} />
                <Text style={s.matconTexto}>{matconFrases.pontos}</Text>
              </View>
            )}
          </View>
        )}

        <View style={s.divider} />

        {company?.id && !duasNotas && (
          <NfceActions
            companyId={company.id}
            saleId={sale.id}
            items={nfceItems}
            total={sale.total}
            customerName={sale.customerName}
            customerCpf={sale.cpfNaNota}
            customerPhone={sale.customerPhone}
            paymentMethod={sale.payment}
            payments={payments}
            autoEmit={autoEmit}
          />
        )}

        {/* 10/11/2026 (tela 4): as duas notas da venda com serviço. A NFC-e
            recebe a venda inteira (os pagamentos fecham com ela) e o backend
            deixa os serviços de fora. */}
        {company?.id && duasNotas && (
          <View style={s.notas} testID="venda-duas-notas">
            {composicao.temProduto && (
              <View style={s.notaCard} testID="venda-nota-nfce">
                <View style={s.notaHead}>
                  <View style={s.notaIco}><Icon name="receipt" size={15} color={Colors.violet3} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.notaT}>Cupom fiscal (NFC-e) — produtos</Text>
                    <Text style={s.notaSub} numberOfLines={2}>{nomes(itensProduto)} · {fmt(somar(itensProduto))}</Text>
                  </View>
                </View>
                <NfceActions
                  companyId={company.id}
                  saleId={sale.id}
                  items={nfceItems}
                  total={sale.total}
                  customerName={sale.customerName}
                  customerCpf={sale.cpfNaNota}
                  customerPhone={sale.customerPhone}
                  paymentMethod={sale.payment}
                  payments={payments}
                  autoEmit={autoEmit}
                />
              </View>
            )}
            <NfseVendaCard
              companyId={company.id}
              saleId={sale.id}
              servicos={nomes(itensServico)}
              totalServicos={somar(itensServico)}
              tomador={sale.tomador || null}
              customerPhone={sale.customerPhone}
              nomeDaLoja={nomeDaLoja}
            />
            <AjudaFiscal />
          </View>
        )}

        {/* 31/08/2026 (OS): fecha o ciclo da OS na tela de sucesso — lista
            as OS PRONTAS do cliente e entrega vinculando esta venda. Nao
            renderiza nada sem toggle/cliente/OS pronta. */}
        {company?.id && (
          <OsActions companyId={company.id} saleId={sale.id} customerId={sale.customerId} />
        )}

        {/* Garantia de produto (extensão da OS): emite o que foi escolhido
            no PDV e oferece imprimir. Silencioso sem rascunho. */}
        {company?.id && (
          <WarrantySaleActions companyId={company.id} saleId={sale.id} saleKeys={(sale.items || []).map((i: any) => i.productId)} />
        )}

        {caixinha.mostra && (
          <View style={s.papel} testID="venda-papel-entrega">
            <Pressable
              onPress={() => setComPapel((v) => !v)}
              style={s.papelLinha}
              testID="venda-papel-caixinha"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: comPapel }}
              accessibilityLabel="Imprimir papel de entrega"
            >
              <View style={[s.caixa, comPapel && s.caixaOn]}>
                {comPapel && <Icon name="check" size={13} color="#fff" />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.papelTitulo}>Imprimir papel de entrega</Text>
                {!estreito && <Text style={s.papelSub}>Nome, telefone, endereço e itens, para colar no pacote.</Text>}
              </View>
            </Pressable>
            <View style={s.seg}>
              {(["bobina", "a4"] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => escolherFormato(f)}
                  style={[s.segItem, formatoDoPapel === f && s.segOn]}
                  testID={`venda-papel-${f}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: formatoDoPapel === f }}
                >
                  <Text style={[s.segTxt, formatoDoPapel === f && s.segTxtOn]}>{f === "a4" ? "A4" : "Bobina"}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[s.actions, { marginTop: 14 }, imprimirPapel && estreito && s.actionsCol]}>
          <Pressable onPress={handlePrint} style={[s.secondaryBtn, imprimirPapel && estreito && s.btnCheio]} testID="venda-imprimir">
            <Text style={s.secondaryText}>{imprimirPapel ? "Imprimir cupom e entrega" : "Imprimir cupom"}</Text>
          </Pressable>
          <Pressable onPress={onNewSale} style={[s.primaryBtn, imprimirPapel && estreito && s.btnCheio]}>
            <Text style={s.primaryText}>Nova venda</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.border, maxWidth: 460, width: "100%" },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: Colors.green },
  title: { fontSize: 20, color: Colors.ink, fontWeight: "700", marginBottom: 4 },
  saleIdBox: { alignItems: "center", gap: 2, marginBottom: 20, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg4 },
  saleIdLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  saleId: { fontSize: 14, color: Colors.ink, fontWeight: "700", letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8 },
  label: { fontSize: 13, color: Colors.ink3 },
  value: { fontSize: 18, color: Colors.green, fontWeight: "800" },
  meta: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  metaStrike: { fontSize: 13, color: Colors.ink3, fontWeight: "500", textDecorationLine: "line-through" },
  couponRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.greenD, borderRadius: 10, padding: 10, width: "100%", marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "33" },
  couponBadge: { backgroundColor: Colors.green + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  couponBadgeText: { fontSize: 11, color: Colors.green, fontWeight: "800", letterSpacing: 1 },
  couponDiscount: { fontSize: 14, color: Colors.green, fontWeight: "700", flex: 1, textAlign: "right" },
  matconBox: { width: "100%", gap: 6, marginTop: 8 },
  matconLinha: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 12, paddingVertical: 9 },
  matconTexto: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600", lineHeight: 18 },
  divider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 16 },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  secondaryBtn: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  secondaryText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { flex: 1, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primaryText: { fontSize: 14, color: "#fff", fontWeight: "700" },
  splitBox: { width: "100%", paddingVertical: 8, gap: 4 },
  splitTitle: { fontSize: 11, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  splitLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  splitMethod: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  splitValue: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  // 10/11/2026 (NFS-e automática, tela 4): as duas notas.
  notas: { width: "100%", gap: 10 },
  notaCard: { width: "100%", gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  notaHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  notaIco: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  notaT: { fontSize: 13, color: Colors.ink, fontWeight: "800" },
  notaSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  // 09/11/2026: papel de entrega (mockup "Entrega no Caixa", F).
  metaDireita: { flex: 1, textAlign: "right", marginLeft: 12 },
  papel: { width: "100%", marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2, gap: 10 },
  papelLinha: { flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 32, width: "100%" },
  caixa: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.violet, alignItems: "center", justifyContent: "center", marginTop: 1 },
  caixaOn: { backgroundColor: Colors.violet },
  papelTitulo: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  papelSub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  seg: { flexDirection: "row", alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, overflow: "hidden", marginLeft: 32 },
  segItem: { paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: "center" },
  segOn: { backgroundColor: Colors.violet },
  segTxt: { fontSize: 12, color: Colors.ink2, fontWeight: "700" },
  segTxtOn: { color: "#fff" },
  actionsCol: { flexDirection: "column" },
  btnCheio: { flex: 0, width: "100%" },
});

export default SaleComplete;
