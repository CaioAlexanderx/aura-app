import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
};

export function Pagination({ page, totalPages, total, pageSize, onPage }: Props) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);
  const label = `${start}-${end} de ${total}`; // hifen ASCII, sem Unicode escapes

  return (
    <View style={s.container}>
      <Pressable
        onPress={() => onPage(page - 1)}
        disabled={page === 1}
        style={[s.btn, page === 1 && s.btnDisabled]}
      >
        <Text style={[s.btnText, page === 1 && s.btnTextDisabled]}>{"<"} Anterior</Text>
      </Pressable>

      <Text style={s.info}>{label}</Text>

      <Pressable
        onPress={() => onPage(page + 1)}
        disabled={page === totalPages}
        style={[s.btn, page === totalPages && s.btnDisabled]}
      >
        <Text style={[s.btnText, page === totalPages && s.btnTextDisabled]}>Proxima {">"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4, marginTop: 4 },
  btn:            { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnDisabled:    { opacity: 0.35 },
  btnText:        { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  btnTextDisabled:{ color: Colors.ink3 },
  info:           { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
});

export default Pagination;
