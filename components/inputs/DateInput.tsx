/**
 * DateInput — input controlado com máscara dd/mm/aaaa
 *
 * Padrão único para qualquer input de data no aura-app (vencimento de
 * parcela, data de venda manual, agenda, etc). Aceita SOMENTE dígitos
 * (caracteres não-numéricos são descartados) e insere os separadores
 * automaticamente.
 *
 * API:
 *   value         — string no formato dd/mm/aaaa (parcial é OK durante digitação)
 *   onChangeText  — emite a string mascarada (dd/mm/aaaa parcial ou completo)
 *   onValidChange — opcional; emite o ISO YYYY-MM-DD se a data ficou completa+válida,
 *                   ou null se voltou a ficar inválida/parcial
 *   showErrorOn   — "blur" (default) ou "always". Erro visual só aparece depois que
 *                   o usuário sai do input ou se forçado externamente.
 *   forceShowError— quando true (ex.: tentativa de submit), pinta erro mesmo sem blur
 *   ...rest dos TextInputProps do RN (style, editable, autoFocus, etc)
 *
 * Helpers exportados:
 *   maskBrDate(input)     — aplica máscara sobre string crua (dígitos + outros)
 *   parseBrDate(input)    — dd/mm/aaaa → "YYYY-MM-DD" se válido, senão null
 *   formatIsoToBr(iso)    — "YYYY-MM-DD" → "dd/mm/aaaa" (vazio se input inválido)
 *   isCompleteBrDate(s)   — tem 10 chars e parseia
 */
import { forwardRef, useState, useCallback } from "react";
import { TextInput, View, Text, StyleSheet, TextInputProps } from "react-native";
import { Colors } from "@/constants/colors";

// --- helpers (exportados) ---------------------------------------------------

export function maskBrDate(input: string): string {
  if (!input) return "";
  var digits = String(input).replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
}

/**
 * Converte "dd/mm/aaaa" em "YYYY-MM-DD". Retorna null se:
 *   - string incompleta (<10 chars úteis)
 *   - dia fora de 1..31, mês fora de 1..12, ano com <4 dígitos
 *   - Date resultante for inválida ou diferente do esperado (ex.: 31/02)
 */
export function parseBrDate(input: string): string | null {
  if (!input) return null;
  var s = String(input).trim();
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  var dd = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  var yyyy = parseInt(m[3], 10);
  if (!dd || !mm || !yyyy) return null;
  if (dd < 1 || dd > 31) return null;
  if (mm < 1 || mm > 12) return null;
  if (yyyy < 1900 || yyyy > 9999) return null;
  // round-trip via Date pra pegar 31/02, 30/02, etc.
  var d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  var iso = String(yyyy).padStart(4, "0") + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  return iso;
}

export function formatIsoToBr(iso: string | null | undefined): string {
  if (!iso) return "";
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return "";
  return m[3] + "/" + m[2] + "/" + m[1];
}

export function isCompleteBrDate(input: string): boolean {
  return parseBrDate(input) !== null;
}

// --- componente -------------------------------------------------------------

type DateInputProps = Omit<TextInputProps, "value" | "onChangeText" | "keyboardType" | "inputMode" | "maxLength" | "placeholder"> & {
  value: string;
  onChangeText: (next: string) => void;
  onValidChange?: (iso: string | null) => void;
  placeholder?: string;
  showErrorOn?: "blur" | "always";
  forceShowError?: boolean;
  errorMessage?: string;
};

export const DateInput = forwardRef<TextInput, DateInputProps>(function DateInput(props, ref) {
  const {
    value,
    onChangeText,
    onValidChange,
    placeholder,
    showErrorOn = "blur",
    forceShowError = false,
    errorMessage,
    onBlur,
    style,
    ...rest
  } = props;
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback((raw: string) => {
    const masked = maskBrDate(raw);
    onChangeText(masked);
    if (onValidChange) onValidChange(parseBrDate(masked));
  }, [onChangeText, onValidChange]);

  const handleBlur = useCallback((e: any) => {
    setTouched(true);
    if (onBlur) onBlur(e);
  }, [onBlur]);

  const isComplete = value.length === 10;
  const isInvalid = isComplete && parseBrDate(value) === null;
  const showError = isInvalid && (forceShowError || showErrorOn === "always" || touched);

  return (
    <View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder || "dd/mm/aaaa"}
        placeholderTextColor={Colors.ink3}
        keyboardType="numeric"
        inputMode="numeric"
        maxLength={10}
        style={[styles.input, showError && styles.inputError, style]}
        {...rest}
      />
      {showError && (
        <Text style={styles.errorText}>{errorMessage || "Data inválida. Use dd/mm/aaaa."}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.ink,
  },
  inputError: {
    borderColor: Colors.red,
  },
  errorText: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.red,
  },
});
