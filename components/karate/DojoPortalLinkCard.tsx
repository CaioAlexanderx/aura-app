// ============================================================
// DojoPortalLinkCard — ficha do dojô (federação) · Shoji
//
// F0 (Canal B): gestão do LINK FIXO do Portal do Dojô sem Aura.
// Consome karateDojoPortalAdminApi (services/karateDojoPortalApi.ts),
// contrato do Aura-backend #398:
//   GET    portal-link → { active, created_at, revoked_at }
//   POST   portal-link → { url, token, created_at }  ← URL exibida UMA vez
//   DELETE portal-link → revoga imediatamente
//
// Componente separado de app/karate/(federation)/dojos/[dojoId].tsx de
// propósito (o shell tem ~90 KB; edição lá é só o mount de 1 linha).
// Confirmações destrutivas via window.confirm — NUNCA Alert.alert com
// botões (no-op em RN-Web), padrão já usado no próprio [dojoId].tsx.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R, KarateSpacing as SP } from "@/constants/karateTheme";
import { Card, SectionHead, ShojiButton, Body } from "@/components/karate/shoji";
import { copyToClipboard } from "@/utils/clipboard";
import {
  karateDojoPortalAdminApi,
  DojoPortalLinkStatus,
  DojoPortalLinkCreated,
} from "@/services/karateDojoPortalApi";

// Formata ISO (com ou sem hora) como dd/mm/aaaa — parse manual tz-safe,
// nunca new Date('YYYY-MM-DD') direto (bug conhecido de -1 dia).
function fmtData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function confirmar(msg: string): boolean {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(msg);
  }
  return true;
}

export default function DojoPortalLinkCard({
  federationId,
  dojoId,
}: {
  federationId: string;
  dojoId: string;
}) {
  const [status, setStatus] = useState<DojoPortalLinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<DojoPortalLinkCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    karateDojoPortalAdminApi.getPortalLink(federationId, dojoId)
      .then((st) => { setStatus(st); setError(null); })
      .catch(() => setError("Não foi possível carregar o estado do link."))
      .finally(() => setLoading(false));
  }, [federationId, dojoId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    if (status?.active && !confirmar(
      "Gerar um novo link faz o link anterior deixar de funcionar imediatamente. O dojô precisará receber o link novo. Continuar?"
    )) return;
    setBusy(true);
    setError(null);
    try {
      const res = await karateDojoPortalAdminApi.createPortalLink(federationId, dojoId);
      setFresh(res);
      setCopied(false);
      setStatus({ active: true, created_at: res.created_at, revoked_at: null });
    } catch {
      setError("Não foi possível gerar o link agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [busy, status, federationId, dojoId]);

  const handleRevoke = useCallback(async () => {
    if (busy) return;
    if (!confirmar("Revogar o link do portal? O dojô perde o acesso imediatamente.")) return;
    setBusy(true);
    setError(null);
    try {
      await karateDojoPortalAdminApi.revokePortalLink(federationId, dojoId);
      setFresh(null);
      setCopied(false);
      load();
    } catch {
      setError("Não foi possível revogar o link agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [busy, federationId, dojoId, load]);

  const handleCopy = useCallback(async () => {
    if (!fresh) return;
    const ok = await copyToClipboard(fresh.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [fresh]);

  const active = !!status?.active;
  const desde = fmtData(status?.created_at);

  return (
    <Card style={{ marginTop: SP[6] }}>
      <SectionHead
        title="Portal do dojô (sem Aura)"
        sub="Link fixo de acesso ao portal do dojô — enviado ao sensei por WhatsApp ou e-mail"
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.primary} /></View>
      ) : (
        <View style={styles.body}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: active ? C.ok : C.neutral }]} />
            <Body>
              {active
                ? `Link ativo${desde ? ` desde ${desde}` : ""}`
                : "Nenhum link ativo"}
            </Body>
          </View>

          {fresh ? (
            <View style={styles.freshBox}>
              <Text style={styles.freshUrl} selectable>{fresh.url}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel="Copiar link do portal"
              >
                <Icon name={copied ? "checkmark" : "copy-outline"} size={15} color={C.primary} />
                <Text style={styles.copyTxt}>{copied ? "Copiado" : "Copiar"}</Text>
              </TouchableOpacity>
              <Text style={styles.freshWarn}>
                Guarde este link agora: por segurança ele não será mostrado de novo.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <ShojiButton
              label={busy ? "Aguarde…" : active ? "Gerar novo link" : "Gerar link"}
              icon="link-outline"
              variant="sumi"
              onPress={handleGenerate}
            />
            {active ? (
              <ShojiButton
                label="Revogar"
                icon="x"
                variant="ghost"
                onPress={handleRevoke}
              />
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 18, alignItems: "center" } as ViewStyle,
  body: { gap: 12, marginTop: 4 } as ViewStyle,
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  dot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  freshBox: {
    backgroundColor: C.glass2, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, padding: 14, gap: 10, alignItems: "flex-start",
  } as ViewStyle,
  freshUrl: { fontSize: 13, color: C.ink, lineHeight: 19 } as TextStyle,
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.primarySoft, borderRadius: R.sm,
    paddingVertical: 8, paddingHorizontal: 12,
  } as ViewStyle,
  copyTxt: { fontSize: 12, fontWeight: "700", color: C.primary } as TextStyle,
  freshWarn: { fontSize: 12, color: C.ink3, lineHeight: 17 } as TextStyle,
  error: { fontSize: 13, color: C.danger } as TextStyle,
  actions: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" } as ViewStyle,
});
