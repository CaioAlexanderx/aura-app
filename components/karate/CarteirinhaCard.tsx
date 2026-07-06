// ============================================================
// CarteirinhaCard — Aura Karatê (mock aprovado "Carteirinhas FPKT",
// design system Shoji/Kinari — papel de arroz, sumi, vermelhão hanko)
//
// Renderiza o "cartão" (frente/verso) a partir dos DADOS da carteirinha
// (GET .../card). DATA-ONLY: o backend não gera imagem; a arte é toda aqui.
//
// Porte fiel do mock aprovado (Carteirinhas FPKT.dc.html, cartão CR80
// 640×404px). Mede a largura disponível e aplica um fator de escala
// sc = W/640 a todas as medidas, preservando as proporções do mock em
// qualquer largura (phone/web). Razão do cartão: 404/640 = 0.63125.
//
// Dois designs, decididos pela faixa do atleta (resolveBeltKey):
//   - Design 01 (faixas coloridas): header direito "Carteira" / "do filiado";
//     SEM campo Faixa no corpo; sem barra preta.
//   - Design 02 (faixa-preta): header direito "Carteira" / badge quadrado
//     preto + "faixa-preta"; barra preta 8px full-bleed abaixo da régua
//     vermelha (frente e verso); corpo COM campo Faixa (quadrado preto +
//     "Preta · Nº Dan", via formatBeltLabel adaptado).
//
// Discrepância sinalizada (ver PR): o cliente pediu para remover a
// assinatura "Presidente", mas o mock APROVADO mantém essa linha no
// footer da frente. Seguimos o mock (fiel), registrando a nota no PR
// para confirmação do cliente.
//
// Decisões Caio (08/06, mantidas): QR codifica
// app.getaura.com.br/karate/verify/<token> (nº de registro vira legenda);
// carteirinha SEM validade por tempo (sem frase de validade); Dojo Kun
// mantém "Criar intuito de esforço".
// ============================================================
import React, { useState } from "react";
import { View, Text, Image, LayoutChangeEvent } from "react-native";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { KarateFonts, resolveBeltKey } from "@/constants/karateTheme";
import { MembershipCard } from "@/services/karateCardApi";

// Logo da carteirinha: usa a logo REAL da federação (card.federation_logo,
// vindo de companies.karate_logo_url/logo_url) quando disponível. Antes a
// carteirinha sempre renderizava o bitmap fixo da FPKT (FpktLogo),
// independente de qual federação emitiu o cartão — bug de "logo errada"
// reportado pela cliente (multi-federação).
function CardLogo({ card, size }: { card: MembershipCard; size: number }) {
  if (card.federation_logo) {
    return (
      <Image
        source={{ uri: card.federation_logo }}
        accessibilityLabel={card.federation_name || "Logo da federação"}
        style={{ width: size, height: Math.round(size * 0.95), resizeMode: "contain" }}
      />
    );
  }
  return <FpktLogo size={size} />;
}

// ── tokens do mock (colors.css) ──
const INK = "#2b2620";
const INK_2 = "#6a6154";
const INK_3 = "#9b9180";
const INK_4 = "#c1b8a7";
const RED = "#b8463a";
const LINE_2 = "rgba(43,38,32,0.17)";
const LINE = "rgba(43,38,32,0.10)";
const BLACK_BAR = "#141210";

const CARD_W = 640;
const CARD_H = 404;
const RATIO = CARD_H / CARD_W; // 0.63125

const DOJO_KUN = [
  "Esforçar-se para a formação do caráter",
  "Criar intuito de esforço",
  "Respeito acima de tudo",
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

/**
 * "Preta · Nº Dan" — adapta a saída de formatBeltLabel (ex.: "Preta 1º Dan")
 * para o formato do mock ("Preta · 1º Dan"). Se não houver grau explícito,
 * cai para "Preta · Dan".
 */
function beltDanLabel(belt?: string | null, beltName?: string | null): string {
  const raw = (beltName || belt || "Preta").trim();
  const m = raw.match(/(\d+\s*[ºo°]?\s*dan)/i);
  if (m) {
    const dan = m[1].replace(/\s+/g, " ").trim();
    return `Preta · ${dan.charAt(0).toUpperCase()}${dan.slice(1)}`;
  }
  if (/dan/i.test(raw)) return "Preta · Dan";
  return "Preta · Dan";
}

function isBeltPreta(belt?: string | null, beltName?: string | null): boolean {
  const key = resolveBeltKey(beltName || belt || "");
  return key === "preta";
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
  const isPreta = isBeltPreta(card.belt, card.belt_name);

  const verifyUrl = `https://app.getaura.com.br/karate/verify/${card.verify_token}`;

  return (
    <View onLayout={onLayout} style={{ width: "100%", alignItems: "center" }}>
      {w > 0 ? (
        <View
          style={{
            width: w, height: H, backgroundColor: "#ffffff", borderRadius: f(16),
            overflow: "hidden", borderWidth: 1, borderColor: LINE_2, position: "relative",
          }}
        >
          {face === "front" ? (
            <Front card={card} f={f} isPreta={isPreta} />
          ) : (
            <Back card={card} f={f} verifyUrl={verifyUrl} isPreta={isPreta} />
          )}
        </View>
      ) : (
        <View style={{ width: "100%", aspectRatio: 1 / RATIO, borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 1, borderColor: LINE_2 }} />
      )}
    </View>
  );
}

// ── Marca d'água — logo FPKT REAL (cor real, sem tintColor) ──
// Frente: right:-24, top:56%, translateY(-50%), width:290, opacity 0.06.
// Verso: centralizada (left/top:50%, translate -50%/-50%), width:260, opacity 0.05.
function Watermark({ f, side }: { f: (n: number) => number; side: "front" | "back" }) {
  if (side === "front") {
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute", right: f(-24), top: "56%", width: f(290), opacity: 0.06,
          transform: [{ translateY: -f(290) * 0.475 * 0.5 }],
        }}
      >
        <FpktLogo size={f(290)} />
      </View>
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", left: "50%", top: "56%", width: f(260), opacity: 0.05,
        transform: [{ translateX: -f(260) / 2 }, { translateY: -f(260) * 0.475 * 0.5 }],
      }}
    >
      <FpktLogo size={f(260)} />
    </View>
  );
}

// ── label mono uppercase pequeno (padrão dos campos) ──
function FieldLabel({ children, f, color = INK_3 }: { children: React.ReactNode; f: (n: number) => number; color?: string }) {
  return (
    <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(8.5), letterSpacing: f(1.4), textTransform: "uppercase", color }}>
      {children}
    </Text>
  );
}

function Field({ label, value, f, mono, marginTop = 6 }: { label: string; value?: string | null; f: (n: number) => number; mono?: boolean; marginTop?: number }) {
  return (
    <View>
      <FieldLabel f={f}>{label}</FieldLabel>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: mono ? KarateFonts.mono : KarateFonts.body,
          fontSize: f(15), fontWeight: mono ? "400" : "500",
          marginTop: f(marginTop), color: INK,
        }}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

function BeltField({ card, f }: { card: MembershipCard; f: (n: number) => number }) {
  const label = beltDanLabel(card.belt, card.belt_name);
  return (
    <View>
      <FieldLabel f={f}>Faixa</FieldLabel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: f(8), marginTop: f(6) }}>
        <View style={{ width: f(14), height: f(14), backgroundColor: BLACK_BAR, borderRadius: f(2) }} />
        <Text style={{ fontFamily: KarateFonts.body, fontSize: f(15), fontWeight: "600", color: INK }}>{label}</Text>
      </View>
    </View>
  );
}

// Nome da federação em 2 linhas (fiel ao mock: "Federação Paulista de" /
// "Karatê-dô Tradicional"). Quando card.federation_name vem preenchido
// (multi-federação), divide o nome real ao meio das palavras para manter
// o layout de 2 linhas; sem nome, usa o texto oficial FPKT como fallback.
function federationNameLines(name?: string | null): [string, string] {
  const fallback: [string, string] = ["Federação Paulista de", "Karatê-dô Tradicional"];
  if (!name || !name.trim()) return fallback;
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name.trim(), ""];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// ── header comum (frente + verso) ──
function HeaderLeft({ card, f, size }: { card: MembershipCard; f: (n: number) => number; size: number }) {
  const [line1, line2] = federationNameLines(card.federation_name);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: f(13) }}>
      <CardLogo card={card} size={f(size)} />
      <View>
        <Text style={{ fontFamily: KarateFonts.heading, fontSize: f(14), fontWeight: "500", letterSpacing: f(0.3), color: INK }}>
          {line1}
        </Text>
        {line2 ? (
          <Text style={{ fontFamily: KarateFonts.heading, fontSize: f(14), fontWeight: "500", letterSpacing: f(0.3), color: INK, marginTop: f(3) }}>
            {line2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Front({ card, f, isPreta }: { card: MembershipCard; f: (n: number) => number; isPreta: boolean }) {
  return (
    <View style={{ flex: 1, paddingTop: f(26), paddingBottom: f(22), paddingHorizontal: f(32) }}>
      <Watermark f={f} side="front" />

      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", minHeight: f(46) }}>
        <HeaderLeft card={card} f={f} size={40} />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: KarateFonts.heading, fontSize: f(16), color: INK_2, fontWeight: "400" }}>Carteira</Text>
          {isPreta ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: f(6), marginTop: f(5) }}>
              <View style={{ width: f(9), height: f(9), backgroundColor: BLACK_BAR }} />
              <Text style={{ fontSize: f(11), letterSpacing: f(1.4), textTransform: "uppercase", color: INK_2, fontWeight: "500" }}>faixa-preta</Text>
            </View>
          ) : (
            <Text style={{ fontSize: f(8), letterSpacing: f(1.44), textTransform: "uppercase", color: INK_3, marginTop: f(4) }}>do filiado</Text>
          )}
        </View>
      </View>

      {/* régua vermelha full-bleed */}
      <View style={{ marginTop: f(16), marginHorizontal: -f(32), height: f(2), backgroundColor: RED }} />
      {isPreta ? <View style={{ marginTop: f(11), marginHorizontal: -f(32), height: f(8), backgroundColor: BLACK_BAR }} /> : null}

      {/* body */}
      <View style={{ flexDirection: "row", gap: f(30), marginTop: f(18), flex: 1, alignItems: "flex-start" }}>
        <View
          style={{
            width: f(162), height: f(216), borderRadius: f(10), borderWidth: 1, borderColor: LINE_2,
            backgroundColor: "#faf8f3", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}
        >
          {card.photo_url ? (
            <Image source={{ uri: card.photo_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(10), letterSpacing: f(1.6), color: INK_4 }}>FOTO</Text>
              <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(9), letterSpacing: f(1.6), color: INK_4, marginTop: f(3) }}>3 × 4</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel f={f}>Nome</FieldLabel>
          <Text
            numberOfLines={1}
            style={{ fontFamily: KarateFonts.body, fontSize: f(21), fontWeight: "600", marginTop: f(5), color: INK }}
          >
            {card.student_name}
          </Text>

          {isPreta ? (
            // Design 02: grid 2x2 [Data nasc · Dojô / Faixa · CPF] + registro abaixo, full width
            <View style={{ marginTop: f(16), gap: f(16) }}>
              <View style={{ flexDirection: "row", gap: f(22) }}>
                <View style={{ flex: 1 }}><Field label="Data de nascimento" value={fmtBR(card.birth_date)} f={f} mono /></View>
                <View style={{ flex: 1 }}><Field label="Dojô" value={card.dojo_name} f={f} /></View>
              </View>
              <View style={{ flexDirection: "row", gap: f(22) }}>
                <View style={{ flex: 1 }}><BeltField card={card} f={f} /></View>
                <View style={{ flex: 1 }}><Field label="CPF" value={card.cpf} f={f} mono /></View>
              </View>
              <View>
                <FieldLabel f={f}>Nº de registro FPKT</FieldLabel>
                <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(18), fontWeight: "500", marginTop: f(5), color: RED, letterSpacing: f(0.5) }}>
                  {card.card_number || "—"}
                </Text>
              </View>
            </View>
          ) : (
            // Design 01: grid 2x2 [Data nasc · Dojô / CPF · Nº registro FPKT]
            <View style={{ marginTop: f(24), gap: f(22) }}>
              <View style={{ flexDirection: "row", gap: f(20) }}>
                <View style={{ flex: 1 }}><Field label="Data de nascimento" value={fmtBR(card.birth_date)} f={f} mono /></View>
                <View style={{ flex: 1 }}><Field label="Dojô" value={card.dojo_name} f={f} /></View>
              </View>
              <View style={{ flexDirection: "row", gap: f(20) }}>
                <View style={{ flex: 1 }}><Field label="CPF" value={card.cpf} f={f} mono /></View>
                <View style={{ flex: 1 }}>
                  <FieldLabel f={f}>Nº de registro FPKT</FieldLabel>
                  <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(18), fontWeight: "500", marginTop: f(5), color: RED, letterSpacing: f(0.5) }}>
                    {card.card_number || "—"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* footer */}
      <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: f(9) }}>
          <View style={{ width: f(5), height: f(5), borderRadius: f(2.5), backgroundColor: RED }} />
          <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(7.5), letterSpacing: f(1.05), textTransform: "uppercase", color: INK_3, textAlign: "right", lineHeight: f(11.25) }}>
            Documento válido em todo o{"\n"}território da federação · F.P.K.T.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Back({ card, f, verifyUrl, isPreta }: { card: MembershipCard; f: (n: number) => number; verifyUrl: string; isPreta: boolean }) {
  return (
    <View style={{ flex: 1, paddingTop: f(26), paddingBottom: f(22), paddingHorizontal: f(32) }}>
      <Watermark f={f} side="back" />

      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", minHeight: f(46) }}>
        <HeaderLeft card={card} f={f} size={40} />
        <Text style={{ fontSize: f(8), letterSpacing: f(1.6), textTransform: "uppercase", color: INK_3 }}>Verso</Text>
      </View>

      <View style={{ marginTop: f(16), marginHorizontal: -f(32), height: f(2), backgroundColor: RED }} />
      {isPreta ? <View style={{ marginTop: f(11), marginHorizontal: -f(32), height: f(8), backgroundColor: BLACK_BAR }} /> : null}

      {/* two halves */}
      <View style={{ flexDirection: "row", flex: 1, marginTop: f(18) }}>
        {/* left: Dojo Kun */}
        <View style={{ flex: 1.45, paddingRight: f(24) }}>
          <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(8.5), letterSpacing: f(1.53), textTransform: "uppercase", color: RED }}>
            Lema do Karatê
          </Text>
          <Text style={{ fontFamily: KarateFonts.heading, fontSize: f(17), fontWeight: "500", marginTop: f(7), color: INK }}>
            Dojo Kun · os cinco princípios
          </Text>
          <View style={{ marginTop: f(18), gap: f(12) }}>
            {DOJO_KUN.map((line, i) => (
              <View key={i} style={{ flexDirection: "row", gap: f(11), alignItems: "flex-start" }}>
                <View style={{ width: f(6), height: f(6), backgroundColor: RED, marginTop: f(4) }} />
                <Text style={{ flex: 1, fontFamily: KarateFonts.body, fontSize: f(12.5), color: INK, lineHeight: f(17.5) }}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* right: validação */}
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: LINE, paddingLeft: f(24), alignItems: "center" }}>
          <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(8.5), letterSpacing: f(1.53), textTransform: "uppercase", color: INK_3 }}>
            Identificação
          </Text>
          <Text style={{ fontFamily: KarateFonts.heading, fontSize: f(17), fontWeight: "500", marginTop: f(7), color: INK, textAlign: "center" }}>
            Validação do filiado
          </Text>
          <View style={{ width: f(112), height: f(112), marginTop: f(16), backgroundColor: "#fff", padding: f(2) }}>
            <PixQRCode payload={verifyUrl} size={Math.max(48, Math.round(f(108)))} />
          </View>
          <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(13), color: INK, marginTop: f(12), letterSpacing: f(0.5) }}>
            {card.card_number || "—"}
          </Text>
          <View style={{ marginTop: f(16), alignItems: "center" }}>
            <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(8), letterSpacing: f(1.28), textTransform: "uppercase", color: INK_3 }}>
              Data de emissão
            </Text>
            <Text style={{ fontFamily: KarateFonts.mono, fontSize: f(13), marginTop: f(4), color: INK }}>
              {fmtBR(card.issued_at)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
