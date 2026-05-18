// ============================================================
// AURA. — PDV · Troca v2 · AddressForm
// Formulário de endereço do cliente para emissão de NF-e modelo 55
// de devolução. Seção embutida no Step 4 (não modal aninhado).
//
// 18/05/2026 — REDESIGN: CEP é o primeiro campo. Ao completar
// 8 dígitos, faz lookup no ViaCEP (https://viacep.com.br) e
// auto-preenche rua, bairro, cidade, UF e código IBGE. Operador só
// precisa preencher o número.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Pressable } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { CustomerAddress } from "./types";

type Props = {
  value: CustomerAddress;
  onChange: (next: CustomerAddress) => void;
};

// ─── ViaCEP types ─────────────────────────────────────────────
// Endpoint público (CORS aberto), zero auth.
// https://viacep.com.br/ws/01310100/json/
type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean | string;
};

// Helper de formatação visual do CEP (00000-000)
function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}

export function AddressForm({ value, onChange }: Props) {
  const [cepDisplay, setCepDisplay] = useState<string>(formatCep(value.zip || ""));
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ok" | "error">(
    value.street && value.zip ? "ok" : "idle"
  );
  const [lookupError, setLookupError] = useState<string>("");
  // Track quais campos vieram do ViaCEP — UI mostra badge "preenchido via CEP"
  const [autofilledFields, setAutofilledFields] = useState<Set<keyof CustomerAddress>>(
    new Set()
  );
  const lastCepLookupRef = useRef<string>("");

  function set<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    onChange({ ...value, [key]: v });
    // Operador editou manualmente — tira badge "auto"
    if (autofilledFields.has(key)) {
      const next = new Set(autofilledFields);
      next.delete(key);
      setAutofilledFields(next);
    }
  }

  // ─── ViaCEP lookup ──────────────────────────────────────────
  async function lookupCep(cep8: string) {
    if (cep8.length !== 8) return;
    if (lastCepLookupRef.current === cep8) return; // já fez esse lookup
    lastCepLookupRef.current = cep8;

    setLookupState("loading");
    setLookupError("");
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep8}/json/`);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data: ViaCepResponse = await resp.json();

      if (data.erro) {
        setLookupState("error");
        setLookupError("CEP não encontrado na base do ViaCEP");
        return;
      }

      // Aplica o resultado mantendo número (que ViaCEP não devolve)
      const next: CustomerAddress = {
        street: data.logradouro || value.street,
        number: value.number,
        neighborhood: data.bairro || value.neighborhood,
        city: data.localidade || value.city,
        state: (data.uf || value.state || "").toUpperCase().slice(0, 2),
        zip: cep8,
        ibge: data.ibge || value.ibge,
      };
      onChange(next);

      const filled = new Set<keyof CustomerAddress>();
      if (data.logradouro) filled.add("street");
      if (data.bairro) filled.add("neighborhood");
      if (data.localidade) filled.add("city");
      if (data.uf) filled.add("state");
      if (data.ibge) filled.add("ibge");
      setAutofilledFields(filled);
      setLookupState("ok");
    } catch (e: any) {
      setLookupState("error");
      setLookupError(e?.message || "Falha ao consultar ViaCEP");
    }
  }

  // Sincroniza display formatado quando value.zip muda externamente
  useEffect(() => {
    setCepDisplay(formatCep(value.zip || ""));
  }, [value.zip]);

  function handleCepChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setCepDisplay(formatCep(digits));
    onChange({ ...value, zip: digits });
    // Dispara lookup automático ao completar 8 dígitos
    if (digits.length === 8) {
      lookupCep(digits);
    } else {
      setLookupState("idle");
      setLookupError("");
      lastCepLookupRef.current = "";
    }
  }

  function retryLookup() {
    lastCepLookupRef.current = "";
    if (value.zip && value.zip.length === 8) {
      lookupCep(value.zip);
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  const isLoading = lookupState === "loading";
  const isOk = lookupState === "ok";
  const isError = lookupState === "error";
  const showFields =
    lookupState === "ok" ||
    !!value.street ||
    !!value.city ||
    !!value.neighborhood;

  return (
    <View style={s.box}>
      <Text style={s.title}>
        📍 Endereço do cliente — obrigatório para NF-e 55
      </Text>
      <Text style={s.sub}>
        NFC-e original tem mais de 24h, fora da janela de cancelamento SEFAZ. Esses dados ficam apenas na nota fiscal — não atualizam o cadastro do cliente.
      </Text>

      {/* CEP em destaque no topo */}
      <View style={s.cepBlock}>
        <Text style={s.label}>CEP</Text>
        <View style={s.cepRow}>
          <TextInput
            style={[
              s.input as any,
              s.cepInput,
              isOk && s.inputOk,
              isError && s.inputError,
            ]}
            value={cepDisplay}
            onChangeText={handleCepChange}
            placeholder="00000-000"
            placeholderTextColor={Colors.ink3}
            keyboardType="number-pad"
            maxLength={9}
            autoFocus
          />
          <View style={s.cepStatus}>
            {isLoading && (
              <View style={s.statusRow}>
                <ActivityIndicator size="small" color={Colors.violet} />
                <Text style={s.statusLoading}>Buscando endereço...</Text>
              </View>
            )}
            {isOk && (
              <View style={s.statusRow}>
                <View style={s.checkIco}>
                  <Icon name="check" size={9} color="#fff" />
                </View>
                <Text style={s.statusOk}>Endereço encontrado · IBGE incluído</Text>
              </View>
            )}
            {isError && (
              <View style={s.statusRow}>
                <Text style={s.statusError}>{lookupError}</Text>
                <Pressable onPress={retryLookup} style={s.retryBtn}>
                  <Text style={s.retryBtnTxt}>Tentar de novo</Text>
                </Pressable>
              </View>
            )}
            {!isLoading && !isOk && !isError && (
              <Text style={s.statusHint}>
                Digite o CEP — rua, bairro, cidade, UF e código IBGE vão ser preenchidos automaticamente
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Resto do form aparece após o lookup (ou se já tem dados) */}
      {showFields && (
        <View style={s.fieldsBlock}>
          <View style={s.row}>
            <View style={[s.field, { flex: 3 }]}>
              <View style={s.labelRow}>
                <Text style={s.label}>Rua</Text>
                {autofilledFields.has("street") && (
                  <Text style={s.autoBadge}>via CEP</Text>
                )}
              </View>
              <TextInput
                style={s.input as any}
                value={value.street}
                onChangeText={(t) => set("street", t)}
                placeholder="Av. Brasil, Rua dos Pinheiros..."
                placeholderTextColor={Colors.ink3}
              />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <View style={s.labelRow}>
                <Text style={s.label}>Número</Text>
                <Text style={s.requiredBadge}>obrigatório</Text>
              </View>
              <TextInput
                style={[s.input as any, s.numberInput]}
                value={value.number}
                onChangeText={(t) => set("number", t)}
                placeholder="123"
                placeholderTextColor={Colors.ink3}
              />
            </View>
          </View>

          <View style={[s.field, { marginTop: 10 }]}>
            <View style={s.labelRow}>
              <Text style={s.label}>Bairro</Text>
              {autofilledFields.has("neighborhood") && (
                <Text style={s.autoBadge}>via CEP</Text>
              )}
            </View>
            <TextInput
              style={s.input as any}
              value={value.neighborhood}
              onChangeText={(t) => set("neighborhood", t)}
              placeholder="Centro, Vila Mariana..."
              placeholderTextColor={Colors.ink3}
            />
          </View>

          <View style={[s.row, { marginTop: 10 }]}>
            <View style={[s.field, { flex: 2 }]}>
              <View style={s.labelRow}>
                <Text style={s.label}>Cidade</Text>
                {autofilledFields.has("city") && (
                  <Text style={s.autoBadge}>via CEP</Text>
                )}
              </View>
              <TextInput
                style={s.input as any}
                value={value.city}
                onChangeText={(t) => set("city", t)}
                placeholder="São Paulo"
                placeholderTextColor={Colors.ink3}
              />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <View style={s.labelRow}>
                <Text style={s.label}>UF</Text>
                {autofilledFields.has("state") && (
                  <Text style={s.autoBadge}>via CEP</Text>
                )}
              </View>
              <TextInput
                style={s.input as any}
                value={value.state}
                onChangeText={(t) => set("state", t.toUpperCase().slice(0, 2))}
                placeholder="SP"
                placeholderTextColor={Colors.ink3}
                maxLength={2}
              />
            </View>
          </View>

          {/* IBGE só aparece se o ViaCEP não devolveu; senão fica oculto
              (já está no value, validação passa). */}
          {!autofilledFields.has("ibge") && (
            <View style={[s.field, { marginTop: 10 }]}>
              <View style={s.labelRow}>
                <Text style={s.label}>Código IBGE</Text>
                <Text style={s.requiredBadge}>obrigatório</Text>
              </View>
              <TextInput
                style={s.input as any}
                value={value.ibge}
                onChangeText={(t) => set("ibge", t.replace(/\D/g, "").slice(0, 7))}
                placeholder="3550308"
                placeholderTextColor={Colors.ink3}
              />
              <Text style={s.fieldHint}>
                ViaCEP não devolveu o código IBGE — consulte em ibge.gov.br se a SEFAZ rejeitar.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Validação reutilizável ───────────────────────────────────
export function validateAddress(a: CustomerAddress): string[] {
  const missing: string[] = [];
  if (!a.street.trim()) missing.push("rua");
  if (!a.neighborhood.trim()) missing.push("bairro");
  if (!a.city.trim()) missing.push("cidade");
  if (!a.state.trim()) missing.push("UF");
  if (!a.zip.trim()) missing.push("CEP");
  if (!a.ibge.trim()) missing.push("código IBGE");
  if (!a.number.trim()) missing.push("número");
  return missing;
}

export const EMPTY_ADDRESS: CustomerAddress = {
  street: "", number: "", neighborhood: "",
  city: "", state: "", zip: "", ibge: "",
};

const s = StyleSheet.create({
  box: {
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    borderStyle: "dashed",
    borderRadius: 11,
    marginBottom: 14,
  },
  title: {
    fontSize: 12, fontWeight: "700",
    color: "#fbbf24", marginBottom: 4,
  },
  sub: {
    fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 14,
  },

  // CEP block (highlight)
  cepBlock: {
    marginBottom: 10,
  },
  cepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  cepInput: {
    width: 140,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    paddingVertical: 12,
  },
  inputOk: {
    borderColor: "rgba(52,211,153,0.5)",
    backgroundColor: "rgba(52,211,153,0.06)",
  },
  inputError: {
    borderColor: "rgba(239,68,68,0.5)",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
  cepStatus: {
    flex: 1,
    paddingTop: 14,
    minHeight: 42,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusLoading: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  statusOk: { fontSize: 12, color: "#34d399", fontWeight: "600" },
  statusError: { fontSize: 12, color: "#ef4444", fontWeight: "500" },
  statusHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16, fontStyle: "italic" },
  checkIco: {
    width: 16, height: 16, borderRadius: 999,
    backgroundColor: "#34d399",
    alignItems: "center", justifyContent: "center",
  },
  retryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "rgba(167,139,250,0.15)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },
  retryBtnTxt: { fontSize: 11, color: "#a78bfa", fontWeight: "600" },

  // Fields block (após lookup)
  fieldsBlock: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  row: { flexDirection: "row", gap: 8 },
  field: { gap: 4 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  label: {
    fontSize: 11, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, color: Colors.ink3,
  },
  autoBadge: {
    fontSize: 9, fontWeight: "700",
    color: "#34d399",
    backgroundColor: "rgba(52,211,153,0.12)",
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  requiredBadge: {
    fontSize: 9, fontWeight: "700",
    color: "#fbbf24",
    backgroundColor: "rgba(251,191,36,0.12)",
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Glass.bgInput,
    borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 9, fontSize: 13,
  },
  numberInput: {
    borderColor: "rgba(251,191,36,0.35)",
    backgroundColor: "rgba(251,191,36,0.04)",
    fontWeight: "600",
  },
  fieldHint: {
    fontSize: 10, color: Colors.ink4, fontStyle: "italic",
    marginTop: 4, lineHeight: 14,
  },
});

export default AddressForm;
