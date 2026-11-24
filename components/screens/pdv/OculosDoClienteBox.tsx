// ============================================================
// AURA. — components/screens/pdv/OculosDoClienteBox.tsx
//
// p-208 (23/11/2026, pedido do Caio; mockup otica-os-impressa, seção 4):
// a OS de ótica no Caixa. Aparece quando o módulo Ótica está ligado e há
// cliente na venda. Três pontos de contato:
//   1. "Nova OS de óculos" — abre a nova OS já com o cliente da venda;
//   2. "Óculos deste cliente" — OS pronta ou com saldo, com a ação certa;
//   3. depois de receber: o recibo e a folha da OS para imprimir.
//
// A REGRA QUE NÃO QUEBRA: o saldo da OS com sinal já é parcela do crediário
// da venda do sinal. "Receber saldo e entregar" QUITA essas parcelas
// (POST /service-orders/:id/receber-saldo) e NUNCA cria venda nova — por isso
// não passa pelo carrinho. A chave de idempotência é a mesma em toda nova
// tentativa do mesmo recebimento: repetir nunca cobra duas vezes.
//
// A OS SEM sinal não tem venda: "Lançar no carrinho" põe os óculos no
// carrinho e a venda do Caixa é a primeira e única. Na tela final, o bloco
// de OS (OsActions) entrega vinculando a venda.
//
// Multi-CNPJ: a OS é da loja onde foi aberta (o backend filtra pela empresa
// do Caixa). Cliente de outra loja do grupo só vê aqui as OS desta loja.
//
// Sem receita e sem CPF aqui: dado de saúde só na tela da OS e no papel.
// ============================================================
import { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import {
  serviceOrdersApi, printOs,
  type OticaNoCaixa, type SaldoMethod, type ReceberSaldoResult,
} from "@/services/serviceOrdersApi";
import { printReceipt } from "@/services/creditApi";

const fmt = (n: number | string | null | undefined) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDia(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}` : "";
}

export const FORMAS_DO_SALDO: { key: SaldoMethod; label: string }[] = [
  { key: "pix", label: "Pix" }, { key: "dinheiro", label: "Dinheiro" },
  { key: "cartao", label: "Cartão" }, { key: "debito", label: "Débito" },
];
const ROTULO_FORMA: Record<SaldoMethod, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", debito: "Débito" };

const ROTULO_STATUS: Record<string, string> = {
  aberta: "no laboratório", em_execucao: "no laboratório", pronta: "pronta para retirada", entregue: "entregue",
};

function novaChave(osId: string): string {
  const rnd = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return "caixa-otica:" + osId.slice(0, 8) + ":" + rnd.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

type Props = {
  companyId: string;
  customerId: string;
  disabled?: boolean;
  /** OS sem sinal: põe os itens da OS no carrinho (usePdvState.lancarOsNoCarrinho). */
  onLancarNoCarrinho: (osId: string, itens: { description: string; product_id?: string | null; quantity: number | string; unit_price: number | string }[]) => void;
};

export function OculosDoClienteBox({ companyId, customerId, disabled, onLancarNoCarrinho }: Props) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["otica-no-caixa", companyId, customerId],
    queryFn: () => serviceOrdersApi.oticaNoCaixa(companyId, customerId),
    staleTime: 0, // balcão: o estado é agora
  });
  const orders: OticaNoCaixa[] = data?.orders || [];

  const [aberta, setAberta] = useState<string | null>(null);        // OS com a confirmação aberta
  const [forma, setForma] = useState<SaldoMethod>("pix");
  const [entregar, setEntregar] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feito, setFeito] = useState<Record<string, ReceberSaldoResult>>({});
  const [lancada, setLancada] = useState<Record<string, boolean>>({});
  // Uma chave por tentativa de recebimento, mantida nos "tentar de novo".
  const chaves = useRef<Record<string, string>>({});

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["otica-no-caixa"] });
    qc.invalidateQueries({ queryKey: ["service-orders"] });
    qc.invalidateQueries({ queryKey: ["service-order"] });
    qc.invalidateQueries({ queryKey: ["otica-dashboard"] });
  }

  function abrirConfirmacao(os: OticaNoCaixa) {
    setAberta(os.id);
    setEntregar(os.status === "pronta");
    if (!chaves.current[os.id]) chaves.current[os.id] = novaChave(os.id);
  }

  async function receber(os: OticaNoCaixa) {
    if (busy) return;
    setBusy(os.id);
    try {
      const r = await serviceOrdersApi.receberSaldo(companyId, os.id, { method: forma, entregar }, chaves.current[os.id]);
      delete chaves.current[os.id];
      setFeito((prev) => ({ ...prev, [os.id]: r }));
      setAberta(null);
      invalidar();
      toast.success(r.paid > 0 ? `Saldo da OS #${os.os_number} recebido` : `OS #${os.os_number} entregue`);
    } catch (err: any) {
      // A chave fica: tocar de novo repete o MESMO recebimento, nunca outro.
      toast.error(err?.data?.error || "Não deu para receber o saldo. Toque de novo: não cobra duas vezes.");
    } finally {
      setBusy(null);
    }
  }

  async function entregarSemReceber(os: OticaNoCaixa) {
    if (busy) return;
    setBusy(os.id);
    try {
      await serviceOrdersApi.setStatus(companyId, os.id, "entregue");
      invalidar();
      toast.success(os.open_amount > 0.005
        ? `OS #${os.os_number} entregue · o saldo de ${fmt(os.open_amount)} continua no crediário`
        : `OS #${os.os_number} entregue`);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para entregar a OS");
    } finally {
      setBusy(null);
    }
  }

  async function lancar(os: OticaNoCaixa) {
    if (busy) return;
    setBusy(os.id);
    try {
      const r = await serviceOrdersApi.get(companyId, os.id);
      const itens = (r.items || []).filter((it) => Number(it.unit_price) > 0);
      if (!itens.length) { toast.error("A OS não tem itens com valor para cobrar"); return; }
      onLancarNoCarrinho(os.id, itens);
      setLancada((prev) => ({ ...prev, [os.id]: true }));
      toast.success(`Óculos da OS #${os.os_number} no carrinho`);
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu para abrir a OS");
    } finally {
      setBusy(null);
    }
  }

  function imprimirOs(osId: string) {
    if (Platform.OS !== "web") { toast.info("Impressão disponível apenas na versão web"); return; }
    printOs(companyId, osId);
  }
  function imprimirRecibo(txId: string) {
    if (Platform.OS !== "web") { toast.info("Impressão disponível apenas na versão web"); return; }
    printReceipt(companyId, txId);
  }

  return (
    <View style={st.box} testID="oculos-do-cliente">
      <View style={st.head}>
        <Icon name="glasses" size={14} color={Colors.violet3} />
        <Text style={st.title}>Óculos deste cliente</Text>
        <Pressable
          onPress={() => router.push(("/otica/nova?customer_id=" + encodeURIComponent(customerId)) as any)}
          style={st.novaBtn} hitSlop={6} testID="oculos-nova-os"
        >
          <Icon name="plus" size={12} color={Colors.violet3} />
          <Text style={st.novaTxt}>Nova OS de óculos</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.violet3} size="small" />
      ) : isError ? (
        <Text style={st.hint}>Não deu para ver as OS deste cliente. <Text style={st.link} onPress={() => refetch()}>Tentar de novo</Text></Text>
      ) : orders.length === 0 && Object.keys(feito).length === 0 ? (
        <Text style={st.hint} testID="oculos-vazio">Nenhum óculos pronto ou com saldo.</Text>
      ) : null}

      {Object.entries(feito).filter(([id]) => !orders.some((o) => o.id === id)).map(([id, r]) => (
        <Sucesso key={id} r={r} onImprimirOs={() => imprimirOs(id)} onImprimirRecibo={r.transaction_id ? () => imprimirRecibo(r.transaction_id!) : undefined} />
      ))}

      {orders.map((os) => {
        const r = feito[os.id];
        if (r) return <Sucesso key={os.id} r={r} onImprimirOs={() => imprimirOs(os.id)} onImprimirRecibo={r.transaction_id ? () => imprimirRecibo(r.transaction_id!) : undefined} />;
        const lente = [os.lens?.design || os.lens?.brand, os.lens?.material].filter(Boolean).join(" ");
        const meta = [lente, os.frame?.description, os.promised_at ? `previsão ${fmtDia(os.promised_at)}` : null].filter(Boolean).join(" · ");
        const pronta = os.status === "pronta";
        const temSaldo = !os.sem_venda && os.open_amount > 0.005;
        const confirmando = aberta === os.id;
        const ocupado = busy === os.id;
        return (
          <View key={os.id} style={st.os} testID={`oculos-os-${os.os_number}`}>
            <Text style={st.osT}>OS #{os.os_number} · {ROTULO_STATUS[os.status] || os.status}</Text>
            {!!meta && <Text style={st.osMeta} numberOfLines={2}>{meta}</Text>}
            <Text style={st.osMoney}>
              {os.sem_venda
                ? `Total ${fmt(os.estimated_amount)} · aberta sem sinal`
                : temSaldo
                  ? `Total ${fmt(os.deposit_sale_total)} · saldo ${fmt(os.open_amount)}${os.open_installments > 1 ? ` (${os.open_installments} parcelas)` : ""}`
                  : `Total ${fmt(os.deposit_sale_total)} · saldo quitado`}
            </Text>

            {os.sem_venda ? (
              lancada[os.id] ? (
                <Text style={st.ok} testID={`oculos-lancada-${os.os_number}`}>No carrinho. Finalize a venda; na tela final, "Entregar e imprimir" vincula a OS a ela.</Text>
              ) : (
                <View style={st.acoes}>
                  <Pressable onPress={() => lancar(os)} style={[st.btn, (ocupado || disabled) && st.off]} disabled={!!busy || disabled} testID={`oculos-lancar-${os.os_number}`}>
                    {ocupado ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnT}>Lançar no carrinho</Text>}
                  </Pressable>
                  <Text style={st.hint}>Sem sinal, a venda é feita agora, no Caixa: o valor entra no caixa e a armação sai do estoque.</Text>
                </View>
              )
            ) : confirmando ? (
              <View style={st.confirma} testID={`oculos-confirmar-${os.os_number}`}>
                <Text style={st.lbl}>Forma de pagamento</Text>
                <View style={st.chips}>
                  {FORMAS_DO_SALDO.map((f) => (
                    <Pressable key={f.key} onPress={() => setForma(f.key)} style={[st.chip, forma === f.key && st.chipOn]} testID={`oculos-forma-${f.key}`}>
                      <Text style={[st.chipT, forma === f.key && st.chipTOn]}>{f.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={st.resumo}>
                  {`Receber ${fmt(os.open_amount)} no ${ROTULO_FORMA[forma]}`}
                  {entregar ? " e entregar os óculos" : ""}. Quita {os.open_installments > 1 ? `as ${os.open_installments} parcelas` : "a parcela"} da OS, sem venda nova.
                </Text>
                <View style={st.acoes}>
                  <Pressable onPress={() => receber(os)} style={[st.btn, ocupado && st.off]} disabled={!!busy} testID={`oculos-confirmar-receber-${os.os_number}`}>
                    {ocupado ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnT}>Confirmar</Text>}
                  </Pressable>
                  <Pressable onPress={() => setAberta(null)} style={st.ghost} disabled={!!busy}>
                    <Text style={st.ghostT}>Voltar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={st.acoes}>
                {temSaldo && (
                  <Pressable onPress={() => abrirConfirmacao(os)} style={[st.btn, disabled && st.off]} disabled={!!busy || disabled} testID={`oculos-receber-${os.os_number}`}>
                    <Text style={st.btnT}>{pronta ? "Receber saldo e entregar" : "Receber saldo"}</Text>
                  </Pressable>
                )}
                {pronta && (
                  <Pressable onPress={() => entregarSemReceber(os)} style={[temSaldo ? st.ghost : st.btn, ocupado && st.off]} disabled={!!busy} testID={`oculos-entregar-${os.os_number}`}>
                    {ocupado ? <ActivityIndicator color={temSaldo ? Colors.ink : "#fff"} size="small" /> : <Text style={temSaldo ? st.ghostT : st.btnT}>{temSaldo ? "Entregar sem receber" : "Entregar"}</Text>}
                  </Pressable>
                )}
              </View>
            )}
            {!os.sem_venda && temSaldo && pronta && !confirmando && (
              <Text style={st.hint}>"Entregar sem receber" deixa o saldo no crediário do cliente.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Sucesso({ r, onImprimirOs, onImprimirRecibo }: { r: ReceberSaldoResult; onImprimirOs: () => void; onImprimirRecibo?: () => void }) {
  return (
    <View style={st.sucesso} testID={`oculos-sucesso-${r.order?.os_number}`}>
      <Text style={st.sucT}>
        {r.paid > 0
          ? `Recebido ${fmt(r.paid)} · ${ROTULO_FORMA[r.method] || r.method} · saldo da OS #${r.order?.os_number}`
          : `OS #${r.order?.os_number}`}
      </Text>
      <Text style={st.sucS}>
        {[r.delivered || r.order?.status === "entregue" ? "entregue" : null,
          r.remaining > 0.005 ? `ainda falta ${fmt(r.remaining)} no crediário` : "saldo quitado"].filter(Boolean).join(" · ")}
      </Text>
      <View style={st.acoes}>
        <Pressable onPress={onImprimirOs} style={st.ghost} testID="oculos-imprimir-os">
          <Icon name="receipt" size={13} color={Colors.ink} />
          <Text style={st.ghostT}>Imprimir OS · 2 vias</Text>
        </Pressable>
        {onImprimirRecibo && (
          <Pressable onPress={onImprimirRecibo} style={st.ghost} testID="oculos-imprimir-recibo">
            <Text style={st.ghostT}>Imprimir recibo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: "100%", backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 11, color: Colors.ink3, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, flex: 1, minWidth: 120 },
  novaBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  novaTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  os: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, gap: 3 },
  osT: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  osMeta: { fontSize: 11, color: Colors.ink3 },
  osMoney: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  acoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 },
  btn: { backgroundColor: Colors.violet, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, minHeight: 36, justifyContent: "center" },
  btnT: { fontSize: 12, color: "#fff", fontWeight: "700" },
  ghost: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, minHeight: 36 },
  ghostT: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  off: { opacity: 0.6 },
  confirma: { marginTop: 6, gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border2 },
  lbl: { fontSize: 11, color: Colors.ink2, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipT: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTOn: { color: Colors.violet3 },
  resumo: { fontSize: 12, color: Colors.ink, lineHeight: 17 },
  hint: { fontSize: 10.5, color: Colors.ink3, lineHeight: 15 },
  link: { color: Colors.violet3, fontWeight: "700" },
  ok: { fontSize: 11.5, color: Colors.green, lineHeight: 16, marginTop: 4 },
  sucesso: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, gap: 2 },
  sucT: { fontSize: 13, color: Colors.green, fontWeight: "700" },
  sucS: { fontSize: 11.5, color: Colors.ink2 },
});

export default OculosDoClienteBox;
