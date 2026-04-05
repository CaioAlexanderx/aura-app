import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// D-18: FichaEspecialidade — Specialty-specific clinical forms

const SPECIALTIES: Record<string, { label: string; icon: string; fields: string[] }> = {
  ortodontia: { label: "Ortodontia", icon: "\u{1F9B7}", fields: ["Classificacao de Angle","Overjet","Overbite","Tipo aparelho","Fase tratamento","Alinhador numero","Proxima troca"] },
  endodontia: { label: "Endodontia", icon: "\u{1FA7A}", fields: ["Dente","Numero canais","Comprimento trabalho","Limas utilizadas","Cone principal","Cimento","Obturacao"] },
  periodontia: { label: "Periodontia", icon: "\u{1F9EC}", fields: ["Classificacao doenca","Extensao","Estagio","Grau","Sangramento","Plano tratamento perio"] },
  cirurgia: { label: "Cirurgia", icon: "\u{1FA78}", fields: ["Tipo cirurgia","Anestesia","Tecnica","Complicacoes","Pontos","Retorno"] },
  implante: { label: "Implante", icon: "\u{1F9F4}", fields: ["Regiao","Marca implante","Diametro","Comprimento","Torque","Tipo conexao","Pilar"] },
  protese: { label: "Protese", icon: "\u{1F9B4}", fields: ["Tipo protese","Material","Cor","Moldagem","Prova","Cimentacao","Laboratorio"] },
};

export interface SpecialtyForm { id: string; patient_id: string; specialty: string; form_data: Record<string, any>; professional_id?: string; notes?: string; created_at: string; }

interface Props { forms: SpecialtyForm[]; patientName?: string; onAddForm?: (specialty: string) => void; onViewForm?: (formId: string) => void; }

export function FichaEspecialidade({ forms, patientName, onAddForm, onViewForm }: Props) {
  const grouped = Object.entries(SPECIALTIES).map(([key, spec]) => ({ key, ...spec, forms: forms.filter(f => f.specialty === key) }));

  return (
    <View style={s.container}>
      <Text style={s.title}>Fichas por especialidade{patientName ? " \u2014 " + patientName : ""}</Text>
      <View style={s.grid}>
        {grouped.map(g => (
          <View key={g.key} style={s.specCard}>
            <View style={s.specHeader}><Text style={s.specIcon}>{g.icon}</Text><Text style={s.specName}>{g.label}</Text><Text style={s.specCount}>{g.forms.length}</Text></View>
            <Text style={s.specFields}>{g.fields.slice(0, 3).join(" \u2022 ")}...</Text>
            {g.forms.slice(0, 2).map(f => (
              <Pressable key={f.id} onPress={() => onViewForm?.(f.id)} style={s.formRow}>
                <Text style={s.formDate}>{new Date(f.created_at).toLocaleDateString("pt-BR")}</Text>
                <Text style={s.formPreview} numberOfLines={1}>{Object.entries(f.form_data).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(", ")}</Text>
              </Pressable>
            ))}
            {onAddForm && <Pressable onPress={() => onAddForm(g.key)} style={s.addFormBtn}><Text style={s.addFormBtnT}>+ Nova ficha</Text></Pressable>}
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 }, title: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  specCard: { minWidth: 180, flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  specHeader: { flexDirection: "row", alignItems: "center", gap: 6 }, specIcon: { fontSize: 18 }, specName: { fontSize: 14, fontWeight: "700", color: Colors.ink, flex: 1 },
  specCount: { fontSize: 12, fontWeight: "600", color: "#06B6D4", backgroundColor: "rgba(6,182,212,0.12)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  specFields: { fontSize: 10, color: Colors.ink3 },
  formRow: { flexDirection: "row", gap: 6, paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: Colors.border },
  formDate: { fontSize: 10, color: Colors.ink3, width: 55 }, formPreview: { fontSize: 11, color: Colors.ink2, flex: 1 },
  addFormBtn: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5, borderColor: "#06B6D4" }, addFormBtnT: { fontSize: 10, color: "#06B6D4", fontWeight: "600" },
});

export default FichaEspecialidade;
