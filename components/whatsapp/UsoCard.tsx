// ============================================================
// UsoCard — "quanto o WhatsApp já custou este mês?"
//
// Irmão varejo do WaUsageCard do dojô. Tudo vem do GET /whatsapp/status
// e tudo é OPCIONAL: backend anterior à Fase 1 não devolve `usage` nem
// `quality_rating`, e nesse caso o cartão simplesmente não aparece —
// melhor ausente do que mostrando zeros que parecem verdade.
//
// Fase 8b — o cartão passou a ser também a TELA DA COTA. O WhatsApp
// oficial vem no plano Negócio e no Aura Dojô: cobrança e lembrete sem
// contagem visível ("inclusos"), e 100 mensagens promocionais por mês.
// Aqui o lojista vê quanto da cota já foi, é avisado em 80% e, quando
// acaba, compra um pacote de 100 sem sair da tela.
//
// A regra dos campos novos vale igual: cota AUSENTE no /status é backend
// anterior à Fase 8b, e aí o cartão mostra exatamente o que mostrava
// antes. Um "0 de 0" seria pior que não mostrar nada — pareceria cota
// zerada quando é só a fase que ainda não subiu.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { waApi, WaMarketingPack, WaStatus } from "@/services/waApi";
import {
  mapWaError, waMarketingPackStatusSpec, waMarketingQuotaInfo, waPackPriceLabel,
  waPausedReasonLabel, waQualitySpec,
} from "./waGuards";
import { waTonePair } from "./varejoTheme";

interface Props {
  status: WaStatus | null;
  /** Sem companyId não há compra de pacote (a tela só lê o status). */
  companyId?: string | null;
  /** Recarregar o /status depois de comprar — a cota muda na hora. */
  onChanged?: () => void;
}

export function UsoCard({ status, companyId, onChanged }: Props) {
  const usage = status?.usage || null;
  const quality = waQualitySpec(status?.quality_rating);
  const paused = status?.paused_reason || null;
  const cota = waMarketingQuotaInfo(status);
  const temCota = !!cota;
  const hasUsage = !!usage && (
    typeof usage.month_sent === "number" ||
    typeof usage.today_sent === "number" ||
    typeof usage.daily_cap === "number"
  );

  const [packs, setPacks] = useState<WaMarketingPack[]>([]);
  const [comprando, setComprando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPacks = useCallback(async () => {
    // Sem cota no /status não existe rota de pacote neste backend.
    if (!companyId || !temCota) { setPacks([]); return; }
    try {
      const r = await waApi.listMarketingPacks(companyId);
      setPacks(Array.isArray(r?.data) ? r.data : []);
    } catch {
      // 404 do backend anterior à fase não é erro de tela: é lista vazia.
      setPacks([]);
    }
  }, [companyId, temCota]);

  useEffect(() => { carregarPacks(); }, [carregarPacks]);

  const comprarPacote = useCallback(async () => {
    if (!companyId || !cota || comprando) return;
    setComprando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await waApi.buyMarketingPack(companyId, cota.packQty);
      const url = r?.payment_url || r?.pack?.payment_url || null;
      if (url) {
        setAviso("Pacote ativa assim que o pagamento confirmar.");
        try { await Linking.openURL(url); } catch { /* o link fica na lista abaixo */ }
      } else if (r?.needs_manual) {
        setAviso("Pedido enviado, a Aura ativa em até 1 dia útil.");
      } else {
        setAviso("Pacote adicionado à cota do mês.");
      }
      carregarPacks();
      onChanged?.();
    } catch (e: any) {
      setErro(mapWaError(e).message);
    } finally {
      setComprando(false);
    }
  }, [companyId, cota, comprando, carregarPacks, onChanged]);

  // Nada conhecido = nada na tela (backend antigo).
  if (!hasUsage && !quality && !paused && !cota) return null;

  const month = typeof usage?.month_sent === "number" ? usage.month_sent : null;
  const today = typeof usage?.today_sent === "number" ? usage.today_sent : null;
  const cap = typeof usage?.daily_cap === "number" && usage.daily_cap > 0 ? usage.daily_cap : null;
  const nearCap = today != null && cap != null && today >= cap * 0.8;
  const qualityTone = quality ? waTonePair(quality.tone) : null;

  // Cobrança/lembrete: o número do mês é do UTILITY quando o backend
  // separa, e o total do mês quando ainda não separa.
  const utilityMes = typeof usage?.utility?.month_sent === "number"
    ? usage.utility.month_sent
    : month;
  const pctCota = cota?.ratio != null ? Math.round(cota.ratio * 100) : null;
  const precoPacote = waPackPriceLabel(cota?.packPriceCents);
  // O botão aparece já em 80%: quem está acabando a cota precisa poder
  // comprar ANTES de parar, não só depois de parado.
  const podeComprar = !!companyId && !!cota && (cota.exhausted || cota.near);

  return (
    <View style={s.card} testID="wa-varejo-uso">
      <View style={s.head}>
        <View style={s.headTitle}>
          <Icon name="bar_chart" size={16} color={Colors.violet3} />
          <Text style={s.title}>Uso do mês</Text>
        </View>
        {!!quality && !!qualityTone && (
          <View style={[s.badge, { backgroundColor: qualityTone.bg }]} testID="wa-varejo-qualidade">
            <Icon name={quality.icon} size={12} color={qualityTone.color} />
            <Text style={[s.badgeTxt, { color: qualityTone.color }]}>{quality.label}</Text>
          </View>
        )}
      </View>

      {hasUsage && (
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum} testID="wa-varejo-uso-mes">{month != null ? month : "—"}</Text>
            <Text style={s.statTxt}>mensagens neste mês</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum} testID="wa-varejo-uso-hoje">
              {today != null ? today : "—"}{cap != null ? ` / ${cap}` : ""}
            </Text>
            <Text style={s.statTxt}>hoje{cap != null ? " (teto diário)" : ""}</Text>
          </View>
        </View>
      )}

      {/* ── Fase 8b: o que está incluso e o que tem cota ────── */}
      {!!cota && (
        <View style={s.cota} testID="wa-varejo-cota">
          <View style={s.cotaLinha}>
            <Text style={s.cotaRotulo}>Cobranças e lembretes</Text>
            <Text style={s.cotaValor} testID="wa-varejo-cota-utilidade">
              {utilityMes != null ? `${utilityMes} este mês` : "—"} (inclusos no plano)
            </Text>
          </View>

          <View style={s.cotaLinha}>
            <Text style={s.cotaRotulo}>Mensagens promocionais</Text>
            <Text style={s.cotaValor} testID="wa-varejo-cota-marketing">
              {cota.monthSent != null ? cota.monthSent : "—"}
              {cota.quota != null ? ` de ${cota.quota}` : ""}
              {cota.quotaBase != null
                ? ` (${cota.quotaBase} inclusas${cota.packsQty ? ` + ${cota.packsQty} em pacotes` : ""})`
                : ""}
            </Text>
          </View>

          {pctCota != null && (
            <View style={s.barra} testID="wa-varejo-cota-barra">
              <View
                style={[
                  s.barraFill,
                  { width: `${Math.max(2, pctCota)}%` },
                  cota.exhausted ? s.barraCheia : cota.near ? s.barraQuase : null,
                ]}
              />
            </View>
          )}

          {cota.near && (
            <View style={s.warnBox} testID="wa-varejo-cota-quase">
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.warnTxt}>
                A loja já usou {pctCota}% da cota de mensagens promocionais deste mês. Quando ela
                acabar, as promoções param até o mês virar — as cobranças continuam saindo.
              </Text>
            </View>
          )}

          {cota.exhausted && (
            <View style={s.warnBox} testID="wa-varejo-cota-esgotada">
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.warnTxt}>
                Cota do mês esgotada. Nenhuma mensagem promocional sai até você comprar um pacote ou
                o mês virar — as cobranças continuam saindo normalmente.
              </Text>
            </View>
          )}

          {podeComprar && (
            <Pressable
              onPress={comprarPacote}
              disabled={comprando}
              accessibilityRole="button"
              style={[s.btnComprar, comprando && s.btnDisabled]}
              testID="wa-varejo-comprar-pacote"
            >
              {comprando && <ActivityIndicator size="small" color="#fff" />}
              <Text style={s.btnComprarTxt}>
                {comprando
                  ? "Enviando o pedido…"
                  : `Comprar ${cota.packQty} mensagens por ${precoPacote}`}
              </Text>
            </Pressable>
          )}

          {!!aviso && (
            <Text style={s.cotaAviso} testID="wa-varejo-pacote-aviso">{aviso}</Text>
          )}
          {!!erro && (
            <Text style={s.cotaErro} testID="wa-varejo-pacote-erro">{erro}</Text>
          )}

          {packs.length > 0 && (
            <View style={s.packs} testID="wa-varejo-pacotes">
              <Text style={s.packsTitulo}>Pacotes comprados</Text>
              {packs.slice(0, 6).map((p) => {
                const spec = waMarketingPackStatusSpec(p.status);
                const tone = waTonePair(spec.tone);
                return (
                  <View key={p.id} style={s.packLinha}>
                    <Text style={s.packTxt} numberOfLines={1}>
                      {p.qty} mensagens
                      {p.valid_until ? ` · vale até ${String(p.valid_until).slice(0, 10).split("-").reverse().join("/")}` : ""}
                    </Text>
                    <View style={[s.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[s.badgeTxt, { color: tone.color }]}>{spec.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {nearCap && !paused && (
        <View style={s.warnBox} testID="wa-varejo-perto-do-teto">
          <Icon name="alert" size={13} color={Colors.amber} />
          <Text style={s.warnTxt}>
            A loja está perto do teto de mensagens do dia. O que passar do limite não se perde: fica
            na fila e sai no próximo dia.
          </Text>
        </View>
      )}

      {!!paused && (
        <View style={s.dangerBox} testID="wa-varejo-pausado">
          <Icon name="alert" size={13} color={Colors.red} />
          <Text style={s.dangerTxt}>
            A fila de envios está pausada: {waPausedReasonLabel(paused)} Nenhuma mensagem automática
            sai enquanto isso — a cobrança manual pelo wa.me continua funcionando.
          </Text>
        </View>
      )}

      <Text style={s.hint}>
        A Meta cobra por conversa iniciada, não por mensagem avulsa. Os números acima contam o que
        saiu de verdade pela fila automática, incluindo os envios de teste.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontWeight: "800", color: Colors.ink },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  stat: {
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 11,
    paddingVertical: 10, paddingHorizontal: 13, minWidth: 150, gap: 2,
  },
  statNum: { fontSize: 19, fontWeight: "800", color: Colors.ink },
  statTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  badgeTxt: { fontSize: 10.5, fontWeight: "700" },
  // ── Cota de promocionais (Fase 8b) ──────────────────────
  cota: { marginTop: 14, gap: 7, maxWidth: 620 },
  cotaLinha: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  cotaRotulo: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  cotaValor: { fontSize: 12, fontWeight: "600", color: Colors.ink, flexShrink: 1, textAlign: "right" },
  barra: { height: 7, borderRadius: 999, backgroundColor: Colors.bg4, overflow: "hidden", marginTop: 2 },
  barraFill: { height: 7, borderRadius: 999, backgroundColor: Colors.violet },
  barraQuase: { backgroundColor: Colors.amber },
  barraCheia: { backgroundColor: Colors.red },
  btnComprar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4,
    backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44,
  },
  btnComprarTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
  cotaAviso: { fontSize: 11.5, fontWeight: "600", color: Colors.green, lineHeight: 16.5 },
  cotaErro: { fontSize: 11.5, fontWeight: "600", color: Colors.red, lineHeight: 16.5 },
  packs: { gap: 5, marginTop: 6 },
  packsTitulo: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  packLinha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  packTxt: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600", flexShrink: 1 },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: Colors.amberD, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  warnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },
  dangerBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: Colors.redD, borderRadius: 10, borderWidth: 1, borderColor: Colors.red + "33",
    paddingVertical: 9, paddingHorizontal: 10, maxWidth: 620,
  },
  dangerTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.red, lineHeight: 16.5 },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16 },
} as any);
