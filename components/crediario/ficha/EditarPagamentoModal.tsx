// ============================================================
// EditarPagamentoModal — Aura · Crediário (08/10/2026)
//
// Caso Looks da Jenny: R$ 200 lançados na ficha da "Maria Eduarda" errada, e
// a lojista sem ter como corrigir. Aqui ela muda o valor, o dia, a forma ou a
// CLIENTE do pagamento. Por baixo o backend desfaz e relança na mesma
// operação (PATCH /credit/payments/:id) — por isso a tela avisa que as
// parcelas são redistribuídas.
//
// A conta do que mudou e as recusas vivem em utils/crediarioPagamento.ts
// (mudancasDoPagamento), testadas sem tela.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { creditApi } from "@/services/creditApi";
import { mudancasDoPagamento, type PagamentoOriginal } from "@/utils/crediarioPagamento";
import { todaySP } from "@/utils/creditOverdue";
import { fmt, parseAmount, PAYMENT_METHODS } from "./fichaHelpers";
import { m } from "./fichaStyles";

export type PagamentoEmEdicao = PagamentoOriginal & {
  id: string;
  customerName: string;
};

type Props = {
  visible: boolean;
  companyId: string;
  pagamento: PagamentoEmEdicao | null;
  onClose: () => void;
  /** Depois de salvar. `movedTo` = nome da cliente que recebeu o pagamento, se mudou. */
  onSaved: (info: { movedTo: string | null }) => void;
};

type ClienteAchado = { id: string; name: string; phone: string | null };

function valorParaCampo(n: number): string {
  return (Number(n) || 0).toFixed(2).replace(".", ",");
}

export function EditarPagamentoModal({ visible, companyId, pagamento, onClose, onSaved }: Props) {
  const [valor, setValor] = useState("");
  const [dataBr, setDataBr] = useState("");
  const [forma, setForma] = useState<string | null>(null);
  const [cliente, setCliente] = useState<{ id: string; name: string } | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<ClienteAchado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Abre sempre com o pagamento como ele está.
  useEffect(() => {
    if (!visible || !pagamento) return;
    setValor(valorParaCampo(pagamento.amount));
    setDataBr(formatIsoToBr(pagamento.paidAt));
    setForma(pagamento.method);
    setCliente({ id: pagamento.customerId, name: pagamento.customerName });
    setTrocando(false);
    setBusca("");
    setAchados([]);
    setErro(null);
  }, [visible, pagamento]);

  // Busca de cliente com espera curta: uma chamada por pausa na digitação.
  useEffect(() => {
    const q = busca.trim();
    if (!trocando || q.length < 2) { setAchados([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      creditApi.searchCustomers(companyId, q)
        .then((r) => { if (vivo) setAchados(r.customers || []); })
        .catch(() => { if (vivo) setAchados([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca, trocando, companyId]);

  if (!pagamento) return null;

  const mudouCliente = !!cliente && cliente.id !== pagamento.customerId;

  async function salvar() {
    if (!pagamento || !cliente || salvando) return;
    const { corpo, erro: recusa } = mudancasDoPagamento(
      pagamento,
      { amount: parseAmount(valor), method: forma, paidAt: parseBrDate(dataBr), customerId: cliente.id },
      todaySP(),
    );
    if (recusa) { setErro(recusa); return; }
    setErro(null);
    setSalvando(true);
    try {
      await creditApi.editPayment(companyId, pagamento.id, corpo);
      toast.success(mudouCliente ? `Pagamento movido para ${cliente.name}.` : "Pagamento corrigido.");
      onSaved({ movedTo: mudouCliente ? cliente.name : null });
    } catch (e: any) {
      const msg = e?.data?.error || "Não foi possível corrigir o pagamento. Tente novamente.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={460} sheetStyle={{ backgroundColor: Colors.bg3 }}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Corrigir pagamento</Text>
            <Text style={s.sub}>Lançado como {fmt(pagamento.amount)} em {formatIsoToBr(pagamento.paidAt)}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar" testID="editar-pagamento-fechar">
            <Icon name="x" size={18} color={Colors.ink3} />
          </Pressable>
        </View>

        <Text style={m.fieldLabel}>Valor</Text>
        <TextInput
          style={s.input}
          value={valor}
          onChangeText={(v) => { setValor(v.replace(/[^\d,.]/g, "")); setErro(null); }}
          placeholder="0,00"
          placeholderTextColor={Colors.ink3}
          keyboardType="decimal-pad"
          testID="editar-pagamento-valor"
        />

        <Text style={[m.fieldLabel, { marginTop: 14 }]}>Data do pagamento</Text>
        <DateInput
          value={dataBr}
          onChangeText={(v) => { setDataBr(v); setErro(null); }}
          placeholder="dd/mm/aaaa"
          style={m.dateInput}
        />

        <Text style={[m.fieldLabel, { marginTop: 14 }]}>Forma</Text>
        <View style={m.methods}>
          {PAYMENT_METHODS.map((pm) => (
            <Pressable
              key={pm.key}
              style={[m.method, forma === pm.key && m.methodActive]}
              onPress={() => { setForma(pm.key); setErro(null); }}
              testID={`editar-pagamento-forma-${pm.key}`}
            >
              <Text style={[m.methodTxt, forma === pm.key && { color: "#fff" }]}>{pm.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[m.fieldLabel, { marginTop: 14 }]}>Cliente</Text>
        <View style={s.clienteRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.clienteNome} numberOfLines={1}>{cliente?.name || pagamento.customerName}</Text>
            {mudouCliente && <Text style={s.clienteAviso}>antes: {pagamento.customerName}</Text>}
          </View>
          <Pressable
            style={s.trocarBtn}
            onPress={() => { setTrocando((v) => !v); setBusca(""); }}
            testID="editar-pagamento-trocar-cliente"
          >
            <Text style={s.trocarTxt}>{trocando ? "Cancelar" : "Trocar cliente"}</Text>
          </Pressable>
        </View>

        {trocando && (
          <View style={{ marginTop: 8 }}>
            <TextInput
              style={s.input}
              value={busca}
              onChangeText={setBusca}
              placeholder="Nome, telefone ou CPF da cliente certa"
              placeholderTextColor={Colors.ink3}
              autoFocus
              testID="editar-pagamento-busca"
            />
            {buscando && <ActivityIndicator size="small" color={Colors.violet3} style={{ marginTop: 8 }} />}
            {!buscando && busca.trim().length >= 2 && achados.length === 0 && (
              <Text style={s.vazio}>Nenhuma cliente encontrada.</Text>
            )}
            {achados.map((c) => (
              <Pressable
                key={c.id}
                style={s.achado}
                onPress={() => { setCliente({ id: c.id, name: c.name }); setTrocando(false); setErro(null); }}
                testID={`editar-pagamento-cliente-${c.id}`}
              >
                <Text style={s.achadoNome} numberOfLines={1}>{c.name}</Text>
                {!!c.phone && <Text style={s.achadoSub}>{c.phone}</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={s.nota}>
          {mudouCliente
            ? `O pagamento sai da ficha de ${pagamento.customerName} (as parcelas dela voltam a ficar em aberto) e entra na de ${cliente?.name}, nas parcelas mais antigas.`
            : "Ao salvar, o pagamento é relançado e as parcelas são redistribuídas a partir da mais antiga."}
        </Text>

        {!!erro && <Text style={s.erro} testID="editar-pagamento-erro">{erro}</Text>}

        <View style={s.acoes}>
          <Pressable style={s.btnGhost} onPress={onClose} disabled={salvando}>
            <Text style={s.btnGhostTxt}>Cancelar</Text>
          </Pressable>
          <Pressable style={[s.btn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} testID="editar-pagamento-salvar">
            {salvando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>Salvar correção</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  body: { padding: 18, paddingBottom: 22 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  input: {
    backgroundColor: Colors.bg2, borderColor: Colors.border2, borderWidth: 1, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.ink,
  },
  clienteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clienteNome: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  clienteAviso: { fontSize: 11, color: Colors.amber, marginTop: 2, fontWeight: "600" },
  trocarBtn: {
    minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  trocarTxt: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
  vazio: { fontSize: 12, color: Colors.ink3, marginTop: 8 },
  achado: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, marginTop: 6,
    borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
  },
  achadoNome: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  achadoSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  nota: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginTop: 14 },
  erro: { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 10 },
  acoes: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnGhost: {
    flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  btnGhostTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  btn: { flex: 1.4, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: Colors.violet },
  btnTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
