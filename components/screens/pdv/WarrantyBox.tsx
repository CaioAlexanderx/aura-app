// ============================================================
// AURA. — components/screens/pdv/WarrantyBox.tsx
//
// Caixa "Emitir garantia" no PDV, logo ACIMA das modalidades de pagamento.
// Só existe com o módulo de Ordem de Serviço ligado (os_enabled) e carrinho
// com itens. Marcar a caixa abre um modal simples com DUAS informações por
// produto: se recebe garantia e por quantos dias.
//
// A garantia em si só é emitida depois da venda (WarrantySaleActions); aqui
// é o rascunho. Cliente obrigatório (nome, CPF, telefone): o modal avisa e,
// se faltar CPF/telefone, deixa completar o cadastro ali mesmo.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { companiesApi } from "@/services/api";
import { warrantiesApi, prazoLabel } from "@/services/warrantiesApi";
import { useWarrantyDraft, diasValidos } from "@/stores/warrantyDraft";
import { maskCpf, maskPhone } from "@/utils/masks";

export type WarrantyCartItem = { key: string; name: string; qty: number };

type Props = {
  companyId: string;
  items: WarrantyCartItem[];
  customerId: string | null;
  customerName: string | null;
  onPickCustomer?: () => void;
};

const QUICK_DAYS = [30, 90, 180, 365];

export function WarrantyBox({ companyId, items, customerId, customerName, onPickCustomer }: Props) {
  const d = useWarrantyDraft();
  const keys = items.map((i) => i.key);
  const valid = diasValidos(d.days, keys);
  const count = Object.keys(valid).length;

  function toggle() {
    if (d.on) { d.reset(); return; }
    d.setOn(true);
    d.openModal();
  }

  const resumo = count === 0
    ? "Escolha os produtos e os dias"
    : count + (count === 1 ? " produto · " : " produtos · ")
      + Array.from(new Set(Object.values(valid))).sort((a, b) => a - b).map(prazoLabel).join(" / ");

  return (
    <>
      <Pressable onPress={toggle} style={[st.box, d.on && st.boxOn]} testID="warranty-box">
        <View style={[st.check, d.on && st.checkOn]}>
          {d.on && <Icon name="check" size={12} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Emitir garantia do produto</Text>
          <Text style={st.sub} numberOfLines={1}>{d.on ? resumo : "Certificado com QR para validar no app"}</Text>
        </View>
        {d.on && (
          <Pressable onPress={d.openModal} hitSlop={8} testID="warranty-edit">
            <Text style={st.edit}>Editar</Text>
          </Pressable>
        )}
      </Pressable>

      <WarrantyModal
        companyId={companyId}
        items={items}
        customerId={customerId}
        customerName={customerName}
        onPickCustomer={onPickCustomer}
      />
    </>
  );
}

function WarrantyModal({ companyId, items, customerId, customerName, onPickCustomer }: Props) {
  const d = useWarrantyDraft();
  const qc = useQueryClient();
  // Edição local; só vira rascunho ao confirmar (Cancelar não perde o anterior).
  const [local, setLocal] = useState<Record<string, number>>({});
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (d.modalOpen) setLocal(diasValidos(d.days, items.map((i) => i.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.modalOpen]);

  const check = useQuery({
    queryKey: ["warranty-customer-check", companyId, customerId],
    queryFn: () => warrantiesApi.customerCheck(companyId, customerId as string),
    enabled: d.modalOpen && !!customerId,
    staleTime: 0,
  });
  const faltam = check.data?.missing || [];

  useEffect(() => {
    if (!check.data) return;
    setCpf(check.data.customer.cpf_cnpj ? maskCpf(check.data.customer.cpf_cnpj) : "");
    setPhone(check.data.customer.phone ? maskPhone(check.data.customer.phone) : "");
  }, [check.data]);

  function setDias(key: string, v: number | null) {
    setLocal((p) => {
      const n = { ...p };
      if (v == null || v <= 0) delete n[key]; else n[key] = Math.min(3650, Math.round(v));
      return n;
    });
  }

  async function saveCustomer() {
    if (!customerId || saving) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    const phoneDigits = phone.replace(/\D/g, "");
    if (cpfDigits.length < 11) { toast.error("Informe o CPF completo do cliente"); return; }
    if (phoneDigits.length < 10) { toast.error("Informe o telefone com DDD"); return; }
    setSaving(true);
    try {
      await companiesApi.updateCustomer(companyId, customerId, { cpf_cnpj: cpfDigits, phone: phoneDigits });
      qc.invalidateQueries({ queryKey: ["customers"] });
      await check.refetch();
      qc.invalidateQueries({ queryKey: ["warranty-customer-check"] });
      toast.success("Cadastro do cliente atualizado");
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Não deu para salvar o cliente");
    } finally {
      setSaving(false);
    }
  }

  function confirmar() {
    if (Object.keys(local).length === 0) { toast.error("Marque ao menos um produto com garantia"); return; }
    d.replaceAll(local);
    d.setOn(true);
    d.closeModal();
  }

  function cancelar() {
    d.closeModal();
    if (Object.keys(diasValidos(d.days, items.map((i) => i.key))).length === 0) d.reset();
  }

  return (
    <ResponsiveSheet visible={d.modalOpen} onClose={cancelar} maxWidth={460}>
      <View style={m.head}>
        <Icon name="shield" size={16} color={Colors.violet3} />
        <Text style={m.headTitle}>Garantia do produto</Text>
        <Pressable onPress={cancelar} hitSlop={10}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
      </View>

      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
        {/* Cliente: obrigatório, com nome, CPF e telefone */}
        {!customerId ? (
          <View style={[m.notice, m.noticeWarn]}>
            <Text style={m.noticeText}>A garantia precisa de um cliente cadastrado (nome, CPF e telefone).</Text>
            {onPickCustomer && (
              <Pressable onPress={() => { d.closeModal(); onPickCustomer(); }}>
                <Text style={m.noticeLink}>Selecionar cliente</Text>
              </Pressable>
            )}
          </View>
        ) : check.isLoading ? (
          <Text style={m.muted}>Conferindo cadastro de {customerName || "cliente"}…</Text>
        ) : faltam.length > 0 ? (
          <View style={[m.notice, m.noticeWarn]}>
            <Text style={m.noticeText}>
              Complete o cadastro de {customerName || "cliente"} para emitir a garantia.
            </Text>
            <View style={m.row2}>
              <TextInput
                style={[m.input, { flex: 1 }]} value={cpf} onChangeText={(v) => setCpf(maskCpf(v))}
                placeholder="CPF" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={14} testID="warranty-cpf"
              />
              <TextInput
                style={[m.input, { flex: 1 }]} value={phone} onChangeText={(v) => setPhone(maskPhone(v))}
                placeholder="Telefone" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} testID="warranty-phone"
              />
            </View>
            <Pressable onPress={saveCustomer} disabled={saving} style={m.smallBtn} testID="warranty-save-customer">
              <Text style={m.smallBtnText}>{saving ? "Salvando…" : "Salvar cadastro"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[m.notice, m.noticeOk]}>
            <Icon name="check" size={13} color={Colors.green} />
            <Text style={m.noticeText}>{customerName || "Cliente"} · cadastro completo</Text>
          </View>
        )}

        <Text style={m.section}>Quais produtos têm garantia?</Text>
        {items.map((it) => {
          const dias = local[it.key];
          const on = dias != null;
          return (
            <View key={it.key} style={[m.item, on && m.itemOn]}>
              <Pressable onPress={() => setDias(it.key, on ? null : 90)} style={m.itemTop} testID={"warranty-item-" + it.key}>
                <View style={[st.check, on && st.checkOn]}>{on && <Icon name="check" size={12} color="#fff" />}</View>
                <Text style={m.itemName} numberOfLines={2}>
                  {it.name}{it.qty > 1 ? "  × " + it.qty : ""}
                </Text>
              </Pressable>
              {on && (
                <View style={m.diasRow}>
                  {QUICK_DAYS.map((q) => (
                    <Pressable key={q} onPress={() => setDias(it.key, q)} style={[m.chip, dias === q && m.chipOn]}>
                      <Text style={[m.chipText, dias === q && m.chipTextOn]}>{prazoLabel(q)}</Text>
                    </Pressable>
                  ))}
                  <View style={m.diasInputBox}>
                    <TextInput
                      style={m.diasInput}
                      value={String(dias)}
                      onChangeText={(v) => setDias(it.key, parseInt(v.replace(/\D/g, ""), 10) || 0)}
                      keyboardType="number-pad" maxLength={4} selectTextOnFocus
                      testID={"warranty-days-" + it.key}
                    />
                    <Text style={m.diasUnit}>dias</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={m.foot}>
        <Pressable onPress={cancelar} style={m.btnGhost}><Text style={m.btnGhostText}>Cancelar</Text></Pressable>
        <Pressable onPress={confirmar} style={m.btn} testID="warranty-confirm">
          <Text style={m.btnText}>Confirmar</Text>
        </Pressable>
      </View>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  box: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 11, marginBottom: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  boxOn: { borderColor: Colors.violet, backgroundColor: Colors.violet + "14" },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.ink3,
    alignItems: "center", justifyContent: "center",
  },
  checkOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  title: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  edit: { fontSize: 12, fontWeight: "700", color: Colors.violet3 },
});

const m = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, paddingBottom: 10 },
  headTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.ink },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3, marginTop: 6 },
  muted: { fontSize: 12, color: Colors.ink3 },
  notice: { borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  noticeWarn: { borderColor: "#d97706", backgroundColor: "rgba(217,119,6,0.10)", flexDirection: "column", alignItems: "stretch" },
  noticeOk: { borderColor: Colors.green + "66", backgroundColor: Colors.green + "14" },
  noticeText: { fontSize: 12, color: Colors.ink2 },
  noticeLink: { fontSize: 12, fontWeight: "800", color: Colors.violet3 },
  row2: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, backgroundColor: Colors.bg2,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.ink,
  },
  smallBtn: { alignSelf: "flex-start", backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  item: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.bg3, padding: 10, gap: 10 },
  itemOn: { borderColor: Colors.violet + "88" },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemName: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.ink },
  diasRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violet + "22" },
  chipText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  diasInputBox: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 8, backgroundColor: Colors.bg2 },
  diasInput: { width: 44, paddingVertical: 5, fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "right" },
  diasUnit: { fontSize: 11, color: Colors.ink3 },
  foot: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 10 },
  btnGhost: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  btnGhostText: { color: Colors.ink2, fontWeight: "700", fontSize: 13 },
  btn: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
