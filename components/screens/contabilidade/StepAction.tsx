import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Step } from "./types";

type Props = { step: Step; completed: boolean };

/**
 * P2 #7: StepAction — renders portal link and doc badge for each guide step
 * Shows:
 * - "Abrir portal" button when step has portal_url
 * - Doc type badge (PDF/GIF/Link) when step has doc_type
 * - Doc note description
 */
export function StepAction({ step, completed }: Props) {
  if (completed) return null;
  const hasPortal = !!step.portal_url;
  const hasDoc = !!step.doc_type;
  if (!hasPortal && !hasDoc) return null;

  function openPortal() {
    if (!step.portal_url) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(step.portal_url, "_blank");
    } else {
      Linking.openURL(step.portal_url);
    }
  }

  return (
    <View style={s.container}>
      {hasPortal && (
        <Pressable onPress={openPortal} style={s.portalBtn}>
          <Icon name="globe" size={12} color={Colors.violet3} />
          <Text style={s.portalText}>{step.portal_label || "Abrir portal"}</Text>
          <Text style={s.arrow}>{'\u2197'}</Text>
        </Pressable>
      )}
      {hasDoc && (
        <View style={s.docRow}>
          <View style={[
            s.docBadge,
            step.doc_type === "pdf" && s.docPdf,
            step.doc_type === "gif" && s.docGif,
            step.doc_type === "link" && s.docLink,
          ]}>
            <Text style={[
              s.docBadgeText,
              step.doc_type === "pdf" && s.docPdfText,
              step.doc_type === "gif" && s.docGifText,
              step.doc_type === "link" && s.docLinkText,
            ]}>
              {step.doc_type === "pdf" ? "PDF" : step.doc_type === "gif" ? "GIF" : "Link"}
            </Text>
          </View>
          {step.doc_note && <Text style={s.docNote}>{step.doc_note}</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 8, marginLeft: 48, gap: 6 },
  portalBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.violetD, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border2,
    alignSelf: "flex-start",
  },
  portalText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  arrow: { fontSize: 11, color: Colors.violet3 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  docBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: Colors.bg4,
  },
  docPdf: { backgroundColor: "#E6F1FB" },
  docGif: { backgroundColor: "#FBEAF0" },
  docLink: { backgroundColor: "#E1F5EE" },
  docBadgeText: { fontSize: 9, fontWeight: "700", color: Colors.ink3 },
  docPdfText: { color: "#185FA5" },
  docGifText: { color: "#993556" },
  docLinkText: { color: "#0F6E56" },
  docNote: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" as any },
});

export default StepAction;
