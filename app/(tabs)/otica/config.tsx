// ============================================================
// AURA. — Ótica: configurações
//
// O que a loja precisa acertar UMA vez: laboratórios (com prazo, que vira
// a previsão de entrega da OS), validade padrão da receita, garantia de
// adaptação, responsável técnico e licença sanitária (por CNPJ — o art. 11
// do Decreto 24.492 proíbe o mesmo óptico em dois estabelecimentos), e as
// três automações de WhatsApp da ótica.
//
// Chave própria (otica.config, Essencial): qualquer plano com a ótica ligada
// consegue cadastrar laboratório, como food.config.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Switch } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { oticaApi, OTICA_SETTINGS_DEFAULTS, type OpticalLab, type OticaSettings } from "@/services/oticaApi";

type LabDraft = { name: string; contact_name: string; phone: string; email: string; portal_url: string; lead_days: string; notes: string };
const EMPTY_LAB: LabDraft = { name: "", contact_name: "", phone: "", email: "", portal_url: "", lead_days: "7", notes: "" };

export default function OticaConfigScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const { settings: pdv } = usePdvSettings();
  const enabled = pdv.otica_enabled === true;

  const { data: sData, isLoading } = useQuery({
    queryKey: ["otica-settings", company?.id],
    queryFn: () => oticaApi.getSettings(company!.id),
    enabled: !!company?.id,
  });
  const { data: lData } = useQuery({
    queryKey: ["otica-labs", company?.id],
    queryFn: () => oticaApi.listLabs(company!.id),
    enabled: !!company?.id,
  });
  const labs = lData?.labs || [];

  const [form, setForm] = useState<OticaSettings>(OTICA_SETTINGS_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (sData?.settings) { setForm({ ...OTICA_SETTINGS_DEFAULTS, ...sData.settings }); setDirty(false); } }, [sData]);

  const set = (patch: Partial<OticaSettings>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  async function saveSettings() {
    if (!company?.id || saving) return;
    setSaving(true);
    try {
      await oticaApi.saveSettings(company.id, form);
      qc.invalidateQueries({ queryKey: ["otica-settings"] });
      setDirty(false);
      toast.success("Configurações da ótica salvas");
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para salvar");
    } finally {
      setSaving(false);
    }
  }

  // ── Laboratórios ──
  const [editing, setEditing] = useState<OpticalLab | "new" | null>(null);
  const [lab, setLab] = useState<LabDraft>(EMPTY_LAB);
  const [labBusy, setLabBusy] = useState(false);

  function startEdit(l: OpticalLab | "new") {
    setEditing(l);
    setLab(l === "new" ? EMPTY_LAB : {
      name: l.name, contact_name: l.contact_name || "", phone: l.phone || "", email: l.email || "",
      portal_url: l.portal_url || "", lead_days: String(l.lead_days ?? 7), notes: l.notes || "",
    });
  }

  async function saveLab() {
    if (!company?.id || labBusy || !editing) return;
    if (!lab.name.trim()) { toast.error("Dê um nome ao laboratório"); return; }
    setLabBusy(true);
    try {
      const body = {
        name: lab.name.trim(), contact_name: lab.contact_name.trim() || null, phone: lab.phone.trim() || null,
        email: lab.email.trim() || null, portal_url: lab.portal_url.trim() || null,
        lead_days: parseInt(lab.lead_days, 10) || 0, notes: lab.notes.trim() || null,
      };
      if (editing === "new") await oticaApi.createLab(company.id, body);
      else await oticaApi.patchLab(company.id, editing.id, body);
      qc.invalidateQueries({ queryKey: ["otica-labs"] });
      toast.success(editing === "new" ? "Laboratório cadastrado" : "Laboratório atualizado");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para salvar o laboratório");
    } finally {
      setLabBusy(false);
    }
  }

  async function toggleLab(l: OpticalLab) {
    if (!company?.id) return;
    try {
      await oticaApi.patchLab(company.id, l.id, { is_active: !l.is_active });
      qc.invalidateQueries({ queryKey: ["otica-labs"] });
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para atualizar");
    }
  }

  if (isLoading) {
    return <View style={[st.screen, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator color={Colors.violet3} /></View>;
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <Pressable onPress={() => router.back()} style={st.backBtn}>
        <Icon name="chevron_left" size={16} color={Colors.violet3} />
        <Text style={st.backText}>Voltar</Text>
      </Pressable>
      <Text style={st.pageTitle}>Ótica · configurações<Text style={{ color: Colors.violet }}>.</Text></Text>
      <Text style={st.pageSubtitle}>Laboratórios, validade da receita, garantia de adaptação, responsável técnico e as mensagens automáticas do WhatsApp.</Text>

      {!enabled && (
        <View style={st.warn}><Text style={st.warnText}>O módulo Ótica está desligado. Ligue em Configurações › Vendas para o menu mostrar Laboratório e Receitas.</Text></View>
      )}

      {/* ══ LABORATÓRIOS ══ */}
      <Text style={st.sectionTitle}>Laboratórios</Text>
      <View style={st.card}>
        {labs.length === 0 && editing !== "new" && (
          <Text style={st.hint}>Nenhum laboratório ainda. O prazo em dias vira a previsão de entrega quando você abre uma OS.</Text>
        )}
        {labs.map((l) => (
          <View key={l.id} style={[st.labRow, !l.is_active && { opacity: 0.5 }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.labName}>{l.name} {form.default_lab_id === l.id && <Text style={st.defaultTag}>padrão</Text>}</Text>
              <Text style={st.labMeta}>
                {l.lead_days} {l.lead_days === 1 ? "dia" : "dias"}{l.contact_name ? ` · ${l.contact_name}` : ""}{l.phone ? ` · ${l.phone}` : ""}{!l.is_active ? " · inativo" : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {l.is_active && form.default_lab_id !== l.id && (
                <Pressable onPress={() => set({ default_lab_id: l.id })} style={st.miniBtn}><Text style={st.miniBtnText}>Tornar padrão</Text></Pressable>
              )}
              <Pressable onPress={() => startEdit(l)} style={st.miniBtn} testID={`otica-lab-editar-${l.id}`}><Text style={st.miniBtnText}>Editar</Text></Pressable>
              <Pressable onPress={() => toggleLab(l)} style={st.miniBtn}><Text style={st.miniBtnText}>{l.is_active ? "Desativar" : "Reativar"}</Text></Pressable>
            </View>
          </View>
        ))}

        {editing ? (
          <View style={st.labForm}>
            <Text style={st.labFormTitle}>{editing === "new" ? "Novo laboratório" : `Editar ${editing.name}`}</Text>
            <View style={st.row2}>
              <View style={[st.col, { flex: 2 }]}><Text style={st.lbl}>Nome</Text><TextInput style={st.input} value={lab.name} onChangeText={(v) => setLab({ ...lab, name: v })} placeholder="Zeiss (Visustore), Lab Ótico Central…" placeholderTextColor={Colors.ink3} testID="otica-lab-nome" /></View>
              <View style={st.col}><Text style={st.lbl}>Prazo (dias)</Text><TextInput style={st.input} value={lab.lead_days} keyboardType="numeric" onChangeText={(v) => setLab({ ...lab, lead_days: v.replace(/\D/g, "").slice(0, 3) })} testID="otica-lab-prazo" /></View>
            </View>
            <View style={[st.row2, { marginTop: 10 }]}>
              <View style={st.col}><Text style={st.lbl}>Contato</Text><TextInput style={st.input} value={lab.contact_name} onChangeText={(v) => setLab({ ...lab, contact_name: v })} placeholder="Representante" placeholderTextColor={Colors.ink3} /></View>
              <View style={st.col}><Text style={st.lbl}>Telefone</Text><TextInput style={st.input} value={lab.phone} onChangeText={(v) => setLab({ ...lab, phone: v })} placeholder="(11) 99999-9999" placeholderTextColor={Colors.ink3} /></View>
            </View>
            <View style={[st.row2, { marginTop: 10 }]}>
              <View style={st.col}><Text style={st.lbl}>E-mail (recebe o PDF da OS)</Text><TextInput style={st.input} value={lab.email} onChangeText={(v) => setLab({ ...lab, email: v })} placeholder="pedidos@laboratorio.com.br" placeholderTextColor={Colors.ink3} autoCapitalize="none" /></View>
              <View style={st.col}><Text style={st.lbl}>Portal de pedidos</Text><TextInput style={st.input} value={lab.portal_url} onChangeText={(v) => setLab({ ...lab, portal_url: v })} placeholder="https://" placeholderTextColor={Colors.ink3} autoCapitalize="none" /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setEditing(null)} style={st.miniBtn}><Text style={st.miniBtnText}>Cancelar</Text></Pressable>
              <Pressable onPress={saveLab} style={[st.miniBtn, st.miniBtnPrimary]} disabled={labBusy} testID="otica-lab-salvar">
                {labBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[st.miniBtnText, { color: "#fff" }]}>Salvar laboratório</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => startEdit("new")} style={st.addBtn} testID="otica-lab-novo">
            <Icon name="plus" size={14} color={Colors.violet3} />
            <Text style={st.addBtnText}>Cadastrar laboratório</Text>
          </Pressable>
        )}
      </View>

      {/* ══ RECEITA E GARANTIA ══ */}
      <Text style={st.sectionTitle}>Receita e garantia</Text>
      <View style={st.card}>
        <View style={st.row2}>
          <View style={st.col}>
            <Text style={st.lbl}>Validade padrão da receita (meses)</Text>
            <TextInput style={st.input} value={String(form.prescription_validity_months)} keyboardType="numeric" onChangeText={(v) => set({ prescription_validity_months: parseInt(v.replace(/\D/g, ""), 10) || 0 })} testID="otica-cfg-validade" />
          </View>
          <View style={st.col}>
            <Text style={st.lbl}>Garantia de adaptação (dias)</Text>
            <TextInput style={st.input} value={String(form.adaptation_warranty_days)} keyboardType="numeric" onChangeText={(v) => set({ adaptation_warranty_days: parseInt(v.replace(/\D/g, ""), 10) || 0 })} testID="otica-cfg-adaptacao" />
          </View>
        </View>
        <Text style={st.hint}>Validade de 12 meses é o costume do mercado e o gatilho do lembrete de revisão. Adaptação de 90 dias é o padrão das multifocais (a Varilux, por exemplo, dá 3 meses).</Text>
      </View>

      {/* ══ RESPONSÁVEL TÉCNICO ══ */}
      <Text style={st.sectionTitle}>Responsável técnico e licença</Text>
      <View style={st.card}>
        <View style={st.row2}>
          <View style={st.col}><Text style={st.lbl}>Óptico responsável</Text><TextInput style={st.input} value={form.rt_name} onChangeText={(v) => set({ rt_name: v })} placeholder="Nome" placeholderTextColor={Colors.ink3} /></View>
          <View style={st.col}><Text style={st.lbl}>Registro</Text><TextInput style={st.input} value={form.rt_registry} onChangeText={(v) => set({ rt_registry: v })} placeholder="nº do registro" placeholderTextColor={Colors.ink3} /></View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={st.lbl}>Licença sanitária</Text>
          <TextInput style={st.input} value={form.sanitary_license} onChangeText={(v) => set({ sanitary_license: v })} placeholder="nº da licença / alvará sanitário" placeholderTextColor={Colors.ink3} />
        </View>
        <Text style={st.hint}>Por CNPJ: o mesmo óptico não pode responder por dois estabelecimentos (Decreto 24.492, art. 11). Sai na impressão da OS.</Text>
      </View>

      {/* ══ WHATSAPP ══ */}
      <Text style={st.sectionTitle}>WhatsApp automático</Text>
      <View style={st.card}>
        <ToggleRow
          label="Óculos prontos"
          desc="Ao marcar a OS como pronta, avisa o cliente com o link de acompanhamento. Mensagem de utilidade (sem consentimento de marketing, sem cota)."
          value={form.wa_ready_auto}
          onChange={(v) => set({ wa_ready_auto: v })}
          testID="otica-cfg-wa-pronto"
        />
        <ToggleRow
          label="Pós-venda de adaptação"
          desc="Três dias após a entrega, pergunta como está a adaptação. Mensagem de utilidade."
          value={form.wa_adaptation_auto}
          onChange={(v) => set({ wa_adaptation_auto: v })}
          testID="otica-cfg-wa-adaptacao"
        />
        <ToggleRow
          label="Lembrete de revisão da receita"
          desc="Trinta dias antes de a receita vencer, lembra o cliente de revisar a receita com o oftalmologista. Mensagem de marketing: passa pelo consentimento e pela cota do plano."
          value={form.wa_revision_auto}
          onChange={(v) => set({ wa_revision_auto: v })}
          testID="otica-cfg-wa-revisao"
          last
        />
        <Text style={st.hint}>Os três precisam dos templates otica_pronta, otica_adaptacao e otica_revisao aprovados no WhatsApp oficial. Sem eles, a fila pula e a tela da OS oferece o wa.me.</Text>
      </View>

      <Pressable onPress={saveSettings} style={[st.saveBtn, (!dirty || saving) && { opacity: 0.6 }]} disabled={!dirty || saving} testID="otica-cfg-salvar">
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.saveText}>{dirty ? "Salvar configurações" : "Tudo salvo"}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function ToggleRow({ label, desc, value, onChange, testID, last }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; testID?: string; last?: boolean }) {
  return (
    <View style={[st.toggleRow, !last && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.toggleLabel}>{label}</Text>
        <Text style={st.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
        thumbColor={value ? Colors.violet : Colors.ink3}
        testID={testID}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 680, alignSelf: "center", width: "100%" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pageTitle: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 37, color: Colors.ink, letterSpacing: -0.5, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: Colors.ink3, lineHeight: 19, marginBottom: 6 },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  warn: { backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55", borderRadius: 10, padding: 10, marginTop: 12 },
  warnText: { fontSize: 12, color: Colors.amber, lineHeight: 17 },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 8, lineHeight: 16 },
  row2: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  col: { flex: 1, minWidth: 150 },
  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink },

  labRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: "wrap" },
  labName: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  labMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  defaultTag: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
  miniBtn: { borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniBtnPrimary: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  miniBtnText: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  labForm: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12, backgroundColor: Colors.bg2 },
  labFormTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 10 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, marginTop: 6 },
  addBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  toggleLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  toggleDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 2 },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});
