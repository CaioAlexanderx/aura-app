import { View, Text, StyleSheet } from "react-native";
import { useVerticalTheme } from "@/hooks/useVerticalTheme";
import { Colors } from "@/constants/colors";
import type { ModuleKey } from "@/hooks/useModules";

// ============================================================
// VER-02e: Themed empty states per vertical
// Shows a contextual empty state when a screen has no data
// ============================================================

interface Props {
  screen: string;
  title?: string;
  message?: string;
  moduleKey?: ModuleKey;
}

const EMPTY_STATES: Record<string, { icon: string; title: string; message: string }> = {
  // Core screens
  dashboard:      { icon: "\u2B50", title: "Bem-vindo ao Painel",     message: "Seus KPIs aparecerao aqui conforme voce registra vendas e lancamentos." },
  financeiro:     { icon: "\uD83D\uDCB0", title: "Nenhum lancamento",     message: "Registre receitas e despesas para acompanhar seu financeiro." },
  pdv:            { icon: "\uD83D\uDED2", title: "Nenhuma venda hoje",    message: "Adicione produtos e faca sua primeira venda." },
  estoque:        { icon: "\uD83D\uDCE6", title: "Estoque vazio",         message: "Cadastre seus produtos para controlar o estoque." },
  clientes:       { icon: "\uD83D\uDC65", title: "Nenhum cliente",        message: "Seus clientes aparecerao aqui apos a primeira venda." },
  contabilidade:  { icon: "\uD83D\uDCC5", title: "Calendario limpo",      message: "Suas obrigacoes fiscais aparecerao conforme o regime tributario." },
  nfe:            { icon: "\uD83D\uDCC4", title: "Nenhuma nota emitida",  message: "Notas fiscais serao listadas aqui apos emissao." },

  // Dental
  "odonto-agenda":      { icon: "\uD83E\uDE77", title: "Nenhum agendamento",  message: "Agende a primeira consulta do dia." },
  "odonto-pacientes":   { icon: "\uD83E\uDE77", title: "Nenhum paciente",     message: "Cadastre seu primeiro paciente para comecar." },
  "odonto-odontograma": { icon: "\uD83E\uDE77", title: "Selecione um paciente", message: "Escolha um paciente para visualizar o odontograma." },
  "odonto-orcamento":   { icon: "\uD83E\uDE77", title: "Nenhum orcamento",    message: "Crie um plano de tratamento para gerar orcamentos." },

  // Barber
  "barber-agenda":      { icon: "\u2702\uFE0F", title: "Agenda livre",         message: "Nenhum agendamento para hoje. Adicione um cliente ou abra a fila." },
  "barber-fila":        { icon: "\u2702\uFE0F", title: "Fila vazia",           message: "Ninguem na fila no momento." },
  "barber-comissoes":   { icon: "\u2702\uFE0F", title: "Sem comissoes",        message: "Comissoes aparecerao apos o primeiro atendimento do mes." },
  "barber-pacotes":     { icon: "\u2702\uFE0F", title: "Nenhum pacote",        message: "Crie pacotes e clubes de assinatura para fidelizar clientes." },
};

export function VerticalEmptyState({ screen, title, message, moduleKey }: Props) {
  const theme = useVerticalTheme(moduleKey);

  const key = moduleKey ? `${moduleKey}-${screen}` : screen;
  const preset = EMPTY_STATES[key] || EMPTY_STATES[screen] || {
    icon: "\uD83D\uDCCA",
    title: "Nenhum dado",
    message: "Os dados aparecerao aqui conforme voce utiliza o sistema.",
  };

  const displayTitle = title || preset.title;
  const displayMessage = message || preset.message;
  const accentColor = theme.isVerticalActive ? theme.accent : (Colors.violet || "#6d28d9");
  const accentBg = theme.isVerticalActive ? theme.accentDark : (Colors.violetD || "rgba(109,40,217,0.12)");

  return (
    <View style={s.container}>
      <View style={[s.iconCircle, { backgroundColor: accentBg }]}>
        <Text style={s.icon}>{preset.icon}</Text>
      </View>
      <Text style={s.title}>{displayTitle}</Text>
      <Text style={s.message}>{displayMessage}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.ink || "#fff",
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: Colors.ink3 || "#888",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
});
