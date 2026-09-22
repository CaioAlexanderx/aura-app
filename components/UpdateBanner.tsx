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
//
// ⚠️ DESLIGADO EM 11/07/2026 (ENABLED = false).
// O bundle é ÚNICO para toda a Aura: o hash do entry-<hash>.js muda a cada
// deploy, não importa qual vertical mudou. Durante a sequência intensa de
// deploys da Aura Karatê, o cliente da Aura Negócio (PDV/varejo) via o toast
// "Nova versão disponível" o dia inteiro — ruído puro, já que nada do produto
// dele mudou. Como não dá para saber pelo hash O QUE mudou, não há como
// segmentar o aviso; a saída é silenciar até a cadência de deploy normalizar.
//
// PARA REATIVAR: ENABLED = true (o resto da lógica está intacto).
// Se o ruído voltar, a correção estrutural é o backend expor um /version com
// um campo tipo `notify: true|false` (ou a vertical afetada), e o banner só
// aparecer quando o deploy for relevante para o usuário logado.
//
// 22/09/2026 — a leitura de versão (hash do entry-<hash>.js, aqui e no
// servidor) saiu daqui para services/atualizarApp.ts, porque o botão
// "Atualizar" de Configurações usa a MESMA comparação. Este arquivo agora só
// tem o aviso automático — que segue desligado pelo motivo acima. Enquanto
// existirem dois jeitos de saber a versão, um dos dois apodrece.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { hashCarregado, hashServido } from "@/services/atualizarApp";

const ENABLED = false;

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
    // Desligado: não faz baseline, não agenda poll, não faz fetch de "/".
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

  if (!ENABLED || !ready) return null;

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
