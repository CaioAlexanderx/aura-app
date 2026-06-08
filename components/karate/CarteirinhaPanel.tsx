// ============================================================
// CarteirinhaPanel — Aura Karatê (DESIGN-14)
//
// Widget admin na aba "Carteirinha" da Ficha do Praticante.
// - Consome GET .../card; se 404, oferece "Emitir carteirinha".
// - Mostra chip de situação (ícone + texto, AA): Ativa | Revogada
//   no SHELL do app (não no cartão — decisão Caio 08/06).
// - Renderiza o cartão (frente/verso) via CarteirinhaCard.
// - Emitir/Renovar via POST .../issue-card; exibe warnings do backend.
//
// Carteirinha é DATA-ONLY: nenhuma imagem é gerada no app/servidor.
// ============================================================
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { CarteirinhaCard } from "@/components/karate/CarteirinhaCard";
import { karateCardApi, MembershipCard } from "@/services/karateCardApi";

interface CarteirinhaPanelProps {
  federationId: string;
  practitionerId: string;
}

export function CarteirinhaPanel({ federationId, practitionerId }: CarteirinhaPanelProps) {
  const [card, setCard] = useState<MembershipCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    karateCardApi
      .getCard(federationId, practitionerId)
      .then((c) => { if (alive) setCard(c); })
      .catch(() => { if (alive) setCard(null); }) // 404 = sem carteirinha
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [federationId, practitionerId]);

  const doIssue = async () => {
    setIssuing(true);
    try {
      const res = await karateCardApi.issueCard(federationId, practitionerId);
      setCard(res);
      setFace("front");
      const warns = res.warnings || [];
      Alert.alert(
        res.renewed ? "Carteirinha renovada" : "Carteirinha emitida",
        warns.length ? `Atenção:\n• ${warns.join("\n• ")}` : "Processada com sucesso."
      );
    } catch (e: any) {
      Alert.alert("Não foi possível emitir", e?.message || "Tente novamente.");
    } finally {
      setIssuing(false);
    }
  };

  const confirmIssue = () => {
    const renew = !!card;
    Alert.alert(
      renew ? "Renovar carteirinha?" : "Emitir carteirinha?",
      renew
        ? "A carteirinha atual será substituída por uma nova (a anterior é arquivada)."
        : "Será gerada a carteirinha digital do praticante a partir dos dados atuais.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: renew ? "Renovar" : "Emitir", onPress: doIssue },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.tab}>
        <Skeleton height={20} />
        <Skeleton height={180} />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.tab}>
        <KarateEmptyState
          icon="card-outline"
          title="Nenhuma carteirinha emitida"
          subtitle="Emita a carteirinha digital do praticante. Os dados (faixa, dojô, registro) são capturados no momento da emissão."
          style={{ paddingVertical: 24 }}
        />
        <KarateButton
          label={issuing ? "Emitindo…" : "Emitir carteirinha"}
          variant="primary"
          loading={issuing}
          onPress={confirmIssue}
        />
      </View>
    );
  }

  const revoked = card.status === "revoked";

  return (
    <View style={styles.tab}>
      {/* situação no shell (não no cartão) */}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Situação da carteirinha</Text>
        <Badge
          status={revoked ? "danger" : "ok"}
          label={revoked ? "Revogada" : "Ativa"}
        />
      </View>

      {/* flip frente/verso */}
      <View style={styles.flipRow}>
        {(["front", "back"] as const).map((ff) => (
          <TouchableOpacity
            key={ff}
            onPress={() => setFace(ff)}
            style={[styles.flipBtn, face === ff && styles.flipBtnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: face === ff }}
          >
            <Text style={[styles.flipTxt, face === ff && styles.flipTxtActive]}>
              {ff === "front" ? "Frente" : "Verso"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* o cartão */}
      <CarteirinhaCard card={card} face={face} />

      {/* meta */}
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={KarateColors.ink3} />
          <Text style={styles.metaTxt}>Emitida em {fmtBR(card.issued_at)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="qr-code-outline" size={13} color={KarateColors.ink3} />
          <Text style={styles.metaTxt} numberOfLines={1} selectable>
            app.getaura.com.br/karate/verify/{card.verify_token}
          </Text>
        </View>
      </View>

      {/* ações */}
      <KarateButton
        label={issuing ? "Renovando…" : "Renovar carteirinha"}
        variant="secondary"
        loading={issuing}
        onPress={confirmIssue}
      />
    </View>
  );
}

function fmtBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const styles = StyleSheet.create({
  tab:        { padding: 16, gap: 14 } as ViewStyle,
  statusRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  statusLabel:{ fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  flipRow:    { flexDirection: "row", gap: 8, alignSelf: "center" } as ViewStyle,
  flipBtn:    { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  flipBtnActive: { backgroundColor: KarateColors.primary, borderColor: KarateColors.primary } as ViewStyle,
  flipTxt:    { fontSize: 13, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  flipTxtActive: { color: "#fff" } as TextStyle,
  meta:       { gap: 6, marginTop: 2 } as ViewStyle,
  metaItem:   { flexDirection: "row", alignItems: "center", gap: 7 } as ViewStyle,
  metaTxt:    { flex: 1, fontSize: 11, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
});
