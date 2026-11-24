import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { toast } from "@/components/Toast";
import type { Customer } from "./types";
import { maskPhone } from "@/utils/masks";
import { erroDoTelefone, TELEFONE_MAX_CARACTERES } from "@/utils/telefone";
import { DateInput } from "@/components/inputs/DateInput";
// 09/11/2026 — "Endereço para entrega", recolhido (mockup aprovado, seção A).
import { SecaoEndereco } from "@/components/endereco/SecaoEndereco";
import { ENDERECO_VAZIO, erroDoEndereco, type Endereco } from "@/components/endereco/endereco";
// 23/11/2026 — bloco "Dados completos", só com a ótica ligada (mockup
// docs/mockups/otica-cadastro-e-receita.html, tela 1).
import { DadosCompletosDoCliente, type DadosCompletos } from "./DadosCompletosDoCliente";
import { avisoDoNascimento, erroDoCpf, idadeEmAnos, nascimentoParaGravar, nascimentoParaOCampo, type CampoExtra } from "@/utils/clienteDadosCompletos";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

function formatInstagram(v: string): string {
  const cleaned = v.replace(/\s/g, "");
  if (cleaned && !cleaned.startsWith("@")) return "@" + cleaned;
  return cleaned;
}

type Props = {
  onSave: (c: Customer) => void;
  onCancel: () => void;
  initialData?: Customer;
  /** 23/11/2026 (ficha do crediário): abre com o cursor no telefone — o
   *  "Sem telefone · adicionar" e o Cobrar sem telefone levam direto a ele. */
  focoNoTelefone?: boolean;
  /** 23/11/2026 (ficha do crediário): avisa, uma vez, que a pessoa começou a
   *  mexer — quem abre o formulário pode então parar de recarregá-lo quando o
   *  cadastro chega atualizado do servidor. */
  onEditou?: () => void;
  /** 23/11/2026 (ótica): liga o bloco "Dados completos" (CPF e o que o
   *  servidor aceitar de RG, sexo e profissão) e o aviso de nascimento sem
   *  ano. Quem abre o formulário passa `pdv_settings.otica_enabled`. Sem
   *  isto, o formulário é o de sempre, campo por campo. */
  dadosCompletos?: boolean;
  /** RG, sexo e profissão que o servidor avisou aceitar (useCustomers). */
  camposExtras?: CampoExtra[];
};

const SEM_EXTRAS: CampoExtra[] = [];

export function AddCustomerForm({ onSave, onCancel, initialData, focoNoTelefone = false, onEditou, dadosCompletos = false, camposExtras = SEM_EXTRAS }: Props) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [instagram, setInstagram] = useState(initialData?.instagram || "");
  // Ótica: o ano de enfeite (1904, "sem ano") não aparece no campo — a
  // lojista vê "14/03" com o aviso, não um ano que ninguém digitou.
  const birthdayInicial = dadosCompletos ? nascimentoParaOCampo(initialData?.birthday || "") : (initialData?.birthday || "");
  const [birthday, setBirthday] = useState(birthdayInicial);
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [endereco, setEndereco] = useState<Endereco>(initialData?.endereco || ENDERECO_VAZIO);
  const completosIniciais: DadosCompletos = {
    cpf: initialData?.cpf || "", rg: initialData?.rg || "",
    gender: initialData?.gender || "", occupation: initialData?.occupation || "",
  };
  const [completos, setCompletos] = useState<DadosCompletos>(completosIniciais);
  const editou = name !== (initialData?.name || "") || phone !== (initialData?.phone || "")
    || email !== (initialData?.email || "") || instagram !== (initialData?.instagram || "")
    || birthday !== birthdayInicial || notes !== (initialData?.notes || "")
    || JSON.stringify(endereco) !== JSON.stringify(initialData?.endereco || ENDERECO_VAZIO)
    || (dadosCompletos && JSON.stringify(completos) !== JSON.stringify(completosIniciais));
  useEffect(() => { if (editou) onEditou?.(); }, [editou]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!name.trim()) { toast.error("Preencha o nome"); return; }
    // 10/11/2026: dígito a mais no telefone não salva (nunca é cortado). O
    // telefone antigo, reenviado sem mexer na edição, segue como está.
    const erroTel = phone !== (initialData?.phone || "") ? erroDoTelefone(phone) : null;
    if (erroTel) { toast.error(erroTel); return; }
    const erroEndereco = erroDoEndereco(endereco);
    if (erroEndereco) { toast.error(erroEndereco); return; }
    // Ótica: só vai o que foi mexido. CPF antigo, reenviado sem mexer, segue
    // como está (mesma regra do telefone); o que foi digitado precisa conferir.
    let mexidos: Customer["dadosCompletos"];
    if (dadosCompletos) {
      mexidos = {};
      if (completos.cpf !== completosIniciais.cpf) {
        const erroCpf = erroDoCpf(completos.cpf);
        if (erroCpf) { toast.error(erroCpf); return; }
        mexidos.cpf = completos.cpf;
      }
      for (const campo of camposExtras) {
        if (completos[campo] !== completosIniciais[campo]) mexidos[campo] = completos[campo];
      }
    }
    onSave({
      id: initialData?.id || Date.now().toString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      instagram: instagram.trim(),
      // Ótica: sem ano grava 1904 (o "sem ano" das importações), nunca 2000 —
      // que voltaria como se a pessoa tivesse nascido em 2000, com idade e tudo.
      birthday: dadosCompletos ? nascimentoParaGravar(birthday) : birthday.trim(),
      lastPurchase: initialData?.lastPurchase || "---",
      totalSpent: initialData?.totalSpent || 0,
      visits: initialData?.visits || 0,
      firstVisit: initialData?.firstVisit || new Date().toLocaleDateString("pt-BR"),
      notes: notes.trim(),
      rating: initialData?.rating || null,
      creditBalance: initialData?.creditBalance || 0,
      endereco,
      ...(mexidos ? { dadosCompletos: mexidos } : {}),
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={[s.title, { fontFamily: Fonts.heading }]}>{isEdit ? "Editar cliente" : "Adicionar cliente"}</Text>
        <Pressable onPress={onCancel} style={s.closeBtn}><Text style={s.closeText}>x</Text></Pressable>
      </View>
      <Text style={s.hint}>Campos com * são obrigatórios.</Text>

      <Text style={s.label}>Nome completo *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Maria da Silva" placeholderTextColor={Colors.ink3} />
      <View style={{ height: 16 }} />

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Telefone / WhatsApp</Text>
          <TextInput style={s.input} value={phone} onChangeText={v => setPhone(maskPhone(v))} placeholder="(12) 99999-0000" placeholderTextColor={Colors.ink3} keyboardType="phone-pad" maxLength={TELEFONE_MAX_CARACTERES} testID="cliente-telefone" autoFocus={focoNoTelefone} />
          {phone !== (initialData?.phone || "") && erroDoTelefone(phone) && (
            <Text style={{ fontFamily: Fonts.body, color: Colors.red, fontSize: 12, marginTop: 4 }} testID="cliente-telefone-erro">{erroDoTelefone(phone)}</Text>
          )}
          <View style={{ height: 16 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>E-mail</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email@email.com" placeholderTextColor={Colors.ink3} keyboardType="email-address" autoCapitalize="none" />
          <View style={{ height: 16 }} />
        </View>
      </View>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Instagram</Text>
          <TextInput style={s.input} value={instagram} onChangeText={v => setInstagram(formatInstagram(v))} placeholder="@usuario" placeholderTextColor={Colors.ink3} autoCapitalize="none" />
          <View style={{ height: 16 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{dadosCompletos ? "Data de nascimento (DD/MM/AAAA)" : "Aniversário (DD/MM ou DD/MM/AAAA)"}</Text>
          <DateInput style={s.input} value={birthday} onChangeText={setBirthday} placeholder="15/06/1990" testID={dadosCompletos ? "cliente-nascimento" : undefined} />
          {dadosCompletos && !!avisoDoNascimento(birthday) && (
            <Text style={s.aviso} testID="cliente-nascimento-aviso">{avisoDoNascimento(birthday)}</Text>
          )}
          {dadosCompletos && idadeEmAnos(birthday) != null && (
            <Text style={s.idade} testID="cliente-idade">{idadeEmAnos(birthday)} {idadeEmAnos(birthday) === 1 ? "ano" : "anos"}</Text>
          )}
          <View style={{ height: 16 }} />
        </View>
      </View>

      {dadosCompletos && (
        <DadosCompletosDoCliente value={completos} onChange={setCompletos} camposExtras={camposExtras} largo={IS_WIDE} />
      )}

      <SecaoEndereco value={endereco} onChange={setEndereco} testID="cliente-form-endereco" />

      <Text style={s.label}>Observações</Text>
      <TextInput style={[s.input, { minHeight: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Preferências, alergias..." placeholderTextColor={Colors.ink3} multiline numberOfLines={3} />

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancelar</Text></Pressable>
        <Pressable onPress={handleSave} style={s.saveBtn}>
          <Text style={s.saveText}>{isEdit ? "Salvar alterações" : "Salvar cliente"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.ink, fontWeight: "400" },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  closeText: { fontFamily: Fonts.body, fontSize: 16, color: Colors.ink3, fontWeight: "600" },
  hint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  label: { fontFamily: Fonts.body, fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  input: { fontFamily: Fonts.body, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  row2: { flexDirection: IS_WIDE ? "row" : "column", gap: IS_WIDE ? 12 : 0 },
  aviso: { fontFamily: Fonts.body, color: Colors.amber, fontSize: 12, marginTop: 4, lineHeight: 17 },
  idade: { fontFamily: Fonts.body, color: Colors.ink3, fontSize: 12, marginTop: 4 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  saveBtn: { backgroundColor: Colors.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  saveText: { fontFamily: Fonts.body, fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default AddCustomerForm;
