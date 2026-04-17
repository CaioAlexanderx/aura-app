import { View, Text, TextInput } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  value: string;
  onChange: (v: string) => void;
  labelStyle: any;
  inputStyle: any;
};

export function CouponInput({ value, onChange, labelStyle, inputStyle }: Props) {
  return (
    <View>
      <Text style={labelStyle}>Cupom de desconto (opcional)</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChange}
        placeholder="Codigo do cupom"
        placeholderTextColor={Colors.ink3}
        autoCapitalize="characters"
      />
    </View>
  );
}
