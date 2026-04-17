import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { BASE_URL } from "@/services/api";
import { toast } from "@/components/Toast";

var isWeb = Platform.OS === "web";

type Props = {
  obligationCode: string;
  stepIndex: number;
  completed: boolean;
};

// Mapeamento: obligation code → endpoint + label + step onde aparece
var PDF_CONFIG: Record<string, { path: string; label: string; icon: string; step: number }[]> = {
  das_mei:    [{ path: "/obligations/das-mei/pdf", label: "Baixar resumo DAS-MEI", icon: "file_text", step: 0 }],
  das_sn:     [{ path: "/obligations/das-sn/pdf", label: "Baixar demonstrativo DAS", icon: "file_text", step: 2 }],
  dasn_simei: [{ path: "/obligations/dasn/report", label: "Baixar relatorio anual", icon: "file_text", step: 0 }],
  pgdas_d:    [{ path: "/obligations/das-sn/pdf", label: "Baixar demonstrativo DAS", icon: "file_text", step: 0 }],
  // Fase 2
  prolabore:  [{ path: "/obligations/gps/pdf", label: "Baixar guia GPS/DARF", icon: "file_text", step: 1 }],
  defis:      [{ path: "/obligations/defis/report", label: "Baixar relatorio anual DEFIS", icon: "file_text", step: 0 }],
  esocial:    [{ path: "/obligations/esocial/summary", label: "Baixar resumo da folha", icon: "file_text", step: 0 }],
  fgts:       [{ path: "/obligations/fgts/pdf", label: "Baixar guia FGTS", icon: "file_text", step: 0 }],
};

export function FiscalPdfButton({ obligationCode, stepIndex, completed }: Props) {
  var { company, token } = useAuthStore();
  var [loading, setLoading] = useState(false);

  var configs = PDF_CONFIG[obligationCode];
  if (!configs) return null;

  var config = configs.find(function(c) { return c.step === stepIndex; });
  if (!config || completed) return null;

  function handleOpen() {
    if (!company?.id || !token || !config) { toast.error("Sessao expirada"); return; }
    setLoading(true);
    var url = BASE_URL + "/companies/" + company.id + config.path;

    if (isWeb && typeof window !== "undefined") {
      fetch(url, { headers: { Authorization: "Bearer " + token } })
        .then(function(res) {
          if (!res.ok) throw new Error("Erro " + res.status);
          return res.text();
        })
        .then(function(html) {
          var w = window.open("", "_blank");
          if (w) { w.document.write(html); w.document.close(); }
          else { toast.error("Popup bloqueado. Permita popups para este site."); }
        })
        .catch(function(err) { toast.error(err.message || "Erro ao gerar PDF"); })
        .finally(function() { setLoading(false); });
    } else {
      Linking.openURL(url).catch(function() { toast.error("Erro ao abrir"); });
      setLoading(false);
    }
  }

  return (
    <View style={s.wrap}>
      <Pressable onPress={handleOpen} disabled={loading} style={[s.btn, loading && { opacity: 0.6 }]}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.violet3} />
        ) : (
          <Icon name={config.icon} size={14} color={Colors.violet3} />
        )}
        <Text style={s.btnText}>{config.label}</Text>
        <Text style={s.arrow}>\u2197</Text>
      </Pressable>
      <Text style={s.hint}>Abre em nova aba. Use Ctrl+P para salvar como PDF.</Text>
    </View>
  );
}

var s = StyleSheet.create({
  wrap: { marginTop: 12, marginLeft: 48, gap: 6 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border2, alignSelf: "flex-start" },
  btnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  arrow: { fontSize: 12, color: Colors.violet3 },
  hint: { fontSize: 9, color: Colors.ink3 },
});

export default FiscalPdfButton;
