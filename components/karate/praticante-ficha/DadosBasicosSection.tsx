// ============================================================
// Seção "Identidade" — foto (slot), nome, dojô, nascimento, CPF, RG + banner LGPD.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
//
// photoSlot: nó React renderizado logo após o SectionTitle "Identidade",
// antes do campo Nome — preserva a ordem exata do original (P6 é o primeiro
// elemento da seção de identidade, acima do nome).
// ============================================================
import React from "react";
import { View, Text, TextInput, TouchableOpacity, LayoutChangeEvent } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { Dojo } from "@/services/karateApi";
import { maskCpf } from "@/utils/masks";
import { Form, maskDate, SEX_OPTIONS, Sex } from "./helpers";
import { SectionTitle, Row2, Field, styles } from "./shared-styles";
import { DojoSelectSection } from "./DojoSelectSection";

const SEX_LABELS: Record<Sex, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  outro: "Outro",
};

interface DadosBasicosSectionProps {
  federationId: string;
  form: Form;
  setField: <K extends keyof Form>(k: K, v: Form[K]) => void;
  lastDojoRef: React.MutableRefObject<{ id: string; name: string } | null>;
  // validação
  dateBad: boolean;
  age: number | null;
  cpfBad: boolean;
  // Aponta-campo (16/07/2026): "nome" e "dojô" não têm validação de formato
  // em tempo real (só ficam "ruins" quando vazios no submit) — diferente de
  // dateBad/cpfBad, que já nascem prontos. Precisam da própria flag.
  nameBad?: boolean;
  dojoBad?: boolean;
  // reporta a posição Y do seletor de dojô pro shell rolar até ele (não é
  // TextInput, não dá pra usar .focus() — ver DojoSelectSection).
  onDojoLayout?: (e: LayoutChangeEvent) => void;
  // refs Enter
  nameRef: React.RefObject<TextInput>;
  birthRef: React.RefObject<TextInput>;
  cpfRef: React.RefObject<TextInput>;
  rgRef: React.RefObject<TextInput>;
  // callback submit Enter no último campo
  onRgSubmit: () => void;
  // slot de foto — renderizado antes do campo Nome (ordem do original)
  photoSlot?: React.ReactNode;
  // F-matricula: slot renderizado logo após o seletor de dojô — só no cadastro
  // (a página chamadora só passa este slot quando !isEdit).
  registrationSlot?: React.ReactNode;
}

export function DadosBasicosSection({
  federationId, form, setField, lastDojoRef,
  dateBad, age, cpfBad, nameBad, dojoBad, onDojoLayout,
  nameRef, birthRef, cpfRef, rgRef, onRgSubmit,
  photoSlot, registrationSlot,
}: DadosBasicosSectionProps) {
  return (
    <>
      <SectionTitle>Identidade</SectionTitle>

      {/* P6 — foto do praticante (acima do nome, como no original) */}
      {photoSlot}

      <Field
        label="Nome completo" req value={form.full_name}
        onChangeText={(v) => setField("full_name", v)}
        placeholder="Ex.: Maria Tanaka de Souza"
        inputRef={nameRef} returnKeyType="next"
        onSubmitEditing={() => birthRef.current?.focus()}
        bad={nameBad}
      />

      <DojoSelectSection
        federationId={federationId}
        valueId={form.dojo_id}
        valueName={form.dojo_name}
        lastDojoRef={lastDojoRef}
        bad={dojoBad}
        onLayout={onDojoLayout}
        onSelect={(d: Dojo) => {
          lastDojoRef.current = { id: d.id, name: d.name };
          setField("dojo_id", d.id);
          setField("dojo_name", d.name);
        }}
      />

      {registrationSlot}

      <Row2>
        <Field
          flex label="Nascimento" hint="dd/mm/aaaa" mono value={form.birth_date}
          onChangeText={(v) => setField("birth_date", maskDate(v))}
          keyboardType="numeric" placeholder="dd/mm/aaaa"
          inputRef={birthRef} returnKeyType="next"
          onSubmitEditing={() => cpfRef.current?.focus()}
          bad={dateBad}
          note={dateBad ? "Data inválida" : age != null ? `${age} anos${age < 18 ? " · menor de idade" : ""}` : undefined}
        />
        <Field
          flex label="CPF" mono value={form.cpf}
          onChangeText={(v) => setField("cpf", maskCpf(v))}
          keyboardType="numeric" placeholder="000.000.000-00" bad={cpfBad}
          inputRef={cpfRef} returnKeyType="next"
          onSubmitEditing={() => rgRef.current?.focus()}
          note={cpfBad ? "Dígitos não conferem" : form.cpf ? "CPF válido" : undefined}
          noteOk={!cpfBad && !!form.cpf}
        />
      </Row2>

      <Field
        label="RG" mono value={form.rg}
        onChangeText={(v) => setField("rg", v)}
        placeholder="00.000.000-0"
        inputRef={rgRef} returnKeyType="next"
        onSubmitEditing={onRgSubmit}
      />

      <Row2>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Sexo</Text>
          <View style={styles.chipsRow}>
            {SEX_OPTIONS.map((opt) => {
              const active = form.sex === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setField("sex", active ? "" : opt)}
                  activeOpacity={0.7}
                  accessibilityLabel={SEX_LABELS[opt]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{SEX_LABELS[opt]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <Field
          flex label="Filiado desde" hint="dd/mm/aaaa" mono value={form.affiliation_since}
          onChangeText={(v) => setField("affiliation_since", maskDate(v))}
          keyboardType="numeric" placeholder="dd/mm/aaaa"
        />
      </Row2>

      {age != null && age < 18 && (
        <View style={styles.lgpd}>
          <Icon name="shield" size={14} color={P.ink2} />
          <Text style={styles.lgpdTxt}>Menor de idade — preencha a seção Responsável abaixo (LGPD Art. 14).</Text>
        </View>
      )}
    </>
  );
}
