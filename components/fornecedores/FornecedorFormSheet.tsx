// ============================================================
// AURA. — Cadastro de fornecedor (25/09/2026)
//
// Feito para cadastrar a lista inteira de uma vez:
//   · CNPJ vem primeiro: com 14 dígitos válidos, a Receita preenche nome,
//     WhatsApp e e-mail (GET /suppliers/cnpj/:cnpj). Se o CNPJ já está
//     cadastrado no grupo, avisa e oferece abrir, em vez de duplicar.
//   · Só o nome é obrigatório (regra do backend e de utils/fornecedoresUtil).
//   · "Salvar e cadastrar outro" limpa o formulário e volta o foco ao CNPJ.
// O que a Receita preencheu nunca apaga o que a lojista já digitou.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { maskCnpj, maskPhone } from "@/utils/masks";
import { suppliersApi, type Supplier } from "@/services/suppliersApi";
import {
  FORM_VAZIO, cnpjValido, validarFornecedor, type FormFornecedor,
} from "@/utils/fornecedoresUtil";

type Props = {
  visible: boolean;
  companyId: string | null;
  /** null = novo; senão edita este. */
  supplier: Supplier | null;
  /** Pré-preenchimento (ex.: fornecedor que veio da nota). */
  inicial?: FormFornecedor | null;
  onClose: () => void;
  onSalvo: (s: Supplier) => void;
  onAbrirExistente: (id: string) => void;
};

type Receita = { texto: string; alerta?: string } | null;

export function FornecedorFormSheet({ visible, companyId, supplier, inicial, onClose, onSalvo, onAbrirExistente }: Props) {
  const [form, setForm] = useState<FormFornecedor>(FORM_VAZIO);
  const [erro, setErro] = useState<{ campo: keyof FormFornecedor; texto: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [receita, setReceita] = useState<Receita>(null);
  const [existente, setExistente] = useState<{ id: string; name: string } | null>(null);
  const consultado = useRef<string>("");
  const cnpjRef = useRef<TextInput>(null);

  // Abre sempre com o estado certo (novo, editar ou vindo da nota).
  const chave = visible ? (supplier?.id || "novo") + "|" + JSON.stringify(inicial || null) : "";
  const [chaveCarregada, setChaveCarregada] = useState("");
  if (chave && chave !== chaveCarregada) {
    const base: FormFornecedor = supplier
      ? { name: supplier.name, cnpj: supplier.cnpj ? maskCnpj(supplier.cnpj) : "", phone: supplier.phone ? maskPhone(supplier.phone) : "", contact_name: supplier.contact_name || "", email: supplier.email || "", notes: supplier.notes || "" }
      : { ...FORM_VAZIO, ...(inicial || {}), cnpj: inicial?.cnpj ? maskCnpj(inicial.cnpj) : "", phone: inicial?.phone ? maskPhone(inicial.phone) : "" };
    setForm(base);
    setErro(null); setReceita(null); setExistente(null);
    consultado.current = (base.cnpj || "").replace(/\D/g, "");
    setChaveCarregada(chave);
  }

  const set = (campo: keyof FormFornecedor, v: string) => {
    setForm((f) => ({ ...f, [campo]: v }));
    if (erro?.campo === campo) setErro(null);
  };

  // Consulta a Receita quando o CNPJ fica completo e válido.
  const cnpjDigitos = form.cnpj.replace(/\D/g, "");
  useEffect(() => {
    if (!visible || !companyId) return;
    if (cnpjDigitos.length !== 14 || !cnpjValido(cnpjDigitos) || consultado.current === cnpjDigitos) return;
    consultado.current = cnpjDigitos;
    let vivo = true;
    setBuscando(true); setReceita(null); setExistente(null);
    suppliersApi.lookupCnpj(companyId, cnpjDigitos)
      .then((r) => {
        if (!vivo) return;
        if (r.existing && r.existing.id !== supplier?.id) { setExistente(r.existing); return; }
        if (r.existing) return;
        setForm((f) => ({
          ...f,
          name: f.name.trim() ? f.name : (r.name || ""),
          phone: f.phone.trim() ? f.phone : (r.phone ? maskPhone(r.phone) : ""),
          email: f.email.trim() ? f.email : (r.email || ""),
        }));
        const onde = [r.city, r.state].filter(Boolean).join("/");
        setReceita({
          texto: ["Dados da Receita", r.legal_name && r.legal_name !== r.name ? r.legal_name : "", onde].filter(Boolean).join(" · "),
          alerta: r.is_active === false ? `Na Receita este CNPJ está "${(r.situation || "irregular").toLowerCase()}".` : undefined,
        });
      })
      .catch((e: any) => { if (vivo) setReceita({ texto: e?.data?.error || e?.message || "Não consegui consultar a Receita agora. Preencha os dados a mão." }); })
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
  }, [cnpjDigitos, visible, companyId]);

  async function salvar(outro: boolean) {
    if (!companyId || saving) return;
    const v = validarFornecedor(form);
    if (!v.ok) { setErro({ campo: v.campo, texto: v.erro }); return; }
    setSaving(true);
    try {
      const salvo = supplier
        ? await suppliersApi.update(companyId, supplier.id, v.body)
        : await suppliersApi.create(companyId, v.body);
      toast.success(supplier ? "Fornecedor atualizado" : `${salvo.name} cadastrado`);
      onSalvo(salvo);
      if (outro && !supplier) {
        setForm(FORM_VAZIO); setReceita(null); setExistente(null); consultado.current = "";
        setTimeout(() => cnpjRef.current?.focus(), 50);
      } else {
        onClose();
      }
    } catch (e: any) {
      if (e?.status === 409 && e?.data?.id) {
        setExistente({ id: e.data.id, name: form.name.trim() });
      } else {
        toast.error(e?.data?.error || e?.message || "Não consegui salvar o fornecedor");
      }
    } finally {
      setSaving(false);
    }
  }

  const erroDe = (c: keyof FormFornecedor) => (erro?.campo === c ? <Text style={st.erro}>{erro.texto}</Text> : null);

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={520}>
      <>
        <View style={st.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.title}>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</Text>
            <Text style={st.sub}>Só o nome é obrigatório. Com o CNPJ, o resto se preenche sozinho.</Text>
          </View>
          <Pressable onPress={onClose} style={st.close} testID="fornecedor-form-fechar" accessibilityLabel="Fechar">
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={st.body} keyboardShouldPersistTaps="handled">
          <Text style={st.label}>CNPJ</Text>
          <View style={st.cnpjRow}>
            <TextInput
              ref={cnpjRef}
              style={[st.input, { flex: 1 }, erro?.campo === "cnpj" && st.inputErro]}
              value={form.cnpj}
              onChangeText={(v) => { set("cnpj", maskCnpj(v)); setExistente(null); setReceita(null); }}
              placeholder="00.000.000/0000-00"
              placeholderTextColor={Colors.ink3}
              keyboardType="number-pad"
              maxLength={18}
              autoFocus={!supplier}
              testID="fornecedor-form-cnpj"
            />
            {buscando && <ActivityIndicator size="small" color={Colors.violet3} />}
          </View>
          {erroDe("cnpj")}
          {existente && (
            <View style={st.aviso} testID="fornecedor-form-existente">
              <Text style={st.avisoTexto}>Este CNPJ já está cadastrado como <Text style={{ fontWeight: "700" }}>{existente.name}</Text>.</Text>
              <Pressable onPress={() => onAbrirExistente(existente.id)} style={st.avisoBtn} testID="fornecedor-form-abrir-existente">
                <Text style={st.avisoBtnTexto}>Abrir</Text>
              </Pressable>
            </View>
          )}
          {receita && (
            <View style={{ marginTop: 6, gap: 4 }}>
              <Text style={st.receita} testID="fornecedor-form-receita">{receita.texto}</Text>
              {receita.alerta && <Text style={st.receitaAlerta}>{receita.alerta}</Text>}
            </View>
          )}

          <Text style={st.label}>Nome *</Text>
          <TextInput style={[st.input, erro?.campo === "name" && st.inputErro]} value={form.name} onChangeText={(v) => set("name", v)}
            placeholder="Como você chama o fornecedor" placeholderTextColor={Colors.ink3} maxLength={200} testID="fornecedor-form-nome" />
          {erroDe("name")}

          <View style={st.row2}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>WhatsApp</Text>
              <TextInput style={[st.input, erro?.campo === "phone" && st.inputErro]} value={form.phone} onChangeText={(v) => set("phone", maskPhone(v))}
                placeholder="(11) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={15} testID="fornecedor-form-whatsapp" />
              {erroDe("phone")}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Vendedor / contato</Text>
              <TextInput style={st.input} value={form.contact_name} onChangeText={(v) => set("contact_name", v)}
                placeholder="Nome de quem atende" placeholderTextColor={Colors.ink3} maxLength={200} testID="fornecedor-form-contato" />
            </View>
          </View>

          <Text style={st.label}>E-mail</Text>
          <TextInput style={[st.input, erro?.campo === "email" && st.inputErro]} value={form.email} onChangeText={(v) => set("email", v)}
            placeholder="vendas@fornecedor.com.br" placeholderTextColor={Colors.ink3} keyboardType="email-address" autoCapitalize="none" maxLength={200} testID="fornecedor-form-email" />
          {erroDe("email")}

          <Text style={st.label}>Observações</Text>
          <TextInput style={[st.input, st.textarea]} value={form.notes} onChangeText={(v) => set("notes", v)}
            placeholder="Prazo de entrega, pedido mínimo, forma de pagamento…" placeholderTextColor={Colors.ink3} multiline maxLength={2000} testID="fornecedor-form-obs" />

          <View style={st.acts}>
            {!supplier && (
              <Pressable onPress={() => salvar(true)} disabled={saving} style={[st.btn, saving && { opacity: 0.6 }]} testID="fornecedor-form-salvar-outro">
                <Text style={st.btnTexto}>Salvar e cadastrar outro</Text>
              </Pressable>
            )}
            <Pressable onPress={() => salvar(false)} disabled={saving} style={[st.btn, st.btnPrimario, saving && { opacity: 0.6 }]} testID="fornecedor-form-salvar">
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[st.btnTexto, { color: "#fff" }]}>{supplier ? "Salvar alterações" : "Salvar"}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </>
    </ResponsiveSheet>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  close: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg2 },
  body: { paddingHorizontal: 18, paddingVertical: 8 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginTop: 12, marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink },
  inputErro: { borderColor: Colors.red },
  textarea: { minHeight: 64, textAlignVertical: "top" },
  cnpjRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  row2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  erro: { fontSize: 12, color: Colors.red, marginTop: 4 },
  receita: { fontSize: 12, color: Colors.green },
  receitaAlerta: { fontSize: 12, color: Colors.amber },
  aviso: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55" },
  avisoTexto: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  avisoBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.amber + "55" },
  avisoBtnTexto: { fontSize: 12, fontWeight: "700", color: Colors.ink },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 18, marginBottom: 12 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  btnPrimario: { backgroundColor: Colors.violet, borderColor: Colors.violet, minWidth: 110 },
  btnTexto: { fontSize: 13, fontWeight: "700", color: Colors.ink },
});
