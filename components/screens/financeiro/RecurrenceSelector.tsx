import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";

var OPTIONS = [
  { key: "", label: "Nenhuma" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensal" },
  { key: "yearly", label: "Anual" },
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  labelStyle: any;
  gridStyle: any;
  btnStyle: any;
  btnActiveStyle: any;
  textStyle: any;
  textActiveStyle: any;
};

export function RecurrenceSelector({ value, onChange, labelStyle, gridStyle, btnStyle, btnActiveStyle, textStyle, textActiveStyle }: Props) {
  return (
    <View>
      <Text style={labelStyle}>Recorrencia (opcional)</Text>
      <View style={gridStyle}>
        {OPTIONS.map(function(o) {
          return (
            <Pressable key={o.key} onPress={function() { onChange(o.key); }} style={[btnStyle, value === o.key && btnActiveStyle]}>
              <Text style={[textStyle, value === o.key && textActiveStyle]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
