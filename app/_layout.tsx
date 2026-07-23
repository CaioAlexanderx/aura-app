// F-01 (CF Pages trigger 2026-05-25T15:35 — hotfix studio shell)
if (typeof document !== "undefined" && !document.getElementById("aura-splash")) { const _s = document.createElement("style"); _s.id = "aura-splash"; _s.textContent = "@keyframes splashFade{0%{opacity:1}80%{opacity:1}100%{opacity:0}} @keyframes splashLogo{0%{opacity:0;transform:scale(0.8)}30%{opacity:1;transform:scale(1.02)}50%,100%{opacity:1;transform:scale(1)}} @keyframes splashRing{0%{opacity:0;transform:scale(0.6)}40%{opacity:0.4;transform:scale(1)}100%{opacity:0.2;transform:scale(1.1)}}"; document.head.appendChild(_s); }

import "@/utils/micrositeBootstrap"; // {slug}.getaura.com.br → /karate/{slug} (web, antes do router ler a URL)
import { useEffect } from "react";
import { Platform } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { authApi } from "@/services/api";
import { isMicrositeHost, getMicrositeSlug, micrositeTargetPath } from "@/utils/microsite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LGPDConsent } from "@/components/LGPDConsent";
import { startAutoSync } from "@/services/offlineSync";
import { StudioThemeProvider } from "@/contexts/StudioThemeMode";
import { UpdateBanner } from "@/components/UpdateBanner";
import { KarateLoginTransition } from "@/components/karate/KarateLoginTransition";
import { useKarateIntro } from "@/stores/karateIntro";

const queryClient = new QueryClient();

// URL do app administrativo (login/painel da federação). O microsite
// ({slug}.getaura.com.br) é PÚBLICO-only e manda admin/login pra cá.
const APP_URL = "https://app.getaura.com.br";

function checkVerifiedParam() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("email_verified") === "true") {
    const url = new URL(window.location.href);
    url.searchParams.delete("email_verified");
    url.searchParams.delete("verify_error");
    window.history.replaceState({}, "", url.pathname + url.search);
    return true;
  }
  return false;
}

function AuthGuard() {
  const { token, user, company, isHydrated, isDemo, isStaff, trialActive, hydrate } = useAuthStore();
  const karateIntroPending = useKarateIntro((st) => st.pending);
  const consumeKarateIntro = useKarateIntro((st) => st.consume);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
    startAutoSync(
      "https://aura-backend-production-f805.up.railway.app/api/v1",
      () => useAuthStore.getState().token
    );
  }, []);

  useEffect(() => {
    if (!isHydrated || !token) return;
    const verified = checkVerifiedParam();
    if (verified) {
      authApi.me(token).then(res => {
        if ((res.user as any)?.email_verified) {
          useAuthStore.setState({ user: { ...res.user, email_verified: true } as any });
        }
      }).catch(() => {});
    }
  }, [isHydrated, token]);

  useEffect(() => {
    // Microsite ({slug}.getaura.com.br): domínio PÚBLICO-only. Só as páginas
    // públicas (hub, portal do dojô, portal/perfil do praticante, inscrição,
    // ranking embed, verificação de carteirinha) renderizam aqui. Qualquer
    // rota de login/admin sai do subdomínio para o app principal — redirect de
    // página inteira (não router.replace, que é mesmo host). Gateado por
    // isMicrositeHost() → no domínio principal e no nativo este bloco é inerte.
    if (isMicrositeHost()) {
      // Backstop de roteamento: o replaceState do micrositeBootstrap nem sempre
      // é lido pelo Expo Router no bundle web, então a raiz ("fpkt.getaura.com.br")
      // e links limpos ("/inscricao/x") caiam no app. Aqui reescrevemos para a
      // forma interna /karate/{slug}/... via router.replace (confiável).
      const micrositeSlug = getMicrositeSlug();
      if (micrositeSlug && segments[0] !== "karate") {
        const cleanPath = typeof window !== "undefined" ? window.location.pathname : "/";
        router.replace(micrositeTargetPath(micrositeSlug, cleanPath) as any);
        return;
      }
      const onPublicMicrosite = segments[0] === "karate" && (
        segments.length <= 2 ||                 // hub: /karate/{slug}
        segments[1] === "verify" ||             // carteirinha pública
        segments[1] === "carteirinha" ||        // carteirinha virtual (link compartilhável, PR#416/#417)
        segments[2] === "dojo" ||               // portal do dojô (OTP)
        segments[2] === "praticante" ||         // portal do praticante (OTP)
        segments[2] === "p" ||                  // perfil público reduzido
        segments[2] === "inscricao" ||          // inscrição pública
        segments[2] === "ranking" ||              // ranking embed
        segments[2] === "consulta" ||          // consulta publica de praticante
        segments[2] === "meus-certificados" || // participante: meus certificados
        segments[1] === "roster-update" ||     // portal do sensei: validação de quadro por token
        segments[1] === "roster-self" ||       // auto-atendimento do próprio praticante (G1 item 7)
        segments[1] === "pix"                  // página pública de pagamento PIX (Fase F4/PIX)
      );
      if (!onPublicMicrosite) {
        if (typeof window !== "undefined") window.location.href = APP_URL;
        return;
      }
      return; // rota pública do microsite: renderiza sem o guard de auth
    }

    if (!isHydrated) return;

    const inAuth     = segments[0] === "(auth)";
    const onVerify   = segments[1] === "verify-email";
    const inTabs     = segments[0] === "(tabs)";
    const onCheckout = segments[1] === "checkout";
    const emailVerified = !!(user as any)?.email_verified;

    const isInternalAura = ((user?.email || "") as string).toLowerCase().endsWith("@getaura.com.br");

    const onInvite       = segments[0] === "invite";
    const onPublicDental = segments[0] === "dental" && (segments[1] === "book" || segments[1] === "portal");
    const onPublicReport = segments[0] === "relatorios";
    // Fase 4: cardápio QR público da mesa em /m/[tableId].
    const onPublicQrTable = segments[0] === "m";
    // Fase 5: storefront público de delivery em /cardapio/[slug].
    const onPublicCardapio = segments[0] === "cardapio";
    // Fase 5 Studio: aprovação de arte pública em /aprovacao/[token]
    // (link enviado via wa.me pro cliente — não exige login).
    const onPublicApproval = segments[0] === "aprovacao";
    // Track D Karatê: páginas PÚBLICAS sob /karate (sem login). Ficam FORA do
    // grupo autenticado (federation) — que é transparente, então também tem
    // segments[0]==="karate". Distinguimos pelos marcadores públicos:
    //   /karate/verify/[token]           → verify
    //   /karate/carteirinha/[token]      → carteirinha virtual (link compartilhável, PR#416/#417)
    //   /karate/claim?t=…                → claim (F0: criação da conta do dojô por convite)
    //   /karate/[slug]/praticante        → praticante (portal OTP)
    //   /karate/[slug]/p/[publicToken]   → p (perfil público reduzido)
    //   /karate/[slug]/inscricao/[id]    → inscricao
    //   /karate/[slug]/ranking           → ranking (embed público — Track E)
    //   /karate/roster-update/[token]    → portal do sensei (validação de quadro por token)
    //   /karate/roster-self/[token]      → auto-atendimento do próprio praticante (G1 item 7)
    //   /karate/pix/[token]              → pagamento PIX da cobrança (Fase F4/PIX)
    // As rotas do shell (dojos, eventos, financeiro, importacao, praticantes…)
    // nunca batem nesses marcadores.
    const onKaratePublic = segments[0] === "karate" && (
      segments[1] === "verify" ||
      segments[1] === "carteirinha" ||  // carteirinha virtual (link compartilhável, PR#416/#417)
      segments[1] === "claim" ||    // F0 (Canal B): claim da conta do dojô por convite (?t=) — pública, sem login
      segments[2] === "praticante" ||
      segments[2] === "p" ||
      segments[2] === "inscricao" ||
      segments[2] === "ranking" ||
      segments[2] === "consulta" ||
      segments[2] === "meus-certificados" ||
      segments[1] === "roster-update" ||
      segments[1] === "roster-self" ||
      segments[1] === "pix"          // página pública de pagamento PIX (Fase F4/PIX)
    );
    if (onInvite || onPublicDental || onPublicReport || onPublicQrTable || onPublicCardapio || onPublicApproval || onKaratePublic) return;

    const onDentalClinic = segments[0] === "dental";
    const onFoodSalao    = segments[0] === "food";
    // 2026-05-25 (hotfix Sheid Mania): Studio também tem porta dedicada
    // /studio/(estudio) com shell próprio (navy + magenta).
    const onStudio       = segments[0] === "studio";

    const isOdonto = (company as any)?.vertical_active === "odonto";
    const isFood   = (company as any)?.vertical_active === "food";
    const isStudio = (company as any)?.vertical_active === "studio";
    const isKarate = ["karate_federation", "karate_dojo"]
  .includes(((company as any)?.vertical_active ?? (company as any)?.vertical) as string);
    // 2026-07-17 (hotfix FPKT): federação de karatê tem checkout próprio
    // (KarateBillingGate, montado em app/karate/(federation)/_layout.tsx —
    // valor único R$169, sem seleção de plano). Historicamente dojô NÃO
    // tinha gate próprio e por isso ficava de fora desta exclusão (senão
    // as 104 empresas karate_dojo em produção ficariam sem cobrança
    // nenhuma se saíssem do redirect genérico sem ter pra onde ir).
    // F3c (19/07): dojô ganhou o gate dele (DojoBillingGate, montado em
    // app/karate/(dojo)/_layout.tsx — R$140, contrato próprio no mesmo
    // endpoint /billing/karate-gate) — agora as DUAS verticais saem do
    // checkout genérico.
    const karateVerticalKey = ((company as any)?.vertical_active ?? (company as any)?.vertical) as string;
    const isKarateFederation = karateVerticalKey === "karate_federation";
    const isKarateDojoVertical = karateVerticalKey === "karate_dojo";

    if (!token && !inAuth) {
      router.replace("/(auth)/login");
      return;
    }

    if (token && !isDemo && user && !emailVerified && !isInternalAura && !onVerify) {
      router.replace("/(auth)/verify-email");
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && inAuth && !onVerify) {
      router.replace(
        isOdonto ? "/dental/(clinic)/hoje" :
        isFood   ? "/food/(salao)/mesas"   :
        isStudio ? "/studio/(estudio)"     :
        isKarate ? "/karate"               :
        "/(tabs)"
      );
      return;
    }
    if (token && (emailVerified || isInternalAura) && onVerify) {
      router.replace(
        isOdonto ? "/dental/(clinic)/hoje" :
        isFood   ? "/food/(salao)/mesas"   :
        isStudio ? "/studio/(estudio)"     :
        isKarate ? "/karate"               :
        "/(tabs)"
      );
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && isOdonto && inTabs && !onCheckout) {
      router.replace("/dental/(clinic)/hoje");
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && isFood && inTabs && !onCheckout) {
      router.replace("/food/(salao)/mesas");
      return;
    }

    // 2026-05-25 (hotfix Sheid Mania): mesma lógica para Studio.
    if (token && (emailVerified || isDemo || isInternalAura) && isStudio && inTabs && !onCheckout) {
      router.replace("/studio/(estudio)");
      return;
    }

    if (token && (emailVerified || isDemo || isInternalAura) && isKarate && inTabs && !onCheckout) {
      router.replace("/karate");
      return;
    }

    const billingStatus    = (company as any)?.billing_status;
    const hasActiveBilling = billingStatus === "active" || trialActive;
    const memberRole       = (company as any)?.member_role || "owner";
    const isOwner          = memberRole === "owner";
    // 2026-07-17 (hotfix FPKT) + F3c (19/07): federação E dojô de karatê são
    // excluídos do checkout genérico — cada um tem o gate próprio dele
    // (KarateBillingGate / DojoBillingGate, ver comentário acima). Sem essa
    // exclusão o redirect de 2026-06-18 (dispara em QUALQUER rota
    // autenticada) arranca o usuário de /karate antes do gate montar.
    const needsCheckout    = !isDemo && !isStaff && emailVerified && !!company && isOwner && !hasActiveBilling && !isKarateFederation && !isKarateDojoVertical;

    // 2026-06-18: removida a condição de rota (inTabs || onDentalClinic || …).
    // O redirect agora dispara de QUALQUER rota autenticada, incluindo /empresas.
    // Antes, usuário com billing inativo que chegava em /empresas ficava preso
    // sem nunca ser encaminhado ao checkout.
    if (token && needsCheckout && !onCheckout) {
      router.replace("/(tabs)/checkout");
      return;
    }
  }, [token, user, company, isHydrated, isDemo, isStaff, trialActive, segments]);

  return (
    <>
      <Slot />
      {karateIntroPending && <KarateLoginTransition onDone={consumeKarateIntro} />}
    </>
  );
}

export default function RootLayout() {
  // 26/05/2026 (fix critico): StudioThemeProvider envolve TUDO pra que
  // useStudioTokens()/useStudioTheme() funcionem nas telas /studio/*.
  // Antes nao estava montado — toggle de tema era no-op silencioso.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StudioThemeProvider>
          <AuthGuard />
          <LGPDConsent />
          <UpdateBanner />
        </StudioThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
