// ============================================================
// CarteirinhaCard — Aura Karatê (DESIGN-14, aprovado 08/06)
//
// Renderiza o "cartão" (frente/verso) a partir dos DADOS da carteirinha
// (GET .../card). DATA-ONLY: o backend não gera imagem; a arte é toda aqui.
//
// Porte fiel do mock (card.jsx, 1012×638). Mede a largura disponível e
// aplica um fator de escala sc = W/1012 a todas as medidas, preservando as
// proporções do mock aprovado em qualquer largura (phone/web).
//
// Decisões Caio (08/06): QR codifica app.getaura.com.br/karate/verify/<token>
// (nº de registro vira legenda); carteirinha SEM validade por tempo (sem
// frase de validade); Dojo Kun mantém "Criar intuito de esforço".
// ============================================================
import React, { useState } from "react";
import { View, Text, Image, LayoutChangeEvent, ViewStyle } from "react-native";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { KarateFonts } from "@/constants/karateTheme";
import { MembershipCard } from "@/services/karateCardApi";

const CARD_W = 1012;
const CARD_H = 638;
const RATIO = CARD_H / CARD_W; // 0.6304
const ACCENT = "#D4121B";

const DOJO_KUN = [
  "Esforçar-se para a formação do caráter",
  "Criar intuito de esforço",
  "Respeitar acima de tudo",
  "Conter o espírito de agressão",
  "Fidelidade para com o verdadeiro caminho da razão",
];

/**
 * Formata uma string de data para pt-BR.
 *
 * Strings date-only "YYYY-MM-DD" são tratadas como data LOCAL (split em "-")
 * para evitar o off-by-one causado por `new Date("YYYY-MM-DD")`, que é
 * interpretado como UTC midnight e cai no dia anterior em UTC-3 (Brasil).
 *
 * Strings com hora (ISO 8601 completo, ex.: "2024-06-01T12:00:00Z") passam
 * direto para `new Date()` — o horário já ancora o dia correto.
 */
function fmtBR(iso?: string | null): string {
  if (!iso) return "—";
  let d: Date;
  // Detecta strings date-only: exatamente "YYYY-MM-DD" (10 chars, sem 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface CarteirinhaCardProps {
  card: MembershipCard;
  face: "front" | "back";
  /** Largura máxima do cartão (web não fica gigante). */
  maxWidth?: number;
}

export function CarteirinhaCard({ card, face, maxWidth = 520 }: CarteirinhaCardProps) {
  const [w, setW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const avail = Math.min(e.nativeEvent.layout.width, maxWidth);
    if (avail && Math.abs(avail - w) > 0.5) setW(avail);
  };

  const sc = w / CARD_W;
  const f = (n: number) => n * sc;
  const H = w * RATIO;

  const verifyUrl = `https://app.getaura.com.br/karate/verify/${card.verify_token}`;

  return (
    <View onLayout={onLayout} style={{ width: "100%", alignItems: "center" }}>
      {w > 0 ? (
        <View
          style={{
            width: w, height: H, backgroundColor: "#fcfcfd", borderRadius: f(26),
            overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)",
          }}
        >
          {face === "front" ? <Front card={card} f={f} H={H} /> : <Back card={card} f={f} H={H} verifyUrl={verifyUrl} />}
        </View>
      ) : (
        <View style={{ width: "100%", aspectRatio: 1 / RATIO, borderRadius: 16, backgroundColor: "#fcfcfd", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" }} />
      )}
    </View>
  );
}

// ── Watermark — pirâmide FPKT esmaecida (segurança/identidade) ──
function Watermark({ f, size, x, y, opacity }: { f: (n: number) => number; size: number; x: number; y: number; opacity: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: f(x), top: f(y), opacity }}>
      <FpktLogo size={f(size)} style={{ tintColor: "#111" }} />
    </View>
  );
}

function Field({ label, value, f, mono, big, accent }: { label: string; value?: string | null; f: (n: number) => number; mono?: boolean; big?: boolean; accent?: boolean }) {
  return (
    <View style={{ marginBottom: f(4) }}>
      <Text style={{ fontSize: f(13), fontWeight: "700", letterSpacing: f(1.4), textTransform: "uppercase", color: "#8a8a8a", marginBottom: f(3) }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: big ? f(31) : f(25), fontWeight: big ? "800" : "600",
          color: accent ? ACCENT : "#161616",
          fontFamily: mono ? "monospace" : undefined,
        }}
      >{value || "—"}</Text>
    </View>
  );
}

function Front({ card, f, H }: { card: MembershipCard; f: (n: number) => number; H: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Watermark f={f} size={560} x={470} y={140} opacity={0.045} />
      {/* header */}
      <View style={{ height: f(124), paddingHorizontal: f(40), flexDirection: "row", alignItems: "center", gap: f(22), borderBottomWidth: f(5), borderBottomColor: ACCENT, backgroundColor: "#fff" }}>
        <FpktLogo size={f(88)} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: f(13.5), fontWeight: "700", letterSpacing: f(2.4), color: ACCENT, textTransform: "uppercase" }}>Federação Paulista de</Text>
          <Text style={{ fontSize: f(29), fontWeight: "800", color: "#141414", textTransform: "uppercase" }} numberOfLines={1}>Karatê-Dô Tradicional</Text>
        </View>
        <View style={{ alignItems: "flex-end", paddingLeft: f(18), borderLeftWidth: 1, borderLeftColor: "rgba(17,17,17,0.10)" }}>
          <Text style={{ fontFamily: KarateFonts.serif, fontSize: f(24), color: "#161616" }}>Carteira</Text>
          <Text style={{ fontSize: f(11), fontWeight: "700", letterSpacing: f(2), color: "#9a9a9a", textTransform: "uppercase", marginTop: f(3) }}>do Atleta</Text>
        </View>
      </View>

      {/* body */}
      <View style={{ flex: 1, paddingHorizontal: f(40), paddingTop: f(28) }}>
        {/* photo + fields */}
        <View style={{ flex: 1, flexDirection: "row", gap: f(40) }}>
          <View style={{ width: f(252), height: f(332) }}>
            {card.photo_url ? (
              <Image source={{ uri: card.photo_url }} style={{ width: f(252), height: f(332), borderRadius: f(10), borderWidth: 1, borderColor: "rgba(17,17,17,0.14)" }} resizeMode="cover" />
            ) : (
              <View style={{ width: f(252), height: f(332), borderRadius: f(10), borderWidth: 1, borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#f2f2f4", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: f(15), color: "#aaa" }}>Foto do atleta</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, justifyContent: "center", gap: f(20) }}>
            <Field label="Nome" value={card.student_name} f={f} />
            <View style={{ flexDirection: "row", gap: f(36) }}>
              <View style={{ flex: 1 }}><Field label="Data de nascimento" value={fmtBR(card.birth_date)} f={f} mono /></View>
              <View style={{ flex: 1 }}><Field label="Dojô" value={card.dojo_name} f={f} /></View>
            </View>
            <View style={{ flexDirection: "row", gap: f(36), alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}><Field label="Nº de registro FPKT" value={card.card_number} f={f} mono big accent /></View>
              <View style={{ flex: 1 }}><Field label="CPF" value={card.cpf} f={f} mono /></View>
            </View>
          </View>
        </View>

        {/* signature band */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: f(36), paddingTop: f(10), paddingBottom: f(28) }}>
          <View style={{ width: f(252) }}>
            <View style={{ height: f(26) }} />
            <View style={{ borderTopWidth: 1.5, borderTopColor: "#2a2a2a", paddingTop: f(8), alignItems: "center" }}>
              <Text style={{ fontSize: f(13.5), fontWeight: "700", letterSpacing: f(1.6), color: "#444", textTransform: "uppercase" }}>Presidente</Text>
            </View>
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: f(10) }}>
            <View style={{ width: f(7), height: f(7), borderRadius: f(4), backgroundColor: ACCENT }} />
            <Text style={{ fontSize: f(12), fontWeight: "600", letterSpacing: f(0.6), color: "#9a9a9a", textTransform: "uppercase", textAlign: "right", maxWidth: f(280) }}>
              Documento válido em todo o território da federação · F.P.K.T.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Back({ card, f, H, verifyUrl }: { card: MembershipCard; f: (n: number) => number; H: number; verifyUrl: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Watermark f={f} size={520} x={150} y={250} opacity={0.035} />
      {/* header */}
      <View style={{ height: f(104), paddingHorizontal: f(40), flexDirection: "row", alignItems: "center", gap: f(18), borderBottomWidth: f(5), borderBottomColor: ACCENT, backgroundColor: "#fff" }}>
        <FpktLogo size={f(66)} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: f(11.5), fontWeight: "700", letterSpacing: f(2.2), color: ACCENT, textTransform: "uppercase" }}>Federação Paulista de</Text>
          <Text style={{ fontSize: f(21), fontWeight: "800", color: "#141414", textTransform: "uppercase" }} numberOfLines={1}>Karatê-Dô Tradicional</Text>
        </View>
        <Text style={{ fontSize: f(11), fontWeight: "700", letterSpacing: f(2), color: "#bdbdbd", textTransform: "uppercase" }}>Verso</Text>
      </View>

      {/* two halves */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* left — Dojo Kun */}
        <View style={{ flex: 1, paddingVertical: f(26), paddingLeft: f(40), paddingRight: f(30), borderRightWidth: 1, borderRightColor: "rgba(17,17,17,0.10)" }}>
          <Text style={{ fontSize: f(12), fontWeight: "700", letterSpacing: f(2.2), color: ACCENT, textTransform: "uppercase" }}>Lema do Karatê</Text>
          <Text style={{ fontFamily: KarateFonts.serif, fontSize: f(22), color: "#141414", marginTop: f(2) }}>Dojo Kun · os cinco princípios</Text>
          <View style={{ flex: 1, justifyContent: "center", marginTop: f(14) }}>
            {DOJO_KUN.map((line, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: f(13), paddingBottom: f(10), borderBottomWidth: i < DOJO_KUN.length - 1 ? 1 : 0, borderBottomColor: "rgba(17,17,17,0.07)" }}>
                <View style={{ width: f(7), height: f(7), borderRadius: f(4), backgroundColor: ACCENT, marginTop: f(6) }} />
                <Text style={{ flex: 1, fontSize: f(15.5), fontWeight: "500", color: "#1f1f1f" }}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* right — QR + emissão */}
        <View style={{ flex: 1, paddingVertical: f(26), paddingHorizontal: f(36), alignItems: "center" }}>
          <Text style={{ fontSize: f(12), fontWeight: "700", letterSpacing: f(2.2), color: "#9a9a9a", textTransform: "uppercase" }}>Identificação</Text>
          <Text style={{ fontFamily: KarateFonts.serif, fontSize: f(22), color: "#141414", marginTop: f(2) }}>Validação do atleta</Text>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <PixQRCode payload={verifyUrl} size={Math.max(64, Math.round(f(176)))} />
            <Text style={{ fontSize: f(16), color: "#161616", fontFamily: "monospace", marginTop: f(12) }}>{card.card_number || "—"}</Text>
            <Text style={{ fontSize: f(11), color: "#9a9a9a", fontFamily: "monospace", marginTop: f(2) }}>app.getaura.com.br/karate/verify</Text>
          </View>
          <View style={{ paddingTop: f(12), borderTopWidth: 1, borderTopColor: "rgba(17,17,17,0.10)", alignItems: "center", alignSelf: "stretch" }}>
            <Text style={{ fontSize: f(11.5), fontWeight: "700", letterSpacing: f(1.4), color: "#9a9a9a", textTransform: "uppercase" }}>Data de emissão</Text>
            <Text style={{ fontSize: f(18), color: "#161616", fontFamily: "monospace", marginTop: f(4) }}>{fmtBR(card.issued_at)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
