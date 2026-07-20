// ============================================================
// AURA STUDIO · PDV — sucesso pós-venda (Fase 6).
//
// 20/07/2026 — paridade fiscal com o Negócio (SaleComplete):
//   - Botão "Imprimir cupom" (comprovante NÃO-fiscal) via openPrintWindow
//     → GET /companies/:id/print/receipt/:saleId/preview (web only).
//   - <NfceActions/> reutilizado do PDV Negócio p/ emitir NFC-e — só
//     aparece quando a empresa tem fiscal ativo (done.fiscal_enabled).
//     autoEmit segue nfce_config.auto_emit_nfce (done.auto_emit).
// ============================================================
import { View, Text, Pressable, Platform, ScrollView } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { openPrintWindow } from "@/services/printWindow";
import { toast } from "@/components/Toast";
import { NfceActions, type NfceActionsItem } from "@/components/screens/pdv/NfceActions";
import type { SaleDone } from "./types";
import { money } from "./ui";
import { Ic } from "./icons";

// Comprovante NÃO-fiscal — HTML térmico servido pelo backend, aberto numa
// janela síncrona (printWindow) pra não perder a user activation do clique.
function openPrintReceipt(companyId: string, saleId: string, token: string | null) {
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressão disponível apenas na versão web");
    return;
  }
  openPrintWindow(async () => {
    const res = await fetch(`${BASE_URL}/companies/${companyId}/print/receipt/${saleId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false as const, error: "Erro ao gerar cupom" };
    return { ok: true as const, html: await res.text() };
  }).then((r) => {
    if (r === "blocked") toast.error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  });
}

export function StageDone({ t, done, onNewSale }: { t: StudioPalette; done: SaleDone; onNewSale: () => void }) {
  const { company, token } = useAuthStore();
  const companyId = (company as any)?.id as string | undefined;
  const nfceItems: NfceActionsItem[] = done.items || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ alignItems: "center", justifyContent: "center", padding: 24, minHeight: "100%" }}
    >
      <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: t.success, alignItems: "center", justifyContent: "center" }}>
        <Ic name="check" size={38} color="#fff" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 16 }}>Venda registrada!</Text>
      <Text style={{ fontSize: 13, color: t.ink3, marginTop: 6, textAlign: "center", maxWidth: 360 }}>
        O pedido entrou em “Aguardando arte” no Fluxo de Produção automaticamente.
      </Text>

      <View style={{ backgroundColor: t.paperCardElev, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: t.ink5, alignItems: "center", gap: 6, minWidth: 280, marginTop: 18 }}>
        <Text style={{ fontSize: 11, color: t.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</Text>
        <Text style={{ fontSize: 28, color: t.primary, fontWeight: "800" }}>R$ {money(done.total)}</Text>
      </View>

      {/* ── Fiscal: comprovante não-fiscal + NFC-e (paridade Negócio) ── */}
      <View style={{ width: "100%", maxWidth: 420, marginTop: 18, gap: 12 }}>
        {Platform.OS === "web" && companyId && (
          <Pressable
            onPress={() => openPrintReceipt(companyId, done.sale_id, token)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, paddingVertical: 13, borderRadius: 12, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
          >
            <Ic name="receipt" size={17} color={t.ink} />
            <Text style={{ color: t.ink, fontSize: 14, fontWeight: "800" }}>Imprimir cupom</Text>
          </Pressable>
        )}

        {done.fiscal_enabled && companyId ? (
          <NfceActions
            companyId={companyId}
            saleId={done.sale_id}
            items={nfceItems}
            total={done.total}
            customerName={done.customer_name}
            customerCpf={done.customer_cpf}
            customerPhone={done.customer_phone}
            paymentMethod={done.payment_method}
            payments={done.payments}
            autoEmit={done.auto_emit}
          />
        ) : null}
      </View>

      {done.wa_link && Platform.OS === "web" && (
        <Pressable
          onPress={() => { if (typeof window !== "undefined") window.open(done.wa_link!, "_blank"); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#25D366", paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12, marginTop: 18, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}
        >
          <Ic name="whatsapp" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Mandar WhatsApp pro cliente</Text>
        </Pressable>
      )}
      <Pressable onPress={onNewSale} style={{ backgroundColor: t.primary, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12, marginTop: 12, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>+ Nova venda</Text>
      </Pressable>
    </ScrollView>
  );
}
