// ============================================================
// AURA. — Calendário para escolher UM dia (25/09/2026)
//
// Primeiro uso: filtro "Cadastrados" das Etiquetas. O app é PWA; antes o
// ícone abria o calendário do navegador por um <input type="date">
// escondido, que no iPhone não abre de forma confiável a partir de um
// campo invisível. Agora o calendário é nosso (react-native-calendars,
// JS puro, funciona no react-native-web) e fica igual em todo aparelho.
//
// Português, sem dia futuro (maxDate), e os dias com algo cadastrado
// ganham um ponto (marcasDoCalendario em utils/etiquetasFiltro).
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Colors } from "@/constants/colors";

LocaleConfig.locales["pt-br"] = {
  monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
  monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  dayNamesShort: ["D", "S", "T", "Q", "Q", "S", "S"],
  today: "Hoje",
};
LocaleConfig.defaultLocale = "pt-br";

type Marca = { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string };

export function CalendarioDoDia({ value, maxDate, marcas, legenda, onEscolher, onLimpar, testID }: {
  /** AAAA-MM-DD ou null. */
  value: string | null;
  /** AAAA-MM-DD — dias depois deste ficam desabilitados. */
  maxDate?: string;
  marcas: Record<string, Marca>;
  /** Texto curto sob o calendário (ex.: o que o ponto significa). */
  legenda?: string;
  onEscolher: (iso: string) => void;
  onLimpar?: () => void;
  testID?: string;
}) {
  return (
    <View style={st.painel} testID={testID}>
      <Calendar
        current={value || maxDate}
        maxDate={maxDate}
        markedDates={marcas}
        onDayPress={(d: { dateString: string }) => onEscolher(d.dateString)}
        firstDay={0}
        enableSwipeMonths
        theme={{
          calendarBackground: Colors.bg3,
          monthTextColor: Colors.ink,
          textMonthFontWeight: "700",
          textMonthFontSize: 14,
          textSectionTitleColor: Colors.ink3,
          dayTextColor: Colors.ink,
          todayTextColor: Colors.violet3,
          textDisabledColor: Colors.ink3 + "66",
          arrowColor: Colors.violet3,
          selectedDayBackgroundColor: Colors.violet,
          selectedDayTextColor: "#ffffff",
          textDayFontSize: 13,
          textDayHeaderFontSize: 11,
        }}
      />
      <View style={st.rodape}>
        {legenda ? (
          <View style={st.legenda}>
            <View style={st.ponto} />
            <Text style={st.legendaTxt}>{legenda}</Text>
          </View>
        ) : <View />}
        {value && onLimpar ? (
          <Pressable onPress={onLimpar} style={st.limpar} testID={testID ? testID + "-limpar" : undefined}>
            <Text style={st.limparTxt}>Limpar dia</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  painel: { width: 300, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, paddingBottom: 8, overflow: "hidden" },
  rodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 4 },
  legenda: { flexDirection: "row", alignItems: "center", gap: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet3 },
  legendaTxt: { fontSize: 11, color: Colors.ink3 },
  limpar: { paddingVertical: 4, paddingHorizontal: 6 },
  limparTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },
});
