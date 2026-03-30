import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Crumb = { label: string; route?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const router = useRouter();
  if (items.length <= 1) return null;

  return (
    <View style={s.container}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <View key={i} style={s.item}>
            {i > 0 && <Text style={s.sep}>/</Text>}
            {isLast ? (
              <Text style={s.current}>{item.label}</Text>
            ) : (
              <Pressable onPress={() => item.route && router.push(item.route as any)}>
                <Text style={s.link}>{item.label}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  sep: {
    fontSize: 12,
    color: Colors.ink3,
    marginHorizontal: 6,
    fontWeight: "300",
  },
  link: {
    fontSize: 12,
    color: Colors.violet3,
    fontWeight: "500",
  },
  current: {
    fontSize: 12,
    color: Colors.ink3,
    fontWeight: "500",
  },
});

export default Breadcrumb;
