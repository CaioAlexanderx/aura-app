// ============================================================
// AURA. — Ótica: janela da receita (nova e edição)
//
// 23/11/2026. Saiu de app/(tabs)/otica/receitas.tsx para ganhar o que
// faltava: EDITAR uma receita salva (a API já tinha o PATCH; não havia
// botão) e cadastrar o cliente sem sair da janela.
//
// Formulário aberto, sem passos (app#859): quem digita está com o papel do
// prescritor na mão. Cabeçalho e rodapé fixos, miolo com rolagem — a grade
// mais os campos não cabem num celular nem num notebook de 720p.
//
// Editar não mexe em OS já aberta: a OS guarda a cópia da receita do dia em
// que foi aberta (service_orders.optical). A janela avisa isso.
// ============================================================
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { oticaApi, type Prescription } from "@/services/oticaApi";
import { RxEditor, emptyRxDraft, rxDraftFromPrescription, rxDraftToBody, validateRxDraft, type RxDraft } from "@/components/otica/RxEditor";
import { CadastroDoClienteOtica } from "@/components/otica/CadastroDoClienteOtica";

type Props = {
  visible: boolean;
  onClose: () => void;
  validityMonths: number;
  /** Cliente já escolhido (a tela veio filtrada por ele). */
  presetCustomerId?: string | null;
  /** Receita a editar. Ausente = receita nova. */
  editing?: Prescription | null;
};

export function ReceitaSheet(props: Props) {
  // Só monta com a janela aberta: cada abertura começa do zero (ou da receita
  // escolhida), e a grade — que guarda o texto digitado — nunca herda sobra.
  if (!props.visible) return null;
  return <Janela key={props.editing?.id || "nova"} {...props} />;
}

function Janela({ onClose, validityMonths, presetCustomerId, editing }: Props) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { customers } = useCustomers();
  const [customerId, setCustomerId] = useState<string | null>(editing?.customer_id || presetCustomerId || null);
  const [customerName, setCustomerName] = useState<string>(editing?.customer_name || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [draft, setDraft] = useState<RxDraft>(() => editing ? rxDraftFromPrescription(editing) : emptyRxDraft(validityMonths));
  const [saving, setSaving] = useState(false);

  const nome = customers.find((c) => c.id === customerId)?.name || customerName;
  const matches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const qd = q.replace(/\D/g, "");
    return customers.filter((c) => (c.name || "").toLowerCase().includes(q) || (!!qd && (c.phone || "").replace(/\D/g, "").includes(qd))).slice(0, 6);
  }, [customers, customerQuery]);

  async function save() {
    if (!company?.id || saving) return;
    if (!customerId) { toast.error("Escolha o cliente da receita"); return; }
    const err = validateRxDraft(draft);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (editing) await oticaApi.patchPrescription(company.id, editing.id, rxDraftToBody(draft));
      else await oticaApi.createPrescription(company.id, { customer_id: customerId, ...rxDraftToBody(draft) });
      qc.invalidateQueries({ queryKey: ["otica-prescriptions"] });
      qc.invalidateQueries({ queryKey: ["otica-dashboard"] });
      toast.success(editing ? "Receita atualizada" : "Receita registrada");
      onClose();
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para salvar a receita. Confira os dados e tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  if (cadastrando) {
    return (
      <ResponsiveSheet visible onClose={() => setCadastrando(false)} maxWidth={640}>
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 4 }}>
          <CadastroDoClienteOtica
            onCancel={() => setCadastrando(false)}
            onSaved={(c) => { setCustomerId(c.id); setCustomerName(c.name); setCustomerQuery(""); setCadastrando(false); }}
          />
        </ScrollView>
      </ResponsiveSheet>
    );
  }

  return (
    <ResponsiveSheet visible onClose={onClose} onBackdropPress={saving ? () => {} : onClose} maxWidth={640}>
      <View style={st.head}>
        <Text style={st.title} testID="otica-rx-sheet-titulo">{editing ? "Editar receita" : "Nova receita"}<Text style={{ color: Colors.violet }}>.</Text></Text>
        <Pressable onPress={onClose} style={st.close} accessibilityLabel="Fechar" hitSlop={8}>
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.body} bounces={false} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={st.lbl}>Cliente</Text>
          {customerId ? (
            <View style={st.selectedRow}>
              <Icon name="check" size={14} color={Colors.green} />
              <Text style={st.selectedName} numberOfLines={1}>{nome || "Cliente"}</Text>
              {!presetCustomerId && !editing && (
                <Pressable onPress={() => { setCustomerId(null); setCustomerName(""); }} hitSlop={8} testID="otica-rx-trocar-cliente"><Text style={st.link}>trocar</Text></Pressable>
              )}
            </View>
          ) : (
            <>
              <View style={st.searchBox}>
                <Icon name="search" size={14} color={Colors.ink3} />
                <TextInput style={st.searchInput} value={customerQuery} onChangeText={setCustomerQuery} placeholder="Nome ou telefone" placeholderTextColor={Colors.ink3} testID="otica-rx-busca-cliente" />
              </View>
              {matches.map((c) => (
                <Pressable key={c.id} onPress={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerQuery(""); }} style={st.matchRow} testID={`otica-rx-cliente-${c.id}`}>
                  <Text style={st.matchName} numberOfLines={1}>{c.name}</Text>
                  {!!c.phone && <Text style={st.matchMeta}>{c.phone}</Text>}
                </Pressable>
              ))}
              {customerQuery.trim().length >= 2 && matches.length === 0 && (
                <Text style={st.hint}>Nenhum cliente com esse nome ou telefone.</Text>
              )}
              <Pressable onPress={() => setCadastrando(true)} style={st.addRow} testID="otica-rx-cadastrar-cliente">
                <Icon name="user_plus" size={14} color={Colors.violet3} />
                <Text style={st.link}>Cadastrar cliente</Text>
              </Pressable>
            </>
          )}
        </View>

        <RxEditor value={draft} onChange={setDraft} validityMonths={validityMonths} testID="otica-rx-form" />

        {editing && (
          <Text style={st.hint} testID="otica-rx-aviso-edicao">
            As OS já abertas com esta receita guardam a cópia do dia em que foram abertas. O que você mudar aqui vale para o receituário e para as próximas OS.
          </Text>
        )}
      </ScrollView>

      <View style={st.foot}>
        <Pressable onPress={onClose} style={st.ghostBtn} disabled={saving}><Text style={st.ghostBtnText}>Cancelar</Text></Pressable>
        <Pressable onPress={save} style={[st.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} testID="otica-rx-salvar">
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.primaryBtnText}>{editing ? "Salvar alterações" : "Registrar receita"}</Text>}
        </Pressable>
      </View>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  title: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.ink, letterSpacing: -0.4 },
  close: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  hint: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 6 },
  link: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  selectedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectedName: { fontSize: 14, color: Colors.ink, fontWeight: "700", flex: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.ink, minWidth: 0 },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  matchName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flex: 1 },
  matchMeta: { fontSize: 11, color: Colors.ink3 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, alignSelf: "flex-start" },
  ghostBtn: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  ghostBtnText: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  primaryBtn: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, minWidth: 150, alignItems: "center" },
  primaryBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
