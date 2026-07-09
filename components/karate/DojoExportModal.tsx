// ============================================================
// Exportar dados do Dojô — MODAL · Aura Karatê (Shoji)
//
// Round-trip com a Importação FPKT: baixa os dados atuais do dojô no MESMO
// formato que o import LÊ (abas Academias + Alunos + Histórico, banner na
// linha 1 + cabeçalhos na linha 2 → o import usa range:1) para o dojô editar
// e reimportar. O upsert por Número FPKT já existe no batch-fpkt.
//
// Cabeçalhos (EXATOS — casam app/karate/(federation)/importacao/index.tsx):
//   Academias: Cód. · Academia · Status · Endereço · Bairro · Cidade · Estado · Telefone
//   Alunos:    Cód. Aluno · Nome · Nascimento · Situação · Número FPKT · CPF · RG ·
//              Logradouro · Número · Bairro · Cidade · Estado · CEP · Telefone · Faixa · Academia
//   Histórico: Cód. Aluno · Tipo · Evento
//     (o import faz Cód.Aluno→Número FPKT; aqui Cód. Aluno = Número FPKT, então
//      a aba Histórico resolve por essa coluna. Evento segue os formatos que o
//      import parseia: "dd/mm/aaaa - Mudança para a faixa X" e
//      "dd/mm/aaaa - Mudança da academia A para a academia B".)
//
// Filtros: Praticantes (sempre) · Trajetória de faixas (toggle) ·
//          Transferências (toggle) · Situação (Todos/Ativos/Inativos).
//
// Web-only: monta o .xlsx com SheetJS (já no app) e dispara download via Blob,
// no mesmo espírito do utils/clipboard (Web API, sem dependência nova).
// ============================================================
import React, { useState, useCallback } from "react";
import {
  Modal, View, Text, Pressable, TouchableOpacity, ActivityIndicator,
  Platform, useWindowDimensions, StyleSheet, ViewStyle, TextStyle, Alert,
} from "react-native";
import { Icon } from "@/components/Icon";
import type * as XLSX from "xlsx";
import { ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi, ExportDojoPayload } from "@/services/karateApi";

interface Props {
  federationId: string;
  visible: boolean;
  dojoId: string;
  dojoName?: string | null;
  fpktId?: string | null;
  onClose: () => void;
}

type SituFilter = "all" | "active" | "inactive";

// ── ISO (YYYY-MM-DD) → dd/mm/aaaa (formato que o import parseia) ──
function toBr(iso: string | null): string {
  if (!iso) return "";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Constrói uma worksheet no formato do import: linha 1 = banner, linha 2 =
// cabeçalhos, linhas seguintes = dados. (O import lê com range:1.)
function sheetWithBanner(banner: string, headers: string[], rows: (string | null)[][], xlsx: typeof import("xlsx")): XLSX.WorkSheet {
  const aoa: (string | null)[][] = [
    [banner],
    headers,
    ...rows.map((r) => headers.map((_, i) => (r[i] ?? ""))),
  ];
  return xlsx.utils.aoa_to_sheet(aoa);
}

const slug = (s: string) =>
  (s || "dojo").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "dojo";

export function DojoExportModal({ federationId, visible, dojoId, dojoName, fpktId, onClose }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(560, width - 24);

  const [includeBelts, setIncludeBelts] = useState(true);
  const [includeTransfers, setIncludeTransfers] = useState(true);
  const [situ, setSitu] = useState<SituFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildAndDownload = useCallback(async (data: ExportDojoPayload) => {
    // perf: xlsx (~1MB) carregado sob demanda, fora do bundle inicial
    const xlsx = await import("xlsx");
    const wb = xlsx.utils.book_new();

    // ── Academias ──
    const acaHeaders = ["Cód.", "Academia", "Status", "Endereço", "Bairro", "Cidade", "Estado", "Telefone"];
    const d = data.dojo;
    // Endereço: usa o texto livre legado se houver; senão compõe do estruturado.
    const addr = d.address || [d.address_street, d.address_number].filter(Boolean).join(", ") || "";
    const acaRows: (string | null)[][] = [[
      d.cod || "",
      d.name || "",
      d.status === "active" || d.is_active ? "Ativo" : (d.status ? "Ativo" : "Ativo"),
      addr,
      d.address_neighborhood || "",
      d.address_city || "",
      d.address_state || "",
      d.phone || "",
    ]];
    // Status do dojô: o import só distingue Ativo×Inativo. Mantemos "Ativo"
    // (dojôs exportados estão na rede); o reimport completa o que falta.
    xlsx.utils.book_append_sheet(wb, sheetWithBanner("Academias — exportado do Aura", acaHeaders, acaRows, xlsx), "Academias");

    // ── Alunos ──
    const aluHeaders = [
      "Cód. Aluno", "Nome", "Nascimento", "Situação", "Número FPKT", "CPF", "RG",
      "Logradouro", "Número", "Bairro", "Cidade", "Estado", "CEP", "Telefone", "Faixa", "Academia",
    ];
    const aluRows: (string | null)[][] = data.praticantes.map((p) => [
      p.cod_aluno || p.numero_fpkt || "",
      p.nome || "",
      toBr(p.nascimento),
      p.situacao || "",
      p.numero_fpkt || "",
      p.cpf || "",
      p.rg || "",
      p.logradouro || "",
      p.numero || "",
      p.bairro || "",
      p.cidade || "",
      p.estado || "",
      p.cep || "",
      p.telefone || "",
      p.faixa_atual || "",
      p.academia_name || d.name || "",
    ]);
    xlsx.utils.book_append_sheet(wb, sheetWithBanner("Alunos — exportado do Aura", aluHeaders, aluRows, xlsx), "Alunos");

    // ── Histórico (faixas + transferências) ──
    // Só monta a aba se algum dos toggles estiver ligado.
    if (includeBelts || includeTransfers) {
      const histHeaders = ["Cód. Aluno", "Tipo", "Evento"];
      const histRows: (string | null)[][] = [];
      if (includeBelts) {
        for (const ev of data.belt_events) {
          if (!ev.practitioner_ref || !ev.data || !ev.faixa) continue;
          histRows.push([
            ev.practitioner_ref,
            "Mudança de Faixa",
            `${toBr(ev.data)} - Mudança para a faixa ${ev.faixa}.`,
          ]);
        }
      }
      if (includeTransfers) {
        for (const t of data.transfers) {
          if (!t.practitioner_ref || !t.data || !t.destino) continue;
          histRows.push([
            t.practitioner_ref,
            "Transferência",
            `${toBr(t.data)} - Mudança da academia ${t.origem || ""} para a academia ${t.destino}`,
          ]);
        }
      }
      xlsx.utils.book_append_sheet(wb, sheetWithBanner("Histórico — exportado do Aura", histHeaders, histRows, xlsx), "Histórico");
    }

    // ── Download (web) ──
    const today = new Date().toISOString().slice(0, 10);
    const fname = `FPKT_${slug(fpktId || d.cod || "dojo")}_${slug(dojoName || d.name || "dojo")}_${today}.xlsx`;
    const out = xlsx.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [includeBelts, includeTransfers, dojoName, fpktId]);

  const handleExport = useCallback(async () => {
    setError(null);
    if (Platform.OS !== "web") {
      Alert.alert("Use no computador", "A exportação de planilha funciona no Aura pelo navegador (desktop).");
      return;
    }
    setBusy(true);
    try {
      const data = await karateApi.exportDojoData(federationId, dojoId, {
        status: situ,
        include_belts: includeBelts,
        include_transfers: includeTransfers,
      });
      await buildAndDownload(data);
      setBusy(false);
      onClose();
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Não foi possível exportar os dados. Tente novamente.");
    }
  }, [federationId, dojoId, situ, includeBelts, includeTransfers, buildAndDownload, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { width: cardW }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · Exportar</Text>
              <Text style={styles.title}>Exportar dados do dojô<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>
                Baixa uma planilha (.xlsx) no mesmo formato da importação — você edita e reenvia pela Importação para atualizar em massa.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><Icon name="x" size={20} color={P.ink2} /></TouchableOpacity>
          </View>

          <View style={{ padding: 20, paddingTop: 14 }}>
            {/* Dados a incluir */}
            <Text style={styles.label}>Dados a incluir</Text>
            <View style={styles.fixedRow}>
              <Icon name="users" size={16} color={P.ink2} />
              <Text style={styles.fixedTxt}>Praticantes</Text>
              <Text style={styles.fixedHint}>sempre incluído</Text>
            </View>
            <ToggleRow
              icon="ribbon"
              label="Trajetória de faixas"
              hint="histórico de graduações na aba Histórico"
              on={includeBelts}
              onToggle={() => setIncludeBelts((v) => !v)}
            />
            <ToggleRow
              icon="repeat"
              label="Transferências"
              hint="mudanças de academia na aba Histórico"
              on={includeTransfers}
              onToggle={() => setIncludeTransfers((v) => !v)}
            />

            {/* Situação */}
            <Text style={[styles.label, { marginTop: 18 }]}>Situação</Text>
            <View style={styles.chips}>
              {([["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]] as [SituFilter, string][]).map(([k, lbl]) => {
                const on = situ === k;
                return (
                  <TouchableOpacity key={k} style={[styles.chip, on && styles.chipOn]} onPress={() => setSitu(k)} activeOpacity={0.85} accessibilityLabel={`Situação ${lbl}`}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? (
              <View style={styles.errBox}><Icon name="alert_circle" size={15} color={P.red} /><Text style={styles.errTxt}>{error}</Text></View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleExport} disabled={busy} style={[styles.btnPrimary, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Exportar planilha">
              {busy ? <ActivityIndicator color="#fdf8f2" size="small" /> : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name="download" size={16} color="#fdf8f2" />
                  <Text style={styles.btnPrimaryTxt}>Exportar .xlsx</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ icon, label, hint, on, onToggle }: { icon: any; label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={[styles.toggleRow, on && styles.toggleRowOn]} onPress={onToggle} activeOpacity={0.85} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <Icon name={icon} size={16} color={on ? P.red : P.ink3} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, on && { color: P.ink }]}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 22, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 4, lineHeight: 17 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 8, textTransform: "uppercase" } as TextStyle,

  fixedRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.paper3, borderWidth: 1, borderColor: P.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 } as ViewStyle,
  fixedTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink, flex: 1 } as TextStyle,
  fixedHint: { fontFamily: F.body, fontSize: 11, color: P.ink3 } as TextStyle,

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8 } as ViewStyle,
  toggleRowOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  toggleLabel: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink2 } as TextStyle,
  toggleHint: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 1 } as TextStyle,

  switch: { width: 40, height: 23, borderRadius: 999, backgroundColor: P.line2, padding: 2, justifyContent: "center" } as ViewStyle,
  switchOn: { backgroundColor: P.red } as ViewStyle,
  knob: { width: 19, height: 19, borderRadius: 999, backgroundColor: "#fdf8f2" } as ViewStyle,
  knobOn: { alignSelf: "flex-end" } as ViewStyle,

  chips: { flexDirection: "row", gap: 8 } as ViewStyle,
  chip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  chipOn: { borderColor: P.red, backgroundColor: P.redWash } as ViewStyle,
  chipTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink2 } as TextStyle,
  chipTxtOn: { color: P.red } as TextStyle,

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11, marginTop: 14 } as ViewStyle,
  errTxt: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  btnGhostTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: P.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 160, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
});

export default DojoExportModal;
