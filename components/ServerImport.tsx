import { Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { useServerImport, type ServerImportEntity, type ServerImportResult } from "@/hooks/useServerImport";
import { useImportProdutos } from "@/hooks/useImportProdutos";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";

type Props = {
  entity: ServerImportEntity;
  onComplete?: (result: ServerImportResult) => void;
};

const LABELS: Record<ServerImportEntity, string> = {
  products: "Escolher planilha (Excel ou CSV)",
  customers: "Importar clientes (planilha)",
  transactions: "Importar lançamentos (planilha)",
};

// A lógica de leitura (csv/tsv/txt e xlsx/xls) e o POST pro backend
// vivem em useServerImport.
//
// 23/09/2026 (QA): produtos não gravam mais direto — passam pela
// conferência (ImportPlanilhaModal, hooks/useImportProdutos) antes de
// gravar. O Estoque usa o controlador direto (menu "Importar" e estado
// vazio); este caminho existe para qualquer outro lugar que renderize
// <ServerImport entity="products" /> não pular a prévia.
export function ServerImport({ entity, onComplete }: Props) {
  if (entity === "products") return <ServerImportProdutos onComplete={onComplete} />;
  return <ServerImportGenerico entity={entity} onComplete={onComplete} />;
}

function ServerImportGenerico({ entity, onComplete }: Props) {
  const { loading, handleImport } = useServerImport(entity, onComplete);

  return (
    <Pressable onPress={handleImport} disabled={loading} style={[s.btn, loading && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="file_text" size={14} color={Colors.violet3} />}
      <Text style={s.text}>{loading ? "Importando..." : LABELS[entity] || "Importar"}</Text>
    </Pressable>
  );
}

function ServerImportProdutos({ onComplete }: { onComplete?: (result: ServerImportResult) => void }) {
  const imp = useImportProdutos(r => onComplete?.({
    imported: r.gravados,
    skipped: r.repetidasNaPlanilha.length + r.jaExistem.length,
    errors: r.problemas.map(p => `Linha ${p.linha}: ${p.motivo}`),
  }));
  return (
    <>
      <Pressable onPress={imp.escolherArquivo} disabled={imp.ocupado} style={[s.btn, imp.ocupado && { opacity: 0.6 }]}>
        {imp.ocupado ? <ActivityIndicator size="small" color={Colors.violet3} /> : <Icon name="file_text" size={14} color={Colors.violet3} />}
        <Text style={s.text}>{LABELS.products}</Text>
      </Pressable>
      <WebPortal active={imp.aberto}>
        <ImportPlanilhaModal
          fase={imp.fase}
          resumo={imp.resumo}
          resultado={imp.resultado}
          erro={imp.erro}
          nomeArquivo={imp.nomeArquivo}
          onImportar={imp.importar}
          onFechar={imp.fechar}
          onBaixarProblemas={imp.baixarProblemas}
        />
      </WebPortal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  text: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});

export default ServerImport;
