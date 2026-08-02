// ============================================================
// GuardianPicker — escolher, cadastrar ou editar responsável (F2)
//
// Painel INLINE (expande dentro do AlunoFormModal — modal aninhado em
// RN-web é frágil, então nada de Modal próprio aqui). Ações:
//   • escolher um responsável existente (GET /dojo/guardians, com
//     contagem de alunos vinculados)
//   • cadastrar um novo inline (nome + telefone + e-mail + parentesco)
//   • editar o responsável JÁ VINCULADO (nome/telefone/e-mail/parentesco)
//
// QA 27/07 (item 1, o mais grave): não havia campo de e-mail no cadastro
// — como menor de 18 é cobrado do responsável e a régua envia por
// e-mail, nenhum aluno menor recebia lembrete. O backend já aceita
// `email` no POST/PATCH de /dojo/guardians; só faltava o campo aqui.
//
// QA 27/07 (item 2): o bloco só oferecia Trocar/Remover — corrigir um
// responsável já cadastrado exigia criar outro. Agora "Editar" abre um
// formulário inline pré-preenchido, salva via PATCH /dojo/guardians/:id
// e atualiza o valor selecionado (onChange) sem fechar nada — reflete
// na ficha/lista assim que os dados forem recarregados (mesmo padrão de
// atualização em cascata do resto do form de aluno).
//
// QA prod 30/07 (item 6): "Editar" abria o telefone CRU (ex.:
// "91993334444"), enquanto o cartão logo acima mostra formatado (via
// formatPhone, de ./helpers). startEditCurrent agora aplica maskPhone
// (@/utils/masks — mesma máscara usada em configuracoes.tsx) ao
// pré-preencher o campo.
//
// F8.2 (01/08/2026 — pedido do Caio: ficha do aluno igual à ficha do
// praticante da federação): a federação já pede CPF do responsável
// (karate_dojo_guardians.cpf já existe na coluna, só não estava na
// tela) — cadastro e edição ganham o campo, mesma máscara/validação do
// CPF do aluno (11 dígitos; ver AlunoFormModal.tsx).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import {
  karateDojoStudentsApi, DojoGuardian, DojoStudentGuardianRef,
} from "@/services/karateDojoStudentsApi";
import { maskPhone } from "@/utils/masks";
import { formatPhone, isValidEmail, maskCpf, onlyDigits } from "./helpers";

interface Props {
  federationId: string;
  value: DojoStudentGuardianRef | null;
  onChange: (g: DojoStudentGuardianRef | null) => void;
  errorText?: string | null;
}

export function GuardianPicker({ federationId, value, onChange, errorText }: Props) {
  const [open, setOpen] = useState(false);
  const [guardians, setGuardians] = useState<DojoGuardian[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRel, setNewRel] = useState("");
  const [saving, setSaving] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Editar o responsável JÁ VINCULADO (item 2) — painel próprio, separado
  // do de trocar/cadastrar (que fica dentro de `open`).
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRel, setEditRel] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await karateDojoStudentsApi.listGuardians(federationId);
      setGuardians(res.data ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => {
    if (open && guardians === null) load();
  }, [open, guardians, load]);

  const pick = (g: DojoGuardian) => {
    onChange({
      id: g.id,
      full_name: g.full_name,
      phone: g.phone,
      relationship: g.relationship,
      cpf: g.cpf,
      email: g.email,
    });
    setOpen(false);
    setCreating(false);
  };

  // CPF do responsável: mesma validação do CPF do aluno (11 dígitos quando
  // preenchido — ver cpfDigits em AlunoFormModal.tsx). Opcional: vazio passa.
  function validateCpf(raw: string): string | null {
    const d = onlyDigits(raw);
    if (d.length > 0 && d.length !== 11) return "CPF incompleto — são 11 dígitos.";
    return null;
  }

  const createNew = async () => {
    if (!newName.trim()) {
      setCreateErr("Informe o nome do responsável.");
      return;
    }
    const cpfErr = validateCpf(newCpf);
    if (cpfErr) {
      setCreateErr(cpfErr);
      return;
    }
    if (!isValidEmail(newEmail)) {
      setCreateErr("E-mail inválido.");
      return;
    }
    setSaving(true);
    setCreateErr(null);
    try {
      const g = await karateDojoStudentsApi.createGuardian(federationId, {
        full_name: newName.trim(),
        cpf: onlyDigits(newCpf) || null,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        relationship: newRel.trim() || null,
      });
      setNewName("");
      setNewCpf("");
      setNewPhone("");
      setNewEmail("");
      setNewRel("");
      setGuardians(null); // lista mudou — recarrega na próxima abertura
      pick(g);
    } catch (e: any) {
      setCreateErr(e?.data?.error || e?.message || "Não foi possível salvar o responsável.");
    } finally {
      setSaving(false);
    }
  };

  const startEditCurrent = () => {
    if (!value) return;
    setEditName(value.full_name ?? "");
    setEditCpf(value.cpf ? maskCpf(value.cpf) : "");
    setEditPhone(value.phone ? maskPhone(value.phone) : "");
    setEditEmail(value.email ?? "");
    setEditRel(value.relationship ?? "");
    setEditErr(null);
    setOpen(false);
    setCreating(false);
    setEditingCurrent(true);
  };

  const saveEditCurrent = async () => {
    if (!value) return;
    if (!editName.trim()) {
      setEditErr("Informe o nome do responsável.");
      return;
    }
    const cpfErr = validateCpf(editCpf);
    if (cpfErr) {
      setEditErr(cpfErr);
      return;
    }
    if (!isValidEmail(editEmail)) {
      setEditErr("E-mail inválido.");
      return;
    }
    setEditSaving(true);
    setEditErr(null);
    try {
      const g = await karateDojoStudentsApi.updateGuardian(federationId, value.id, {
        full_name: editName.trim(),
        cpf: onlyDigits(editCpf) || null,
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        relationship: editRel.trim() || null,
      });
      setGuardians(null); // lista mudou — recarrega na próxima abertura
      onChange({
        id: g.id,
        full_name: g.full_name,
        phone: g.phone,
        relationship: g.relationship,
        cpf: g.cpf,
        email: g.email,
      });
      setEditingCurrent(false);
    } catch (e: any) {
      setEditErr(e?.data?.error || e?.message || "Não foi possível salvar as alterações.");
    } finally {
      setEditSaving(false);
    }
  };

  const list = (guardians ?? []).filter(
    (g) => !q.trim() || g.full_name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <View style={{ gap: 8 }}>
      {value ? (
        <View style={styles.selected}>
          <Icon name="person-outline" size={16} color={KarateColors.ink2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.selName} numberOfLines={1}>{value.full_name ?? "Responsável"}</Text>
            <Text style={styles.selMeta} numberOfLines={1}>
              {[
                value.relationship,
                value.phone ? formatPhone(value.phone) : null,
                value.cpf ? `CPF ${maskCpf(value.cpf)}` : null,
                value.email ?? null,
              ].filter(Boolean).join(" · ") || "Sem contato informado"}
            </Text>
          </View>
          <TouchableOpacity onPress={startEditCurrent} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setEditingCurrent(false); setOpen(!open); }} accessibilityRole="button" style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Trocar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { onChange(null); setOpen(false); setEditingCurrent(false); }}
            accessibilityRole="button"
            style={styles.linkBtn}
          >
            <Text style={[styles.linkTxt, { color: KarateColors.danger }]}>Remover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.pickBtn} onPress={() => setOpen(!open)} accessibilityRole="button">
          <Icon name="user-plus" size={15} color={KarateColors.primary} />
          <Text style={styles.pickBtnTxt}>{open ? "Fechar" : "Escolher ou cadastrar responsável"}</Text>
        </TouchableOpacity>
      )}

      {!!errorText && <Text style={styles.err}>{errorText}</Text>}

      {editingCurrent && value && (
        <View style={styles.panel}>
          <FormField
            label="Nome do responsável"
            required
            value={editName}
            onChangeText={setEditName}
            placeholder="Nome completo"
          />
          <FormField
            label="CPF do responsável"
            value={editCpf}
            onChangeText={(t) => setEditCpf(maskCpf(t))}
            placeholder="000.000.000-00"
            keyboardType="numeric"
          />
          <FormField
            label="Telefone"
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="(91) 90000-0000"
            keyboardType="phone-pad"
          />
          <FormField
            label="E-mail"
            value={editEmail}
            onChangeText={setEditEmail}
            placeholder="email@exemplo.com"
            autoCapitalize="none"
            keyboardType="email-address"
            hint="É pra onde vai o lembrete de mensalidade."
          />
          <FormField
            label="Parentesco"
            value={editRel}
            onChangeText={setEditRel}
            placeholder="mãe, pai, avó…"
          />
          {!!editErr && <Text style={styles.err}>{editErr}</Text>}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setEditingCurrent(false)} style={{ flex: 1 }} />
            <KarateButton label="Salvar alterações" variant="sumi" size="sm" onPress={saveEditCurrent} loading={editSaving} style={{ flex: 2 }} />
          </View>
        </View>
      )}

      {open && (
        <View style={styles.panel}>
          {loading && <ActivityIndicator size="small" color={KarateColors.primary} />}
          {failed && (
            <TouchableOpacity onPress={load} accessibilityRole="button">
              <Text style={styles.err}>Não foi possível carregar os responsáveis. Tocar para tentar de novo.</Text>
            </TouchableOpacity>
          )}
          {!loading && !failed && (
            <>
              {(guardians ?? []).length > 0 && (
                <>
                  <View style={styles.search}>
                    <Icon name="search" size={14} color={KarateColors.ink3} />
                    <TextInput
                      style={styles.searchInput}
                      value={q}
                      onChangeText={setQ}
                      placeholder="Buscar responsável"
                      placeholderTextColor={KarateColors.ink4}
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 180 }}>
                    {list.map((g) => (
                      <TouchableOpacity key={g.id} style={styles.gRow} onPress={() => pick(g)} accessibilityRole="button">
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.gName} numberOfLines={1}>{g.full_name}</Text>
                          <Text style={styles.gMeta} numberOfLines={1}>
                            {[g.relationship, g.phone ? formatPhone(g.phone) : null].filter(Boolean).join(" · ") || "Sem contato"}
                            {typeof g.students_count === "number" && g.students_count > 0
                              ? ` · ${g.students_count} aluno${g.students_count === 1 ? "" : "s"}`
                              : ""}
                          </Text>
                        </View>
                        <Icon name="chevron-right" size={14} color={KarateColors.ink4} />
                      </TouchableOpacity>
                    ))}
                    {list.length === 0 && <Text style={styles.gMeta}>Nenhum responsável com esse nome.</Text>}
                  </ScrollView>
                </>
              )}

              {!creating ? (
                <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)} accessibilityRole="button">
                  <Icon name="add" size={14} color={KarateColors.primary} />
                  <Text style={styles.pickBtnTxt}>Cadastrar novo responsável</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <FormField
                    label="Nome do responsável"
                    required
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Nome completo"
                  />
                  <FormField
                    label="CPF do responsável"
                    value={newCpf}
                    onChangeText={(t) => setNewCpf(maskCpf(t))}
                    placeholder="000.000.000-00"
                    keyboardType="numeric"
                  />
                  <FormField
                    label="Telefone"
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="(91) 90000-0000"
                    keyboardType="phone-pad"
                  />
                  <FormField
                    label="E-mail"
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="email@exemplo.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    hint="É pra onde vai o lembrete de mensalidade (importante pra aluno menor de 18)."
                  />
                  <FormField
                    label="Parentesco"
                    value={newRel}
                    onChangeText={setNewRel}
                    placeholder="mãe, pai, avó…"
                  />
                  {!!createErr && <Text style={styles.err}>{createErr}</Text>}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setCreating(false)} style={{ flex: 1 }} />
                    <KarateButton label="Salvar responsável" variant="sumi" size="sm" onPress={createNew} loading={saving} style={{ flex: 2 }} />
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  selName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  selMeta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  linkBtn: { paddingVertical: 4, paddingHorizontal: 6 } as ViewStyle,
  linkTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  pickBtn: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 12 } as ViewStyle,
  pickBtnTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  panel: { gap: 8, backgroundColor: KarateColors.glass2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  search: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 10 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13, color: KarateColors.ink, paddingVertical: 8 } as TextStyle,
  gRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  gName: { fontSize: 13, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  gMeta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  newBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8 } as ViewStyle,
});
