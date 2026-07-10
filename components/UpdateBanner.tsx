// ============================================================
// UpdateBanner — aviso de nova versão do app web (10/07/2026).
//
// PROBLEMA: lojista de PDV mantém a aba aberta por dias; deploy no
// Cloudflare Pages não troca o bundle carregado, então correções
// demoram a chegar (ex.: cliente reportou modal sem scroll HORAS
// depois do fix F4.3 já estar no ar — bundle antigo na aba).
//
// COMO FUNCIONA (web only):
//  - baseline = hash do entry-<hash>.js que ESTÁ rodando (script tag).
//  - poll: refaz fetch de "/" (no-store) a cada 5 min + ao voltar o
//    foco/visibilidade da aba (throttle 60s) e compara o hash servido.
//  - mudou → toast fixo no rodapé com botão "Atualizar" (reload).
//
// Sem service worker, sem storage — estado só em memória da aba.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

const IS_WEB = Platform.OS === "web";
const POLL_MS = 5 * 60 * 1000;
const FOCUS_THROTTLE_MS = 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;
const ENTRY_RE = /\/_expo\/static\/js\/web\/entry-([a-f0-9]+)\.js/;

/** Hash do bundle atualmente CARREGADO (verdade da aba). */
function loadedEntryHash(): string | null {
  try {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    for (const sc of scripts) {
      const mm = (sc.getAttribute("src") || "").match(/entry-([a-f0-9]+)\.js/);
      if (mm) return mm[1];
    }
  } catch {}
  return null;
}

/** Hash do bundle que o servidor está SERVINDO agora. */
async function servedEntryHash(): Promise<string | null> {
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    const mm = html.match(ENTRY_RE);
    return mm ? mm[1] : null;
  } catch {
    return null; // offline/transiente: silêncio, tenta no próximo ciclo
  }
}

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const baseline = useRef<string | null>(null);
  const shown = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined") return;
    baseline.current = loadedEntryHash();
    let alive = true;

    async function check() {
      if (!alive || shown.current) return;
      lastCheck.current = Date.now();
      const served = await servedEntryHash();
      if (!alive || !served) return;
      if (!baseline.current) { baseline.current = served; return; }
      if (served !== baseline.current) {
        shown.current = true;
        setReady(true);
      }
    }

    const iv = setInterval(check, POLL_MS);
    const t = setTimeout(check, FIRST_CHECK_MS);
    const onFocus = () => {
      if (Date.now() - lastCheck.current > FOCUS_THROTTLE_MS) check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      clearTimeout(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!ready) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.banner}>
        <Text style={s.txt}>Nova versão da Aura disponível.</Text>
        <Pressable
          style={({ hovered, pressed }: any) => [
            s.btn,
            (hovered || pressed) && { backgroundColor: Colors.violet2 },
            pressed && ({ transform: [{ scale: 0.98 }] } as any),
          ]}
          onPress={() => { try { window.location.reload(); } catch {} }}
          accessibilityRole="button"
          accessibilityLabel="Atualizar para a nova versão"
        >
          <Text style={s.btnTxt}>Atualizar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: (IS_WEB ? "fixed" : "absolute") as any,
    left: 0, right: 0, bottom: 18,
    alignItems: "center",
    zIndex: 9999,
  } as any,
  banner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 16,
    ...(IS_WEB ? ({ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" } as any) : null),
  },
  txt: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  btn: {
    backgroundColor: Colors.violet,
    borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    minHeight: 36, alignItems: "center", justifyContent: "center",
  },
  btnTxt: { fontSize: 12.5, fontWeight: "800", color: "#fff" },
});

export default UpdateBanner;
