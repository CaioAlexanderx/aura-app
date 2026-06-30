// ============================================================
// CarteirinhaPanel — Aura Karatê (DESIGN-14)
//
// Widget admin na aba "Carteirinha" da Ficha do Praticante.
// - Consome GET .../card; se 404, oferece "Emitir carteirinha".
// - Mostra chip de situação (ícone + texto, AA): Ativa | Revogada
//   no SHELL do app (não no cartão — decisão Caio 08/06).
// - Renderiza o cartão (frente/verso) via CarteirinhaCard.
// - Emitir/Renovar via POST .../issue-card; exibe warnings do backend.
// - Revogar (fix/karate-practitioner-edit-delete-ui): quando há carteirinha
//   ativa, botão destrutivo "Revogar" → window.confirm → karateApi.revokeCard
//   → refetch (chip vira "Revogada"). Após revogar, "Emitir" gera uma nova.
//
// Carteirinha é DATA-ONLY: nenhuma imagem é gerada no app/servidor.
//
// Padronização de CTAs (Shoji): "Emitir carteirinha" é CTA primário em sumi
//   (escuro), tamanho normal, alinhado à direita — não mais faixa vermelha
//   full-width. "Renovar" segue como ação secundária. O vermelhão fica
//   reservado a ações destrutivas/críticas ("Revogar").
//
// Fix C5 (23/06): o botão "Emitir carteirinha" não fazia nada ao clicar.
//   Causa: a confirmação usava Alert.alert com DOIS botões (Cancelar + Emitir),
//   e no React Native Web o Alert.alert com botões é um no-op — o onPress de
//   confirmação nunca disparava, então issueCard() jamais era chamado. Agora a
//   confirmação usa window.confirm na web (e Alert.alert só em nativo, onde
//   funciona), garantindo que a emissão de fato acontece. Feedback de
//   sucesso/erro idem: window.alert na web, Alert.alert em nativo.
//
// Fix tz (25/06): fmtBR usava new Date("YYYY-MM-DD") que parseia como UTC
//   midnight e exibe o dia anterior no Brasil (UTC-3). Corrigido para parsear
//   a parte da data manualmente e construir Date em hora local.
// ============================================================
import React, { useEffect, useState } from "react";
import { Platform, View, Text, TouchableOpacity, Alert, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { Skeleton } from "@/components/karate/Skeleton";
import { CarteirinhaCard } from "@/components/karate/CarteirinhaCard";
import { karateCardApi, MembershipCard } from "@/services/karateCardApi";
import { karateApi } from "@/services/karateApi";

interface CarteirinhaPanelProps {
  federationId: string;
  practitionerId: string;
}

// Feedback simples cross-plataforma. Na web o Alert.alert do RN só mostra o
// título (sem corpo, sem botões com callback), então usamos window.alert.
function notify(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// Confirmação cross-plataforma. Na web o Alert.alert com botões é um no-op
// (o onPress nunca dispara) → usamos window.confirm. Em nativo, Alert.alert.
function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      { text: confirmLabel, onPress: onConfirm },
    ]);
  }
}

export function CarteirinhaPanel({ federationId, practitionerId }: CarteirinhaPanelProps) {
  const [card, setCard] = useState<MembershipCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");

  const fetchCard = () => {
    let alive = true;
    setLoading(true);
    karateCardApi
      .getCard(federationId, practitionerId)
      .then((c) => { if (alive) setCard(c); })
      .catch(() => { if (alive) setCard(null); }) // 404 = sem carteirinha
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  };

  useEffect(() => {
    return fetchCard();
  }, [federationId, practitionerId]);

  const doIssue = async () => {
    setIssuing(true);
    try {
      const res = await karateCardApi.issueCard(federationId, practitionerId);
      setCard(res);
      setFace("front");
      const warns = res.warnings || [];
      notify(
        res.renewed ? "Carteirinha renovada" : "Carteirinha emitida",
        warns.length ? `Atenção:\n• ${warns.join("\n• ")}` : "Processada com sucesso."
      );
    } catch (e: any) {
      notify("Não foi possível emitir", e?.message || "Tente novamente.");
    } finally {
      setIssuing(false);
    }
  };

  const confirmIssue = () => {
    const renew = !!card && card.status !== "revoked";
    confirm(
      renew ? "Renovar carteirinha?" : "Emitir carteirinha?",
      renew
        ? "A carteirinha atual será substituída por uma nova (a anterior é arquivada)."
        : "Será gerada a carteirinha digital do praticante a partir dos dados atuais.",
      renew ? "Renovar" : "Emitir",
      doIssue
    );
  };

  const doRevoke = async () => {
    setRevoking(true);
    try {
      await karateApi.revokeCard(federationId, practitionerId);
      // refetch para refletir o novo status (chip vira "Revogada")
      fetchCard();
      notify("Carteirinha revogada", "A carteirinha foi revogada. Use “Emitir” para gerar uma nova.");
    } catch (e: any) {
      notify("Não foi possível revogar", e?.message || "Tente novamente.");
    } finally {
      setRevoking(false);
    }
  };

  const confirmRevoke = () => {
    confirm(
      "Revogar carteirinha?",
      "A carteirinha ativa será marcada como revogada. Esta ação é registrada. Você pode emitir uma nova depois.",
      "Revogar",
      doRevoke
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
        <View style={styles.actions}>
          <KarateButton
            label={issuing ? "Emitindo…" : "Emitir carteirinha"}
            variant="sumi"
            loading={issuing}
            onPress={confirmIssue}
          />
        </View>
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
          <Icon name="calendar-outline" size={13} color={KarateColors.ink3} />
          <Text style={styles.metaTxt}>Emitida em {fmtBR(card.issued_at)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="qr-code-outline" size={13} color={KarateColors.ink3} />
          <Text style={styles.metaTxt} numberOfLines={1} selectable>
            app.getaura.com.br/karate/verify/{card.verify_token}
          </Text>
        </View>
      </View>

      {/* ações */}
      <View style={styles.actions}>
        {revoked ? (
          // Após revogar, "Emitir" gera uma nova carteirinha.
          <KarateButton
            label={issuing ? "Emitindo…" : "Emitir carteirinha"}
            variant="sumi"
            loading={issuing}
            onPress={confirmIssue}
          />
        ) : (
          <>
            {/* Revogar — destrutivo (vermelho) */}
            <TouchableOpacity
              onPress={confirmRevoke}
              disabled={revoking}
              style={[styles.revokeBtn, revoking && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Revogar carteirinha"
            >
              <Icon name="x" size={15} color={KarateColors.primary} />
              <Text style={styles.revokeTxt}>{revoking ? "Revogando…" : "Revogar"}</Text>
            </TouchableOpacity>
            <KarateButton
              label={issuing ? "Renovando…" : "Renovar carteirinha"}
              variant="secondary"
              loading={issuing}
              onPress={confirmIssue}
            />
          </>
        )}
      </View>
    </View>
  );
}

// tz-safe date formatter.
//
// new Date("YYYY-MM-DD") is parsed as UTC midnight per the ES spec. In Brazil
// (UTC-3) that shifts the display to the previous calendar day. Instead we
// detect date-only strings and construct the Date in LOCAL time so the date
// shown always matches the calendar date stored in the database.
function fmtBR(iso?: string | null): string {
  if (!iso) return "—";
  // Detect date-only ISO string (YYYY-MM-DD), possibly with time suffix.
  const datePart = iso.split("T")[0];
  const parts = datePart.split("-");
  let d: Date;
  if (parts.length === 3) {
    // Parse as local time to avoid UTC-midnight off-by-one in UTC-3 (Brazil).
    const [y, m, day] = parts.map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const styles = StyleSheet.create({
  tab:        { padding: 16, gap: 14 } as ViewStyle,
  // Ações em tamanho normal, alinhadas à direita (padrão de ação da aba).
  actions:    { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 8 } as ViewStyle,
  // Revogar — botão destrutivo (vermelho/primary).
  revokeBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: KarateColors.primarySoft, borderWidth: 1, borderColor: KarateColors.primaryLine } as ViewStyle,
  revokeTxt:  { fontSize: 13.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
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
