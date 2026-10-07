import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import type { PdvSettings } from "@/services/api";
import { SEGMENT_LABEL, SEGMENTOS, STUDIO_PLAN_MSG } from "@/constants/primeirosPassos";
import { frenteApi, type Segmento } from "@/services/primeirosPassosApi";
import { FrenteOpcoes, type FrenteOpcoesPaleta } from "@/components/onboarding/FrenteOpcoes";

// ============================================================
// Configurações › Políticas do Caixa › "Sua frente" (07/10/2026)
//
// Decisão do fundador (07/10/2026): o cliente PODE trocar a própria frente.
// A linha "Sua frente: Ótica" ganha uma seta; ao tocar, abrem os mesmos
// quadros do Gestão Aura (components/onboarding/FrenteOpcoes) + o extra
// "Ordem de Serviço". Escolheu, confirmou, a frente muda na hora:
// PATCH /companies/:id/segment (Aura-backend, routes/companySegment.js).
//
//   · Só dono/admin da empresa (company.member_role) ou staff vê a seta.
//     Membro comum lê a linha, sem seta. O backend repete a checagem (403).
//   · Essencial: o quadro Personalizados (Studio) NÃO aparece — premissa do
//     projeto, nada de item desabilitado nem isca de upgrade. O plano vem do
//     JWT e pode estar velho: abrir a grade revalida o /auth/me.
//   · A frente é da empresa ativa. Na visão consolidada o card inteiro não
//     é renderizado (app/(tabs)/configuracoes.tsx).
//   · Também mora nas Configurações do Aura Studio (app/studio/(estudio)/
//     configuracoes.tsx, com `paleta` do Studio): empresa Studio não chega
//     em /configuracoes (o guard raiz devolve para /studio), então sem isso
//     quem entrasse no Studio não saía sozinho. Saindo do Studio, o store é
//     gravado com vertical_active nulo ANTES do redirecionamento para
//     /(tabs) — é esse campo que o guard raiz lê; sem ele a pessoa seria
//     devolvida ao Studio.
//   · A confirmação é inline (sem overlay): modal fixo dentro do shell fica
//     preso atrás da página no RNW.
// ============================================================

export const FRENTE_FLAGS: { key: "matcon_enabled" | "otica_enabled" | "os_enabled"; label: string }[] = [
  { key: "matcon_enabled", label: "Materiais de construção" },
  { key: "otica_enabled", label: "Ótica" },
  { key: "os_enabled", label: "Ordem de Serviço" },
];

/** Nome da frente para leitura. Empresa antiga (segment NULL) não tem
 *  frente gravada: Matcon/Ótica ligados dizem qual é; senão, loja em geral. */
export function nomeDaFrente(segment: Segmento | null | undefined, display: Partial<PdvSettings>): string {
  if (segment && SEGMENT_LABEL[segment]) return SEGMENT_LABEL[segment];
  if (display.matcon_enabled === true) return SEGMENT_LABEL.matcon;
  if (display.otica_enabled === true) return SEGMENT_LABEL.otica;
  return SEGMENT_LABEL.varejo;
}

/** Cores para shells com tema próprio (Studio). Sem paleta = tema do varejo. */
export type FrenteDaLojaPaleta = {
  texto: string;
  textoSuave: string;
  destaque: string;
  borda: string;
  botao: string;
  erro: string;
  caixaFundo: string;
  opcoes: FrenteOpcoesPaleta;
};

const PLANOS_COM_STUDIO = ["negocio", "expansao", "personalizado"];

export const SO_O_DONO_MSG = "Só o dono da conta muda a frente";
export const ERRO_GENERICO_MSG = "Não deu pra trocar a frente. Tente de novo.";

export function mensagemDoErro(err: any): string {
  const code = err?.data?.code || err?.code;
  if (code === "STUDIO_PLAN_REQUIRED") return STUDIO_PLAN_MSG;
  if (err?.status === 403) return SO_O_DONO_MSG;
  // Ex.: empresa com outro módulo ativo (409 VERTICAL_ACTIVE) — a frase do
  // backend já é pra leitura do cliente.
  if (err?.status === 409 && typeof err?.data?.error === "string") return err.data.error;
  return ERRO_GENERICO_MSG;
}

export function FrenteDaLoja({ display, onChanged, paleta }: { display: Partial<PdvSettings>; onChanged?: () => void; paleta?: FrenteDaLojaPaleta }) {
  const p = paleta;
  const { company, isStaff } = useAuthStore();
  const qc = useQueryClient();

  const vertical = (company as any)?.vertical_active || null;
  // Conta Studio antiga pode não ter segment gravado: a vertical diz a frente.
  const atual: Segmento | null = (company as any)?.segment ?? (vertical === "studio" ? "studio" : null);
  const papel: string = (company as any)?.member_role || "owner";
  const podeTrocar = !!company?.id && (isStaff || papel === "owner" || papel === "admin");
  const osLigada = display.os_enabled === true;

  const [aberto, setAberto] = useState(false);
  const [selecionada, setSelecionada] = useState<Segmento | null>(null);
  const [extraOs, setExtraOs] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Studio só entra na grade se o plano tem (ou se já é a frente atual, pra
  // ela aparecer marcada). Empresa com outro módulo ativo (odonto, food...)
  // também não vê: o backend recusaria (409 VERTICAL_ACTIVE).
  const temStudio = atual === "studio"
    || (PLANOS_COM_STUDIO.includes(String((company as any)?.plan || "")) && (!vertical || vertical === "studio"));
  const opcoes = SEGMENTOS.filter(function(k) { return k !== "studio" || temStudio; });

  function alternar() {
    if (salvando) return;
    if (!aberto) {
      setSelecionada(atual);
      setExtraOs(osLigada);
      setErro(null);
      setConfirmando(false);
      // Plano stale no JWT: revalida antes de decidir se Studio aparece.
      const st: any = useAuthStore.getState();
      if (typeof st.refreshMe === "function") Promise.resolve(st.refreshMe()).catch(function() {});
    }
    setAberto(!aberto);
  }

  const mudouFrente = !!selecionada && selecionada !== atual;
  const mudouExtra = !!selecionada && selecionada !== "assistencia" && extraOs !== osLigada;
  const podeSalvar = !salvando && (mudouFrente || mudouExtra);

  const rotuloBotao = !selecionada
    ? "Escolha a frente"
    : (mudouFrente || !mudouExtra) ? "Trocar para " + SEGMENT_LABEL[selecionada] : "Salvar";

  const saindoDoStudio = vertical === "studio" && !!selecionada && selecionada !== "studio";

  const textoConfirmacao = !selecionada ? "" : mudouFrente && saindoDoStudio
    ? "Sua Aura volta a abrir como " + SEGMENT_LABEL[selecionada] + ". Você sai do Aura Studio; seu catálogo e seus pedidos continuam guardados."
    : mudouFrente
    ? "Sua Aura passa a abrir como " + SEGMENT_LABEL[selecionada] + ". O que a frente anterior ligava fica desligado."
      + (selecionada === "studio" ? " Você vai para o Aura Studio." : "")
    : (extraOs ? "A Ordem de Serviço fica ligada na sua loja." : "A Ordem de Serviço fica desligada na sua loja.");

  async function aplicar() {
    if (!company?.id || !selecionada || salvando) return;
    const nova = selecionada;
    const trocou = mudouFrente;
    const saiu = saindoDoStudio;
    setSalvando(true);
    setErro(null);
    try {
      const res = await frenteApi.trocar(company.id, {
        segment: nova,
        // Assistência vive de OS; nas outras, a lista vazia desliga o extra.
        extras: nova === "assistencia" || extraOs ? ["os"] : [],
      });
      toast.success(trocou ? "Frente trocada: " + SEGMENT_LABEL[nova] : "Ordem de Serviço " + (extraOs ? "ligada" : "desligada"));
      if (onChanged) onChanged();
      qc.invalidateQueries({ queryKey: ["pdv-settings"] });
      qc.invalidateQueries({ queryKey: ["first-steps"] });
      // company.segment / vertical_active: grava já — o guard raiz decide o
      // shell por vertical_active, e o refreshMe pula um /auth/me que acabou
      // de voltar (janela de 3 s). Depois revalida com o servidor e grava de
      // novo: um /auth/me que já estava em voo antes da troca devolveria a
      // vertical antiga por cima.
      const st: any = useAuthStore.getState();
      const gravar = function() {
        if (typeof st.updateCompany === "function") {
          st.updateCompany({ segment: res.segment, vertical_active: res.vertical_active } as any);
        }
      };
      gravar();
      if (typeof st.refreshMe === "function") {
        try { await st.refreshMe(); } catch {}
        gravar();
      }
      setConfirmando(false);
      setAberto(false);
      if (trocou && saiu && res.vertical_active !== "studio") router.replace("/(tabs)" as any);
      else if (trocou && res.segment === "studio") router.replace("/studio" as any);
    } catch (err: any) {
      const msg = mensagemDoErro(err);
      setErro(msg);
      setConfirmando(false);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  const ligados = FRENTE_FLAGS.filter(function(f) { return display[f.key] === true; });
  const linha = (
    <Text style={[s.rowLabel, { flex: 1 }, p && { color: p.texto }]}>
      Sua frente: <Text style={{ color: p ? p.destaque : Colors.violet3 }}>{nomeDaFrente(atual, display)}</Text>
    </Text>
  );

  return (
    <View style={s.box} testID="pdv-settings-frente">
      {podeTrocar ? (
        <Pressable
          onPress={alternar}
          style={s.cabecalho}
          testID="pdv-settings-frente-trocar"
          accessibilityRole="button"
          accessibilityLabel="Mudar a frente da loja"
          accessibilityState={{ expanded: aberto }}
        >
          {linha}
          <Icon name={aberto ? "chevron_up" : "chevron_down"} size={16} color={p ? p.destaque : Colors.violet3} />
        </Pressable>
      ) : (
        <View style={s.cabecalho}>{linha}</View>
      )}

      {ligados.length > 0 && (
        <Text style={[s.rowDesc, p && { color: p.textoSuave }]} testID="pdv-settings-frente-ligado">
          Ligado: {ligados.map(function(f) { return f.label; }).join(" · ")}
        </Text>
      )}

      {podeTrocar && aberto && (
        <View style={s.painel} testID="pdv-settings-frente-opcoes">
          <FrenteOpcoes
            selecionada={selecionada}
            atual={atual}
            onSelecionar={function(k) { setSelecionada(k); setErro(null); setConfirmando(false); }}
            extraOs={extraOs}
            onAlternarExtraOs={function() { setExtraOs(function(v) { return !v; }); setConfirmando(false); }}
            opcoes={opcoes}
            rotuloOpcoes="Escolha a frente da sua loja"
            desabilitado={salvando}
            testIDPrefix="pdv-settings-frente"
            paleta={p ? p.opcoes : undefined}
          />

          {erro && <Text style={[s.erro, p && { color: p.erro }]} testID="pdv-settings-frente-erro">{erro}</Text>}

          {confirmando && podeSalvar ? (
            <View style={[s.confirmBox, p && { borderColor: p.borda, backgroundColor: p.caixaFundo }]} testID="pdv-settings-frente-confirmacao">
              <Text style={[s.confirmText, p && { color: p.texto }]}>{textoConfirmacao}</Text>
              <View style={s.confirmAcoes}>
                <Pressable
                  onPress={function() { setConfirmando(false); }}
                  disabled={salvando}
                  style={[s.btnSec, p && { borderColor: p.borda }]}
                  testID="pdv-settings-frente-cancelar"
                  accessibilityRole="button"
                >
                  <Text style={[s.btnSecText, p && { color: p.textoSuave }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={aplicar}
                  disabled={salvando}
                  style={[s.btn, { flex: 1, marginTop: 0 }, p && { backgroundColor: p.botao }, salvando && { opacity: 0.5 }]}
                  testID="pdv-settings-frente-confirmar"
                  accessibilityRole="button"
                >
                  {salvando
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.btnText}>Confirmar</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={function() { if (podeSalvar) setConfirmando(true); }}
              disabled={!podeSalvar}
              style={[s.btn, p && { backgroundColor: p.botao }, !podeSalvar && { opacity: 0.5 }]}
              testID="pdv-settings-frente-salvar"
              accessibilityRole="button"
              accessibilityState={{ disabled: !podeSalvar }}
            >
              <Text style={s.btnText}>{rotuloBotao}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box:        { paddingVertical: 10, gap: 4 },
  cabecalho:  { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  rowLabel:   { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  rowDesc:    { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 15 },
  painel:     { marginTop: 4, paddingBottom: 4 },
  erro:       { fontSize: 12, color: Colors.red, fontWeight: "600", marginTop: 10 },
  btn:        { backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  btnText:    { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnSec:     { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  btnSecText: { color: Colors.ink2, fontSize: 13, fontWeight: "600" },
  confirmBox: { marginTop: 14, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 12, gap: 10, backgroundColor: Colors.bg3 },
  confirmText:{ fontSize: 12, color: Colors.ink, lineHeight: 17 },
  confirmAcoes: { flexDirection: "row", gap: 8, alignItems: "center" },
});

export default FrenteDaLoja;
