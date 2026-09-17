// ============================================================
// AURA. — ContactActions (odonto QA, 2026-09-16)
//
// Botões de contato reutilizáveis: WhatsApp (MANUAL — abre o app com o
// texto pronto, nada é enviado pela Aura) e Ligar (abre o discador).
//
// Sem telefone cadastrado: não mostra os botões, mostra o texto "Sem
// telefone cadastrado" no lugar (nunca um botão desabilitado).
//
// Variantes:
//   - "icon":    só o ícone, circular — pra linhas de lista compactas
//                (Hoje, Lista de agendamentos). SEMPRE visível — nunca
//                hover-reveal (CLAUDE.md #7: quebra em touch).
//   - "compact": ícone + rótulo curto em pill pequena — pra caber ao
//                lado de outras ações num modal (detalhe do agendamento).
//   - "labeled": ícone + rótulo completo, botão maior — cabeçalhos
//                (ficha do paciente).
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { openWhatsApp, openTel } from "@/utils/whatsapp";

export type ContactActionsVariant = "icon" | "compact" | "labeled";

interface Props {
  /** Telefone do paciente, como veio do cadastro (qualquer formatação). */
  phone?: string | null;
  /** Texto pronto pro WhatsApp (confirmação, saudação genérica etc.). */
  whatsappText?: string;
  variant?: ContactActionsVariant;
  /** Esconde o botão "Ligar", mantendo só o WhatsApp. Default: mostra os dois. */
  showCall?: boolean;
  /** Nome do paciente (ou contexto) pro accessibilityLabel — "WhatsApp de Ana". */
  contactName?: string;
}

export function ContactActions({
  phone,
  whatsappText,
  variant = "compact",
  showCall = true,
  contactName,
}: Props) {
  const ctx = contactName ? ` de ${contactName}` : "";

  if (!phone) {
    if (variant === "icon") return null; // linha de lista: sem telefone, sem ícone quebrado
    return (
      <Text style={s.noPhone}>Sem telefone cadastrado</Text>
    );
  }

  if (variant === "icon") {
    return (
      <View style={s.iconRow}>
        <Pressable
          onPress={() => openWhatsApp(phone, whatsappText)}
          style={[s.iconBtn, s.iconBtnWa]}
          accessibilityLabel={`WhatsApp${ctx}`}
          hitSlop={6}
        >
          <Icon name="whatsapp" size={12} color="#fff" />
        </Pressable>
        {showCall && (
          <Pressable
            onPress={() => openTel(phone)}
            style={[s.iconBtn, s.iconBtnCall]}
            accessibilityLabel={`Ligar${ctx}`}
            hitSlop={6}
          >
            <Icon name="call" size={12} color="#fff" />
          </Pressable>
        )}
      </View>
    );
  }

  const labeled = variant === "labeled";

  return (
    <View style={s.row}>
      <Pressable
        onPress={() => openWhatsApp(phone, whatsappText)}
        style={[s.btn, s.btnWa, labeled && s.btnLabeled]}
        accessibilityLabel={`WhatsApp${ctx}`}
      >
        <Icon name="whatsapp" size={labeled ? 15 : 13} color="#fff" />
        <Text style={[s.btnText, labeled && s.btnTextLabeled]}>WhatsApp</Text>
      </Pressable>
      {showCall && (
        <Pressable
          onPress={() => openTel(phone)}
          style={[s.btn, s.btnCall, labeled && s.btnLabeled]}
          accessibilityLabel={`Ligar${ctx}`}
        >
          <Icon name="call" size={labeled ? 15 : 13} color="#fff" />
          <Text style={[s.btnText, labeled && s.btnTextLabeled]}>Ligar</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  noPhone: { fontSize: 12, color: "#64748B", fontStyle: "italic" },

  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
  },
  btnLabeled: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9 },
  btnWa: { backgroundColor: "#25D366" },
  btnCall: { backgroundColor: "#6d28d9" },
  btnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  btnTextLabeled: { fontSize: 12 },

  iconRow: { flexDirection: "row", gap: 5 },
  iconBtn: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  iconBtnWa: { backgroundColor: "#25D366" },
  iconBtnCall: { backgroundColor: "#6d28d9" },
});

export default ContactActions;
