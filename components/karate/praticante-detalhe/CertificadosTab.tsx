import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateEmptyState as EmptyState } from "@/components/karate/EmptyState";
import { karateApi, PractitionerDetail } from "@/services/karateApi";

interface Props {
  certificates: PractitionerDetail["certificates"];
  federationId: string;
  practitionerId: string;
}

// Track P: aba de certificados/exames — exibe lista + permite emitir novo certificado
export function CertificadosTab({ certificates, federationId, practitionerId }: Props) {
  const [issuingId, setIssuingId] = useState<string | null>(null);

  async function handleIssue(certId: string) {
    setIssuingId(certId);
    try {
      await karateApi.issueCertificate(federationId, practitionerId, certId);
    } finally {
      setIssuingId(null);
    }
  }

  if (!certificates || certificates.length === 0) {
    return (
      <EmptyState
        icon="document-outline"
        title="Sem certificados"
        subtitle="Certificados são gerados automaticamente após exames."
        style={{ padding: 32 }}
      />
    );
  }

  return (
    <View style={tabStyles.tab}>
      {certificates.map((cert) => (
        <View key={cert.id} style={tabStyles.certCard}>
          <View style={tabStyles.certIconWrap}>
            <Icon name="ribbon" size={20} color={KarateColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tabStyles.certTitle}>{cert.certificate_type_name || cert.certificate_type}</Text>
            <Text style={tabStyles.certMeta}>
              {cert.issued_at
                ? `Emitido em ${new Date(cert.issued_at).toLocaleDateString("pt-BR")}`
                : "Não emitido"}
            </Text>
          </View>
          {!cert.issued_at && (
            <TouchableOpacity
              style={[tabStyles.issueBtn, issuingId === cert.id && { opacity: 0.6 }]}
              onPress={() => handleIssue(cert.id)}
              disabled={issuingId === cert.id}
              accessibilityRole="button"
              accessibilityLabel="Emitir certificado"
            >
              {issuingId === cert.id
                ? <ActivityIndicator size="small" color="#fdf8f2" />
                : <Text style={tabStyles.issueBtnTxt}>Emitir</Text>}
            </TouchableOpacity>
          )}
          {cert.issued_at && (
            <View style={tabStyles.issuedBadge}>
              <Icon name="check" size={14} color={KarateColors.primary} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  tab:          { padding: 16, gap: 10 } as ViewStyle,
  certCard:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  certIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  certTitle:    { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  certMeta:     { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  issueBtn:     { paddingVertical: 7, paddingHorizontal: 12, backgroundColor: KarateColors.ink, borderRadius: KarateRadius.md, alignItems: "center", justifyContent: "center" } as ViewStyle,
  issueBtnTxt:  { fontSize: 13, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  issuedBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: KarateColors.primarySoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
});

