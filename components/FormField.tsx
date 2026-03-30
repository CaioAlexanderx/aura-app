import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  label: string;
  required?: boolean;
  children: React.ReactNode;
};

export function FormField({ label, required, children }: Props) {
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required && <Text style={s.req}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.ink3, fontWeight: "600", marginBottom: 6 },
  req: { color: Colors.red },
});
