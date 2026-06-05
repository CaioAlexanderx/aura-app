// ============================================================
// AURA STUDIO · PDV — modal de orçamento (Fase 6).
// Gera PDF imprimível (openQuotePdf, client-side, sem backend) + wa.me
// opcional. NÃO fecha venda. Disponível em todos os planos.
//
// 05/06/2026: linhas usam o preço de venda efetivo (lineSalePrice) pra
// refletir o lápis do caixa e bater com o subtotal exibido.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { openQuotePdf, type QuoteItem } from "@/utils/quotePdf";
import { maskPhone } from "@/utils/masks";
import { toast } from "@/components/Toast";
import type { CartLine } from "./types";
import { lineSalePrice } from "./checkoutMath";
import { FInput, money } from "./ui";
import { Ic } from "./icons";

export function QuoteModal({
  t, cart, subtotal, count, company, operatorName, onClose,
}: {
  t: StudioPalette; cart: CartLine[]; subtotal: number; count: number;
  company: any; operatorName: string; onClose: () => void;
}) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [validity, setValidity] = useState(7);
  const [sending, setSending] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [doneOk, setDoneOk] = useState(false);

  function generate() {
    if (cart.length === 0) { toast.info("Adicione itens antes de gerar orçamento"); return; }
    setSending(true);
    try {
      const items: QuoteItem[] = cart.map((l) => ({ name: l.product.name, qty: l.qty, unitPrice: lineSalePrice(l) }));
      const profile = company?.profile || {};
      const companyName = company?.trade_name || company?.legal_name || company?.name || "Estúdio";
      openQuotePdf({
        items, customerName: customer.trim() || null, sellerName: operatorName || null, total: subtotal,
        companyName, companyLogoUrl: profile.logo_url || null, companyPhone: profile.phone || null,
        companyAddress: profile.address || null, validityDays: Number(validity) || 7,
      });
      let wa: string | null = null;
      if (phone.trim()) {
        const digits = phone.replace(/\D/g, "");
        const ph = digits.startsWith("55") ? digits : "55" + digits;
        const first = customer.trim().split(" ")[0] || "tudo bem";
        const msg = encodeURIComponent(
          `Oi ${first}! Aqui vai o orçamento — R$ ${subtotal.toFixed(2)} (${count} ${count === 1 ? "item" : "itens"}). ` +
          `Válido por ${validity} ${validity === 1 ? "dia" : "dias"}. Acabei de te mandar o PDF!`
        );
        wa = `https://wa.me/${ph}?text=${msg}`;
      }
      setWaLink(wa); setDoneOk(true);
      toast.success("Orçamento gerado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar orçamento");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[{ flex: 1, backgroundColor: "rgba(2,6,23,0.6)", alignItems: "center", justifyContent: "center", padding: 16 }, Platform.OS === "web" ? ({ position: "fixed", inset: 0, zIndex: 1100 } as any) : ({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any)]}>
      <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
      <View style={{ width: "100%", maxWidth: 460, backgroundColor: t.paperCardElev, borderRadius: 16, borderWidth: 1, borderColor: t.ink5, padding: 20, gap: 12, ...(Platform.OS === "web" ? ({ boxShadow: "0 24px 60px -18px rgba(2,6,23,0.7)" } as any) : {}) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ic name="file_text" size={18} color={t.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: t.ink3, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>Studio · PDV</Text>
            <Text style={{ fontSize: 17, color: t.ink, fontWeight: "800" }}>Gerar orçamento</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 4 }}><Ic name="x" size={20} color={t.ink3} /></Pressable>
        </View>

        {!doneOk ? (
          <>
            <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 17 }}>PDF imprimível com os itens, sem fechar a venda. Tudo opcional.</Text>
            <FInput t={t} value={customer} onChangeText={setCustomer} placeholder="Nome do cliente (opcional)" />
            <FInput t={t} value={phone} onChangeText={(v) => setPhone(maskPhone(v))} placeholder="WhatsApp (opcional)" keyboardType="phone-pad" />
            <View>
              <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Validade</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {[3, 7, 15, 30].map((d) => {
                  const active = validity === d;
                  return (
                    <Pressable key={d} onPress={() => setValidity(d)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? t.primarySoft : t.bgSoft, borderWidth: 1, borderColor: active ? t.primary : t.ink5, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? t.primary : t.ink2 }}>{d} {d === 1 ? "dia" : "dias"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: t.bgSoft, borderRadius: 10, borderWidth: 1, borderColor: t.ink5, padding: 12, marginTop: 2 }}>
              <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>{count} {count === 1 ? "item" : "itens"} · total</Text>
              <Text style={{ fontSize: 19, color: t.primary, fontWeight: "800" }}>R$ {money(subtotal)}</Text>
            </View>
            <Pressable onPress={generate} disabled={sending} style={{ paddingVertical: 13, borderRadius: 11, backgroundColor: t.accent, alignItems: "center", opacity: sending ? 0.6 : 1, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{sending ? "Gerando…" : "Gerar PDF"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ backgroundColor: t.successSoft, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: t.success, gap: 4 }}>
              <Text style={{ fontSize: 13, color: t.success, fontWeight: "800" }}>Orçamento gerado!</Text>
              <Text style={{ fontSize: 11.5, color: t.ink2, lineHeight: 16 }}>Uma janela com o PDF foi aberta — imprima ou salve em PDF pelo navegador.</Text>
            </View>
            {waLink && Platform.OS === "web" && (
              <Pressable onPress={() => { if (typeof window !== "undefined") window.open(waLink, "_blank"); }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", paddingVertical: 12, borderRadius: 11, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
                <Ic name="whatsapp" size={17} color="#fff" /><Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Abrir WhatsApp do cliente</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setDoneOk(false)} style={{ paddingVertical: 12, borderRadius: 11, borderWidth: 1.5, borderColor: t.accentInk, alignItems: "center", ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
              <Text style={{ color: t.accentInk, fontSize: 13, fontWeight: "800" }}>Reimprimir</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ paddingVertical: 12, borderRadius: 11, backgroundColor: t.primary, alignItems: "center", ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}) }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Fechar</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
