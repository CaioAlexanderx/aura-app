// ============================================================
// Aura Karatê (dojô) — Certificados (Track J; F1: movida de
// /karate/sensei/certificados para /karate/(dojo)/certificados)
//
// Dojô vê:
//   1. "Praticantes aptos" — aprovados em banca (belt_history) sem pedido ativo
//   2. "Meus pedidos" — solicitações deste dojô com EstadoSelo
//
// Modal "Pedir certificado" (DNA TrocaModal):
//   — Nome como deve sair impresso
//   — Entrega: Retirada no dojô | Envio por correio (CEP, logradouro, ...)
//   — Observação (opcional)
//
// ⚠️ MOCK_APTOS segue hardcoded NESTA fase (F1 não mexe no mock —
// endpoint real de "aptos" fica pra fase futura, combinado do plano).
// StyleSheet: todos top-level são objetos (WeakMap safe). Sem deps novas.
// ============================================================
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { EstadoSelo, normalizeCertStatus } from "@/components/karate/EstadoSelo";
import { karateApi, CertOrder, CreateCertOrderInput } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

// ── Mock de praticantes aptos (para QA antes do endpoint real) ──
const MOCK_APTOS = [
  { id: "p1", name: "Ricardo Sato",  belt_level: "3kyu", belt_name: "3º Kyu — Faixa Verde", exam_date: "24 mai 2026", exam_ref: "Exame de Faixa · 24 mai 2026" },
  { id: "p2", name: "Fernanda Oka",  belt_level: "1dan", belt_name: "Shodan — 1º Dan",       exam_date: "24 mai 2026", exam_ref: "Exame de Dan · 24 mai 2026" },
  { id: "p3", name: "Caio Brandão", belt_level: "2kyu", belt_name: "2º Kyu — Faixa Marrom", exam_date: "24 mai 2026", exam_ref: "Exame de Faixa · 24 mai 2026" },
];

type DeliveryType = "pickup" | "mail";

interface PedirForm {
  nomeImpresso: string;
  delivery: DeliveryType;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  obs: string;
}

const DEFAULT_FORM: PedirForm = {
  nomeImpresso: "",
  delivery: "pickup",
  cep: "", logradouro: "", numero: "", complemento: "", cidade: "", obs: "",
};

export default function DojoCertificadosScreen() {
  const { federationId } = useKarateFederation();
  const [orders, setOrders] = useState<CertOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedirOpen, setPedirOpen] = useState(false);
  const [pedirApto, setPedirApto] = useState<typeof MOCK_APTOS[0] | null>(null);
  const [form, setForm] = useState<PedirForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await karateApi.listMyCertOrders(federationId);
      setOrders(res.data || []);
      // marca praticantes que já têm pedido ativo
      const ids = new Set<string>(
        res.data
          .filter((o) => o.status !== "refused")
          .map((o) => o.practitioner_id)
      );
      setRequestedIds(ids);
    } catch {
      // sem conexão ou migration pendente — mantém vazio
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openPedir = (apto: typeof MOCK_APTOS[0]) => {
    setPedirApto(apto);
    setForm({ ...DEFAULT_FORM, nomeImpresso: apto.name });
    setPedirOpen(true);
  };

  const submitPedir = async () => {
    if (!pedirApto) return;
    if (!form.nomeImpresso.trim()) return;
    if (form.delivery === "mail" && !form.logradouro.trim()) return;
    setSubmitting(true);
    try {
      const body: CreateCertOrderInput = {
        practitioner_id: pedirApto.id,
        belt_level:      pedirApto.belt_level,
        belt_name:       pedirApto.belt_name,
        exam_date:       pedirApto.exam_date,
        exam_ref:        pedirApto.exam_ref,
        nome_impresso:   form.nomeImpresso.trim(),
        delivery_type:   form.delivery,
        addr_cep:         form.cep        || null,
        addr_logradouro:  form.logradouro || null,
        addr_numero:      form.numero     || null,
        addr_complemento: form.complemento|| null,
        addr_cidade:      form.cidade     || null,
        observacao:       form.obs        || null,
      };
      const order = await karateApi.createCertOrder(federationId, body);
      setOrders((prev) => [order, ...prev]);
      setRequestedIds((prev) => new Set([...prev, pedirApto.id]));
      setPedirOpen(false);
      setToast(`Pedido enviado — ${pedirApto.name}`);
      setTimeout(() => setToast(""), 4000);
    } catch {
      // silencioso (erro de rede / 409 dup)
    } finally {
      setSubmitting(false);
    }
  };

  const aptos = MOCK_APTOS.filter((a) => !requestedIds.has(a.id));
  const withPedido = MOCK_APTOS.filter((a) => requestedIds.has(a.id));

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      {/* Section: Praticantes aptos */}
      <View style={st.sectionHead}>
        <View>
          <Text style={st.h2}>Praticantes aptos</Text>
          <Text style={st.sh}>Aprovados em banca — graduação já consta no histórico</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginVertical: 24 }} />
      ) : MOCK_APTOS.length === 0 ? (
        <View style={st.empty}>
          <Icon name="ribbon-outline" size={32} color={KarateColors.ink4} />
          <Text style={st.emptyText}>Nenhum praticante apto no momento</Text>
        </View>
      ) : (
        <View style={st.grid}>
          {aptos.map((a) => (
            <View key={a.id} style={st.card}>
              <View style={st.personRow}>
                <View style={st.av}><Text style={st.avText}>{a.name.split(" ").map((w) => w[0]).join("").slice(0,2)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{a.name}</Text>
                  <Text style={st.belt}>{a.belt_name}</Text>
                </View>
              </View>
              <Text style={st.examDate}>
                <Icon name="calendar-outline" size={11} color={KarateColors.ink3} /> Aprovado em {a.exam_date}
              </Text>
              <TouchableOpacity style={st.btnPrimary} onPress={() => openPedir(a)}>
                <Icon name="ribbon-outline" size={14} color="#fff" />
                <Text style={st.btnPrimaryText}>Pedir certificado</Text>
              </TouchableOpacity>
            </View>
          ))}
          {withPedido.map((a) => (
            <View key={a.id} style={st.card}>
              <View style={st.personRow}>
                <View style={st.av}><Text style={st.avText}>{a.name.split(" ").map((w) => w[0]).join("").slice(0,2)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{a.name}</Text>
                  <Text style={st.belt}>{a.belt_name}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <EstadoSelo status="requested" />
                <Text style={st.pedidoSub}>pedido enviado</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Section: Meus pedidos */}
      <View style={[st.sectionHead, { marginTop: 24 }]}>
        <View>
          <Text style={st.h2}>Meus pedidos</Text>
          <Text style={st.sh}>Solicitações deste dojô — estado atualizado pela federação</Text>
        </View>
        <View style={st.pill}><Text style={st.pillText}>{orders.length} pedidos</Text></View>
      </View>

      <View style={st.card}>
        {loading ? (
          <ActivityIndicator color={KarateColors.primary} />
        ) : orders.length === 0 ? (
          <View style={st.empty}>
            <Icon name="mail-outline" size={28} color={KarateColors.ink4} />
            <Text style={st.emptyText}>Nenhum pedido ainda</Text>
          </View>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={st.orderRow}>
              <View style={st.av}><Text style={st.avText}>{o.nome_impresso.split(" ").map((w: string) => w[0]).join("").slice(0,2)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{o.nome_impresso}</Text>
                <Text style={st.belt}>{o.belt_name}</Text>
              </View>
              <EstadoSelo status={normalizeCertStatus(o.status)} />
            </View>
          ))
        )}
      </View>

      {toast ? (
        <View style={st.toast}>
          <View style={st.toastDot} />
          <Text style={st.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Modal: Pedir certificado */}
      <Modal visible={pedirOpen} animationType="slide" transparent onRequestClose={() => setPedirOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPedirOpen(false)} />
          <View style={st.modalCard}>
            <View style={st.modalHeader}>
              <View>
                <Text style={st.modalTitle}>Pedir certificado</Text>
                <Text style={st.modalSub}>A federação imprime e envia. Acompanhe o estado por aqui.</Text>
              </View>
              <TouchableOpacity onPress={() => setPedirOpen(false)}>
                <Icon name="close" size={22} color={KarateColors.ink3} />
              </TouchableOpacity>
            </View>

            {pedirApto && (
              <View style={st.praticanteBox}>
                <View style={st.av}><Text style={st.avText}>{pedirApto.name.split(" ").map((w) => w[0]).join("").slice(0,2)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{pedirApto.name}</Text>
                  <Text style={st.belt}>{pedirApto.belt_name}</Text>
                </View>
                <View style={st.pill}><Text style={st.pillText}>Apto</Text></View>
              </View>
            )}

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={st.fieldLabel}>Nome como deve sair impresso</Text>
              <TextInput
                style={st.field}
                value={form.nomeImpresso}
                onChangeText={(v) => setForm((f) => ({ ...f, nomeImpresso: v }))}
                placeholder="Nome completo"
                placeholderTextColor={KarateColors.ink4}
              />

              <Text style={[st.fieldLabel, { marginTop: 18 }]}>Entrega</Text>
              <View style={st.deliveryRow}>
                <TouchableOpacity
                  style={[st.optBox, form.delivery === "pickup" && st.optBoxSel]}
                  onPress={() => setForm((f) => ({ ...f, delivery: "pickup" }))}
                >
                  <View style={[st.radio, form.delivery === "pickup" && st.radioSel]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.optTitle}>Retirada no dojô</Text>
                    <Text style={st.optSub}>A federação avisa quando estiver pronto.</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.optBox, form.delivery === "mail" && st.optBoxSel]}
                  onPress={() => setForm((f) => ({ ...f, delivery: "mail" }))}
                >
                  <View style={[st.radio, form.delivery === "mail" && st.radioSel]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.optTitle}>Envio por correio</Text>
                    <Text style={st.optSub}>Informe o endereço completo.</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {form.delivery === "mail" && (
                <>
                  <View style={st.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.fieldLabel}>CEP</Text>
                      <TextInput style={st.field} value={form.cep} onChangeText={(v) => setForm((f) => ({ ...f, cep: v }))} placeholder="00000-000" placeholderTextColor={KarateColors.ink4} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.fieldLabel}>Cidade / UF</Text>
                      <TextInput style={st.field} value={form.cidade} onChangeText={(v) => setForm((f) => ({ ...f, cidade: v }))} placeholder="São Paulo / SP" placeholderTextColor={KarateColors.ink4} />
                    </View>
                  </View>
                  <Text style={st.fieldLabel}>Logradouro</Text>
                  <TextInput style={st.field} value={form.logradouro} onChangeText={(v) => setForm((f) => ({ ...f, logradouro: v }))} placeholder="Rua / Av." placeholderTextColor={KarateColors.ink4} />
                  <View style={st.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.fieldLabel}>Número</Text>
                      <TextInput style={st.field} value={form.numero} onChangeText={(v) => setForm((f) => ({ ...f, numero: v }))} placeholder="Nº" placeholderTextColor={KarateColors.ink4} />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={st.fieldLabel}>Complemento</Text>
                      <TextInput style={st.field} value={form.complemento} onChangeText={(v) => setForm((f) => ({ ...f, complemento: v }))} placeholder="Apto, bairro" placeholderTextColor={KarateColors.ink4} />
                    </View>
                  </View>
                </>
              )}

              <Text style={st.fieldLabel}>Observação (opcional)</Text>
              <TextInput
                style={st.field}
                value={form.obs}
                onChangeText={(v) => setForm((f) => ({ ...f, obs: v }))}
                placeholder="Ex.: grafia do nome, urgência"
                placeholderTextColor={KarateColors.ink4}
              />

              <View style={st.modalFooter}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setPedirOpen(false)} disabled={submitting}>
                  <Text style={st.btnGhostText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.btnPrimary} onPress={submitPedir} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={st.btnPrimaryText}>Enviar pedido</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 48 } as ViewStyle,

  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 } as ViewStyle,
  h2: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sh: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  grid: { gap: 12 } as ViewStyle,
  card: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 10 } as ViewStyle,

  personRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  av:   { width: 38, height: 38, borderRadius: 19, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  avText: { fontSize: 13, fontWeight: "800", color: KarateColors.primary } as TextStyle,
  name: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  belt: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  examDate: { fontSize: 11.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,

  pedidoSub: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,

  orderRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,

  empty: { alignItems: "center", paddingVertical: 28, gap: 8 } as ViewStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink4 } as TextStyle,

  pill: { backgroundColor: KarateColors.surface, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  pillText: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  toast: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 } as ViewStyle,
  toastDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: KarateColors.ok } as ViewStyle,
  toastText: { fontSize: 12, color: KarateColors.ok } as TextStyle,

  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 16 } as ViewStyle,
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
  btnGhost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "transparent", borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingVertical: 10, paddingHorizontal: 16 } as ViewStyle,
  btnGhostText: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,23,20,0.34)" } as ViewStyle,
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: KarateRadius.lg, borderTopRightRadius: KarateRadius.lg, padding: 24, maxHeight: "90%" } as ViewStyle,
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 } as ViewStyle,
  modalTitle: { fontSize: 18, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  modalSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 3 } as TextStyle,
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingBottom: 8 } as ViewStyle,

  praticanteBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.surface, marginBottom: 18 } as ViewStyle,

  fieldLabel: { fontSize: 10.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.06, color: KarateColors.ink3, marginBottom: 6, marginTop: 10 } as TextStyle,
  field: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 11, fontSize: 14, color: KarateColors.ink, backgroundColor: "#fff" } as ViewStyle,

  deliveryRow: { flexDirection: "row", gap: 10 } as ViewStyle,
  optBox: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: "#fff" } as ViewStyle,
  optBoxSel: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: KarateColors.ink4, marginTop: 1, flexShrink: 0 } as ViewStyle,
  radioSel: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primary } as ViewStyle,
  optTitle: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  optSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
});
