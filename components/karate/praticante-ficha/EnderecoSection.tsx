// ============================================================
// Seção "Contato & endereço" — telefone, e-mail, CEP (ViaCEP) + logradouro.
// Extraído de components/karate/PraticanteFichaModal.tsx (refactor puro).
// ============================================================
import React from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { maskPhone as maskPhoneUtil } from "@/utils/masks";
import { Form, maskCEP } from "./helpers";
import { SectionTitle, Row2, Field, styles } from "./shared-styles";

interface EnderecoSectionProps {
  form: Form;
  setField: <K extends keyof Form>(k: K, v: Form[K]) => void;
  cepStatus: { msg: string; ok: boolean } | null;
  onCep: (raw: string) => void;
  // refs Enter
  phoneRef: React.RefObject<TextInput>;
  emailRef: React.RefObject<TextInput>;
  onEmailSubmit: () => void;
}

export function EnderecoSection({
  form, setField, cepStatus, onCep, phoneRef, emailRef, onEmailSubmit,
}: EnderecoSectionProps) {
  return (
    <>
      <SectionTitle>Contato &amp; endereço</SectionTitle>

      <Row2>
        <Field
          flex label="Telefone" mono value={form.phone}
          onChangeText={(v) => setField("phone", maskPhoneUtil(v))}
          keyboardType="numeric" placeholder="(00) 00000-0000"
          inputRef={phoneRef} returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <Field
          flex label="E-mail" value={form.email}
          onChangeText={(v) => setField("email", v)}
          keyboardType="email-address" autoCapitalize="none"
          placeholder="nome@exemplo.com"
          inputRef={emailRef} returnKeyType="done"
          onSubmitEditing={onEmailSubmit}
        />
      </Row2>

      {/* CEP destacado */}
      <View style={styles.cepBox}>
        <Text style={styles.cepLabel}>
          CEP <Text style={styles.cepHint}>· preenche o endereço automaticamente</Text>
        </Text>
        <View style={styles.cepRow}>
          <TextInput
            style={[styles.input, styles.mono, { flex: 1, fontSize: 16 }]}
            value={form.zip_code}
            onChangeText={onCep}
            keyboardType="numeric"
            placeholder="00000-000"
            placeholderTextColor={P.ink4}
            maxLength={9}
            accessibilityLabel="CEP"
            returnKeyType="next"
          />
          {cepStatus?.msg === "Buscando endereço…" ? (
            <ActivityIndicator color={P.red} style={{ width: 36 }} />
          ) : (
            <Icon name="search" size={18} color={P.ink3} style={{ width: 36, alignSelf: "center" }} />
          )}
        </View>
        {cepStatus ? (
          <Text style={[styles.note, cepStatus.ok ? styles.noteOk : styles.noteBad]}>
            {cepStatus.msg}
          </Text>
        ) : null}
      </View>

      <Row2>
        <Field flex2 label="Logradouro" value={form.street} onChangeText={(v) => setField("street", v)} placeholder="Rua, avenida…" />
        <Field flex label="Número" mono value={form.number} onChangeText={(v) => setField("number", v)} placeholder="000" keyboardType="numeric" />
      </Row2>
      <Row2>
        <Field flex label="Complemento" value={form.complement} onChangeText={(v) => setField("complement", v)} placeholder="Apto, bloco…" />
        <Field flex label="Bairro" value={form.neighborhood} onChangeText={(v) => setField("neighborhood", v)} />
      </Row2>
      <Row2>
        <Field flex2 label="Cidade" value={form.city} onChangeText={(v) => setField("city", v)} />
        <Field flex label="UF" mono value={form.state} onChangeText={(v) => setField("state", v.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" />
      </Row2>
    </>
  );
}
