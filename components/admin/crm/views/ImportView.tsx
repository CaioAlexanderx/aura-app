// ─── ImportView ──────────────────────────────────────────────────────────────
// Importar planilha Excel/CSV (XLSX) + editor de template WhatsApp.
// Mapping mantem o mesmo do ProspecaoAdmin antigo (aba "Com Telefone" preferida).
// ============================================================================

import { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { WA_TEMPLATE_DEFAULT } from "../shared/constants";
import { extractCity } from "../shared/helpers";
import { toast } from "@/components/Toast";
import * as DocumentPicker from "expo-document-picker";
import type { ImportStats } from "../shared/types";

type Props = {
  waTemplate: string;
  setWaTemplate: (t: string) => void;
  onImport: (leads: any[]) => void;
  isImporting?: boolean;
  importStats?: ImportStats | null;
};

export function ImportView({ waTemplate, setWaTemplate, onImport, isImporting, importStats }: Props) {
  const [reading, setReading] = useState(false);

  async function pickExcel() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "*/*",
        ],
      });
      if (result.canceled || !result.assets?.length) return;
      setReading(true);

      // perf: xlsx (~1MB) carregado sob demanda, fora do bundle inicial
      const XLSX = await import("xlsx");
      const asset = result.assets[0];
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.includes("Com Telefone") ? "Com Telefone" : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const mapped = rows.map((r) => {
        const address = String(r.endereco || r.address || "").trim();
        return {
          name:           String(r.nome || r.name || "").trim(),
          phone:          String(r.telefone || r.phone || "").trim(),
          city:           String(r.cidade || r.city || "").trim() || extractCity(address),
          category:       String(r.categoria_busca || r.categoria || r.category || "").trim(),
          address,
          website:        String(r.site || r.website || "").trim(),
          google_rating:  r.nota_google   || r.google_rating  || null,
          google_reviews: r.num_avaliacoes || r.google_reviews || null,
        };
      }).filter((r) => r.name || r.phone);

      setReading(false);

      if (!mapped.length) {
        toast.info("Nenhuma linha valida encontrada");
        return;
      }

      toast.info(`Importando ${mapped.length} leads...`);
      onImport(mapped);
    } catch (e) {
      setReading(false);
      toast.error("Erro ao ler arquivo");
    }
  }

  const disabled = reading || !!isImporting;

  return (
    <View>
      {/* Bloco de importacao */}
      <View style={cs.section}>
        <Text style={cs.sectionTitle}>Importar planilha</Text>
        <Text style={cs.hintText}>
          Selecione o Excel gerado pelo script Python. A aba "Com Telefone" e escolhida
          automaticamente. Cidade e extraida do endereco quando nao ha coluna explicita.
        </Text>

        <Pressable
          onPress={pickExcel}
          disabled={disabled}
          style={[cs.importBtn, disabled && { opacity: 0.5 }]}
        >
          {disabled ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={cs.importBtnText}>Selecionar arquivo Excel / CSV</Text>
          )}
        </Pressable>

        {importStats && (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <Stat color={Colors.green} val={importStats.inserted} label="Inseridos" />
            <Stat color={Colors.amber} val={importStats.skipped}  label="Ignorados" />
          </View>
        )}
      </View>

      {/* Template WhatsApp */}
      <View style={cs.section}>
        <Text style={cs.sectionTitle}>Template WhatsApp</Text>
        <Text style={cs.hintText}>
          Use {"{nome}"} como variavel — sera substituido pelo primeiro nome do lead ao copiar.
          O botao "Copiar msg" aparece em cada lead na lista e no detalhe.
        </Text>
        <TextInput
          value={waTemplate}
          onChangeText={setWaTemplate}
          multiline
          numberOfLines={8}
          style={[cs.noteInput, { minHeight: 160 }]}
        />
        <Pressable
          onPress={() => setWaTemplate(WA_TEMPLATE_DEFAULT)}
          style={[cs.actionBtn, { marginTop: 8, alignSelf: "flex-start" }]}
        >
          <Text style={cs.actionBtnText}>Restaurar padrao</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ color, val, label }: { color: string; val: number; label: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: Colors.bg4,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: Colors.border,
    }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color }}>{val}</Text>
      <Text style={{ fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}
