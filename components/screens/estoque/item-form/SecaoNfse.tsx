// ============================================================
// AURA. — Cadastro do serviço · seção "Nota de serviço (NFS-e)"
//
// 10/11/2026. Mockup aprovado: docs/mockups/nfse-cadastro-servico.html,
// tela 1 (Cadastro do serviço). Só aparece em SERVIÇO (unit "srv"); o
// produto continua exatamente como antes.
//
// O que a seção pede, na ordem do mockup:
//   1. Código de Tributação Nacional (cTribNac, 6 números) — um campo só
//      que aceita os números OU o que a pessoa faz ("corte de cabelo"); a
//      busca é na Lista de Serviços Nacional oficial, carregada sob demanda
//      (hooks/useListaServicosNfse.ts). "Sugerir" usa o nome do serviço.
//   2. Descrição do Serviço (xDescServ; vazia = nome do serviço).
//   3. Código NBS (9 números, opcional).
//   4. Reforma tributária (IBS/CBS), recolhida: CST, cClassTrib e
//      indicador de operação. Campos de números; nenhuma lista inventada —
//      as tabelas oficiais do IBS/CBS ficam para quando a nota usar.
//
// ALÍQUOTA DO ISS: FORA DA TELA (decisão pendente do dono, 10/11/2026).
// Na NFS-e nacional a alíquota só vai na nota com ISS retido de empresa
// do Simples; nos outros casos o município aplica a dele. O campo está
// pronto abaixo; para mostrar, troque MOSTRAR_ALIQUOTA_ISS para true (o
// ItemFormModal lê a mesma constante para gravar).
//
// Só aparece para quem emite NFS-e (decisão do dono, 10/11/2026; critério
// em hooks/useEmiteNfse.ts) — quem não emite não vê a seção. O código é
// opcional para salvar: vazio não trava; pela metade (5 dígitos) trava,
// porque seria recusado na emissão.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { waAura } from "@/constants/suporteAura";
import { CampoCodigoTributacao } from "@/components/nfse/CampoCodigoTributacao";
import {
  DESCRICAO_NFSE_MAX, DIGITOS_NFSE, faltamNumeros, fmtNbs,
  lerAliquotaIss, seloDaNfse, soDigitos, statusDoCodigo,
  type CamposNfseDoForm,
} from "@/utils/nfseServico";
import { Campo, Entrada, Nota, Secao, s } from "./ui";

/** Uma linha para mostrar o campo "Alíquota" do ISSQN (tela e gravação). */
export const MOSTRAR_ALIQUOTA_ISS = false;

type Props = {
  nome: string;
  /** Serviço compartilhado com as lojas do grupo (is_group_shared). */
  grupo: boolean;
  campos: CamposNfseDoForm;
  onCampos: (patch: Partial<CamposNfseDoForm>) => void;
};

export function SecaoNfse(p: Props) {
  // 10/11/2026: a busca do código mora em components/nfse/CampoCodigoTributacao
  // (a mesma do "Pronto para emitir NFS-e?"); aqui só sabemos se está buscando.
  const [buscando, setBuscando] = useState(false);
  const [rfAberto, setRfAberto] = useState(!!(p.campos.cst || p.campos.cclasstrib || p.campos.cindop));

  const st0 = statusDoCodigo(p.campos.ctribnac);
  const selo = seloDaNfse(buscando ? "" : p.campos.ctribnac, true);

  // ── nota do topo ────────────────────────────────────────
  const notaTopo = st0 === "ok" && !buscando ? (
    <Nota icon="check">
      <Text style={s.notaTxt}>
        <Text style={s.notaForte}>Pronto.</Text> Com o código preenchido, a NFS-e deste serviço sai sozinha na venda.
      </Text>
    </Nota>
  ) : (
    <Nota tom="amber" icon="alert">
      <Text style={s.notaTxt}>
        <Text style={s.notaForte}>Você emite nota de serviço.</Text> Sem o código abaixo, a NFS-e deste serviço não sai sozinha na venda.
      </Text>
    </Nota>
  );

  // ── NBS ─────────────────────────────────────────────────
  const nbsSt = statusDoCodigo(p.campos.cnbs, DIGITOS_NFSE.cnbs);
  const nbsHint = nbsSt === "parcial"
    ? <Text style={[s.hint, { color: Colors.red }]}>{faltamNumeros(p.campos.cnbs, 9) + ". O NBS tem 9."}</Text>
    : nbsSt === "ok"
      ? <Text style={[s.hint, { color: Colors.green }]}>✓ NBS preenchido</Text>
      : <Text style={s.hint}>Nomenclatura Brasileira de Serviços, 9 números. Só se o seu contador pedir.</Text>;

  // ── ISS (fora da tela por ora) ──────────────────────────
  const issNum = lerAliquotaIss(p.campos.aliquotaIss);
  const issHint = p.campos.aliquotaIss.trim() && (issNum == null || issNum < 2)
    ? "O ISS costuma ficar entre 2% e 5%. Vale conferir com o seu contador."
    : !p.campos.aliquotaIss.trim()
      ? (p.grupo ? "Se ficar em branco, cada loja usa a sua." : "Se ficar em branco, usamos a da sua empresa.")
      : (p.grupo ? "Vale para todas as lojas do grupo." : "Usada só neste serviço.");

  // ── reforma tributária ──────────────────────────────────
  const partes: string[] = [];
  if (p.campos.cst) partes.push("CST " + p.campos.cst);
  if (p.campos.cclasstrib) partes.push("cClassTrib " + p.campos.cclasstrib);
  if (p.campos.cindop) partes.push("operação " + p.campos.cindop);
  const resumoRf = partes.length ? partes.join(" · ") : "Em branco: usa o padrão da empresa";
  const erroCurto = (v: string, n: number) =>
    statusDoCodigo(v, n) === "parcial" ? <Text style={[s.hint, { color: Colors.red }]}>{faltamNumeros(v, n) + "."}</Text> : null;

  return (
    <View testID="secao-nfse">
      <Secao icon="receipt" titulo="Nota de serviço (NFS-e)" selo={selo} style={st.destaque}>
        <View style={{ marginBottom: 12 }}>{notaTopo}</View>

        {p.grupo && (
          <View style={{ marginBottom: 12 }} testID="nfse-nota-grupo">
            <Nota icon="layers">
              <Text style={s.notaTxt}>
                <Text style={s.notaForte}>Serviço do grupo.</Text> O Código de Tributação Nacional, a Descrição do Serviço e o Código NBS valem para todas as lojas do grupo: preenchendo uma vez, resolve em todas. O ISS continua sendo o da cidade de cada loja.
              </Text>
            </Nota>
          </View>
        )}

        <CampoCodigoTributacao
          codigo={p.campos.ctribnac}
          onCodigo={(c) => p.onCampos({ ctribnac: c })}
          nome={p.nome}
          optional="necessário para a nota"
          onBuscando={setBuscando}
        />

        <Campo label="Descrição do Serviço" optional="opcional">
          <Entrada
            value={p.campos.descricao}
            onChangeText={(v: string) => p.onCampos({ descricao: v.slice(0, DESCRICAO_NFSE_MAX) })}
            placeholder={p.nome.trim() || "Nome do serviço"}
            maxLength={DESCRICAO_NFSE_MAX}
            accessibilityLabel="Descrição do Serviço"
            testID="nfse-descricao"
          />
          <Text style={s.hint}>Se ficar em branco, usamos o nome do serviço.</Text>
        </Campo>

        <View style={[s.linha2, { flexWrap: "wrap" }]}>
          <Campo label="Código NBS" optional="opcional" style={{ flex: 1, minWidth: 180 }}>
            <Entrada
              value={fmtNbs(p.campos.cnbs)}
              onChangeText={(v: string) => p.onCampos({ cnbs: soDigitos(v, DIGITOS_NFSE.cnbs) })}
              placeholder="0.0000.00.00"
              keyboardType="number-pad"
              accessibilityLabel="Código NBS"
              testID="nfse-nbs"
              style={[st.mono, nbsSt === "parcial" && { borderColor: Colors.red }]}
            />
            {nbsHint}
          </Campo>
          {MOSTRAR_ALIQUOTA_ISS && (
            <Campo label="Alíquota" optional="opcional" style={{ flex: 1, minWidth: 180 }}>
              <View style={{ position: "relative" as any }}>
                <Entrada
                  value={p.campos.aliquotaIss}
                  onChangeText={(v: string) => {
                    let t = v.replace(/[^\d,]/g, "");
                    const pp = t.split(",");
                    if (pp.length > 2) t = pp[0] + "," + pp.slice(1).join("");
                    p.onCampos({ aliquotaIss: t.slice(0, 5) });
                  }}
                  placeholder={p.grupo ? "a de cada loja" : "a da empresa"}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Alíquota"
                  testID="nfse-iss"
                  style={{ paddingRight: 30 }}
                />
                <Text style={st.sufixo}>%</Text>
              </View>
              <Text style={s.hint}>{issHint}</Text>
            </Campo>
          )}
        </View>

        <View style={[st.rf, rfAberto && st.rfAberto]}>
          <Pressable
            onPress={() => setRfAberto((v) => !v)}
            style={st.rfH}
            accessibilityRole="button"
            accessibilityState={{ expanded: rfAberto }}
            accessibilityLabel="Reforma tributária (IBS/CBS)"
            testID="nfse-reforma"
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.rfT}>Reforma tributária (IBS/CBS)</Text>
              <Text style={st.rfResumo} numberOfLines={1}>{resumoRf}</Text>
            </View>
            <View style={st.rfTag}><Text style={st.rfTagTxt}>opcional até 2027</Text></View>
            <Icon name={rfAberto ? "chevron_up" : "chevron_down"} size={16} color={Colors.ink3} />
          </Pressable>
          {rfAberto && (
            <View style={st.rfB}>
              <Text style={[s.hint, { marginTop: 0, marginBottom: 10 }]}>
                Desde 2026 a nota de serviço já tem espaço para os novos impostos. Se ficar em branco, a nota sai com o padrão da sua empresa. Só mude se o seu contador pedir.
              </Text>
              <Campo label="Situação tributária (CST)" optional="3 números">
                <Entrada
                  value={p.campos.cst}
                  onChangeText={(v: string) => p.onCampos({ cst: soDigitos(v, DIGITOS_NFSE.cst) })}
                  placeholder="000"
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="Situação tributária (CST)"
                  testID="nfse-cst"
                  style={st.mono}
                />
                {erroCurto(p.campos.cst, 3)}
              </Campo>
              <View style={[s.linha2, { flexWrap: "wrap" }]}>
                <Campo label="Classificação (cClassTrib)" optional="6 números" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <Entrada
                    value={p.campos.cclasstrib}
                    onChangeText={(v: string) => p.onCampos({ cclasstrib: soDigitos(v, DIGITOS_NFSE.cclasstrib) })}
                    placeholder="000001"
                    keyboardType="number-pad"
                    maxLength={6}
                    accessibilityLabel="Classificação (cClassTrib)"
                    testID="nfse-cclasstrib"
                    style={st.mono}
                  />
                  {erroCurto(p.campos.cclasstrib, 6)}
                </Campo>
                <Campo label="Indicador de operação" optional="6 números" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <Entrada
                    value={p.campos.cindop}
                    onChangeText={(v: string) => p.onCampos({ cindop: soDigitos(v, DIGITOS_NFSE.cindop) })}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    accessibilityLabel="Indicador de operação"
                    testID="nfse-cindop"
                    style={st.mono}
                  />
                  {erroCurto(p.campos.cindop, 6)}
                </Campo>
              </View>
            </View>
          )}
        </View>

        <View style={st.divider} />
        <View style={st.ajuda} testID="nfse-ajuda">
          <Icon name="message_circle" size={13} color={Colors.ink3} />
          <Text style={st.ajudaTxt}>
            {"Em caso de dúvidas, acione seu contador ou o suporte Aura · "}
            <Text
              style={s.link}
              accessibilityRole="link"
              onPress={() => { Linking.openURL(waAura()).catch(() => {}); }}
            >
              WhatsApp (11) 95630-5269
            </Text>
          </Text>
        </View>
      </Secao>
    </View>
  );
}

const st = {
  destaque: { borderColor: Colors.violet },
  mono: { fontSize: 13, letterSpacing: 0.5 },
  sufixo: { position: "absolute" as any, right: 12, top: 10, fontSize: 13, color: Colors.ink3, pointerEvents: "none" as any },
  rf: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginTop: 2 },
  rfAberto: { borderColor: Colors.border2 },
  rfH: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  rfT: { fontSize: 12.5, fontWeight: "700" as const, color: Colors.ink },
  rfResumo: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  rfTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  rfTagTxt: { fontSize: 10, color: Colors.ink3, fontWeight: "600" as const },
  rfB: { paddingHorizontal: 12, paddingBottom: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  ajuda: { flexDirection: "row" as const, gap: 6, alignItems: "flex-start" as const },
  ajudaTxt: { flex: 1, fontSize: 11, color: Colors.ink3, lineHeight: 16 },
};

export default SecaoNfse;
