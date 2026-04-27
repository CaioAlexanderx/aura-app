// ============================================================
// DentalQuickActions — atalhos com glow (PR16).
//
// Padrao do shell negocio (QuickAction com radial glow inferior),
// adaptado pra rotas dentais. Persona-aware: dentista ve atalhos
// clinicos; recepcao/gestor focam em cobranca/agenda/relatorios.
// ============================================================

import { View, Text, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";
import type { DentalPersona } from "@/hooks/useDentalPersona";

interface ActionDef {
  label: string;
  icon: string;
  href: string;
  color?: string;
}

const ACTIONS_BY_PERSONA: Record<DentalPersona, ActionDef[]> = {
  dentista: [
    { label: "Pacientes",     icon: "users",     href: "/dental/(clinic)/pacientes" },
    { label: "Agenda",        icon: "calendar",  href: "/dental/(clinic)/agenda" },
    { label: "Tratamentos",   icon: "tag",       href: "/dental/(clinic)/tratamentos", color: DentalColors.violet },
    { label: "Comunicacao",   icon: "message",   href: "/dental/(clinic)/comunicacao", color: DentalColors.amber },
    { label: "Materiais",     icon: "box",       href: "/dental/(clinic)/materiais", color: DentalColors.green },
    { label: "Faturamento",   icon: "dollar",    href: "/dental/(clinic)/faturamento" },
  ],
  recepcao: [
    { label: "Agenda",        icon: "calendar",  href: "/dental/(clinic)/agenda" },
    { label: "Pacientes",     icon: "users",     href: "/dental/(clinic)/pacientes" },
    { label: "Faturamento",   icon: "dollar",    href: "/dental/(clinic)/faturamento" },
    { label: "Comunicacao",   icon: "message",   href: "/dental/(clinic)/comunicacao", color: DentalColors.amber },
    { label: "Tratamentos",   icon: "tag",       href: "/dental/(clinic)/tratamentos", color: DentalColors.violet },
    { label: "Clinica",       icon: "settings",  href: "/dental/(clinic)/clinica" },
  ],
  gestor: [
    { label: "Faturamento",   icon: "dollar",    href: "/dental/(clinic)/faturamento" },
    { label: "Pacientes",     icon: "users",     href: "/dental/(clinic)/pacientes" },
    { label: "Agenda",        icon: "calendar",  href: "/dental/(clinic)/agenda" },
    { label: "Tratamentos",   icon: "tag",       href: "/dental/(clinic)/tratamentos", color: DentalColors.violet },
    { label: "Materiais",     icon: "box",       href: "/dental/(clinic)/materiais", color: DentalColors.green },
    { label: "Clinica",       icon: "settings",  href: "/dental/(clinic)/clinica" },
  ],
};

interface Props {
  persona: DentalPersona;
}

export function DentalQuickActions({ persona }: Props) {
  const router = useRouter();
  const actions = ACTIONS_BY_PERSONA[persona] || ACTIONS_BY_PERSONA.dentista;

  return (
    <View style={{
      flexDirection: "row", flexWrap: "wrap", gap: 10,
      marginBottom: 10,
    }}>
      {actions.map((a, i) => {
        const c = a.color || DentalColors.cyan;
        return (
          <Pressable
            key={i}
            onPress={() => router.push(a.href as any)}
            style={({ hovered }: any) => [{
              flex: 1, minWidth: 140,
              backgroundColor: DentalColors.bg2,
              borderWidth: 1, borderColor: DentalColors.border,
              borderRadius: 14, padding: 14,
              alignItems: "flex-start", gap: 8,
              overflow: "hidden",
              position: "relative",
              ...(Platform.OS === "web" ? {
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                transition: "transform 0.2s ease, border-color 0.2s ease",
                cursor: "pointer",
                ...(hovered ? { borderColor: c + "60", transform: "translateY(-2px)" } : {}),
              } as any : {}),
            }]}
          >
            <View style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: c + "20",
              alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={a.icon as any} size={16} color={c} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: DentalColors.ink }}>
              {a.label}
            </Text>

            {/* Glow radial inferior */}
            {Platform.OS === "web" ? (
              <View style={{
                position: "absolute", bottom: -40, left: "30%",
                width: 80, height: 80, borderRadius: 9999,
                pointerEvents: "none", opacity: 0.28,
                background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
                filter: "blur(12px)",
              } as any} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
