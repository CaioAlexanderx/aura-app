// ============================================================
// AURA. — Aba "Emitir NFS-e" da tela Notas fiscais (10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-configuracao-loja.html.
//   - Em cima, o "Pronto para emitir NFS-e?" (components/nfse/ProntoParaEmitirNfse).
//   - Embaixo, a emissão avulsa de hoje (EmitNfseForm), TRAVADA até a loja
//     estar emitindo.
//   - Multi-CNPJ: cada CNPJ tem a sua configuração, o seu certificado e a
//     sua prefeitura. Quem tem mais de uma loja escolhe a loja aqui, ou vê
//     "Todas as lojas" com o estado de cada uma. O envio do certificado
//     acontece na loja do login (aba Certificado A1); para outra loja do
//     grupo, a Aura troca de loja e abre a aba certa.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { EmitNfseForm } from "@/components/screens/nfe/EmitNfseForm";
import { LinhaDeAjuda, ProntoParaEmitirNfse, Segmentos } from "@/components/nfse/ProntoParaEmitirNfse";
import { useNfseConfig, useNfseConfigDoGrupo } from "@/hooks/useNfseConfig";
import {
  CARTOES, contarProntos, emitindo, estadosDosCartoes, fmtCnpj, resumoDaLoja, situacaoDe,
} from "@/utils/nfseProntoParaEmitir";

type Props = { companyId: string; onIrParaCertificado: () => void };

const COR_DO_TOM = { ok: Colors.green, aviso: Colors.amber, erro: Colors.red } as const;
const FUNDO_DO_TOM = { ok: Colors.greenD, aviso: Colors.amberD, erro: Colors.redD } as const;

function nomeDe(c: any): string {
  return String((c && (c.trade_name || c.name || c.legal_name)) || "Loja");
}

export function AbaEmitirNfse({ companyId, onIrParaCertificado }: Props) {
  const { company, availableCompanies, switchCompany } = useAuthStore() as any;
  const lojas: { id: string; nome: string; cnpj: string }[] = (availableCompanies || [])
    .filter((c: any) => c && c.id)
    .map((c: any) => ({ id: String(c.id), nome: nomeDe(c), cnpj: String(c.cnpj || "") }));
  const temGrupo = lojas.length > 1;
  const [sel, setSel] = useState<string>(companyId);
  const grupo = useNfseConfigDoGrupo(lojas, temGrupo);
  const atual = useNfseConfig(companyId);
  const sitAtual = situacaoDe(atual.config.data || null);
  const lojaAtualEmitindo = emitindo(sitAtual);

  function entrarNaLoja(id: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.sessionStorage.setItem("aura_post_switch_redirect", "/nfe?tab=certificado"); } catch { /* segue */ }
    }
    if (typeof switchCompany === "function") switchCompany(id).catch(() => {});
  }

  const lojaSel = lojas.find((l) => l.id === sel);
  const nomeSel = lojaSel ? lojaSel.nome : nomeDe(company);
  const dadosGrupo = grupo.data || [];
  const outraComCodigo = dadosGrupo.find((l) => l.id !== sel && l.resposta && l.resposta.config && /^\d{6}$/.test(String(l.resposta.config.ctribnac_padrao || "")));

  return (
    <View testID="nfse-aba">
      {temGrupo ? (
        <View style={st.lojasel} testID="nfse-seletor-loja">
          <View style={st.lojaselRot}>
            <Icon name="store" size={14} color={Colors.ink3} />
            <Text style={st.lojaselRotTxt}>Loja</Text>
          </View>
          <View style={st.chips}>
            <Pressable onPress={() => setSel("todas")} style={[st.chip, sel === "todas" && st.chipOn]} accessibilityRole="button" accessibilityState={{ selected: sel === "todas" }} testID="nfse-loja-todas">
              <Text style={[st.chipTxt, sel === "todas" && st.chipTxtOn]}>Todas as lojas</Text>
            </Pressable>
            {lojas.map((l) => {
              const d = dadosGrupo.find((x) => x.id === l.id);
              const r = d ? resumoDaLoja(situacaoDe(d.resposta), d.automatica) : null;
              return (
                <Pressable key={l.id} onPress={() => setSel(l.id)} style={[st.chip, sel === l.id && st.chipOn]} accessibilityRole="button" accessibilityState={{ selected: sel === l.id }} testID={"nfse-loja-" + l.id}>
                  {r ? <View style={[st.dot, { backgroundColor: COR_DO_TOM[r.tom] }]} /> : null}
                  <Text style={[st.chipTxt, sel === l.id && st.chipTxtOn]} numberOfLines={1}>{l.nome}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={st.empresa} testID="nfse-empresa">
          <Icon name="store" size={13} color={Colors.ink3} />
          <Text style={st.empresaTxt} numberOfLines={2}>
            <Text style={{ fontWeight: "700", color: Colors.ink }}>{nomeDe(company)}</Text>
            {(company && company.cnpj) ? "  ·  CNPJ " + fmtCnpj(company.cnpj) : ""}
          </Text>
        </View>
      )}

      {sel === "todas" ? (
        <View>
          <View style={st.grupo} testID="nfse-visao-grupo">
            <View style={st.grupoH}>
              <Text style={st.grupoT}>Nota de serviço nas suas lojas</Text>
              <Text style={st.grupoS}>Cada loja tem o seu CNPJ, o seu certificado e a sua prefeitura, então a configuração é feita <Text style={{ fontWeight: "700", color: Colors.ink }}>loja por loja</Text>.</Text>
            </View>
            {lojas.map((l, i) => {
              const d = dadosGrupo.find((x) => x.id === l.id);
              const sit = d ? situacaoDe(d.resposta) : null;
              const est = estadosDosCartoes(sit);
              const r = d && d.erro ? { tom: "aviso" as const, texto: "Não conseguimos abrir agora" } : resumoDaLoja(sit, d ? d.automatica : false);
              const pronta = emitindo(sit);
              return (
                <View key={l.id} style={[st.lj, i > 0 && st.ljSep]} testID={"nfse-grupo-linha-" + l.id}>
                  <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}>
                    <Text style={st.ljN} numberOfLines={1}>{l.nome}</Text>
                    <Text style={st.ljC}>{l.cnpj ? "CNPJ " + fmtCnpj(l.cnpj) : ""}</Text>
                  </View>
                  <View style={[st.pill, { backgroundColor: FUNDO_DO_TOM[r.tom], borderColor: COR_DO_TOM[r.tom] + "55" }]} testID={"nfse-grupo-estado-" + l.id}>
                    <Text style={[st.pillTxt, { color: COR_DO_TOM[r.tom] }]}>{r.texto}</Text>
                  </View>
                  <View style={{ width: 110 }}>
                    <Segmentos estados={est} mini />
                    <Text style={st.ljP}>{(grupo.isLoading ? "…" : contarProntos(est)) + " de " + CARTOES.length}</Text>
                  </View>
                  <Pressable onPress={() => setSel(l.id)} style={[st.btn, pronta ? st.btnSec : st.btnPri]} accessibilityRole="button" testID={"nfse-grupo-abrir-" + l.id}>
                    <Text style={[st.btnTxt, { color: pronta ? Colors.ink : "#fff" }]}>{pronta ? "Ver" : "Configurar"}</Text>
                    <Icon name="arrow_right" size={13} color={pronta ? Colors.ink : "#fff"} />
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={{ marginTop: 14 }}><LinhaDeAjuda /></View>
        </View>
      ) : (
        <View>
          <ProntoParaEmitirNfse
            key={sel}
            companyId={sel}
            nomeLoja={nomeSel}
            noGrupo={temGrupo}
            ehLojaAtual={sel === companyId}
            onIrParaCertificado={onIrParaCertificado}
            onEntrarNaLoja={() => entrarNaLoja(sel)}
            codigoDeOutraLoja={outraComCodigo ? { nome: outraComCodigo.nome, codigo: String(outraComCodigo.resposta!.config!.ctribnac_padrao) } : null}
          />
          {sel === companyId ? (
            lojaAtualEmitindo ? (
              <EmitNfseForm companyId={companyId} />
            ) : (
              <View style={st.below} testID="nfse-avulsa-travada">
                <Text style={st.belowT}>Emitir uma NFS-e avulsa</Text>
                <View style={st.skel}>
                  <View style={[st.sk, { flexBasis: "60%" }]} /><View style={[st.sk, { flexBasis: "30%" }]} />
                  <View style={[st.sk, { flexBasis: "60%" }]} /><View style={[st.sk, { flexBasis: "30%" }]} />
                </View>
                <View style={st.lockv}>
                  <Icon name="lock" size={16} color={Colors.ink2} />
                  <Text style={st.lockvTxt}>Fica disponível quando os passos acima estiverem prontos.</Text>
                </View>
              </View>
            )
          ) : null}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  lojasel: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 },
  lojaselRot: { flexDirection: "row", alignItems: "center", gap: 6 },
  lojaselRotTxt: { fontSize: 11.5, fontWeight: "700", color: Colors.ink3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, paddingHorizontal: 12, paddingVertical: 7, minHeight: 36, maxWidth: 260 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt: { fontSize: 12.5, color: Colors.ink2, fontWeight: "600" },
  chipTxtOn: { color: Colors.violet3, fontWeight: "700" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empresa: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", maxWidth: "100%", backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14 },
  empresaTxt: { fontSize: 12, color: Colors.ink2, flexShrink: 1 },
  grupo: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, overflow: "hidden" },
  grupoH: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  grupoT: { fontSize: 16, fontWeight: "800", color: Colors.ink },
  grupoS: { fontSize: 12.5, color: Colors.ink2, marginTop: 3, lineHeight: 18 },
  lj: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  ljSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  ljN: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  ljC: { fontSize: 11.5, color: Colors.ink3 },
  ljP: { fontSize: 10.5, color: Colors.ink3, marginTop: 4, textAlign: "center" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  pillTxt: { fontSize: 11.5, fontWeight: "700" },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, borderColor: "transparent", minHeight: 36, paddingHorizontal: 12 },
  btnPri: { backgroundColor: Colors.violet },
  btnSec: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  btnTxt: { fontSize: 12.5, fontWeight: "700" },
  below: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, position: "relative" },
  belowT: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  skel: { flexDirection: "row", flexWrap: "wrap", gap: 12, opacity: 0.6 },
  sk: { flexGrow: 1, height: 42, borderRadius: 9, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  lockv: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  lockvTxt: { fontSize: 12.5, color: Colors.ink2, textAlign: "center" },
});

export default AbaEmitirNfse;
