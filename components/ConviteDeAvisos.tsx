// ============================================================
// AURA. — ConviteDeAvisos: "Saiba de cada venda no celular" (04/11/2026)
//
// Card inline (não flutua, não cobre nada) no topo do Painel e do Caixa,
// como o InstallBanner. Convida a dona a ligar os avisos no celular, que
// com Aura-backend #953 passaram a avisar venda, crediário e orçamento.
//
// Quando aparece (regras em utils/avisosNoCelular.ts):
//   · web, com suporte a push e o aviso ainda "inativo" neste aparelho;
//   · quem está logado decide ligar: dona, admin, acesso total;
//   · ainda não dispensado neste aparelho ("Agora não" esconde para sempre).
//
// Mockup: docs/mockups/avisos-no-celular.html, tela 2.
// ============================================================
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";
import { ativarAviso, estadoDoAviso, type EstadoDoAviso } from "@/services/webPush";
import { TEXTO_DO_CONVITE, conviteDispensado, dispensarConvite, podeVerConvite } from "@/utils/avisosNoCelular";

export function ConviteDeAvisos() {
  const { company, token, consolidatedView, isDemo } = useAuthStore() as any;
  const [estado, setEstado] = useState<EstadoDoAviso | "carregando">("carregando");
  const [dispensado, setDispensado] = useState<boolean>(() => conviteDispensado());
  const [ligando, setLigando] = useState(false);

  // A mesma consulta (e o mesmo cache) de useEstoqueConsulta: quem é o
  // membro nesta empresa. Dona não espera a resposta.
  const { data: perm } = useQuery({
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: () => request<any>("/auth/my-permissions"),
    enabled: !!token && Platform.OS === "web",
    staleTime: 5 * 60000,
    retry: 1,
  });

  useEffect(() => {
    if (Platform.OS !== "web" || dispensado) return;
    let vivo = true;
    estadoDoAviso()
      .then((e) => { if (vivo) setEstado(e); })
      .catch(() => { if (vivo) setEstado("indisponivel"); });
    return () => { vivo = false; };
  }, [dispensado]);

  if (Platform.OS !== "web" || isDemo || dispensado) return null;
  if (estado !== "inativo") return null;
  const papel = (company as any)?.member_role || "owner";
  const decide = papel === "owner" || podeVerConvite(perm);
  if (!decide || !company?.id) return null;

  async function ligar() {
    if (ligando) return;
    setLigando(true);
    try {
      const novo = await ativarAviso(company.id);
      setEstado(novo);
      if (novo === "ativo") {
        toast.success(TEXTO_DO_CONVITE.ligado);
        dispensar();
      } else if (novo === "bloqueado") {
        toast.error(TEXTO_DO_CONVITE.bloqueado);
        dispensar();
      }
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível ligar os avisos agora.");
    } finally {
      setLigando(false);
    }
  }

  function dispensar() {
    dispensarConvite();
    setDispensado(true);
  }

  return (
    <View style={s.card} testID="convite-de-avisos">
      <Pressable onPress={dispensar} style={s.fechar} accessibilityLabel={TEXTO_DO_CONVITE.agoraNao} hitSlop={8}>
        <Icon name="x" size={14} color={Colors.ink3} />
      </Pressable>

      <View style={s.linha}>
        <View style={s.icone}>
          <Icon name="bell" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, paddingRight: 18 }}>
          <Text style={s.titulo}>{TEXTO_DO_CONVITE.titulo}</Text>
          <Text style={s.descricao}>{TEXTO_DO_CONVITE.descricao}</Text>
        </View>
      </View>

      <View style={s.acoes}>
        <Pressable onPress={ligar} style={s.btnPrimario} disabled={ligando} accessibilityRole="button">
          <Text style={s.btnPrimarioTexto}>{ligando ? "Ligando..." : TEXTO_DO_CONVITE.ligar}</Text>
        </Pressable>
        <Pressable onPress={dispensar} style={s.btnGhost} accessibilityRole="button">
          <Text style={s.btnGhostTexto}>{TEXTO_DO_CONVITE.agoraNao}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    borderRadius: 16, padding: 14, marginBottom: 16, gap: 10,
  },
  fechar: { position: "absolute", top: 8, right: 8, padding: 6, zIndex: 1 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icone: {
    width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.violet,
  },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink, lineHeight: 18 },
  descricao: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 3 },
  acoes: { flexDirection: "row", gap: 8 },
  btnPrimario: { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnPrimarioTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnGhostTexto: { color: Colors.ink2, fontSize: 13, fontWeight: "600" },
});

export default ConviteDeAvisos;
