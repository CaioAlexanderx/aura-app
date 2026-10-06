// ============================================================
// AURA. — components/screens/configuracoes/WarrantyTermsEditor.tsx
//
// Modelo dos termos que saem impressos no certificado de garantia. Vem um
// texto padrão da Aura (pdv_settings.warranty_terms vazio = padrão) e o
// lojista edita uma vez. O texto vigente é congelado em cada garantia
// emitida: mudar o modelo não altera o que o cliente já recebeu.
//
// Formato: "## Título" abre uma seção, "- item" é marcador, o resto é parágrafo.
// ============================================================
import { useEffect, useState } from "react";
import { tourTarget } from "@/utils/tourTarget";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { useAuthStore } from "@/stores/auth";
import { pdvSettingsApi } from "@/services/authApi";
import { warrantiesApi } from "@/services/warrantiesApi";

export function WarrantyTermsEditor() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["warranty-terms", company?.id],
    queryFn: () => warrantiesApi.terms(company!.id),
    enabled: open && !!company?.id,
    staleTime: 0,
  });
  useEffect(() => { if (data) setText(data.terms); }, [data]);

  async function salvar(valor: string | null) {
    if (!company?.id || saving) return;
    setSaving(true);
    try {
      await pdvSettingsApi.save(company.id, { warranty_terms: valor } as any);
      qc.invalidateQueries({ queryKey: ["warranty-terms"] });
      qc.invalidateQueries({ queryKey: ["pdv-settings"] });
      toast.success(valor ? "Termos salvos" : "Voltou ao modelo padrão");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.error || "Não deu para salvar os termos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.link} testID="warranty-terms-open" {...tourTarget("config.termo_garantia")}>
        <Icon name="shield" size={14} color={Colors.violet3} />
        <Text style={s.linkText}>Termos da garantia</Text>
        <Icon name="chevron_right" size={14} color={Colors.ink3} />
      </Pressable>

      <ResponsiveSheet visible={open} onClose={() => setOpen(false)} maxWidth={560}>
        <View style={s.head}>
          <Text style={s.title}>Termos da garantia</Text>
          <Pressable onPress={() => setOpen(false)} hitSlop={10}><Icon name="x" size={16} color={Colors.ink3} /></Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.hint}>
            Sai impresso em toda garantia. Use “## Título” para abrir uma seção e “- ” para marcadores.
            Alterar aqui não muda garantias já emitidas.
          </Text>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            maxLength={6000}
            testID="warranty-terms-input"
          />
        </ScrollView>
        <View style={s.foot}>
          <Pressable onPress={() => data && setText(data.default_terms)} style={s.ghost}>
            <Text style={s.ghostText}>Modelo padrão</Text>
          </Pressable>
          <Pressable
            onPress={() => salvar(data && text.trim() === data.default_terms.trim() ? null : text.trim() || null)}
            style={s.btn}
            disabled={saving}
            testID="warranty-terms-save"
          >
            <Text style={s.btnText}>{saving ? "Salvando…" : "Salvar"}</Text>
          </Pressable>
        </View>
      </ResponsiveSheet>
    </>
  );
}

const s = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  linkText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.violet3 },
  head: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.ink },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  hint: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  input: {
    minHeight: 320, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, backgroundColor: Colors.bg2,
    padding: 12, fontSize: 12.5, lineHeight: 18, color: Colors.ink,
  },
  foot: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 10 },
  ghost: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  ghostText: { color: Colors.ink2, fontWeight: "700", fontSize: 13 },
  btn: { flex: 1.4, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.violet },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
