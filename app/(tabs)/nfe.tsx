import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { nfeApi } from "@/services/api";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { ListSkeleton } from "@/components/ListSkeleton";

const TABS = ["Documentos", "Emitir NFS-e", "Emitir NFC-e", "Configuracao"];
const fmt = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type NfeDoc = {
  id: string; ref: string; type: string; status: string;
  number: string | null; recipient_name: string; description: string;
  value: number; issued_at: string | null; cancelled_at: string | null; created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  authorized: { label: "Autorizada", color: Colors.green },
  cancelled:  { label: "Cancelada", color: Colors.red },
  pending:    { label: "Pendente", color: Colors.amber },
  processing: { label: "Processando", color: Colors.violet3 },
  error:      { label: "Erro", color: Colors.red },
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_MAP[status] || STATUS_MAP.pending;
  return <View style={[z.badge, { backgroundColor: st.color + "18" }]}><Text style={[z.badgeText, { color: st.color }]}>{st.label}</Text></View>;
}

function DocRow({ doc, onCancel, onView }: { doc: NfeDoc; onCancel: () => void; onView: () => void }) {
  const typeLabel = doc.type === "nfse" ? "NFS-e" : doc.type === "nfce" ? "NFC-e" : "NF-e";
  return (
    <View style={z.docRow}>
      <View style={z.docIcon}><Icon name="file_text" size={16} color={Colors.violet3} /></View>
      <View style={z.docInfo}>
        <Text style={z.docNumber}>#{doc.number || "---"} - {typeLabel}</Text>
        <Text style={z.docRecipient}>{doc.recipient_name || "Consumidor"}</Text>
        <Text style={z.docDate}>{doc.issued_at ? new Date(doc.issued_at).toLocaleDateString("pt-BR") : new Date(doc.created_at).toLocaleDateString("pt-BR")}</Text>
      </View>
      <View style={z.docRight}>
        <Text style={z.docAmount}>{fmt(doc.value)}</Text>
        <StatusBadge status={doc.status} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
          <Pressable onPress={onView} style={z.miniBtn}><Text style={z.miniBtnText}>Ver</Text></Pressable>
          {doc.status === "authorized" && (
            <Pressable onPress={onCancel} style={[z.miniBtn, { borderColor: Colors.red + "33" }]}><Text style={[z.miniBtnText, { color: Colors.red }]}>Cancelar</Text></Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function EmitNfseForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [recipientName, setRecipientName] = useState("");
  const [recipientDoc, setRecipientDoc] = useState("");
  const [description, setDescription] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [value, setValue] = useState("");
  const [issRate, setIssRate] = useState("2");
  const [recipientEmail, setRecipientEmail] = useState("");

  const emitMut = useMutation({
    mutationFn: (body: any) => nfeApi.emitNfse(companyId, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["nfe-docs", companyId] });
      toast.success(`NFS-e ${res.status === "authorized" ? "autorizada" : "enviada para processamento"}!`);
      setRecipientName(""); setRecipientDoc(""); setDescription(""); setValue(""); setRecipientEmail("");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao emitir NFS-e"),
  });

  function handleEmit() {
    if (!description.trim()) { toast.error("Descricao do servico obrigatoria"); return; }
    if (!value.trim() || parseFloat(value) <= 0) { toast.error("Valor obrigatorio"); return; }
    emitMut.mutate({
      recipient_name: recipientName.trim() || undefined,
      recipient_cnpj: recipientDoc.replace(/\D/g, "").length === 14 ? recipientDoc.replace(/\D/g, "") : undefined,
      recipient_cpf: recipientDoc.replace(/\D/g, "").length === 11 ? recipientDoc.replace(/\D/g, "") : undefined,
      recipient_email: recipientEmail.trim() || undefined,
      description: description.trim(),
      service_code: serviceCode.trim() || undefined,
      value: parseFloat(value.replace(",", ".")),
      iss_rate: parseFloat(issRate.replace(",", ".")) || 2,
    });
  }

  return (
    <View style={z.formCard}>
      <Text style={z.formTitle}>Emitir NFS-e (Nota de Servico)</Text>
      <Text style={z.formHint}>Preencha os dados do servico prestado. O tomador e opcional.</Text>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Nome do tomador</Text><TextInput style={z.fInput} value={recipientName} onChangeText={setRecipientName} placeholder="Razao social ou nome" placeholderTextColor={Colors.ink3} /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>CNPJ/CPF do tomador</Text><TextInput style={z.fInput} value={recipientDoc} onChangeText={setRecipientDoc} placeholder="00.000.000/0001-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 2 }}><Text style={z.fLabel}>Descricao do servico *</Text><TextInput style={[z.fInput, { minHeight: 60 }]} value={description} onChangeText={setDescription} placeholder="Descreva o servico prestado..." placeholderTextColor={Colors.ink3} multiline /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Codigo do servico</Text><TextInput style={z.fInput} value={serviceCode} onChangeText={setServiceCode} placeholder="Ex: 1.05" placeholderTextColor={Colors.ink3} /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Valor (R$) *</Text><TextInput style={z.fInput} value={value} onChangeText={setValue} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>ISS (%)</Text><TextInput style={z.fInput} value={issRate} onChangeText={setIssRate} placeholder="2" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>E-mail do tomador (envio automatico)</Text><TextInput style={z.fInput} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="cliente@empresa.com" placeholderTextColor={Colors.ink3} autoCapitalize="none" keyboardType="email-address" /></View>
      </View>
      <Pressable onPress={handleEmit} disabled={emitMut.isPending} style={[z.emitBtn, emitMut.isPending && { opacity: 0.6 }]}>
        {emitMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={z.emitBtnText}>Emitir NFS-e</Text>}
      </Pressable>
    </View>
  );
}

function EmitNfceForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [cpf, setCpf] = useState("");
  const [items, setItems] = useState("1");
  const [totalValue, setTotalValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");

  const emitMut = useMutation({
    mutationFn: (body: any) => nfeApi.emitNfce(companyId, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["nfe-docs", companyId] });
      toast.success(`NFC-e ${res.status === "authorized" ? "autorizada" : "enviada"}!`);
      setCpf(""); setTotalValue("");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao emitir NFC-e"),
  });

  function handleEmit() {
    if (!totalValue.trim() || parseFloat(totalValue) <= 0) { toast.error("Valor total obrigatorio"); return; }
    emitMut.mutate({
      recipient_cpf: cpf.replace(/\D/g, "") || undefined,
      items: [{ description: "Venda PDV", quantity: parseInt(items) || 1, unit_value: parseFloat(totalValue.replace(",", ".")) }],
      total_value: parseFloat(totalValue.replace(",", ".")),
      payment_method: paymentMethod,
    });
  }

  return (
    <View style={z.formCard}>
      <Text style={z.formTitle}>Emitir NFC-e (Nota de Consumidor)</Text>
      <Text style={z.formHint}>Para vendas no varejo. O CPF do consumidor e opcional.</Text>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>CPF do consumidor (opcional)</Text><TextInput style={z.fInput} value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Text style={z.fLabel}>Valor total (R$) *</Text><TextInput style={z.fInput} value={totalValue} onChangeText={setTotalValue} placeholder="0,00" placeholderTextColor={Colors.ink3} keyboardType="decimal-pad" /></View>
      </View>
      <View style={z.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={z.fLabel}>Pagamento</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {["pix","dinheiro","cartao","debito"].map(m => (
              <Pressable key={m} onPress={() => setPaymentMethod(m)} style={[z.chip, paymentMethod === m && z.chipActive]}>
                <Text style={[z.chipText, paymentMethod === m && z.chipTextActive]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Pressable onPress={handleEmit} disabled={emitMut.isPending} style={[z.emitBtn, emitMut.isPending && { opacity: 0.6 }]}>
        {emitMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={z.emitBtnText}>Emitir NFC-e</Text>}
      </Pressable>
    </View>
  );
}

function TabConfig({ companyId }: { companyId: string }) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [certFile, setCertFile] = useState("");
  const [certPass, setCertPass] = useState("");

  const setupMut = useMutation({
    mutationFn: () => nfeApi.setup(companyId),
    onSuccess: () => toast.success("Empresa registrada na Nuvem Fiscal!"),
    onError: (e: any) => toast.error(e?.message || "Erro no setup"),
  });

  const certMut = useMutation({
    mutationFn: (body: any) => nfeApi.uploadCertificate(companyId, body),
    onSuccess: () => toast.success("Certificado A1 enviado!"),
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar certificado"),
  });

  function handleCertUpload() {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".pfx,.p12";
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setCertFile(base64);
        toast.info(`Certificado ${file.name} carregado. Informe a senha.`);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function submitCert() {
    if (!certFile) { toast.error("Selecione o certificado A1 (.pfx)"); return; }
    if (!certPass) { toast.error("Senha do certificado obrigatoria"); return; }
    certMut.mutate({ certificate: certFile, password: certPass });
  }

  const hasCnpj = !!(company as any)?.cnpj;

  return (
    <View>
      <View style={z.formCard}>
        <Text style={z.formTitle}>Configuracao fiscal</Text>
        <View style={z.configItem}>
          <Icon name={hasCnpj ? "check" : "alert"} size={16} color={hasCnpj ? Colors.green : Colors.amber} />
          <Text style={z.configLabel}>CNPJ cadastrado</Text>
          <Text style={[z.configValue, { color: hasCnpj ? Colors.green : Colors.amber }]}>{hasCnpj ? (company as any).cnpj : "Nao informado"}</Text>
        </View>
        <View style={z.divider} />
        <Text style={z.fLabel}>1. Registrar empresa na Nuvem Fiscal</Text>
        <Pressable onPress={() => setupMut.mutate()} disabled={setupMut.isPending || !hasCnpj} style={[z.configBtn, (!hasCnpj || setupMut.isPending) && { opacity: 0.5 }]}>
          <Text style={z.configBtnText}>{setupMut.isPending ? "Registrando..." : "Registrar empresa"}</Text>
        </Pressable>
        <View style={z.divider} />
        <Text style={z.fLabel}>2. Enviar certificado digital A1 (.pfx)</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable onPress={handleCertUpload} style={z.configBtn}><Text style={z.configBtnText}>{certFile ? "Certificado selecionado" : "Selecionar .pfx"}</Text></Pressable>
        </View>
        {certFile && (
          <View style={{ marginTop: 8 }}>
            <TextInput style={z.fInput} value={certPass} onChangeText={setCertPass} placeholder="Senha do certificado" placeholderTextColor={Colors.ink3} secureTextEntry />
            <Pressable onPress={submitCert} disabled={certMut.isPending} style={[z.emitBtn, { marginTop: 8 }, certMut.isPending && { opacity: 0.6 }]}>
              <Text style={z.emitBtnText}>{certMut.isPending ? "Enviando..." : "Enviar certificado"}</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={z.infoCard}>
        <Icon name="info" size={13} color={Colors.violet3} />
        <Text style={z.infoText}>O certificado A1 e necessario para emissao de NF-e e NFC-e. Adquira junto a sua certificadora (Certisign, Serasa, etc). Validade: 1 ano.</Text>
      </View>
    </View>
  );
}

export default function NfeScreen() {
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["nfe-docs", company?.id],
    queryFn: () => nfeApi.list(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 15000,
  });
  const docs: NfeDoc[] = data?.documents || [];

  const cancelMut = useMutation({
    mutationFn: (ref: string) => nfeApi.cancel(company!.id, ref),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nfe-docs", company?.id] }); toast.success("Documento cancelado"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao cancelar"),
  });

  const authorized = docs.filter(d => d.status === "authorized");
  const totalMonth = authorized.reduce((s, d) => s + Number(d.value || 0), 0);
  const pending = docs.filter(d => d.status === "pending" || d.status === "processing").length;

  const filtered = docs.filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  async function handleViewDoc(ref: string) {
    try {
      const doc = await nfeApi.get(company!.id, ref);
      if (doc.pdf_url && Platform.OS === "web") { window.open(doc.pdf_url, "_blank"); return; }
      toast.info(`Status: ${STATUS_MAP[doc.status]?.label || doc.status}${doc.number ? " | Numero: " + doc.number : ""}`);
    } catch { toast.error("Erro ao consultar documento"); }
  }

  return (
    <ScrollView style={z.scr} contentContainerStyle={z.cnt}>
      <PageHeader title="NF-e" />

      <View style={z.kpis}>
        <View style={z.kpi}><Text style={z.kv}>{docs.length}</Text><Text style={z.kl}>Emitidas</Text></View>
        <View style={z.kpi}><Text style={[z.kv, { color: Colors.green }]}>{fmt(totalMonth)}</Text><Text style={z.kl}>Faturado</Text></View>
        <View style={z.kpi}><Text style={[z.kv, { color: pending > 0 ? Colors.amber : Colors.green }]}>{pending}</Text><Text style={z.kl}>Pendentes</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6 }}>
        {TABS.map((t, i) => <Pressable key={t} onPress={() => setTab(i)} style={[z.tab, tab === i && z.tabActive]}><Text style={[z.tabText, tab === i && z.tabTextActive]}>{t}</Text></Pressable>)}
      </ScrollView>

      {isLoading && tab === 0 && <ListSkeleton rows={4} />}

      {tab === 0 && !isLoading && (
        <View>
          {docs.length === 0 ? (
            <EmptyState icon="file_text" iconColor={Colors.violet3} title="Nenhuma nota fiscal" subtitle="Emita sua primeira NFS-e ou NFC-e usando as abas acima." />
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {["all","nfse","nfce"].map(t => (
                  <Pressable key={t} onPress={() => setTypeFilter(t)} style={[z.chip, typeFilter === t && z.chipActive]}>
                    <Text style={[z.chipText, typeFilter === t && z.chipTextActive]}>{t === "all" ? "Todas" : t.toUpperCase()}</Text>
                  </Pressable>
                ))}
                {["all","authorized","pending","cancelled"].map(st => (
                  <Pressable key={st} onPress={() => setStatusFilter(st)} style={[z.chip, statusFilter === st && z.chipActive]}>
                    <Text style={[z.chipText, statusFilter === st && z.chipTextActive]}>{st === "all" ? "Todos" : STATUS_MAP[st]?.label || st}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={z.listCard}>
                {filtered.map(d => <DocRow key={d.id} doc={d} onCancel={() => setCancelTarget(d.ref)} onView={() => handleViewDoc(d.ref)} />)}
                {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 30 }}><Text style={{ fontSize: 12, color: Colors.ink3 }}>Nenhum documento com este filtro</Text></View>}
              </View>
            </>
          )}
        </View>
      )}

      {tab === 1 && company?.id && <EmitNfseForm companyId={company.id} />}
      {tab === 2 && company?.id && <EmitNfceForm companyId={company.id} />}
      {tab === 3 && company?.id && <TabConfig companyId={company.id} />}

      <ConfirmDialog visible={!!cancelTarget} title="Cancelar nota fiscal?" message="O cancelamento sera enviado a SEFAZ. Esta acao nao pode ser desfeita." confirmLabel="Cancelar nota" destructive
        onConfirm={() => { if (cancelTarget) { cancelMut.mutate(cancelTarget); setCancelTarget(null); } }} onCancel={() => setCancelTarget(null)} />

      <DemoBanner />
    </ScrollView>
  );
}

const z = StyleSheet.create({
  scr: { flex: 1 }, cnt: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4 },
  kv: { fontSize: 20, fontWeight: "800", color: Colors.ink }, kl: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" }, tabTextActive: { color: "#fff", fontWeight: "600" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }, badgeText: { fontSize: 9, fontWeight: "700" },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center" },
  docInfo: { flex: 1, gap: 2 },
  docNumber: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  docRecipient: { fontSize: 11, color: Colors.ink3 },
  docDate: { fontSize: 10, color: Colors.ink3 },
  docRight: { alignItems: "flex-end", gap: 4 },
  docAmount: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  miniBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  miniBtnText: { fontSize: 10, color: Colors.violet3, fontWeight: "600" },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  formHint: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  formRow: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0, marginBottom: 4 },
  fLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  fInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" }, chipTextActive: { color: Colors.violet3, fontWeight: "600" },
  emitBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  emitBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  configItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  configLabel: { flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "600" },
  configValue: { fontSize: 12, fontWeight: "600" },
  configBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2, alignSelf: "flex-start" },
  configBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  infoCard: { flexDirection: "row", gap: 8, backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  infoText: { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
});
