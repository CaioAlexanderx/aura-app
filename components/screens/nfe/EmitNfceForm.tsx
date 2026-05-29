import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { nfceApi, type NfceEmissionItem, type NfeKind } from "@/services/nfceApi";
import { ns } from "./shared";

// Forma de pagamento → código tPag enviado pro backend.
// Backend mapeia via paymentCode() e Nuvem Fiscal espera tabela SEFAZ.
const PAGAMENTOS = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix",      label: "Pix"      },
  { key: "credito",  label: "Crédito"  },
  { key: "debito",   label: "Débito"   },
  { key: "outros",   label: "Outros"   },
];

type ItemRow = NfceEmissionItem & { _id: string };

// Prefill enviado pelo nfe.tsx quando o lojista clica "Reemitir" num card
// rejeitado. Hidrata o form a partir do snapshot da nota rejeitada
// (items, cliente, pagamento, sale_id).
export type NfcePrefill = {
  rejectedFromId: string;
  rejectedFromNumero: number;
  rejectedFromTipo: NfeKind;
  rejectedAt: string;
  rejectedReason: string | null;
  sale_id: string | null;
  items: NfceEmissionItem[];
  customer_cpf: string | null;
  customer_name: string | null;
  payment_method: string | null;
};

function newItemRow(): ItemRow {
  return {
    _id: Math.random().toString(36).slice(2),
    product_name: "",
    quantity: 1,
    unit_price: 0,
    ncm: "00000000",
    cfop: "5102",
    unit: "UN",
  };
}

function itemsFromPrefill(items: NfceEmissionItem[] | undefined | null): ItemRow[] {
  if (!Array.isArray(items) || items.length === 0) return [newItemRow()];
  return items.map(it => ({
    _id: Math.random().toString(36).slice(2),
    product_id:   it.product_id ?? null,
    product_name: it.product_name || it.name || "",
    name:         it.name,
    description:  it.description,
    quantity:     Number(it.quantity) || 1,
    unit_price:   Number(it.unit_price) || 0,
    ncm:          it.ncm  || "00000000",
    cfop:         it.cfop || "5102",
    unit:         it.unit || "UN",
    barcode:      it.barcode,
    discount:     it.discount,
  }));
}

// payment_method em nfce_emissions pode ser:
// - chave simples ('dinheiro','pix','credito','debito','outros','crediario')
// - string JSON de multi-pagamento ('[{...}]') quando vinda do PDV com payments[]
// Para reemissão via form (single-pagamento), caímos pro primeiro method
// quando vier JSON, ou 'dinheiro' como último fallback.
function normalizePaymentMethod(pm: string | null | undefined): string {
  if (!pm) return "dinheiro";
  const trimmed = pm.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      if (first?.method && typeof first.method === "string") return first.method;
    } catch { /* swallow */ }
    return "dinheiro";
  }
  // Valida contra a lista exposta no form; 'crediario' não aparece nos chips,
  // então cai pra dinheiro (que é o tPag SEFAZ correspondente).
  const known = new Set(PAGAMENTOS.map(p => p.key));
  return known.has(trimmed) ? trimmed : "dinheiro";
}

const fmtBR = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EmitNfceForm({
  companyId,
  prefill,
  onClearPrefill,
}: {
  companyId: string;
  /** Quando passado, hidrata o form com dados da nota rejeitada e exibe banner de reemissão. */
  prefill?: NfcePrefill | null;
  /** Chamado quando o usuário cancela a reemissão ou a emissão é bem-sucedida. */
  onClearPrefill?: () => void;
}) {
  const qc = useQueryClient();

  // Inicialização condicionada ao prefill — vale só na primeira renderização.
  // Pra trocar a nota fonte (clicar Reemitir em outro card), o pai deve usar
  // key={prefill?.rejectedFromId} forçando remount.
  const initialCpfRaw = (prefill?.customer_cpf || "").replace(/\D/g, "");
  const initialIsCnpj = initialCpfRaw.length > 11;

  const [tipo, setTipo] = useState<NfeKind>(prefill?.rejectedFromTipo || "nfce");
  const [items, setItems] = useState<ItemRow[]>(() => itemsFromPrefill(prefill?.items));
  const [cpf, setCpf] = useState(prefill && !initialIsCnpj ? initialCpfRaw : "");
  const [cnpj, setCnpj] = useState(prefill && initialIsCnpj ? initialCpfRaw : "");
  const [customerName, setCustomerName] = useState(prefill?.customer_name || "");
  const [paymentMethod, setPaymentMethod] = useState(() => normalizePaymentMethod(prefill?.payment_method));
  const [paymentChange, setPaymentChange] = useState("");
  const [observacoes, setObservacoes] = useState("");
  // Quando vem de reemissão, abre a seção avançada — NCM costuma ser o
  // motivo da rejeição e o usuário precisa ver/editar imediatamente.
  const [showAdvanced, setShowAdvanced] = useState(!!prefill);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [items]
  );

  const isReemissao = !!prefill;
  const rejeicaoMotivo = prefill?.rejectedReason || null;
  const rejeicaoDataFmt = prefill?.rejectedAt
    ? new Date(prefill.rejectedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  const emitMut = useMutation({
    mutationFn: (body: any) => nfceApi.emit(companyId, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["nfce-emissions", companyId] });
      const labelTipo = res.tipo === "nfe" ? "NF-e" : "NFC-e";
      toast.success(
        res.nfce.status === "autorizada"
          ? `${labelTipo} #${res.nfce.numero} autorizada!`
          : `${labelTipo} #${res.nfce.numero} ${res.nfce.status}`
      );
      // reset — limpa também o prefill no pai (sai do modo reemissão)
      setItems([newItemRow()]);
      setCpf(""); setCnpj(""); setCustomerName(""); setObservacoes("");
      onClearPrefill?.();
    },
    onError: (err: any) => {
      // Backend devolve { error, payload, nfce_id } em rejeição da Nuvem Fiscal
      const detail = err?.data?.payload
        ? ` (campo: ${err.data.payload?.erros?.[0]?.campo || "?"})`
        : "";
      toast.error((err?.message || "Erro ao emitir nota") + detail);
    },
  });

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems(prev => prev.map(it => (it._id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) {
    setItems(prev => (prev.length === 1 ? prev : prev.filter(it => it._id !== id)));
  }

  function handleCancelReemissao() {
    // Limpa o form e tira do modo reemissão; nfe.tsx zera o prefill.
    setItems([newItemRow()]);
    setCpf(""); setCnpj(""); setCustomerName("");
    setPaymentMethod("dinheiro");
    setObservacoes("");
    setShowAdvanced(false);
    onClearPrefill?.();
  }

  function handleEmit() {
    // Validação local antes do POST
    const cleanItems = items
      .filter(i => (i.product_name || "").trim() && Number(i.quantity) > 0 && Number(i.unit_price) > 0)
      .map(({ _id, ...rest }) => rest);

    if (!cleanItems.length) { toast.error("Adicione ao menos um item válido (nome, qty, preço)"); return; }
    if (tipo === "nfe" && !cpf.replace(/\D/g, "") && !cnpj.replace(/\D/g, "")) {
      toast.error("NF-e exige CPF ou CNPJ do destinatário"); return;
    }

    emitMut.mutate({
      items: cleanItems,
      tipo,
      customer_cpf:   cpf.replace(/\D/g, "") || undefined,
      recipient_cnpj: cnpj.replace(/\D/g, "") || undefined,
      customer_name:  customerName.trim() || undefined,
      payment_method: paymentMethod,
      payment_change: paymentChange ? Number(paymentChange.replace(",", ".")) : undefined,
      observacoes:    observacoes.trim() || undefined,
      // Reemissão: mantém o vínculo com a venda original; backend revalida
      // idempotência (só bloqueia se tiver outra nota autorizada/processando
      // pra essa sale_id — rejeitada/erro/cancelada liberam reemissão).
      sale_id:        prefill?.sale_id || undefined,
    });
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={ns.formCard}>
        {isReemissao && (
          <View style={styles.reemitBanner}>
            <View style={styles.reemitBannerHeader}>
              <View style={styles.reemitBadge}>
                <Icon name="refresh" size={12} color={Colors.violet3} />
                <Text style={styles.reemitBadgeText}>REEMISSÃO</Text>
              </View>
              <Pressable onPress={handleCancelReemissao} hitSlop={6} accessibilityLabel="Cancelar reemissão">
                <Text style={styles.reemitCancelLink}>Cancelar reemissão</Text>
              </Pressable>
            </View>
            <Text style={styles.reemitTitle}>
              Reemissão da nota #{prefill!.rejectedFromNumero}
              {rejeicaoDataFmt ? ` (rejeitada em ${rejeicaoDataFmt})` : ""}
            </Text>
            {rejeicaoMotivo && (
              <Text style={styles.reemitReason} numberOfLines={4}>
                Motivo SEFAZ: {rejeicaoMotivo}
              </Text>
            )}
            <Text style={styles.reemitTip}>
              ⚠ Verifique se o NCM dos produtos está correto antes de reemitir.
              Use o botão NCM/CFOP abaixo pra editar por item.
            </Text>
            {prefill!.rejectedFromTipo === "nfe" && !cnpj && !cpf && (
              <Text style={styles.reemitTip}>
                NF-e: confirme o CPF/CNPJ do destinatário antes de reemitir.
              </Text>
            )}
          </View>
        )}

        <Text style={ns.formTitle}>{isReemissao ? "Reemitir nota fiscal" : "Emitir nota fiscal"}</Text>
        <Text style={ns.formHint}>
          NFC-e (modelo 65) é o padrão para venda direta ao consumidor. Use NF-e (modelo 55)
          quando o cliente exigir nota com CNPJ.
        </Text>

        {/* Toggle tipo */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, marginBottom: 8 }}>
          {(["nfce", "nfe"] as const).map(k => (
            <Pressable key={k} onPress={() => setTipo(k)}
              style={[ns.chip, tipo === k && ns.chipActive, { flex: 1, alignItems: "center" }]}>
              <Text style={[ns.chipText, tipo === k && ns.chipTextActive]}>
                {k === "nfce" ? "NFC-e (consumidor)" : "NF-e (B2B)"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Items */}
        <Text style={ns.fLabel}>Itens da venda</Text>
        {items.map((it, idx) => (
          <View key={it._id} style={{
            backgroundColor: Colors.bg4, borderRadius: 12, padding: 12, marginBottom: 8,
            borderWidth: 1, borderColor: Colors.border,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: Colors.ink3, fontWeight: "600", flex: 1 }}>
                Item {idx + 1}
              </Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(it._id)} hitSlop={8}>
                  <Icon name="trash" size={14} color={Colors.red} />
                </Pressable>
              )}
            </View>

            <TextInput style={[ns.fInput, { marginBottom: 6 }]}
              value={it.product_name} onChangeText={v => updateItem(it._id, { product_name: v })}
              placeholder="Descrição do produto/serviço" placeholderTextColor={Colors.ink3} />

            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={ns.fLabel}>Qty</Text>
                <TextInput style={ns.fInput}
                  value={String(it.quantity)} onChangeText={v => updateItem(it._id, { quantity: Number(v.replace(",", ".")) || 0 })}
                  placeholder="1" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={ns.fLabel}>Preço unit.</Text>
                <TextInput style={ns.fInput}
                  value={it.unit_price ? String(it.unit_price) : ""}
                  onChangeText={v => updateItem(it._id, { unit_price: Number(v.replace(",", ".")) || 0 })}
                  placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ns.fLabel}>Subtotal</Text>
                <View style={[ns.fInput, { justifyContent: "center" }]}>
                  <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "600" }}>
                    {fmtBR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Avançado por item: NCM, CFOP, Unidade */}
            {showAdvanced && (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>NCM</Text>
                  <TextInput style={ns.fInput}
                    value={it.ncm || ""} onChangeText={v => updateItem(it._id, { ncm: v.replace(/\D/g, "").slice(0, 8) })}
                    placeholder="00000000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>CFOP</Text>
                  <TextInput style={ns.fInput}
                    value={it.cfop || ""} onChangeText={v => updateItem(it._id, { cfop: v.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="5102" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ns.fLabel}>Unid</Text>
                  <TextInput style={ns.fInput}
                    value={it.unit || ""} onChangeText={v => updateItem(it._id, { unit: v.toUpperCase().slice(0, 6) })}
                    placeholder="UN" placeholderTextColor={Colors.ink3} maxLength={6} />
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
          <Pressable onPress={() => setItems(prev => [...prev, newItemRow()])}
            style={[ns.configBtn, { flex: 1, alignItems: "center" }]}>
            <Text style={ns.configBtnText}>+ Adicionar item</Text>
          </Pressable>
          <Pressable onPress={() => setShowAdvanced(v => !v)}
            style={[ns.configBtn, { alignItems: "center" }]}>
            <Text style={ns.configBtnText}>{showAdvanced ? "Ocultar" : "NCM/CFOP"}</Text>
          </Pressable>
        </View>

        {/* Destinatário */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Destinatário {tipo === "nfce" ? "(opcional)" : "(obrigatório)"}</Text>
        <View style={ns.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={ns.fLabel}>{tipo === "nfe" ? "CPF ou CNPJ" : "CPF"}</Text>
            <TextInput style={ns.fInput}
              value={tipo === "nfe" && !cpf ? cnpj : cpf}
              onChangeText={v => { tipo === "nfe" && v.replace(/\D/g, "").length > 11 ? (setCnpj(v), setCpf("")) : (setCpf(v), setCnpj("")); }}
              placeholder={tipo === "nfe" ? "CPF ou CNPJ" : "000.000.000-00"} placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ns.fLabel}>Nome</Text>
            <TextInput style={ns.fInput}
              value={customerName} onChangeText={setCustomerName}
              placeholder="Cliente" placeholderTextColor={Colors.ink3} />
          </View>
        </View>

        {/* Pagamento */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Pagamento</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {PAGAMENTOS.map(p => (
            <Pressable key={p.key} onPress={() => setPaymentMethod(p.key)}
              style={[ns.chip, paymentMethod === p.key && ns.chipActive]}>
              <Text style={[ns.chipText, paymentMethod === p.key && ns.chipTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {paymentMethod === "dinheiro" && (
          <View style={{ marginTop: 6 }}>
            <Text style={ns.fLabel}>Troco (opcional)</Text>
            <TextInput style={ns.fInput}
              value={paymentChange} onChangeText={setPaymentChange}
              placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" />
          </View>
        )}

        {/* Observações */}
        <Text style={[ns.fLabel, { marginTop: 12 }]}>Observações (opcional)</Text>
        <TextInput style={[ns.fInput, { minHeight: 60 }]} multiline
          value={observacoes} onChangeText={setObservacoes}
          placeholder="Aparece no infCpl da nota" placeholderTextColor={Colors.ink3} />

        {/* Total + emitir */}
        <View style={{
          flexDirection: "row", alignItems: "center", marginTop: 16,
          paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
        }}>
          <Text style={{ flex: 1, fontSize: 12, color: Colors.ink3, fontWeight: "600" }}>Total</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.ink }}>{fmtBR(total)}</Text>
        </View>

        <Pressable onPress={handleEmit} disabled={emitMut.isPending || total <= 0}
          style={[ns.emitBtn, (emitMut.isPending || total <= 0) && { opacity: 0.55 }]}>
          {emitMut.isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={ns.emitBtnText}>
                {isReemissao ? "Reemitir" : "Emitir"} {tipo === "nfe" ? "NF-e" : "NFC-e"}
              </Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reemitBanner: {
    backgroundColor: Colors.violetD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.violet3 + "44",
    gap: 6,
  },
  reemitBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  reemitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.bg3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.violet3 + "55",
  },
  reemitBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.violet3,
    letterSpacing: 0.6,
  },
  reemitCancelLink: {
    fontSize: 11,
    color: Colors.ink3,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  reemitTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
  },
  reemitReason: {
    fontSize: 12,
    color: Colors.red,
    fontWeight: "600",
    lineHeight: 17,
  },
  reemitTip: {
    fontSize: 11,
    color: Colors.amber,
    fontWeight: "600",
    lineHeight: 16,
  },
});
