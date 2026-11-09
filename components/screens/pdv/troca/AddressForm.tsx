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
// 09/11/2026 — o formulário em si virou o componente comum
// components/endereco/EnderecoForm.tsx (o mesmo do cadastro do cliente e,
// depois, da trava do frete). Aqui fica só o invólucro da troca: a caixa
// tracejada com o aviso da NF-e 55, o IBGE (que só a nota pede) e a
// conversão de/para CustomerAddress. EMPTY_ADDRESS e validateAddress — o
// que o TrocaModal e o Step 4 usam — não mudaram.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { EnderecoForm } from "@/components/endereco/EnderecoForm";
import type { Endereco } from "@/components/endereco/endereco";
import type { CustomerAddress } from "./types";

type Props = {
  value: CustomerAddress;
  onChange: (next: CustomerAddress) => void;
};

/** CustomerAddress (troca) → Endereco (comum). */
export function paraEndereco(a: CustomerAddress): Endereco {
  return {
    zip: a.zip || "", street: a.street || "", number: a.number || "", complement: "",
    neighborhood: a.neighborhood || "", city: a.city || "", state: a.state || "",
    reference: "", ibge: a.ibge || "",
  };
}

/** Endereco (comum) → CustomerAddress (troca). Só as chaves da nota. */
export function paraCustomerAddress(e: Endereco): CustomerAddress {
  return {
    street: e.street, number: e.number, neighborhood: e.neighborhood,
    city: e.city, state: e.state, zip: e.zip, ibge: e.ibge || "",
  };
}

export function AddressForm({ value, onChange }: Props) {
  return (
    <View style={s.box}>
      <Text style={s.title}>
        📍 Endereço do cliente — obrigatório para NF-e 55
      </Text>
      <Text style={s.sub}>
        NFC-e original tem mais de 24h, fora da janela de cancelamento SEFAZ. Esses dados ficam apenas na nota fiscal — não atualizam o cadastro do cliente.
      </Text>
      <EnderecoForm
        value={paraEndereco(value)}
        onChange={(e) => onChange(paraCustomerAddress(e))}
        modo="obrigatorio"
        campos={{ complemento: false, referencia: false, ibge: true }}
        autoFocusCep
        testID="troca-endereco"
      />
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
});

export default AddressForm;
