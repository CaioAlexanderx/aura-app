// ============================================================
// AURA STUDIO · Detalhe de evento (item #4 follow-up UX)
//
// Lista todos os items do evento em grid clicável. Cada item ou
// já tem um digital_order linkado (clica → vai pro KDS) ou está
// "à converter" (botão grande "Converter em pedidos" cria todos).
//
// Backend: PR Aura-backend#116 (migration 134).
//   GET  /studio/bulk-events/:eid/orders
//   POST /studio/bulk-events/:eid/convert
// ============================================================
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens, useStudioTheme } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { studioBulkConvertApi, type StudioBulkEventItemRow } from "@/services/studioBulkConvertApi";
import { labelStudioStatus, colorStudioStatus } from "@/constants/studio-status";
import { StudioBreadcrumb } from "@/components/studio/StudioBreadcrumb";

export default function EventoDetalhe() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const eid = String(params?.eid || "");
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const { isDark } = useStudioTheme();
  const s = useMemo(() => buildStyles(t), [t]);

  const [items, setItems] = useState<StudioBulkEventItemRow[]>([]);
  const [stats, setStats] = useState<{ converted: number; total: number }>({ converted: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  // FIX (bug #13 QA): erro engolido virava "Nenhum item neste evento" —
  // estado dedicado com retry, distinto do vazio de verdade.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    // FIX (bug #14 QA): return antes do setLoading(false) deixava o
    // spinner girando pra sempre quando company ainda não tinha carregado.
    if (!company?.id || !eid) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await studioBulkConvertApi.listItems(company.id, eid);
      setItems(r.items || []);
      setStats({ converted: r.converted, total: r.total });
      setLoadError(null);
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar evento";
      toast.error(msg);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [company?.id, eid]);

  useEffect(() => { load(); }, [load]);

  const handleConvert = async () => {
    if (!company?.id || !eid || converting) return;
    setConverting(true);
    try {
      const r = await studioBulkConvertApi.convert(company.id, eid);
      toast.success(r.message || `${r.converted} pedido(s) criado(s) no KDS`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao converter");
    } finally {
      setConverting(false);
    }
  };

  const pendingCount = stats.total - stats.converted;

  return (
    <StudioScreen variant="grid">
      <StudioBreadcrumb
        items={[
          { label: "Estúdio", href: "/studio" },
          { label: "Pedidos", href: "/studio/pedidos" },
          { label: `Evento #${eid.slice(0, 8)}` },
        ]}
      />
      <View style={s.container}>
        {/* FIX (bug #19 QA): <Text style={s.h1}> fora do padrão — migrado
            pra StudioPageHeader. */}
        <StudioPageHeader
          eyebrow="PEDIDOS"
          title="Detalhe do evento"
          subtitle={`${stats.total} pessoa${stats.total === 1 ? "" : "s"} · ${stats.converted} já em produção · ${pendingCount} aguardando conversão`}
          rightSlot={
            pendingCount > 0 ? (
              <Pressable
                onPress={handleConvert}
                disabled={converting}
                style={[s.cta, { backgroundColor: t.accent, opacity: converting ? 0.6 : 1 }]}
              >
                {converting ? <ActivityIndicator color="#fff" /> : <Icon name="arrow-right" size={16} color="#fff" />}
                <Text style={s.ctaTxt}>
                  {converting ? "Convertendo…" : `Converter ${pendingCount} em pedidos`}
                </Text>
              </Pressable>
            ) : undefined
          }
        />

        {loading ? (
          <StudioLoading variant="skeleton-cards" rows={4} />
        ) : loadError && items.length === 0 ? (
          // FIX (bug #13 QA): erro de carregamento é distinto de "sem itens".
          <StudioEmpty
            tone="warning"
            icon="alert-circle"
            title="Não deu pra carregar o evento"
            desc={loadError}
            primaryCta={{ label: "Tentar de novo", onPress: load }}
          />
        ) : items.length === 0 ? (
          <StudioEmpty
            icon="users"
            title="Nenhum item neste evento"
            desc="Esse evento ainda não tem pessoas cadastradas."
          />
        ) : (
          <View style={s.grid}>
            {items.map((it) => {
              const linked = !!it.digital_order_id;
              const status = it.studio_production_status as any;
              const col = status ? colorStudioStatus(status, isDark) : { bg: t.bgSoft, fg: t.ink3 };
              return (
                <Pressable
                  key={it.item_id}
                  onPress={() => linked && router.push(`/studio/pedidos/${it.digital_order_id}` as any)}
                  style={[s.card, linked && s.cardLinked]}
                  disabled={!linked}
                >
                  <View style={s.cardHead}>
                    <Text style={s.lineNum}>#{String(it.line_number).padStart(3, "0")}</Text>
                    {linked ? (
                      <View style={[s.statusPill, { backgroundColor: col.bg }]}>
                        <Text style={[s.statusTxt, { color: col.fg }]}>{labelStudioStatus(status)}</Text>
                      </View>
                    ) : (
                      <View style={[s.statusPill, { backgroundColor: t.bgSoft }]}>
                        <Text style={[s.statusTxt, { color: t.ink3 }]}>aguarda conversão</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.recipient}>
                    {it.recipient_name || it.order_customer_name || "Cliente do evento"}
                  </Text>
                  {it.customization && (
                    <Text style={s.customSummary} numberOfLines={3}>
                      {summarizeCustomization(it.customization)}
                    </Text>
                  )}
                  {linked && it.total != null && (
                    <Text style={s.cardMeta}>R$ {Number(it.total).toFixed(2)}</Text>
                  )}
                  {linked && (
                    <View style={s.openHint}>
                      <Icon name="chevron-right" size={12} color={t.primary} />
                      <Text style={s.openHintTxt}>Abrir pedido</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </StudioScreen>
  );
}

function summarizeCustomization(c: any): string {
  if (!c) return "";
  if (typeof c === "string") return c;
  try {
    const keys = Object.keys(c).slice(0, 3);
    return keys.map((k) => `${k}: ${String(c[k]).slice(0, 30)}`).join(" · ");
  } catch {
    return "personalização";
  }
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
  container: { width: "100%" },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
  ctaTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: 240, minWidth: 240,
    backgroundColor: t.paperCard,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: t.ink5,
    opacity: 0.85,
  },
  cardLinked: { opacity: 1, borderColor: t.primary + "40" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  lineNum: { fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 0.6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusTxt: { fontSize: 10, fontWeight: "800" },
  recipient: { fontSize: 14, fontWeight: "700", color: t.ink },
  customSummary: { fontSize: 11, color: t.ink3, marginTop: 6, lineHeight: 16 },
  cardMeta: { fontSize: 11, color: t.ink3, marginTop: 6, fontWeight: "600" },
  openHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  openHintTxt: { fontSize: 11, color: t.primary, fontWeight: "700" },
  });
}
