// ============================================================
// UpdateBanner — aviso de nova versão do app web (10/07/2026).
//
// PROBLEMA: lojista de PDV mantém a aba aberta por dias; deploy no
// Cloudflare não troca o bundle carregado, então correções demoram a
// chegar. 04 e 05/11/2026 (Lulume): três correções de etiqueta já estavam
// no ar e a loja imprimia com o app velho, por horas, sem ninguém perceber.
//
// COMO FUNCIONA (web only):
//  - baseline = hash do entry-<hash>.js que ESTÁ rodando (script tag).
//  - poll: refaz fetch de "/" (no-store) a cada 5 min + ao voltar o
//    foco/visibilidade da aba (throttle 60s) e compara o hash servido.
//  - mudou → toast fixo no rodapé com "Atualizar" e "Agora não".
//
// HISTÓRICO: ficou DESLIGADO de 11/07 a 05/11/2026. O bundle é único para
// toda a Aura: um deploy do Karatê mudava o hash do lojista de varejo, que
// via o toast o dia inteiro (média de 4,6 deploys/dia, pico de 12). Voltou
// com os freios de utils/avisoDeAtualizacao.ts: só versão com 30 min de
// vida (builtAt do version.json), "Agora não" cala por 24 h neste
// navegador, e dentro do congelamento só hotfix. A leitura de versão é a de
// services/atualizarApp.ts (a mesma do botão "Versão do app").
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { atualizacaoLiberada, atualizarAgora, builtAtServido, hashCarregado, hashServido } from "@/services/atualizarApp";
import { deveAvisar, silenciadoAte, silenciarPorUmDia, TEXTO_DO_AVISO } from "@/utils/avisoDeAtualizacao";

const ENABLED = true;

const IS_WEB = Platform.OS === "web";
const POLL_MS = 5 * 60 * 1000;
const FOCUS_THROTTLE_MS = 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const baseline = useRef<string | null>(null);
  const shown = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!ENABLED) return;
    if (!IS_WEB || typeof window === "undefined") return;
    baseline.current = hashCarregado();
    let alive = true;

    async function check() {
      if (!alive || shown.current) return;
      lastCheck.current = Date.now();
      const served = await hashServido();
      if (!alive || !served) return;
      if (!baseline.current) { baseline.current = served; return; }
      if (served === baseline.current) return;
      // Janela de congelamento (13/10/2026): bundle novo que não é hotfix
      // não aparece. Não marca `shown`, então o próximo poll reavalia.
      if (!(await atualizacaoLiberada(served))) return;
      if (!alive) return;
      const builtAt = await builtAtServido(served);
      if (!alive) return;
      const agora = Date.now();
      if (!deveAvisar({ carregado: baseline.current, servido: served, builtAt, silenciadoAte: silenciadoAte(), agora })) return;
      shown.current = true;
      setReady(true);
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

  const agoraNao = useCallback(() => {
    silenciarPorUmDia();
    // Volta a verificar: depois das 24 h o próximo poll pode avisar de novo.
    shown.current = false;
    setReady(false);
  }, []);

  if (!ENABLED || !ready) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.banner}>
        <Text style={s.txt}>{TEXTO_DO_AVISO.titulo}</Text>
        <Pressable
          onPress={agoraNao}
          style={({ hovered, pressed }: any) => [s.btnGhost, (hovered || pressed) && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Deixar para depois"
          testID="aviso-atualizacao-agora-nao"
        >
          <Text style={s.btnGhostTxt}>{TEXTO_DO_AVISO.agoraNao}</Text>
        </Pressable>
        <Pressable
          style={({ hovered, pressed }: any) => [
            s.btn,
            (hovered || pressed) && { backgroundColor: Colors.violet2 },
            pressed && ({ transform: [{ scale: 0.98 }] } as any),
          ]}
          onPress={() => { atualizarAgora(); }}
          accessibilityRole="button"
          accessibilityLabel="Atualizar para a nova versão"
          testID="aviso-atualizacao-atualizar"
        >
          <Text style={s.btnTxt}>{TEXTO_DO_AVISO.atualizar}</Text>
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
  btnGhost: { paddingVertical: 8, paddingHorizontal: 6, minHeight: 36, alignItems: "center", justifyContent: "center" },
  btnGhostTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink2 },
});
