import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { primeirosPassosApi, firstStepsQueryKey, type FirstStepsResponse, type Segmento } from "@/services/primeirosPassosApi";
import { frenteDe, tituloDaFrente, type PassoConfig } from "@/constants/primeirosPassos";
import { usePendingTour } from "@/stores/pendingTour";
import { toast } from "@/components/Toast";
import { Colors } from "@/constants/colors";

// ============================================================
// Primeiros passos da frente (05/10/2026)
//
// Cartão NO FLUXO da página (não é modal nem banner flutuante), no topo do
// Painel do shell (tabs) e do Início do Studio. Mostra os três passos da
// frente da empresa ativa; tocar num passo grava o tour pendente e navega —
// o PendingTourHost do layout faz auto-scroll + spotlight + tooltip no
// botão certo quando a tela abre.
//
// Some quando:
//   · visão consolidada multi-CNPJ (os passos são por empresa)
//   · o módulo "onboarding.primeiros_passos" não está visível (membro sem
//     a permissão de configurações — só dono/admin vê)
//   · empresa sem frente (segment NULL): é cliente de antes do cadastro
//     por frente. /auth/me não expõe a data de criação da empresa, então
//     "conta antiga sem frente" = segment NULL — não incomodamos.
//   · o lojista dispensou ("Pular e ir pro Painel") ou fez todos os passos
//   · nenhum passo sobrou visível no plano (passo cuja tela o plano não
//     libera some — premissa do Essencial)
// ============================================================

export const MOD_PRIMEIROS_PASSOS = "onboarding.primeiros_passos";

export type PrimeirosPassosPalette = {
  card: string;
  border: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;      // número do passo, seta, destaque do título
  accentSoft: string;  // fundo do número
  ok: string;          // check do passo feito / "Pronto:"
  okSoft: string;
  okBorder: string;
  stepBg: string;
};

export const AURA_PASSOS_PALETTE: PrimeirosPassosPalette = {
  card: Colors.violetD,
  border: Colors.border2,
  ink: Colors.ink,
  ink2: Colors.ink2,
  ink3: Colors.ink3,
  accent: Colors.violet3,
  accentSoft: Colors.violet + "4D",
  ok: Colors.green,
  okSoft: Colors.greenD,
  okBorder: Colors.green + "59",
  stepBg: Colors.bg3,
};

type PassoVisivel = { key: string; done: boolean; cfg: PassoConfig };

export function PrimeirosPassosCard({ palette = AURA_PASSOS_PALETTE }: { palette?: PrimeirosPassosPalette }) {
  const { user, company, consolidatedView, token } = useAuthStore();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const visible = useVisibleModules();
  const router = useRouter();
  const qc = useQueryClient();
  const startTour = usePendingTour((s) => s.start);
  const [dispensando, setDispensando] = useState(false);

  // Gate de plano/segmento (CLAUDE.md armadilha 1): revalida /auth/me no
  // mount. O store deduplica com o refetch do layout.
  useEffect(() => { if (token && typeof refreshMe === "function") refreshMe().catch(() => {}); }, [token, refreshMe]);

  const cid = company?.id || null;
  const segment = ((company as any)?.segment ?? null) as Segmento | null;
  const podeVer = !consolidatedView && !!cid && !!segment && visible.has(MOD_PRIMEIROS_PASSOS);

  const { data } = useQuery<FirstStepsResponse>({
    queryKey: firstStepsQueryKey(cid),
    queryFn: () => primeirosPassosApi.get(cid!),
    enabled: podeVer && !!token,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  const frenteSeg = (data?.segment ?? segment) as Segmento | null;
  const frente = frenteDe(frenteSeg);

  const passos: PassoVisivel[] = useMemo(() => {
    if (!data) return [];
    return (data.steps || [])
      .map((s) => ({ key: s.key, done: !!s.done, cfg: frente.passos[s.key] }))
      .filter((p) => !!p.cfg && (!p.cfg.mod || visible.has(p.cfg.mod)));
  }, [data, frente, visible]);

  if (!podeVer || !data || data.dismissed || !data.segment) return null;
  if (passos.length === 0 || passos.every((p) => p.done)) return null;

  const mostrarPronto = !!frente.pronto && frente.prontoMods.every((m) => visible.has(m));
  const primeiroNome = String(user?.name || "").trim().split(/\s+/)[0] || "";

  function abrir(p: PassoVisivel) {
    startTour({
      path: p.cfg.path,
      step: { id: "primeiros-passos-" + p.key, targetSelectors: p.cfg.targets, title: p.cfg.tip.title, body: p.cfg.tip.body, position: "auto" },
    });
    router.push(p.cfg.path as any);
  }

  async function dispensar() {
    if (!cid || dispensando) return;
    setDispensando(true);
    try {
      await primeirosPassosApi.dismiss(cid);
      qc.setQueryData<FirstStepsResponse>(firstStepsQueryKey(cid), (old) => (old ? { ...old, dismissed: true } : old));
    } catch (err: any) {
      toast.error(err?.data?.error || "Não deu pra pular agora. Tente de novo.");
    } finally {
      setDispensando(false);
    }
  }

  return (
    <View style={[s.card, { backgroundColor: palette.card, borderColor: palette.border }]} testID="primeiros-passos">
      <Text style={[s.hello, { color: palette.ink3 }]}>
        {primeiroNome ? "Bem-vindo(a), " + primeiroNome : "Bem-vindo(a)"}
      </Text>
      <Text style={[s.title, { color: palette.ink }]} testID="primeiros-passos-titulo">{tituloDaFrente(frenteSeg)}</Text>

      {mostrarPronto && (
        <View style={[s.ready, { backgroundColor: palette.okSoft, borderColor: palette.okBorder }]} testID="primeiros-passos-pronto">
          <Text style={[s.readyText, { color: palette.ink2 }]}>
            <Text style={{ color: palette.ok, fontWeight: "700" }}>Pronto: </Text>
            {frente.pronto}
          </Text>
        </View>
      )}

      {passos.map((p, i) => (
        <Pressable
          key={p.key}
          onPress={() => abrir(p)}
          accessibilityRole="button"
          accessibilityLabel={p.cfg.title + (p.done ? " (feito)" : "")}
          style={[s.step, { backgroundColor: palette.stepBg, borderColor: palette.border }]}
          testID={"primeiros-passos-" + p.key}
        >
          <View style={[s.num, { backgroundColor: p.done ? palette.okSoft : palette.accentSoft }]}>
            <Text style={[s.numText, { color: p.done ? palette.ok : palette.ink }]}>{p.done ? "✓" : String(i + 1)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[s.stepTitle, { color: p.done ? palette.ink3 : palette.ink }, p.done && s.riscado]}
              testID={"primeiros-passos-" + p.key + "-titulo"}
            >
              {p.cfg.title}
            </Text>
            <Text style={[s.stepDesc, { color: palette.ink3 }, p.done && s.riscado]}>{p.cfg.desc}</Text>
          </View>
          <Text style={[s.arrow, { color: palette.accent }]}>→</Text>
        </Pressable>
      ))}

      <Pressable onPress={dispensar} disabled={dispensando} style={s.skip} testID="primeiros-passos-pular" accessibilityRole="button">
        {dispensando
          ? <ActivityIndicator size="small" color={palette.ink3} />
          : <Text style={[s.skipText, { color: palette.ink3 }]}>Pular e ir pro Painel</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 20 },
  hello: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, marginTop: 6 },
  ready: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  readyText: { fontSize: 13, lineHeight: 18 },
  step: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 8 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 12, fontWeight: "700" },
  stepTitle: { fontSize: 14, fontWeight: "600" },
  stepDesc: { fontSize: 12, marginTop: 1 },
  riscado: { textDecorationLine: "line-through" },
  arrow: { fontSize: 18, marginLeft: 6 },
  skip: { alignSelf: "center", marginTop: 12, paddingVertical: 6, paddingHorizontal: 10 },
  skipText: { fontSize: 13, textDecorationLine: "underline" },
});

export default PrimeirosPassosCard;
