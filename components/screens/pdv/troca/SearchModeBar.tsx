// ============================================================
// AURA. — PDV · Troca v2 · SearchModeBar
// Barra de modos de busca reutilizada em:
//   - Step 1 (localizar VENDA): text | order | barcode | qr
//   - Step 3 (localizar PRODUTO novo): text | barcode | qr
//
// Cada modo tem ícone + label + placeholder dinâmico. O componente
// é "burro" — quem usa controla `mode` e `onChange`, e cuida do
// input que vem abaixo.
//
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx (Step 3 com scanner)
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";

// ─── Modes genéricos (string para aceitar Step1SearchMode | Step3SearchMode)
// O caller passa `modes` com a config visual de cada chip.
export type SearchModeChip<TMode extends string> = {
  key: TMode;
  label: string;
  icon: string; // nome no Icon registry (com underscore: file_text, qr_code, etc)
  placeholder: string;
};

type Props<TMode extends string> = {
  mode: TMode;
  modes: SearchModeChip<TMode>[];
  onChange: (next: TMode) => void;
};

export function SearchModeBar<TMode extends string>({
  mode,
  modes,
  onChange,
}: Props<TMode>) {
  return (
    <View style={s.row}>
      {modes.map((m) => {
        const active = mode === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            style={[s.btn, active && s.btnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Icon
              name={m.icon as any}
              size={12}
              color={active ? "#fff" : Colors.ink3}
            />
            <Text style={[s.btnTxt, active && s.btnTxtActive]} numberOfLines={1}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Helper: placeholder pro input correspondente ──────────────
// Caller usa: <TextInput placeholder={placeholderFor(mode, modes)} />
export function placeholderFor<TMode extends string>(
  mode: TMode,
  modes: SearchModeChip<TMode>[]
): string {
  return modes.find((m) => m.key === mode)?.placeholder || "";
}

// ─── Configs pré-prontas pra Step 1 e Step 3 ───────────────────
// Mantém os labels/placeholders em um lugar só pra consistência.
// Icon names seguem o registry em components/Icon.tsx (underscore).
import type { Step1SearchMode, Step3SearchMode } from "./types";

export const STEP1_MODES: SearchModeChip<Step1SearchMode>[] = [
  {
    key: "text",
    label: "Cliente/CPF",
    icon: "users",
    placeholder: "Buscar por nome do cliente, CPF, vendedora ou produto...",
  },
  {
    key: "order",
    label: "Nº pedido",
    icon: "file_text",
    placeholder: "Digite o número do pedido (ex: V-5432)...",
  },
  {
    key: "barcode",
    label: "Cód. barras",
    icon: "barcode",
    placeholder: "Bipe ou digite o código de barras do produto...",
  },
  {
    key: "qr",
    label: "QR cupom",
    icon: "qr_code",
    placeholder: "Aponte a câmera ou cole a chave de acesso da NFC-e...",
  },
];

export const STEP3_MODES: SearchModeChip<Step3SearchMode>[] = [
  {
    key: "text",
    label: "Buscar",
    icon: "search",
    placeholder: "Buscar produto do catálogo por nome...",
  },
  {
    key: "barcode",
    label: "Bipe",
    icon: "barcode",
    placeholder: "Bipe agora — código vai pro carrinho automaticamente",
  },
  {
    key: "qr",
    label: "QR Code",
    icon: "qr_code",
    placeholder: "Aponte a câmera ou cole o código QR do produto",
  },
];

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: IS_DARK_MODE
      ? "rgba(255,255,255,0.04)"
      : "rgba(0,0,0,0.025)",
    borderWidth: 1,
    borderColor: IS_DARK_MODE
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.06)",
  },
  btnActive: {
    backgroundColor: Colors.violet,
    borderColor: Colors.violet,
  },
  btnTxt: {
    color: Colors.ink2,
    fontSize: 12,
    fontWeight: "500",
  },
  btnTxtActive: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default SearchModeBar;
