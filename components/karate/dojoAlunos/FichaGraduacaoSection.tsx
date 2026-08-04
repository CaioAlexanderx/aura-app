// ============================================================
// FichaGraduacaoSection — seção "Ficha de graduação" da ficha do aluno (F10)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// nunca modal aninhado, mesmo racional do GuardianPicker/demais seções
// já embutidas ali). Botão único: gera e abre pra impressão a CARTEIRA
// DE GRADUAÇÃO física (papel Areikan Karatê-Dô / Shotokan Tradicional)
// — "nada mais é do que um histórico ou trajetória, similar ao que já
// temos na federação" (pedido do Caio). Ver buildFichaGraduacaoHtml.ts
// pro desenho do documento em si.
//
// Fontes de dado (confirmadas no backend ANTES de montar, não presumidas):
//   1. karate_dojo_belt_exam_results (via services/karateDojoBeltExamApi
//      #listStudentResults) — resultado de exame do PRÓPRIO dojô, com os
//      quesitos (kihon/kata/kumite, 〇›△›□). Fonte PRIMÁRIA: é a única
//      que carrega os quesitos.
//   2. karate_belt_history (via karateApi#getPractitioner, campo
//      belt_history) — trajetória oficial da FEDERAÇÃO. Só é consultada
//      quando o aluno está federado (student.federated), e só PREENCHE
//      linhas que a fonte 1 deixou em branco (ex.: aluno graduado antes
//      de existir o exame-do-dojô no sistema, ou graduado só pela
//      federação). Sem quesitos — a federação não registra isso.
//   Nenhuma das duas existindo pra um kyu = linha em branco na ficha
//   (regra da casa "dado faltante ≠ pendência" — carteira que se
//   preenche ao longo dos anos, não um erro).
//
// A busca do histórico (agregação client-side por falta de endpoint
// dedicado — ver GAP CONHECIDO em karateDojoBeltExamApi.ts) só roda
// SOB DEMANDA, ao tocar "Emitir ficha de graduação" — não no mount da
// ficha (evitaria N+1 requests toda vez que o sensei abre um aluno).
// ============================================================
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { toast } from "@/components/Toast";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { karateApi, BeltHistoryEntry } from "@/services/karateApi";
import { karateDojoBeltExamApi, StudentExamResult } from "@/services/karateDojoBeltExamApi";
import { DojoStudent } from "@/services/karateDojoStudentsApi";
import { BELT_KYUS } from "../praticante-detalhe/helpers";
import { isoToBR, maskCpf, maskCep, formatPhone } from "./helpers";
import { buildFichaGraduacaoHtml, FichaGraduacaoRow, FichaGraduacaoData } from "./buildFichaGraduacaoHtml";

interface Props {
  federationId: string;
  student: DojoStudent;
}

// "Estilo" não existe como coluna no backend (companies não tem
// style/estilo — confirmado antes de montar este arquivo). Produto é
// Shotokan-only hoje (mesmo racional de DOJO_KUN fixo em
// buildCarteirinhaHtml.ts) — fica fixo aqui em vez de inventar campo novo.
const DOJO_STYLE = "Shotokan Tradicional";

// 10 linhas fixas, 10º ao 1º kyu — deriva de BELT_KYUS (mesma fonte
// única já usada no form de faixa do aluno e no da federação), nunca
// redeclarada solta: uma faixa nova/reordenada em BELT_KYUS reflete aqui
// sem precisar tocar neste arquivo.
const KYU_SCALE: Array<{ kyu: number; key: BeltKey }> = (Object.keys(BELT_KYUS) as BeltKey[])
  .flatMap((key) => (BELT_KYUS[key] || []).map((kyu) => ({ kyu, key })))
  .sort((a, b) => b.kyu - a.kyu);

/** Extrai o número do kyu de uma entrada de karate_belt_history (só tem belt_level/belt_name em texto, sem coluna numérica exposta no GET). */
function kyuFromBeltHistory(entry: BeltHistoryEntry): number | null {
  const src = `${entry.belt_level || ""} ${entry.belt_name || ""}`;
  const m = src.match(/(\d{1,2})\s*[º°o]?\s*kyu/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 10 ? n : null;
}

function addressLine(s: DojoStudent): string | null {
  if (!s.street) return null;
  return `${s.street}${s.number ? `, ${s.number}` : ""}${s.complement ? ` - ${s.complement}` : ""}`;
}

export function FichaGraduacaoSection({ federationId, student }: Props) {
  const { dojoName, dojoMe } = useKarateDojo();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emitir = async () => {
    if (Platform.OS !== "web") {
      toast.error("Emissão da ficha de graduação disponível apenas na versão web");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const examResults: StudentExamResult[] = await karateDojoBeltExamApi.listStudentResults(federationId, student.id);

      // Fonte 2 (trajetória da federação) — só pra alunos federados, e só
      // pra PREENCHER lacunas; falha aqui não derruba a emissão (a ficha
      // sai com o que a fonte 1 já tinha).
      let beltHistory: BeltHistoryEntry[] = [];
      if (student.federated && student.practitioner_id) {
        try {
          const p = await karateApi.getPractitioner(federationId, student.practitioner_id);
          beltHistory = p.belt_history || [];
        } catch {
          beltHistory = [];
        }
      }

      const rows: FichaGraduacaoRow[] = KYU_SCALE.map(({ kyu, key }) => {
        const beltLabel = KarateBelts[key].label;
        const dojoHit = examResults.find((r) => r.to_belt?.kyu === kyu);
        if (dojoHit) {
          return {
            kyu,
            beltLabel,
            kihon: dojoHit.quesitos?.kihon ?? null,
            kata: dojoHit.quesitos?.kata ?? null,
            kumite: dojoHit.quesitos?.kumite ?? null,
            result: dojoHit.result,
            examinerName: dojoHit.examiner_name ?? null,
            dateBR: isoToBR(dojoHit.exam_date),
          };
        }
        const histHit = beltHistory.find((h) => kyuFromBeltHistory(h) === kyu);
        if (histHit) {
          return {
            kyu,
            beltLabel,
            kihon: null,
            kata: null,
            kumite: null,
            result: "approved",
            examinerName: null,
            dateBR: isoToBR(histHit.graduated_at),
          };
        }
        return { kyu, beltLabel, kihon: null, kata: null, kumite: null, result: null, examinerName: null, dateBR: null };
      });

      const data: FichaGraduacaoData = {
        dojoName,
        style: DOJO_STYLE,
        // Sem campo tipado pra sensei_name em DojoMeInfo hoje — leitura
        // defensiva do payload cru; ausente cai em linha em branco na
        // ficha (nunca erro, ver blankLine em buildFichaGraduacaoHtml.ts).
        senseiName: (dojoMe as any)?.sensei_name ?? null,
        studentName: student.full_name,
        photoUrl: student.karate_photo_url || null,
        birthDateBR: isoToBR(student.birth_date) || null,
        rg: student.rg,
        cpf: student.cpf ? maskCpf(student.cpf) : null,
        motherName: student.mother_name ?? null,
        fatherName: student.father_name ?? null,
        cep: student.zip_code ? maskCep(student.zip_code) : null,
        address: addressLine(student),
        neighborhood: student.neighborhood,
        phone: student.phone ? formatPhone(student.phone) : null,
        matricula: student.fpkt_number,
        rows,
      };

      const html = buildFichaGraduacaoHtml(data);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success("Ficha de graduação aberta para impressão");
    } catch (e: any) {
      const message = e?.message || "Tente novamente.";
      setErr(message);
      toast.error("Não foi possível montar a ficha de graduação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Icon name="ribbon" size={14} color={KarateColors.primary} />
        <Text style={styles.title}>Ficha de graduação</Text>
      </View>
      <Text style={styles.sub}>
        Carteira de graduação (10º ao 1º kyu) com o histórico de exames do dojô — pronta pra imprimir, com as linhas futuras em branco para preencher com o tempo.
      </Text>
      {!!err && <Text style={styles.err}>{err}</Text>}
      <TouchableOpacity
        style={styles.btn}
        onPress={emitir}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Emitir ficha de graduação"
      >
        {loading ? (
          <ActivityIndicator size="small" color={KarateColors.ink} />
        ) : (
          <>
            <Icon name="print" size={14} color={KarateColors.ink} />
            <Text style={styles.btnTxt}>Emitir ficha de graduação</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  sub: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 15 } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", marginTop: 2 } as ViewStyle,
  btnTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
});
