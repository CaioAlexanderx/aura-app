// ============================================================
// Secao "Matricula (FPKT)" - SOMENTE no cadastro (modo criacao).
// Permite escolher entre gerar o numero automaticamente (padrao, backend
// atribui) ou informar manualmente um numero ja existente/reservado.
// Na edicao a matricula e somente leitura (ver subMono no header do modal) -
// este seletor nao aparece nesse modo.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P } from "@/constants/karateTheme";
import { Field, styles } from "./shared-styles";

export type RegistrationMode = "auto" | "manual";

interface MatriculaSectionProps {
  mode: RegistrationMode;
  onChangeMode: (m: RegistrationMode) => void;
  manualValue: string;
  onChangeManualValue: (v: string) => void;
}

export function MatriculaSection({ mode, onChangeMode, manualValue, onChangeManualValue }: MatriculaSectionProps) {
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={styles.label}>Numero de matricula (FPKT)</Text>
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chip, mode === "auto" && styles.chipActive]}
          onPress={() => onChangeMode("auto")}
          activeOpacity={0.7}
          accessibilityLabel="Gerar automatico"
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === "auto" }}
        >
          <Text style={[styles.chipTxt, mode === "auto" && styles.chipTxtActive]}>Gerar automatico</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, mode === "manual" && styles.chipActive]}
          onPress={() => onChangeMode("manual")}
          activeOpacity={0.7}
          accessibilityLabel="Informar manualmente"
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === "manual" }}
        >
          <Text style={[styles.chipTxt, mode === "manual" && styles.chipTxtActive]}>Informar manualmente</Text>
        </TouchableOpacity>
      </View>

      {mode === "manual" ? (
        <View style={{ marginTop: 9 }}>
          <Field
            label="Numero da matricula"
            mono
            value={manualValue}
            onChangeText={onChangeManualValue}
            placeholder="Ex.: 000123"
          />
          <View style={styles.guardianNote}>
            <Icon name="info" size={13} color={P.ink3} />
            <Text style={styles.guardianNoteTxt}>
              Se o numero ja estiver em uso por outro praticante, o cadastro sera recusado.
            </Text>
          </View>
        </View>
      ) : (
        <Text style={{ fontSize: 11.5, color: P.ink3, marginTop: 2 }}>
          O sistema atribui o proximo numero disponivel ao salvar.
        </Text>
      )}
    </View>
  );
}

// Campo editável de matrícula para o modo EDIÇÃO da ficha. Sem o seletor
// auto/manual (a matrícula já existe) — apenas permite corrigir/trocar o
// número. A unicidade é validada no backend (409 se já estiver em uso).
export function MatriculaEditField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={styles.label}>Numero de matricula (FPKT)</Text>
      <Field
        label="Numero da matricula"
        mono
        value={value}
        onChangeText={onChange}
        placeholder="Ex.: 000123"
      />
      <View style={styles.guardianNote}>
        <Icon name="info" size={13} color={P.ink3} />
        <Text style={styles.guardianNoteTxt}>
          Alterar a matricula muda o numero exibido na carteirinha. Se ja estiver em uso por outro praticante, a alteracao sera recusada.
        </Text>
      </View>
    </View>
  );
}
