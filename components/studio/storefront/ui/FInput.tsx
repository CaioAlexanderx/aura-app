// ============================================================
// components/studio/storefront/ui/FInput.tsx
// Componente de input de formulário reutilizável.
// ============================================================
import { TextInput } from "react-native";
import { T } from "../types";

export function FInput({
  v, on, ph, kb, multi, flex,
}: {
  v: string;
  on: (s: string) => void;
  ph: string;
  kb?: any;
  multi?: boolean;
  flex?: number;
}) {
  return (
    <TextInput
      value={v}
      onChangeText={on}
      placeholder={ph}
      placeholderTextColor={T.ink4}
      keyboardType={kb}
      multiline={multi}
      style={{
        flex: flex ?? 1, backgroundColor: T.card, color: T.ink, padding: 12,
        borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: T.border,
        minHeight: multi ? 60 : undefined,
      }}
    />
  );
}
