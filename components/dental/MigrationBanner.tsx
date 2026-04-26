import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { DentalColors, SMILE_ARC_PATH } from "@/constants/dental-tokens";

// ============================================================
// MigrationBanner — banner de boas-vindas / explicação do shell
// dental dedicado.
//
// Aparece UMA vez por device (persistencia em localStorage), web
// only. Conta pro usuário onde foram parar os módulos genéricos
// (Aura Negócio) que ele talvez procure por hábito.
//
// Para reaparecer: limpar a key abaixo no DevTools.
// ============================================================

const LS_KEY = "aura_dental_welcome_dismissed_v1";

export function MigrationBanner() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem(LS_KEY);
      if (!dismissed) setShow(true);
    } catch {
      // localStorage indisponível (modo privado, etc) — simplesmente não mostra.
    }
  }, []);

  function dismiss() {
    setShow(false);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.localStorage.setItem(LS_KEY, "1"); } catch {}
    }
  }

  if (!show || Platform.OS !== "web") return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "linear-gradient(135deg, rgba(6,182,212,0.10), rgba(124,58,237,0.06))",
      border: "1px solid " + DentalColors.cyanBorder,
      borderRadius: 14, padding: 14,
      marginBottom: 18,
    } as any}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: "linear-gradient(135deg, #06B6D4, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      } as any}
        dangerouslySetInnerHTML={{ __html:
          `<svg width="22" height="22" viewBox="0 0 32 32" fill="none"><path d="${SMILE_ARC_PATH}" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`
        }}
      />

      <div style={{ flex: 1, minWidth: 0 } as any}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DentalColors.ink, marginBottom: 2 } as any}>
          Bem-vindo à Aura Odonto
        </div>
        <div style={{ fontSize: 12, color: DentalColors.ink2, lineHeight: 1.5 } as any}>
          Este é o shell dedicado da sua clínica. Os módulos gerais
          (PDV, NF-e, Folha) continuam acessíveis pelo botão
          {" "}<span
            onClick={() => router.push("/(tabs)" as any)}
            style={{ color: DentalColors.cyan, fontWeight: 600, cursor: "pointer", textDecoration: "underline" } as any}
          >Aura Negócio</span> no rodapé do menu lateral.
        </div>
      </div>

      <button
        onClick={dismiss}
        style={{
          background: DentalColors.cyan, color: "#fff",
          border: "none", borderRadius: 8,
          padding: "8px 14px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", flexShrink: 0,
        } as any}
      >Entendi</button>
    </div>
  );
}

export default MigrationBanner;
