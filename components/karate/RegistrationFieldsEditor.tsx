// ============================================================
// RegistrationFieldsEditor — Aura Karatê (federação) · Shoji
//
// Bloco A — editor simples de campos do formulário de inscrição pública
// de um evento (exame ou curso). Cada campo: { key, label, type, required,
// options? }. type ∈ text|number|select|checkbox|date|phone (espelha o
// enum aceito pelo backend em PATCH /belt-exams/:examId).
//
// Não tem dependência de Picker nativo: o seletor de tipo é uma fileira de
// pílulas (mesmo padrão de KindOption em CriarExameModal), e "obrigatório"
// é um Switch (toggle) simples sem libs novas. Quando type==='select', um
// campo de texto separado por vírgula edita a lista de opções — leve, sem
// inventar um sub-editor de lista.
// ============================================================
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, Switch,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { RegistrationField, RegistrationFieldType } from "@/services/karateApi";

export type { RegistrationField, RegistrationFieldType };

const TYPE_OPTIONS: { value: RegistrationFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção" },
  { value: "checkbox", label: "Sim/Não" },
  { value: "date", label: "Data" },
  { value: "phone", label: "Telefone" },
];

// Microcopy curta por tipo — ajuda quem não é tech a escolher sem adivinhar.
const TYPE_HINTS: Record<RegistrationFieldType, string> = {
  text: "Resposta livre, em texto. Ex.: nome do responsável.",
  number: "Só números. Ex.: idade, peso.",
  select: "Quem se inscreve escolhe uma opção de uma lista que você define.",
  checkbox: "Pergunta de sim ou não, com uma caixinha para marcar.",
  date: "Quem se inscreve escolhe uma data no calendário.",
  phone: "Número de telefone, com máscara de formatação.",
};

function slugifyKey(label: string): string {
  return label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
}

function uniqueKey(base: string, existing: RegistrationField[], skipIndex: number): string {
  let candidate = base;
  let n = 2;
  while (existing.some((f, i) => i !== skipIndex && f.key === candidate)) {
    candidate = `${base}_${n}`;
    n++;
  }
  return candidate;
}

interface Props {
  fields: RegistrationField[];
  onSave: (fields: RegistrationField[]) => void | Promise<void>;
  saving?: boolean;
}

export function RegistrationFieldsEditor({ fields, onSave, saving }: Props) {
  const [draft, setDraft] = useState<RegistrationField[]>(fields);
  const [dirty, setDirty] = useState(false);
  // Buffer do texto cru do campo "Opções" por índice. Sem isso, o value
  // reconstruído do array (join) come as vírgulas enquanto o usuário digita.
  const [optionsText, setOptionsText] = useState<Record<number, string>>({});

  // Ressincroniza o rascunho quando o evento recarrega (ex.: após save bem-sucedido
  // em outro lugar) e ainda não há edição local pendente.
  React.useEffect(() => {
    if (!dirty) setDraft(fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const update = (index: number, patch: Partial<RegistrationField>) => {
    setDraft((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    setDirty(true);
  };

  const addField = () => {
    const label = "Novo campo";
    const key = uniqueKey(slugifyKey(label), draft, -1);
    setDraft((prev) => [...prev, { key, label, type: "text", required: false }]);
    setDirty(true);
  };

  const removeField = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleLabelChange = (index: number, label: string) => {
    setDraft((prev) => prev.map((f, i) => {
      if (i !== index) return f;
      // key só é derivada automaticamente enquanto o campo é "novo" (sem
      // edição manual de key) — aqui simplificamos sempre derivando do label
      // quando o label muda, mantendo unicidade.
      const base = slugifyKey(label);
      const key = uniqueKey(base, prev, index);
      return { ...f, label, key };
    }));
    setDirty(true);
  };

  const handleOptionsChange = (index: number, text: string) => {
    setOptionsText((prev) => ({ ...prev, [index]: text }));
    const options = text.split(",").map((s) => s.trim()).filter(Boolean);
    update(index, { options });
  };

  const handleSave = async () => {
    await onSave(draft);
    setDirty(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <Text style={styles.sectionTitle}>Campos da inscrição</Text>
        <TouchableOpacity onPress={addField} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Adicionar campo">
          <Icon name="plus" size={14} color={KarateColors.primary} />
          <Text style={styles.addBtnText}>Adicionar campo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Peça informações extras de quem se inscreve, além do CPF (sempre pedido). Ex.: tamanho do
        quimono, contato de emergência, categoria. Os campos aparecem no formulário público de
        inscrição do evento.
      </Text>

      {draft.length === 0 ? (
        <Text style={styles.empty}>
          Nenhum campo extra ainda. A inscrição pede só o CPF. Toque em "Adicionar campo" para pedir mais informações.
        </Text>
      ) : (
        <>
          <Text style={styles.subHint}>
            Cada campo tem um rótulo (o que aparece para quem se inscreve), um tipo (como a resposta é
            preenchida) e se é obrigatório (impede enviar a inscrição sem responder).
          </Text>
          {draft.map((field, index) => (
          <View key={index} style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Rótulo</Text>
                <TextInput
                  style={styles.input}
                  value={field.label}
                  onChangeText={(v) => handleLabelChange(index, v)}
                  placeholder="Ex.: Tamanho do quimono"
                  placeholderTextColor={KarateColors.ink4}
                />
              </View>
              <TouchableOpacity
                onPress={() => removeField(index)}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remover campo ${field.label}`}
              >
                <Icon name="trash" size={16} color={KarateColors.danger} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => {
                const active = field.type === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => update(index, { type: opt.value })}
                    style={[styles.typePill, active && styles.typePillActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.typePillText, active && styles.typePillTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.typeHint}>{TYPE_HINTS[field.type]}</Text>

            {field.type === "select" && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Opções (separadas por vírgula)</Text>
                <TextInput
                  style={styles.input}
                  value={optionsText[index] ?? (field.options ?? []).join(", ")}
                  onChangeText={(v) => handleOptionsChange(index, v)}
                  placeholder="Ex.: P, M, G, GG"
                  placeholderTextColor={KarateColors.ink4}
                />
                <Text style={styles.optionsHint}>Essas opções aparecem como uma lista para quem se inscreve escolher.</Text>
              </View>
            )}

            <View style={styles.requiredRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Obrigatório</Text>
                <Text style={styles.requiredHint}>Impede enviar a inscrição sem preencher este campo.</Text>
              </View>
              <Switch
                value={field.required}
                onValueChange={(v) => update(index, { required: v })}
                trackColor={{ false: KarateColors.border, true: KarateColors.primarySoft }}
                thumbColor={field.required ? KarateColors.primary : "#fff"}
              />
            </View>
          </View>
          ))}
        </>
      )}

      <KarateButton
        label={saving ? "Salvando..." : "Salvar campos da inscrição"}
        variant="sumi"
        size="sm"
        loading={!!saving}
        onPress={handleSave}
        style={{ alignSelf: "flex-start", marginTop: 4 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 } as ViewStyle,
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 } as ViewStyle,
  sectionTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  addBtnText: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3 } as TextStyle,
  empty: { fontSize: 12.5, color: KarateColors.ink3, fontStyle: "italic", paddingVertical: 6 } as TextStyle,
  subHint: { fontSize: 11, color: KarateColors.ink3, marginBottom: 2 } as TextStyle,

  fieldCard: {
    backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12, gap: 8,
  } as ViewStyle,
  fieldRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 } as ViewStyle,
  fieldLabel: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  input: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm,
    paddingVertical: 8, paddingHorizontal: 10, fontSize: 13, color: KarateColors.ink,
    backgroundColor: KarateColors.glass,
  } as TextStyle,
  removeBtn: { padding: 8, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border },

  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  typePill: {
    borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.pill,
    paddingVertical: 5, paddingHorizontal: 10, backgroundColor: KarateColors.glass,
  } as ViewStyle,
  typePillActive: { borderColor: KarateColors.primary, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  typePillText: { fontSize: 11.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  typePillTextActive: { color: KarateColors.primary } as TextStyle,

  requiredRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2, gap: 8 } as ViewStyle,
  typeHint: { fontSize: 11, color: KarateColors.ink3, marginTop: 4 } as TextStyle,
  optionsHint: { fontSize: 11, color: KarateColors.ink3, marginTop: 4 } as TextStyle,
  requiredHint: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
});
