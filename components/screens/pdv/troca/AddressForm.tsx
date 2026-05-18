// ============================================================
// AURA. — PDV · Troca v2 · AddressForm
// Formulário de endereço do cliente para emissão de NF-e modelo 55
// de devolução. Antes era modal aninhado (sub-overlay); agora é
// uma seção embutida no Step 4 que aparece logo após o FiscalBadge
// quando strategy = devolucao_55 OU per_origin.
//
// Mudou de modal pra seção embutida pra reduzir surpresa: operador
// vê o que vai precisar antes de tentar confirmar a troca.
//
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import type { CustomerAddress } from "./types";

type Props = {
  value: CustomerAddress;
  onChange: (next: CustomerAddress) => void;
};

export function AddressForm({ value, onChange }: Props) {
  function set<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <View style={s.box}>
      <Text style={s.title}>
        📍 Endereço do cliente — obrigatório para NF-e 55
      </Text>
      <Text style={s.sub}>
        NFC-e original tem mais de 24h, fora da janela de cancelamento SEFAZ. Esses dados ficam apenas na nota fiscal — não atualizam o cadastro do cliente.
      </Text>

      <View style={s.row}>
        <View style={[s.field, { flex: 3 }]}>
          <Text style={s.label}>Rua</Text>
          <TextInput
            style={s.input as any}
            value={value.street}
            onChangeText={(t) => set("street", t)}
            placeholder="Av. Brasil, Rua dos Pinheiros..."
            placeholderTextColor={Colors.ink3}
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Número</Text>
          <TextInput
            style={s.input as any}
            value={value.number}
            onChangeText={(t) => set("number", t)}
            placeholder="123 ou S/N"
            placeholderTextColor={Colors.ink3}
          />
        </View>
      </View>

      <View style={[s.field, { marginTop: 8 }]}>
        <Text style={s.label}>Bairro</Text>
        <TextInput
          style={s.input as any}
          value={value.neighborhood}
          onChangeText={(t) => set("neighborhood", t)}
          placeholder="Centro, Vila Mariana..."
          placeholderTextColor={Colors.ink3}
        />
      </View>

      <View style={[s.row, { marginTop: 8 }]}>
        <View style={[s.field, { flex: 2 }]}>
          <Text style={s.label}>Cidade</Text>
          <TextInput
            style={s.input as any}
            value={value.city}
            onChangeText={(t) => set("city", t)}
            placeholder="Jacareí"
            placeholderTextColor={Colors.ink3}
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>UF</Text>
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

      <View style={[s.row, { marginTop: 8 }]}>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>CEP</Text>
          <TextInput
            style={s.input as any}
            value={value.zip}
            onChangeText={(t) => set("zip", t.replace(/\D/g, "").slice(0, 8))}
            placeholder="01310100"
            placeholderTextColor={Colors.ink3}
          />
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Código IBGE</Text>
          <TextInput
            style={s.input as any}
            value={value.ibge}
            onChangeText={(t) => set("ibge", t.replace(/\D/g, "").slice(0, 7))}
            placeholder="3550308"
            placeholderTextColor={Colors.ink3}
          />
        </View>
      </View>

      <Text style={s.hint}>
        Código IBGE da cidade pode ser consultado em ibge.gov.br. Cidades do Vale do Paraíba/SP costumam começar com 35.
      </Text>
    </View>
  );
}

// ─── Validação reutilizável ───────────────────────────────────
// Devolve lista de campos faltando — Step4Confirm bloqueia
// confirmação se length > 0.
export function validateAddress(a: CustomerAddress): string[] {
  const missing: string[] = [];
  if (!a.street.trim()) missing.push("rua");
  if (!a.neighborhood.trim()) missing.push("bairro");
  if (!a.city.trim()) missing.push("cidade");
  if (!a.state.trim()) missing.push("UF");
  if (!a.zip.trim()) missing.push("CEP");
  if (!a.ibge.trim()) missing.push("código IBGE");
  return missing;
}

export const EMPTY_ADDRESS: CustomerAddress = {
  street: "", number: "S/N", neighborhood: "",
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
    fontSize: 11, color: Colors.ink3, lineHeight: 16, marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 8 },
  field: { gap: 4 },
  label: {
    fontSize: 11, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, color: Colors.ink3,
  },
  input: {
    backgroundColor: Glass.bgInput,
    borderWidth: 1, borderColor: Glass.bgInputBorder,
    color: Colors.ink, paddingVertical: 9, paddingHorizontal: 11,
    borderRadius: 9, fontSize: 13,
  },
  hint: {
    fontSize: 11, color: Colors.ink4, fontStyle: "italic",
    marginTop: 8, lineHeight: 15,
  },
});

export default AddressForm;
