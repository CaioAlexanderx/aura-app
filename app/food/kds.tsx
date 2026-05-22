import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Redirect } from "expo-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { FoodColors, FoodGradients } from "@/constants/food-tokens";
import { KdsBoard } from "@/components/food/KdsBoard";
import { useFoodKds } from "@/hooks/useFoodKds";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { BASE_URL } from "@/services/api";
import { printThermalUrl, buildComandaUrl, isThermalPrintSupported } from "@/utils/printThermal";

// ============================================================
// /food/kds — KDS standalone, fora do shell food.
// Modo TV. Polling 5s. Beep ao detectar pedido novo (Web Audio API).
// Guard: company.vertical_active === "food".
//
// 2026-05-24 (Fase 7): auto-print da comanda termica 80mm ao detectar
// pedido novo em status=confirmed (gate: pdv_settings.food_comanda_print_enabled
// + Platform.OS===web). Mesma logica do beep — quando um id aparece
// pela primeira vez nas colunas confirmed/preparing/ready, dispara
// printThermalUrl(GET /food/orders/:oid/comanda). Throttle por id
// no Set knownIdsRef evita reimpressao em cada poll.
//
// 2026-05-21 (F3 do polish pre-Fase 7): nome de empresa no header
// usa trade_name -> legal_name (companies nao tem coluna `name`).
//
// 2026-05-21 (F8 do polish pre-Fase 7): iPad/iOS Safari exige gesto
// do usuario pra liberar AudioContext (autoplay policy). Antes da
// primeira interacao, mostramos overlay "Clique pra ativar som";
// dispara um beep silencioso (rampa de 0.001) so pra desbloquear o
// contexto e fecha o overlay.
// ============================================================

let _audioCtx: AudioContext | null = null;
function playBeep() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    if (!_audioCtx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      _audioCtx = new Ctx();
    }
    const ctx = _audioCtx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* user gesture pendente */ }
}

function unlockAudioContext() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    const ctx = _audioCtx as any;
    if (ctx && typeof ctx.resume === "function") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
  } catch {}
}

function isIOSWeb(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || "");
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function enterFullscreen() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const el = document.documentElement as any;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

export default function KdsScreen() {
  const { company, token, isHydrated } = useAuthStore();
  const { settings } = usePdvSettings();
  const { confirmed, preparing, ready, counts } = useFoodKds();
  const [soundOn, setSoundOn] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => !isIOSWeb());
  const clock = useClock();
  const knownIdsRef = useRef<Set<string>>(new Set());
  // Fase 7: rastreia ids ja impressos pra evitar reimpressao na mesma
  // sessao. Persiste no escopo do componente (limpo no reload da pagina).
  const printedIdsRef = useRef<Set<string>>(new Set());

  // Beep + auto-print ao detectar pedido novo (id que nao estava no poll anterior)
  useEffect(() => {
    const ids = new Set([...confirmed, ...preparing, ...ready].map(o => o.id));
    // primeiro tick: popula knownIds sem disparar beep nem print (evita
    // imprimir tudo que ja estava na tela ao abrir o KDS).
    if (knownIdsRef.current.size === 0) {
      knownIdsRef.current = ids;
      // populate printed pra nao imprimir tudo que ja existe
      ids.forEach(id => printedIdsRef.current.add(id));
      return;
    }

    let didBeep = false;
    for (const o of confirmed) {
      if (!knownIdsRef.current.has(o.id)) {
        // beep (so o primeiro novo)
        if (!didBeep && soundOn && audioUnlocked) {
          playBeep();
          didBeep = true;
        }
        // auto-print comanda (Fase 7)
        if (
          settings?.food_comanda_print_enabled === true &&
          isThermalPrintSupported() &&
          company?.id &&
          !printedIdsRef.current.has(o.id)
        ) {
          printedIdsRef.current.add(o.id);
          const url = buildComandaUrl(BASE_URL, company.id, o.id, token);
          printThermalUrl(url, { silent: true });
        }
      }
    }
    // mesmo loop pra preparing/ready (caso pedido pule confirmed)
    if (!didBeep) {
      for (const o of [...preparing, ...ready]) {
        if (!knownIdsRef.current.has(o.id) && soundOn && audioUnlocked) {
          playBeep();
          break;
        }
      }
    }
    knownIdsRef.current = ids;
  }, [confirmed, preparing, ready, soundOn, audioUnlocked, settings?.food_comanda_print_enabled, company?.id, token]);

  if (!isHydrated) return null;
  if ((company as any)?.vertical_active !== "food") {
    return <Redirect href="/(tabs)" />;
  }

  const isWeb = Platform.OS === "web";
  const businessName =
    ((company as any)?.trade_name) ||
    ((company as any)?.legal_name) ||
    ((company as any)?.name) ||
    "Aura Food";

  return (
    <ErrorBoundary>
      <View style={[
        { flex: 1, backgroundColor: FoodColors.bg },
        isWeb ? ({ background: FoodGradients.shellBg, minHeight: "100vh" } as any) : {},
      ]}>
        <ToastContainer />
        {/* Header sticky */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 18, paddingVertical: 12,
          backgroundColor: FoodColors.surface,
          borderBottomWidth: 1, borderBottomColor: FoodColors.border,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={[
              { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
              isWeb ? ({ background: FoodGradients.heroAccent } as any) : { backgroundColor: FoodColors.red },
            ]}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>🔥</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: FoodColors.red, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
                KDS COZINHA
              </Text>
              <Text style={{ fontSize: 16, color: FoodColors.ink, fontWeight: "800" }}>
                {businessName}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Indicator label="Aguardando" value={counts.confirmed} color={FoodColors.amber} />
              <Indicator label="Preparando" value={counts.preparing} color={FoodColors.cyan} />
              <Indicator label="Prontos" value={counts.ready} color={FoodColors.green} />
            </View>
            <Text style={{
              fontSize: 24, color: FoodColors.ink, fontWeight: "800",
              fontVariant: ["tabular-nums"],
              marginLeft: 8,
            }}>{clock}</Text>
            <Pressable
              onPress={() => { setSoundOn(s => !s); if (!soundOn && audioUnlocked) playBeep(); }}
              style={iconBtnStyle}
              {...(isWeb ? ({ title: soundOn ? "Som ON — click pra mute" : "Mute — click pra ativar" } as any) : {})}
            >
              <Text style={{ fontSize: 14 }}>{soundOn ? "🔊" : "🔇"}</Text>
            </Pressable>
            {/* Fase 7: indicador visual de impressao automatica ativa */}
            {settings?.food_comanda_print_enabled === true && isWeb && (
              <View style={[iconBtnStyle, { backgroundColor: FoodColors.green + "22", borderColor: FoodColors.green + "55" }]}
                {...(isWeb ? ({ title: "Impressao automatica de comanda ativa" } as any) : {})}>
                <Text style={{ fontSize: 14 }}>🖨</Text>
              </View>
            )}
            <Pressable onPress={enterFullscreen} style={iconBtnStyle}
              {...(isWeb ? ({ title: "Modo TV (fullscreen)" } as any) : {})}>
              <Icon name="grid" size={14} color={FoodColors.ink2} />
            </Pressable>
          </View>
        </View>

        {/* Board */}
        <KdsBoard />

        {/* F8 — Overlay de unlock de audio (iOS). Cobre 100% e some no primeiro click. */}
        {isWeb && !audioUnlocked && (
          <Pressable
            onPress={() => { unlockAudioContext(); setAudioUnlocked(true); }}
            style={[
              {
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(10,10,26,0.92)",
                alignItems: "center", justifyContent: "center", padding: 24,
              } as any,
              { zIndex: 99 } as any,
            ]}
            {...(isWeb ? ({ "aria-label": "Ativar som do KDS" } as any) : {})}
          >
            <View style={[
              { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 18 },
              isWeb ? ({ background: FoodGradients.heroAccent } as any) : { backgroundColor: FoodColors.red },
            ]}>
              <Text style={{ fontSize: 42 }}>🔊</Text>
            </View>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center" }}>
              Clique pra ativar o som
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 6, textAlign: "center", maxWidth: 360, lineHeight: 19 }}>
              O iPad bloqueia audio ate voce tocar a tela uma vez. Sem isso o KDS nao consegue avisar com beep quando um pedido novo chega da cozinha.
            </Text>
            <View style={{ marginTop: 20, backgroundColor: FoodColors.red, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Ativar som e comecar</Text>
            </View>
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

function Indicator({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 18, color, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ fontSize: 9, color: FoodColors.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

const iconBtnStyle: any = {
  width: 32, height: 32, borderRadius: 8,
  backgroundColor: FoodColors.surface2, borderWidth: 1, borderColor: FoodColors.border,
  alignItems: "center", justifyContent: "center",
};
