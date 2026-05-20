// ============================================================
// MP Fase 0 — Card de configuracao do Mercado Pago
// Exibe estado "nao configurado" ou "configurado" com tokens mascarados.
// Permite salvar novas credenciais e remover o gateway.
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { cs } from "./shared";
import { usePaymentGateways } from "@/hooks/usePaymentGateways";

export function MpGatewayCard() {
  const { mpGateway, isLoading, saveGateway, isSaving, removeGateway, isRemoving } = usePaymentGateways();

  const [editing, setEditing]         = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey]     = useState("");
  const [sandbox, setSandbox]         = useState(true);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const configured = !!mpGateway;

  function openForm() {
    setAccessToken("");
    setPublicKey("");
    setSandbox(mpGateway?.sandbox ?? true);
    setEditing(true);
    setShowRemoveConfirm(false);
  }

  async function handleSave() {
    if (!accessToken.trim()) { toast.error("Informe o Access Token"); return; }
    if (!publicKey.trim())   { toast.error("Informe a Public Key"); return; }
    await saveGateway({ gateway: "mercadopago", access_token: accessToken.trim(), public_key: publicKey.trim(), sandbox });
    setEditing(false);
    setAccessToken("");
    setPublicKey("");
  }

  async function handleRemove() {
    await removeGateway("mercadopago");
    setShowRemoveConfirm(false);
    setEditing(false);
  }

  if (isLoading) {
    return (
      <View style={[cs.card, s.loadingRow]}>
        <ActivityIndicator size="small" color={Colors.violet3} />
        <Text style={s.loadingText}>Verificando gateway...</Text>
      </View>
    );
  }

  // ── Estado: configurado (mostra tokens mascarados + acoes) ──────────
  if (configured && !editing) {
    return (
      <View style={cs.card}>
        <View style={s.header}>
          <View style={s.mpLogo}>
            <Text style={s.mpLogoText}>MP</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Mercado Pago</Text>
            <Text style={s.subtitle}>Cartao de credito e debito (Fase 1)</Text>
          </View>
          <View style={[s.badge, mpGateway.sandbox ? s.badgeSandbox : s.badgeProd]}>
            <Text style={[s.badgeText, mpGateway.sandbox ? s.badgeTextSandbox : s.badgeTextProd]}>
              {mpGateway.sandbox ? "Sandbox" : "Producao"}
            </Text>
          </View>
        </View>

        <View style={cs.divider} />

        <View style={s.tokenRow}>
          <Text style={s.tokenLabel}>Access Token</Text>
          <Text style={s.tokenValue}>{mpGateway.access_token_masked}</Text>
        </View>
        <View style={s.tokenRow}>
          <Text style={s.tokenLabel}>Public Key</Text>
          <Text style={s.tokenValue}>{mpGateway.public_key_masked}</Text>
        </View>

        <View style={cs.divider} />

        {showRemoveConfirm ? (
          <View style={s.confirmRow}>
            <Text style={s.confirmText}>Remover o Mercado Pago desta loja?</Text>
            <View style={s.confirmBtns}>
              <Pressable onPress={() => setShowRemoveConfirm(false)} style={s.cancelBtn}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleRemove} disabled={isRemoving} style={[s.removeBtn, isRemoving && { opacity: 0.6 }]}>
                <Text style={s.removeBtnText}>{isRemoving ? "Removendo..." : "Confirmar"}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={s.actionsRow}>
            <Pressable onPress={openForm} style={s.editBtn}>
              <Icon name="edit" size={13} color={Colors.violet3} />
              <Text style={s.editBtnText}>Atualizar credenciais</Text>
            </Pressable>
            <Pressable onPress={() => setShowRemoveConfirm(true)} style={s.removeBtnGhost}>
              <Text style={s.removeBtnGhostText}>Remover</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ── Estado: formulario (novo ou edicao) ─────────────────────────────
  return (
    <View style={cs.card}>
      <View style={s.header}>
        <View style={s.mpLogo}>
          <Text style={s.mpLogoText}>MP</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Mercado Pago</Text>
          <Text style={s.subtitle}>{configured ? "Atualizar credenciais" : "Aceitar cartao de credito e debito"}</Text>
        </View>
      </View>

      <View style={cs.divider} />

      <View style={[cs.infoCard, { marginBottom: 12 }]}>
        <Icon name="alert" size={13} color={Colors.violet3} />
        <Text style={cs.infoText}>
          Acesse mercadopago.com.br → Seu negocio → Credenciais para encontrar os tokens.
          Use Sandbox para testes e Producao para receber de verdade.
        </Text>
      </View>

      {/* Toggle sandbox / producao */}
      <View style={cs.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={cs.switchLabel}>Modo sandbox (testes)</Text>
          <Text style={cs.switchHint}>{sandbox ? "Pagamentos simulados, sem dinheiro real" : "Pagamentos reais — use credenciais de Producao"}</Text>
        </View>
        <Switch
          value={sandbox}
          onValueChange={setSandbox}
          trackColor={{ true: Colors.amber, false: Colors.green }}
          thumbColor="#fff"
        />
      </View>
      <View style={cs.divider} />

      <Text style={cs.fieldLabel}>Access Token{sandbox ? " (TEST-...)" : " (APP_USR-...)"}</Text>
      <TextInput
        style={cs.input}
        value={accessToken}
        onChangeText={setAccessToken}
        placeholder={sandbox ? "TEST-XXXX-XXXX..." : "APP_USR-XXXX-XXXX..."}
        placeholderTextColor={Colors.ink3}
        secureTextEntry={false}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />

      <Text style={cs.fieldLabel}>Public Key{sandbox ? " (TEST-...)" : " (APP_USR-...)"}</Text>
      <TextInput
        style={cs.input}
        value={publicKey}
        onChangeText={setPublicKey}
        placeholder={sandbox ? "TEST-XXXX-XXXX..." : "APP_USR-XXXX-XXXX..."}
        placeholderTextColor={Colors.ink3}
        secureTextEntry={false}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />

      <View style={s.formBtns}>
        {(configured || editing) && (
          <Pressable onPress={() => setEditing(false)} style={s.cancelBtn}>
            <Text style={s.cancelBtnText}>Cancelar</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSave} disabled={isSaving} style={[s.saveBtn, isSaving && { opacity: 0.6 }, !configured && { flex: 1 }]}>
          <Text style={s.saveBtnText}>{isSaving ? "Salvando..." : configured ? "Salvar" : "Conectar Mercado Pago"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 12, color: Colors.ink3 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  mpLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#009EE3", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  mpLogoText: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  badgeSandbox: { backgroundColor: Colors.amberD ?? "#fef3c7", borderWidth: 1, borderColor: Colors.amber },
  badgeProd: { backgroundColor: Colors.greenD ?? "#d1fae5", borderWidth: 1, borderColor: Colors.green },
  badgeText: { fontSize: 10, fontWeight: "700" },
  badgeTextSandbox: { color: Colors.amber },
  badgeTextProd: { color: Colors.green },
  tokenRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  tokenLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", width: 90 },
  tokenValue: { flex: 1, fontSize: 11, color: Colors.ink, fontFamily: "monospace", letterSpacing: 0.3 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border2 },
  editBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  removeBtnGhost: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  removeBtnGhostText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  confirmRow: { gap: 10 },
  confirmText: { fontSize: 13, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  confirmBtns: { flexDirection: "row", gap: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelBtnText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  removeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.red ?? "#ef4444", alignItems: "center" },
  removeBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  formBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: Colors.violet, alignItems: "center" },
  saveBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});
