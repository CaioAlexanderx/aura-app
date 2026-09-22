// ============================================================
// AURA. — Configurações › Aura no celular
//
// Criado: 22/09/2026 (PWA Fase 1)
//
// A porta permanente para instalar a Aura como app. O card do Painel
// (InstallBanner) some depois de "Agora não" e só existe em tela de
// celular; este fica sempre aqui, para quem dispensou, para quem quer um
// segundo aparelho e para quem abriu no computador e precisa do endereço.
//
// Quatro estados, decididos por useInstalarApp():
//   instalado    → "Instalada neste celular" + aviso de pedido novo (no
//                  iPhone ele SÓ funciona com a Aura instalada, então é
//                  aqui que ele ganha destaque) + endereço p/ outro aparelho
//   podeInstalar → botão Instalar (convite nativo do Chrome)
//   ehIphone     → botão "Ver como instalar" (guia)
//   senão        → computador sem convite: só o endereço para abrir no celular
//
// O aviso de pedido reaproveita services/webPush.ts, o mesmo fluxo do
// sino (NotificationPrefs). Nada novo de push aqui.
// Mockup: docs/mockups/pwa-instalar-app.html, tela C.
// ============================================================
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useInstalarApp } from "@/hooks/useInstalarApp";
import { GuiaInstalarIphone } from "@/components/GuiaInstalarIphone";
import { Card, sh } from "@/components/screens/configuracoes/shared";
import { ativarAviso, desativarAviso, estadoDoAviso, type EstadoDoAviso } from "@/services/webPush";

export function AuraNoCelularCard() {
  const { company } = useAuthStore();
  const { instalado, podeInstalar, ehIphone, instalar, enderecoDoPainel } = useInstalarApp();
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (Platform.OS !== "web") return null;

  async function aoInstalar() {
    setInstalando(true);
    try {
      const r = await instalar();
      if (r === "aceito") toast.success("Aura instalada! Procure o ícone na tela inicial.");
      else if (r === "indisponivel") toast.error("O navegador não ofereceu a instalação agora. Tente de novo mais tarde.");
    } finally {
      setInstalando(false);
    }
  }

  if (instalado) {
    return (
      <Card>
        <View style={s.linha}>
          <View style={[s.icone, s.iconeOk]}>
            <Icon name="check" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Instalada neste celular</Text>
            <Text style={s.descricao}>Você está usando a Aura pelo app. Atualizações chegam sozinhas.</Text>
          </View>
        </View>
        <View style={sh.fieldDivider} />
        <LinhaDoAviso companyId={company?.id} />
        <View style={sh.fieldDivider} />
        <View style={s.rowInfo}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitulo}>Instalar em outro aparelho</Text>
            <Text style={s.rowDetalhe}>Abra {enderecoDoPainel} no celular e toque em Instalar.</Text>
          </View>
        </View>
      </Card>
    );
  }

  if (podeInstalar || ehIphone) {
    return (
      <Card>
        <View style={s.linha}>
          <View style={s.icone}>
            <Icon name="download" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>{ehIphone ? "Instalar a Aura no iPhone" : "Instalar a Aura neste aparelho"}</Text>
            <Text style={s.descricao}>
              {ehIphone
                ? "Ícone na tela inicial, tela cheia e aviso de pedido novo, que no iPhone só funciona assim."
                : "Abre em tela cheia, como app, e avisa quando entra pedido."}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={ehIphone ? () => setGuiaAberto(true) : aoInstalar}
          style={s.btn}
          disabled={instalando}
          accessibilityRole="button"
        >
          <Text style={s.btnTexto}>{ehIphone ? "Ver como instalar" : instalando ? "Abrindo..." : "Instalar"}</Text>
        </Pressable>
        <GuiaInstalarIphone visible={guiaAberto} onClose={() => setGuiaAberto(false)} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={s.linha}>
        <View style={s.icone}>
          <Icon name="download" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Leve a Aura para o celular</Text>
          <Text style={s.descricao}>
            Abra <Text style={s.endereco}>{enderecoDoPainel}</Text> no navegador do celular e toque em Instalar.
            Ícone na tela inicial, tela cheia e aviso de pedido novo.
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------
// Aviso de pedido novo: liga/desliga o Web Push desta empresa neste
// aparelho. Só aparece quando o navegador suporta.
// ------------------------------------------------------------
function LinhaDoAviso({ companyId }: { companyId?: string }) {
  const [estado, setEstado] = useState<EstadoDoAviso | "carregando">("carregando");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    estadoDoAviso().then((e) => { if (vivo) setEstado(e); }).catch(() => { if (vivo) setEstado("indisponivel"); });
    return () => { vivo = false; };
  }, []);

  if (estado === "indisponivel" || estado === "carregando") return null;

  async function alternar() {
    if (!companyId) return;
    setOcupado(true);
    try {
      const novo = estado === "ativo" ? await desativarAviso(companyId) : await ativarAviso(companyId);
      setEstado(novo);
      if (novo === "ativo") toast.success("Aviso de pedido novo ligado neste aparelho.");
      else if (novo === "bloqueado") toast.error("O navegador bloqueou as notificações. Libere nas configurações do site.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar o aviso agora.");
    } finally {
      setOcupado(false);
    }
  }

  const ligado = estado === "ativo";
  return (
    <View style={s.rowInfo}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitulo}>Aviso de pedido novo</Text>
        <Text style={s.rowDetalhe}>
          {estado === "bloqueado"
            ? "Bloqueado pelo navegador. Libere as notificações do site para ligar."
            : "Toca e mostra na tela, mesmo com o app fechado."}
        </Text>
      </View>
      {estado === "bloqueado" ? (
        <View style={[s.pill, s.pillOff]}><Text style={[s.pillTexto, { color: Colors.amber }]}>Bloqueado</Text></View>
      ) : (
        <Pressable onPress={alternar} disabled={ocupado || !companyId} style={[s.pill, ligado ? s.pillOn : s.pillOff]} accessibilityRole="button">
          <Text style={[s.pillTexto, { color: ligado ? Colors.green : Colors.amber }]}>
            {ocupado ? "..." : ligado ? "Ligado" : "Ligar"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  icone: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violet },
  iconeOk: { backgroundColor: Colors.green },
  titulo: { fontSize: 14, fontWeight: "700", color: Colors.ink, lineHeight: 18 },
  descricao: { fontSize: 12, color: Colors.ink2, lineHeight: 17, marginTop: 3 },
  endereco: { color: Colors.violet3, fontWeight: "700" },
  btn: { alignSelf: "flex-start", backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginTop: 10 },
  btnTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rowInfo: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowTitulo: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  rowDetalhe: { fontSize: 11.5, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  pill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1 },
  pillOn: { backgroundColor: Colors.greenD, borderColor: Colors.green + "55" },
  pillOff: { backgroundColor: Colors.amberD, borderColor: Colors.amber + "55" },
  pillTexto: { fontSize: 11, fontWeight: "700" },
});

export default AuraNoCelularCard;
