import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi } from "@/services/creditApi";
import { toast } from "@/components/Toast";

// Configurações do Crediário.
// A régua de cobrança automática foi removida por ora — depende do Hub Social /
// API do WhatsApp, que ainda não está disponível. Por enquanto a tela cuida
// apenas da chave Pix usada na mensagem de cobrança manual (wa.me).
export default function CrediarioSettingsScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [pixKey, setPixKey] = useState("");
  const [dirty, setDirty] = useState(false);

  const rulesQ = useQuery({
    queryKey: ["credit-rules", company?.id],
    queryFn: () => creditApi.getCollectionRules(company!.id),
    enabled: !!company?.id,
  });

  useEffect(() => {
    if (!rulesQ.data) return;
    setPixKey((rulesQ.data as any).pix_key || "");
  }, [rulesQ.data]);

  const saveMut = useMutation({
    // Preserva enabled/rules existentes (não destrói régua salva) e grava só a chave Pix.
    mutationFn: () => creditApi.updateCollectionRules(company!.id, {
      enabled: (rulesQ.data as any)?.enabled ?? true,
      rules: (rulesQ.data as any)?.rules ?? null,
      pix_key: pixKey.trim(),
    } as any),
    onSuccess: () => {
      toast.success("Configurações salvas!");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["credit-rules", company?.id] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar"),
  });

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Icon name="chevron_right" size={16} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
          <Text style={st.backText}>Crediário</Text>
        </Pressable>
      </View>

      <Text style={st.pageTitle}>Configurações do Crediário</Text>
      <Text style={st.pageSubtitle}>
        Cadastre a chave Pix da loja. Ela entra automaticamente na mensagem de cobrança do WhatsApp, pronta para o cliente pagar.
      </Text>

      {rulesQ.isLoading ? (
        <View style={st.loadingBox}>
          <ActivityIndicator color={Colors.violet3} />
        </View>
      ) : (
        <>
          <Text style={st.sectionTitle}>Chave Pix para cobrança</Text>
          <View style={st.pixCard}>
            <Icon name="dollar" size={16} color={Colors.violet3} />
            <TextInput
              style={st.pixInput}
              value={pixKey}
              onChangeText={(v) => { setPixKey(v); setDirty(true); }}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              placeholderTextColor={Colors.ink3}
              autoCapitalize="none"
            />
          </View>
          <Text style={st.pixHint}>
            A cobrança automática por etapas (régua) chega quando o WhatsApp da loja estiver conectado. Por enquanto, a cobrança é manual pelo botão de WhatsApp em cada cliente.
          </Text>

          <Pressable
            onPress={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
            style={[st.saveBtn, (!dirty || saveMut.isPending) && st.saveBtnDisabled]}
          >
            {saveMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.saveBtnText}>Salvar alterações</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 48, maxWidth: 640, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 22 },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10 },
  pixCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border2 },
  pixInput: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "600", paddingVertical: 0 },
  pixHint: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16, marginTop: 8, marginBottom: 24 },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
