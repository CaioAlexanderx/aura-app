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

// ============================================================
// /food/kds — KDS standalone, fora do shell food.
// Modo TV. Polling 5s. Beep ao detectar pedido novo (Web Audio API).
// Guard: company.vertical_active === "food".
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
  const { company, isHydrated } = useAuthStore();
  const { confirmed, preparing, ready, counts } = useFoodKds();
  const [soundOn, setSoundOn] = useState(true);
  const clock = useClock();
  const knownIdsRef = useRef<Set<string>>(new Set());

  // beep ao detectar pedido novo (id que não estava no poll anterior)
  useEffect(() => {
    const ids = new Set([...confirmed, ...preparing, ...ready].map(o => o.id));
    if (knownIdsRef.current.size > 0) {
      for (const id of ids) {
        if (!knownIdsRef.current.has(id) && soundOn) {
          playBeep();
          break;
        }
      }
    }
    knownIdsRef.current = ids;
  }, [confirmed, preparing, ready, soundOn]);

  if (!isHydrated) return null;
  if ((company as any)?.vertical_active !== "food") {
    return <Redirect href="/(tabs)" />;
  }

  const isWeb = Platform.OS === "web";

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
                {((company as any)?.name) || "Aura Food"}
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
              onPress={() => { setSoundOn(s => !s); if (!soundOn) playBeep(); }}
              style={iconBtnStyle}
              {...(isWeb ? ({ title: soundOn ? "Som ON — click pra mute" : "Mute — click pra ativar" } as any) : {})}
            >
              <Text style={{ fontSize: 14 }}>{soundOn ? "🔊" : "🔇"}</Text>
            </Pressable>
            <Pressable onPress={enterFullscreen} style={iconBtnStyle}
              {...(isWeb ? ({ title: "Modo TV (fullscreen)" } as any) : {})}>
              <Icon name="grid" size={14} color={FoodColors.ink2} />
            </Pressable>
          </View>
        </View>

        {/* Board */}
        <KdsBoard />
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
