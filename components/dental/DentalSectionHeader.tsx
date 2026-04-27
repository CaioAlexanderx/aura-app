// ============================================================
// DentalSectionHeader — header de secao do dash dental rico (PR16).
//
// Padrao do shell negocio (bar 4x18 + titulo + chip mes mono).
// Aqui usa cyan no lugar do violet da identidade petala.
// ============================================================

import { View, Text, Platform } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";

interface Props {
  title: string;
  chip?: string;        // ex: "abr 26", "hoje", "mes"
  rightSlot?: React.ReactNode; // CTA opcional na direita
}

export function DentalSectionHeader({ title, chip, rightSlot }: Props) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 10,
      marginTop: 18, marginBottom: 10,
    }}>
      <View style={{
        width: 4, height: 18, borderRadius: 2, backgroundColor: DentalColors.cyan,
      }} />
      <Text style={{
        flex: 0, fontSize: 17, fontWeight: "600", color: DentalColors.ink,
        letterSpacing: -0.2,
      }}>
        {title}
      </Text>
      {chip ? (
        <View style={{
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
          backgroundColor: DentalColors.cyanDim,
          borderWidth: 1, borderColor: DentalColors.cyanBorder,
        }}>
          <Text style={{
            fontSize: 9, color: DentalColors.cyan, fontWeight: "700",
            letterSpacing: 0.6, textTransform: "uppercase",
            ...(Platform.OS === "web" ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } as any : {}),
          }}>
            {chip}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {rightSlot}
    </View>
  );
}
