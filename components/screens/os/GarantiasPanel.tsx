// ============================================================
// AURA. — components/screens/os/GarantiasPanel.tsx
//
// Aba "Garantias" da Ordem de Serviço: garantias emitidas no PDV (uma linha
// por PRODUTO), com filtro por produto, cliente, data da venda e situação, e
// leitor de QR para validar o certificado no balcão.
//
// Leitura nunca é bloqueada pelo toggle da OS (o backend só barra emissão e
// anulação): quem desliga o módulo ainda precisa conferir o que já prometeu.
// Situação (vigente/vencida/anulada) vem do backend, calculada pela DATA no
// fuso de São Paulo — nada gravado que possa ficar velho.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import {
  warrantiesApi, printWarranty, prazoLabel, dataBR,
  type Warranty, type WarrantyStatus, type WarrantyRow,
} from "@/services/warrantiesApi";
import { WarrantyScanner } from "./WarrantyScanner";

const STATUS_COR: Record<WarrantyStatus, string> = {
  vigente: Colors.green,
  vencida: "#d97706",
  anulada: Colors.ink3,
};
const STATUS_LABEL: Record<WarrantyStatus, string> = { vigente: "Vigente", vencida: "Vencida", anulada: "Anulada" };

const CHIPS: Array<{ key: WarrantyStatus | "todas"; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "vigente", label: "Vigentes" },
  { key: "vencida", label: "Vencidas" },
  { key: "anulada", label: "Anuladas" },
];

function maskData(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return n.slice(0, 2) + "/" + n.slice(2);
  return n.slice(0, 2) + "/" + n.slice(2, 4) + "/" + n.slice(4);
}
/** "dd/mm/aaaa" completo → "aaaa-mm-dd"; incompleto → undefined (filtro ignorado). */
function dataISO(v: string): string | undefined {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : undefined;
}

function useDebounced<T>(v: T, ms = 400): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function GarantiasPanel() {
  const { company } = useAuthStore();
  const { settings } = usePdvSettings();
  const qc = useQueryClient();
  const cid = company?.id;

  const [produto, setProduto] = useState("");
  const [cliente, setCliente] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [status, setStatus] = useState<WarrantyStatus | "todas">("todas");
  const [scanOpen, setScanOpen] = useState(false);
  const [detail, setDetail] = useState<Warranty | null>(null);
  const [validating, setValidating] = useState(false);

  const qProduto = useDebounced(produto.trim());
  const qCliente = useDebounced(cliente.trim());
  const sFrom = dataISO(de);
  const sTo = dataISO(ate);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["warranties", cid, qProduto, qCliente, sFrom, sTo, status],
    queryFn: () => warrantiesApi.list(cid as string, {
      q: qProduto || undefined,
      customer: qCliente || undefined,
      sale_from: sFrom,
      sale_to: sTo,
      status: status === "todas" ? undefined : status,
      limit: 100,
    }),
    enabled: !!cid,
    staleTime: 20_000,
  });
  const rows: WarrantyRow[] = data?.items || [];
  const sum = data?.summary;

  async function abrir(warrantyId: string) {
    if (!cid) return;
    try {
      const r = await warrantiesApi.get(cid, warrantyId);
      setDetail(r.warranty);
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para abrir a garantia");
    }
  }

  async function validar(raw: string) {
    if (!cid || validating) return;
    setValidating(true);
    try {
      const r = await warrantiesApi.byCode(cid, raw);
      setScanOpen(false);
      setDetail(r.warranty);
    } catch (e: any) {
      toast.error(e?.status === 404 || e?.data?.code === "WARRANTY_NOT_FOUND"
        ? "Garantia não encontrada nesta loja"
        : e?.data?.error || "Não deu para validar");
      // Mantém o leitor aberto: o lojista tenta o próximo QR sem reabrir.
      setTimeout(() => setValidating(false), 1500);
      return;
    }
    setValidating(false);
  }

  async function anular() {
    if (!cid || !detail) return;
    try {
      const r = await warrantiesApi.void(cid, detail.id);
      setDetail(r.warranty);
      qc.invalidateQueries({ queryKey: ["warranties"] });
      toast.success("Garantia anulada");
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para anular");
    }
  }

  const statusDoDoc = (w: Warranty): WarrantyStatus => {
    if (w.voided_at) return "anulada";
    return w.items.some((i) => i.status === "vigente") ? "vigente" : "vencida";
  };

  return (
    <View>
      {/* Resumo */}
      <View style={s.sumRow}>
        <Pressable onPress={() => setStatus("vigente")} style={s.sum}>
          <Text style={[s.sumN, { color: Colors.green }]}>{sum?.vigentes ?? "–"}</Text>
          <Text style={s.sumK}>vigentes</Text>
        </Pressable>
        <View style={s.sum}>
          <Text style={[s.sumN, { color: "#d97706" }]}>{sum?.vencendo_30d ?? "–"}</Text>
          <Text style={s.sumK}>vencem em 30 dias</Text>
        </View>
        <Pressable onPress={() => setStatus("vencida")} style={s.sum}>
          <Text style={[s.sumN, { color: Colors.ink2 }]}>{sum?.vencidas ?? "–"}</Text>
          <Text style={s.sumK}>vencidas</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => setScanOpen(true)} style={s.scanBtn} testID="garantia-ler-qr">
        <Icon name="qr_code" size={16} color="#fff" />
        <Text style={s.scanText}>Ler QR de uma garantia</Text>
      </Pressable>

      {/* Filtros */}
      <View style={s.filters}>
        <View style={s.field}>
          <Icon name="search" size={13} color={Colors.ink3} />
          <TextInput style={s.input} value={produto} onChangeText={setProduto}
            placeholder="Produto ou IMEI/série" placeholderTextColor={Colors.ink3} testID="garantia-f-produto" />
        </View>
        <View style={s.field}>
          <Icon name="users" size={13} color={Colors.ink3} />
          <TextInput style={s.input} value={cliente} onChangeText={setCliente}
            placeholder="Cliente, CPF ou telefone" placeholderTextColor={Colors.ink3} testID="garantia-f-cliente" />
        </View>
        <View style={s.dates}>
          <View style={[s.field, { flex: 1 }]}>
            <Icon name="calendar" size={13} color={Colors.ink3} />
            <TextInput style={s.input} value={de} onChangeText={(v) => setDe(maskData(v))}
              placeholder="Venda de dd/mm/aaaa" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} testID="garantia-f-de" />
          </View>
          <View style={[s.field, { flex: 1 }]}>
            <Icon name="calendar" size={13} color={Colors.ink3} />
            <TextInput style={s.input} value={ate} onChangeText={(v) => setAte(maskData(v))}
              placeholder="até dd/mm/aaaa" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} testID="garantia-f-ate" />
          </View>
        </View>
      </View>

      <View style={s.chips}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} onPress={() => setStatus(c.key)} style={[s.chip, status === c.key && s.chipOn]} testID={"garantia-chip-" + c.key}>
            <Text style={[s.chipText, status === c.key && s.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={Colors.violet3} /></View>
      ) : rows.length === 0 ? (
        <View style={s.empty}>
          <Icon name="shield" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Nenhuma garantia encontrada</Text>
          <Text style={s.emptyDesc}>
            {settings.os_enabled === true
              ? "Marque “Emitir garantia do produto” no PDV ao vender e o certificado aparece aqui."
              : "Ajuste os filtros para ver outras garantias."}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => abrir(r.warranty_id)} style={s.card} testID={"garantia-row-" + r.warranty_number}>
              <View style={s.cardTop}>
                <Text style={s.prod} numberOfLines={2}>{r.product_name}</Text>
                <View style={[s.badge, { borderColor: STATUS_COR[r.status] }]}>
                  <Text style={[s.badgeText, { color: STATUS_COR[r.status] }]}>{STATUS_LABEL[r.status]}</Text>
                </View>
              </View>
              <Text style={s.cust}>{r.customer_name}</Text>
              <View style={s.cardBottom}>
                <Text style={s.meta}>
                  Venda {dataBR(String(r.sale_date).slice(0, 10))}{r.sale_number ? " · nº " + r.sale_number : ""}
                </Text>
                <Text style={s.meta}>
                  {prazoLabel(r.days)} · até {dataBR(r.expires_on)}
                  {r.status === "vigente" ? " (" + (r.days_left === 0 ? "vence hoje" : r.days_left + " d") + ")" : ""}
                </Text>
              </View>
            </Pressable>
          ))}
          {isFetching && <ActivityIndicator color={Colors.violet3} size="small" />}
        </View>
      )}

      <WarrantyScanner visible={scanOpen} onClose={() => setScanOpen(false)} onCode={validar} />

      {/* Detalhe / resultado da validação */}
      <ResponsiveSheet visible={!!detail} onClose={() => setDetail(null)} maxWidth={440}>
        {detail && (
          <>
            <View style={s.dHead}>
              <View style={[s.dSeal, { backgroundColor: STATUS_COR[statusDoDoc(detail)] + "22", borderColor: STATUS_COR[statusDoDoc(detail)] }]}>
                <Icon name={statusDoDoc(detail) === "vigente" ? "check" : "x"} size={20} color={STATUS_COR[statusDoDoc(detail)]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.dStatus, { color: STATUS_COR[statusDoDoc(detail)] }]}>
                  {statusDoDoc(detail) === "vigente" ? "Garantia vigente" : statusDoDoc(detail) === "vencida" ? "Garantia vencida" : "Garantia anulada"}
                </Text>
                <Text style={s.dSub}>Nº {String(detail.warranty_number).padStart(6, "0")} · código {detail.code}</Text>
              </View>
              <Pressable onPress={() => setDetail(null)} hitSlop={10}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.dBody}>
              <View style={s.dBlock}>
                <Text style={s.dK}>Cliente</Text>
                <Text style={s.dV}>{detail.customer_name}</Text>
                <Text style={s.dS}>{detail.customer_phone || ""}</Text>
              </View>
              <View style={s.dBlock}>
                <Text style={s.dK}>Compra</Text>
                <Text style={s.dV}>
                  {detail.sale_number ? "Venda nº " + detail.sale_number : "Venda"} · {dataBR(String(detail.sale_date || detail.created_at).slice(0, 10))}
                </Text>
              </View>
              {detail.items.map((it) => (
                <View key={it.id} style={s.dItem}>
                  <Text style={s.dV}>{it.product_name}{it.quantity > 1 ? "  × " + it.quantity : ""}</Text>
                  {!!it.serial && <Text style={s.dS}>IMEI / série {it.serial}</Text>}
                  <Text style={s.dS}>
                    {prazoLabel(it.days)} · {dataBR(it.starts_on)} → {dataBR(it.expires_on)}
                  </Text>
                  <Text style={[s.dS, { color: STATUS_COR[detail.voided_at ? "anulada" : it.status], fontWeight: "800" }]}>
                    {detail.voided_at ? "Anulada" : it.status === "vigente"
                      ? (it.days_left === 0 ? "Vence hoje" : "Faltam " + it.days_left + (it.days_left === 1 ? " dia" : " dias"))
                      : "Venceu em " + dataBR(it.expires_on)}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={s.dFoot}>
              {!detail.voided_at && settings.os_enabled === true && (
                <Pressable onPress={anular} style={s.btnGhost} testID="garantia-anular">
                  <Text style={s.btnGhostText}>Anular</Text>
                </Pressable>
              )}
              <Pressable onPress={() => cid && printWarranty(cid, detail.id)} style={s.btn} testID="garantia-imprimir">
                <Icon name="file_text" size={14} color="#fff" />
                <Text style={s.btnText}>Imprimir</Text>
              </Pressable>
            </View>
          </>
        )}
      </ResponsiveSheet>
    </View>
  );
}

const s = StyleSheet.create({
  sumRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  sum: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  sumN: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  sumK: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  scanText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  filters: { gap: 8, marginBottom: 10 },
  field: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink },
  dates: { flexDirection: "row", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet + "22", borderColor: Colors.violet },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  center: { paddingVertical: 40, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyTitle: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  emptyDesc: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 320, lineHeight: 17 },
  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  prod: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "700" },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  cust: { fontSize: 12, color: Colors.ink2, marginTop: 4 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4, marginTop: 8 },
  meta: { fontSize: 11, color: Colors.ink3 },
  dHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 10 },
  dSeal: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  dStatus: { fontSize: 16, fontWeight: "800" },
  dSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  dBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  dBlock: { gap: 1 },
  dK: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: Colors.ink3 },
  dV: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  dS: { fontSize: 12, color: Colors.ink2, marginTop: 1 },
  dItem: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, gap: 2 },
  dFoot: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 10 },
  btnGhost: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnGhostText: { color: Colors.ink2, fontWeight: "700", fontSize: 13 },
  btn: { flex: 1.4, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
