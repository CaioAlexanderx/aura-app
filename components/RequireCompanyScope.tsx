// MULTICNPJ Sessao 1: wrapper de gate.
//
// Usado em telas que precisam OBRIGATORIAMENTE de uma empresa especifica
// (PDV, NF-e, Folha, Configuracoes). Quando o user esta no modo consolidado
// (consolidated_view=true), abre <CompanyPickerModal /> pra forcar escolha.
//
// Apos a escolha:
// 1. Salva URL atual em sessionStorage (`aura_post_switch_redirect`)
// 2. Dispara switchCompany(id) que troca o JWT e da reload (web)
// 3. switchCompany le o sessionStorage e redireciona pra essa URL
//    em vez de "/" (default)
//
// Resultado: user fica na mesma tela, mas agora com JWT da empresa certa.
//
// Memoria do picker: se ja existe escolha lembrada pro contexto, faz
// auto-switch sem mostrar picker. Memoria por sessionStorage (limpa ao
// fechar aba). Botao "Editar" no picker permite limpar e sempre perguntar.

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { CompanyPickerModal, getRememberedCompanyId } from "./CompanyPickerModal";
import { Icon } from "./Icon";

export function RequireCompanyScope({
  context,
  actionLabel,
  children,
}: {
  /** identificador unico do contexto (ex: "pdv", "nfe", "folha", "config") */
  context: string;
  /** string visivel no picker (ex: "abrir o caixa", "emitir nota fiscal") */
  actionLabel: string;
  children: React.ReactNode;
}) {
  const { consolidatedView, company, switchCompany, user } = useAuthStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [autoSwitching, setAutoSwitching] = useState(false);

  // Quando entra na tela em modo consolidado, verifica se ha uma escolha
  // memorizada pra esse contexto. Se sim, faz auto-switch sem mostrar
  // picker. Se nao, abre o picker.
  useEffect(() => {
    if (!consolidatedView || !user?.id) return;
    if (autoSwitching) return;

    const remembered = getRememberedCompanyId(user.id, context);
    if (remembered) {
      setAutoSwitching(true);
      saveRedirectAndSwitch(remembered);
    } else {
      setPickerOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consolidatedView, user?.id, context]);

  function saveRedirectAndSwitch(companyId: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const path = window.location.pathname + window.location.search;
        if (path && path !== "/") {
          window.sessionStorage.setItem("aura_post_switch_redirect", path);
        }
      } catch {}
    }
    switchCompany(companyId).catch((err) => {
      console.warn("[RequireCompanyScope] switch failed:", err);
      setAutoSwitching(false);
      setPickerOpen(true);
    });
  }

  function handlePick(companyId: string) {
    setPickerOpen(false);
    saveRedirectAndSwitch(companyId);
  }

  // Modo single-company: sempre permite
  if (!consolidatedView && company?.id) {
    return <>{children}</>;
  }

  // Modo consolidado: bloqueia ate user escolher
  return (
    <View style={s.gate}>
      <View style={s.iconCircle}>
        <Icon name="bag" size={28} color="#7c3aed" />
      </View>
      <Text style={s.title}>Esta tela é por empresa</Text>
      <Text style={s.desc}>
        Você está em modo consolidado (todas as empresas). Para {actionLabel}, é preciso escolher uma empresa específica.
      </Text>
      <Pressable onPress={() => setPickerOpen(true)} style={s.cta}>
        <Text style={s.ctaText}>Escolher empresa</Text>
      </Pressable>
      <CompanyPickerModal
        visible={pickerOpen}
        context={context}
        actionLabel={actionLabel}
        onPick={handlePick}
        onCancel={() => setPickerOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  gate: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14,
    backgroundColor: "transparent", minHeight: 400,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#7c3aed15", borderWidth: 1, borderColor: "#7c3aed40",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  desc: { fontSize: 12.5, color: Colors.ink3, textAlign: "center", lineHeight: 18, maxWidth: 360 },
  cta: {
    marginTop: 8, backgroundColor: Colors.violet,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  ctaText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});

export default RequireCompanyScope;
