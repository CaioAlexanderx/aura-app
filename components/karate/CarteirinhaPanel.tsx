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
//
// Exportar PDF (Fase 3, 05/07): botão "Exportar PDF" ao lado de Emitir/Renovar,
//   visível sempre que há carteirinha emitida (ativa OU revogada). Reutiliza
//   EXATAMENTE o mecanismo de components/karate/carteirinha/CarteirinhaBatchTab.tsx
//   (buildCarteirinhaHtml → Blob → URL.createObjectURL → window.open, com
//   fallback document.write se o popup for bloqueado). O HTML já traz o botão
//   "Imprimir"; o usuário salva como PDF pelo diálogo de impressão do
//   navegador — sem libs pesadas. Web-only (window/Blob); em nativo, toast.
// ============================================================
import React, { useEffect, useState } from "react";
import { Platform, View, Text, TouchableOpacity, Alert, Modal, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateButton } from "@/components/karate/KarateButton";
import { notify } from "@/utils/webAlert";
import { toast } from "@/components/Toast";
import { buildCarteirinhaHtml } from "@/components/karate/carteirinha/buildCarteirinhaHtml";
import { Skeleton } from "@/components/karate/Skeleton";
import { CarteirinhaCard } from "@/components/karate/CarteirinhaCard";
import { karateCardApi, MembershipCard } from "@/services/karateCardApi";
import { karateApi } from "@/services/karateApi";

interface CarteirinhaPanelProps {
  federationId: string;
  practitionerId: string;
}


export function CarteirinhaPanel({ federationId, practitionerId }: CarteirinhaPanelProps) {
  const [card, setCard] = useState<MembershipCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [face, setFace] = useState<"front" | "back">("front");
  // Confirmação inline (modal in-app) — evita window.confirm, que trava a aba no web.
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) =>
    setConfirmDialog({ title, message, confirmLabel, onConfirm });

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
      // Fix campos brancos (25/06): a resposta do POST /issue-card já vem com
      // birth_date/cpf/federation_logo (backend corrigido), mas refazemos o
      // fetch para garantir paridade total com o shape do GET .../card —
      // evita qualquer campo divergente sem precisar trocar de aba.
      fetchCard();
    } catch (e: any) {
      notify("Não foi possível emitir", e?.message || "Tente novamente.");
    } finally {
      setIssuing(false);
    }
  };

  const confirmIssue = () => {
    const renew = !!card && card.status !== "revoked";
    askConfirm(
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
    askConfirm(
      "Revogar carteirinha?",
      "A carteirinha ativa será marcada como revogada. Esta ação é registrada. Você pode emitir uma nova depois.",
      "Revogar",
      doRevoke
    );
  };

  // Exportar PDF — reutiliza o MESMO mecanismo do CarteirinhaBatchTab (F5):
  // gera o HTML de impressão (buildCarteirinhaHtml) para um único card e abre
  // numa nova janela via Blob URL, com fallback document.write se o popup for
  // bloqueado. O HTML já traz o botão "Imprimir" + @media print; o usuário
  // salva como PDF pelo diálogo de impressão do navegador. Recurso web-only
  // (window.open/Blob não existem em nativo) — em nativo, avisa via toast.
  const exportPdf = () => {
    if (Platform.OS !== "web") {
      toast.error("Exportação em PDF disponível apenas na versão web");
      return;
    }
    if (!card) return;
    setExporting(true);
    try {
      const html = buildCarteirinhaHtml([card]);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success("Carteirinha aberta para exportação em PDF");
    } catch (err) {
      console.error("[CarteirinhaPanel] Erro ao exportar PDF:", err);
      toast.error("Erro ao gerar PDF da carteirinha");
    } finally {
      setExporting(false);
    }
  };

  // Modal de confirmação — precisa ser renderizado em TODOS os caminhos de
  // return (inclusive no estado vazio !card, onde fica o botão "Emitir").
  // Fix (10/07): antes o <Modal> só existia no return "com carteirinha";
  // no estado vazio, clicar "Emitir" setava o confirmDialog mas nada era
  // renderizado — nenhuma confirmação, nenhum POST /issue-card, nenhum
  // feedback. Extraído para constante e incluído nos dois returns.
  const confirmModal = (
    <Modal transparent visible={!!confirmDialog} animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
      <View style={{ flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 380, backgroundColor: "#fdf8f2", borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: KarateColors.ink, marginBottom: 8 }}>{confirmDialog?.title}</Text>
          <Text style={{ fontSize: 13, color: KarateColors.ink3, lineHeight: 19, marginBottom: 16 }}>{confirmDialog?.message}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setConfirmDialog(null)} style={{ flex: 1 }} />
            <KarateButton
              label={confirmDialog?.confirmLabel || "Confirmar"}
              variant="primary"
              size="md"
              onPress={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb && cb(); }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

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
          subtitle="Emita a carteirinha digital do praticante. Depois de emitida, os dados (faixa, dojô, matrícula) se atualizam automaticamente sempre que a ficha muda."
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
        {confirmModal}
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
        {/* Exportar PDF — disponível sempre que há carteirinha emitida
            (ativa ou revogada), independente do gate de emitir/renovar. */}
        <TouchableOpacity
          onPress={exportPdf}
          disabled={exporting}
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Exportar PDF da carteirinha"
        >
          <Icon name="download" size={15} color={KarateColors.ink2} />
          <Text style={styles.exportTxt}>{exporting ? "Exportando…" : "Exportar PDF"}</Text>
        </TouchableOpacity>
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

      {confirmModal}
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
  // Exportar PDF — ação neutra (outline discreto), mesmo padrão visual do
  // botão "Revogar" mas em tom neutro (não destrutivo/não vermelhão).
  exportBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  exportTxt:  { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
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
