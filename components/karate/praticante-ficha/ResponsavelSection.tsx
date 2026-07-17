// ============================================================
// Seção "Responsável" — P7 / LGPD Art. 14.
// Obrigatório somente para menores de 18 anos.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================
import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { maskCpf } from "@/utils/masks";
import { maskPhone as maskPhoneUtil } from "@/utils/masks";
import { Form, GUARDIAN_RELATIONSHIPS, GuardianRelationship } from "./helpers";
import { SectionTitle, Row2, Field, styles } from "./shared-styles";

interface ResponsavelSectionProps {
  form: Form;
  setField: <K extends keyof Form>(k: K, v: Form[K]) => void;
  isMinor: boolean;
  guardianCpfBad: boolean;
  // Aponta-campo (16/07/2026): "nome do responsável" só é obrigatório
  // condicionalmente (isMinor) e não tem validação de formato — precisa da
  // própria flag, igual full_name/dojo_id.
  guardianNameBad?: boolean;
  // refs Enter
  guardianNameRef: React.RefObject<TextInput>;
  guardianCpfRef: React.RefObject<TextInput>;
  guardianPhoneRef: React.RefObject<TextInput>;
}

export function ResponsavelSection({
  form, setField, isMinor, guardianCpfBad, guardianNameBad,
  guardianNameRef, guardianCpfRef, guardianPhoneRef,
}: ResponsavelSectionProps) {
  return (
    <>
      <SectionTitle>Responsável</SectionTitle>

      <View style={styles.guardianNote}>
        <Icon name="info" size={13} color={P.ink3} />
        <Text style={styles.guardianNoteTxt}>
          {isMinor
            ? "Menor de 18 anos — nome do responsável obrigatório (LGPD Art. 14)."
            : "Dados do responsável — obrigatórios para menores de 18 anos."}
        </Text>
      </View>

      <Field
        label="Nome do responsável"
        req={isMinor}
        value={form.guardian_name}
        onChangeText={(v) => setField("guardian_name", v)}
        placeholder="Nome completo do responsável"
        inputRef={guardianNameRef}
        returnKeyType="next"
        onSubmitEditing={() => guardianCpfRef.current?.focus()}
        bad={guardianNameBad}
      />

      <Row2>
        <Field
          flex label="CPF do responsável" mono value={form.guardian_cpf}
          onChangeText={(v) => setField("guardian_cpf", maskCpf(v))}
          keyboardType="numeric" placeholder="000.000.000-00" bad={guardianCpfBad}
          inputRef={guardianCpfRef} returnKeyType="next"
          onSubmitEditing={() => guardianPhoneRef.current?.focus()}
          note={guardianCpfBad ? "Dígitos não conferem" : form.guardian_cpf ? "CPF válido" : undefined}
          noteOk={!guardianCpfBad && !!form.guardian_cpf}
        />
        <Field
          flex label="Telefone do responsável" mono value={form.guardian_phone}
          onChangeText={(v) => setField("guardian_phone", maskPhoneUtil(v))}
          keyboardType="numeric" placeholder="(00) 00000-0000"
          inputRef={guardianPhoneRef} returnKeyType="done"
        />
      </Row2>

      {/* Parentesco — chips */}
      <View style={styles.field}>
        <Text style={styles.label}>Parentesco</Text>
        <View style={styles.chipsRow}>
          {GUARDIAN_RELATIONSHIPS.map((rel) => {
            const active = form.guardian_relationship === rel;
            return (
              <TouchableOpacity
                key={rel}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setField("guardian_relationship", active ? "" : rel as GuardianRelationship)}
                activeOpacity={0.7}
                accessibilityLabel={rel}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{rel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}
