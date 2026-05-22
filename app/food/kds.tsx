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
//
// 2026-05-21 (F3 do polish pre-Fase 7): nome de empresa no header
// usa trade_name → legal_name (companies nao tem coluna `name`).
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
    // resume() retorna Promise em browsers iOS; ignora erro silenciosamente.
    const ctx = _audioCtx as any;
    if (ctx && typeof ctx.resume === "function") ctx.resume().catch(() => {});
    // dispara beep silencioso pra cimentar o unlock dentro do gesto.
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
  const { company, isHydrated } = useAuthStore();
  const { confirmed, preparing, ready, counts } = useFoodKds();
  const [soundOn, setSoundOn] = useState(true);
  // F8: iOS exige gesto pra ativar audio. Em outros browsers consideramos
  // ja desbloqueado (autoplay sem som funciona, ou o primeiro beep dispara
  // dentro de outro gesto qualquer da pagina).
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => !isIOSWeb());
  const clock = useClock();
  const knownIdsRef = useRef<Set<string>>(new Set());

  // beep ao detectar pedido novo (id que não estava no poll anterior)
  useEffect(() => {
    const ids = new Set([...confirmed, ...preparing, ...ready].map(o => o.id));
    if (knownIdsRef.current.size > 0) {
      for (const id of ids) {
        if (!knownIdsRef.current.has(id) && soundOn && audioUnlocked) {
          playBeep();
          break;
        }
      }
    }
    knownIdsRef.current = ids;
  }, [confirmed, preparing, ready, soundOn, audioUnlocked]);

  if (!isHydrated) return null;
  if ((company as any)?.vertical_active !== "food") {
    return <Redirect href="/(tabs)" />;
  }

  const isWeb = Platform.OS === "web";
  // F3: nome de empresa via trade_name → legal_name (companies nao tem `name`).
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
              O iPad bloqueia áudio até você tocar a tela uma vez. Sem isso o KDS não consegue avisar com beep quando um pedido novo chega da cozinha.
            </Text>
            <View style={{ marginTop: 20, backgroundColor: FoodColors.red, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>Ativar som e começar</Text>
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
