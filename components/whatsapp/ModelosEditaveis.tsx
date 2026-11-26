// ModelosEditaveis — a lista de modelos de uma automática, com o Editor da
// lojista abrindo no lugar da lista (nada de overlay dentro do shell).
// "Ajustar para mim" (texto não aprovado) abre o editor; "Ficar com o da
// Aura" descarta o texto recusado (POST /modelos/:key/restaurar).
import React, { useCallback, useState } from "react";
import { Text } from "react-native";
import { Colors } from "@/constants/colors";
import { waConfigApi, erroConfig, type WaModeloRaw } from "@/services/waConfigApi";
import { useWaModelos } from "@/hooks/useWaAutomatica";
import { useClientesPrevia } from "@/hooks/useClientesPrevia";
import { ModelosLista } from "./ModelosLista";
import { EditorMensagem } from "./EditorMensagem";

interface Props {
  companyId: string;
  automatica: "aniversario" | "venda_mais" | "crediario";
  lojaNome: string;
  /** Só estes modelos (ex.: o do tom escolhido). */
  chaves?: string[];
  /** Lista já carregada pelo pai (evita ler duas vezes). Sem ela, lê aqui. */
  modelosDoPai?: { modelos: WaModeloRaw[] | null; carregando: boolean; recarregar: () => void };
}

export function ModelosEditaveis({ companyId, automatica, lojaNome, chaves, modelosDoPai }: Props) {
  const proprio = useWaModelos(companyId, automatica, !modelosDoPai);
  const m = modelosDoPai || proprio;
  const [editando, setEditando] = useState<WaModeloRaw | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const clientes = useClientesPrevia(companyId, automatica, lojaNome, !!editando);

  const restaurar = useCallback(async (mod: WaModeloRaw) => {
    setErro(null);
    try {
      await waConfigApi.restaurarModelo(companyId, String(mod.key));
      m.recarregar();
    } catch (e: any) {
      setErro(erroConfig(e).message);
    }
  }, [companyId, m]);

  if (editando) {
    // Sempre o modelo atual da lista (o estado pode ter mudado depois de enviar).
    const atual = (m.modelos || []).find((x) => x.key === editando.key) || editando;
    return (
      <EditorMensagem
        companyId={companyId} modelo={atual} clientes={clientes}
        onFechar={() => setEditando(null)} onMudou={() => m.recarregar()}
      />
    );
  }

  return (
    <>
      <ModelosLista
        automatica={automatica} modelos={m.modelos} carregando={m.carregando} chaves={chaves}
        onEditar={setEditando} onRestaurar={restaurar}
      />
      {!!erro && <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.red }} testID="wa-modelos-erro">{erro}</Text>}
    </>
  );
}
